/**
 * Single-stroke icon set, generated from apps/web/src/icons.jsx.
 *
 * Same geometry, same names, same call signature as the web set — only the
 * primitives change, because React Native has no DOM <svg>. Regenerate rather
 * than hand-edit if the web icons change: the paths are transcribed, and
 * transcribing 70 of them by hand is how a stroke ends up subtly wrong.
 *
 * currentColor resolves against the `color` prop set on <Svg>, which is how
 * react-native-svg propagates it to children.
 */
import React from 'react';
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';
import { colors } from './theme';

const mk = (paths) => {
  const C = ({ size = 20, color = colors.ink3, ...p }) => (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      color={color}
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      {paths}
    </Svg>
  );
  return C;
};

export const Icons = {
Home: mk(<><Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><Polyline points="9 22 9 12 15 12 15 22" /></>),
  Bell: mk(<><Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><Path d="M13.73 21a2 2 0 01-3.46 0" /></>),
  Users: mk(<><Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><Circle cx="9" cy="7" r="4" /><Path d="M23 21v-2a4 4 0 00-3-3.87" /><Path d="M16 3.13a4 4 0 010 7.75" /></>),
  User: mk(<><Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><Circle cx="12" cy="7" r="4" /></>),
  UserPlus: mk(<><Path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><Circle cx="8.5" cy="7" r="4" /><Line x1="20" y1="8" x2="20" y2="14" /><Line x1="23" y1="11" x2="17" y2="11" /></>),
  Shield: mk(<Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />),
  Rupee: mk(<><Path d="M6 3h12" /><Path d="M6 8h12" /><Path d="M6 13h3a5 5 0 000-10" /><Path d="M6 13l7 8" /></>),
  Check: mk(<Polyline points="20 6 9 17 4 12" />),
  CheckCircle: mk(<><Path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><Polyline points="22 4 12 14.01 9 11.01" /></>),
  X: mk(<><Line x1="18" y1="6" x2="6" y2="18" /><Line x1="6" y1="6" x2="18" y2="18" /></>),
  Plus: mk(<><Line x1="12" y1="5" x2="12" y2="19" /><Line x1="5" y1="12" x2="19" y2="12" /></>),
  Minus: mk(<Line x1="5" y1="12" x2="19" y2="12" />),
  LogOut: mk(<><Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><Polyline points="16 17 21 12 16 7" /><Line x1="21" y1="12" x2="9" y2="12" /></>),
  Eye: mk(<><Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><Circle cx="12" cy="12" r="3" /></>),
  Send: mk(<><Line x1="22" y1="2" x2="11" y2="13" /><Polygon points="22 2 15 22 11 13 2 9 22 2" /></>),
  Building: mk(<><Rect x="4" y="2" width="16" height="20" rx="2" /><Path d="M9 22v-4h6v4" /><Line x1="8" y1="6" x2="8" y2="6.01" /><Line x1="12" y1="6" x2="12" y2="6.01" /><Line x1="16" y1="6" x2="16" y2="6.01" /><Line x1="8" y1="10" x2="8" y2="10.01" /><Line x1="12" y1="10" x2="12" y2="10.01" /><Line x1="16" y1="10" x2="16" y2="10.01" /></>),
  Back: mk(<Polyline points="15 18 9 12 15 6" />),
  Fwd: mk(<Polyline points="9 18 15 12 9 6" />),
  Down: mk(<Polyline points="6 9 12 15 18 9" />),
  Up: mk(<Polyline points="18 15 12 9 6 15" />),
  Car: mk(<><Rect x="3" y="11" width="18" height="7" rx="1" /><Circle cx="7.5" cy="18" r="1.5" /><Circle cx="16.5" cy="18" r="1.5" /><Path d="M5.2 11L7 7h10l1.8 4" /></>),
  Gate: mk(<><Rect x="3" y="3" width="7" height="18" rx="1" /><Rect x="14" y="3" width="7" height="18" rx="1" /><Line x1="10" y1="12" x2="14" y2="12" /><Circle cx="8" cy="12" r="1" /><Circle cx="16" cy="12" r="1" /></>),
  Clock: mk(<><Circle cx="12" cy="12" r="10" /><Polyline points="12 6 12 12 16 14" /></>),
  Phone: mk(<Path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />),
  Camera: mk(<><Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><Circle cx="12" cy="13" r="4" /></>),
  Alert: mk(<><Circle cx="12" cy="12" r="10" /><Line x1="12" y1="8" x2="12" y2="12" /><Line x1="12" y1="16" x2="12.01" y2="16" /></>),
  AlertTri: mk(<><Path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><Line x1="12" y1="9" x2="12" y2="13" /><Line x1="12" y1="17" x2="12.01" y2="17" /></>),
  QR: mk(<><Rect x="3" y="3" width="7" height="7" rx="1" /><Rect x="14" y="3" width="7" height="7" rx="1" /><Rect x="3" y="14" width="7" height="7" rx="1" /><Line x1="14" y1="14" x2="14" y2="14.01" /><Line x1="17.5" y1="14" x2="21" y2="14" /><Line x1="21" y1="17.5" x2="21" y2="21" /><Line x1="14" y1="17.5" x2="14" y2="21" /><Line x1="17.5" y1="21" x2="17.5" y2="21.01" /><Line x1="17.5" y1="17.5" x2="17.5" y2="17.51" /></>),
  Finger: mk(<><Path d="M12 2a8 8 0 00-8 8v3" /><Path d="M20 13v-3a8 8 0 00-4-6.93" /><Path d="M8 22a12 12 0 002-6.5V10a2 2 0 114 0v5" /><Path d="M14 20.5v-2" /><Path d="M4.5 19a10 10 0 001.2-4" /><Path d="M18 21a16 16 0 001-5" /></>),
  Radio: mk(<><Circle cx="12" cy="12" r="2" /><Path d="M4.93 19.07a10 10 0 010-14.14" /><Path d="M7.76 16.24a6 6 0 010-8.49" /><Path d="M16.24 7.76a6 6 0 010 8.49" /><Path d="M19.07 4.93a10 10 0 010 14.14" /></>),
  Mic: mk(<><Rect x="9" y="2" width="6" height="12" rx="3" /><Path d="M19 10v1a7 7 0 01-14 0v-1" /><Line x1="12" y1="18" x2="12" y2="22" /></>),
  Route: mk(<><Circle cx="6" cy="19" r="3" /><Circle cx="18" cy="5" r="3" /><Path d="M9 19h5a4 4 0 000-8H10a4 4 0 010-8h5" /></>),
  Pin: mk(<><Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><Circle cx="12" cy="10" r="3" /></>),
  Ticket: mk(<><Path d="M3 9V7a2 2 0 012-2h14a2 2 0 012 2v2a3 3 0 000 6v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a3 3 0 000-6z" /><Line x1="12" y1="7" x2="12" y2="17" strokeDasharray="2 3" /></>),
  Chat: mk(<Path d="M21 11.5a8.4 8.4 0 01-9 8.4 8.5 8.5 0 01-3.9-.9L3 21l1.9-5a8.4 8.4 0 01-.9-3.9 8.4 8.4 0 018.4-8.5h.6a8.4 8.4 0 018 8z" />),
  Doc: mk(<><Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><Polyline points="14 2 14 8 20 8" /><Line x1="16" y1="13" x2="8" y2="13" /><Line x1="16" y1="17" x2="8" y2="17" /></>),
  Folder: mk(<Path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />),
  Calendar: mk(<><Rect x="3" y="4" width="18" height="18" rx="2" /><Line x1="16" y1="2" x2="16" y2="6" /><Line x1="8" y1="2" x2="8" y2="6" /><Line x1="3" y1="10" x2="21" y2="10" /></>),
  Chart: mk(<><Line x1="18" y1="20" x2="18" y2="10" /><Line x1="12" y1="20" x2="12" y2="4" /><Line x1="6" y1="20" x2="6" y2="14" /></>),
  Pie: mk(<><Path d="M21.21 15.89A10 10 0 118 2.83" /><Path d="M22 12A10 10 0 0012 2v10z" /></>),
  Bank: mk(<><Line x1="3" y1="21" x2="21" y2="21" /><Path d="M3 10l9-6 9 6" /><Line x1="5" y1="10" x2="5" y2="21" /><Line x1="10" y1="10" x2="10" y2="21" /><Line x1="14" y1="10" x2="14" y2="21" /><Line x1="19" y1="10" x2="19" y2="21" /></>),
  Card: mk(<><Rect x="2" y="5" width="20" height="14" rx="2" /><Line x1="2" y1="10" x2="22" y2="10" /></>),
  Refresh: mk(<><Polyline points="23 4 23 10 17 10" /><Polyline points="1 20 1 14 7 14" /><Path d="M3.5 9a9 9 0 0114.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0020.5 15" /></>),
  Search: mk(<><Circle cx="11" cy="11" r="8" /><Line x1="21" y1="21" x2="16.65" y2="16.65" /></>),
  Filter: mk(<Polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />),
  Star: mk(<Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />),
  Heart: mk(<Path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />),
  Tools: mk(<Path d="M14.7 6.3a4 4 0 005.4 5.3l-8 8a2.8 2.8 0 01-4-4l8-8a4 4 0 01-1.4-1.3z" />),
  Box: mk(<><Path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><Polyline points="3.27 6.96 12 12.01 20.73 6.96" /><Line x1="12" y1="22.08" x2="12" y2="12" /></>),
  Watch: mk(<><Circle cx="12" cy="12" r="6" /><Polyline points="12 10 12 12 13.5 13.5" /><Path d="M16.51 17.35l-.35 3.83a2 2 0 01-2 1.82H9.83a2 2 0 01-2-1.82l-.35-3.83m.01-10.7l.35-3.83A2 2 0 019.83 1h4.35a2 2 0 012 1.82l.35 3.83" /></>),
  Key: mk(<Path d="M21 2l-2 2m-7.6 7.6a5.5 5.5 0 11-7.8 7.8 5.5 5.5 0 017.8-7.8zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />),
  Lock: mk(<><Rect x="3" y="11" width="18" height="11" rx="2" /><Path d="M7 11V7a5 5 0 0110 0v4" /></>),
  Settings: mk(<><Circle cx="12" cy="12" r="3" /><Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 008.6 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 8.6a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></>),
  Grid: mk(<><Rect x="3" y="3" width="7" height="7" rx="1" /><Rect x="14" y="3" width="7" height="7" rx="1" /><Rect x="14" y="14" width="7" height="7" rx="1" /><Rect x="3" y="14" width="7" height="7" rx="1" /></>),
  Download: mk(<><Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><Polyline points="7 10 12 15 17 10" /><Line x1="12" y1="15" x2="12" y2="3" /></>),
  Upload: mk(<><Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><Polyline points="17 8 12 3 7 8" /><Line x1="12" y1="3" x2="12" y2="15" /></>),
  Trash: mk(<><Polyline points="3 6 5 6 21 6" /><Path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></>),
  Edit: mk(<><Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><Path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z" /></>),
  Dumbbell: mk(<><Path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" /></>),
  Water: mk(<Path d="M12 2.7s6 6.1 6 10.3a6 6 0 11-12 0c0-4.2 6-10.3 6-10.3z" />),
  Zap: mk(<Polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />),
  Info: mk(<><Circle cx="12" cy="12" r="10" /><Line x1="12" y1="16" x2="12" y2="12" /><Line x1="12" y1="8" x2="12.01" y2="8" /></>),
  Sos: mk(<><Circle cx="12" cy="12" r="10" /><Path d="M12 7v6" /><Circle cx="12" cy="16.5" r=".6" fill="currentColor" /></>),
  Baby: mk(<><Circle cx="12" cy="8" r="4" /><Path d="M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" /><Path d="M10 8h.01M14 8h.01" /></>),
  Truck: mk(<><Rect x="1" y="6" width="13" height="10" rx="1" /><Path d="M14 9h4l3 3v4h-7z" /><Circle cx="5.5" cy="18" r="2" /><Circle cx="17.5" cy="18" r="2" /></>),
  Broom: mk(<><Path d="M19 3l-8 8" /><Path d="M13 9l4 4-5 8H6l3-8z" /><Path d="M9 13h5" /></>),
  Board: mk(<><Rect x="3" y="3" width="18" height="14" rx="2" /><Line x1="7" y1="8" x2="17" y2="8" /><Line x1="7" y1="12" x2="13" y2="12" /><Line x1="12" y1="17" x2="12" y2="21" /></>),
  Poll: mk(<><Line x1="4" y1="7" x2="14" y2="7" /><Line x1="4" y1="12" x2="19" y2="12" /><Line x1="4" y1="17" x2="10" y2="17" /></>),
  Bulb: mk(<><Path d="M9 18h6" /><Path d="M10 22h4" /><Path d="M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z" /></>),
  Handshake: mk(<><Path d="M11 17l2 2 3-3 3 3 3-3-5-5-3 2-3-2-5 5 3 3z" /><Path d="M2 11l4-4 3 2" /></>),
  Tag: mk(<><Path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0l-8-8A2 2 0 012 11.2V4a2 2 0 012-2h7.2a2 2 0 011.4.6l8 8a2 2 0 010 2.8z" /><Line x1="7" y1="7" x2="7.01" y2="7" /></>),
  Book: mk(<><Path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><Path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></>),
  Trophy: mk(<><Path d="M8 21h8M12 17v4" /><Path d="M7 4h10v5a5 5 0 01-10 0z" /><Path d="M7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3" /></>),
  Play: mk(<Polygon points="6 3 20 12 6 21 6 3" />),
  Pause: mk(<><Rect x="6" y="4" width="4" height="16" rx="1" /><Rect x="14" y="4" width="4" height="16" rx="1" /></>),
  Bolt: mk(<><Path d="M12 2v6M12 16v6M4.9 4.9l4.2 4.2M14.9 14.9l4.2 4.2M2 12h6M16 12h6M4.9 19.1l4.2-4.2M14.9 9.1l4.2-4.2" /></>),
};

export default Icons;
