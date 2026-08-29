import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { MARK_PATH, MARK_STROKE, MARK_CROP } from '../lib/mark';

/**
 * The Prangan mark.
 *
 * Drawn from the same geometry as the web app's favicon and the Android
 * launcher icon, so the logo on the sign-in screen is the same shape the user
 * just tapped on their home screen — not a lookalike that drifts the next time
 * either is edited. lib/mark.js is copied from the web app unchanged.
 */
export const Mark = ({ size = 28, color = '#fff', strokeWidth = MARK_STROKE }) => (
  <Svg width={size} height={size} viewBox={MARK_CROP} fill="none">
    <Path
      d={MARK_PATH}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default Mark;
