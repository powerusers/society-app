import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Minimal data fetching. Deliberately not React Query — the app needs loading,
 * error, refetch and nothing else, and that is about sixty lines.
 */
export function useQuery(fetcher, { enabled = true, deps = [], initial = null } = {}) {
  const [state, setState] = useState({ data: initial, error: null, loading: enabled });
  const seq = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async () => {
    const mine = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetcherRef.current();
      // A slower earlier request must not overwrite a newer result.
      if (mine === seq.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (mine === seq.current) setState((s) => ({ data: s.data, error, loading: false }));
    }
  }, []);

  useEffect(() => {
    if (!enabled) { setState((s) => ({ ...s, loading: false })); return; }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, run, ...deps]);

  return { ...state, refetch: run, setData: (d) => setState((s) => ({ ...s, data: d })) };
}

/**
 * Wraps a write so screens get `busy` and a captured error without each one
 * hand-rolling try/catch/setState.
 */
export function useMutation(fn, { onSuccess, onError } = {}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(async (...args) => {
    setBusy(true);
    setError(null);
    try {
      const result = await fn(...args);
      onSuccess?.(result);
      return { ok: true, result };
    } catch (err) {
      setError(err);
      onError?.(err);
      return { ok: false, error: err };
    } finally {
      setBusy(false);
    }
  }, [fn, onSuccess, onError]);

  return { run, busy, error, reset: () => setError(null) };
}
