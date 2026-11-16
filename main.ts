// WATCH THIS — a sprout cracks the pavement and a galaxy bursts out.
// Node stdlib only. Deterministic: fixed-seed mulberry32 PRNG, own PNG encoder.
// Run: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ---------- deterministic PRNG ----------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261117);

// ---------- framebuffer (RGB) ----------
const img = Buffer.alloc(W * H * 3);

function setPixel(x: number, y: number, r: number, g: number, b: number): void {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || xi >= W || yi < 0 || yi >= H) return;
  const i = (yi * W + xi) * 3;
  img[i] = r;
  img[i + 1] = g;
  img[i + 2] = b;
}

function blendPixel(x: number, y: number, r: number, g: number, b: number, a: number): void {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || xi >= W || yi < 0 || yi >= H) return;
  const i = (yi * W + xi) * 3;
  img[i] = Math.round(r * a + img[i] * (1 - a));
  img[i + 1] = Math.round(g * a + img[i + 1] * (1 - a));
  img[i + 2] = Math.round(b * a + img[i + 2] * (1 - a));
}

function fillRect(x0: number, y0: number, x1: number, y1: number, r: number, g: number, b: number): void {
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(H, Math.ceil(y1)); y++) {
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, Math.ceil(x1)); x++) {
      setPixel(x, y, r, g, b);
    }
  }
}

// soft glowing disc: alpha falls off linearly to the edge
function softDisc(cx: number, cy: number, rad: number, r: number, g: number, b: number, alpha: number): void {
  const rr = Math.ceil(rad);
  for (let y = Math.floor(cy - rr); y <= Math.ceil(cy + rr); y++) {
    for (let x = Math.floor(cx - rr); x <= Math.ceil(cx + rr); x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > rad) continue;
      blendPixel(x, y, r, g, b, alpha * (1 - d / rad));
    }
  }
}

// solid disc
function disc(cx: number, cy: number, rad: number, r: number, g: number, b: number): void {
  const rr = Math.ceil(rad);
  for (let y = Math.floor(cy - rr); y <= Math.ceil(cy + rr); y++) {
    for (let x = Math.floor(cx - rr); x <= Math.ceil(cx + rr); x++) {
      if (Math.hypot(x - cx, y - cy) <= rad) setPixel(x, y, r, g, b);
    }
  }
}

// thick line drawn as a chain of discs
function thickLine(x0: number, y0: number, x1: number, y1: number, rad: number, r: number, g: number, b: number): void {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, rad, r, g, b);
  }
}

// filled ellipse, rotated by angle (radians), centred at (cx, cy)
function ellipse(cx: number, cy: number, a: number, b: number, angle: number, r: number, g: number, bl: number): void {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const R = Math.ceil(Math.max(a, b));
  for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) {
    for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
      const dx = x - cx;
      const dy = y - cy;
      const u = dx * cos + dy * sin;
      const v = -dx * sin + dy * cos;
      if ((u * u) / (a * a) + (v * v) / (b * b) <= 1) setPixel(x, y, r, g, bl);
    }
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ---------- 1. sky: dark vertical gradient ----------
const skyTop: [number, number, number] = [7, 9, 38];
const skyBottom: [number, number, number] = [43, 18, 72];
const HORIZON = 640;
for (let y = 0; y < HORIZON; y++) {
  const t = y / HORIZON;
  const r = Math.round(lerp(skyTop[0], skyBottom[0], t));
  const g = Math.round(lerp(skyTop[1], skyBottom[1], t));
  const b = Math.round(lerp(skyTop[2], skyBottom[2], t));
  fillRect(0, y, W, y + 1, r, g, b);
}

// ---------- 2. stars ----------
for (let i = 0; i < 260; i++) {
  const x = rand() * W;
  const y = rand() * 620;
  const bright = 140 + Math.floor(rand() * 115);
  const warm = rand();
  const r = bright;
  const g = warm < 0.3 ? Math.round(bright * 0.85) : bright;
  const b = warm < 0.3 ? Math.round(bright * 0.7) : bright;
  if (rand() < 0.12) {
    // sparkle star with cross arms
    disc(x, y, 1.6, r, g, b);
    thickLine(x - 5, y, x + 5, y, 0.8, r, g, b);
    thickLine(x, y - 5, x, y + 5, 0.8, r, g, b);
  } else {
    disc(x, y, rand() < 0.7 ? 1 : 1.7, r, g, b);
  }
}

