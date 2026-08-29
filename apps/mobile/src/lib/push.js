import { PermissionsAndroid, Platform } from 'react-native';
import { api } from './api';

/**
 * Push notifications.
 *
 * Every entry point here is guarded, because Firebase is optional. Without
 * google-services.json the app builds and runs (see android/app/build.gradle),
 * but the native Firebase module has no default app and throws the moment it is
 * touched. Treating that as "push is unavailable" rather than letting it crash
 * is the difference between an unconfigured deployment losing notifications and
 * an unconfigured deployment losing the gate screen.
 *
 * Push is a wake-up, never the source of truth. The approval prompt is driven by
 * what the server says in ../data/approvals.jsx; a message only makes it arrive
 * now instead of on the next poll. That means a dropped, delayed or duplicated
 * notification cannot desynchronise the app — which matters, because FCM
 * guarantees none of those things.
 */

let messagingModule;
let unavailableReason = null;

/** Loads the native module once, tolerating its absence. */
function messaging() {
  if (messagingModule !== undefined) return messagingModule;
  try {
    // eslint-disable-next-line global-require
    const mod = require('@react-native-firebase/messaging').default;
    /* Touching .app is what actually throws when there is no google-services.json;
       requiring the module on its own succeeds. */
    mod().app;
    messagingModule = mod;
  } catch (err) {
    unavailableReason = err?.message || 'Firebase is not configured in this build';
    messagingModule = null;
  }
  return messagingModule;
}

export const pushAvailable = () => !!messaging();
export const pushUnavailableReason = () => unavailableReason;

/* ------------------------------------------------------------- listeners -- */

const listeners = new Set();

/** Subscribe to incoming pushes. Returns an unsubscribe function. */
export function onPushMessage(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const emit = (message) => listeners.forEach((fn) => {
  try { fn(message); } catch { /* one bad subscriber must not stop the others */ }
});

/* ----------------------------------------------------------- permission --- */

/**
 * Asks for notification permission.
 *
 * Two separate systems: Android 13+ has a runtime permission, and FCM has its
 * own authorisation state that must be requested regardless. Both are asked, and
 * either refusing means no notifications.
 */
export async function requestPushPermission() {
  const m = messaging();
  if (!m) return false;

  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) return false;
  }

  const status = await m().requestPermission();
  const { AUTHORIZED, PROVISIONAL } = m.AuthorizationStatus;
  return status === AUTHORIZED || status === PROVISIONAL;
}

/* ---------------------------------------------------------- registration -- */

let currentToken = null;

/**
 * Registers this device for the signed-in user, and keeps it registered.
 *
 * Returns an unsubscribe function that also tears down the token-refresh
 * listener, so signing out and back in as somebody else does not leave the
 * previous session's listener re-registering the old user.
 */
export async function registerDevice() {
  const m = messaging();
  if (!m) return () => {};

  const allowed = await requestPushPermission();
  if (!allowed) return () => {};

  const send = async (token) => {
    if (!token) return;
    currentToken = token;
    try {
      await api.post('/api/devices', { token, platform: Platform.OS });
    } catch {
      /* A failed registration is not worth a toast. The resident did not ask for
         this, the app still works, and the next launch tries again. */
    }
  };

  try {
    await send(await m().getToken());
  } catch { /* no network, or FCM unreachable — retried on next launch */ }

  /* FCM rotates tokens on its own schedule: app data cleared, restore to a new
     device, or its own housekeeping. Without this the device silently stops
     receiving, and nothing in the app would look wrong. */
  return m().onTokenRefresh(send);
}

/** Drops this device on sign-out, so the next person does not get these alerts. */
export async function unregisterDevice() {
  const m = messaging();
  if (!m || !currentToken) return;
  try {
    await api.del('/api/devices', { body: { token: currentToken } });
  } catch { /* the session is going away regardless */ }
  currentToken = null;
}

/* -------------------------------------------------------------- delivery -- */

/**
 * Starts listening. Call once, from the provider that owns the approval prompt.
 *
 * Three ways a message reaches a running app, and all three matter:
 *   onMessage             — app is open and in front
 *   onNotificationOpenedApp — app was backgrounded, user tapped the notification
 *   getInitialNotification  — app was closed, tap is what launched it
 *
 * Only the first two are subscriptions; the third is a one-shot read.
 */
export function startPushListeners() {
  const m = messaging();
  if (!m) return () => {};

  const subs = [
    m().onMessage(async (msg) => emit({ ...msg, opened: false })),
    m().onNotificationOpenedApp((msg) => emit({ ...msg, opened: true })),
  ];

  m().getInitialNotification()
    .then((msg) => { if (msg) emit({ ...msg, opened: true, cold: true }); })
    .catch(() => {});

  return () => subs.forEach((off) => off?.());
}
