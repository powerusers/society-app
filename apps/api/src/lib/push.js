import { GoogleAuth } from "google-auth-library";
import { many, query } from "../db/pool.js";

/**
 * Push notifications, over FCM's HTTP v1 API.
 *
 * Settings are read at call time rather than import time, and an unconfigured
 * deployment simply does not send — the same shape as lib/storage.js. Pushing is
 * an enhancement to a screen that already works by fetching, so a missing
 * service account must never be the reason a visitor cannot be approved.
 *
 * firebase-admin would do this too, but it is a large dependency that pulls in
 * Firestore and Storage clients for one HTTP call. google-auth-library is the
 * part that actually matters: minting an OAuth token from the service account.
 */

function settings() {
  /* Two ways to supply the account. A path suits a local checkout; the inline
     JSON suits Railway, where the filesystem is ephemeral and secrets arrive as
     environment variables. */
  const inline = process.env.FCM_SERVICE_ACCOUNT_JSON || "";
  const file = process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
  return { inline, file, projectId: process.env.FCM_PROJECT_ID || "" };
}

function credentials() {
  const s = settings();
  if (!s.inline) return null;
  try {
    return JSON.parse(s.inline);
  } catch {
    /* A malformed secret is a deployment mistake worth naming loudly once,
       rather than a silent fallback to "push is off". */
    throw new Error("FCM_SERVICE_ACCOUNT_JSON is set but is not valid JSON");
  }
}

export function pushConfigured() {
  const s = settings();
  if (!s.inline && !s.file) return false;
  const c = s.inline ? credentials() : null;
  return !!(s.projectId || c?.project_id);
}

let cached = { key: null, auth: null, projectId: null };

function client() {
  const s = settings();
  const creds = credentials();
  const projectId = s.projectId || creds?.project_id;
  if (!projectId) throw new Error("FCM project id is not configured");

  const key = `${projectId}|${s.file}|${creds?.client_email || ""}`;
  if (cached.key === key) return cached;

  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
    ...(creds ? { credentials: creds } : {}),
    ...(s.file && !creds ? { keyFile: s.file } : {}),
  });

  cached = { key, auth, projectId };
  return cached;
}

/**
 * FCM answers per message, and some failures mean the token is dead rather than
 * that the send was wrong. Those are worth forgetting: an uninstalled app leaves
 * a token that fails forever, and a household that changes phones every two
 * years would otherwise accumulate them.
 */
const DEAD_TOKEN_CODES = new Set([
  "UNREGISTERED",
  "INVALID_ARGUMENT",
  "SENDER_ID_MISMATCH",
]);

async function forget(tokens) {
  if (!tokens.length) return;
  await query("DELETE FROM device_tokens WHERE token = ANY($1)", [tokens]);
}

/**
 * Sends one message to one token. Returns the FCM error status when the token
 * should be forgotten, or null on success or a transient failure.
 */
async function sendOne(accessToken, projectId, token, message) {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ message: { ...message, token } }),
  });

  if (res.ok) return null;

  let body = null;
  try { body = await res.json(); } catch { /* FCM returned something unparseable */ }
  const status = body?.error?.details?.find((d) => d.errorCode)?.errorCode
    || body?.error?.status
    || `HTTP_${res.status}`;

  return DEAD_TOKEN_CODES.has(status) ? status : null;
}

/**
 * The devices a message may go to.
 *
 * Extracted and exported because this is the query that decides who reads a
 * resident's gate request. It is the privacy boundary of the whole feature, so
 * it is a named thing with a test against it rather than a subquery buried
 * inside a function whose failures are all swallowed.
 *
 * Two filters, both deliberate:
 *  - `u.status = 'active'` — a suspended member's phone stops receiving. Their
 *    row is still there; being suspended should not mean still being told who is
 *    at the gate.
 *  - the `notify` preference — a jsonb map where absent means on, so a resident
 *    who has never opened the profile screen still hears about somebody at their
 *    gate. Only an explicit `false` excludes them.
 *
 * Note what is *not* here: any notion of a flat. Scoping to a household happens
 * before this, in usersInFlat(), and this function trusts the ids it is handed.
 */
