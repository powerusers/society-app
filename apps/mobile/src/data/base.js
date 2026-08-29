/**
 * Repository helpers.
 *
 * The web app's src/data hooks exist to hide one thing from screens: whether the
 * data came from the API or the seeded local store. This app is live-only, so
 * they hide something smaller but still worth hiding — the request envelope, the
 * refetch-after-write rule, and toast-on-failure.
 *
 * The rule the web app states and this keeps: every write goes to the server
 * first and only then refetches, so a screen can never show a state the API
 * would have rejected.
 */
import { useCallback } from 'react';
import { useApp } from '../store';
import { useQuery } from '../lib/query';
import { api } from '../lib/api';

/**
 * Reads a collection. `key` is the property the API wraps the array in —
 * { notices: [...] } — which every list endpoint in this API does.
 */
export function useCollection(path, key, { enabled = true, deps = [] } = {}) {
  const { authed } = useApp();
  const q = useQuery(
    () => api.get(typeof path === 'function' ? path() : path).then((r) => r?.[key] ?? []),
    { enabled: enabled && authed, deps, initial: [] },
  );
  return {
    items: q.data || [],
    loading: q.loading && !q.data?.length,
    error: q.error,
    refetch: q.refetch,
    setData: q.setData,
  };
}

/**
 * Wraps a write: call the server, refetch, announce. Returns { ok } rather than
 * throwing so screens can branch without a try/catch each time — the same
 * contract the web hooks use.
 */
export function useWriter(refetch) {
  const { say } = useApp();
  return useCallback(async (fn, successMessage, { kind = 'ok', refresh = true } = {}) => {
    try {
      const result = await fn();
      if (refresh) await refetch();
      if (successMessage) say(successMessage, kind);
      return { ok: true, result };
    } catch (error) {
      say(error.message, 'bad');
      return { ok: false, error };
    }
  }, [refetch, say]);
}
