/** Amenities, their bookings, and the classes run in them. */
import { useCallback } from 'react';
import { useCollection, useWriter } from './base';
import { api } from '../lib/api';

export function useAmenities() {
  const { items, loading, error, refetch } = useCollection('/api/amenities', 'amenities');
  const write = useWriter(refetch);

  const create = useCallback((payload) => write(() => api.post('/api/amenities', payload), 'Amenity added.'), [write]);
  const update = useCallback((id, changes) => write(() => api.patch(`/api/amenities/${id}`, changes), 'Amenity updated.'), [write]);
  const remove = useCallback((id) => write(() => api.del(`/api/amenities/${id}`), 'Amenity removed.'), [write]);

  return { amenities: items, loading, error, refetch, create, update, remove };
}

export function useBookings() {
  const { items, loading, error, refetch } = useCollection('/api/amenities/bookings', 'bookings');
  const write = useWriter(refetch);

  const book = useCallback((payload) => write(() => api.post('/api/amenities/bookings', payload), 'Booking requested.'), [write]);
  const decide = useCallback((id, approved, reason) => write(
    () => api.post(`/api/amenities/bookings/${id}/decide`, { approved, reason }),
    approved ? 'Booking approved.' : 'Booking declined.',
    { kind: approved ? 'ok' : 'bad' },
  ), [write]);
  const cancel = useCallback((id) => write(() => api.del(`/api/amenities/bookings/${id}`), 'Booking cancelled.'), [write]);

  return { bookings: items, loading, error, refetch, book, decide, cancel };
}

export function useClasses() {
  const { items, loading, error, refetch } = useCollection('/api/amenities/classes', 'classes');
  const write = useWriter(refetch);

  const create = useCallback((payload) => write(() => api.post('/api/amenities/classes', payload), 'Class added.'), [write]);
  const remove = useCallback((id) => write(() => api.del(`/api/amenities/classes/${id}`), 'Class removed.'), [write]);
  const enrol = useCallback((id) => write(() => api.post(`/api/amenities/classes/${id}/enrol`), 'Enrolled.'), [write]);
  const leave = useCallback((id) => write(() => api.del(`/api/amenities/classes/${id}/enrol`), 'Left the class.'), [write]);

  return { classes: items, loading, error, refetch, create, remove, enrol, leave };
}
