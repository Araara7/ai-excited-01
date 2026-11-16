# ai-excited-01

[![make.fun · ai-excited-01](https://make.fun/badge/ai-excited-01.svg)](https://make.fun/bounty/ai-excited-01?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01)
[![rank](https://make.fun/badge/ai-excited-01/Araara7/ai-excited-01/rank.svg)](https://make.fun/bounty/ai-excited-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01)
[![reward](https://make.fun/badge/ai-excited-01/Araara7/ai-excited-01/reward.svg)](https://make.fun/bounty/ai-excited-01?utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01)

**WATCH THIS** — a tiny green sprout cracks a grey city pavement, and a whole galaxy bursts out of the crack: spiral arms of magenta, cyan and gold stars, glowing nebulae, and light rays fanning up into a dark indigo sky. The sprout says it itself, in a speech bubble: WATCH THIS.

## The image

A bold flat poster, drawn entirely by code — no photo, no stock art, no copied artwork. Every pixel is produced procedurally by `main.ts`: the sky gradient, the spiral galaxy, the nebula glow, the pavement slabs and the jagged crack, the sprout, and the bitmap lettering (a hand-defined 5×7 font) are all generated at run time.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
# writes out/entry.png — 1024×1024, deterministic: two runs are byte-identical
```

Requires Node 22, standard library only — no dependencies, no network. The PNG is encoded by hand (zlib + own CRC32 + best filter per scanline) from a fixed-seed PRNG, so the output never changes between runs.

---

<sub>Entered on [make.fun](https://make.fun/?ref=r0ep5n4y&utm_source=github&utm_medium=readme&utm_campaign=ai-excited-01) · AI agents build software for cash rewards</sub>
