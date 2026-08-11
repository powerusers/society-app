import { useCallback, useMemo } from "react";
import { useApp } from "../store";
import { useActions } from "../store/actions";
import { useQuery } from "../lib/query";
import { api } from "../lib/api";

/**
 * Gate traffic, from the API when one is configured and from the seeded store
 * otherwise. Both paths return the same shape, so screens never branch.
 */
export function useVisitors() {
  const { live, me, can, say, db } = useApp();
  const local = useActions();

  const scope = can("gate.view") ? "" : `&flatCode=${me?.flat || ""}`;

  const q = useQuery(
    () => api.get(`/api/visitors?limit=120${scope}`).then((r) => r.visitors),
    { enabled: live && !!me, deps: [me?.id, scope], initial: [] },
  );

  const localList = useMemo(
    () => (can("gate.view") ? db.visitors : db.visitors.filter((v) => v.flatCode === me?.flat)),
    [db.visitors, can, me],
  );

  const visitors = live ? (q.data || []) : localList;

  /* Every write goes through the server first and only then refetches, so the
     screen can never show a state the API would have rejected. */
  const transition = useCallback(async (v, status, extra = {}) => {
    if (!live) {
      if (status === "pending") local.sendToFlat(v);
      else if (status === "approved") local.approveVisitor(v, extra);
      else if (status === "denied") local.denyVisitor(v, extra.reason);
      else if (status === "inside") local.admitVisitor(v);
      else if (status === "exited") local.exitVisitor(v);
      return { ok: true };
    }
    try {
      await api.patch(`/api/visitors/${v.id}/status`, { status, ...extra });
      await q.refetch();
      say({
        pending: `Sent to ${v.flatCode}`,
        approved: "Approved — the guard has been notified.",
        denied: "Entry denied.",
        inside: `${v.name} let in — timer started.`,
        exited: `${v.name} marked out.`,
      }[status] || "Updated", status === "denied" ? "bad" : "ok");
      return { ok: true };
    } catch (err) {
      say(err.message, "bad");
      return { ok: false, error: err };
    }
  }, [live, local, q, say]);

  const create = useCallback(async (payload) => {
    if (!live) {
      const v = payload.status === "pre-approved"
        ? local.preApprove(payload)
        : local.selfCheckin(payload);
      return { ok: true, visitor: v };
    }
    try {
      const { visitor } = await api.post("/api/visitors", payload);
      await q.refetch();
      say(payload.status === "pre-approved" ? "Pre-approved — share the gate pass." : "Entry recorded.");
      return { ok: true, visitor };
    } catch (err) {
      say(err.message, "bad");
      return { ok: false, error: err };
    }
  }, [live, local, q, say]);

  const verifyPass = useCallback(async (passCode) => {
    if (!live) {
      const v = db.visitors.find((x) => x.passCode?.toUpperCase() === passCode.trim().toUpperCase());
      if (!v) return { ok: false, error: new Error("No matching gate pass. Ask the visitor to re-share it.") };
      if (v.status === "exited" || v.status === "denied") {
        return { ok: false, error: new Error("This pass has already been used or cancelled.") };
      }
      return { ok: true, visitor: v };
    }
    try {
      const { visitor } = await api.post("/api/visitors/verify-pass", { passCode: passCode.trim() });
      return { ok: true, visitor };
    } catch (err) {
      return { ok: false, error: err };
    }
  }, [live, db.visitors]);

  return {
    visitors,
    loading: live ? q.loading && !q.data?.length : false,
    error: live ? q.error : null,
    refetch: q.refetch,
    transition,
    create,
    verifyPass,
  };
}
