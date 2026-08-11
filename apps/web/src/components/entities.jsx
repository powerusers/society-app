import Icons from "../icons";
import { Badge, Btn, Avatar, useTick } from "./ui";
import { ago, fmtDateTime, fmtTime, inr, minsBetween, until, cycleLabel, fmtDate } from "../lib/format";
import { useApp } from "../store";

export const CAT = {
  delivery: { emoji: "📦", label: "Delivery" },
  guest: { emoji: "👤", label: "Guest" },
  service: { emoji: "🔧", label: "Service" },
  cab: { emoji: "🚕", label: "Cab" },
  staff: { emoji: "🧹", label: "Daily help" },
};

export const STATUS_COLOR = {
  "pre-approved": "blue", approved: "green", pending: "amber", waiting: "purple",
  denied: "red", inside: "green", exited: "", open: "amber", "in-progress": "blue",
  resolved: "green", closed: "", paid: "green", issued: "amber", overdue: "red",
  "pending-approval": "purple", draft: "", confirmed: "green", cancelled: "red", active: "green",
};

/** Live overstay state for a visitor who is currently inside the building. */
export const overstay = (v, defaultMins = 20) => {
  if (v.status !== "inside" || !v.entryAt) return null;
  const limit = v.allowedMins || defaultMins;
  const spent = minsBetween(v.entryAt);
  return { spent, limit, over: spent > limit, by: spent - limit };
};

export function OverstayPill({ v, defaultMins }) {
  useTick(20000);
  const o = overstay(v, defaultMins);
  if (!o) return null;
  return o.over
    ? <Badge color="red"><Icons.AlertTri size={11} /> Overstay +{o.by}m</Badge>
    : <Badge color="green"><Icons.Clock size={11} /> {o.limit - o.spent}m left</Badge>;
}

export function VisitorCard({ v, actions, accent }) {
  const { db, sel } = useApp();
  const c = CAT[v.category] || CAT.guest;
  return (
    <div className="card" style={accent ? { borderLeft: `4px solid ${accent}` } : undefined}>
      <div className="row top">
        <div className="grow">
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
            <span style={{ fontSize: 16 }}>{c.emoji}</span>
            <p className="h3 truncate">{v.name}</p>
          </div>
          <p className="tiny">{c.label} · Flat <b>{v.flatCode}</b> · {sel.gate(v.gateId)?.name || "Main Gate"}</p>
          {v.purpose && <p className="tiny" style={{ marginTop: 3 }}>📝 {v.purpose}</p>}
          {v.phone && <p className="tiny" style={{ marginTop: 2 }}>📱 {v.phone}</p>}
          {v.raisedBy && <p className="tiny" style={{ marginTop: 2 }}>Raised by: {v.raisedBy}</p>}
        </div>
        <div className="right" style={{ flexShrink: 0 }}>
          <Badge color={STATUS_COLOR[v.status]}>{v.status}</Badge>
          <p className="tiny" style={{ marginTop: 4 }}>{ago(v.createdAt)}</p>
          <div style={{ marginTop: 4 }}><OverstayPill v={v} defaultMins={db.settings.overstayMins} /></div>
        </div>
      </div>
      {actions && <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>{actions}</div>}
    </div>
  );
}

export function NoticeCard({ n, onOpen }) {
  const { sel } = useApp();
  const kind = { notice: "blue", event: "green", payment: "amber", alert: "red" }[n.kind] || "";
  const label = { notice: "📋 Notice", event: "🎉 Event", payment: "💰 Payment", alert: "🚨 Alert" }[n.kind];
  return (
    <div className="card tap" onClick={onOpen} role="button">
      <div className="row" style={{ marginBottom: 7 }}>
        <div className="wrap">
          <Badge color={kind}>{label}</Badge>
          {n.pinned && <Badge color="purple">📌 Pinned</Badge>}
          {n.priority === "high" && <Badge color="red">Urgent</Badge>}
        </div>
        <span className="tiny">{ago(n.at)}</span>
      </div>
      <p className="h3" style={{ marginBottom: 5 }}>{n.title}</p>
      <p className="muted" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{n.body}</p>
      <div className="row" style={{ marginTop: 10 }}>
        <span className="tiny">{sel.userName(n.author)}</span>
        <div className="wrap">
          {Object.entries(n.reactions || {}).map(([e, c]) => (
            <span key={e} className="badge">{e} {c}</span>
          ))}
          {n.comments?.length > 0 && <span className="badge"><Icons.Chat size={11} /> {n.comments.length}</span>}
        </div>
      </div>
    </div>
  );
}

