/**
 * The platform's own identity, as distinct from any society's.
 *
 * Sign-in, setup and registration all happen before the caller belongs to a
 * society — there is no society name to show yet, and reaching for one meant
 * reaching into the demo seed, so a live deployment greeted everybody as
 * "Green Valley Society" no matter which societies it actually held.
 *
 * Overridable at build time so a rebrand, or a white-labelled deployment for
 * one management company, does not need a code change.
 */
export const APP_NAME = (import.meta.env?.VITE_APP_NAME || "").trim() || "Prangan";

/** प्रांगण — the premises. What every flat in a society shares. */
export const APP_TAGLINE = "Gate, community and accounts — for your society";
