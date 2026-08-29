/**
 * Session and society context — the React Native port of apps/web/src/store/index.jsx.
 *
 * The web store carries two halves: a seeded local store for demo mode and the
 * server session for live mode. This app is live-only, so the local store, the
 * seed, the collection writers (add/patch/remove) and the `sel` selectors over
 * local data are all gone. What remains is the part that was always real — who
 * is signed in, what they may do, and which society's settings apply.
 *
 * Screens never read this for domain data; they call a hook in ../data.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, onAuthChange } from '../lib/api';

const ANON = { status: 'anon', user: null, flat: null, society: null, capabilities: [] };

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

/* Society defaults, used until /api/me reports the society's own settings. The
   web app keeps these in the seeded store; here they are the fallback for a
   field the server has not set. */
const DEFAULT_SETTINGS = {
  societyName: 'Society',
  address: '',
  regNo: '',
  gstin: '',
  accent: 'indigo',
  overstayMins: 240,
  slaHours: 24,
  bank: null,
};

export function AppProvider({ children }) {
  const [server, setServer] = useState({ ...ANON, status: 'resuming' });
  const [toast, setToast] = useState(null);

  // Cold start: try to resume from the refresh token in AsyncStorage.
  useEffect(() => {
    let alive = true;
    api.resume()
      .then((me) => alive && setServer(me ? { status: 'authed', ...me } : ANON))
      .catch(() => alive && setServer(ANON));
    return () => { alive = false; };
  }, []);

  // The client signs itself out when a refresh token is rejected mid-session.
  useEffect(() => onAuthChange((reason) => {
    if (reason === 'expired' || reason === 'logout') {
      setServer(ANON);
      if (reason === 'expired') {
        setToast({ text: 'Session expired — please sign in again', kind: 'bad', at: Date.now() });
      }
    }
  }), []);

  const me = server.user;
  const role = me?.role || null;
  const booting = server.status === 'resuming';
  const authed = server.status === 'authed' && !!me;

  /* The server states the caller's capabilities. The shared matrix in
     @gvs/shared produces the same answer, but the authoritative copy is the one
     that also gates the requests — so this asks the server's list, exactly as
     the web app does in live mode. */
  const can = useCallback((cap) => server.capabilities.includes(cap), [server.capabilities]);

  const say = useCallback((text, kind = 'ok') => setToast({ text, kind, at: Date.now() }), []);

  const login = useCallback(async (email, password) => {
    try {
      await api.login(email, password);
      setServer({ status: 'authed', ...(await api.get('/api/me')) });
      return { ok: true };
    } catch (error) {
      return { ok: false, error };
    }
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setServer(ANON);
  }, []);

  const refreshMe = useCallback(async () => {
    setServer({ status: 'authed', ...(await api.get('/api/me')) });
  }, []);

  /* Society settings: the server's copy wins where it exists, so overstay limits
     and SLA hours match what the API will actually enforce. */
  const settings = useMemo(() => {
    const soc = server.society;
    if (!soc) return DEFAULT_SETTINGS;
    return {
      ...DEFAULT_SETTINGS,
      ...(soc.settings || {}),
      societyName: soc.name || DEFAULT_SETTINGS.societyName,
      address: soc.address || '',
      regNo: soc.regNo || '',
      gstin: soc.gstin || '',
      bank: soc.bank || null,
    };
  }, [server.society]);

  const value = useMemo(() => ({
    booting, authed, me, role, can, settings, society: server.society, flat: server.flat,
    login, logout, refreshMe, say, toast, setToast,
  }), [booting, authed, me, role, can, settings, server.society, server.flat,
    login, logout, refreshMe, say, toast]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