// ---------- 3. spiral galaxy: 3 arms bursting upward ----------
const GCX = 512;
const GCY = 470;
const armColors: [number, number, number][] = [
  [255, 64, 200], // magenta
  [64, 220, 255], // cyan
  [255, 200, 64], // gold
];
// bright core glow
softDisc(GCX, GCY, 70, 255, 240, 200, 0.55);
softDisc(GCX, GCY, 38, 255, 250, 230, 0.8);
softDisc(GCX, GCY, 16, 255, 255, 255, 0.95);
for (let arm = 0; arm < 3; arm++) {
  const base = (arm * Math.PI * 2) / 3;
  const col = armColors[arm];
  for (let i = 0; i < 520; i++) {
    const t = i / 519;
    const ang = base + t * Math.PI * 3.4;
    const rad = 26 + t * 285;
    const spread = 6 + t * 34;
    const ox = (rand() + rand() + rand() - 1.5) * spread;
    const oy = (rand() + rand() + rand() - 1.5) * spread;
    const x = GCX + Math.cos(ang) * rad + ox;
    const y = GCY + Math.sin(ang) * rad * 0.92 + oy;
    const size = 1.2 + rand() * 2.6 * (1 - t * 0.5);
    const alpha = 0.35 + rand() * 0.5;
    softDisc(x, y, size, col[0], col[1], col[2], alpha);
    if (rand() < 0.22) setPixel(x, y, 255, 255, 255);
  }
}

// ---------- 4. pavement: 3 rows of grey slabs ----------
const rows: [number, number][] = [
  [640, 758],
  [758, 876],
  [876, 1024],
];
const joints: number[][] = [
  [180, 420, 700, 900],
  [90, 330, 560, 800],
  [220, 480, 760],
];
for (let ri = 0; ri < 3; ri++) {
  const [y0, y1] = rows[ri];
  let prevX = 0;
  const js = [...joints[ri], W];
  for (const jx of js) {
    const shade = 100 + Math.floor(rand() * 22);
    fillRect(prevX, y0, jx, y1, shade, shade + 4, shade + 10);
    prevX = jx;
  }
  // horizontal joint line
  fillRect(0, y0, W, y0 + 3, 66, 68, 76);
  for (const jx of joints[ri]) {
    fillRect(jx - 1, y0, jx + 2, y1, 66, 68, 76);
  }
}

// ---------- 5. branching cracks from the sprout base ----------
function crackWalk(x: number, y: number, angle: number, steps: number, width: number, depth: number): void {
  let cx = x;
  let cy = y;
  let a = angle;
  for (let i = 0; i < steps; i++) {
    const len = 9 + rand() * 7;
    const nx = cx + Math.cos(a) * len;
    const ny = cy + Math.sin(a) * len;
    thickLine(cx, cy, nx, ny, width, 38, 38, 46);
    cx = nx;
    cy = ny;
    a += (rand() - 0.5) * 0.7;
    if (depth < 2 && rand() < 0.3) {
      crackWalk(cx, cy, a + (rand() < 0.5 ? 0.9 : -0.9), Math.floor(steps * 0.45), Math.max(1, width - 1), depth + 1);
    }
    if (cy > 1010) break;
  }
}
crackWalk(512, 644, Math.PI / 2 + 0.5, 16, 3, 0); // down-left
crackWalk(512, 644, Math.PI / 2, 20, 3, 0); // straight down
crackWalk(512, 644, Math.PI / 2 - 0.5, 15, 3, 0); // down-right
crackWalk(512, 644, Math.PI, 8, 2, 0); // along the slab seam, left
crackWalk(512, 644, 0, 8, 2, 0); // along the slab seam, right

// ---------- 6. the sprout: bezier stem, two leaves, one bud ----------
const P0: [number, number] = [512, 648];
const P1: [number, number] = [498, 585];
const P2: [number, number] = [516, 512];
for (let i = 0; i <= 40; i++) {
  const t = i / 40;
  const mt = 1 - t;
  const x = mt * mt * P0[0] + 2 * mt * t * P1[0] + t * t * P2[0];
  const y = mt * mt * P0[1] + 2 * mt * t * P1[1] + t * t * P2[1];
  const r = lerp(6.5, 3, t);
  const gcol: [number, number, number] = [
    Math.round(lerp(26, 96, t)),
    Math.round(lerp(110, 205, t)),
    Math.round(lerp(46, 105, t)),
  ];
  disc(x, y, r, gcol[0], gcol[1], gcol[2]);
}
// leaves (solid green)
ellipse(486, 580, 46, 19, -0.62, 52, 168, 76);
ellipse(542, 568, 50, 21, 0.62, 70, 190, 92);
// bud at the tip
disc(516, 508, 11, 140, 235, 130);
disc(516, 503, 6, 195, 250, 175);

// REVISI 2 — two-tone leaves: lighter highlight + midrib and veins
ellipse(478, 572, 30, 11, -0.62, 110, 215, 120);
ellipse(550, 560, 32, 12, 0.62, 130, 225, 140);
// left leaf: midrib along the major axis, two veins branching off
thickLine(454, 603, 518, 557, 1, 30, 120, 50);
thickLine(478, 588, 466, 570, 1, 30, 120, 50);
thickLine(496, 574, 508, 592, 1, 30, 120, 50);
// right leaf: midrib along the major axis, two veins branching off
thickLine(510, 591, 574, 545, 1, 40, 135, 60);
thickLine(534, 572, 522, 554, 1, 40, 135, 60);
thickLine(552, 560, 564, 578, 1, 40, 135, 60);

