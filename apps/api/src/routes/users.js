import { Router } from "express";
import {
  can, canAssignRole, PRIVILEGED_ROLES, ROLE_REFUSAL,
  setRoleSchema, createStaffSchema, updateStaffSchema,
} from "@gvs/shared";
import { many, one, query, tx } from "../db/pool.js";
import { requireAuth, requireCap } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { audit, auditCtx } from "../lib/audit.js";
import { hashPassword } from "../lib/password.js";
import { revokeAllForUser } from "../lib/tokens.js";
import { forbidden, notFound, conflict, unprocessable, wrap } from "../lib/errors.js";

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
  /* Where a guard is posted and when. On the account rather than on a roster,
     because it is what the gate console reads to know whose shift it is. */
  gateId: u.gate_id ?? null,
  gateName: u.gate_name ?? null,
  shift: u.shift ?? null,
  status: u.status,
  joined: u.created_at,
});

const MEMBERS = `
  SELECT u.*, f.code AS flat_code, g.name AS gate_name
    FROM users u
    LEFT JOIN flats f ON f.id = u.flat_id
    LEFT JOIN gates g ON g.id = u.gate_id
   WHERE u.society_id = $1`;

usersRouter.get("/", wrap(async (req, res) => {
  const rows = await many(
    `${MEMBERS}
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

const loadMember = async (req) => {
  const row = await one(`${MEMBERS} AND u.id = $2`, [req.user.society_id, req.params.id]);
  if (!row) throw notFound("No such member of this society");
  return row;
};

/* Read aloud at a gate and typed on a phone, so no characters that argue with
   each other — no I/l/1, no O/0. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const tempPassword = () => Array.from({ length: 3 }, () => Array.from(
  { length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)],
).join("")).join("-");

/**
 * A sign-in identifier when the person has no email.
 *
 * Many guards do not have a work address, and refusing to create the account
 * without one would push the committee into inventing something worse. Derived
 * from the society so one society's staff cannot collide with another's, and
 * numbered on collision so two people called Ramesh Kumar both get a login.
 */
const mintEmail = async (name, societyId, societyName) => {
  const domain = String(societyName || "society").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "society";
  const local = name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "") || "staff";
  for (let n = 0; n < 20; n++) {
    const candidate = `${local}${n ? n + 1 : ""}@${domain}.local`;
    const taken = await one("SELECT 1 FROM users WHERE society_id = $1 AND lower(email) = $2", [societyId, candidate]);
    if (!taken) return candidate;
  }
  throw conflict("Could not mint a login for that name — give them an email address");
};

/**
 * Create a guard or facility staff login.
 *
 * The password is generated here and returned exactly once. The committee reads
 * it to the person; nothing stores it in a form anyone can recover, which is
 * the point of showing it once rather than emailing it.
 */
usersRouter.post("/", validate(createStaffSchema), wrap(async (req, res) => {
  const { name, role, designation, phone, gateId, shift } = req.body;

  const society = await one("SELECT name FROM societies WHERE id = $1", [req.user.society_id]);
  const email = (req.body.email || "").trim().toLowerCase()
    || await mintEmail(name, req.user.society_id, society?.name);

  const clash = await one("SELECT 1 FROM users WHERE society_id = $1 AND lower(email) = $2",
    [req.user.society_id, email]);
  if (clash) throw conflict("Someone in this society already signs in with that address");

  if (gateId) {
    const gate = await one("SELECT 1 FROM gates WHERE id = $1 AND society_id = $2", [gateId, req.user.society_id]);
    if (!gate) throw unprocessable("That gate is not this society's");
  }

  const password = tempPassword();
  const created = await one(
    `INSERT INTO users (society_id, name, email, phone, password_hash, role, designation, gate_id, shift, status, notify)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active','{}'::jsonb) RETURNING id`,
    [req.user.society_id, name, email, phone || "", await hashPassword(password), role,
      designation || null, gateId || null, shift || null],
  );

  await audit(auditCtx(req), {
    action: "staff.create", entity: email, entityId: created.id,
    detail: [role, designation, shift].filter(Boolean).join(" · "),
  });

  req.params.id = created.id;
  res.status(201).json({
    member: member(await loadMember(req)),
    /* Returned once and never again — there is no endpoint that will tell the
       committee this password later, only one that sets a new one. */
    password,
  });
}));

