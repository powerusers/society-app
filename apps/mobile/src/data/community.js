/**
 * The community board: notices, polls and the residents' forum.
 *
 * Reading, commenting and reacting are open to every member of the society.
 * Posting, pinning and removing a notice are not — those carry the committee's
 * voice and sit behind notice.write, which the API enforces and can() mirrors.
 */
import { useCallback } from 'react';
import { useCollection, useWriter } from './base';
import { api } from '../lib/api';

export function useNotices() {
  const { items, loading, error, refetch } = useCollection('/api/notices', 'notices');
  const write = useWriter(refetch);

  const post = useCallback((payload) => write(() => api.post('/api/notices', payload), 'Notice posted.'), [write]);
  const update = useCallback((id, changes) => write(() => api.patch(`/api/notices/${id}`, changes), 'Notice updated.'), [write]);
  const remove = useCallback((id) => write(() => api.del(`/api/notices/${id}`), 'Notice removed.'), [write]);
  const comment = useCallback((id, body) => write(() => api.post(`/api/notices/${id}/comments`, { body }), 'Comment added.'), [write]);
  const react = useCallback((id, emoji) => write(() => api.post(`/api/notices/${id}/reactions`, { emoji }), null), [write]);

  /* Marking read is silent and fire-and-forget: it is a side effect of the
     resident scrolling past, not an action they took. A failure here must not
     produce a toast about something they never asked for. */
  const markRead = useCallback((id) => api.post(`/api/notices/${id}/read`).catch(() => {}), []);

  return { notices: items, loading, error, refetch, post, update, remove, comment, react, markRead };
}

export function usePolls() {
  const { items, loading, error, refetch } = useCollection('/api/polls', 'polls');
  const write = useWriter(refetch);

  const create = useCallback((payload) => write(() => api.post('/api/polls', payload), 'Poll opened.'), [write]);
  const vote = useCallback((id, option) => write(() => api.post(`/api/polls/${id}/vote`, { option }), 'Vote recorded.'), [write]);
  const close = useCallback((id) => write(() => api.post(`/api/polls/${id}/close`), 'Poll closed.'), [write]);
  const remove = useCallback((id) => write(() => api.del(`/api/polls/${id}`), 'Poll removed.'), [write]);

  return { polls: items, loading, error, refetch, create, vote, close, remove };
}

export function usePosts() {
  const { items, loading, error, refetch } = useCollection('/api/posts', 'posts');
  const write = useWriter(refetch);

  const create = useCallback((payload) => write(() => api.post('/api/posts', payload), 'Posted.'), [write]);
  const like = useCallback((id) => write(() => api.post(`/api/posts/${id}/like`), null), [write]);
  const comment = useCallback((id, body) => write(() => api.post(`/api/posts/${id}/comments`, { body }), 'Comment added.'), [write]);
  const remove = useCallback((id) => write(() => api.del(`/api/posts/${id}`), 'Post removed.'), [write]);
  const removeComment = useCallback((id, commentId) => write(() => api.del(`/api/posts/${id}/comments/${commentId}`), 'Comment removed.'), [write]);

  return { posts: items, loading, error, refetch, create, like, comment, remove, removeComment };
}
