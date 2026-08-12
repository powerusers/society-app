import { useCallback } from "react";
import { canAssignRole, ROLE_REFUSAL } from "@gvs/shared";
import { useApp } from "../store";
import { useQuery } from "../lib/query";
import { api } from "../lib/api";

/**
 * Everyone with an account in the society, for managing what they may do.
 *
 * Separate from the resident directory: this needs guards too, and real contact
 * details rather than the masked ones a neighbour sees, so it sits behind
 * `staff.manage` instead of being readable by the building.
 */
export function useMembers() {
  const { live, me, db, patch: patchLocal, say, logAudit } = useApp();

  const q = useQuery(
    () => api.get("/api/users").then((r) => r.members),
    { enabled: live && !!me, deps: [me?.id], initial: [] },
  );

  const members = live
    ? (q.data || [])
    : db.users.map((u) => ({ ...u, flat: u.flat ?? null, joined: u.joined }));

  /**
   * The same refusal the API would give, decided before asking, so the screen
   * can explain rather than surface a 403. The server re-checks regardless —
   * this is an affordance, not the control.
   */
  const refusalFor = useCallback((target, nextRole) => {
    if (!me) return ROLE_REFUSAL.unknown_user;
    const verdict = canAssignRole(me, target, nextRole);
    return verdict.ok ? null : (ROLE_REFUSAL[verdict.reason] || "That role change is not allowed");
  }, [me]);

  const setRole = useCallback(async (target, role, designation) => {
    if (!live) {
      patchLocal("users", target.id, { role, designation: role === "resident" ? null : designation });
      logAudit("user.role", target.email || target.name, `${target.role} -> ${role}`);
      say(`${target.name} is now ${role}`);
      return { ok: true };
    }
    try {
      const { member } = await api.patch(`/api/users/${target.id}/role`, { role, designation: designation ?? null });
      await q.refetch();
      say(`${member.name} is now ${member.role}`);
      return { ok: true, member };
    } catch (err) {
      say(err.message, "bad");
      return { ok: false, error: err };
    }
  }, [live, patchLocal, logAudit, say, q]);

  return {
    members,
    loading: live ? q.loading : false,
    error: live ? q.error : null,
    refetch: q.refetch,
    refusalFor,
    setRole,
  };
}
