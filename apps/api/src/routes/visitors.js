import { Router } from "express";
import {
  can, canActOnFlat, isFlatMember, canTransitionVisitor, createVisitorSchema, transitionVisitorSchema,
  verifyPassSchema, listQuerySchema,
} from "@gvs/shared";
import { many, one, tx } from "../db/pool.js";
import { requireAuth, requireCap } from "../middleware/auth.js";
import { validate, validateQuery } from "../middleware/validate.js";
import { audit, auditCtx } from "../lib/audit.js";
import { visitor as toVisitor } from "../lib/serialize.js";
import { badRequest, conflict, forbidden, notFound, wrap } from "../lib/errors.js";

export const visitorsRouter = Router();
visitorsRouter.use(requireAuth);

const PASS_ALPHABET = "ACDEFGHJKLMNPQRTUVWXY3456789"; // no look-alike characters
const passCode = () =>
  Array.from({ length: 6 }, () => PASS_ALPHABET[Math.floor(Math.random() * PASS_ALPHABET.length)]).join("");

const SELECT = `
  SELECT v.*, f.code AS flat_code, g.name AS gate_name
    FROM visitors v
    JOIN flats f ON f.id = v.flat_id
    LEFT JOIN gates g ON g.id = v.gate_id`;

/** The society's gate devices — the client needs real ids to target one. */
visitorsRouter.get("/gates", wrap(async (req, res) => {
  const rows = await many(
    "SELECT id, name, device, status, features FROM gates WHERE society_id = $1 ORDER BY created_at",
    [req.user.society_id],
  );
  res.json({ gates: rows });
}));