/** Posting, shift, designation and contact details. Not the role — that is its own route. */
usersRouter.patch("/:id", validate(updateStaffSchema), wrap(async (req, res) => {
  const target = await loadMember(req);
  if (req.body.gateId) {
    const gate = await one("SELECT 1 FROM gates WHERE id = $1 AND society_id = $2",
      [req.body.gateId, req.user.society_id]);
    if (!gate) throw unprocessable("That gate is not this society's");
  }

  const columns = { name: "name", designation: "designation", phone: "phone", gateId: "gate_id", shift: "shift" };
  const keys = Object.keys(columns).filter((k) => req.body[k] !== undefined);
  const sets = keys.map((k, i) => `${columns[k]} = $${i + 1}`).join(", ");
  await query(
    `UPDATE users SET ${sets} WHERE id = $${keys.length + 1} AND society_id = $${keys.length + 2}`,
    [...keys.map((k) => req.body[k] || null), target.id, req.user.society_id],
  );
  await audit(auditCtx(req), { action: "staff.update", entity: target.email, entityId: target.id, detail: keys.join(", ") });
  res.json({ member: member(await loadMember(req)) });
}));

/**
 * Suspending an account, which is what "removing" a staff member means here.
 *
 * Deleting would take their tickets, their gate entries and every incident they
 * recorded with them — the history a society keeps precisely so it can answer
 * questions after somebody has left. Suspension ends their sessions instead:
 * the login is refused from the next request, not whenever their token expires.
 */
usersRouter.post("/:id/suspend", wrap(async (req, res) => {
  const target = await loadMember(req);
  if (target.id === req.user.id) throw forbidden("You cannot suspend your own account");
  if (target.status === "suspended") throw conflict("That account is already suspended");

  /* Suspending a committee member or an administrator is the same power as
     demoting one, so it takes the same capability. */
  if (PRIVILEGED_ROLES.includes(target.role) && !can(req.user.role, "settings.write")) {
    throw forbidden(ROLE_REFUSAL.needs_admin);
  }
  if (target.role === "admin") {
    const { count } = await one(
      "SELECT count(*)::int AS count FROM users WHERE society_id = $1 AND role = 'admin' AND status = 'active'",
      [req.user.society_id],
    );
    if (count <= 1) throw conflict(ROLE_REFUSAL.last_admin);
  }

  await query("UPDATE users SET status = 'suspended' WHERE id = $1 AND society_id = $2",
    [target.id, req.user.society_id]);
  await revokeAllForUser(target.id);
  await audit(auditCtx(req), { action: "staff.suspend", entity: target.email, entityId: target.id, detail: target.role });
  res.json({ member: member(await loadMember(req)) });
}));

usersRouter.post("/:id/reinstate", wrap(async (req, res) => {
  const target = await loadMember(req);
  if (target.status === "active") throw conflict("That account is already active");
  if (PRIVILEGED_ROLES.includes(target.role) && !can(req.user.role, "settings.write")) {
    throw forbidden(ROLE_REFUSAL.needs_admin);
  }
  await query("UPDATE users SET status = 'active' WHERE id = $1 AND society_id = $2",
    [target.id, req.user.society_id]);
  await audit(auditCtx(req), { action: "staff.reinstate", entity: target.email, entityId: target.id });
  res.json({ member: member(await loadMember(req)) });
}));

/**
 * A new password when the old one is lost.
 *
 * A guard who has forgotten theirs cannot be helped by an email link they have
 * no mailbox for. Same one-time showing as at creation, and it ends their
 * sessions so a device someone else is holding stops working.
 */
usersRouter.post("/:id/password", wrap(async (req, res) => {
  const target = await loadMember(req);
  if (target.id === req.user.id) throw forbidden("Change your own password from your profile");
  if (PRIVILEGED_ROLES.includes(target.role) && !can(req.user.role, "settings.write")) {
    throw forbidden(ROLE_REFUSAL.needs_admin);
  }
  const password = tempPassword();
  await query("UPDATE users SET password_hash = $1 WHERE id = $2 AND society_id = $3",
    [await hashPassword(password), target.id, req.user.society_id]);
  await revokeAllForUser(target.id);
  await audit(auditCtx(req), { action: "staff.password", entity: target.email, entityId: target.id });
  res.json({ member: member(await loadMember(req)), password });
}));
