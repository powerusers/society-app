import { Router } from "express";
import { z } from "zod";
import { can, parseFlatRegister, importFlatsSchema } from "@gvs/shared";
import { many, one, tx } from "../db/pool.js";
import { requireAuth, requireCap } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { audit, auditCtx } from "../lib/audit.js";
import { flat as toFlat, directoryUser } from "../lib/serialize.js";
import { conflict, notFound, unprocessable, wrap } from "../lib/errors.js";

export const flatsRouter = Router();
flatsRouter.use(requireAuth);

flatsRouter.get("/", wrap(async (req, res) => {
  const rows = await many(
    `SELECT f.*,
            COALESCE(SUM(b.total) FILTER (WHERE b.status <> 'paid' AND b.status <> 'pending-approval'), 0) AS dues
       FROM flats f LEFT JOIN bills b ON b.flat_id = f.id
      WHERE f.society_id = $1
      GROUP BY f.id ORDER BY f.code`,
    [req.user.society_id],
  );
  const withDues = can(req.user.role, "accounts.view");
  res.json({
    flats: rows.map((f) => ({ ...toFlat(f), ...(withDues ? { dues: Number(f.dues) } : {}) })),
  });
}));

/**
 * Import the society's flat register from a CSV.
 *
 * Two modes. `preview` parses and reports what would happen without touching a
 * row; `apply` writes. The preview exists because a register is not a list of
 * strings — carpet area drives every per-square-foot billing head, so a column
 * mapped to the wrong field would quietly change what every flat is charged.
 *
 * Nothing is ever deleted. Flats CASCADE into bills, payments and gate history,
 * so a code missing from the file means "not in this spreadsheet", not "no
 * longer exists" — removing one is a deliberate act that needs its own flow.
 */
flatsRouter.post("/import", requireCap("settings.write"), validate(importFlatsSchema), wrap(async (req, res) => {
  const parsed = parseFlatRegister(req.body.csv);
  if (!parsed.ok) throw unprocessable(parsed.error);
  if (!parsed.rows.length) throw unprocessable("That file has a header row but no flats under it");

  const societyId = req.user.society_id;
  const existing = new Map(
    (await many("SELECT code, block, floor, type, area, occupancy, parking_slots FROM flats WHERE society_id = $1", [societyId]))
      .map((f) => [f.code, f]),
  );

  const unchangedFrom = (before, after) =>
    before.block === after.block && before.floor === after.floor && before.type === after.type &&
    Number(before.area) === after.area && before.occupancy === after.occupancy &&
    Number(before.parking_slots) === after.parkingSlots;

  const rows = parsed.rows.map((r) => {
    if (!r.ok) return { line: r.line, code: r.flat.code, action: "invalid", errors: r.errors };
    const before = existing.get(r.flat.code);
    if (!before) return { line: r.line, code: r.flat.code, action: "create", flat: r.flat };
    return {
      line: r.line, code: r.flat.code, flat: r.flat,
      action: unchangedFrom(before, r.flat) ? "unchanged" : "update",
    };
  });

  const summary = rows.reduce((acc, r) => ({ ...acc, [r.action]: (acc[r.action] || 0) + 1 }),
    { create: 0, update: 0, unchanged: 0, invalid: 0 });

  if (req.body.mode !== "apply") return res.json({ mode: "preview", summary, rows });

  /* Refuse a partial write. Half an imported register is harder to reason
     about than none of it, and the admin has already seen exactly which lines
     are wrong in the preview. */
  if (summary.invalid > 0) {
    throw unprocessable(
      `${summary.invalid} row${summary.invalid === 1 ? "" : "s"} could not be read — fix them and import again`,
      Object.fromEntries(rows.filter((r) => r.action === "invalid").slice(0, 50).map((r) => [`line ${r.line}`, Object.values(r.errors)[0]])),
    );
  }

  const written = await tx(async (c) => {
    for (const r of rows) {
      if (r.action === "unchanged") continue;
      await c.query(
        `INSERT INTO flats (society_id, code, block, floor, type, area, occupancy, parking_slots)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (society_id, code) DO UPDATE SET
           block = EXCLUDED.block, floor = EXCLUDED.floor, type = EXCLUDED.type,
           area = EXCLUDED.area, occupancy = EXCLUDED.occupancy, parking_slots = EXCLUDED.parking_slots`,
        [societyId, r.flat.code, r.flat.block, r.flat.floor, r.flat.type, r.flat.area, r.flat.occupancy, r.flat.parkingSlots],
      );
    }

    /* Blocks drive the registration dropdown, so derive them from the register
       that now exists rather than leaving a hand-typed list to go stale. */
    const all = await c.query("SELECT DISTINCT block FROM flats WHERE society_id = $1 ORDER BY block", [societyId]);
    await c.query(
      "UPDATE societies SET settings = jsonb_set(settings, '{blocks}', $2::jsonb) WHERE id = $1",
      [societyId, JSON.stringify(all.rows.map((r) => r.block))],
    );
    return all.rows.map((r) => r.block);
  });

  await audit(auditCtx(req), {
    action: "flats.import",
    entity: `${summary.create} created, ${summary.update} updated`,
    after: { blocks: written, ...summary },
  });

  res.json({ mode: "apply", summary, blocks: written });
}));

