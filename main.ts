// WATCH THIS — a sprout cracks the pavement and a galaxy bursts out.
// Deterministic procedural renderer: Node stdlib only, fixed seed, own PNG encoder.
// Run: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Output: <out>/entry.png — 1024x1024 RGB PNG, byte-identical across runs.

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32, fixed seed). No Math.random / Date anywhere.
// ---------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function (): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20261116);

// ---------------------------------------------------------------------------
// Pixel buffer (RGB) + drawing helpers
// ---------------------------------------------------------------------------
const px = new Uint8Array(W * H * 3);

function setPx(x: number, y: number, r: number, g: number, b: number): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = r;
  px[i + 1] = g;
  px[i + 2] = b;
}

function blendPx(x: number, y: number, r: number, g: number, b: number, a: number): void {
  if (a <= 0) return;
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  if (a >= 1) {
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    return;
  }
  px[i] = Math.round(px[i] * (1 - a) + r * a);
  px[i + 1] = Math.round(px[i + 1] * (1 - a) + g * a);
  px[i + 2] = Math.round(px[i + 2] * (1 - a) + b * a);
}

// Soft disc (radial falloff) — used for stars, glow, galaxy dots.
function disc(cx: number, cy: number, rad: number, r: number, g: number, b: number, alpha: number): void {
  const x0 = Math.max(0, Math.floor(cx - rad));
  const x1 = Math.min(W - 1, Math.ceil(cx + rad));
  const y0 = Math.max(0, Math.floor(cy - rad));
  const y1 = Math.min(H - 1, Math.ceil(cy + rad));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / rad;
      if (d >= 1) continue;
      const fall = (1 - d * d) * alpha;
      blendPx(x, y, r, g, b, fall);
    }
  }
}

function fillRect(x0: number, y0: number, x1: number, y1: number, r: number, g: number, b: number): void {
  for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
      setPx(x, y, r, g, b);
    }
  }
}

// Bresenham line with a given thickness (drawn as small discs along the line).
function thickLine(x0: number, y0: number, x1: number, y1: number, w: number, r: number, g: number, b: number): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  for (let s = 0; s <= steps; s++) {
    const t = steps === 0 ? 0 : s / steps;
    disc(x0 + dx * t, y0 + dy * t, w / 2, r, g, b, 1);
  }
}

// Filled polygon (scanline) — used for the speech-bubble tail.
function fillPoly(pts: Array<[number, number]>, r: number, g: number, b: number): void {
  let minY = H;
  let maxY = 0;
  for (const p of pts) {
    if (p[1] < minY) minY = Math.floor(p[1]);
    if (p[1] > maxY) maxY = Math.ceil(p[1]);
  }
  for (let y = Math.max(0, minY); y <= Math.min(H - 1, maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const c = pts[(i + 1) % pts.length];
      if ((a[1] <= y && c[1] > y) || (c[1] <= y && a[1] > y)) {
        const t = (y - a[1]) / (c[1] - a[1]);
        xs.push(a[0] + t * (c[0] - a[0]));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.max(0, Math.ceil(xs[k])); x <= Math.min(W - 1, Math.floor(xs[k + 1])); x++) {
        setPx(x, y, r, g, b);
      }
    }
  }
}

// Rounded rectangle, filled.
function roundRect(x0: number, y0: number, x1: number, y1: number, rad: number, r: number, g: number, b: number): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const cx = Math.min(Math.max(x, x0 + rad), x1 - rad);
      const cy = Math.min(Math.max(y, y0 + rad), y1 - rad);
      const d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
      if (d <= rad) setPx(x, y, r, g, b);
    }
  }
}

// ---------------------------------------------------------------------------
// 1. Sky: deep indigo gradient + stars
// ---------------------------------------------------------------------------
function drawSky(): void {
  for (let y = 0; y < H; y++) {
    const t = y / H;
    // indigo top -> dark violet -> warm dusk haze near the horizon
    const r = Math.round(10 + 46 * t * t);
    const g = Math.round(10 + 26 * t * t);
    const b = Math.round(46 + 34 * t);
    for (let x = 0; x < W; x++) setPx(x, y, r, g, b);
  }
  // stars
  for (let i = 0; i < 260; i++) {
    const x = rng() * W;
    const y = rng() * 700;
    const bright = 120 + Math.floor(rng() * 135);
    const rad = rng() < 0.85 ? 1 : 2;
    disc(x, y, rad, bright, bright, Math.min(255, bright + 20), 0.55 + rng() * 0.45);
  }
}

// ---------------------------------------------------------------------------
// 2. Spiral galaxy bursting upward (3 arms, magenta / cyan / gold)
// ---------------------------------------------------------------------------
const GALAXY: Array<[number, number, number]> = [
  [255, 47, 214], // magenta
  [25, 227, 255], // cyan
  [255, 210, 62], // gold
];

