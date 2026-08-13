import { useCallback, useMemo } from "react";
import { useApp } from "../store";
import { useActions } from "../store/actions";
import { useQuery } from "../lib/query";
import { api } from "../lib/api";

/**
 * The vehicle register.
 *
 * A resident gets their own flat's vehicles; anyone who works the gate gets the
 * society's, because recognising a car at the barrier is what the register is
 * for. `scope` says which came back, so the screen can title the list honestly
 * rather than calling a guard's view "your vehicles".
 */
export function useVehicles() {
  const { live, me, db, say, sel } = useApp();
  const local = useActions();

  const q = useQuery(
    () => api.get("/api/vehicles"),
    { enabled: live && !!me, deps: [me?.id], initial: { vehicles: [], scope: "flat" } },
  );

  const localList = useMemo(() => {
    const rows = sel.vehiclesOf(me?.flat || "");
    return rows.map((v) => ({ ...v, ownerName: sel.userName(v.ownerId) }));
  }, [me?.flat, sel]);

  const vehicles = live ? (q.data?.vehicles || []) : localList;
  const scope = live ? (q.data?.scope || "flat") : "flat";

  const add = useCallback(async (payload) => {
    if (!live) return { ok: true, vehicle: local.addVehicle(payload) };
    try {
      const { vehicle } = await api.post("/api/vehicles", payload);
      await q.refetch();
      say("Vehicle registered ✓");
      return { ok: true, vehicle };
    } catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, local, q, say]);

  const update = useCallback(async (vehicle, patch) => {
    if (!live) return { ok: true };
    try { await api.patch(`/api/vehicles/${vehicle.id}`, patch); await q.refetch(); return { ok: true }; }
    catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, q, say]);

  const remove = useCallback(async (vehicle) => {
    if (!live) { local.removeVehicle(vehicle.id); return { ok: true }; }
    try { await api.del(`/api/vehicles/${vehicle.id}`); await q.refetch(); say("Vehicle removed"); return { ok: true }; }
    catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, local, q, say]);

  /** Gate lookup: whose car is this? Only callers with `gate.view` get an answer. */
  const byPlate = useCallback(async (number) => {
    if (!live) {
      const hit = db.vehicles.find((v) => v.number.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
        === String(number).replace(/[^A-Za-z0-9]/g, "").toUpperCase());
      return hit ? { ok: true, vehicle: hit } : { ok: false, error: new Error("No vehicle on the register with that number") };
    }
    try {
      const { vehicle } = await api.get(`/api/vehicles/plate/${encodeURIComponent(number)}`);
      return { ok: true, vehicle };
    } catch (err) { return { ok: false, error: err }; }
  }, [live, db.vehicles]);

  return {
    vehicles, scope,
    loading: live ? q.loading : false,
    error: live ? q.error : null,
    refetch: q.refetch,
    add, update, remove, byPlate,
  };
}
