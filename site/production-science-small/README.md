# Production science, small · 12.9/min

**Qualified.** Measured over a full native run of the exact published string (SHA-256 `ae647ce198f052363255ec0613a20060a5af7f96b37c058e6dfa5ee3c6995c73`), fed exactly the panel figures: **12.80 production science packs per minute steady and 13.20 per minute in recovery**. The target is 12.86 (90/7) and the pass bar is 12.21 (95%).

A quick, small module that makes only production science packs (purple packs) and sends them out east on one red belt. Two assembling machines make the packs; five more make the electric furnaces, productivity modules, rails and iron sticks inside and hand them over machine to machine. Six materials come in on the west, already smelted and supplied: steel plates, stone bricks, stone, iron plates, electronic circuits and advanced circuits. The circuits can come from the library's green-circuit supplier (360 per minute) and advanced-circuit supplier (187.5 per minute); one copy of each covers this module many times over.

## Target

Computed from the 2.1.24 prototype dump by the generator (`targetDerivation` in `manifest.json`):

- Production science pack: 21 s per craft, 3 packs per craft. An assembling machine 2 (speed 0.75) takes 28 s, so it makes **6.43 packs per minute**.
- The size is the request: two science machines, so the target is what two make: **12.86 per minute** (90/7). The panels and the library round it to 12.9.
- Per minute at the target (4.29 science crafts): 4.29 electric furnaces, 4.29 productivity modules, 128.6 rails (64.3 crafts) and 64.3 iron sticks (32.1 crafts).
- Machines needed (exact / built): electric furnace 0.48 / 1, productivity module 1.43 / 2, rail 0.71 / 1, iron stick 0.36 / 1. Every count is the smallest whole number; the generator refuses any other.

## Inputs (west)

Each material has its own entrance belt on the west edge, a display panel above or below it with its figure, and may arrive on both lanes. Inside, the strip side-loads every two entrances onto one belt, one material per lane.

| Entrance tile | Material | Panel / min | Drawn in the native run / min | Shares a belt with |
| --- | --- | --- | --- | --- |
| (0, 15) | Steel plate | 107.1 | 107.1 | stone bricks (row 17, then row 1) |
| (0, 17) | Stone brick | 42.9 | 42.9 | steel plates |
| (0, 11) | Stone | 64.3 | 64.3 | iron plates (row 16) |
| (0, 13) | Iron plate | 32.1 | 32.1 | stone |
| (0, 2) | Electronic circuit | 21.4 | 21.4 | advanced circuits (row 0) |
| (0, 0) | Advanced circuit | 42.9 | 42.9 | electronic circuits |

No fluids. Extra supply simply backs up at the entrances.

## Output (east)

One red belt exit at (13, 6), a straight tile fed from behind. Both science machines drop their packs on the north lane (384 packs in the 30-minute window, all on that lane). When nothing takes them the exit tile holds **4** and every machine stops.

## Size and machines

- Footprint **14 x 18 = 252 tiles** (19.6 tiles per pack per minute).
- 7 assembling machine 2: 2 production science pack, 2 productivity module, 1 electric furnace, 1 rail, 1 iron stick. No modules in them, no beacons, no robots, no circuit wires.
- 9 fast and 9 long-handed inserters (hand size 1, set in the blueprint), 83 red belts, 2 red underground belts, 1 substation, 6 display panels: 117 entities.

```
    0 > v > > > > > > > > > > . .   circuits: advanced (north lane) | electronic (south lane), east
    1 D > ^ . . . < < < < < < < <   steel | brick, back west from the east column, ends at the furnace maker
    2 > ^ . l . . f l f . . l . ^
    3 D . M M M . F F F . M M M ^   M productivity module, F electric furnace
    4 . . M M M . F F F . M M M ^
    5 . . M M M . F F F . M M M u
    6 . . . . . > > > > > > > > >   packs, exit at (13, 6); steel | brick passes under it
    7 . . . . l f l . l f l . . U   long arms hand modules and furnaces down; fast arms drop the packs
    8 . . P P S S S . S S S . . ^   S production science pack (two machines), P the substation
    9 . . P P S S S . S S S . . ^
   10 D . . . S S S . S S S . . ^
   11 > > v . . . f . f . . . . ^   rails into both science machines
   12 D . > v . . R R R . K K K ^   R rail, K iron stick (hands sticks west into R)
   13 > > ^ v . . R R R f K K K ^
   14 D . . v . . R R R . K K K ^
   15 > v . v . . l f l . . f . ^
   16 D > v > > > > > > > > > . ^   stone | iron, east
   17 > ^ > > > > > > > > > > > ^   steel | brick, east, then north up column 13
```

`>` `<` `^` `v` belts, `U` / `u` underground entry / exit, `f` fast arm, `l` long-handed arm, `D` display panel. Columns count from the west edge (0); the entrances are column 0.

## How it works

