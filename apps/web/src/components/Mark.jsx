import { MARK_PATH, MARK_STROKE, MARK_CROP } from "../lib/mark";

/**
 * The Prangan mark, for use inside the app.
 *
 * Drawn from the same path as the favicon and the app icons, so the logo on
 * the sign-in screen is the same shape the user just tapped on their home
 * screen — not a lookalike that drifts the next time either is edited.
 *
 * Strokes in `currentColor` by default, so it takes the colour of whatever it
 * sits in rather than carrying its own.
 */
export const Mark = ({ size = 28, strokeWidth = MARK_STROKE, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox={MARK_CROP}
    fill="none"
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    <path
      d={MARK_PATH}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default Mark;
