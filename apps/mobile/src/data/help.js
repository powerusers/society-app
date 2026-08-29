/** Daily help and society staff — maids, drivers, cooks, and their attendance. */
import { useCallback } from 'react';
import { useCollection, useWriter } from './base';
import { api } from '../lib/api';

export function useHelp({ all = false } = {}) {
  const { items, loading, error, refetch } = useCollection(
    `/api/help${all ? '?scope=society' : ''}`,
    'help',
    { deps: [all] },
  );
  const write = useWriter(refetch);

  const add = useCallback((payload) => write(() => api.post('/api/help', payload), 'Staff member added.'), [write]);
  const update = useCallback((id, changes) => write(() => api.patch(`/api/help/${id}`, changes), 'Details updated.'), [write]);
  const attach = useCallback((id, flatCode) => write(() => api.post(`/api/help/${id}/flats`, { flatCode }), 'Linked to the flat.'), [write]);
  const detach = useCallback((id, flatCode) => write(() => api.del(`/api/help/${id}/flats?flatCode=${encodeURIComponent(flatCode)}`), 'Unlinked.'), [write]);
  const rate = useCallback((id, rating) => write(() => api.post(`/api/help/${id}/rating`, { rating }), 'Rating saved.'), [write]);
  const mark = useCallback((id, payload) => write(() => api.post(`/api/help/${id}/attendance`, payload), 'Attendance marked.'), [write]);

  /* Scanning a staff card at the gate: an answer, not a toast. */
  const byCard = useCallback(async (code) => {
    try {
      const { help } = await api.get(`/api/help/card/${encodeURIComponent(String(code).trim())}`);
      return { ok: true, help };
    } catch (error) {
      return { ok: false, error };
    }
  }, []);

  return { help: items, loading, error, refetch, add, update, attach, detach, rate, mark, byCard };
}

export function useAttendance() {
  const { items, loading, refetch } = useCollection('/api/help/attendance/recent', 'attendance');
  return { attendance: items, loading, refetch };
}
