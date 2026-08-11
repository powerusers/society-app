/**
 * API client.
 *
 * The app runs in one of two modes. With `VITE_API_URL` set it talks to the
 * real backend; without it, it falls back to the seeded local store so the demo
 * build keeps working with no server at all. `isLive()` is the only thing that
 * decides, and the repository layer in src/data is the only place that asks.
 */

const BASE = (import.meta.env?.VITE_API_URL || "").replace(/\/$/, "");

export const isLive = () => !!BASE;
export const apiBase = () => BASE;

const ACCESS_KEY = "gvs.access.v1";
const REFRESH_KEY = "gvs.refresh.v1";

/* The access token is short-lived and kept in memory; only the refresh token is
   persisted. Both are still reachable from script on this origin — the honest
   fix is httpOnly cookies, which needs the API on the same site. Noted rather
   than pretended away. */
let accessToken = null;
const listeners = new Set();

export const onAuthChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const announce = (reason) => listeners.forEach((fn) => fn(reason));

export const getRefreshToken = () => {
  try { return localStorage.getItem(REFRESH_KEY); } catch { return null; }
};

export function setTokens({ accessToken: a, refreshToken: r }) {
  accessToken = a || null;
  try {
    if (a) sessionStorage.setItem(ACCESS_KEY, a); else sessionStorage.removeItem(ACCESS_KEY);
    if (r) localStorage.setItem(REFRESH_KEY, r); else localStorage.removeItem(REFRESH_KEY);
  } catch { /* private browsing — tokens stay in memory for this tab */ }
}

export function clearTokens() {
  accessToken = null;
  try { sessionStorage.removeItem(ACCESS_KEY); localStorage.removeItem(REFRESH_KEY); } catch { /* ignore */ }
}

/** Restores the in-memory access token after a page reload in the same tab. */
export function primeTokens() {
  try { accessToken = accessToken || sessionStorage.getItem(ACCESS_KEY); } catch { /* ignore */ }
}

export class ApiError extends Error {
  constructor(status, body) {
    const e = body?.error || {};
    super(e.message || `Request failed (${status})`);
    this.status = status;
    this.code = e.code || "error";
    this.details = e.details || null;
  }
  /** Field-level messages from a 422, ready to drop into a form. */
  get fieldErrors() { return this.status === 422 && this.details ? this.details : null; }
}

/* One refresh at a time. Without this, five parallel 401s would each burn a
   refresh token and four of them would fail against the rotation check. */
let refreshing = null;

async function refreshSession() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  refreshing ||= (async () => {
    try {
      const res = await fetch(`${BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) { clearTokens(); announce("expired"); return false; }
      const data = await res.json();
      setTokens(data);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

async function request(method, path, { body, retry = true, signal } = {}) {
  if (!BASE) throw new ApiError(0, { error: { code: "offline", message: "No API is configured" } });

  const res = await fetch(`${BASE}${path}`, {
    method,
    signal,
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // An expired access token is recoverable exactly once per request.
  if (res.status === 401 && retry && getRefreshToken()) {
    if (await refreshSession()) return request(method, path, { body, retry: false, signal });
  }

  if (res.status === 204) return null;

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); }
    catch { throw new ApiError(res.status, { error: { message: "The server sent a malformed response" } }); }
  }

  if (!res.ok) {
    if (res.status === 401) { clearTokens(); announce("expired"); }
    throw new ApiError(res.status, data);
  }
  return data;
}

export const api = {
  get: (path, opts) => request("GET", path, opts),
  post: (path, body, opts) => request("POST", path, { ...opts, body: body ?? {} }),
  patch: (path, body, opts) => request("PATCH", path, { ...opts, body: body ?? {} }),
  del: (path, opts) => request("DELETE", path, opts),

  /** Auth calls deliberately skip the refresh dance. */
  async login(email, password) {
    const data = await request("POST", "/api/auth/login", { body: { email, password }, retry: false });
    setTokens(data);
    announce("login");
    return data;
  },

  async register(payload) {
    return request("POST", "/api/auth/register", { body: payload, retry: false });
  },

  async logout() {
    try { await request("POST", "/api/auth/logout", { body: {}, retry: false }); }
    catch { /* the session is going away regardless */ }
    clearTokens();
    announce("logout");
  },

  /** Restores a session from the stored refresh token on a cold start. */
  async resume() {
    primeTokens();
    if (!getRefreshToken()) return null;
    if (!accessToken && !(await refreshSession())) return null;
    try {
      return await request("GET", "/api/me");
    } catch (err) {
      if (err.status === 401) { clearTokens(); return null; }
      throw err;
    }
  },
};

/**
 * Uploads a file straight to S3 with the presigned POST the API handed back.
 * The bytes never touch our server, so this is a plain form post to the bucket.
 */
export async function uploadToStorage({ url, fields }, file, onProgress) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append("file", file);

  // XHR rather than fetch: it reports upload progress, which fetch still cannot.
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300
      ? resolve()
      : reject(new Error(
        xhr.status === 403
          ? "Storage rejected the file — it may be larger than the limit or the wrong type"
          : `Upload failed (${xhr.status})`,
      )));
    xhr.onerror = () => reject(new Error("Upload failed — check your connection"));
    xhr.send(form);
  });
}
