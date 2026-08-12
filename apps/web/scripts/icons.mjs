/**
 * Regenerates every icon asset from one vector source.
 *
 *   npm run icons --workspace @gvs/web
 *
 * The PNGs are build output that happens to be committed — browsers and app
 * stores need raster. Keeping the geometry here rather than in five hand-edited
 * files means a change to the mark cannot land in some sizes and miss others.
 */
import { chromium } from "playwright";
import { deflateSync } from "node:zlib";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/* A canvas always hands back RGBA, and App Store Connect rejects an icon that
   carries an alpha channel even when every pixel in it is opaque. Rather than
   ship that caveat, the pixels are re-encoded here as colour type 2 — RGB, no
   alpha at all. It is a small enough format to write directly, and it avoids a
   native image dependency for six files. */
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
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** @param {Buffer} rgba - width*height*4 bytes straight off the canvas */
function encodeRgbPng(rgba, width, height) {
  const stride = width * 3;
  // Each scanline is prefixed with its filter type; 0 means "store as-is".
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = y * (stride + 1) + 1 + x * 3;
      raw[dst] = rgba[src];
      raw[dst + 1] = rgba[src + 1];
      raw[dst + 2] = rgba[src + 2];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // colour type 2 = truecolour, no alpha
  ihdr[10] = 0;  // deflate
  ihdr[11] = 0;  // adaptive filtering
  ihdr[12] = 0;  // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

/* The mark: one unbroken rounded-square outline, corners closed, with a single
   gap centred on the bottom edge — the boundary of the premises, and the gate.
   Centreline square 452px, corner radius 112, stroke 72, on a 1024 canvas. The
   gap is 180px of centreline, which the round caps close to 108px visible —
   1.5x the stroke, wide enough to still read at 32px. */
const PATH = "M602 744 H626 A112 112 0 0 0 738 632 V404 A112 112 0 0 0 626 292 " +
  "H398 A112 112 0 0 0 286 404 V632 A112 112 0 0 0 398 744 H422";
const STROKE = 72;

const INK = "#14171C";
const ACCENT = "#2D4EA2";
const PAPER = "#FFFFFF";

const stroke = (color) =>
  `<path d="${PATH}" fill="none" stroke="${color}" stroke-width="${STROKE}" ` +
  `stroke-linecap="round" stroke-linejoin="round"/>`;

/** Full 1024 canvas with an opaque ground — what the app-store and launcher masks crop. */
const tile = (ground, mark) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">` +
  `<rect width="1024" height="1024" fill="${ground}"/>${stroke(mark)}</svg>`;

/* A favicon is never masked, so the mark is cropped close instead of carrying
   the launcher safe-area padding — at 16px that padding is most of the icon. */
const CROP = "224 230 576 576";

/* Transparent, and it follows the browser chrome rather than assuming a light
   tab strip. Safari ignores the media query and takes the first rule, which is
   the ink one — correct for its default light UI. */
const faviconSvg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${CROP}">\n` +
  `  <style>\n` +
  `    .m { stroke: ${INK} }\n` +
  `    @media (prefers-color-scheme: dark) { .m { stroke: ${PAPER} } }\n` +
  `  </style>\n` +
  `  <path class="m" d="${PATH}" fill="none" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round"/>\n` +
  `</svg>\n`;

const cropped = (ground, mark) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${CROP}" width="1024" height="1024">` +
  `<rect x="224" y="230" width="576" height="576" fill="${ground}"/>${stroke(mark)}</svg>`;

const RASTER = [
  /* iOS home screen. Opaque with no alpha — the App Store rejects transparency,
     and iOS applies its own corner mask, so the square ships square. */
  { file: "apple-touch-icon.png", size: 180, svg: tile(INK, PAPER) },
  /* Android adaptive. Declared maskable, so the launcher may crop to a circle:
     the mark sits well inside the 66.67% safe zone. */
  { file: "icon-192.png", size: 192, svg: tile(INK, PAPER) },
  { file: "icon-512.png", size: 512, svg: tile(INK, PAPER) },
  /* Store listings and anything that wants the full-resolution original. */
  { file: "icon-1024.png", size: 1024, svg: tile(INK, PAPER) },
  { file: "icon-light-1024.png", size: 1024, svg: tile(PAPER, ACCENT) },
  /* Legacy browser fallback for anything that will not take the SVG. */
  { file: "icon-32.png", size: 32, svg: cropped(PAPER, INK) },
];

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const page = await browser.newPage();

await mkdir(PUBLIC, { recursive: true });

for (const { file, size, svg } of RASTER) {
  /* Drawn through a canvas at the exact target size rather than screenshotted,
     so the output is exactly size x size with no device-pixel-ratio surprises. */
  const b64 = await page.evaluate(async ({ svg, size }) => {
    const img = new Image();
    img.src = "data:image/svg+xml;base64," + btoa(svg);
    await img.decode();
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, size, size);
    const px = ctx.getImageData(0, 0, size, size).data;
    let bin = "";
    for (let i = 0; i < px.length; i++) bin += String.fromCharCode(px[i]);
    return btoa(bin);
  }, { svg, size });

  const rgba = Buffer.from(b64, "base64");
  const png = encodeRgbPng(rgba, size, size);
  await writeFile(join(PUBLIC, file), png);
  console.log(`  ${file.padEnd(22)} ${size}x${size}  RGB, no alpha  ${(png.length / 1024).toFixed(1)}KB`);
}

await writeFile(join(PUBLIC, "favicon.svg"), faviconSvg);
console.log(`  favicon.svg            vector, follows the browser's colour scheme`);

await browser.close();
