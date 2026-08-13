import { useCallback, useMemo } from "react";
import { useApp } from "../store";
import { useActions } from "../store/actions";
import { useQuery } from "../lib/query";
import { api } from "../lib/api";

/**
 * The notice board.
 *
 * Reads and reactions belong to a person, so the server returns what this
 * caller has done — `read` and `myReactions` — rather than the screen keeping
 * its own idea of it. Demo mode keeps working from the seeded board.
 */
export function useNotices() {
  const { live, me, db, say, sel } = useApp();
  const local = useActions();

  const q = useQuery(
    () => api.get("/api/notices?limit=60").then((r) => r.notices),
    { enabled: live && !!me, deps: [me?.id], initial: [] },
  );

  /* The seed stores an author id and resolves the name through a selector; the
     API sends the name already, because it is the only side that can look up a
     user it has not shipped to the browser. Normalising to a name here means
     the screens render `n.author` and never branch on the mode. */
  const localList = useMemo(
    () => db.notices.map((n) => ({
      ...n,
      author: sel.userName(n.author),
      comments: (n.comments || []).map((c) => ({
        id: c.id, at: c.at, body: c.body ?? c.text, author: sel.userName(c.by), authorId: c.by,
      })),
      read: (n.readBy || []).includes(me?.id),
      readCount: (n.readBy || []).length,
      myReactions: [],
    })),
    [db.notices, me?.id, sel],
  );

  const notices = live ? (q.data || []) : localList;
  const unread = notices.filter((n) => !n.read).length;

  const create = useCallback(async (payload) => {
    if (!live) return { ok: true, notice: local.postNotice(payload) };
    try {
      const { notice } = await api.post("/api/notices", payload);
      await q.refetch();
      say("Notice posted to the board");
      return { ok: true, notice };
    } catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, local, q, say]);

  const markRead = useCallback(async (notice) => {
    if (notice.read) return;
    if (!live) return void local.readNotice(notice.id);
    /* Fire and forget: a failed read marker is not worth interrupting someone
       who is in the middle of reading the notice. */
    try { await api.post(`/api/notices/${notice.id}/read`, {}); await q.refetch(); } catch { /* ignore */ }
  }, [live, local, q]);

  const react = useCallback(async (notice, emoji) => {
    if (!live) return void local.react(notice.id, emoji);
    try { await api.post(`/api/notices/${notice.id}/reactions`, { emoji }); await q.refetch(); }
    catch (err) { say(err.message, "bad"); }
  }, [live, local, q, say]);

  const comment = useCallback(async (notice, body) => {
    if (!live) return { ok: true, notice: local.commentOnNotice?.(notice.id, body) };
    try {
      await api.post(`/api/notices/${notice.id}/comments`, { body });
      await q.refetch();
      return { ok: true };
    } catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, local, q, say]);

  const setPinned = useCallback(async (notice, pinned) => {
    if (!live) return { ok: true };
    try { await api.patch(`/api/notices/${notice.id}`, { pinned }); await q.refetch(); return { ok: true }; }
    catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, q, say]);

  const remove = useCallback(async (notice) => {
    if (!live) return { ok: true };
    try { await api.del(`/api/notices/${notice.id}`); await q.refetch(); say("Notice removed"); return { ok: true }; }
    catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, q, say]);

  return {
    notices,
    unread,
    loading: live ? q.loading : false,
    error: live ? q.error : null,
    refetch: q.refetch,
    create, markRead, react, comment, setPinned, remove,
  };
}