flatsRouter.get("/:code", wrap(async (req, res) => {
  const f = await one("SELECT * FROM flats WHERE society_id = $1 AND code = $2", [req.user.society_id, req.params.code]);
  if (!f) throw notFound("No such flat");

  const occupants = await many(
    `SELECT u.*, f.code AS flat_code FROM users u JOIN flats f ON f.id = u.flat_id
      WHERE u.flat_id = $1 AND u.status = 'active' ORDER BY u.relation`,
    [f.id],
  );
  const reveal = can(req.user.role, "resident.approve") || req.user.flat_id === f.id;
  res.json({ flat: toFlat(f), occupants: occupants.map((u) => directoryUser(u, reveal)) });
}));

/* ---- registrations: the committee's approval queue ---- */

export const registrationsRouter = Router();
registrationsRouter.use(requireAuth, requireCap("resident.approve"));

const decisionSchema = z.object({
  reason: z.string().max(400).optional(),
});

registrationsRouter.get("/", wrap(async (req, res) => {
  const rows = await many(
    `SELECT id, name, flat_code, relation, phone, email, status, reason, created_at, decided_at
       FROM registrations WHERE society_id = $1 AND status = $2 ORDER BY created_at`,
    [req.user.society_id, req.query.status || "pending"],
  );
  res.json({
    registrations: rows.map((r) => ({
      id: r.id, name: r.name, flatCode: r.flat_code, relation: r.relation,
      phone: r.phone, email: r.email, status: r.status, reason: r.reason,
      at: r.created_at, decidedAt: r.decided_at,
    })),
  });
}));

/** Approving turns the application into a live account with the stored password. */
registrationsRouter.post("/:id/approve", wrap(async (req, res) => {
  const reg = await one(
    "SELECT * FROM registrations WHERE id = $1 AND society_id = $2",
    [req.params.id, req.user.society_id],
  );
  if (!reg) throw notFound("No such registration");
  if (reg.status !== "pending") throw conflict(`This application is already ${reg.status}`);

  const flat = await one("SELECT id FROM flats WHERE society_id = $1 AND code = $2", [req.user.society_id, reg.flat_code]);
  if (!flat) throw conflict(`Flat ${reg.flat_code} is no longer on the register`);

  const user = await tx(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO users (society_id, name, email, phone, password_hash, role, relation, flat_id, notify)
       VALUES ($1,$2,$3,$4,$5,'resident',$6,$7,$8::jsonb) RETURNING *`,
      [
        req.user.society_id, reg.name, reg.email, reg.phone, reg.password_hash, reg.relation, flat.id,
        JSON.stringify({ visitors: true, notices: true, payments: true, helpdesk: true, community: false, quietHours: false }),
      ],
    );
    await client.query(
      "UPDATE registrations SET status = 'approved', decided_by = $1, decided_at = now() WHERE id = $2",
      [req.user.id, reg.id],
    );
    await audit(auditCtx(req), {
      action: "resident.approve", entity: reg.name, entityId: rows[0].id, detail: `${reg.relation} · ${reg.flat_code}`,
    }, client);
    return rows[0];
  });

  res.json({ user: { id: user.id, name: user.name, email: user.email, flat: reg.flat_code, role: user.role } });
}));

registrationsRouter.post("/:id/reject", validate(decisionSchema), wrap(async (req, res) => {
  const reg = await one("SELECT * FROM registrations WHERE id = $1 AND society_id = $2", [req.params.id, req.user.society_id]);
  if (!reg) throw notFound("No such registration");
  if (reg.status !== "pending") throw conflict(`This application is already ${reg.status}`);

  await tx(async (client) => {
    await client.query(
      "UPDATE registrations SET status = 'rejected', reason = $1, decided_by = $2, decided_at = now() WHERE id = $3",
      [req.body.reason ?? null, req.user.id, reg.id],
    );
    await audit(auditCtx(req), {
      action: "resident.reject", entity: reg.name, entityId: reg.id, detail: req.body.reason || "",
    }, client);
  });

  res.json({ id: reg.id, status: "rejected" });
}));
