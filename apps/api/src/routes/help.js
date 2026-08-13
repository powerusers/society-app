import { Router } from "express";
import {
  can, isFlatMember, createHelpSchema, updateHelpSchema, rateHelpSchema, checkHelpSchema,
} from "@gvs/shared";
import { many, one, query, tx } from "../db/pool.js";
import { requireAuth, requireCap } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { audit, auditCtx } from "../lib/audit.js";
import { conflict, forbidden, notFound, unprocessable, wrap } from "../lib/errors.js";

export const helpRouter = Router();
helpRouter.use(requireAuth);

/* A household sees the help attached to its own flat. Anyone who works the gate
   or manages staff sees everyone, because that is the register the desk uses. */
const seesEveryone = (user) => can(user.role, "gate.view") || can(user.role, "staff.manage");

const ROWS = `
  SELECT h.*,
         COALESCE(fl.flats, '[]'::json) AS flats,
         open.in_at   AS open_in_at,
         open.id      AS open_visit_id,
         r.avg_stars,
         r.raters,
         mine.stars   AS my_stars,
         (att.flat_id IS NOT NULL) AS attached_to_mine
    FROM daily_help h
    LEFT JOIN (
      SELECT hf.help_id, json_agg(f.code ORDER BY f.code) AS flats
        FROM daily_help_flats hf JOIN flats f ON f.id = hf.flat_id
       GROUP BY hf.help_id
    ) fl ON fl.help_id = h.id
    LEFT JOIN help_attendance open ON open.help_id = h.id AND open.out_at IS NULL
    LEFT JOIN (
      SELECT help_id, round(avg(stars)::numeric, 1) AS avg_stars, count(*)::int AS raters
        FROM help_ratings GROUP BY help_id
    ) r ON r.help_id = h.id
    LEFT JOIN help_ratings mine ON mine.help_id = h.id AND mine.flat_id = $2
    LEFT JOIN daily_help_flats att ON att.help_id = h.id AND att.flat_id = $2
   WHERE h.society_id = $1`;

/**
 * One staff member, from this caller's side.
 *
 * `status` is derived from the open attendance row rather than stored, so
 * "inside now" cannot drift away from the register the gate is writing.
 */
const serialize = (h) => ({
  id: h.id,
  name: h.name,
  role: h.role,
  phone: h.phone,
  cardCode: h.card_code,
  biometric: h.biometric,
  policeVerified: h.police_verified,
  flats: h.flats || [],
  status: h.open_in_at ? "in" : "out",
  lastIn: h.open_in_at,
  /* An average across the households who employ them, with the count, so a
     five from one flat does not read like a settled reputation. */
  rating: h.avg_stars === null || h.avg_stars === undefined ? null : Number(h.avg_stars),
  raters: h.raters || 0,
  myRating: h.my_stars ?? null,
  mine: !!h.attached_to_mine,
  at: h.created_at,
});

const visit = (a) => ({
  id: a.id,
  helpId: a.help_id,
  helpName: a.help_name ?? null,
  helpRole: a.help_role ?? null,
  date: (a.in_at instanceof Date ? a.in_at.toISOString() : a.in_at).slice(0, 10),
  inAt: a.in_at,
  outAt: a.out_at,
  mode: a.mode,
  gateId: a.gate_id,
  gateName: a.gate_name ?? null,
});

helpRouter.get("/", wrap(async (req, res) => {
  const all = seesEveryone(req.user);
  const rows = all
    ? await many(`${ROWS} ORDER BY h.name`, [req.user.society_id, req.user.flat_id])
    : await many(`${ROWS} AND att.flat_id IS NOT NULL ORDER BY h.name`, [req.user.society_id, req.user.flat_id]);
  res.json({ help: rows.map(serialize), scope: all ? "society" : "flat" });
}));

const loadOne = async (req, id = req.params.id) => {
  const row = await one(`${ROWS} AND h.id = $3`, [req.user.society_id, req.user.flat_id, id]);
  if (!row) throw notFound("No such staff member");
  return row;
};

/** Reading someone's record needs a reason: they work for you, or you work the gate. */
const mayRead = (row, user) => {
  if (seesEveryone(user) || row.attached_to_mine) return;
  throw forbidden("That staff member does not work at your flat");
};

