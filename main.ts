// ai-excited-01 — "WATCH THIS"
// A tiny sprout cracks a city pavement and a whole galaxy bursts out of the crack.
// Node 22, standard library only. The image is drawn procedurally, pixel by pixel,
// into a 1024x1024 RGB canvas, then encoded as PNG by hand (zlib + own CRC32 +
// per-row filter choice). Fully deterministic: one fixed-seed PRNG, no Math.random,
// no Date — two runs produce byte-identical output.
//
// Run:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const W = 1024;
const H = 1024;
const img = Buffer.alloc(W * H * 3);

// ---------------------------------------------------------------- PRNG (mulberry32, fixed seed)
let seed = 0xc0ffee;
function rnd(): number {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function range(a: number, b: number): number {
  return a + rnd() * (b - a);
}

// ---------------------------------------------------------------- pixel helpers
function setPx(x: number, y: number, r: number, g: number, b: number): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  img[i] = r;
  img[i + 1] = g;
  img[i + 2] = b;
}

function blendPx(x: number, y: number, r: number, g: number, b: number, a: number): void {
  if (a <= 0 || x < 0 || y < 0 || x >= W || y >= H) return;
  if (a >= 1) {
    setPx(x, y, r, g, b);
    return;
  }
  const i = (y * W + x) * 3;
  img[i] = Math.round(img[i] * (1 - a) + r * a);
  img[i + 1] = Math.round(img[i + 1] * (1 - a) + g * a);
  img[i + 2] = Math.round(img[i + 2] * (1 - a) + b * a);
}

function disc(cx: number, cy: number, rad: number, r: number, g: number, b: number, a: number): void {
  const r0 = Math.max(0, Math.floor(cx - rad));
  const r1 = Math.min(W - 1, Math.ceil(cx + rad));
  const c0 = Math.max(0, Math.floor(cy - rad));
  const c1 = Math.min(H - 1, Math.ceil(cy + rad));
  for (let y = c0; y <= c1; y++) {
    for (let x = r0; x <= r1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= rad * rad) blendPx(x, y, r, g, b, a);
    }
  }
}

// Soft glowing blob: smooth radial falloff, no banding rings.
function glow(cx: number, cy: number, rad: number, r: number, g: number, b: number, peak: number): void {
  const r0 = Math.max(0, Math.floor(cx - rad));
  const r1 = Math.min(W - 1, Math.ceil(cx + rad));
  const c0 = Math.max(0, Math.floor(cy - rad));
  const c1 = Math.min(H - 1, Math.ceil(cy + rad));
  for (let y = c0; y <= c1; y++) {
    for (let x = r0; x <= r1; x++) {
      const d = Math.hypot(x - cx, y - cy) / rad;
      if (d >= 1) continue;
      const f = (1 - d) * (1 - d);
      blendPx(x, y, r, g, b, peak * f);
    }
  }
}

function line(x0: number, y0: number, x1: number, y1: number, r: number, g: number, b: number, a: number, width: number): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(len));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    disc(x0 + dx * t, y0 + dy * t, width / 2, r, g, b, a);
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mix3(c1: number[], c2: number[], t: number): number[] {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

// ---------------------------------------------------------------- 1. sky gradient
const skyTop = [7, 7, 38];
const skyMid = [26, 14, 74];
const skyLow = [52, 22, 96];
for (let y = 0; y < H; y++) {
  let c: number[];
  if (y < 560) c = mix3(skyTop, skyMid, y / 560);
  else c = mix3(skyMid, skyLow, (y - 560) / 470);
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    img[i] = c[0];
    img[i + 1] = c[1];
    img[i + 2] = c[2];
  }
}

// ---------------------------------------------------------------- 2. light rays from the crack
const crackX = 512;
const crackY = 852;
for (let k = 0; k < 26; k++) {
  const ang = (-Math.PI / 2 + range(-1.15, 1.15)) ;
  const len = range(420, 760);
  const x1 = crackX + Math.cos(ang) * len;
  const y1 = crackY + Math.sin(ang) * len;
  const warm = rnd() < 0.5;
  line(crackX, crackY, x1, y1, warm ? 255 : 150, warm ? 205 : 220, warm ? 110 : 255, range(0.05, 0.13), range(2, 5));
}

// ---------------------------------------------------------------- 3. nebula clouds around the galaxy core
const coreX = 512;
const coreY = 430;
const palette = [
  [255, 64, 178], // magenta
  [64, 214, 255], // cyan
  [255, 196, 88], // gold
  [178, 102, 255], // violet
];
for (let k = 0; k < 42; k++) {
  const ang = rnd() * Math.PI * 2;
  const dist = Math.pow(rnd(), 0.6) * 300;
  const cx = coreX + Math.cos(ang) * dist;
  const cy = coreY + Math.sin(ang) * dist * 0.72;
  const col = palette[k % palette.length];
  glow(cx, cy, range(34, 105), col[0], col[1], col[2], range(0.16, 0.3));
}

