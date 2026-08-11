import { useState } from "react";
import Icons from "../icons";
import { Badge, Btn, Avatar, Confirm } from "../components/ui";
import { useApp } from "../store";
import { inr } from "../lib/format";

export default function More({ nav }) {
  const { db, me, role, can, sel, logout, resetDemo } = useApp();
  const [confirm, setConfirm] = useState(null);

  const dues = me.flat ? sel.duesOf(me.flat) : 0;
  const openTickets = db.tickets.filter((t) => t.status !== "closed" && t.status !== "resolved").length;
  const pendingRegs = db.registrations.filter((r) => r.status === "pending").length;
  const draftBills = db.bills.filter((b) => b.status === "pending-approval").length;

  const groups = [
    {
      title: "Your home",
      show: !!me.flat,
      items: [
        { id: "profile", icon: Icons.User, label: "My profile & family" },
        { id: "vehicles", icon: Icons.Car, label: "Vehicles & parking" },
        { id: "dailyHelp", icon: Icons.Users, label: "Daily help & staff" },
        { id: "payments", icon: Icons.Rupee, label: "Bills & payments", badge: dues ? inr(dues) : null, tab: true },
      ],
    },
    {
      title: "Society",
      show: true,
      items: [
        { id: "amenities", icon: Icons.Calendar, label: "Amenities & classes" },
        { id: "helpdesk", icon: Icons.Ticket, label: "Helpdesk", badge: openTickets || null },
        { id: "directory", icon: Icons.Book, label: "Resident directory" },
        { id: "documents", icon: Icons.Folder, label: "Documents" },
        { id: "services", icon: Icons.Tools, label: "Home services" },
        { id: "emergency", icon: Icons.Sos, label: "Emergency & SOS", danger: true },
      ],
    },
    {
      title: "Gate & security",
      show: can("gate.view"),
      items: [
        { id: "guardGate", icon: Icons.Gate, label: "Gate console" },
        { id: "guardCheckin", icon: Icons.Finger, label: "Staff check-in" },
        { id: "guardLog", icon: Icons.Clock, label: "Gate log" },
        { id: "guardPatrol", icon: Icons.Route, label: "Patrolling" },
        { id: "incidents", icon: Icons.AlertTri, label: "Incident register" },
        { id: "walkie", icon: Icons.Radio, label: "Walkie-talkie" },
      ],
    },
    {
      title: "Accounts (ERP)",
      show: can("accounts.view") || can("billing.make"),
      items: [
        { id: "billing", icon: Icons.Doc, label: "Billing & maker-checker", badge: draftBills || null },
        { id: "reconciliation", icon: Icons.Bank, label: "Bank reconciliation" },
        { id: "ledger", icon: Icons.Board, label: "Ledger & expenses" },
        { id: "budget", icon: Icons.Chart, label: "Budget vs actual" },
        { id: "reports", icon: Icons.Pie, label: "Reports & exports" },
      ],
    },
    {
      title: "Administration",
      show: can("resident.approve") || can("staff.manage"),
      items: [
        { id: "dashboard", icon: Icons.Grid, label: "Committee dashboard", tab: true },
        { id: "residents", icon: Icons.Building, label: "Residents & flats", badge: pendingRegs || null },
        { id: "flatRegister", icon: Icons.Upload, label: "Flat register", show: can("settings.write") },
        { id: "staffMgmt", icon: Icons.Shield, label: "Society staff" },
        { id: "audit", icon: Icons.Lock, label: "Audit trail" },
        { id: "settings", icon: Icons.Settings, label: "Society settings" },
      ],
    },
  ];

  return (
    <>
      <div className="card">
        <div className="row">
          <Avatar name={me.name} size="lg" />
          <div className="grow" style={{ marginLeft: 12 }}>
            <p className="h3">{me.name}</p>
            <p className="tiny" style={{ marginTop: 3 }}>
              {me.flat ? `Flat ${me.flat} · ${me.relation || "resident"}` : me.designation || role}
            </p>
            <div className="wrap" style={{ marginTop: 6 }}>
              <Badge color="brand">{role}</Badge>
              {me.designation && <Badge color="blue">{me.designation}</Badge>}
            </div>
          </div>
        </div>
      </div>

      {groups.filter((g) => g.show).map((g) => (
        <div key={g.title}>
          <div className="sect"><h2 className="h2">{g.title}</h2></div>
          <div className="list">
            {/* `show` is optional per item: absent means visible, so only the
                entries that opt into a narrower capability than their group
                are filtered here. */}
            {g.items.filter((it) => it.show !== false).map((it) => (
              <div key={it.id} className="li tap" onClick={() => (it.tab ? nav.switchTab(it.id) : nav.go(it.id))}>
                <div className="ico-tile" style={it.danger ? { background: "var(--red-bg)", color: "var(--red)" } : undefined}>
                  <it.icon size={18} />
                </div>
                <div className="grow"><p className="h4">{it.label}</p></div>
                {it.badge && <Badge color="amber">{it.badge}</Badge>}
                <Icons.Fwd size={15} style={{ color: "var(--ink3)" }} />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="sect"><h2 className="h2">Session</h2></div>
      <div style={{ display: "flex", gap: 9 }}>
        <Btn block variant="ghost" icon={Icons.Refresh} onClick={() => setConfirm("reset")}>Reset demo data</Btn>
        <Btn block variant="danger" icon={Icons.LogOut} onClick={logout}>Sign out</Btn>
      </div>
      <p className="hint center" style={{ marginTop: 14 }}>
        {db.settings.societyName} · {db.settings.flatCount} flats · Reg. {db.settings.regNo}
      </p>

      {confirm === "reset" && (
        <Confirm title="Reset demo data?" danger confirmLabel="Reset everything"
          body="Every change made in this browser — visitors, tickets, bills, bookings — is discarded and the seeded demo society is rebuilt."
          onConfirm={resetDemo} onClose={() => setConfirm(null)} />
      )}
    </>
  );
}