helpRouter.get("/:id", wrap(async (req, res) => {
  const row = await loadOne(req);
  mayRead(row, req.user);
  res.json({ help: serialize(row) });
}));

/**
 * The card the gate scans.
 *
 * A guard has a card in their hand and needs the person it belongs to. Not
 * open to residents: the card code is the credential the check-in desk trusts.
 */
helpRouter.get("/card/:code", requireCap("gate.view"), wrap(async (req, res) => {
  const row = await one(`${ROWS} AND upper(h.card_code) = upper($3)`,
    [req.user.society_id, req.user.flat_id, req.params.code.trim()]);
  if (!row) throw notFound("No staff card matches that code");
  res.json({ help: serialize(row) });
}));

const code6 = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 — these get read aloud at a gate
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
};

helpRouter.post("/", validate(createHelpSchema), wrap(async (req, res) => {
  const { name, role, phone, biometric, policeVerified } = req.body;

  const forOther = req.body.flatCode && req.body.flatCode !== req.user.flat;
  if (forOther && !can(req.user.role, "staff.manage")) {
    throw forbidden("You can only add help for your own flat");
  }
  const flatCode = forOther ? req.body.flatCode : req.user.flat;
  if (!flatCode) throw unprocessable("Daily help is registered against a flat, and your account has none");

  const flat = await one("SELECT id FROM flats WHERE society_id = $1 AND code = $2", [req.user.society_id, flatCode]);
  if (!flat) throw unprocessable(`Flat ${flatCode} is not on the society's register`);

  /* Only the committee decides that police verification has been done — a
     resident ticking their own box would make the badge worthless. */
  const verified = can(req.user.role, "staff.manage") ? policeVerified : false;

  const created = await tx(async (c) => {
    /* Retried rather than trusted: a six-character code collides eventually,
       and the person it collides with is whoever the gate scans next. */
    for (let attempt = 0; attempt < 5; attempt++) {
      const card = code6();
      const { rows } = await c.query(
        `INSERT INTO daily_help (society_id, name, role, phone, card_code, biometric, police_verified)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (society_id, card_code) DO NOTHING RETURNING id`,
        [req.user.society_id, name, role, phone || "", card, biometric, verified],
      );
      if (rows.length) {
        await c.query("INSERT INTO daily_help_flats (help_id, flat_id) VALUES ($1,$2)", [rows[0].id, flat.id]);
        return rows[0];
      }
    }
    throw conflict("Could not issue a staff card just now — try again");
  });

  await audit(auditCtx(req), { action: "help.add", entity: name, entityId: created.id, detail: `${role} · ${flatCode}` });
  res.status(201).json({ help: serialize(await loadOne(req, created.id)) });
}));

helpRouter.patch("/:id", validate(updateHelpSchema), wrap(async (req, res) => {
  const found = await loadOne(req);
  mayRead(found, req.user);
  if (req.body.policeVerified !== undefined && !can(req.user.role, "staff.manage")) {
    throw forbidden("Only the committee records police verification");
  }
  const columns = { name: "name", role: "role", phone: "phone", biometric: "biometric", policeVerified: "police_verified" };
  const keys = Object.keys(columns).filter((k) => req.body[k] !== undefined);
  const sets = keys.map((k, i) => `${columns[k]} = $${i + 1}`).join(", ");
  await query(
    `UPDATE daily_help SET ${sets} WHERE id = $${keys.length + 1} AND society_id = $${keys.length + 2}`,
    [...keys.map((k) => req.body[k]), found.id, req.user.society_id],
  );
  await audit(auditCtx(req), { action: "help.update", entity: found.name, entityId: found.id, detail: keys.join(", ") });
  res.json({ help: serialize(await loadOne(req)) });
}));

/**
 * Attaching someone who already works in the society.
 *
 * The commonest way a household finds help is a neighbour's maid taking on
 * another flat. Adding her again as a new person would give her a second card,
 * and the gate would have two records for one human being.
 */
helpRouter.post("/:id/flats", wrap(async (req, res) => {
  const found = await loadOne(req);
  if (!req.user.flat_id) throw unprocessable("Your account is not attached to a flat");
  if (found.attached_to_mine) throw conflict("They already work at your flat");
  await query("INSERT INTO daily_help_flats (help_id, flat_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
    [found.id, req.user.flat_id]);
  await audit(auditCtx(req), { action: "help.attach", entity: found.name, entityId: found.id, detail: req.user.flat });
  res.json({ help: serialize(await loadOne(req)) });
}));