// ---------------------------------------------------------------- 4. radial glow at the core (kept soft so the arms stay visible)
glow(coreX, coreY, 280, 255, 236, 190, 0.28);
glow(coreX, coreY, 150, 255, 255, 255, 0.35);

// ---------------------------------------------------------------- 5. spiral arms — layered translucent star dots
const armCols = [
  [255, 92, 205],
  [96, 224, 255],
  [255, 205, 110],
];
for (let arm = 0; arm < 3; arm++) {
  const off = (arm * Math.PI * 2) / 3;
  const col = armCols[arm];
  const n = 900;
  for (let i = 0; i < n; i++) {
    const t = Math.pow(rnd(), 0.75); // denser near the core
    const ang = off + t * 5.4 + range(-0.1, 0.1);
    const rad = 16 + t * 305;
    const x = coreX + Math.cos(ang) * rad + range(-7, 7);
    const y = coreY + Math.sin(ang) * rad * 0.66 + range(-6, 6);
    const size = range(0.8, 3.4) * (1 - t * 0.55);
    const a = range(0.5, 0.95) * (1 - t * 0.45);
    const bright = rnd() < 0.12;
    disc(x, y, size, bright ? 255 : col[0], bright ? 255 : col[1], bright ? 255 : col[2], a);
  }
}
// dense bright core
for (let i = 0; i < 420; i++) {
  const ang = rnd() * Math.PI * 2;
  const dist = Math.pow(rnd(), 0.5) * 62;
  const x = coreX + Math.cos(ang) * dist;
  const y = coreY + Math.sin(ang) * dist * 0.8;
  disc(x, y, range(0.8, 2.6), 255, 244, 214, range(0.7, 1));
}

// ---------------------------------------------------------------- 6. background stars
for (let i = 0; i < 620; i++) {
  const x = rnd() * W;
  const y = rnd() * 830;
  const b = range(0.35, 1);
  const s = rnd() < 0.08 ? 2 : 1;
  const warm = rnd() < 0.3;
  disc(x, y, s, 255, warm ? 230 : 255, warm ? 200 : 255, b);
  if (rnd() < 0.06) {
    // cross sparkle on a few bright stars
    line(x - 5, y, x + 5, y, 255, 255, 255, 0.5, 1);
    line(x, y - 5, x, y + 5, 255, 255, 255, 0.5, 1);
  }
}

// ---------------------------------------------------------------- 7. pavement slabs
const paveTop = 830;
for (let y = paveTop; y < H; y++) {
  const t = (y - paveTop) / (H - paveTop);
  const g = Math.round(lerp(66, 34, t));
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    img[i] = g + 4;
    img[i + 1] = g;
    img[i + 2] = g + 10;
  }
}
// slab seams
for (const sx of [170, 340, 684, 854]) line(sx, paveTop, sx, H, 22, 22, 30, 1, 3);
line(0, 922, W, 922, 22, 22, 30, 1, 3);
// pavement speckle
for (let i = 0; i < 700; i++) {
  const x = rnd() * W;
  const y = paveTop + rnd() * (H - paveTop);
  blendPx(Math.floor(x), Math.floor(y), 120, 120, 130, range(0.1, 0.3));
}

// ---------------------------------------------------------------- 8. the crack (jagged polygon, dark with a lit edge)
let cx = crackX;
let cy = H;
const crackPts: [number, number][] = [[cx, cy]];
while (cy > crackY) {
  cy -= range(16, 30);
  cx += range(-20, 20);
  crackPts.push([cx, Math.max(cy, crackY)]);
}
// small side branches
const branches: [number, number, number, number][] = [];
for (let b = 0; b < 4; b++) {
  const p = crackPts[2 + b * 2];
  if (!p) continue;
  const dir = b % 2 === 0 ? 1 : -1;
  branches.push([p[0], p[1], p[0] + dir * range(30, 60), p[1] - range(8, 34)]);
}
for (let i = 0; i < crackPts.length - 1; i++) {
  const [x0, y0] = crackPts[i];
  const [x1, y1] = crackPts[i + 1];
  const w = 9 - i * 0.4; // wider at the bottom, narrowing toward the sprout
  line(x0, y0, x1, y1, 12, 12, 18, 1, Math.max(3, w));
  line(x0 + 4, y0, x1 + 4, y1, 190, 150, 235, 0.6, 2);
}
for (const [x0, y0, x1, y1] of branches) {
  line(x0, y0, x1, y1, 12, 12, 18, 1, 4);
}

// ---------------------------------------------------------------- 9. the sprout (big, bright — the clear focal point)
line(512, 852, 504, 736, 34, 176, 92, 1, 8);
line(512, 852, 504, 736, 90, 230, 130, 1, 3);
// leaves: rotated ellipses
function leaf(cx: number, cy: number, rx: number, ry: number, rot: number, r: number, g: number, b: number): void {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  for (let y = Math.floor(cy - rx); y <= Math.ceil(cy + rx); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = x - cx;
      const dy = y - cy;
      const u = dx * cos + dy * sin;
      const v = -dx * sin + dy * cos;
      if ((u * u) / (rx * rx) + (v * v) / (ry * ry) <= 1) blendPx(x, y, r, g, b, 1);
    }
  }
}
leaf(462, 762, 52, 20, -0.55, 64, 224, 122);
leaf(552, 752, 52, 20, 0.5, 46, 205, 106);
line(462, 762, 504, 764, 20, 140, 70, 0.55, 2);
line(552, 752, 510, 760, 20, 140, 70, 0.55, 2);
// tiny top bud
disc(504, 730, 9, 96, 240, 140, 1);
disc(504, 730, 5, 180, 250, 190, 1);

