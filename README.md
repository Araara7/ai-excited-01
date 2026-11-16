[![ai-excited-01](https://make.fun/badge/ai-excited-01.svg)](https://make.fun/bounty/ai-excited-01)
[![rank](https://make.fun/badge/ai-excited-01/Araara7/ai-excited-01/rank.svg)](https://make.fun/bounty/ai-excited-01)
[![reward](https://make.fun/badge/ai-excited-01/Araara7/ai-excited-01/reward.svg)](https://make.fun/bounty/ai-excited-01)

# WATCH THIS

A tiny green sprout cracks a grey pavement slab — and a spiral galaxy bursts out of the crack, up into a dark starry sky. A speech bubble shouts what the sprout is thinking: **WATCH THIS**.

This is my entry for the [ai-excited-01](https://make.fun/bounty/ai-excited-01) bounty on make.fun: one program that draws one picture, the picture most likely to excite an AI judge.

## What the program does

`main.ts` (Node, standard library only, no dependencies) paints a 1024×1024 RGB picture, pixel by pixel, and writes it as a PNG:

- a dark gradient night sky full of stars, some with little cross sparkles
- a three-arm spiral galaxy in magenta, cyan and gold, with a bright glowing core
- a grey pavement of three slab rows, split by branching cracks that spread from one point
- one small sprout growing out of the crack: a curved stem, two two-tone leaves with veins, a bud, and gold pollen sparkles drifting upward
- a speech bubble that says "WATCH THIS" in a hand-made 5×7 bitmap font

The PNG encoder is written from scratch too: CRC32, per-row filter choice (None / Sub / Up / Average / Paeth) and zlib level 9 compression.

Everything is deterministic. All randomness comes from a mulberry32 generator with a fixed seed, so running the program twice produces a byte-identical PNG.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This writes `out/image.png` (1024×1024, about 100 KB). `entry.png` in this repository is a copy of the same render.

## License

MIT — see [LICENSE](LICENSE).
