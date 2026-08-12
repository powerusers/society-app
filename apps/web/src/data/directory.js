import { useMemo } from "react";
import { useApp } from "../store";
import { useQuery } from "../lib/query";
import { api } from "../lib/api";

/**
 * The resident directory.
 *
 * Contact details are decided server-side: a number is revealed to the
 * committee, to the resident themselves, or when that resident has opted in via
 * `shareContact`. The API sends `contactHidden` so the screen can render the
 * difference instead of guessing from the mask characters.
 *
 * Demo mode applies the same rule locally, so the two modes cannot disagree
 * about who may see a phone number.
 */
export function useDirectory() {
  const { live, me, can, db } = useApp();

  const q = useQuery(
    () => api.get("/api/me/directory").then((r) => r.residents),
    { enabled: live && !!me, deps: [me?.id], initial: [] },
  );

  const localList = useMemo(() => {
    const reveal = can("resident.approve");
    return db.users
      .filter((u) => u.status !== "suspended" && u.role !== "guard")
      .map((u) => {
        const shared = reveal || u.id === me?.id || !!u.notify?.shareContact;
        return { ...u, contactHidden: !shared, email: shared ? u.email : null };
      });
  }, [db.users, can, me?.id]);

  const people = live ? (q.data || []) : localList;

  /* The API returns a flat code, not a block, so the filter derives one — and
     the same derivation covers demo rows whose block was set separately. */
  const withBlock = useMemo(
    () => people.map((u) => ({ ...u, block: u.block || (u.flat ? String(u.flat).split("-")[0] : null) })),
    [people],
  );

  const blocks = useMemo(
    () => [...new Set(withBlock.map((u) => u.block).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [withBlock],
  );

  return {
    people: withBlock,
    blocks,
    loading: live ? q.loading : false,
    error: live ? q.error : null,
    refetch: q.refetch,
  };
}