export async function recipientTokens(userIds, pref = null) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return [];

  const params = [ids];
  let prefFilter = "";
  if (pref) {
    params.push(pref);
    prefFilter = ` AND COALESCE(u.notify ->> $${params.length}, 'true') <> 'false'`;
  }

  const rows = await many(
    `SELECT d.token
       FROM device_tokens d
       JOIN users u ON u.id = d.user_id
      WHERE d.user_id = ANY($1) AND u.status = 'active'${prefFilter}`,
    params,
  );
  return rows.map((r) => r.token);
}

/**
 * Delivers to every device belonging to `userIds`.
 *
 * Never throws. A gate request that reaches the database but fails to push has
 * still been recorded, and the resident's app will show it on the next fetch —
 * turning that into a 500 would fail the write that mattered.
 *
 * `data` values must be strings: FCM rejects a data payload with any other type,
 * which is an easy thing to get wrong with a visitor id that happens to be a
 * number, so everything is coerced here rather than at each call site.
 */
export async function sendToUsers(
  userIds,
  { title, body, data = {}, channelId = "default", pref = null, dataOnly = false },
) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return { sent: 0, skipped: "no-recipients" };
  if (!pushConfigured()) return { sent: 0, skipped: "not-configured" };

  const tokens = await recipientTokens(ids, pref);
  if (!tokens.length) return { sent: 0, skipped: "no-devices" };

  const stringData = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => [k, String(v)]),
  );

  /**
   * Data-only when the app must handle it itself.
   *
   * A message carrying a `notification` block is drawn by the Android system
   * before any of the app's code runs, and its background handler is never
   * called — which means no full-screen intent, and no ringing a locked phone
   * into the approval screen. Gate requests are therefore sent as data-only, and
   * PranganMessagingService builds the notification on the device.
   *
   * The cost is that a force-stopped app receives nothing: Android will not
   * restart a process the user explicitly killed. That applies to every app, and
   * the request is still waiting when they next open Prangan.
   */
  const message = dataOnly
    ? {
      /* title and body ride in the data payload instead, because the device is
         now the thing that renders them. */
      data: { ...stringData, title, body },
      android: {
        priority: "high",
        /* Tells FCM this is worth delivering through Doze rather than batching
           it until the next maintenance window. Without it a locked, idle phone
           can hold a gate request for minutes. */
        direct_boot_ok: true,
      },
    }
    : {
      notification: { title, body },
      data: stringData,
      android: {
        /* A visitor standing at the gate is time-critical, so this is allowed to
           wake a dozing device. Everything else can wait for the next window. */
        priority: channelId === "gate" ? "high" : "normal",
        notification: {
          channelId,
          sound: "default",
          /* Collapsing on the visitor keeps a re-send from stacking duplicates of
             the same person in the shade. */
          tag: stringData.visitorId || undefined,
        },
      },
    };

  try {
    const { auth, projectId } = client();
    const accessToken = await auth.getAccessToken();

    const results = await Promise.all(
      tokens.map(async (t) => {
        try { return { token: t, dead: await sendOne(accessToken, projectId, t, message) }; }
        catch { return { token: t, dead: null }; }
      }),
    );

    const dead = results.filter((r) => r.dead).map((r) => r.token);
    await forget(dead);
    return { sent: tokens.length - dead.length, pruned: dead.length };
  } catch (err) {
    /* Logged, not raised — see the note above about never failing the write. */
    console.error("[push] send failed:", err.message);
    return { sent: 0, error: err.message };
  }
}

/** Everyone who lives in a flat, for fanning a gate request out to the household. */
export async function usersInFlat(societyId, flatId) {
  const rows = await many(
    `SELECT id FROM users
      WHERE society_id = $1 AND flat_id = $2 AND status = 'active'`,
    [societyId, flatId],
  );
  return rows.map((r) => r.id);
}
