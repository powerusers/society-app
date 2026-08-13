import { useCallback, useMemo } from "react";
import { useApp } from "../store";
import { useActions } from "../store/actions";
import { useQuery } from "../lib/query";
import { api } from "../lib/api";

/**
 * Daily help and the attendance the gate records for them.
 *
 * The household's "did she come today?" and the desk's "who is inside?" are the
 * same rows asked from two sides, so both come from here. `scope` says which
 * the server returned — a flat's staff, or the society's.
 */
export function useHelp() {
  const { live, me, db, say, sel } = useApp();
  const local = useActions();

  const q = useQuery(
    () => api.get("/api/help"),
    { enabled: live && !!me, deps: [me?.id], initial: { help: [], scope: "flat" } },
  );
  const attQ = useQuery(
    () => api.get("/api/help/attendance/recent").then((r) => r.attendance),
    { enabled: live && !!me, deps: [me?.id], initial: [] },
  );

  /* The seed keeps a flat-code array and one rating number; the API sends the
     same flats plus an average and this household's own star. Normalising here
     lets the screens read one shape. */
  const localList = useMemo(() => db.dailyHelp.map((h) => ({
    ...h,
    mine: (h.flats || []).includes(me?.flat),
    raters: 1,
    myRating: h.rating,
  })), [db.dailyHelp, me?.flat]);

  const localAttendance = useMemo(() => db.attendance.map((a) => {
    const h = db.dailyHelp.find((x) => x.id === a.helpId);
    return { ...a, helpName: h?.name || "", helpRole: h?.role || "", gateName: sel.gate(a.gateId)?.name || null };
  }), [db.attendance, db.dailyHelp, sel]);

  const help = live ? (q.data?.help || []) : localList;
  const scope = live ? (q.data?.scope || "flat") : "flat";
  const attendance = live ? (attQ.data || []) : localAttendance;

  const mine = useMemo(
    () => (scope === "society" ? help.filter((h) => h.mine) : help),
    [help, scope],
  );

  const refetch = useCallback(() => { q.refetch(); attQ.refetch(); }, [q, attQ]);

  const add = useCallback(async (payload) => {
    if (!live) return { ok: true, help: local.addHelp(payload) };
    try {
      const { help: created } = await api.post("/api/help", payload);
      await q.refetch();
      say("Staff card issued ✓");
      return { ok: true, help: created };
    } catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, local, q, say]);

  const update = useCallback(async (h, body) => {
    if (!live) { local.updateHelp(h.id, body); return { ok: true }; }
    try { await api.patch(`/api/help/${h.id}`, body); await q.refetch(); return { ok: true }; }
    catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, local, q, say]);

  /** Take on someone who already works elsewhere in the society. */
  const attach = useCallback(async (h) => {
    if (!live) return { ok: true };
    try { await api.post(`/api/help/${h.id}/flats`, {}); await q.refetch(); say(`${h.name} added to your flat`); return { ok: true }; }
    catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, q, say]);

  const detach = useCallback(async (h) => {
    if (!live) { local.removeHelp(h.id); return { ok: true }; }
    try { await api.del(`/api/help/${h.id}/flats`); await q.refetch(); say(`${h.name} removed from your flat`); return { ok: true }; }
    catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, local, q, say]);

  const rate = useCallback(async (h, stars) => {
    if (!live) { local.rateHelp(h.id, stars); return { ok: true }; }
    try {
      await api.post(`/api/help/${h.id}/rating`, { stars });
      await q.refetch();
      say("Rating saved — it counts towards the average other flats see");
      return { ok: true };
    } catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, local, q, say]);

  /** The gate's check-in. Whether they are inside is the open visit, not a flag. */
  const check = useCallback(async (h, direction, mode = "manual") => {
    if (!live) { local.markHelp(h, direction); return { ok: true }; }
    try {
      await api.post(`/api/help/${h.id}/attendance`, { direction, mode });
      await Promise.all([q.refetch(), attQ.refetch()]);
      say(direction === "in" ? `${h.name} checked in` : `${h.name} checked out`);
      return { ok: true };
    } catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, local, q, attQ, say]);

  const byCard = useCallback(async (code) => {
    if (!live) {
      const hit = db.dailyHelp.find((h) => h.cardCode?.toUpperCase() === String(code).trim().toUpperCase());
      return hit ? { ok: true, help: hit } : { ok: false, error: new Error("No staff card matches that code") };
    }
    try {
      const { help: found } = await api.get(`/api/help/card/${encodeURIComponent(String(code).trim())}`);
      return { ok: true, help: found };
    } catch (err) { return { ok: false, error: err }; }
  }, [live, db.dailyHelp]);

  return {
    help, mine, scope, attendance,
    loading: live ? q.loading : false,
    error: live ? (q.error || attQ.error) : null,
    refetch,
    add, update, attach, detach, rate, check, byCard,
  };
}
