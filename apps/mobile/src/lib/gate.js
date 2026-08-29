import { NativeModules, Platform } from 'react-native';

/**
 * The native half of the gate alert.
 *
 * Guarded the same way as lib/push.js: this module only exists in an Android
 * build, and calling into a missing native module throws. Everything here is an
 * enhancement to a screen that already works, so absence has to be survivable.
 */
const Gate = Platform.OS === 'android' ? NativeModules.GateModule : null;

export const gateNativeAvailable = () => !!Gate;

/** Silences the ringtone without closing the screen. */
export const stopRinging = () => { try { Gate?.stopRinging(); } catch { /* not android */ } };

/** Closes the full-screen approval activity and clears its notification. */
export const closeGateScreen = () => { try { Gate?.close(); } catch { /* not android */ } };

/** Clears the gate notification from the shade, leaving the screen alone. */
export const dismissGateNotification = () => {
  try { Gate?.dismissNotification(); } catch { /* not android */ }
};

/**
 * Whether Android will wake a locked phone into the approval screen.
 *
 * False on Android 14+ until the user grants it in Settings — there is no
 * runtime prompt for this one. When false the gate request still arrives and
 * still rings, as a heads-up notification the resident taps.
 */
export async function canUseFullScreenIntent() {
  if (!Gate) return false;
  try { return await Gate.canUseFullScreenIntent(); } catch { return false; }
}

/** Opens the only page that can grant it. */
export async function openFullScreenIntentSettings() {
  if (!Gate) return false;
  try { return await Gate.openFullScreenIntentSettings(); } catch { return false; }
}

/** A token FCM delivered while the app was not running, if there is one. */
export async function consumePendingToken() {
  if (!Gate) return null;
  try { return await Gate.consumePendingToken(); } catch { return null; }
}
