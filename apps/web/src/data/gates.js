import { useApp } from "../store";
import { useQuery } from "../lib/query";
import { api } from "../lib/api";

/**
 * The society's gate devices.
 *
 * Live ids are UUIDs the database knows; the seeded store uses string keys.
 * Screens must take ids from here rather than from the local seed, or they end
 * up posting a demo id into a real column.
 */
export function useGates() {
  const { live, me, db } = useApp();

  const q = useQuery(
    () => api.get("/api/visitors/gates").then((r) => r.gates),
    { enabled: live && !!me, deps: [me?.id], initial: [] },
  );

  const gates = live ? (q.data || []) : db.gates;

  return {
    gates,
    loading: live ? q.loading && !q.data?.length : false,
    /** The gate this user is posted at, falling back to the first one. */
    defaultGateId: (live ? me?.gateId : me?.gate) || gates[0]?.id || null,
  };
}
