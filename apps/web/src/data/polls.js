import { useCallback, useMemo } from "react";
import { useApp } from "../store";
import { useActions } from "../store/actions";
import { useQuery } from "../lib/query";
import { api } from "../lib/api";

/**
 * Society polls.
 *
 * The server withholds tallies until this caller has voted or the poll has
 * closed, and says so with `resultsHidden` — so the screen shows the promise
 * being kept rather than hiding numbers it was sent anyway.
 */
export function usePolls() {
  const { live, me, db, say, sel } = useApp();
  const local = useActions();

  const q = useQuery(
    () => api.get("/api/polls").then((r) => r.polls),
    { enabled: live && !!me, deps: [me?.id], initial: [] },
  );

  /* The seed keeps a voters map and always-visible counts; normalising here
     lets the screen read one shape and honour the same rule in both modes. */
  const localList = useMemo(() => db.polls.map((p) => {
    const myVote = p.voters?.[me?.id] || null;
    const closed = new Date(p.closesAt) < new Date();
    const visible = Boolean(myVote) || closed;
    return {
      ...p,
      createdBy: sel.userName(p.createdBy),
      closed,
      myVote,
      resultsHidden: !visible,
      total: visible ? p.options.reduce((s, o) => s + o.votes, 0) : null,
      options: p.options.map((o) => ({ ...o, votes: visible ? o.votes : null })),
    };
  }), [db.polls, me?.id, sel]);

  const polls = live ? (q.data || []) : localList;
  const openForMe = polls.find((p) => !p.closed && !p.myVote) || null;

  const vote = useCallback(async (poll, optionId) => {
    if (!live) { local.vote(poll, optionId); return { ok: true }; }
    try {
      await api.post(`/api/polls/${poll.id}/vote`, { optionId });
      await q.refetch();
      return { ok: true };
    } catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, local, q, say]);

  const create = useCallback(async (payload) => {
    if (!live) return { ok: true, poll: local.createPoll?.(payload) };
    try {
      const { poll } = await api.post("/api/polls", payload);
      await q.refetch();
      say("Poll published");
      return { ok: true, poll };
    } catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, local, q, say]);

  const close = useCallback(async (poll) => {
    if (!live) return { ok: true };
    try { await api.post(`/api/polls/${poll.id}/close`, {}); await q.refetch(); say("Poll closed"); return { ok: true }; }
    catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, q, say]);

  const remove = useCallback(async (poll) => {
    if (!live) return { ok: true };
    try { await api.del(`/api/polls/${poll.id}`); await q.refetch(); say("Poll removed"); return { ok: true }; }
    catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, q, say]);

  return {
    polls,
    openForMe,
    loading: live ? q.loading : false,
    error: live ? q.error : null,
    refetch: q.refetch,
    vote, create, close, remove,
  };
}
