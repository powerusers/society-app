import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { can as canDo } from "@gvs/shared";
import { buildSeed, emptyStore } from "./seed";
import { uid, iso } from "../lib/format";
import { api, isLive, onAuthChange, clearTokens } from "../lib/api";

/* Separate keys per mode. A browser that has run the demo must not hand its
   seeded Green Valley store to a live deployment on the next visit — which is
   exactly what one shared key would do. */
const DB_KEY = (live) => (live ? "gvs.db.live.v1" : "gvs.db.v4");
const SESSION_KEY = "gvs.session.v4";

/**
 * Demo mode starts from the seeded society. Live mode starts empty: the screens
 * still reading this store have no endpoint yet, and showing a real society
 * another society's notices, ledger and resident list is worse than showing it
 * nothing.
 */
const load = (live) => {
  const fresh = () => (live ? emptyStore() : buildSeed());
  try {
    const raw = localStorage.getItem(DB_KEY(live));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 4) return parsed;
    }
  } catch { /* corrupt storage — fall through */ }
  return fresh();
};

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

/**
 * Holds both halves of the app during the migration.
 *
 * The local seeded store still backs every screen that has no endpoint yet. When
 * `VITE_API_URL` is set, identity and the migrated resources come from the API
 * instead; the repository hooks in src/data are the only place that branches.
 */
export function AppProvider({ children }) {
  const live = isLive();

  const [db, setDb] = useState(() => load(live));
  const [toast, setToast] = useState(null);

  /* --- demo-mode session: a user id into the local store --- */
  const [localSession, setLocalSession] = useState(() => {
    if (live) return null;
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
  });

  /* --- live-mode session: whatever /api/me says --- */
  const [server, setServer] = useState({
    status: live ? "resuming" : "demo", user: null, flat: null, society: null, capabilities: [],
  });

  useEffect(() => { localStorage.setItem(DB_KEY(live), JSON.stringify(db)); }, [db, live]);

  useEffect(() => {
    if (live) return;
    if (localSession) localStorage.setItem(SESSION_KEY, JSON.stringify(localSession));
    else localStorage.removeItem(SESSION_KEY);
  }, [live, localSession]);

  // Cold start in live mode: try to resume from the stored refresh token.
  useEffect(() => {
    if (!live) return;
    let alive = true;
    api.resume()
      .then((me) => alive && setServer(me
        ? { status: "authed", ...me }
        : { status: "anon", user: null, flat: null, society: null, capabilities: [] }))
      .catch(() => alive && setServer({ status: "anon", user: null, flat: null, society: null, capabilities: [] }));
    return () => { alive = false; };
  }, [live]);

  // The client signs itself out when a refresh token is rejected mid-session.
  useEffect(() => onAuthChange((reason) => {
    if (reason === "expired" || reason === "logout") {
      setServer({ status: "anon", user: null, flat: null, society: null, capabilities: [] });
      if (reason === "expired") setToast({ text: "Session expired — please sign in again", kind: "bad", at: Date.now() });
    }
  }), []);

  const localMe = useMemo(
    () => (live ? null : db.users.find((u) => u.id === localSession?.userId) || null),
    [live, db.users, localSession],
  );

  const me = live ? server.user : localMe;
  const role = me?.role || null;
  const booting = live && server.status === "resuming";

  /* In live mode the server states the caller's capabilities; the shared matrix
     produces the same answer, but the authoritative copy is the one that also
     gates the requests. */
  const can = useCallback(
    (cap) => (live ? server.capabilities.includes(cap) : canDo(role, cap)),
    [live, server.capabilities, role],
  );

  /* ---- local collection writers (demo data and not-yet-migrated screens) ---- */
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
    // Live writes are audited server-side; this only records local demo activity.
    if (live) return;
    setDb((d) => ({
      ...d,
      audit: [{ id: uid("au"), at: iso(), actor: localSession?.userId || "system", action, entity, detail }, ...d.audit].slice(0, 400),
    }));
  }, [live, localSession]);

  const say = useCallback((text, kind = "ok") => setToast({ text, kind, at: Date.now() }), []);

  const login = useCallback(async (arg, password) => {
    if (!live) { setLocalSession({ userId: arg, at: iso() }); return { ok: true }; }
    try {
      await api.login(arg, password);
      const me = await api.get("/api/me");
      setServer({ status: "authed", ...me });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err };
    }
  }, [live]);

  const logout = useCallback(async () => {
    if (!live) { setLocalSession(null); return; }
    await api.logout();
    setServer({ status: "anon", user: null, flat: null, society: null, capabilities: [] });
  }, [live]);

  const refreshMe = useCallback(async () => {
    if (!live) return;
    const me = await api.get("/api/me");
    setServer({ status: "authed", ...me });
  }, [live]);

  const resetDemo = useCallback(() => {
    /* Re-seeding a live deployment would put another society's data back in
       front of a real one, which is the thing this mode exists to avoid. */
    setDb(live ? emptyStore() : buildSeed());
    if (live) { clearTokens(); setServer({ status: "anon", user: null, flat: null, society: null, capabilities: [] }); }
    else setLocalSession(null);
  }, [live]);

  /* Society settings: the server's copy wins where it exists, so overstay limits
     and SLA hours match what the API will actually enforce. */
  const settings = useMemo(() => {
    if (!live || !server.society) return db.settings;
    return {
      ...db.settings,
      ...(server.society.settings || {}),
      societyName: server.society.name,
      address: server.society.address,
      regNo: server.society.regNo,
      gstin: server.society.gstin,
      bank: server.society.bank || db.settings.bank,
    };
  }, [live, server.society, db.settings]);

  const scopedDb = useMemo(() => ({ ...db, settings }), [db, settings]);

  /* ---- selectors over the local store ---- */
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
    live, booting, db: scopedDb, setDb, me, role, can, login, logout, refreshMe, resetDemo,
    add, patch, remove, setColl, setSettings, logAudit, say, toast, setToast, sel,
  }), [live, booting, scopedDb, me, role, can, login, logout, refreshMe, resetDemo,
    add, patch, remove, setColl, setSettings, logAudit, say, toast, sel]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