function drawGalaxy(): void {
  const cx = 512;
  const cy = 392;
  // core glow
  for (let r = 150; r > 0; r -= 6) {
    const a = 0.05 + 0.22 * (1 - r / 150);
    disc(cx, cy, r, 255, 240, 250, a * 0.35);
  }
  disc(cx, cy, 34, 255, 255, 255, 0.9);
  disc(cx, cy, 18, 255, 245, 220, 1);
  // spiral arms
  const arms = 3;
  for (let arm = 0; arm < arms; arm++) {
    const off = (arm * Math.PI * 2) / arms;
    for (let s = 0; s < 520; s++) {
      const t = s / 520; // 0 core -> 1 rim
      const ang = off + t * Math.PI * 4.4;
      const rad = 14 + 268 * Math.pow(t, 0.92);
      const jx = (rng() - 0.5) * (10 + 34 * t);
      const jy = (rng() - 0.5) * (8 + 26 * t);
      const x = cx + Math.cos(ang) * rad + jx;
      const y = cy + Math.sin(ang) * rad * 0.6 + jy;
      const col = GALAXY[(arm + Math.floor(t * 3)) % 3];
      const size = 1.2 + (1 - t) * 3.4 + rng() * 1.6;
      const alpha = 0.35 + (1 - t) * 0.6;
      disc(x, y, size, col[0], col[1], col[2], alpha);
      // occasional bright spark on the arm
      if (rng() < 0.06) disc(x, y, size + 2.5, 255, 255, 255, 0.8);
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Pavement: grey slabs with joints + speckle, horizon at y = 720
// ---------------------------------------------------------------------------
function drawPavement(): void {
  const top = 720;
  // base
  for (let y = top; y < H; y++) {
    for (let x = 0; x < W; x++) setPx(x, y, 96, 99, 106);
  }
  // slab shading: columns 256 wide, rows split at 836 and 934
  const rows: Array<[number, number]> = [
    [top, 836],
    [837, 934],
    [935, H - 1],
  ];
  for (const [ry0, ry1] of rows) {
    for (let c = 0; c < 4; c++) {
      const shade = Math.floor((rng() - 0.5) * 22);
      const x0 = c * 256;
      const x1 = Math.min(W - 1, x0 + 255);
      for (let y = ry0; y <= ry1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = (y * W + x) * 3;
          px[i] = Math.max(0, Math.min(255, px[i] + shade));
          px[i + 1] = Math.max(0, Math.min(255, px[i + 1] + shade));
          px[i + 2] = Math.max(0, Math.min(255, px[i + 2] + shade));
        }
      }
    }
  }
  // speckle
  for (let i = 0; i < 5200; i++) {
    const x = Math.floor(rng() * W);
    const y = top + Math.floor(rng() * (H - top));
    const v = rng() < 0.5 ? -14 : 12;
    const idx = (y * W + x) * 3;
    px[idx] = Math.max(0, Math.min(255, px[idx] + v));
    px[idx + 1] = Math.max(0, Math.min(255, px[idx + 1] + v));
    px[idx + 2] = Math.max(0, Math.min(255, px[idx + 2] + v));
  }
  // joints
  thickLine(0, 836, W - 1, 836, 3, 52, 54, 60);
  thickLine(0, 934, W - 1, 934, 3, 52, 54, 60);
  for (let c = 1; c < 4; c++) thickLine(c * 256, top, c * 256, H - 1, 3, 52, 54, 60);
  // horizon highlight
  thickLine(0, top, W - 1, top, 2, 150, 153, 160);
}

// ---------------------------------------------------------------------------
// 4. Crack in the pavement, splitting around the sprout
// ---------------------------------------------------------------------------
function drawCrack(): void {
  let x = 512;
  let y = 720;
  let px0 = x;
  let py0 = y;
  while (y < 1000) {
    const step = 16 + rng() * 16;
    const drift = (rng() - 0.5) * 46;
    x += drift;
    y += step;
    thickLine(px0, py0, x, y, 4, 38, 40, 46);
    px0 = x;
    py0 = y;
    // branch
    if (rng() < 0.35) {
      let bx = x;
      let by = y;
      const dir = rng() < 0.5 ? -1 : 1;
      for (let b = 0; b < 4; b++) {
        const nx = bx + dir * (14 + rng() * 18);
        const ny = by + 12 + rng() * 14;
        thickLine(bx, by, nx, ny, 2.5, 38, 40, 46);
        bx = nx;
        by = ny;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Sprout: curved stem + two leaves + bud, rising from the crack
// ---------------------------------------------------------------------------
function drawSprout(): void {
  // stem as quadratic bezier from (512,722) to (500,548), control (548,640)
  const p0: [number, number] = [512, 722];
  const p1: [number, number] = [548, 640];
  const p2: [number, number] = [500, 548];
  const N = 60;
  for (let s = 0; s <= N; s++) {
    const t = s / N;
    const x = (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0];
    const y = (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1];
    const rad = 7.5 - 4.5 * t;
    disc(x, y, rad, 46, 168, 80, 1);
    disc(x - 1.5, y - 1.5, rad * 0.55, 96, 214, 122, 0.9);
  }
  // leaves: solid-filled rotated ellipses (two-tone green, darker rim, vein)
  function leaf(cx: number, cy: number, rx: number, ry: number, ang: number): void {
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const x0 = Math.floor(cx - rx - 2);
    const x1 = Math.ceil(cx + rx + 2);
    const y0 = Math.floor(cy - ry - 2);
    const y1 = Math.ceil(cy + ry + 2);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const lx = dx * cos + dy * sin;
        const ly = -dx * sin + dy * cos;
        const q = (lx * lx) / (rx * rx) + (ly * ly) / (ry * ry);
        if (q > 1) continue;
        if (q < 0.45) setPx(x, y, 104, 220, 130);
        else if (q < 0.85) setPx(x, y, 52, 186, 92);
        else setPx(x, y, 34, 148, 72);
      }
    }
    // vein
    const vx = Math.cos(ang);
    const vy = Math.sin(ang);
    thickLine(cx - vx * rx * 0.8, cy - vy * rx * 0.8, cx + vx * rx * 0.8, cy + vy * rx * 0.8, 2, 30, 130, 62);
  }
  leaf(478, 636, 34, 13, -0.55);
  leaf(540, 606, 36, 14, 0.5);
  // bud on top
  disc(500, 544, 8, 120, 226, 140, 1);
  disc(498, 541, 4, 190, 245, 200, 1);
  // golden pollen sparkles drifting around the sprout
  for (let i = 0; i < 26; i++) {
    const px2 = 470 + rng() * 90;
    const py2 = 540 + rng() * 180;
    const gold = rng() < 0.6;
    disc(px2, py2, 1 + rng() * 1.6, gold ? 255 : 120, gold ? 210 : 230, gold ? 62 : 255, 0.6 + rng() * 0.4);
  }
}

// ---------------------------------------------------------------------------
// 6. Speech bubble with bitmap text "WATCH THIS"
// ---------------------------------------------------------------------------
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
          fillRect(cx + col * scale, y0 + row * scale, cx + col * scale + scale - 1, y0 + row * scale + scale - 1, r, g, b);
        }
      }
    }
    cx += 6 * scale;
  }
}

