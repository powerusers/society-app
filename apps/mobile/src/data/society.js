/** Flats, residents and pending registrations — the committee's records. */
import { useCallback } from 'react';
import { useApp } from '../store';
import { useCollection, useWriter } from './base';
import { api } from '../lib/api';

export function useFlats() {
  const { items, loading, error, refetch } = useCollection('/api/flats', 'flats');
  return { flats: items, loading, error, refetch };
}

export function useUsers() {
  const { can } = useApp();
  const { items, loading, error, refetch } = useCollection('/api/users', 'users', {
    enabled: can('resident.approve') || can('resident.approve'),
  });
  const write = useWriter(refetch);

  const create = useCallback((payload) => write(() => api.post('/api/users', payload), 'Member added.'), [write]);
  const update = useCallback((id, changes) => write(() => api.patch(`/api/users/${id}`, changes), 'Member updated.'), [write]);
  const setRole = useCallback((id, role) => write(() => api.patch(`/api/users/${id}/role`, { role }), 'Role changed.'), [write]);
  const suspend = useCallback((id, reason) => write(() => api.post(`/api/users/${id}/suspend`, { reason }), 'Member suspended.', { kind: 'bad' }), [write]);
  const reinstate = useCallback((id) => write(() => api.post(`/api/users/${id}/reinstate`), 'Member reinstated.'), [write]);

  return { users: items, loading, error, refetch, create, update, setRole, suspend, reinstate };
}

export function useRegistrations() {
  const { can } = useApp();
  const { items, loading, error, refetch } = useCollection('/api/registrations', 'registrations', {
    enabled: can('resident.approve'),
  });
  const write = useWriter(refetch);

  const approve = useCallback((id, payload) => write(() => api.post(`/api/registrations/${id}/approve`, payload), 'Resident approved.'), [write]);
  const reject = useCallback((id, reason) => write(() => api.post(`/api/registrations/${id}/reject`, { reason }), 'Registration rejected.', { kind: 'bad' }), [write]);

  return { registrations: items, loading, error, refetch, approve, reject };
}
