import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { buildSeed } from "./seed";
import { uid, iso } from "../lib/format";

const DB_KEY = "gvs.db.v4";
const SESSION_KEY = "gvs.session.v4";

const load = () => {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 4) return parsed;
    }
  } catch { /* corrupt storage — fall through to a fresh seed */ }
  return buildSeed();
};

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

/* Role capability matrix. Everything in the app asks `can()` rather than
   testing role strings, so adding a role later stays a one-line change. */
const CAPS = {
  admin: ["*"],
  committee: ["notice.write", "poll.write", "billing.make", "billing.approve", "helpdesk.manage", "resident.approve",
    "amenity.manage", "accounts.view", "accounts.write", "document.write", "staff.manage", "gate.view", "reports.view", "settings.view"],
  staff: ["helpdesk.manage", "billing.make", "gate.view", "document.write", "amenity.manage", "reports.view"],
  guard: ["gate.operate", "incident.write", "patrol.write", "gate.view"],
  resident: [],
};

export function AppProvider({ children }) {
  const [db, setDb] = useState(load);
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
  });
  const [toast, setToast] = useState(null);

  useEffect(() => { localStorage.setItem(DB_KEY, JSON.stringify(db)); }, [db]);
  useEffect(() => {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  }, [session]);

  const me = useMemo(() => db.users.find((u) => u.id === session?.userId) || null, [db.users, session]);
  const role = me?.role || null;

  const can = useCallback((cap) => {
    if (!role) return false;
    const list = CAPS[role] || [];
    return list.includes("*") || list.includes(cap);
  }, [role]);

  /* ---- generic collection writers ---- */
  const setColl = useCallback((coll, fn) => setDb((d) => ({ ...d, [coll]: fn(d[coll] || []) })), []);
  const add = useCallback((coll, item) => {
    const withId = { id: item.id || uid(coll.slice(0, 3)), ...item };
    setColl(coll, (list) => [withId, ...list]);
    return withId;
  }, [setColl]);
  const patch = useCallback((coll, id, changes) =>
    setColl(coll, (list) => list.map((x) => (x.id === id ? { ...x, ...(typeof changes === "function" ? changes(x) : changes) } : x))), [setColl]);
  const remove = useCallback((coll, id) => setColl(coll, (list) => list.filter((x) => x.id !== id)), [setColl]);
  const setSettings = useCallback((changes) => setDb((d) => ({ ...d, settings: { ...d.settings, ...changes } })), []);

  const logAudit = useCallback((action, entity, detail) => {
    setDb((d) => ({
      ...d,
      audit: [{ id: uid("au"), at: iso(), actor: session?.userId || "system", action, entity, detail }, ...d.audit].slice(0, 400),
    }));
  }, [session]);

  const say = useCallback((text, kind = "ok") => setToast({ text, kind, at: Date.now() }), []);

  const login = useCallback((userId) => {
    setSession({ userId, at: iso() });
  }, []);
  const logout = useCallback(() => setSession(null), []);
  const resetDemo = useCallback(() => { setDb(buildSeed()); setSession(null); }, []);

  /* ---- selectors used across screens ---- */
  const sel = useMemo(() => {
    const userById = (id) => db.users.find((u) => u.id === id);
    const flatByCode = (c) => db.flats.find((f) => f.code === c);
    const myFlat = me?.flat || null;
    return {
      userById,
      flatByCode,
      userName: (id) => userById(id)?.name || (id === "system" ? "System" : "—"),
      residentsOf: (code) => db.users.filter((u) => u.flat === code),
      billsOf: (code) => db.bills.filter((b) => b.flatCode === code).sort((a, b) => (a.cycle < b.cycle ? 1 : -1)),
      paymentOf: (billId) => db.payments.find((p) => p.billId === billId),
      duesOf: (code) => db.bills.filter((b) => b.flatCode === code && b.status !== "paid").reduce((s, b) => s + b.total, 0),
      openTicketsOf: (code) => db.tickets.filter((t) => t.flatCode === code && t.status !== "closed"),
      visitorsOf: (code) => db.visitors.filter((v) => v.flatCode === code),
      helpOf: (code) => db.dailyHelp.filter((h) => h.flats.includes(code)),
      vehiclesOf: (code) => db.vehicles.filter((v) => v.flatCode === code),
      bookingsOf: (userId) => db.bookings.filter((b) => b.userId === userId),
      amenity: (id) => db.amenities.find((a) => a.id === id),
      gate: (id) => db.gates.find((g) => g.id === id),
      myFlat,
      pendingForMe: db.visitors.filter((v) => v.status === "pending" && v.flatCode === myFlat),
      totalDues: db.bills.filter((b) => b.status !== "paid").reduce((s, b) => s + b.total, 0),
      collected: (cycle) => db.payments.filter((p) => db.bills.find((b) => b.id === p.billId)?.cycle === cycle).reduce((s, p) => s + p.amount, 0),
      billed: (cycle) => db.bills.filter((b) => b.cycle === cycle).reduce((s, b) => s + b.total, 0),
    };
  }, [db, me]);

  const value = useMemo(() => ({
    db, setDb, me, role, can, session, login, logout, resetDemo,
    add, patch, remove, setColl, setSettings, logAudit, say, toast, setToast, sel,
  }), [db, me, role, can, session, login, logout, resetDemo, add, patch, remove, setColl, setSettings, logAudit, say, toast, sel]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
