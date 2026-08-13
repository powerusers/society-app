/**
 * The single definition of who may do what.
 *
 * The web app uses this to decide which controls to render; the API uses the
 * same table to decide which requests to accept. The client copy is only an
 * affordance — every request is re-checked server-side, because anything the
 * browser enforces can be bypassed from devtools.
 */

export const ROLES = ["admin", "committee", "staff", "guard", "resident"];

export const CAPABILITIES = [
  "notice.write", "poll.write", "community.moderate",
  "billing.make", "billing.approve",
  "accounts.view", "accounts.write",
  "helpdesk.manage",
  "resident.approve",
  "amenity.manage",
  "document.write",
  "staff.manage",
  "gate.view", "gate.operate",
  "incident.write", "patrol.write",
  "reports.view", "settings.view", "settings.write",
];

export const CAPS = {
  admin: ["*"],
  committee: [
    "notice.write", "poll.write", "community.moderate", "billing.make", "billing.approve", "helpdesk.manage",
    "resident.approve", "amenity.manage", "accounts.view", "accounts.write", "document.write",
    /* A committee member who witnesses something records it themselves rather
       than asking the guard to write it up second-hand. */
    "incident.write",
    "staff.manage", "gate.view", "reports.view", "settings.view",
  ],
  // staff prepare billing runs, so they need to see the run they prepared — but never to approve it
  staff: ["helpdesk.manage", "billing.make", "accounts.view", "gate.view", "document.write", "amenity.manage", "reports.view"],
  guard: ["gate.operate", "incident.write", "patrol.write", "gate.view"],
  resident: [],
};

export function can(role, capability) {
  if (!role) return false;
  const list = CAPS[role] || [];
  return list.includes("*") || list.includes(capability);
}

/**
 * Separation of duties on a billing run: preparing a run and approving it must
 * be two different people, however senior the second one is. Enforced in the
 * API; the web app calls the same function so the button state matches.
 */
export function canApproveRun(user, run) {
  if (!can(user.role, "billing.approve")) return { ok: false, reason: "no_approve_capability" };
  if (run.makerId && run.makerId === user.id) return { ok: false, reason: "maker_is_checker" };
  return { ok: true };
}

/** Roles that carry power over the society rather than over one flat. */
export const PRIVILEGED_ROLES = ["admin", "committee"];
const privileged = (role) => PRIVILEGED_ROLES.includes(role);

/**
 * Who may change whose role.
 *
 * Granting a role is granting every capability behind it, so this is deliberately
 * narrower than the capability that opens the screen:
 *
 *  - Nobody changes their own role. It is how an administrator locks themselves
 *    out, and how anyone with the screen open promotes themselves.
 *  - Committee can move people between resident, staff and guard — the
 *    operational roles.
 *  - Only an administrator can grant or remove committee and admin. Otherwise a
 *    committee member could appoint allies, or demote the peers who would
 *    review their billing runs, which is the separation of duties undone from
 *    the side.
 *
 * The last-administrator rule needs the whole society, so it lives in the API;
 * everything decidable from two users is decided here, once.
 */
export function canAssignRole(actor, target, nextRole) {
  if (!actor || !target) return { ok: false, reason: "unknown_user" };
  if (!ROLES.includes(nextRole)) return { ok: false, reason: "unknown_role" };
  if (actor.id === target.id) return { ok: false, reason: "self" };
  if (!can(actor.role, "staff.manage")) return { ok: false, reason: "no_capability" };
  if ((privileged(nextRole) || privileged(target.role)) && !can(actor.role, "settings.write")) {
    return { ok: false, reason: "needs_admin" };
  }
  return { ok: true };
}

/** Why a role change was refused, in words a committee member can act on. */
export const ROLE_REFUSAL = {
  self: "You cannot change your own role — ask another administrator.",
  no_capability: "Your role cannot manage members.",
  needs_admin: "Only an administrator can grant or remove committee access.",
  unknown_role: "That is not a role on this platform.",
  unknown_user: "That account is not in this society.",
  last_admin: "This is the society's only administrator — appoint another one first.",
};

/** Scope check for reading and raising: staff roles act society-wide, residents only on their own flat. */
export function canActOnFlat(user, flatCode) {
  if (can(user.role, "gate.view")) return true;
  return isFlatMember(user, flatCode);
}

/**
 * Strict membership — no capability escape hatch.
 *
 * Used for the decisions that are the household's alone, chiefly approving a
 * visitor. A guard holds `gate.view` and so passes `canActOnFlat`, but letting
 * the gate approve on the resident's behalf would defeat the entire
 * send-to-flat step.
 */
export function isFlatMember(user, flatCode) {
  return !!user.flat && !!flatCode && user.flat === flatCode;
}
