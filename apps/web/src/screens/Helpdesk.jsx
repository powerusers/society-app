import { useCallback, useEffect, useMemo, useState } from "react";
import Icons from "../icons";
import { Badge, Btn, Empty, Sheet, Segmented, SearchBar, Stat, Alert, Avatar, Select, TextArea, SkeletonList } from "../components/ui";
import { TicketRow } from "../components/entities";
import { RaiseTicketSheet } from "../components/sheets";
import { useApp } from "../store";
import { useActions } from "../store/actions";
import { useTickets } from "../data/tickets";
import { ago, fmtDateTime, until, pct } from "../lib/format";

export default function Helpdesk({ nav, params }) {
  const { db, me, can, sel } = useApp();
  const repo = useTickets();
  const [tab, setTab] = useState("open");
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState(null);
  const [open, setOpen] = useState(() => (params?.ticketId ? db.tickets.find((t) => t.id === params.ticketId) : null));

  const manage = can("helpdesk.manage");
  const isStaff = me.role === "staff";

  // The repository already applies the same scoping the API enforces.
  const scope = repo.tickets;

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return scope
      .filter((x) => (tab === "all" ? true : tab === "open" ? x.status === "open" || x.status === "in-progress" : x.status === tab))
      .filter((x) => !t || x.title.toLowerCase().includes(t) || x.ref.toLowerCase().includes(t) || x.category.toLowerCase().includes(t))
      .sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [scope, tab, q]);

  const live = scope.filter((t) => t.status === "open" || t.status === "in-progress");
  const breached = live.filter((t) => until(t.slaDueAt).late);
  const resolved = scope.filter((t) => t.status === "resolved" || t.status === "closed");
  const onTime = resolved.filter((t) => !t.resolvedAt || t.resolvedAt <= t.slaDueAt).length;

  return (
    <>
      <div className="grid3">
        <Stat value={live.length} label="Open" color="var(--amber)" />
        <Stat value={breached.length} label="SLA breached" color={breached.length ? "var(--red)" : "var(--ink3)"} />
        <Stat value={`${pct(onTime, resolved.length || 1)}%`} label="Within SLA" color="var(--green)" />
      </div>

      {breached.length > 0 && manage && (
        <div style={{ marginTop: 12 }}>
          <Alert kind="err" icon={Icons.AlertTri}>
            <b>{breached.length} ticket{breached.length > 1 ? "s have" : " has"} breached SLA.</b> Assign or escalate — residents see the same clock you do.
          </Alert>
        </div>
      )}

      <Btn block icon={Icons.Plus} style={{ margin: "12px 0" }} onClick={() => setSheet("new")}>Raise a complaint</Btn>

      <Alert kind="info" icon={Icons.Mic}>
        Called the helpdesk instead? The AI voice assistant transcribes the call and opens a ticket automatically — no request gets lost on a phone line.
      </Alert>

      <SearchBar value={q} onChange={setQ} placeholder="Search ticket, ref or category…" />
      <Segmented value={tab} onChange={setTab} options={[
        { value: "open", label: `Open (${live.length})` },
        { value: "resolved", label: "Resolved" },
        { value: "all", label: "All" },
      ]} />

      {repo.error && (
        <Alert kind="err" icon={Icons.AlertTri}>
          {repo.error.message} <button className="linkbtn" style={{ color: "inherit", textDecoration: "underline" }} onClick={repo.refetch}>Retry</button>
        </Alert>
      )}

      {repo.loading ? <SkeletonList rows={4} /> : (
        <div className="list">
          {list.map((t) => <TicketRow key={t.id} t={t} onOpen={() => setOpen(t)} />)}
          {!list.length && <Empty icon={Icons.Ticket} title="Nothing here" note="Raised complaints and their SLA clocks show up in this list." />}
        </div>
      )}

      {sheet === "new" && <RaiseTicketSheet onClose={() => setSheet(null)} />}
      {open && <TicketSheet id={open.id} repo={repo} onClose={() => setOpen(null)} />}
    </>
  );
}

