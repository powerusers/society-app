import { useMemo, useState } from "react";
import Icons from "../icons";
import { Badge, Btn, Empty, Sheet, Segmented, SearchBar, Stat, Alert, Avatar, Select, TextArea } from "../components/ui";
import { TicketRow } from "../components/entities";
import { RaiseTicketSheet } from "../components/sheets";
import { useApp } from "../store";
import { useActions } from "../store/actions";
import { ago, fmtDateTime, until, pct } from "../lib/format";

export default function Helpdesk({ nav, params }) {
  const { db, me, can, sel } = useApp();
  const [tab, setTab] = useState("open");
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState(null);
  const [open, setOpen] = useState(() => (params?.ticketId ? db.tickets.find((t) => t.id === params.ticketId) : null));

  const manage = can("helpdesk.manage");
  const isStaff = me.role === "staff";

  const scope = useMemo(() => {
    if (isStaff) return db.tickets.filter((t) => t.assignedTo === me.id || !t.assignedTo);
    if (manage) return db.tickets;
    return db.tickets.filter((t) => t.flatCode === me.flat);
  }, [db.tickets, manage, isStaff, me]);

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

      <div className="list">
        {list.map((t) => <TicketRow key={t.id} t={t} onOpen={() => setOpen(t)} />)}
        {!list.length && <Empty icon={Icons.Ticket} title="Nothing here" note="Raised complaints and their SLA clocks show up in this list." />}
      </div>

      {sheet === "new" && <RaiseTicketSheet onClose={() => setSheet(null)} />}
      {open && <TicketSheet t={db.tickets.find((x) => x.id === open.id) || open} onClose={() => setOpen(null)} />}
    </>
  );
}

function TicketSheet({ t, onClose }) {
  const { db, me, can, sel, patch } = useApp();
  const A = useActions();
  const [text, setText] = useState("");
  const manage = can("helpdesk.manage");
  const sla = until(t.slaDueAt);
  const staff = db.users.filter((u) => u.role === "staff" || u.role === "guard");
  const mine = t.raisedBy === me.id;

  return (
    <Sheet title={t.ref} onClose={onClose}>
      <p className="h3" style={{ marginBottom: 6 }}>{t.title}</p>
      <div className="wrap" style={{ marginBottom: 12 }}>
        <Badge color={t.status === "open" ? "amber" : t.status === "in-progress" ? "blue" : "green"}>{t.status}</Badge>
        <Badge color={t.priority === "high" ? "red" : "amber"}>{t.priority}</Badge>
        <Badge>{t.category}</Badge>
        <Badge>{t.flatCode}</Badge>
        {(t.status === "open" || t.status === "in-progress") && (
          <Badge color={sla.late ? "red" : "green"}>SLA {sla.late ? `breached by ${sla.txt}` : `${sla.txt} left`}</Badge>
        )}
      </div>
      <p className="muted" style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>{t.body}</p>
      <p className="tiny" style={{ marginBottom: 16 }}>
        Raised by {sel.userName(t.raisedBy)} · {fmtDateTime(t.at)} · via {t.source === "ai-call" ? "AI voice helpdesk" : "app"}
      </p>

      {manage && (
        <div className="card flat">
          <Select label="Assign to" value={t.assignedTo || ""} onChange={(e) => { patch("tickets", t.id, { assignedTo: e.target.value || null, status: e.target.value && t.status === "open" ? "in-progress" : t.status }); }}
            options={[{ value: "", label: "Unassigned" }, ...staff.map((s) => ({ value: s.id, label: `${s.name}${s.designation ? ` · ${s.designation}` : ""}` }))]} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {t.status !== "in-progress" && <Btn size="sm" variant="ghost" onClick={() => A.setTicketStatus(t, "in-progress")}>Start work</Btn>}
            {t.status !== "resolved" && <Btn size="sm" onClick={() => A.setTicketStatus(t, "resolved")}>Mark resolved</Btn>}
            {t.status !== "closed" && <Btn size="sm" variant="ghost" onClick={() => A.setTicketStatus(t, "closed")}>Close</Btn>}
          </div>
        </div>
      )}

      <p className="h4" style={{ margin: "14px 0 8px" }}>Updates ({t.comments.length})</p>
      {t.comments.map((c) => (
        <div key={c.id} className="li" style={{ padding: "9px 0" }}>
          <Avatar name={sel.userName(c.by)} />
          <div className="grow">
            <p className="h4">{sel.userName(c.by)} <span className="tiny">· {ago(c.at)}</span></p>
            <p className="muted">{c.text}</p>
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input className="inp" placeholder="Add an update…" value={text} onChange={(e) => setText(e.target.value)} />
        <Btn icon={Icons.Send} onClick={() => { if (text.trim()) { A.commentTicket(t, text.trim()); setText(""); } }} />
      </div>

      {mine && t.status === "resolved" && !t.rating && (
        <>
          <p className="h4" style={{ margin: "16px 0 8px" }}>How was the resolution?</p>
          <div className="wrap">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} className="chip" onClick={() => { patch("tickets", t.id, { rating: n, status: "closed" }); onClose(); }}>
                {"★".repeat(n)}
              </button>
            ))}
          </div>
        </>
      )}
      {t.rating && <div className="alert ok" style={{ marginTop: 14 }}><Icons.Star size={16} /><span>Rated {t.rating}/5 by the resident.</span></div>}
    </Sheet>
  );
}
