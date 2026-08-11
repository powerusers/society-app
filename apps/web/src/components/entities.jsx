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

export const CatTile = ({ category, size = 17 }) => {
  const c = catOf(category);
  return <div className="ico-tile"><c.icon size={size} /></div>;
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

export function VisitorCard({ v, actions }) {
  const { db, sel } = useApp();
  const c = catOf(v.category);
  /* Detail is written as one sentence rather than stacked micro-lines: it reads
     faster and stops every record turning into a five-row block. */
  const detail = [c.label, `Flat ${v.flatCode}`, v.gateName || sel.gate(v.gateId)?.name].filter(Boolean).join(" · ");
  const meta = [v.purpose, v.phone, v.raisedBy && `via ${v.raisedBy}`].filter(Boolean).join(" · ");

  return (
    <div className="card">
      <div className="row top">
        <div className="grow">
          <p className="h3 truncate">{v.name}</p>
          <p className="tiny" style={{ marginTop: 4 }}>{detail}</p>
          {meta && <p className="tiny" style={{ marginTop: 3 }}>{meta}</p>}
        </div>
        <div className="right" style={{ flexShrink: 0 }}>
          <Badge color={STATUS_COLOR[v.status]}>{v.status}</Badge>
          <p className="tiny" style={{ marginTop: 5 }}>{ago(v.createdAt)}</p>
        </div>
      </div>
      <OverstayNote v={v} defaultMins={db.settings.overstayMins} />
      {actions && <div className="wrap" style={{ marginTop: 13, gap: 8 }}>{actions}</div>}
    </div>
  );
}

/** Only rendered once a visitor is actually inside — and loud only when over. */
export function OverstayNote({ v, defaultMins }) {
  useTick(20000);
  const o = overstay(v, defaultMins);
  if (!o) return null;
  return o.over
    ? <p className="tiny" style={{ marginTop: 8, color: "var(--bad)", fontWeight: 500 }}>
        Inside {o.spent} min — {o.by} over the {o.limit} minute limit
      </p>
    : <p className="tiny" style={{ marginTop: 8 }}>Inside {o.spent} of {o.limit} minutes</p>;
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
      <div className="row" style={{ marginBottom: 7 }}>
        <div className="wrap">
          <Badge color={k.tone}>{k.label}</Badge>
          {n.pinned && <Badge>Pinned</Badge>}
          {n.priority === "high" && <Badge className="solid">Urgent</Badge>}
        </div>
        <span className="tiny">{ago(n.at)}</span>
      </div>
      <p className="h3" style={{ marginBottom: 5 }}>{n.title}</p>
      <p className="muted clamp3">{n.body}</p>
      <div className="row" style={{ marginTop: 11 }}>
        <span className="tiny">{sel.userName(n.author)}</span>
        <div className="wrap">
          {Object.entries(n.reactions || {}).map(([e, c]) => (
            <span key={e} className="badge bare">{e} {c}</span>
          ))}
          {n.comments?.length > 0 && <span className="badge bare"><Icons.Chat size={11} /> {n.comments.length}</span>}
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
      <div className="grow">
        <p className="h4 truncate">{t.title}</p>
        <p className="tiny" style={{ marginTop: 3 }}>
          {t.ref} · {t.category} · {t.flatCode} · {ago(t.at)}
          {t.assignedToName || t.assignedTo ? ` · ${t.assignedToName || sel.userName(t.assignedTo)}` : ""}
        </p>
        <div className="wrap" style={{ marginTop: 6, gap: 12 }}>
          <Badge color={STATUS_COLOR[t.status]}>{t.status}</Badge>
          {t.priority === "high" && <Badge color="red">high priority</Badge>}
          {live && breached && <Badge color="red">SLA over by {sla.txt}</Badge>}
          {live && !breached && <Badge>{sla.txt} to SLA</Badge>}
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
        <div className="wrap" style={{ marginTop: 6, gap: 12 }}>
          <Badge color={h.status === "in" ? "green" : ""}>
            {h.status === "in" ? `In since ${fmtTime(h.lastIn)}` : "Outside"}
          </Badge>
          {h.policeVerified && <Badge>Police verified</Badge>}
          <span className="tiny">{h.rating} ★</span>
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
      <div className="grow">
        <p className="h4" style={{ textTransform: "capitalize" }}>{i.type} · {i.involves}</p>
        <p className="tiny" style={{ marginTop: 3 }}>{i.note}</p>
        <div className="wrap" style={{ marginTop: 6, gap: 12 }}>
          <Badge color={color}>{i.severity} severity</Badge>
          <Badge color={i.status === "open" ? "amber" : "green"}>{i.status}</Badge>
          <span className="tiny">{sel.userName(i.by)} · {fmtDateTime(i.at)}</span>
        </div>
      </div>
    </div>
  );
}

export const QuickAction = ({ icon: I, label, onClick, tone }) => (
  <button className="card tap" onClick={onClick}
    style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 0, padding: "12px 13px" }}>
    <I size={17} style={{ color: tone === "red" ? "var(--bad)" : "var(--ink-3)", flexShrink: 0 }} />
    <span style={{ fontSize: 13, fontWeight: 450, color: "var(--ink)", lineHeight: 1.35, textAlign: "left" }}>
      {String(label).replace(/\n/g, " ")}
    </span>
  </button>
);

export const ApproveDeny = ({ onApprove, onDeny }) => (
  <>
    <Btn size="sm" icon={Icons.Check} onClick={onApprove}>Approve</Btn>
    <Btn size="sm" variant="outline" icon={Icons.X} onClick={onDeny}>Deny</Btn>
  </>
);
