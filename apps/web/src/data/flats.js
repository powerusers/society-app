import { useMemo } from "react";
import { useApp } from "../store";
import { useQuery } from "../lib/query";
import { api } from "../lib/api";

/**
 * The society's flat register.
 *
 * Live mode reads it from the API, which is where the CSV import writes. Before
 * this existed the Residents screen read the local seeded store, so an imported
 * register was invisible in the very screen meant to show it.
 *
 * `dues` is only present for callers the server lets see money — it omits the
 * column rather than sending zeros, so absent means "not permitted", not "paid".
 */
export function useFlats() {
  const { live, me, db } = useApp();

  const q = useQuery(
    () => api.get("/api/flats").then((r) => r.flats),
    { enabled: live && !!me, deps: [me?.id], initial: [] },
  );

  const flats = live ? (q.data || []) : db.flats;

  /* Blocks come from the register itself. In live mode the society's settings
     carry them too, but deriving keeps the filter honest the moment an import
     adds a wing that the stored setting has not caught up with. */
  const blocks = useMemo(
    () => [...new Set(flats.map((f) => f.block).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [flats],
  );

  return {
    flats,
    blocks,
    loading: live ? q.loading : false,
    error: live ? q.error : null,
    refetch: q.refetch,
  };
}

/** One flat and the people on it — the server decides whether contacts are revealed. */
export function useFlat(code) {
  const { live, me, db, sel } = useApp();

  const q = useQuery(
    () => api.get(`/api/flats/${encodeURIComponent(code)}`),
    { enabled: live && !!me && !!code, deps: [code, me?.id], initial: null },
  );

  if (!live) {
    const flat = db.flats.find((f) => f.code === code) || null;
    return { flat, occupants: flat ? sel.residentsOf(code) : [], loading: false, error: null };
  }
  return {
    flat: q.data?.flat || null,
    occupants: q.data?.occupants || [],
    loading: q.loading,
    error: q.error,
    refetch: q.refetch,
  };
}
