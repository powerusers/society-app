import { Router } from "express";
import { z } from "zod";
import { can, CAPABILITIES } from "@gvs/shared";
import { many, one, query } from "../db/pool.js";
import { requireAuth, requireCap } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { audit, auditCtx } from "../lib/audit.js";
import { publicUser, directoryUser, flat as toFlat, auditRow } from "../lib/serialize.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { revokeAllForUser } from "../lib/tokens.js";
import { badRequest, wrap } from "../lib/errors.js";

export const meRouter = Router();
meRouter.use(requireAuth);

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().regex(/^\d{10}$/).optional(),
  notify: z.record(z.boolean()).optional(),
}).refine((v) => Object.keys(v).length > 0, "Nothing to update");

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

meRouter.get("/", wrap(async (req, res) => {
  const flatRow = req.user.flat_id ? await one("SELECT * FROM flats WHERE id = $1", [req.user.flat_id]) : null;
  const society = await one("SELECT id, name, address, reg_no, gstin, settings, bank FROM societies WHERE id = $1", [req.user.society_id]);

  res.json({
    user: publicUser(req.user),
    flat: flatRow ? toFlat(flatRow) : null,
    society: society && {
      id: society.id, name: society.name, address: society.address,
      regNo: society.reg_no, gstin: society.gstin, settings: society.settings, bank: society.bank,
    },
    /* The client renders from this list rather than testing role strings, so
       the two never disagree about what a role may do. */
    capabilities: CAPABILITIES.filter((c) => can(req.user.role, c)),
  });
}));

meRouter.patch("/", validate(profileSchema), wrap(async (req, res) => {
  const patch = {};
  if (req.body.name) patch.name = req.body.name;
  if (req.body.phone) patch.phone = req.body.phone;
  if (req.body.notify) patch.notify = JSON.stringify({ ...req.user.notify, ...req.body.notify });

  const cols = Object.keys(patch);
  const params = [...cols.map((c) => patch[c]), req.user.id];
  const { rows } = await query(
    `UPDATE users SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(", ")} WHERE id = $${params.length}
     RETURNING *`,
    params,
  );
  await audit(auditCtx(req), { action: "profile.update", entity: req.user.email, detail: cols.join(", ") });
  res.json({ user: publicUser({ ...rows[0], flat_code: req.user.flat_code }) });
}));

meRouter.post("/password", validate(passwordSchema), wrap(async (req, res) => {
  const ok = await verifyPassword(req.body.currentPassword, req.user.password_hash);
  if (!ok) throw badRequest("Current password is incorrect");

  await query("UPDATE users SET password_hash = $1 WHERE id = $2", [await hashPassword(req.body.newPassword), req.user.id]);
  // Changing a password should end sessions elsewhere, so a stolen one dies with it.
  await revokeAllForUser(req.user.id);
  await audit(auditCtx(req), { action: "password.change", entity: req.user.email });
  res.status(204).end();
}));

/**
 * Resident directory.
 *
 * A number is revealed only to the committee, or when that resident has
 * explicitly opted in via `shareContact`. Deliberately not tied to any
 * notification preference — wanting marketplace alerts is not consent to
 * publish your phone number to 150 neighbours.
 */
meRouter.get("/directory", wrap(async (req, res) => {
  const reveal = can(req.user.role, "resident.approve");
  const rows = await many(
    `SELECT u.*, f.code AS flat_code
       FROM users u LEFT JOIN flats f ON f.id = u.flat_id
      WHERE u.society_id = $1 AND u.status = 'active' AND u.role <> 'guard'
      ORDER BY f.code NULLS LAST, u.name`,
    [req.user.society_id],
  );
  res.json({
    residents: rows.map((u) => directoryUser(u, reveal || u.id === req.user.id || !!u.notify?.shareContact)),
  });
}));

meRouter.get("/audit", requireCap("reports.view"), wrap(async (req, res) => {
  const rows = await many(
    `SELECT a.*, u.name AS actor_name FROM audit_log a
       LEFT JOIN users u ON u.id = a.actor_id
      WHERE a.society_id = $1 ORDER BY a.created_at DESC LIMIT 100`,
    [req.user.society_id],
  );
  res.json({ audit: rows.map(auditRow) });
}));

