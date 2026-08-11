import Icons from "../icons";
import { Badge, Btn, Avatar, useTick } from "./ui";
import { ago, fmtDateTime, fmtTime, inr, minsBetween, until, cycleLabel, fmtDate } from "../lib/format";
import { useApp } from "../store";

/** Visitor categories carry an icon and a tone — no emoji in structural UI. */
export const CAT = {
  delivery: { label: "Delivery", icon: Icons.Box, tone: "blue" },
  guest: { label: "Guest", icon: Icons.User, tone: "brand" },
  service: { label: "Service", icon: Icons.Tools, tone: "amber" },
  cab: { label: "Cab", icon: Icons.Car, tone: "purple" },
  staff: { label: "Daily help", icon: Icons.Broom, tone: "green" },
};

export const catOf = (c) => CAT[c] || CAT.guest;

export const STATUS_COLOR = {
  "pre-approved": "blue", approved: "green", pending: "amber", waiting: "purple",
  denied: "red", inside: "green", exited: "", open: "amber", "in-progress": "blue",
  resolved: "green", closed: "", paid: "green", issued: "amber", overdue: "red",
  "pending-approval": "purple", draft: "", confirmed: "green", cancelled: "red", active: "green",
};

export const CatTile = ({ category, size = 18 }) => {
  const c = catOf(category);
  return <div className={`ico-tile ${c.tone}`}><c.icon size={size} /></div>;
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
    ? <Badge color="red"><Icons.AlertTri size={11} /> Over by {o.by}m</Badge>
    : <Badge color="green"><Icons.Clock size={11} /> {o.limit - o.spent}m left</Badge>;
}

export function VisitorCard({ v, actions, accent }) {
  const { db, sel } = useApp();
  const c = catOf(v.category);
  return (
    <div className="card" style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}>
      <div className="row top">
        <CatTile category={v.category} />
        <div className="grow">
          <p className="h3 truncate">{v.name}</p>
          <p className="tiny" style={{ marginTop: 3 }}>
            {c.label} · Flat <b style={{ color: "var(--ink-2)" }}>{v.flatCode}</b> · {sel.gate(v.gateId)?.name || "Main Gate"}
          </p>
          {v.purpose && <p className="tiny" style={{ marginTop: 3 }}>{v.purpose}</p>}
          {v.phone && <p className="tiny" style={{ marginTop: 3 }}>{v.phone}</p>}
          {v.raisedBy && <p className="tiny" style={{ marginTop: 3 }}>Raised by {v.raisedBy}</p>}
        </div>
        <div className="right" style={{ flexShrink: 0 }}>
          <Badge color={STATUS_COLOR[v.status]}>{v.status}</Badge>
          <p className="tiny" style={{ marginTop: 5 }}>{ago(v.createdAt)}</p>
          <div style={{ marginTop: 5 }}><OverstayPill v={v} defaultMins={db.settings.overstayMins} /></div>
        </div>
      </div>
      {actions && <div className="wrap" style={{ marginTop: 13, gap: 8 }}>{actions}</div>}
    </div>
  );
}

const NOTICE_KIND = {
  notice: { label: "Notice", tone: "blue", icon: Icons.Board },
  event: { label: "Event", tone: "green", icon: Icons.Calendar },
  payment: { label: "Payment", tone: "amber", icon: Icons.Rupee },
  alert: { label: "Alert", tone: "red", icon: Icons.AlertTri },
};

