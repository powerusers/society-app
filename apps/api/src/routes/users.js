import { Router } from "express";
import { canAssignRole, ROLE_REFUSAL, setRoleSchema } from "@gvs/shared";
import { many, one, tx } from "../db/pool.js";
import { requireAuth, requireCap } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { audit, auditCtx } from "../lib/audit.js";
import { forbidden, notFound, conflict, wrap } from "../lib/errors.js";

export const usersRouter = Router();

/* Managing members means seeing every account, including the guards the
   resident directory leaves out, and their real contact details — which is why
   this sits behind a capability rather than on the directory everyone reads. */
usersRouter.use(requireAuth, requireCap("staff.manage"));

const member = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  role: u.role,
  designation: u.designation,
  relation: u.relation,
  flat: u.flat_code ?? null,
  status: u.status,
  joined: u.created_at,
});

usersRouter.get("/", wrap(async (req, res) => {
  const rows = await many(
    `SELECT u.*, f.code AS flat_code
       FROM users u LEFT JOIN flats f ON f.id = u.flat_id
      WHERE u.society_id = $1
      ORDER BY CASE u.role WHEN 'admin' THEN 0 WHEN 'committee' THEN 1 WHEN 'staff' THEN 2
                           WHEN 'guard' THEN 3 ELSE 4 END, f.code NULLS LAST, u.name`,
    [req.user.society_id],
  );
  res.json({ members: rows.map(member) });
}));

/**
 * Change what someone may do.
 *
 * The rules that need only the two people involved live in the shared matrix,
 * so the screen refuses the same things before asking. The one that needs the
 * whole society is here: a society must keep at least one administrator, or
 * nobody can appoint one again and the deployment needs a database console to
 * recover.
 */
usersRouter.patch("/:id/role", validate(setRoleSchema), wrap(async (req, res) => {
  const target = await one(
    `SELECT u.*, f.code AS flat_code FROM users u LEFT JOIN flats f ON f.id = u.flat_id
      WHERE u.id = $1 AND u.society_id = $2`,
    [req.params.id, req.user.society_id],
  );
  if (!target) throw notFound("No such member of this society");

  const verdict = canAssignRole(req.user, target, req.body.role);
  if (!verdict.ok) throw forbidden(ROLE_REFUSAL[verdict.reason] || "That role change is not allowed");

  if (target.role === "admin" && req.body.role !== "admin") {
    const { count } = await one(
      "SELECT count(*)::int AS count FROM users WHERE society_id = $1 AND role = 'admin' AND status = 'active'",
      [req.user.society_id],
    );
    if (count <= 1) throw conflict(ROLE_REFUSAL.last_admin);
  }

  /* A demoted resident should not keep "Treasurer" under their name. Passing a
     designation always wins; omitting it keeps the old one, except on the way
     back to resident where the old one is meaningless. */
  const designation = req.body.designation !== undefined
    ? (req.body.designation || null)
    : (req.body.role === "resident" ? null : target.designation);

  const updated = await tx(async (c) => {
    const { rows } = await c.query(
      `UPDATE users SET role = $1, designation = $2 WHERE id = $3
       RETURNING *, (SELECT code FROM flats WHERE id = users.flat_id) AS flat_code`,
      [req.body.role, designation, target.id],
    );
    await audit(
      auditCtx(req),
      {
        action: "user.role",
        entity: target.email,
        entityId: target.id,
        detail: `${target.role} -> ${req.body.role}${designation ? ` (${designation})` : ""}`,
      },
      c,
    );
    return rows[0];
  });

  res.json({ member: member(updated) });
}));
