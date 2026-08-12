import { useCallback } from "react";
import { useApp } from "../store";
import { useQuery } from "../lib/query";
import { api } from "../lib/api";

/**
 * The committee's approval queue.
 *
 * A resident registering against a flat creates a pending row server-side, but
 * the screen that reviews them read the local store — so applications arrived
 * in the database and were never seen by anybody. Approving turns the pending
 * application into a live account with the password it was submitted with.
 */
export function useRegistrations(status = "pending") {
  const { live, me, db, setColl, say, logAudit } = useApp();

  const q = useQuery(
    () => api.get(`/api/registrations?status=${encodeURIComponent(status)}`).then((r) => r.registrations),
    { enabled: live && !!me, deps: [status, me?.id], initial: [] },
  );

  const registrations = live
    ? (q.data || [])
    : db.registrations.filter((r) => r.status === status);

  const decide = useCallback(async (reg, decision, reason) => {
    if (!live) {
      setColl("registrations", (list) =>
        list.map((r) => (r.id === reg.id ? { ...r, status: decision, reason } : r)));
      logAudit(`registration.${decision}`, reg.name, reg.flatCode);
      say(decision === "approved" ? `${reg.name} approved` : `${reg.name} rejected`);
      return { ok: true };
    }
    try {
      const path = `/api/registrations/${reg.id}/${decision === "approved" ? "approve" : "reject"}`;
      const res = await api.post(path, reason ? { reason } : {});
      await q.refetch();
      say(decision === "approved"
        ? `${reg.name} approved — they can sign in now`
        : `${reg.name}'s application was rejected`);
      return { ok: true, res };
    } catch (err) {
      say(err.message, "bad");
      return { ok: false, error: err };
    }
  }, [live, setColl, logAudit, say, q]);

  return {
    registrations,
    loading: live ? q.loading : false,
    error: live ? q.error : null,
    refetch: q.refetch,
    approve: (reg) => decide(reg, "approved"),
    reject: (reg, reason) => decide(reg, "rejected", reason),
  };
}