// REVISI 2 — gold pollen sparkles drifting up from the sprout
function sparkle(cx: number, cy: number, s: number): void {
  thickLine(cx - s, cy, cx + s, cy, 1, 255, 210, 90);
  thickLine(cx, cy - s, cx, cy + s, 1, 255, 210, 90);
  disc(cx, cy, 1.6, 255, 235, 150);
}
for (let i = 0; i < 26; i++) {
  const x = 380 + rand() * 280;
  const y = 360 + rand() * 260;
  sparkle(x, y, 3 + rand() * 5);
}

// ---------- 7. speech bubble: "WATCH THIS" in a 5x7 bitmap font ----------
const FONT: Record<string, string[]> = {
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", ".#.#.", ".#.#."],
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
};

function drawText(text: string, x0: number, y0: number, scale: number, r: number, g: number, b: number): void {
  let cx = x0;
  for (const ch of text) {
    const glyph = FONT[ch] ?? FONT[" "];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col] === "#") {
          fillRect(cx + col * scale, y0 + row * scale, cx + (col + 1) * scale, y0 + (row + 1) * scale, r, g, b);
        }
      }
    }
    cx += 6 * scale;
  }
}

function roundRect(x0: number, y0: number, x1: number, y1: number, rad: number, r: number, g: number, b: number): void {
  fillRect(x0 + rad, y0, x1 - rad, y1, r, g, b);
  fillRect(x0, y0 + rad, x1, y1 - rad, r, g, b);
  disc(x0 + rad, y0 + rad, rad, r, g, b);
  disc(x1 - rad, y0 + rad, rad, r, g, b);
  disc(x0 + rad, y1 - rad, rad, r, g, b);
  disc(x1 - rad, y1 - rad, rad, r, g, b);
}

const BX0 = 600;
const BY0 = 52;
const BX1 = 968;
const BY1 = 172;
// tail pointing down-left toward the sprout tip
fillRect(640, BY1 - 2, 716, BY1 + 2, 250, 250, 252);
for (let i = 0; i < 90; i++) {
  const t = i / 90;
  const x = lerp(648, 560, t);
  const y = BY1 + t * 92;
  const half = lerp(34, 2, t);
  fillRect(x - half, y, x + half, y + 2, 250, 250, 252);
}
roundRect(BX0, BY0, BX1, BY1, 18, 250, 250, 252);
// border
thickLine(BX0 + 18, BY0, BX1 - 18, BY0, 2, 40, 40, 55);
thickLine(BX0 + 18, BY1, BX1 - 18, BY1, 2, 40, 40, 55);
thickLine(BX0, BY0 + 18, BX0, BY1 - 18, 2, 40, 40, 55);
thickLine(BX1, BY0 + 18, BX1, BY1 - 18, 2, 40, 40, 55);
const label = "WATCH THIS";
const scale = 4;
const textW = label.length * 6 * scale - scale;
drawText(label, Math.round((BX0 + BX1 - textW) / 2), Math.round((BY0 + BY1 - 7 * scale) / 2), scale, 24, 24, 48);

// ---------- PNG encoder: CRC32 + per-row filter choice + zlib 9 ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function encodePNG(): Buffer {
  const stride = W * 3;
  const raw = Buffer.alloc(H * (stride + 1));
  let prev: Buffer | null = null;
  for (let y = 0; y < H; y++) {
    const row = img.subarray(y * stride, (y + 1) * stride);
    let best: Buffer | null = null;
    let bestF = 0;
    let bestScore = Infinity;
    for (let f = 0; f <= 4; f++) {
      const out = Buffer.alloc(stride);
      for (let x = 0; x < stride; x++) {
        const v = row[x];
        const left = x >= 3 ? row[x - 3] : 0;
        const up = prev ? prev[x] : 0;
        const upLeft = x >= 3 && prev ? prev[x - 3] : 0;
        let pred = 0;
        if (f === 1) pred = left;
        else if (f === 2) pred = up;
        else if (f === 3) pred = Math.floor((left + up) / 2);
        else if (f === 4) pred = paeth(left, up, upLeft);
        out[x] = (v - pred) & 0xff;
      }
      let score = 0;
      for (let x = 0; x < stride; x++) {
        const s = out[x] >= 128 ? out[x] - 256 : out[x];
        score += s < 0 ? -s : s;
      }
      if (score < bestScore) {
        bestScore = score;
        best = out;
        bestF = f;
      }
    }
    raw[y * (stride + 1)] = bestF;
    best!.copy(raw, y * (stride + 1) + 1);
    prev = row;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";
fs.mkdirSync(outDir, { recursive: true });
const png = encodePNG();
const outPath = path.join(outDir, "image.png");
fs.writeFileSync(outPath, png);
console.log(`wrote ${outPath} (${png.length} bytes)`);
