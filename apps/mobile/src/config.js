/**
 * Where the app talks to.
 *
 * The web app reads VITE_API_URL at build time and falls back to a seeded local
 * store when it is unset. This app has no demo mode: it is live-only, so the URL
 * is required and there is nothing to fall back to.
 *
 * 10.0.2.2 is the Android emulator's alias for the host machine's localhost —
 * "localhost" inside the emulator is the emulator itself, which is the single
 * most common reason a dev build appears to have no server. On a physical device
 * over Wi-Fi use the host's LAN IP instead.
 *
 * **A release build must use https.** React Native sets
 * `usesCleartextTraffic=false` for release and `true` for debug, so a release
 * APK pointed at an http:// address cannot connect at all — every request fails
 * as a network error and the app reports "No connection to the society server",
 * which looks exactly like the server being down. Debug builds allow cleartext,
 * which is why a local http mock works there and not here.
 *
 * For a release build, point this at the deployed API (the Railway URL, which is
 * https) before running `npm run apk`.
 */
export const API_URL = 'https://pranganapi.thesmallapps.com';

/**
 * For local development against the API on this machine, swap the line above for:
 *
 *   export const API_URL = 'http://10.0.2.2:4000';
 *
 * 10.0.2.2 is the Android emulator's alias for the host's localhost — inside the
 * emulator, "localhost" is the emulator itself, which is the most common reason a
 * dev build appears to have no server. On a physical device over Wi-Fi, use the
 * host's LAN IP. Either only works in a debug build; see the cleartext note above.
 */

/** Mirrors isLive() in the web app. Always true here — kept so ported code reads the same. */
export const isLive = () => !!API_URL;
