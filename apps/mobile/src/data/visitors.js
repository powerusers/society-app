/**
 * Gate traffic. Mirrors apps/web/src/data/visitors.js minus the demo branch.
 *
 * A resident sees only their own flat's visitors; anyone with gate.view sees the
 * whole gate. The scope is applied here rather than in a screen so the guard
 * console and the resident's gate tab can share every component below them.
 */
import { useCallback } from 'react';
import { useApp } from '../store';
import { useApprovals } from './approvals';
import { useCollection, useWriter } from './base';
import { api } from '../lib/api';

export function useVisitors() {
  const { me, can } = useApp();
  const scope = can('gate.view') ? '' : `&flatCode=${me?.flat || ''}`;

  /* A decision taken in the approval prompt happened outside this hook, so the
     list would otherwise keep showing "pending" until the resident pulled to
     refresh. The provider bumps a revision after every decision; carrying it in
     the deps is what re-reads the server. Optional-chained because the gate
     console is also rendered in contexts without the provider. */
  const revision = useApprovals()?.revision ?? 0;

  const { items, loading, error, refetch } = useCollection(
    () => `/api/visitors?limit=120${scope}`,
    'visitors',
    { deps: [me?.id, scope, revision] },
  );
  const write = useWriter(refetch);

  const transition = useCallback((v, status, extra = {}) => write(
    () => api.patch(`/api/visitors/${v.id}/status`, { status, ...extra }),
    {
      pending: `Sent to ${v.flatCode}`,
      approved: 'Approved — the guard has been notified.',
      denied: 'Entry denied.',
      inside: `${v.name} let in — timer started.`,
      exited: `${v.name} marked out.`,
    }[status] || 'Updated',
    { kind: status === 'denied' ? 'bad' : 'ok' },
  ), [write]);

  const create = useCallback(async (payload) => {
    const r = await write(
      () => api.post('/api/visitors', payload),
      payload.status === 'pre-approved' ? 'Pre-approved — share the gate pass.' : 'Entry recorded.',
    );
    return r.ok ? { ok: true, visitor: r.result.visitor } : r;
  }, [write]);

  /* Verification deliberately does not go through the writer: a pass that fails
     to verify is a normal outcome the scanner shows inline, not a toast. */
  const verifyPass = useCallback(async (passCode) => {
    try {
      const { visitor } = await api.post('/api/visitors/verify-pass', { passCode: String(passCode).trim() });
      return { ok: true, visitor };
    } catch (error) {
      return { ok: false, error };
    }
  }, []);

  return { visitors: items, loading, error, refetch, transition, create, verifyPass };
}

export function useGates() {
  const { items, loading, refetch } = useCollection('/api/visitors/gates', 'gates');
  return { gates: items, loading, refetch };
}

export function useOverstays() {
  const { can } = useApp();
  const { items, loading, refetch } = useCollection('/api/visitors/overstays', 'visitors', {
    enabled: can('gate.view'),
  });
  return { overstays: items, loading, refetch };
}
