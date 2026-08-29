/** Helpdesk tickets. */
import { useCallback } from 'react';
import { useCollection, useWriter } from './base';
import { api } from '../lib/api';

export function useTickets({ status } = {}) {
  const { items, loading, error, refetch } = useCollection(
    `/api/tickets${status ? `?status=${status}` : ''}`,
    'tickets',
    { deps: [status] },
  );
  const write = useWriter(refetch);

  const raise = useCallback((payload) => write(
    () => api.post('/api/tickets', payload),
    'Ticket raised — the office has been notified.',
  ), [write]);

  const update = useCallback((id, changes) => write(
    () => api.patch(`/api/tickets/${id}`, changes),
    'Ticket updated.',
  ), [write]);

  const comment = useCallback((id, body) => write(
    () => api.post(`/api/tickets/${id}/comments`, { body }),
    'Comment added.',
  ), [write]);

  const rate = useCallback((id, rating) => write(
    () => api.post(`/api/tickets/${id}/rating`, { rating }),
    'Thanks for the feedback.',
  ), [write]);

  return { tickets: items, loading, error, refetch, raise, update, comment, rate };
}
