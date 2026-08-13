import { useCallback, useMemo } from "react";
import { useApp } from "../store";
import { useActions } from "../store/actions";
import { useQuery } from "../lib/query";
import { api } from "../lib/api";

/**
 * The residents' board: discussions, recommendations and the marketplace.
 *
 * The API decides whether the author's number may be shown — the same consent
 * the directory asks for — and says which case it is with `contactHidden`, so
 * the screen offers to dial or offers the reply thread instead of guessing.
 */
export function useForum() {
  const { live, me, db, say, sel } = useApp();
  const local = useActions();

  const q = useQuery(
    () => api.get("/api/posts").then((r) => r.posts),
    { enabled: live && !!me, deps: [me?.id], initial: [] },
  );

  /* The seed stores author ids, a like counter and `text` comments; the API
     sends names, a like the caller can take back, and the same comment shape.
     Normalising here lets the screen read one shape in both modes. */
  const localList = useMemo(() => db.forum.map((p) => {
    const author = sel.userById(p.by);
    return {
      ...p,
      author: sel.userName(p.by),
      authorFlat: author?.flat || null,
      authorPhone: author?.phone || "",
      contactHidden: false,
      mine: p.by === me?.id,
      liked: false,
      comments: (p.comments || []).map((c) => ({
        id: c.id, text: c.text, at: c.at, author: sel.userName(c.by), authorId: c.by,
      })),
    };
  }), [db.forum, me?.id, sel]);

  const posts = live ? (q.data || []) : localList;

  const create = useCallback(async (payload) => {
    if (!live) return { ok: true, post: local.createPost(payload) };
    try {
      const { post } = await api.post("/api/posts", payload);
      await q.refetch();
      say("Posted to the community");
      return { ok: true, post };
    } catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, local, q, say]);

  const like = useCallback(async (post) => {
    if (!live) return void local.likePost(post.id);
    try { await api.post(`/api/posts/${post.id}/like`, {}); await q.refetch(); }
    catch (err) { say(err.message, "bad"); }
  }, [live, local, q, say]);

  const reply = useCallback(async (post, text) => {
    if (!live) return { ok: true, post: local.replyToPost(post.id, text) };
    try {
      await api.post(`/api/posts/${post.id}/comments`, { text });
      await q.refetch();
      return { ok: true };
    } catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, local, q, say]);

  const remove = useCallback(async (post) => {
    if (!live) return { ok: true, post: local.removePost(post.id) };
    try { await api.del(`/api/posts/${post.id}`); await q.refetch(); say("Post removed"); return { ok: true }; }
    catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, local, q, say]);

  return {
    posts,
    loading: live ? q.loading : false,
    error: live ? q.error : null,
    refetch: q.refetch,
    create, like, reply, remove,
  };
}
