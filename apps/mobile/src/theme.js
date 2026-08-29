/**
 * Design tokens, ported from apps/web/src/styles.js.
 *
 * The web stylesheet is CSS custom properties; React Native has no cascade and
 * no var(), so the ramp becomes plain objects and every component reads from
 * here. The values are copied rather than reinterpreted — the two apps are meant
 * to look like the same product, and a hand-tuned neutral ramp is exactly the
 * kind of thing that drifts when it gets "roughly" re-entered.
 *
 * The design intent from the web file still holds:
 *   - Neutral first: the palette is graphite and white.
 *   - Colour carries meaning or it is not used.
 *   - One number leads a screen; everything else stays subordinate.
 */

/* Neutral ramp — very slightly cool, so it reads as ink rather than mud. */
export const n = {
  n0: '#FFFFFF', n25: '#FCFCFD', n50: '#F7F8F9', n100: '#F0F1F3', n150: '#E8EAED',
  n200: '#DFE1E6', n300: '#C6CAD1', n400: '#9BA1AB', n500: '#727984',
  n600: '#545B66', n700: '#3A404A', n800: '#252A32', n900: '#14171C',
};

/* The one branded value in the app. Societies override it in settings; nothing
   else in this file assumes a hue — see applyAccent below. */
export const DEFAULT_ACCENT = {
  accent: '#2D4EA2',
  accentHover: '#25417F',
  accentSoft: '#EEF2FB',
  accentLine: '#CBD8F0',
  onAccent: '#FFFFFF',
};

/* Society accent presets. Values copied verbatim from ACCENTS in the web app's
   styles.js so the two apps render the same society in the same colour. */
export const ACCENTS = {
  indigo: { accent: '#2D4EA2', accentHover: '#25417F', accentSoft: '#EEF2FB', accentLine: '#CBD8F0', onAccent: '#FFFFFF' },
  slate:  { accent: '#3C4A5A', accentHover: '#2E3947', accentSoft: '#EFF1F4', accentLine: '#CFD6DE', onAccent: '#FFFFFF' },
  teal:   { accent: '#12695F', accentHover: '#0D544C', accentSoft: '#E9F4F2', accentLine: '#BFDDD8', onAccent: '#FFFFFF' },
  plum:   { accent: '#6B3A6E', accentHover: '#552E57', accentSoft: '#F5EEF6', accentLine: '#DFC9E1', onAccent: '#FFFFFF' },
  clay:   { accent: '#9A4B2A', accentHover: '#7C3B21', accentSoft: '#FAEFEA', accentLine: '#E9CCBF', onAccent: '#FFFFFF' },
};

/* Status. Used sparingly and mostly as text plus a dot. */
export const status = {
  ok: '#1B7A4F', okBg: '#EAF5EF', okLine: '#C3E0D0',
  warn: '#8A5A12', warnBg: '#FBF2E4', warnLine: '#E8D5B0',
  bad: '#A6322A', badBg: '#FBEDEC', badLine: '#EECBC8',
  info: '#1F5B94', infoBg: '#EAF1F8', infoLine: '#C6DAEC',
  alt: '#514A8C', altBg: '#EFEEF8', altLine: '#CFCBE7',
};

export const radius = { sm: 6, md: 8, lg: 12, xl: 16, pill: 999 };
export const PAD = 16;

/* Android ships Roboto; Inter is not available without bundling the font files,
   and a missing family silently falls back to something else entirely. System
   default is the honest choice until the .ttf files are added to android/app/src/main/assets/fonts. */
export const FONT = undefined;
export const MONO = 'monospace';

/**
 * Builds the full token set for an accent. `colors` is what components read;
 * swapping the society accent rebuilds this object and nothing else changes.
 */
export function buildColors(accentKey = 'indigo') {
  const a = ACCENTS[accentKey] || DEFAULT_ACCENT;
  return {
    ...n,
    ...a,
    ...status,

    bg: n.n50,
    surface: n.n0,
    surfaceSunken: n.n25,
    line: n.n150,
    lineStrong: n.n200,
    ink: n.n900,
    ink2: n.n700,
    ink3: n.n500,
    ink4: n.n400,

    /* Aliases kept so ported call sites have one source of truth, exactly as
       the web file does. */
    brand: a.accent,
    brand2: a.accentHover,
    brandSoft: a.accentSoft,
    green: status.ok, greenBg: status.okBg,
    red: status.bad, redBg: status.badBg,
    amber: status.warn, amberBg: status.warnBg,
    blue: status.info, blueBg: status.infoBg,
    purple: status.alt, purpleBg: status.altBg,
  };
}

export const colors = buildColors('indigo');

/**
 * Type scale. Ported from the .h1/.h2/.num/.muted/.tiny classes; letterSpacing
 * is in points on Android rather than em, so the em values are multiplied out
 * against each size.
 */
export const type = {
  h1: { fontSize: 27, fontWeight: '600', letterSpacing: -0.81, lineHeight: 30, color: colors.ink },
  h2: { fontSize: 14, fontWeight: '600', letterSpacing: -0.2, color: colors.ink },
  h3: { fontSize: 14.5, fontWeight: '600', letterSpacing: -0.17, lineHeight: 20, color: colors.ink },
  h4: { fontSize: 13.5, fontWeight: '500', letterSpacing: -0.11, lineHeight: 19, color: colors.ink },
  num: { fontSize: 20, fontWeight: '600', letterSpacing: -0.56, lineHeight: 23, color: colors.ink },
  body: { fontSize: 14, lineHeight: 20, color: colors.ink, letterSpacing: -0.08 },
  muted: { fontSize: 13, lineHeight: 19.5, color: colors.ink3 },
  tiny: { fontSize: 12, lineHeight: 17, color: colors.ink4 },
  mono: { fontFamily: MONO, fontSize: 11.5, letterSpacing: 0, color: colors.ink },
};

/* Elevation. The web app uses almost none; keep it that way so cards stay flat
   and hairlines do the separating. */
export const shadow = {
  none: {},
  card: {},
  sheet: {
    elevation: 16,
    shadowColor: '#14171C',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
  },
};
