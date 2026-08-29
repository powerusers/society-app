/**
 * API client — the React Native port of apps/web/src/lib/api.js.
 *
 * Same surface, same semantics: bearer access token, single-flight refresh, one
 * retry per request on a 401. Two things genuinely differ from the web version.
 *
 *  - There is no demo mode. The web client falls back to a seeded local store
 *    when VITE_API_URL is unset; here the URL is a build constant and every
 *    read goes to the server.
 *  - Storage is asynchronous. localStorage is synchronous, AsyncStorage is not,
 *    and request() needs the refresh token synchronously to decide whether a 401
 *    is worth retrying. So the token is mirrored in memory and AsyncStorage is
 *    only ever written through — primeTokens() loads the mirror once on cold
 *    start, before anything else asks.
 *
 * The access token is kept in memory only. On the web that was a compromise
 * against XSS; here a cold start simply re-derives it from the refresh token,
 * so there is no reason to persist it at all.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';

const BASE = API_URL.replace(/\/$/, '');
const REFRESH_KEY = 'gvs.refresh.v1';

export const isLive = () => !!BASE;
export const apiBase = () => BASE;

let accessToken = null;
let refreshToken = null;
let primed = false;

const listeners = new Set();
export const onAuthChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const announce = (reason) => listeners.forEach((fn) => fn(reason));

/** Synchronous by design — see the note above about the in-memory mirror. */
export const getRefreshToken = () => refreshToken;

export async function setTokens({ accessToken: a, refreshToken: r }) {
  accessToken = a || null;
  refreshToken = r || null;
  try {
    if (r) await AsyncStorage.setItem(REFRESH_KEY, r);
    else await AsyncStorage.removeItem(REFRESH_KEY);
  } catch { /* storage unavailable — the session still works for this launch */ }
}

export async function clearTokens() {
  accessToken = null;
  refreshToken = null;
  try { await AsyncStorage.removeItem(REFRESH_KEY); } catch { /* ignore */ }
}

/** Loads the persisted refresh token into memory. Safe to call more than once. */
export async function primeTokens() {
  if (primed) return;
  primed = true;
  try { refreshToken = await AsyncStorage.getItem(REFRESH_KEY); } catch { /* ignore */ }
}

export class ApiError extends Error {
  constructor(status, body) {
    const e = body?.error || {};
    super(e.message || `Request failed (${status})`);
    this.status = status;
    this.code = e.code || 'error';
    this.details = e.details || null;
  }
  /** Field-level messages from a 422, ready to drop into a form. */
  get fieldErrors() { return this.status === 422 && this.details ? this.details : null; }
}

/* One refresh at a time. Without this, five parallel 401s would each burn a
   refresh token and four of them would fail against the rotation check. */
let refreshing = null;

async function refreshSession() {
  if (!refreshToken) return false;

  refreshing ||= (async () => {
    try {
      const res = await fetch(`${BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) { await clearTokens(); announce('expired'); return false; }
      await setTokens(await res.json());
      return true;
    } catch {
      /* A network failure is not an expired session — leave the token alone so
         the next request can try again once the phone is back on a network. */
      return false;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

async function request(method, path, { body, retry = true, signal, headers } = {}) {
  if (!BASE) throw new ApiError(0, { error: { code: 'offline', message: 'No API is configured' } });

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      signal,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    /* On a phone this is the common failure, not the rare one. fetch rejects
       with a bare TypeError, which would surface as "Network request failed" —
       say something a resident on a lift with no signal can act on. */
    if (err?.name === 'AbortError') throw err;
    throw new ApiError(0, { error: { code: 'offline', message: 'No connection to the society server. Check your network and try again.' } });
  }

  // An expired access token is recoverable exactly once per request.
  if (res.status === 401 && retry && getRefreshToken()) {
    if (await refreshSession()) return request(method, path, { body, retry: false, signal, headers });
  }

  if (res.status === 204) return null;

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); }
    catch { throw new ApiError(res.status, { error: { message: 'The server sent a malformed response' } }); }
  }

  if (!res.ok) {
    if (res.status === 401) { await clearTokens(); announce('expired'); }
    throw new ApiError(res.status, data);
  }
  return data;
}

export const api = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body: body ?? {} }),
  patch: (path, body, opts) => request('PATCH', path, { ...opts, body: body ?? {} }),
  del: (path, opts) => request('DELETE', path, opts),

  /** Auth calls deliberately skip the refresh dance. */
  async login(email, password) {
    const data = await request('POST', '/api/auth/login', { body: { email, password }, retry: false });
    await setTokens(data);
    announce('login');
    return data;
  },

  async register(payload) {
    return request('POST', '/api/auth/register', { body: payload, retry: false });
  },

  /** Whether this instance still needs its society created. */
  async setupStatus() {
    return request('GET', '/api/setup/status', { retry: false });
  },

  /** Societies a resident can apply to. Public — read before anyone has an account. */
  async societies(q = '') {
    return request('GET', `/api/setup/societies${q ? `?q=${encodeURIComponent(q)}` : ''}`, { retry: false });
  },

  /** First-run bootstrap. Signs the new administrator in on success. */
  async setup(payload, token) {
    const data = await request('POST', '/api/setup', {
      body: payload, retry: false, headers: { 'x-setup-token': token },
    });
    await setTokens(data);
    announce('login');
    return data;
  },

  async logout() {
    try { await request('POST', '/api/auth/logout', { body: {}, retry: false }); }
    catch { /* the session is going away regardless */ }
    await clearTokens();
    announce('logout');
  },

  /** Restores a session from the stored refresh token on a cold start. */
  async resume() {
    await primeTokens();
    if (!getRefreshToken()) return null;
    if (!accessToken && !(await refreshSession())) return null;
    try {
      return await request('GET', '/api/me');
    } catch (err) {
      if (err.status === 401) { await clearTokens(); return null; }
      throw err;
    }
  },
};

/**
 * Uploads a file straight to S3 with the presigned POST the API handed back.
 * The bytes never touch our server, so this is a plain form post to the bucket.
 *
 * `file` is React Native's file shape — { uri, name, type } — not a DOM File.
 * The platform reads the uri off disk while building the multipart body.
 */
export async function uploadToStorage({ url, fields }, file, onProgress) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append('file', { uri: file.uri, name: file.name, type: file.type });

  // XHR rather than fetch: it reports upload progress, which fetch still cannot.
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300
      ? resolve()
      : reject(new Error(
        xhr.status === 403
          ? 'Storage rejected the file — it may be larger than the limit or the wrong type'
          : `Upload failed (${xhr.status})`,
      )));
    xhr.onerror = () => reject(new Error('Upload failed — check your connection'));
    xhr.send(form);
  });
}
