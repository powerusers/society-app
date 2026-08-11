import { useCallback, useEffect, useMemo, useState } from "react";
import { CSS, ACCENTS, applyAccent } from "./styles";
import Icons from "./icons";
import { AppProvider, useApp } from "./store";
import { Toast } from "./components/ui";
import { useVisitors } from "./data/visitors";
import { useTickets } from "./data/tickets";

import Login from "./screens/Login";
import Home from "./screens/Home";
import Community from "./screens/Community";
import Visitors from "./screens/Visitors";
import Payments from "./screens/Payments";
import More from "./screens/More";
import Amenities from "./screens/Amenities";
import Helpdesk from "./screens/Helpdesk";
import Directory from "./screens/Directory";
import Documents from "./screens/Documents";
import Services from "./screens/Services";
import DailyHelp from "./screens/DailyHelp";
import Vehicles from "./screens/Vehicles";
import Emergency from "./screens/Emergency";
import Profile from "./screens/Profile";

import GuardGate from "./screens/guard/GuardGate";
import GuardCheckin from "./screens/guard/GuardCheckin";
import GuardPatrol from "./screens/guard/GuardPatrol";
import GuardLog from "./screens/guard/GuardLog";
import Incidents from "./screens/guard/Incidents";
import Walkie from "./screens/guard/Walkie";

import AdminDashboard from "./screens/admin/AdminDashboard";
import Billing from "./screens/admin/Billing";
import Reconciliation from "./screens/admin/Reconciliation";
import Ledger from "./screens/admin/Ledger";
import Budget from "./screens/admin/Budget";
import Reports from "./screens/admin/Reports";
import Audit from "./screens/admin/Audit";
import Residents from "./screens/admin/Residents";
import StaffMgmt from "./screens/admin/StaffMgmt";
import SocietySettings from "./screens/admin/SocietySettings";

/** name -> { title, comp, hideHeaderTitle } */
const SCREENS = {
  home: { title: "Home", comp: Home },
  community: { title: "Community", comp: Community },
  visitors: { title: "Visitors & Gate", comp: Visitors },
  payments: { title: "Payments", comp: Payments },
  more: { title: "More", comp: More },
  amenities: { title: "Amenities & Classes", comp: Amenities },
  helpdesk: { title: "Helpdesk", comp: Helpdesk },
  directory: { title: "Resident Directory", comp: Directory },
  documents: { title: "Documents", comp: Documents },
  services: { title: "Home Services", comp: Services },
  dailyHelp: { title: "Daily Help & Staff", comp: DailyHelp },
  vehicles: { title: "Vehicles & Parking", comp: Vehicles },
  emergency: { title: "Emergency", comp: Emergency },
  profile: { title: "My Profile", comp: Profile },

  guardGate: { title: "Gate", comp: GuardGate },
  guardCheckin: { title: "Staff Check-in", comp: GuardCheckin },
  guardPatrol: { title: "Patrolling", comp: GuardPatrol },
  guardLog: { title: "Gate Log", comp: GuardLog },
  incidents: { title: "Incidents", comp: Incidents },
  walkie: { title: "Walkie-Talkie", comp: Walkie },

  dashboard: { title: "Committee Dashboard", comp: AdminDashboard },
  billing: { title: "Billing", comp: Billing },
  reconciliation: { title: "Bank Reconciliation", comp: Reconciliation },
  ledger: { title: "Ledger", comp: Ledger },
  budget: { title: "Budget vs Actual", comp: Budget },
  reports: { title: "Reports", comp: Reports },
  audit: { title: "Audit Trail", comp: Audit },
  residents: { title: "Residents & Flats", comp: Residents },
  staffMgmt: { title: "Society Staff", comp: StaffMgmt },
  settings: { title: "Society Settings", comp: SocietySettings },
};

const TABS = {
  resident: [
    { id: "home", icon: Icons.Home, label: "Home" },
    { id: "community", icon: Icons.Board, label: "Community" },
    { id: "visitors", icon: Icons.Gate, label: "Gate" },
    { id: "payments", icon: Icons.Rupee, label: "Payments" },
    { id: "more", icon: Icons.Grid, label: "More" },
  ],
  committee: [
    { id: "home", icon: Icons.Home, label: "Home" },
    { id: "community", icon: Icons.Board, label: "Community" },
    { id: "visitors", icon: Icons.Gate, label: "Gate" },
    { id: "dashboard", icon: Icons.Chart, label: "Manage" },
    { id: "more", icon: Icons.Grid, label: "More" },
  ],
  staff: [
    { id: "helpdesk", icon: Icons.Ticket, label: "Tickets" },
    { id: "dailyHelp", icon: Icons.Users, label: "Staff" },
    { id: "guardGate", icon: Icons.Gate, label: "Gate" },
    { id: "more", icon: Icons.Grid, label: "More" },
  ],
  guard: [
    { id: "guardGate", icon: Icons.Gate, label: "Gate" },
    { id: "guardCheckin", icon: Icons.Finger, label: "Check-in" },
    { id: "guardPatrol", icon: Icons.Route, label: "Patrol" },
    { id: "guardLog", icon: Icons.Clock, label: "Log" },
    { id: "more", icon: Icons.Grid, label: "More" },
  ],
};
TABS.admin = TABS.committee;

