/**
 * Regenerates the Android launcher icon from the one vector source.
 *
 *   npm run icons --workspace @gvs/mobile
 *
 * The mark's geometry lives in src/lib/mark.js, copied unchanged from the web
 * app, so the icon on the home screen is the same shape as the logo on the
 * sign-in screen and the web app's favicon. A change to the mark cannot land in
 * some sizes and miss others.
 *
 * The web app's equivalent script rasterises through Playwright's Chromium.
 * That is a 150MB download to draw one rounded rectangle, so the raster path
 * here is analytic instead: the mark is a rounded-rect outline with a gap, which
 * is an exact signed-distance function, supersampled for anti-aliasing. The
 * geometry is read out of MARK_PATH rather than restated, so the two cannot
 * drift.
 *
 * Output:
 *   mipmap-anydpi-v26/   adaptive icon — the real one on Android 8 and up
 *   drawable/            the foreground vector it points at
 *   mipmap-*dpi/         legacy PNGs, for API 24–25 only
 */
import { deflateSync } from 'node:zlib';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARK_PATH, MARK_STROKE } from '../src/lib/mark.js';

const RES = join(dirname(fileURLToPath(import.meta.url)), '..', 'android', 'app', 'src', 'main', 'res');

/* The ink and ground, matching --n900 and the sign-in screen's mark tile. */
const INK = [0xFF, 0xFF, 0xFF];
const GROUND = [0x25, 0x2A, 0x32];

/* ------------------------------------------------------------- geometry -- */

/**
 * Reads the rounded rectangle back out of the path so this file states no
 * coordinate the mark does not already carry.
 */
function geometry() {
  const nums = MARK_PATH.match(/-?\d+(?:\.\d+)?/g).map(Number);
  // Arc radius is the first pair after the first 'A'.
  const radius = Number(MARK_PATH.match(/A\s*(\d+(?:\.\d+)?)/)[1]);

  // Coordinate pairs: every command in this path ends at an absolute x,y except
  // H and V, which carry one axis. Walk it to collect the points.
  const pts = [];
  let x = 0; let y = 0;
  const tokens = MARK_PATH.match(/[A-Z][^A-Z]*/g);
  for (const t of tokens) {
    const cmd = t[0];
    const n = (t.slice(1).match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    if (cmd === 'M' || cmd === 'L') { [x, y] = n; }
    else if (cmd === 'H') { [x] = n; }
    else if (cmd === 'V') { [y] = n; }
    else if (cmd === 'A') { x = n[5]; y = n[6]; }
    pts.push([x, y]);
  }

  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minY = Math.min(...ys); const maxY = Math.max(...ys);

  /* The gap is the bottom edge's two loose ends — the gate. */
  const onBottom = pts.filter((p) => p[1] === maxY).map((p) => p[0]).sort((a, b) => a - b);
  const gap = [onBottom[0], onBottom[onBottom.length - 1]];

  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    halfW: (maxX - minX) / 2,
    halfH: (maxY - minY) / 2,
    radius,
    gapFrom: gap[0],
    gapTo: gap[1],
    bottomY: maxY,
  };
}

const G = geometry();

/** Signed distance to the rounded-rect centreline. Negative inside. */
function sdRoundRect(px, py) {
  const qx = Math.abs(px - G.cx) - (G.halfW - G.radius);
  const qy = Math.abs(py - G.cy) - (G.halfH - G.radius);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - G.radius;
}

/** Coverage of the stroked outline at a point, with the gate gap cut out. */
function inMark(px, py) {
  if (Math.abs(sdRoundRect(px, py)) > MARK_STROKE / 2) return false;
  /* The gap: the straight run of the bottom edge between the two loose ends.
     Round caps close it to less than the centreline width, which is what makes
     it read as a gate rather than a break. */
  const capR = MARK_STROKE / 2;
  if (py > G.cy && px > G.gapFrom + capR && px < G.gapTo - capR) {
    const onBottomRun = Math.abs(py - G.bottomY) < MARK_STROKE;
    if (onBottomRun) return false;
  }
  return true;
}

/* -------------------------------------------------------------- raster --- */

const SS = 4; // supersampling factor per axis

/** Renders the mark on the ground at `size` px, returning RGB bytes. */
function render(size) {
  const scale = 1024 / size;
  const out = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) * scale;
          const py = (y + (sy + 0.5) / SS) * scale;
          if (inMark(px, py)) hits++;
        }
      }
      const a = hits / (SS * SS);
      const i = (y * size + x) * 3;
      for (let ch = 0; ch < 3; ch++) {
        out[i + ch] = Math.round(GROUND[ch] * (1 - a) + INK[ch] * a);
      }
    }
  }
  return out;
}

/* ----------------------------------------------------------------- png --- */
/* Colour type 2 — RGB, no alpha. A launcher icon has nothing to be transparent
   about, and it keeps this to a few lines rather than a native dependency. */

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

const crc32 = (buf) => {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
};

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // colour type 2 = RGB
  const stride = size * 3;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------- outputs --- */

const DENSITIES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

const hex = (rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();

/* The adaptive foreground. The launcher masks the outer ~25% on every edge, so
   the mark is scaled into the safe zone rather than drawn at full bleed. */
const FOREGROUND = `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by scripts/icons.mjs from src/lib/mark.js. Do not edit by hand. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="1024"
    android:viewportHeight="1024">
    <group android:scaleX="0.62" android:scaleY="0.62"
        android:pivotX="512" android:pivotY="${G.cy}"
        android:translateY="${512 - G.cy}">
        <path
            android:pathData="${MARK_PATH}"
            android:strokeColor="${hex(INK)}"
            android:strokeWidth="${MARK_STROKE}"
            android:strokeLineCap="round"
            android:strokeLineJoin="round" />
    </group>
</vector>
`;

const ADAPTIVE = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
    <monochrome android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>
`;

const COLORS = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${hex(GROUND)}</color>
</resources>
`;

async function main() {
  await mkdir(join(RES, 'mipmap-anydpi-v26'), { recursive: true });
  await mkdir(join(RES, 'drawable'), { recursive: true });
  await mkdir(join(RES, 'values'), { recursive: true });

  await writeFile(join(RES, 'drawable', 'ic_launcher_foreground.xml'), FOREGROUND);
  await writeFile(join(RES, 'mipmap-anydpi-v26', 'ic_launcher.xml'), ADAPTIVE);
  await writeFile(join(RES, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), ADAPTIVE);
  await writeFile(join(RES, 'values', 'ic_launcher_background.xml'), COLORS);
  console.log('adaptive icon  ->  mipmap-anydpi-v26/, drawable/, values/');

  for (const [density, size] of Object.entries(DENSITIES)) {
    const buf = png(size, render(size));
    const dir = join(RES, `mipmap-${density}`);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'ic_launcher.png'), buf);
    await writeFile(join(dir, 'ic_launcher_round.png'), buf);
    console.log(`legacy ${String(size).padStart(3)}px  ->  mipmap-${density}/`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
