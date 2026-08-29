/** Security incidents raised at the gate. */
import { useCallback } from 'react';
import { useCollection, useWriter } from './base';
import { api } from '../lib/api';

export function useIncidents() {
  const { items, loading, error, refetch } = useCollection('/api/incidents', 'incidents');
  const write = useWriter(refetch);

  const raise = useCallback((payload) => write(() => api.post('/api/incidents', payload), 'Incident logged.', { kind: 'bad' }), [write]);
  const close = useCallback((id, resolution) => write(() => api.post(`/api/incidents/${id}/close`, { resolution }), 'Incident closed.'), [write]);
  const reopen = useCallback((id) => write(() => api.post(`/api/incidents/${id}/reopen`), 'Incident reopened.'), [write]);

  return { incidents: items, loading, error, refetch, raise, close, reopen };
}