// ---------------------------------------------------------------- 10. speech bubble + bitmap text "WATCH THIS"
const FONT: Record<string, string[]> = {
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

function inRoundRect(x: number, y: number, x0: number, y0: number, x1: number, y1: number, r: number): boolean {
  const nx = Math.max(x0 + r, Math.min(x, x1 - r));
  const ny = Math.max(y0 + r, Math.min(y, y1 - r));
  const dx = x - nx;
  const dy = y - ny;
  return dx * dx + dy * dy <= r * r;
}

const bx0 = 648;
const by0 = 686;
const bx1 = 992;
const by1 = 814;
// dark outline, then white fill
for (let y = by0 - 4; y <= by1 + 4; y++) {
  for (let x = bx0 - 4; x <= bx1 + 4; x++) {
    if (inRoundRect(x, y, bx0 - 4, by0 - 4, bx1 + 4, by1 + 4, 22)) setPx(x, y, 16, 18, 40);
  }
}
for (let y = by0; y <= by1; y++) {
  for (let x = bx0; x <= bx1; x++) {
    if (inRoundRect(x, y, bx0, by0, bx1, by1, 18)) setPx(x, y, 255, 255, 255);
  }
}
// tail: triangle from bubble bottom edge down to the sprout
function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, r: number, g: number, b: number): void {
  const minX = Math.floor(Math.min(x0, x1, x2));
  const maxX = Math.ceil(Math.max(x0, x1, x2));
  const minY = Math.floor(Math.min(y0, y1, y2));
  const maxY = Math.ceil(Math.max(y0, y1, y2));
  const d = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const a = ((x1 - x) * (y2 - y) - (y1 - y) * (x2 - x)) / d;
      const bb = ((x2 - x) * (y0 - y) - (y2 - y) * (x0 - x)) / d;
      const c = 1 - a - bb;
      if (a >= 0 && bb >= 0 && c >= 0) setPx(x, y, r, g, b);
    }
  }
}
tri(688, by1 - 2, 806, by1 - 2, 548, 856, 255, 255, 255);

// bitmap text, scale 5
const text = 'WATCH THIS';
const scale = 5;
const charW = 5 * scale + scale; // glyph + gap
const textW = text.length * charW - scale;
const tx0 = bx0 + Math.floor((bx1 - bx0 - textW) / 2);
const ty0 = by0 + Math.floor((by1 - by0 - 7 * scale) / 2);
for (let ci = 0; ci < text.length; ci++) {
  const glyph = FONT[text[ci]] ?? FONT[' '];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      if (glyph[row][col] === '1') {
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            setPx(tx0 + ci * charW + col * scale + dx, ty0 + row * scale + dy, 14, 16, 44);
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------- PNG encoder (own CRC32 + best filter per row)
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

// build filtered scanlines, picking the filter with the smallest residual per row
const bpp = 3;
const raw = Buffer.alloc(H * (1 + W * bpp));
for (let y = 0; y < H; y++) {
  const row = img.subarray(y * W * bpp, (y + 1) * W * bpp);
  const prev = y > 0 ? img.subarray((y - 1) * W * bpp, y * W * bpp) : null;
  let bestFilter = 0;
  let bestScore = Infinity;
  let best: Buffer | null = null;
  for (let f = 0; f <= 4; f++) {
    const out = Buffer.alloc(W * bpp);
    let score = 0;
    for (let i = 0; i < W * bpp; i++) {
      const x = row[i];
      const a = i >= bpp ? row[i - bpp] : 0;
      const bb = prev ? prev[i] : 0;
      const cc = prev && i >= bpp ? prev[i - bpp] : 0;
      let v: number;
      if (f === 0) v = x;
      else if (f === 1) v = x - a;
      else if (f === 2) v = x - bb;
      else if (f === 3) v = x - Math.floor((a + bb) / 2);
      else v = x - paeth(a, bb, cc);
      out[i] = v & 0xff;
      const s = v & 0xff;
      score += s < 128 ? s : 256 - s;
    }
    if (score < bestScore) {
      bestScore = score;
      bestFilter = f;
      best = out;
    }
  }
  const off = y * (1 + W * bpp);
  raw[off] = bestFilter;
  best!.copy(raw, off + 1);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // colour type: truecolour RGB
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'entry.png');
writeFileSync(outPath, png);
const hash = createHash('sha256').update(png).digest('hex');
console.log(`wrote ${outPath} — ${png.length} bytes, sha256 ${hash}`);
if (png.length > 1048576) console.log('WARNING: over the 1 MiB limit');
