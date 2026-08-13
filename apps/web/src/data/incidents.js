import { useCallback, useMemo } from "react";
import { useApp } from "../store";
import { useActions } from "../store/actions";
import { useQuery } from "../lib/query";
import { api } from "../lib/api";

/**
 * The incident register.
 *
 * Only fetched for callers who may read it — the register names people, and a
 * resident asking for it gets a 403 rather than an empty list. Recording is
 * `incident.write`; closing is the committee's, so the screen asks separately.
 */
export function useIncidents() {
  const { live, me, db, can, say, sel } = useApp();
  const local = useActions();
  const mayRead = can("gate.view");

  const q = useQuery(
    () => api.get("/api/incidents").then((r) => r.incidents),
    { enabled: live && !!me && mayRead, deps: [me?.id], initial: [] },
  );

  const localList = useMemo(() => db.incidents.map((i) => ({
    ...i,
    byName: i.by === "system" ? "System" : sel.userName(i.by),
    gateName: sel.gate(i.gateId)?.name || null,
    closingNote: i.closingNote || "",
  })), [db.incidents, sel]);

  const incidents = live ? (q.data || []) : localList;
  const open = useMemo(() => incidents.filter((i) => i.status === "open"), [incidents]);

  const raise = useCallback(async (payload) => {
    if (!live) return { ok: true, incident: local.raiseIncident(payload) };
    try {
      const { incident } = await api.post("/api/incidents", payload);
      await q.refetch();
      say("Incident recorded — the committee can see it");
      return { ok: true, incident };
    } catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, local, q, say]);

  const close = useCallback(async (incident, note = "") => {
    if (!live) { local.closeIncident(incident.id); return { ok: true }; }
    try {
      await api.post(`/api/incidents/${incident.id}/close`, { note });
      await q.refetch();
      say("Incident closed");
      return { ok: true };
    } catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, local, q, say]);

  const reopen = useCallback(async (incident) => {
    if (!live) { local.reopenIncident(incident.id); return { ok: true }; }
    try { await api.post(`/api/incidents/${incident.id}/reopen`, {}); await q.refetch(); say("Incident reopened"); return { ok: true }; }
    catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, local, q, say]);

  return {
    incidents, open, mayRead,
    loading: live && mayRead ? q.loading : false,
    error: live && mayRead ? q.error : null,
    refetch: q.refetch,
    raise, close, reopen,
  };
}
