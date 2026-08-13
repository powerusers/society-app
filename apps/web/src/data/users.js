import { useCallback, useMemo } from "react";
import { canAssignRole, ROLE_REFUSAL } from "@gvs/shared";
import { useApp } from "../store";
import { useQuery } from "../lib/query";
import { api } from "../lib/api";
import { iso, uid } from "../lib/format";

/**
 * Everyone with an account in the society, for managing what they may do.
 *
 * Separate from the resident directory: this needs guards too, and real contact
 * details rather than the masked ones a neighbour sees, so it sits behind
 * `staff.manage` instead of being readable by the building.
 */
export function useMembers() {
  const { live, me, db, add: addLocal, patch: patchLocal, say, logAudit } = useApp();

  const q = useQuery(
    () => api.get("/api/users").then((r) => r.members),
    { enabled: live && !!me, deps: [me?.id], initial: [] },
  );

  const members = live
    ? (q.data || [])
    /* The seed keeps the gate as an id on the user and calls the field `gate`;
       the API sends `gateId` and the gate's name. Normalising here means the
       screens read one shape. */
    : db.users.map((u) => ({
      ...u, flat: u.flat ?? null, joined: u.joined,
      gateId: u.gate ?? null, gateName: db.gates.find((g) => g.id === u.gate)?.name || null,
      status: u.status || "active",
    }));

  /** The people the society employs, as opposed to the people who live here. */
  const staff = useMemo(() => members.filter((m) => m.role === "guard" || m.role === "staff"), [members]);

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

  /**
   * Create a staff or guard login.
   *
   * The password comes back once and is handed to the caller to show. There is
   * no endpoint that will repeat it, which is the point — losing it means
   * issuing a new one, not recovering the old.
   */
  const createStaff = useCallback(async (payload) => {
    if (!live) {
      const domain = String(db.settings.societyName || "society")
        .toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "society";
      const created = addLocal("users", {
        id: uid("u"), ...payload, status: "active", joined: iso(), notify: {},
        gate: payload.gateId || null,
        email: payload.email || `${payload.name.toLowerCase().replace(/\s+/g, ".")}@${domain}.local`,
      });
      logAudit("staff.create", created.email, payload.designation || payload.role);
      say(`${created.name} added with a ${payload.role} login.`);
      /* The demo has no password to give, and pretending otherwise would teach
         the wrong thing about what this screen does. */
      return { ok: true, member: created, password: null };
    }
    try {
      const { member, password } = await api.post("/api/users", payload);
      await q.refetch();
      say(`${member.name} can now sign in`);
      return { ok: true, member, password };
    } catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, addLocal, logAudit, say, q, db.settings.societyName]);

  const updateStaff = useCallback(async (target, body) => {
    if (!live) { patchLocal("users", target.id, body); return { ok: true }; }
    try { await api.patch(`/api/users/${target.id}`, body); await q.refetch(); say("Saved"); return { ok: true }; }
    catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, patchLocal, q, say]);

  /** Suspending, not deleting — their tickets, entries and incidents stay. */
  const setSuspended = useCallback(async (target, suspended) => {
    if (!live) { patchLocal("users", target.id, { status: suspended ? "suspended" : "active" }); return { ok: true }; }
    try {
      await api.post(`/api/users/${target.id}/${suspended ? "suspend" : "reinstate"}`, {});
      await q.refetch();
      say(suspended ? `${target.name} can no longer sign in` : `${target.name} is active again`);
      return { ok: true };
    } catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, patchLocal, q, say]);

  const resetPassword = useCallback(async (target) => {
    if (!live) return { ok: true, password: null };
    try {
      const { password } = await api.post(`/api/users/${target.id}/password`, {});
      await q.refetch();
      return { ok: true, password };
    } catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, q, say]);

  return {
    members, staff,
    loading: live ? q.loading : false,
    error: live ? q.error : null,
    refetch: q.refetch,
    refusalFor,
    setRole, createStaff, updateStaff, setSuspended, resetPassword,
  };
}
