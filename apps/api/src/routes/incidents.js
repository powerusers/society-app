import { Router } from "express";
import { createIncidentSchema, closeIncidentSchema } from "@gvs/shared";
import { many, one, query } from "../db/pool.js";
import { requireAuth, requireCap } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { audit, auditCtx } from "../lib/audit.js";
import { conflict, notFound, wrap } from "../lib/errors.js";

export const incidentsRouter = Router();
incidentsRouter.use(requireAuth);

/**
 * The incident register is not a public board.
 *
 * Entries name people — "Visitor at Main Gate, flat B-204", a resident who
 * argued with the guard — so reading it is limited to the roles that work the
 * gate or answer for it. The More menu already hid it from residents; this is
 * the server saying the same thing, which is the half that counts.
 */
incidentsRouter.use(requireCap("gate.view"));

const ROWS = `
  SELECT i.*, u.name AS raised_by_name, c.name AS closed_by_name, g.name AS gate_name
    FROM incidents i
    LEFT JOIN users u ON u.id = i.raised_by
    LEFT JOIN users c ON c.id = i.closed_by
    LEFT JOIN gates g ON g.id = i.gate_id
   WHERE i.society_id = $1`;

const serialize = (i) => ({
  id: i.id,
  type: i.type,
  severity: i.severity,
  involves: i.involves,
  note: i.note,
  gateId: i.gate_id,
  gateName: i.gate_name ?? null,
  by: i.raised_by,
  /* An incident raised by someone who has since left the society keeps its
     record; naming them "System" would be a quieter lie than saying so. */
  byName: i.raised_by ? (i.raised_by_name || "A former member of staff") : "System",
  recording: i.recording_ref || "",
  status: i.status,
  closedBy: i.closed_by,
  closedByName: i.closed_by_name ?? null,
  closedAt: i.closed_at,
  closingNote: i.closing_note,
  at: i.created_at,
});

incidentsRouter.get("/", wrap(async (req, res) => {
  const rows = await many(`${ROWS} ORDER BY i.created_at DESC LIMIT 200`, [req.user.society_id]);
  res.json({ incidents: rows.map(serialize) });
}));

const loadOne = async (req) => {
  const row = await one(`${ROWS} AND i.id = $2`, [req.user.society_id, req.params.id]);
  if (!row) throw notFound("No such incident");
  return row;
};

/** A reference for the gate camera clip. No media is stored yet. */
const recordingRef = () => `REC-${Math.floor(1000 + Math.random() * 9000)}`;

incidentsRouter.post("/", requireCap("incident.write"), validate(createIncidentSchema), wrap(async (req, res) => {
  const { type, severity, involves, note, gateId } = req.body;
  const created = await one(
    `INSERT INTO incidents (society_id, type, severity, involves, note, gate_id, raised_by, recording_ref)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [req.user.society_id, type, severity, involves, note, gateId || req.user.gate_id || null,
      req.user.id, recordingRef()],
  );
  await audit(auditCtx(req), { action: "incident.create", entity: involves, entityId: created.id, detail: `${type} · ${severity}` });
  req.params.id = created.id;
  res.status(201).json({ incident: serialize(await loadOne(req)) });
}));

/**
 * Closing one.
 *
 * The committee's, not the gate's. The sheet the guard writes it on says the
 * record is "evidence for the committee, protection for the guard" — letting
 * the guard close their own incident would make it neither. So this needs
 * `helpdesk.manage`, which guards do not have and the committee does.
 */
incidentsRouter.post("/:id/close", requireCap("helpdesk.manage"), validate(closeIncidentSchema),
  wrap(async (req, res) => {
    const found = await loadOne(req);
    if (found.status === "closed") throw conflict("That incident is already closed");
    await query(
      `UPDATE incidents SET status = 'closed', closed_by = $1, closed_at = now(), closing_note = $2
        WHERE id = $3 AND society_id = $4`,
      [req.user.id, req.body.note, found.id, req.user.society_id],
    );
    await audit(auditCtx(req), { action: "incident.close", entity: found.involves, entityId: found.id, detail: req.body.note });
    res.json({ incident: serialize(await loadOne(req)) });
  }));

/**
 * Reopening.
 *
 * A closed incident that turns out to matter has to be able to come back —
 * otherwise the way to correct a premature close is to raise a duplicate, and
 * the register stops being a count of what happened.
 */
incidentsRouter.post("/:id/reopen", requireCap("helpdesk.manage"), wrap(async (req, res) => {
  const found = await loadOne(req);
  if (found.status === "open") throw conflict("That incident is already open");
  await query(
    `UPDATE incidents SET status = 'open', closed_by = NULL, closed_at = NULL, closing_note = ''
      WHERE id = $1 AND society_id = $2`,
    [found.id, req.user.society_id],
  );
  await audit(auditCtx(req), { action: "incident.reopen", entity: found.involves, entityId: found.id });
  res.json({ incident: serialize(await loadOne(req)) });
}));
