/** Vehicles and parking. Residents see their flat's; the gate sees the society's. */
import { useCallback } from 'react';
import { useCollection, useWriter } from './base';
import { api } from '../lib/api';

export function useVehicles({ all = false } = {}) {
  const { items, loading, error, refetch } = useCollection(
    `/api/vehicles${all ? '?scope=society' : ''}`,
    'vehicles',
    { deps: [all] },
  );
  const write = useWriter(refetch);

  const add = useCallback((payload) => write(() => api.post('/api/vehicles', payload), 'Vehicle registered.'), [write]);
  const update = useCallback((id, changes) => write(() => api.patch(`/api/vehicles/${id}`, changes), 'Vehicle updated.'), [write]);
  const remove = useCallback((id) => write(() => api.del(`/api/vehicles/${id}`), 'Vehicle removed.'), [write]);

  /* Plate lookup is the guard's, and like pass verification it reports inline
     rather than as a toast — "no match" is an answer, not a failure. */
  const lookup = useCallback(async (number) => {
    try {
      const { vehicle } = await api.get(`/api/vehicles/plate/${encodeURIComponent(String(number).trim())}`);
      return { ok: true, vehicle };
    } catch (error) {
      return { ok: false, error };
    }
  }, []);

  return { vehicles: items, loading, error, refetch, add, update, remove, lookup };
}