/**
 * Detaching.
 *
 * Removing them from your flat, not from the society — the other households
 * they work for are none of your business to end. The record goes only when
 * the last flat lets go of it.
 */
helpRouter.delete("/:id/flats", wrap(async (req, res) => {
  const found = await loadOne(req);
  if (!found.attached_to_mine) throw conflict("They do not work at your flat");
  const remaining = await tx(async (c) => {
    await c.query("DELETE FROM daily_help_flats WHERE help_id = $1 AND flat_id = $2", [found.id, req.user.flat_id]);
    const { rows: [n] } = await c.query("SELECT count(*)::int AS n FROM daily_help_flats WHERE help_id = $1", [found.id]);
    if (n.n === 0) await c.query("DELETE FROM daily_help WHERE id = $1 AND society_id = $2", [found.id, req.user.society_id]);
    return n.n;
  });
  await audit(auditCtx(req), {
    action: "help.detach", entity: found.name, entityId: found.id,
    detail: remaining === 0 ? "last flat — record removed" : req.user.flat,
  });
  res.status(204).end();
}));

/** Only a household they actually work for may rate them. */
helpRouter.post("/:id/rating", validate(rateHelpSchema), wrap(async (req, res) => {
  const found = await loadOne(req);
  if (!found.attached_to_mine) throw forbidden("Only a flat they work at can rate them");
  await query(
    `INSERT INTO help_ratings (help_id, flat_id, stars) VALUES ($1,$2,$3)
     ON CONFLICT (help_id, flat_id) DO UPDATE SET stars = EXCLUDED.stars, rated_at = now()`,
    [found.id, req.user.flat_id, req.body.stars],
  );
  res.json({ help: serialize(await loadOne(req)) });
}));

/* ---------------- attendance ---------------- */

const VISITS = `
  SELECT a.*, h.name AS help_name, h.role AS help_role, g.name AS gate_name
    FROM help_attendance a
    JOIN daily_help h ON h.id = a.help_id
    LEFT JOIN gates g ON g.id = a.gate_id
   WHERE a.society_id = $1`;

/**
 * The attendance register.
 *
 * A household sees the people who work for it; the gate sees everyone. Either
 * way it is the same rows — the resident's "did she come today?" and the
 * desk's "who is inside?" are one question asked from two sides.
 */
helpRouter.get("/attendance/recent", wrap(async (req, res) => {
  const all = seesEveryone(req.user);
  const rows = all
    ? await many(`${VISITS} ORDER BY a.in_at DESC LIMIT 200`, [req.user.society_id])
    : await many(
      `${VISITS} AND a.help_id IN (SELECT help_id FROM daily_help_flats WHERE flat_id = $2)
        ORDER BY a.in_at DESC LIMIT 200`,
      [req.user.society_id, req.user.flat_id],
    );
  res.json({ attendance: rows.map(visit) });
}));

/**
 * Check-in and check-out.
 *
 * Whether someone is inside is the existence of an open row, and a unique index
 * allows one of those per person. Two gates tapping "check in" at once cannot
 * both open a visit, which is what a status column would have let them do.
 */
helpRouter.post("/:id/attendance", requireCap("gate.operate"), validate(checkHelpSchema), wrap(async (req, res) => {
  const found = await loadOne(req);
  const { direction, mode, gateId } = req.body;

  if (direction === "in") {
    if (found.open_visit_id) throw conflict(`${found.name} is already inside`);
    await query(
      `INSERT INTO help_attendance (society_id, help_id, mode, gate_id, marked_by)
       VALUES ($1,$2,$3,$4,$5)`,
      [req.user.society_id, found.id, mode, gateId || req.user.gate_id || null, req.user.id],
    );
  } else {
    if (!found.open_visit_id) throw conflict(`${found.name} is not inside`);
    await query("UPDATE help_attendance SET out_at = now() WHERE id = $1", [found.open_visit_id]);
  }

  await audit(auditCtx(req), {
    action: direction === "in" ? "help.checkin" : "help.checkout",
    entity: found.name, entityId: found.id, detail: mode,
  });
  res.json({ help: serialize(await loadOne(req)) });
}));
