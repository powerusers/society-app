import { useCallback, useMemo } from "react";
import { useApp } from "../store";
import { useActions } from "../store/actions";
import { useQuery } from "../lib/query";
import { api } from "../lib/api";

export function useTickets() {
  const { live, me, can, say, db } = useApp();
  const local = useActions();

  const q = useQuery(
    () => api.get("/api/tickets?limit=100").then((r) => r.tickets),
    { enabled: live && !!me, deps: [me?.id], initial: [] },
  );

  /* The API already scopes by role; demo mode has to do it here. */
  const localList = useMemo(() => {
    if (!me) return [];
    if (me.role === "staff") return db.tickets.filter((t) => t.assignedTo === me.id || !t.assignedTo);
    if (can("helpdesk.manage")) return db.tickets;
    return db.tickets.filter((t) => t.flatCode === me.flat);
  }, [db.tickets, me, can]);

  const tickets = live ? (q.data || []) : localList;

  const create = useCallback(async (payload) => {
    if (!live) return { ok: true, ticket: local.raiseTicket(payload) };
    try {
      const { ticket } = await api.post("/api/tickets", payload);
      await q.refetch();
      say(`Ticket ${ticket.ref} raised`);
      return { ok: true, ticket };
    } catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, local, q, say]);

  const update = useCallback(async (t, changes) => {
    if (!live) {
      if (changes.status) local.setTicketStatus(t, changes.status);
      if ("assignedTo" in changes) {
        local.setTicketStatus(t, changes.status || (t.status === "open" ? "in-progress" : t.status), { assignedTo: changes.assignedTo });
      }
      return { ok: true };
    }
    try {
      await api.patch(`/api/tickets/${t.id}`, changes);
      await q.refetch();
      return { ok: true };
    } catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, local, q, say]);

  const comment = useCallback(async (t, text) => {
    if (!live) { local.commentTicket(t, text); return { ok: true }; }
    try {
      await api.post(`/api/tickets/${t.id}/comments`, { text });
      await q.refetch();
      return { ok: true };
    } catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, local, q, say]);

  const rate = useCallback(async (t, rating) => {
    if (!live) { return { ok: true }; }
    try {
      await api.post(`/api/tickets/${t.id}/rating`, { rating });
      await q.refetch();
      say("Thanks for the rating");
      return { ok: true };
    } catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, q, say]);

  /** Comments arrive with the detail call, not the list. */
  const load = useCallback(async (id) => {
    if (!live) {
      const t = db.tickets.find((x) => x.id === id);
      return t ? { ...t, comments: t.comments || [] } : null;
    }
    const { ticket } = await api.get(`/api/tickets/${id}`);
    return ticket;
  }, [live, db.tickets]);

  return {
    tickets,
    loading: live ? q.loading && !q.data?.length : false,
    error: live ? q.error : null,
    refetch: q.refetch,
    create, update, comment, rate, load,
  };
}