function drawBubble(): void {
  const x0 = 556;
  const y0 = 52;
  const x1 = 976;
  const y1 = 198;
  const ink: [number, number, number] = [20, 32, 74];
  // outline (bigger shape behind)
  roundRect(x0 - 4, y0 - 4, x1 + 4, y1 + 4, 30, ink[0], ink[1], ink[2]);
  fillPoly(
    [
      [648, y1 + 2],
      [592, 252],
      [700, y1 + 2],
    ],
    ink[0],
    ink[1],
    ink[2],
  );
  // white body
  roundRect(x0, y0, x1, y1, 26, 255, 255, 255);
  fillPoly(
    [
      [652, y1 - 1],
      [600, 244],
      [694, y1 - 1],
    ],
    255,
    255,
    255,
  );
  // text: "WATCH THIS" — 10 glyphs, scale 6 -> 10*36-6 = 354 px wide
  drawText("WATCH THIS", x0 + 33, y0 + 52, 6, ink[0], ink[1], ink[2]);
}

// ---------------------------------------------------------------------------
// PNG encoder (own CRC32 + per-row filter choice, zlib deflate level 9)
// ---------------------------------------------------------------------------
const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
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

function encodePng(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = W * 3;
  const raw = Buffer.alloc((stride + 1) * H);
  const prev = new Uint8Array(stride);
  for (let y = 0; y < H; y++) {
    const row = px.subarray(y * stride, (y + 1) * stride);
    let bestFilter = 0;
    let bestScore = Infinity;
    let best: Buffer | null = null;
    for (let f = 0; f <= 4; f++) {
      const out = Buffer.alloc(stride);
      let score = 0;
      for (let x = 0; x < stride; x++) {
        const v = row[x];
        const a = x >= 3 ? row[x - 3] : 0;
        const b = prev[x];
        const c = x >= 3 ? prev[x - 3] : 0;
        let pred = 0;
        if (f === 1) pred = a;
        else if (f === 2) pred = b;
        else if (f === 3) pred = Math.floor((a + b) / 2);
        else if (f === 4) pred = paeth(a, b, c);
        const d = (v - pred) & 0xff;
        out[x] = d;
        score += Math.abs(d >= 128 ? d - 256 : d);
      }
      if (score < bestScore) {
        bestScore = score;
        bestFilter = f;
        best = out;
      }
    }
    raw[y * (stride + 1)] = bestFilter;
    (best as Buffer).copy(raw, y * (stride + 1) + 1);
    prev.set(row);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main(): void {
  drawSky();
  drawGalaxy();
  drawPavement();
  drawCrack();
  drawSprout();
  drawBubble();
  const png = encodePng();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "out";
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "entry.png");
  fs.writeFileSync(outPath, png);
  console.log(`wrote ${outPath} (${png.length} bytes, ${W}x${H})`);
}

main();