function TicketSheet({ id, repo, onClose }) {
  const { db, me, can, sel, live } = useApp();
  const [t, setT] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const fresh = await repo.load(id);
    setT(fresh);
  }, [id, repo]);

  useEffect(() => { reload().catch(() => {}); }, [reload]);

  if (!t) {
    return (
      <Sheet title="Loading…" onClose={onClose}>
        <SkeletonList rows={2} />
      </Sheet>
    );
  }

  const manage = can("helpdesk.manage");
  const sla = until(t.slaDueAt);
  const staff = db.users.filter((u) => u.role === "staff" || u.role === "guard");
  const mine = t.raisedBy === me.id;

  const act = async (fn) => {
    setBusy(true);
    await fn();
    await reload();
    setBusy(false);
  };

  return (
    <Sheet title={t.ref} onClose={onClose}>
      <p className="h3" style={{ marginBottom: 8 }}>{t.title}</p>
      <div className="wrap" style={{ marginBottom: 14 }}>
        <Badge color={t.status === "open" ? "amber" : t.status === "in-progress" ? "blue" : "green"}>{t.status}</Badge>
        <Badge color={t.priority === "high" ? "red" : "amber"}>{t.priority}</Badge>
        <Badge>{t.category}</Badge>
        <Badge>{t.flatCode}</Badge>
        {(t.status === "open" || t.status === "in-progress") && (
          <Badge color={sla.late ? "red" : "green"}>SLA {sla.late ? `over by ${sla.txt}` : `${sla.txt} left`}</Badge>
        )}
      </div>
      <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6, marginBottom: 12 }}>{t.body}</p>
      <p className="tiny" style={{ marginBottom: 16 }}>
        Raised by {t.raisedByName || sel.userName(t.raisedBy)} · {fmtDateTime(t.at)} · via {t.source === "ai-call" ? "AI voice helpdesk" : "app"}
      </p>

      {manage && (
        <div className="card flat">
          <Select label="Assign to" value={t.assignedTo || ""} disabled={busy}
            onChange={(e) => act(() => repo.update(t, { assignedTo: e.target.value || null }))}
            options={[
              { value: "", label: "Unassigned" },
              ...(live && t.assignedTo && !staff.some((x) => x.id === t.assignedTo)
                ? [{ value: t.assignedTo, label: t.assignedToName || "Currently assigned" }]
                : []),
              ...staff.map((sm) => ({ value: sm.id, label: `${sm.name}${sm.designation ? ` · ${sm.designation}` : ""}` })),
            ]} />
          <div className="wrap" style={{ gap: 8 }}>
            {t.status !== "in-progress" && <Btn size="sm" variant="ghost" disabled={busy} onClick={() => act(() => repo.update(t, { status: "in-progress" }))}>Start work</Btn>}
            {t.status !== "resolved" && <Btn size="sm" disabled={busy} onClick={() => act(() => repo.update(t, { status: "resolved" }))}>Mark resolved</Btn>}
            {t.status !== "closed" && <Btn size="sm" variant="ghost" disabled={busy} onClick={() => act(() => repo.update(t, { status: "closed" }))}>Close</Btn>}
          </div>
        </div>
      )}

      <p className="h4" style={{ margin: "16px 0 8px" }}>Updates ({t.comments?.length || 0})</p>
      {(t.comments || []).map((c) => (
        <div key={c.id} className="li" style={{ padding: "9px 0", borderBottom: "none" }}>
          <Avatar name={c.byName || sel.userName(c.by)} />
          <div className="grow">
            <p className="h4">{c.byName || sel.userName(c.by)} <span className="tiny">· {ago(c.at)}</span></p>
            <p className="muted">{c.text}</p>
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input className="inp" placeholder="Add an update…" value={text} onChange={(e) => setText(e.target.value)} />
        <Btn icon={Icons.Send} disabled={busy || !text.trim()}
          onClick={() => act(async () => { await repo.comment(t, text.trim()); setText(""); })} />
      </div>

      {mine && t.status === "resolved" && !t.rating && (
        <>
          <p className="h4" style={{ margin: "18px 0 8px" }}>How was the resolution?</p>
          <div className="wrap">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} className="chip" disabled={busy}
                onClick={() => act(async () => { await repo.rate(t, n); onClose(); })}>
                {"\u2605".repeat(n)}
              </button>
            ))}
          </div>
        </>
      )}
      {t.rating && (
        <div className="alert ok" style={{ marginTop: 16 }}>
          <Icons.Star size={16} /><span>Rated {t.rating}/5 by the resident.</span>
        </div>
      )}
    </Sheet>
  );
}
