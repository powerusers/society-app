/**
 * The resident directory.
 *
 * Phone numbers and email arrive masked unless the resident consented to share
 * them; the server decides that, and `contactHidden` says so outright rather
 * than leaving the client to guess from bullet characters.
 */
import { useCollection } from './base';

export function useDirectory() {
  const { items, loading, error, refetch } = useCollection('/api/me/directory', 'directory');
  return { directory: items, loading, error, refetch };
}

export function useAudit() {
  const { items, loading, error, refetch } = useCollection('/api/me/audit', 'audit');
  return { audit: items, loading, error, refetch };
}
