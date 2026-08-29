/**
 * Bills and the billing run.
 *
 * Recording a receipt against a bill works; an online payment gateway is
 * deliberately out of scope for this phase, exactly as on the web.
 */
import { useCallback } from 'react';
import { useApp } from '../store';
import { useCollection, useWriter } from './base';
import { api } from '../lib/api';
import { useQuery } from '../lib/query';

export function useBills({ cycle, flatCode, status } = {}) {
  const { authed } = useApp();
  const qs = new URLSearchParams();
  if (cycle) qs.set('cycle', cycle);
  if (flatCode) qs.set('flatCode', flatCode);
  if (status) qs.set('status', status);
  const suffix = qs.toString() ? `?${qs}` : '';

  const { items, loading, error, refetch } = useCollection(`/api/bills${suffix}`, 'bills', {
    enabled: authed,
    deps: [cycle, flatCode, status],
  });
  const write = useWriter(refetch);

  const pay = useCallback((bill, payload) => write(
    () => api.post(`/api/bills/${bill.id}/pay`, payload),
    'Receipt recorded.',
  ), [write]);

  return { bills: items, loading, error, refetch, pay };
}

/**
 * The billing run, with its maker-checker gate. `canApprove` and
 * `approvalBlockedBy` come from the server — the officer who drafted a run may
 * not approve it, and the API is what enforces that.
 */
export function useBillingRun(cycle) {
  const { authed, can, say } = useApp();
  const enabled = authed && can('billing.make') && !!cycle;

  const q = useQuery(() => api.get(`/api/bills/runs/${cycle}`), { enabled, deps: [cycle] });
  const write = useWriter(q.refetch);

  const draft = useCallback((payload) => write(
    () => api.post('/api/bills/runs', { cycle, ...payload }),
    'Draft billing run created.',
  ), [write, cycle]);

  const approve = useCallback(() => write(
    () => api.post(`/api/bills/runs/${cycle}/approve`),
    'Billing run approved and issued.',
  ), [write, cycle]);

  const discard = useCallback(() => write(
    () => api.del(`/api/bills/runs/${cycle}`),
    'Draft discarded.',
  ), [write]);

  return { run: q.data, loading: q.loading, error: q.error, refetch: q.refetch, draft, approve, discard, say };
}