function Shell() {
  const { me, role, db, sel, toast, setToast, logout, add, say, logAudit } = useApp();
  /* The shell owns the badge counts so they stay right on every tab, not only
     on whichever screen happens to be open. */
  const { visitors } = useVisitors();
  const { tickets } = useTickets();
  const rootTab = role === "guard" ? "guardGate" : role === "staff" ? "helpdesk" : "home";
  const [tab, setTab] = useState(rootTab);
  const [stack, setStack] = useState([]);
  const [sos, setSos] = useState(false);

  const go = useCallback((name, params = {}) => setStack((s) => [...s, { name, params }]), []);
  const back = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const switchTab = useCallback((id) => { setStack([]); setTab(id); }, []);

  const current = stack.length ? stack[stack.length - 1] : { name: tab, params: {} };
  const meta = SCREENS[current.name] || SCREENS.home;
  const Screen = meta.comp;
  const tabs = TABS[role] || TABS.resident;

  const nav = useMemo(() => ({ go, back, tab, switchTab, depth: stack.length }), [go, back, tab, switchTab, stack.length]);

  const pendingVisitors = visitors.filter((v) => v.status === "pending" && v.flatCode === me.flat).length;
  const unreadNotices = db.notices.filter((n) => !(n.readBy || []).includes(me.id)).length;
  const openTickets = tickets.filter((t) => t.status === "open" || t.status === "in-progress").length;
  const waitingAtGate = visitors.filter((v) => v.status === "waiting" || v.status === "pending").length;

  const pipFor = (id) => {
    if (id === "visitors") return pendingVisitors;
    if (id === "community") return unreadNotices;
    if (id === "helpdesk") return role === "staff" ? tickets.filter((t) => t.assignedTo === me.id && t.status !== "closed").length : openTickets;
    if (id === "guardGate") return waitingAtGate;
    return 0;
  };

  const raiseSos = () => {
    setSos(true);
    add("sos", { by: me.id, flatCode: me.flat || "Gate", at: new Date().toISOString(), kind: "panic", status: "active" });
    logAudit("sos.raise", me.flat || me.name, "Panic alert broadcast to all gates and the committee");
  };

  return (
    <div className="app">
      <div className="hdr">
        <div className="hdr-row">
          {stack.length > 0 && (
            <button className="iconbtn ghost" onClick={back} aria-label="Back"><Icons.Back size={20} /></button>
          )}
          <div className="grow">
            <h1>{stack.length ? meta.title : db.settings.societyName}</h1>
            <p className="sub">
              {stack.length
                ? `${me.name}${me.flat ? ` · ${me.flat}` : ""}`
                : `${me.name} · ${me.flat || me.designation || (role === "guard" ? "Main Gate" : "Staff")}`}
            </p>
          </div>
          {role !== "guard" && (
            <button className="iconbtn alarm" onClick={raiseSos} aria-label="Emergency SOS">
              <Icons.Sos size={19} />
            </button>
          )}
          <button className="iconbtn" onClick={() => switchTab(role === "guard" ? "guardGate" : "community")} aria-label="Notifications">
            <Icons.Bell size={19} />
            {(unreadNotices > 0 || pendingVisitors > 0) && <span className="dot" />}
          </button>
          <button className="iconbtn" onClick={logout} aria-label="Sign out"><Icons.LogOut size={18} /></button>
        </div>
      </div>

      <div className="body">
        <Screen nav={nav} params={current.params} />
      </div>

      <div className="nav">
        {tabs.map((t) => {
          const n = pipFor(t.id);
          return (
            <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => switchTab(t.id)}>
              <t.icon size={21} />
              <span>{t.label}</span>
              {n > 0 && <span className="pip">{n > 9 ? "9+" : n}</span>}
            </button>
          );
        })}
      </div>

      {sos && <SosOverlay onClose={() => { setSos(false); say("Emergency alert closed."); }} db={db} />}
      <Toast toast={toast} onHide={() => setToast(null)} />
    </div>
  );
}

function SosOverlay({ onClose, db }) {
  return (
    <div className="sos">
      <Icons.Sos size={72} style={{ marginBottom: 16, animation: "ring 1s infinite" }} />
      <h1 className="h1" style={{ fontSize: 26 }}>Emergency alert sent</h1>
      <p style={{ maxWidth: 300, marginTop: 10, opacity: .9, lineHeight: 1.5 }}>
        All {db.gates.length} gate devices, the guard on duty and every committee member have been alerted with your flat number and location.
      </p>
      <div style={{ marginTop: 26, display: "grid", gap: 9, width: "100%", maxWidth: 300 }}>
        {db.emergencyContacts.slice(0, 3).map((c) => (
          <a key={c.id} href={`tel:${c.phone}`} className="btn white block" style={{ textDecoration: "none" }}>
            <Icons.Phone size={16} /> {c.name}
          </a>
        ))}
      </div>
      <button className="btn" style={{ marginTop: 22, background: "rgba(255,255,255,.2)" }} onClick={onClose}>I'm safe — close alert</button>
    </div>
  );
}

function Root() {
  const { me, booting, db } = useApp();
  /* The accent is a society setting, not a constant — the app is not themed
     after whatever the society happens to be called. */
  useEffect(() => { applyAccent(db.settings.accent); }, [db.settings.accent]);
  if (booting) return <Booting />;
  return me ? <Shell /> : <Login />;
}

/** Shown only while a stored session is being resumed against the API. */
function Booting() {
  return (
    <div className="app" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div className="center">
        <div style={{ width: 52, height: 52, borderRadius: "var(--r-lg)", background: "var(--accent-soft)", color: "var(--b600)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
          <Icons.Building size={24} />
        </div>
        <p className="muted">Restoring your session…</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <style>{CSS}</style>
      <AppProvider><Root /></AppProvider>
    </>
  );
}
