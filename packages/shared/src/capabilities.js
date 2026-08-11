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
  "notice.write", "poll.write",
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
    "notice.write", "poll.write", "billing.make", "billing.approve", "helpdesk.manage",
    "resident.approve", "amenity.manage", "accounts.view", "accounts.write", "document.write",
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
