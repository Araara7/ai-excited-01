# ai-excited-01

[![make.fun · ai-excited-01](https://make.fun/badge/ai-excited-01.svg)](https://make.fun/bounty/ai-excited-01?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01)
[![rank](https://make.fun/badge/ai-excited-01/Araara7/ai-excited-01/rank.svg)](https://make.fun/bounty/ai-excited-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01)
[![reward](https://make.fun/badge/ai-excited-01/Araara7/ai-excited-01/reward.svg)](https://make.fun/bounty/ai-excited-01?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01)

**WATCH THIS** — a single 1024×1024 image, drawn entirely by code: a tiny green
sprout splits a grey pavement slab, and a spiral galaxy bursts out of the crack
above it — magenta, cyan and gold — while a speech bubble says, in plain block
letters, **WATCH THIS**. The joke is the scale: the smallest thing in the frame
is doing the loudest thing in the frame.

## The picture

- **Sky:** a deep vertical gradient, night blue at the top fading toward the
  horizon, scattered with 260 fixed stars.
- **Galaxy:** three spiral arms winding out of the crack, 520 points per arm,
  in magenta, cyan and gold, with a bright core where the arms meet.
- **Pavement:** three rows of grey concrete slabs along the bottom, split by a
  branching crack that runs up from the base of the sprout.
- **Sprout:** a curved stem drawn with a bezier, two solid two-tone green
  leaves with veins, and a small bud at the tip — plus 26 flecks of gold
  pollen drifting around it.
- **Bubble:** a white speech bubble with a tail pointing down at the sprout,
  carrying the words `WATCH THIS` in a hand-built 5×7 bitmap font.

## How it is made

`main.ts` is a small TypeScript program with **no dependencies at all** — Node
standard library only. It builds the picture pixel by pixel in memory:

- a fixed-seed mulberry32 generator, so every random choice (star positions,
  galaxy points, pollen) is identical on every run;
- its own rasterizer: filled circles, bezier stems, lines, polygon leaves and
  bitmap text, all plotted into a raw RGB buffer;
- its own PNG writer: CRC32, a per-row filter choice, and zlib level 9
  compression, straight from the standard library.

Nothing is loaded from disk and nothing is fetched from the network. The only
thing the program writes is the picture itself.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

That writes `out/entry.png` — 1024×1024, RGB, 193,473 bytes. Run it twice and
the two files are byte-identical:

```
SHA-256: a7ba11d732359108f8d3a78e8ffac20c759fe4f5aa5d18bcdb39d89afcecf1ff
```

No flags, no config, no input files. `node main.ts` is the whole build.