/** Residents see their own flat's traffic; gate roles see the whole society. */
visitorsRouter.get("/", validateQuery(listQuerySchema), wrap(async (req, res) => {
  const { limit, offset, status, flatCode } = req.validQuery;
  const params = [req.user.society_id];
  const where = ["v.society_id = $1"];

  if (!can(req.user.role, "gate.view")) {
    if (!req.user.flat_id) return res.json({ visitors: [], total: 0 });
    params.push(req.user.flat_id);
    where.push(`v.flat_id = $${params.length}`);
  } else if (flatCode) {
    params.push(flatCode);
    where.push(`f.code = $${params.length}`);
  }

  if (status) {
    params.push(status.split(","));
    where.push(`v.status = ANY($${params.length})`);
  }

  params.push(limit, offset);
  const rows = await many(
    `${SELECT} WHERE ${where.join(" AND ")}
      ORDER BY v.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  res.json({ visitors: rows.map(toVisitor) });
}));

visitorsRouter.post("/", validate(createVisitorSchema), wrap(async (req, res) => {
  const b = req.body;

  /* A guard logs someone arriving (`waiting`); a resident pre-approves an
     expected visitor. Neither may create an entry for a flat they cannot act on. */
  const isGateStaff = can(req.user.role, "gate.operate");
  if (b.status === "waiting" && !isGateStaff) throw forbidden("Only gate staff can record an arrival");
  if (!canActOnFlat(req.user, b.flatCode)) throw forbidden("You can only raise visitors for your own flat");

  const flat = await one("SELECT id FROM flats WHERE society_id = $1 AND code = $2", [req.user.society_id, b.flatCode]);
  if (!flat) throw notFound(`Flat ${b.flatCode} does not exist`);

  const gate = b.gateId
    ? await one("SELECT id FROM gates WHERE id = $1 AND society_id = $2", [b.gateId, req.user.society_id])
    : await one("SELECT id FROM gates WHERE society_id = $1 ORDER BY created_at LIMIT 1", [req.user.society_id]);

  const settings = await societySettings(req.user.society_id);
  const allowedMins = b.allowedMins ?? (b.category === "delivery" ? settings.overstayMins : 240);
  const raisedBy = b.status === "waiting" ? `Guard · ${req.user.name}` : "Self";

  const created = await tx(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO visitors
         (society_id, flat_id, gate_id, name, category, status, purpose, phone, vehicle,
          pass_code, allowed_mins, recurring, expected_at, raised_by, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        req.user.society_id, flat.id, gate?.id ?? null, b.name, b.category, b.status, b.purpose,
        b.phone, b.vehicle, b.status === "pre-approved" ? passCode() : null,
        allowedMins, b.recurring, b.expectedAt ?? null, raisedBy, req.user.id,
      ],
    );
    await audit(auditCtx(req), {
      action: b.status === "pre-approved" ? "visitor.preapprove" : "visitor.create",
      entity: b.name, entityId: rows[0].id, detail: `${b.category} · ${b.flatCode}`,
    }, client);
    return rows[0];
  });

  const full = await one(`${SELECT} WHERE v.id = $1`, [created.id]);
  res.status(201).json({ visitor: toVisitor(full) });
}));

/**
 * The single lifecycle endpoint. Every move is checked three ways: the
 * transition must be legal, the caller must hold the right capability for that
 * particular move, and a resident must own the flat.
 */
visitorsRouter.patch("/:id/status", validate(transitionVisitorSchema), wrap(async (req, res) => {
  const { status: next, reason, allowedMins } = req.body;

  const current = await one(`${SELECT} WHERE v.id = $1 AND v.society_id = $2`, [req.params.id, req.user.society_id]);
  if (!current) throw notFound("No such visitor");

  if (!canTransitionVisitor(current.status, next)) {
    throw conflict(`A visitor cannot go from ${current.status} to ${next}`, { from: current.status, to: next });
  }

  const gateOnly = ["pending", "inside", "exited"];   // guard actions
  const flatOnly = ["approved"];                       // the household's own decision
  if (gateOnly.includes(next) && !can(req.user.role, "gate.operate")) {
    throw forbidden("Only gate staff can make that change");
  }
  /* Strict membership, not canActOnFlat: a guard holds gate.view, and letting
     the gate approve on the flat's behalf would defeat the send-to-flat step. */
  if (flatOnly.includes(next) && !isFlatMember(req.user, current.flat_code)) {
    throw forbidden("Only the flat itself can approve its visitor");
  }
  if (next === "denied" && !can(req.user.role, "gate.operate") && !canActOnFlat(req.user, current.flat_code)) {
    throw forbidden("Only the flat or gate staff can deny this visitor");
  }

  const patch = { status: next };
  const now = new Date();
  if (next === "pending") patch.sent_at = now;
  if (next === "approved") {
    patch.approved_at = now;
    patch.approved_by = req.user.id;
    patch.pass_code = current.pass_code || passCode();
    if (allowedMins) patch.allowed_mins = allowedMins;
  }
  if (next === "inside") { patch.entry_at = now; patch.verified_by = req.user.id; }
  if (next === "exited") patch.exit_at = now;
  if (next === "denied") { patch.deny_reason = reason ?? null; patch.approved_by = req.user.id; }

  const cols = Object.keys(patch);
  const sets = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
  const params = [...cols.map((c) => patch[c]), req.params.id];

  const updated = await tx(async (client) => {
    const { rows } = await client.query(
      `UPDATE visitors SET ${sets}, updated_at = now() WHERE id = $${params.length} RETURNING id`,
      params,
    );
    await audit(auditCtx(req), {
      action: `visitor.${next}`, entity: current.name, entityId: current.id,
      detail: `${current.flat_code}${reason ? ` · ${reason}` : ""}`,
    }, client);
    return rows[0];
  });

  const full = await one(`${SELECT} WHERE v.id = $1`, [updated.id]);
  res.json({ visitor: toVisitor(full) });
}));

/** Gate device scanning a QR pass. Returns the visitor without admitting them. */
visitorsRouter.post("/verify-pass", requireCap("gate.operate"), validate(verifyPassSchema), wrap(async (req, res) => {
  const code = req.body.passCode.toUpperCase();
  const found = await one(
    `${SELECT} WHERE v.society_id = $1 AND upper(v.pass_code) = $2
      ORDER BY v.created_at DESC LIMIT 1`,
    [req.user.society_id, code],
  );
  if (!found) throw notFound("No gate pass matches that code");
  if (!canTransitionVisitor(found.status, "inside")) {
    throw conflict(`That pass is ${found.status} and cannot be used for entry`, { status: found.status });
  }
  res.json({ visitor: toVisitor(found) });
}));

/** Anyone inside past their allowed minutes — the overstay alarm feed. */
visitorsRouter.get("/overstays", requireCap("gate.view"), wrap(async (req, res) => {
  const rows = await many(
    `${SELECT}
      WHERE v.society_id = $1 AND v.status = 'inside' AND v.entry_at IS NOT NULL
        AND now() > v.entry_at + make_interval(mins => COALESCE(v.allowed_mins, 20))`,
    [req.user.society_id],
  );
  res.json({
    overstays: rows.map((r) => ({
      ...toVisitor(r),
      overBy: Math.round((Date.now() - new Date(r.entry_at).getTime()) / 60000) - (r.allowed_mins ?? 20),
    })),
  });
}));

async function societySettings(societyId) {
  const row = await one("SELECT settings FROM societies WHERE id = $1", [societyId]);
  return { overstayMins: 20, settlementMins: 30, lateFeePct: 2, slaHours: { high: 4, medium: 24, low: 72 }, ...(row?.settings || {}) };
}

export { societySettings };