- **Offset machines.** Each science machine shares one column with each machine above it and with the rail maker below it. So a single arm reaches from the module maker, the furnace maker or the rail maker straight into it: M1 and F feed S1 (left), F and M2 feed S2 (right), and R feeds both. The furnace maker (4.3 per minute needed, 9 possible) and the rail maker (128.6 rails per minute needed, 180 possible) each serve both science machines; each module maker serves one (3 per minute possible, 2.14 needed).
- **Over the pack belt.** Row 6 runs between the top machines and the science machines. The hand-offs across it are long-handed arms (row 7, two tiles each way); the two fast arms beside them put the packs on it.
- **Belts.** Row 0 carries both circuits to all three top machines. The steel and brick belt is made in the bottom-left corner, feeds the rail maker's steel on row 17, climbs column 13 (under the exit) and comes back west on row 1 to the furnace maker, which takes its steel and bricks there with two fast arms. Bricks ride past the rail maker unused; on its own lane they only back up, so they never block steel. Row 16 carries stone to the rail maker and iron to the stick maker.
- **No hoarding.** Arms into a machine stop when it holds enough for its next crafts: at the end of the steady window the science machines held 60 rails, 2 furnaces and 1 or 2 modules each, the rail maker nothing waiting (native report, `machines[].input`). The science machines were working in every one of the 1,800 status samples.
- **Power.** One substation at tiles (2..3, 8..9) reaches every machine and arm.
- No ring, no chest, no wire: `loopControl: []`, `stockControl.mode: "belt-exit"`.

What to preserve: the offset positions of the seven machines, the long-handed arms on rows 2, 7 and 15, the underground pair under the exit, and the dead ends of rows 0, 1 and 16.

## Native evidence

- Report: `native-report.json`, `passed: true`, for the exact `blueprintSha256` in `manifest.json`. Factorio 2.1.24 Space Age headless with a private config and mod directory (`.cache/production-science-small/`). Prototype SHA-256 `ce40aee67d984865f22ed8e65ba6b93fefb014fc35e45b747b64aca3ed5682a3`.
- Protocol: 15 min warm-up, 30 min steady, **30 min blocked** (collection stopped), 5 min settle, 10 min recovery.
- Harness: `scripts/production-science-small/control.lua`, a copy of the processing-unit supplier's (same phases, feeding, collection and checks). Each belt entrance gets its panel figure / 3600 items of credit per tick (capped at 8), one item at a time on alternating lanes. Nothing else is ever written. Collection: both lanes of the exit tile every 4 ticks, except while blocked. Once a second the exit tile is read for any item other than production science packs.
- Measured:
  - Steady 12.80/min, recovery 13.20/min (pass bar 12.21). Made in the window: 12.80/min.
  - Entrances drew steel 107.1, brick 42.9, stone 64.3, iron 32.1, electronic circuits 21.4 and advanced circuits 42.9 per minute.
  - All 7 machines crafted. Per machine per minute: science 2.13 and 2.13 (machine maximum 2.14), electric furnace 4.30, productivity modules 2.13 and 2.13, rail 64.3 crafts, iron stick 32.2 crafts.
  - No item other than production science packs ever stood on the exit tile (`wrongItemsAtExit: {}`).
  - The exit held exactly 4 at the end of the blocked phase (never more), and no machine crafted in the blocked phase's last minute.
- `configurationSha256` hashes the harness payload without the manifest's `status` and `measured` fields, so it can be reproduced from the committed manifest.

The 80% feed run (exploration mode, full phase lengths, kept as `underfed-report.json`; not a qualification):

| Run | Result |
| --- | --- |
| Every entrance fed 80% of its panel figure | 10.30 steady (80.1% of the target), 10.80 recovery; entrances drew 85.7, 34.3, 51.4, 25.7, 17.1 and 34.3 per minute; every machine crafted, nothing but packs at the exit, exit 4 when blocked and every machine stopped: no jam. The left science machine ran full (64 crafts in 30 minutes) and the right one took what was left (38). |

## Reproduce

From `factorio-command-center/`:

```
node scripts/production-science-small/generate.mjs        # writes production-science-small.txt and manifest.json
node scripts/production-science-small/validate.mjs        # full protocol at the panel figures, writes native-report.json
PS_EXPLORE=1 PS_FEED_SCALE=0.8 PS_KEEP_UNDERFED=1 PS_WARMUP=15 PS_MEASURE=30 PS_BLOCKED=30 PS_SETTLE=5 PS_RECOVERY=10 node scripts/production-science-small/validate.mjs
node scripts/production-science-small/generate.mjs        # same string; status and measured figures from the reports
node --test tests/production-science-small.test.mjs
node scripts/production-science-small/ascii.mjs           # the tile map above
```

The generator keeps the committed string when a regeneration decodes to the same blueprint, so a zlib build that compresses differently does not change the SHA-256. `PS_EXPLORE=1` with `PS_WARMUP`, `PS_MEASURE`, `PS_BLOCKED`, `PS_SETTLE` and `PS_RECOVERY` (minutes) runs a short screen into `.cache/production-science-small/explore-report.json`; it never touches `native-report.json`. `PS_SOURCE=<dir>` validates a candidate in another folder.
