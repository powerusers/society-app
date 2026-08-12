/**
 * The Prangan mark, as geometry.
 *
 * One unbroken rounded-square outline with a single gap on the bottom edge:
 * the boundary of the premises, the empty centre the courtyard, the gap the
 * gate. Centreline square 452px, corner radius 112, on a 1024 canvas.
 *
 * Deliberately free of imports and of anything Vite-specific, because
 * scripts/icons.mjs reads these same constants under plain Node to generate
 * the favicon and the app icons. One definition, so the mark on the sign-in
 * screen cannot drift from the one on the home screen.
 */

export const MARK_PATH =
  "M602 744 H626 A112 112 0 0 0 738 632 V404 A112 112 0 0 0 626 292 " +
  "H398 A112 112 0 0 0 286 404 V632 A112 112 0 0 0 398 744 H422";

/* The gap is 180px of centreline, which the round caps close to 108px visible
   — 1.5x the stroke. Narrower and it stops reading as a gate at small sizes. */
export const MARK_STROKE = 72;

/** The full canvas, carrying the safe-area padding a launcher mask needs. */
export const MARK_BOX = "0 0 1024 1024";

/** Cropped close to the mark, for anywhere that is never masked. */
export const MARK_CROP = "224 230 576 576";