export function NoticeCard({ n, onOpen }) {
  const { sel } = useApp();
  const k = NOTICE_KIND[n.kind] || NOTICE_KIND.notice;
  return (
    <div className="card tap" onClick={onOpen} role="button">
      <div className="row" style={{ marginBottom: 8 }}>
        <div className="wrap">
          <Badge color={k.tone}><k.icon size={11} /> {k.label}</Badge>
          {n.pinned && <Badge color="purple">Pinned</Badge>}
          {n.priority === "high" && <Badge color="red"><span className="dotmark" /> Urgent</Badge>}
        </div>
        <span className="tiny">{ago(n.at)}</span>
      </div>
      <p className="h3" style={{ marginBottom: 5 }}>{n.title}</p>
      <p className="muted clamp3">{n.body}</p>
      <div className="row" style={{ marginTop: 11 }}>
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
  const breached = live && sla.late;
  return (
    <div className="li tap" onClick={onOpen} role="button">
      <div className={`ico-tile ${breached ? "red" : "plain"}`}>
        <Icons.Ticket size={18} />
      </div>
      <div className="grow">
        <p className="h4 truncate">{t.title}</p>
        <p className="tiny" style={{ marginTop: 3 }}>
          {t.ref} · {t.category} · {t.flatCode} · {ago(t.at)}
        </p>
        <div className="wrap" style={{ marginTop: 6 }}>
          <Badge color={STATUS_COLOR[t.status]}>{t.status}</Badge>
          <Badge color={t.priority === "high" ? "red" : t.priority === "medium" ? "amber" : ""}>{t.priority}</Badge>
          {live && <Badge color={breached ? "red" : "green"}>{breached ? `SLA over by ${sla.txt}` : `${sla.txt} to SLA`}</Badge>}
          {t.source === "ai-call" && <Badge color="purple"><Icons.Mic size={10} /> AI call</Badge>}
          {t.assignedTo && <Badge color="blue">{sel.userName(t.assignedTo)}</Badge>}
        </div>
      </div>
      <Icons.Fwd size={15} style={{ color: "var(--ink-4)" }} />
    </div>
  );
}

export function BillRow({ b, onOpen }) {
  const { sel } = useApp();
  const p = sel.paymentOf(b.id);
  return (
    <div className="li tap" onClick={onOpen} role="button">
      <div className="ico-tile plain"><Icons.Doc size={17} /></div>
      <div className="grow">
        <p className="h4">{cycleLabel(b.cycle)}</p>
        <p className="tiny" style={{ marginTop: 3 }}>
          {b.status === "paid" && p ? `Paid ${fmtDate(p.paidAt)} · ${p.receiptNo}` : `Due ${fmtDate(b.dueDate)}`}
        </p>
      </div>
      <div className="right">
        <p className="h4">{inr(b.total)}</p>
        <div style={{ marginTop: 4 }}><Badge color={STATUS_COLOR[b.status]}>{b.status}</Badge></div>
      </div>
    </div>
  );
}

export function HelpRow({ h, right, onClick }) {
  return (
    <div className={`li ${onClick ? "tap" : ""}`} onClick={onClick}>
      <Avatar name={h.name} />
      <div className="grow">
        <p className="h4 truncate">{h.name}</p>
        <p className="tiny" style={{ marginTop: 3 }}>{h.role} · {h.flats.join(", ")}</p>
        <div className="wrap" style={{ marginTop: 6 }}>
          <Badge color={h.status === "in" ? "green" : ""}>
            {h.status === "in" ? <><span className="dotmark" /> In since {fmtTime(h.lastIn)}</> : "Outside"}
          </Badge>
          {h.biometric && <Badge color="brand"><Icons.Finger size={10} /> Biometric</Badge>}
          {h.policeVerified && <Badge color="blue"><Icons.Shield size={10} /> Verified</Badge>}
          <Badge color="amber"><Icons.Star size={10} /> {h.rating}</Badge>
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
      <div className={`ico-tile ${i.severity === "high" ? "red" : "amber"}`}><Icons.AlertTri size={18} /></div>
      <div className="grow">
        <p className="h4" style={{ textTransform: "capitalize" }}>{i.type} · {i.involves}</p>
        <p className="tiny" style={{ marginTop: 3 }}>{i.note}</p>
        <div className="wrap" style={{ marginTop: 6 }}>
          <Badge color={color}>{i.severity}</Badge>
          <Badge color={i.status === "open" ? "amber" : "green"}>{i.status}</Badge>
          {i.recording && <Badge color="purple"><Icons.Mic size={10} /> {i.recording}</Badge>}
          <span className="tiny">{sel.userName(i.by)} · {fmtDateTime(i.at)}</span>
        </div>
      </div>
    </div>
  );
}

export const QuickAction = ({ icon: I, label, onClick, tone }) => (
  <button className="card tap" onClick={onClick}
    style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 0, padding: "13px 12px" }}>
    <div className={`ico-tile ${tone || ""}`}><I size={18} /></div>
    <span style={{ fontSize: 12.5, fontWeight: 550, color: "var(--ink)", lineHeight: 1.35, whiteSpace: "pre-line", textAlign: "left" }}>
      {label}
    </span>
  </button>
);

export const ApproveDeny = ({ onApprove, onDeny }) => (
  <>
    <Btn size="sm" icon={Icons.Check} onClick={onApprove}>Approve</Btn>
    <Btn size="sm" variant="outline" icon={Icons.X} onClick={onDeny}>Deny</Btn>
  </>
);
