import { useMemo } from "react";
import Icons from "../../icons";
import { Badge, Btn, Stat, Alert, Empty } from "../../components/ui";
import { QuickAction } from "../../components/entities";
import { useApp } from "../../store";
import { useAmenities } from "../../data/amenities";
import { inr, lakh, pct, cycleLabel, thisCycle, ago, until, fmtDate, minsBetween } from "../../lib/format";

export default function AdminDashboard({ nav }) {
  const { db, me, can, sel } = useApp();
  const { bookings, pending: pendingBookings } = useAmenities();
  const cycle = thisCycle();

  const billed = sel.billed(cycle);
  const collected = sel.collected(cycle);
  const outstanding = sel.totalDues;
  const drafts = db.bills.filter((b) => b.status === "pending-approval");
  const pendingRegs = db.registrations.filter((r) => r.status === "pending");
  const liveTickets = db.tickets.filter((t) => t.status === "open" || t.status === "in-progress");
  const breached = liveTickets.filter((t) => until(t.slaDueAt).late);
  const openIncidents = db.incidents.filter((i) => i.status === "open");
  const insideNow = db.visitors.filter((v) => v.status === "inside");
  const unreconciled = db.payments.filter((p) => !p.reconciled);

  const income = db.ledger.filter((l) => l.type === "income" && l.date.slice(0, 7) === cycle).reduce((s, l) => s + l.amount, 0);
  const expense = db.ledger.filter((l) => l.type === "expense" && l.date.slice(0, 7) === cycle).reduce((s, l) => s + l.amount, 0);

  const actions = useMemo(() => [
    drafts.length && { icon: Icons.Lock, label: `${drafts.length} bill${drafts.length > 1 ? "s" : ""} awaiting approval`, note: "Maker-checker — treasurer sign-off pending", to: "billing", tone: "purple" },
    breached.length && { icon: Icons.AlertTri, label: `${breached.length} ticket${breached.length > 1 ? "s" : ""} past SLA`, note: "Residents can see the same clock", to: "helpdesk", tone: "red" },
    pendingRegs.length && { icon: Icons.UserPlus, label: `${pendingRegs.length} registration${pendingRegs.length > 1 ? "s" : ""} to verify`, note: "New owners and tenants awaiting access", to: "residents", tone: "amber" },
    openIncidents.length && { icon: Icons.Shield, label: `${openIncidents.length} open incident${openIncidents.length > 1 ? "s" : ""}`, note: "Recorded by guards at the gate", to: "incidents", tone: "red" },
    pendingBookings.length && { icon: Icons.Calendar, label: `${pendingBookings.length} amenity request${pendingBookings.length > 1 ? "s" : ""}`, note: "Clubhouse and lawn need approval", to: "amenities", tone: "blue" },
    unreconciled.length && { icon: Icons.Bank, label: `${unreconciled.length} receipt${unreconciled.length > 1 ? "s" : ""} unreconciled`, note: "Import the MT940 statement to auto-match", to: "reconciliation", tone: "amber" },
  ].filter(Boolean), [drafts, breached, pendingRegs, openIncidents, pendingBookings, unreconciled]);

  return (
    <>
      <div className="panel">
        <p className="sub" style={{ fontSize: 12, margin: 0 }}>Collections · {cycleLabel(cycle)}</p>
        <div className="row top" style={{ marginTop: 4 }}>
          <div>
            <p className="h1">{lakh(collected)}</p>
            <p className="sub" style={{ fontSize: 12, margin: "2px 0 0" }}>of {lakh(billed)} billed</p>
          </div>
          <div className="right">
            <p className="num" style={{ color: "#fff" }}>{pct(collected, billed)}%</p>
            <p className="sub" style={{ fontSize: 11, margin: 0 }}>collected</p>
          </div>
        </div>
        <div className="bar" style={{ marginTop: 12, background: "rgba(255,255,255,.25)" }}>
          <i style={{ width: `${pct(collected, billed)}%`, background: "#fff" }} />
        </div>
      </div>

      <div className="grid3">
        <Stat value={lakh(outstanding)} label="Outstanding" color="var(--red)" onClick={() => nav.go("reports")} />
        <Stat value={lakh(income - expense)} label="Surplus" color={income >= expense ? "var(--green)" : "var(--red)"} onClick={() => nav.go("ledger")} />
        <Stat value={insideNow.length} label="Inside now" color="var(--brand)" onClick={() => nav.switchTab("visitors")} />
      </div>

      {actions.length > 0 && (
        <>
          <div className="sect"><h2 className="h2">Needs your attention</h2></div>
          <div className="list">
            {actions.map((a) => (
              <div key={a.label} className="li tap" onClick={() => nav.go(a.to)}>
                <div className={`ico-tile ${a.tone}`}><a.icon size={18} /></div>
                <div className="grow">
                  <p className="h4">{a.label}</p>
                  <p className="tiny" style={{ marginTop: 2 }}>{a.note}</p>
                </div>
                <Icons.Fwd size={15} style={{ color: "var(--ink3)" }} />
              </div>
            ))}
          </div>
        </>
      )}
      {!actions.length && (
        <Alert kind="ok" icon={Icons.CheckCircle}>Nothing is waiting on the committee right now — bills approved, tickets within SLA, no open incidents.</Alert>
      )}

      <div className="sect"><h2 className="h2">Manage</h2></div>
      <div className="grid2">
        <QuickAction icon={Icons.Doc} label={"Billing &\nmaker-checker"} onClick={() => nav.go("billing")} />
        <QuickAction icon={Icons.Bank} label={"Bank\nreconciliation"} onClick={() => nav.go("reconciliation")} />
        <QuickAction icon={Icons.Board} label={"Ledger &\nexpenses"} onClick={() => nav.go("ledger")} />
        <QuickAction icon={Icons.Chart} label={"Budget vs\nactual"} onClick={() => nav.go("budget")} />
        <QuickAction icon={Icons.Pie} label={"Reports &\nexports"} onClick={() => nav.go("reports")} />
        <QuickAction icon={Icons.Building} label={"Residents\n& flats"} onClick={() => nav.go("residents")} />
        <QuickAction icon={Icons.Ticket} label={"Helpdesk\nqueue"} onClick={() => nav.go("helpdesk")} />
        <QuickAction icon={Icons.Shield} label={"Society\nstaff"} onClick={() => nav.go("staffMgmt")} />
      </div>

      <div className="sect"><h2 className="h2">This cycle at a glance</h2></div>
      <div className="card">
        <div className="row"><span className="muted">Income booked</span><b style={{ color: "var(--green)" }}>{inr(income)}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Expenses booked</span><b style={{ color: "var(--red)" }}>{inr(expense)}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Tickets resolved</span><b>{db.tickets.filter((t) => t.resolvedAt && t.resolvedAt.slice(0, 7) === cycle).length}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Visitors logged</span><b>{db.visitors.length}</b></div>
        <div className="hairline" />
        <div className="row"><span className="muted">Amenity bookings</span><b>{bookings.length}</b></div>
      </div>

      <div className="sect">
        <h2 className="h2">Recent activity</h2>
        <button className="linkbtn" onClick={() => nav.go("audit")}>Audit trail →</button>
      </div>
      <div className="tl">
        {db.audit.slice(0, 6).map((a) => (
          <div key={a.id} className="tl-i">
            <p className="h4">{a.entity}</p>
            <p className="tiny" style={{ marginTop: 2 }}>{a.detail}</p>
            <p className="tiny" style={{ marginTop: 2 }}>{sel.userName(a.actor)} · {ago(a.at)}</p>
          </div>
        ))}
        {!db.audit.length && <Empty icon={Icons.Lock} title="No activity logged" />}
      </div>
    </>
  );
}