export function TicketRow({ t, onOpen }) {
  const { sel } = useApp();
  const sla = until(t.slaDueAt);
  const live = t.status === "open" || t.status === "in-progress";
  return (
    <div className="li tap" onClick={onOpen} role="button">
      <div className="ico-tile" style={{ background: live && sla.late ? "var(--red-bg)" : undefined, color: live && sla.late ? "var(--red)" : undefined }}>
        <Icons.Ticket size={19} />
      </div>
      <div className="grow">
        <p className="h4 truncate">{t.title}</p>
        <p className="tiny" style={{ marginTop: 2 }}>
          {t.ref} · {t.category} · {t.flatCode} · {ago(t.at)}
        </p>
        <div className="wrap" style={{ marginTop: 5 }}>
          <Badge color={STATUS_COLOR[t.status]}>{t.status}</Badge>
          <Badge color={t.priority === "high" ? "red" : t.priority === "medium" ? "amber" : ""}>{t.priority}</Badge>
          {live && <Badge color={sla.late ? "red" : "green"}>SLA {sla.late ? `breached ${sla.txt}` : `${sla.txt} left`}</Badge>}
          {t.source === "ai-call" && <Badge color="purple">🎙 AI call</Badge>}
          {t.assignedTo && <Badge color="blue">{sel.userName(t.assignedTo)}</Badge>}
        </div>
      </div>
      <Icons.Fwd size={15} style={{ color: "var(--ink3)" }} />
    </div>
  );
}

export function BillRow({ b, onOpen }) {
  const { sel } = useApp();
  const p = sel.paymentOf(b.id);
  return (
    <div className="li tap" onClick={onOpen} role="button">
      <div className="ico-tile"><Icons.Doc size={18} /></div>
      <div className="grow">
        <p className="h4">{cycleLabel(b.cycle)}</p>
        <p className="tiny" style={{ marginTop: 2 }}>
          {b.status === "paid" && p ? `Paid ${fmtDate(p.paidAt)} · ${p.receiptNo}` : `Due ${fmtDate(b.dueDate)}`}
        </p>
      </div>
      <div className="right">
        <p className="h4">{inr(b.total)}</p>
        <Badge color={STATUS_COLOR[b.status]}>{b.status}</Badge>
      </div>
    </div>
  );
}

export function HelpRow({ h, right, onClick }) {
  const EMOJI = { Maid: "🧹", Cook: "👩‍🍳", Driver: "🚗", Nanny: "🍼", "Dog walker": "🐕", Newspaper: "📰", Milkman: "🥛" };
  return (
    <div className={`li ${onClick ? "tap" : ""}`} onClick={onClick}>
      <Avatar name={h.name} emoji={EMOJI[h.role]} />
      <div className="grow">
        <p className="h4 truncate">{h.name}</p>
        <p className="tiny" style={{ marginTop: 2 }}>{h.role} · {h.flats.join(", ")}</p>
        <div className="wrap" style={{ marginTop: 5 }}>
          <Badge color={h.status === "in" ? "green" : ""}>{h.status === "in" ? `Inside · since ${fmtTime(h.lastIn)}` : "Out"}</Badge>
          {h.biometric && <Badge color="brand"><Icons.Finger size={10} /> Biometric</Badge>}
          {h.policeVerified && <Badge color="blue">Police verified</Badge>}
          <Badge color="amber">★ {h.rating}</Badge>
        </div>
      </div>
      {right}
    </div>
  );
}

export function IncidentRow({ i }) {
  const { sel } = useApp();
  const color = { high: "red", medium: "amber", low: "" }[i.severity];
  return (
    <div className="li">
      <div className="ico-tile" style={{ background: "var(--red-bg)", color: "var(--red)" }}><Icons.AlertTri size={18} /></div>
      <div className="grow">
        <p className="h4" style={{ textTransform: "capitalize" }}>{i.type} · {i.involves}</p>
        <p className="tiny" style={{ marginTop: 2 }}>{i.note}</p>
        <div className="wrap" style={{ marginTop: 5 }}>
          <Badge color={color}>{i.severity}</Badge>
          <Badge color={i.status === "open" ? "amber" : "green"}>{i.status}</Badge>
          {i.recording && <Badge color="purple">🎙 {i.recording}</Badge>}
          <span className="tiny">{sel.userName(i.by)} · {fmtDateTime(i.at)}</span>
        </div>
      </div>
    </div>
  );
}

export const QuickAction = ({ icon: I, label, onClick, tint }) => (
  <button className="card tap" onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 0, padding: "13px 12px" }}>
    <div className="ico-tile" style={tint ? { background: tint.bg, color: tint.fg } : undefined}><I size={20} /></div>
    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", lineHeight: 1.3, whiteSpace: "pre-line", textAlign: "left" }}>{label}</span>
  </button>
);

export const ApproveDeny = ({ onApprove, onDeny }) => (
  <>
    <Btn size="sm" icon={Icons.Check} onClick={onApprove}>Approve</Btn>
    <Btn size="sm" variant="danger" icon={Icons.X} onClick={onDeny}>Deny</Btn>
  </>
);
