# Green-circuit supplier · 360/min

**Qualified.** Measured over a full native run of the exact published string (SHA-256 `9a0f0a9910a8c59420929ea1c53e83232d40c1a8e2641bfdac23ce0b96e84845`): **360.0 electronic circuits per minute steady and 360.0 per minute in recovery**. The target is 360 and the pass bar is 342 (95%).

This module turns iron plates and copper plates into electronic (green) circuits and sends them out east on one red belt. It is the companion of `essentials-mall`, `robot-essentials` and `six-science`, which take electronic circuits as a supplied input.

It replaces the 19 x 10 version of 2026-11-20 (`history/twin-belt-21af4618/`). The two entrances and the exit are on the same tiles as before, so it drops into the same place; the rectangle is one row shorter at the bottom. One thing differs at the exit: the lanes are no longer equal (see Output).

## Size and machines

- Footprint **19 x 9 = 171 tiles**: 0.475 tiles per circuit per minute. That is 10% under the previous 190-tile version, and under the 364-tile baseline (Luna compact circuits 360), the 286-tile goal and the 273-tile stretch goal.
- 10 assembling machine 2: 6 copper cable and 4 electronic circuit. No modules, no beacons.
- Arms: 4 bulk (hand 2) and 18 fast (hand 1). No long-handed arms. Belts: 18 red belts and 8 red underground belts. One substation, 2 display panels. 61 entities (the previous version had 76).

```
  0 C C C . E E E . C C C . E E E . C C C
  1 C C C b E E E f C C C f E E E b C C C
  2 C C C . E E E . C C C . E E E . C C C
  3 > v f D f f . S S f . . . f f . f . .      north arm row
  4 . > > > U > v S S u U v < < u > ^ . .      plate belt, and the two circuit drop tiles
  5 > ^ f D f f > > U f u > U f f . f u >  ->  south arm row and the circuit belt, exit at (18,5)
  6 C C C . E E E . C C C . E E E . C C C
  7 C C C b E E E f C C C f E E E b C C C
  8 C C C . E E E . C C C . E E E . C C C
```

`C` copper cable, `E` electronic circuit, `b` bulk arm, `f` fast arm, `U`/`u` underground entry/exit, `S` substation, `D` display panel, arrows are belts.

## Inputs (west)

| Entrance | Tile | Nominal demand | Where it goes |
| --- | --- | ---: | --- |
| `copper-plate` | (0,3), upper | 540/min | Turns south at (1,3) and side-loads onto the north lane of the plate belt (row 4). The 6 cable machines take it from there. |
| `iron-plate` | (0,5), lower | 360/min | Turns north at (1,5) and side-loads onto the south lane of the plate belt. The 4 circuit machines take it from there. |

Each entrance may carry plates on both lanes or on one; the blueprint puts each material on its own lane. Display panels at (3,3) and (3,5) label the entrances, each on its entrance's row. Electricity goes in at the substation on tiles (7..8, 3..4), the single power connection.

Supply at exactly the panel figures is enough: fed 540 copper and 360 iron per minute, the module made 360.0 per minute (see Native evidence). Fed less, it makes proportionally less (288 per minute at 80%) and does not jam.

## Output (east)

One red belt exit at (18,5), a straight tile fed from behind by the underground exit at (17,5). Cap: when nothing takes circuits, the exit tile holds 8 and every machine stops.

**The lanes are not equal: 270 per minute on the north lane and 90 on the south lane** (8,100 and 2,700 circuits in the 30-minute window). The previous version had 180 on each. The cause is the merge at (11,5): the east pair's circuits join by side-load and all land on the north lane, on top of half of the west pair's.

What that means when copies share one red belt (1,800 per minute, 900 per lane). These are lane sums, not native runs:

- Side-loading each copy's exit onto the shared belt puts that copy on one lane whatever its own lanes are. Two copies per lane fit (720 of 900), so four copies per belt, the same as before.
- Joining copies lane for lane (in-line splitters) fills the north lane at three copies (810 of 900). The previous version allowed five that way. Three is what `six-science` needs.
- If equal lanes matter, use `history/single-aisle-even-lanes/`: 20 x 9 = 180 tiles, 180 per minute on each lane, qualified with the same protocol. Its exit is on tile (19,4).

## Copies needed

Each consumer's demand at its target, divided by the measured 360 per minute:

| Consumer | Circuits per minute | Copies |
| --- | ---: | ---: |
| six-science | 900 | 3 (1,080 supplied) |
| robot-essentials | 145 | 1 |
| essentials-mall | 84 at its floors (up to about 150 with one product drawn alone) | 1 |
| all three together | 1,129 | 4 (1,440 supplied) |

## How it works (no circuit network needed)

- There are two mirrored rows of `C E C E C` (cable, circuit, cable, circuit, cable), on rows 0..2 and 6..8. Between them is one aisle of three rows.
- Cable never touches a belt. Each outer cable machine gives all its cable (180/min) to its neighbouring circuit machine through one bulk arm. The middle cable machine gives 90/min to each side through one fast arm per side. Each circuit machine therefore gets 2 cable from the bulk arm and 1 from the fast arm for every craft, which is exactly the 3 a circuit needs. The hand sizes fix the split, so neither side can take all of the middle machine's cable.
- The plate belt runs along row 4, copper on the north lane and iron on the south lane. Every machine takes its plate through one filtered fast arm: the top row's arms stand on row 3 and the bottom row's on row 5, in the same column, so one belt tile serves two machines. The five plate tiles are (2,4), (4,4), (9,4), (14,4) and (16,4). Three of them are underground belt ends; arms pick from those as from any belt.
- Each pair of circuit machines drops its circuits through two fast arms onto one tile of row 4: (5,4) for the west pair and (13,4) for the east pair. The plate belt dives under both: from (4,4) to (9,4), which also passes under the substation, and from (10,4) to (14,4).
- The circuit belt cannot stay on row 4, so it uses the free tiles of row 5 and dives under the arms there. West pair: (5,4), down column 6, east along row 5, under the middle cable machine's arm from (8,5) to (10,5), to the merge tile (11,5). East pair: (13,4) runs **west** to the gap column, turns south at (11,4) and side-loads the merge tile. From (12,5) the belt dives under the last three arms to (17,5), and the exit (18,5) is the next tile.
- The plate belt ends in a dead-end curve at (16,4), facing north into the last copper arm, so plates never reach the circuit belt or the exit.
- One substation is enough: no arm stands east of column 16, so the hole at (7..8, 3..4) reaches all of them. The previous version needed two.
- No ring, no chest, no wire: `loopControl: []`, `stockControl.mode: "belt-exit"`.

What to preserve: the bulk arms (override stack 2) at the outer cable machines, the fast arms (override stack 1) at the middle ones, the plate filters on the ten input arms, the four underground pairs, and the dead-end curve at (16,4). The cable supply is exact (1,080 made, 1,080 used), so replacing a gap arm with another type breaks the 2:1 split. Each input arm moves 90 plates per minute, 75% of the contract's 120 per minute planning figure for a fast arm on a belt and under its 85% limit.

## Native evidence

- Report: `native-report.json`, `passed: true`, for the exact `blueprintSha256` in `manifest.json`. Factorio 2.1.24 Space Age headless with a private config and mod directory. Prototype SHA-256 `ce40aee67d984865f22ed8e65ba6b93fefb014fc35e45b747b64aca3ed5682a3`.
- Protocol: 15 min warm-up, 30 min steady, 5 min blocked (collection stopped, nothing injected), 5 min settle, 10 min recovery. It is the protocol that qualified the previous version, with the same pass formula.
- Feeding: one plate per lane every 4 ticks into each entrance belt; nothing else is ever written. Collection: both lanes of the exit tile every 4 ticks, except while blocked.
- Measured:
  - Steady 360.0/min and recovery 360.0/min.
  - Each of the 10 machines made 2,700 crafts in the 30-minute window, its full rate, and reported `working` at all 1,800 one-second samples.
  - The entrances took 540.0 copper and 360.0 iron per minute.
  - The exit delivered 8,100 circuits on its north lane and 2,700 on its south lane (`outputPorts[0].collectedByLane`).
  - The exit held exactly 8 at the end of the blocked phase (never more), and no machine crafted in the blocked phase's last minute.
  - Bulk hands never went above 2.
- `configurationSha256` hashes the harness payload without the manifest's `status` and `measured` fields, so it can be reproduced from the committed manifest.

Behaviour the protocol does not cover, measured in the 2026-11-21 review with the same harness in exploration mode (full phase lengths; these runs are not qualifications and are not stored here):

| Run | Result |
| --- | --- |
| Entrances fed at exactly 540 copper and 360 iron per minute | 360.0 steady, 360.0 recovery, every machine 2,700 crafts |
| The same with only 1 minute of warm-up | 360.0 steady, 360 in every minute of the window |
| Fed at 80% (432 and 288) | 288.0 steady; the east machines slow down, nothing jams |
| Fed at 98% (529 and 353) | 352.7 steady |
| Every plate on one lane of each entrance (either lane) | 360.0 steady |
| Blocked for 30 minutes instead of 5 | exit 8, machines stopped, 360.0 in recovery |

`ESSENTIALS_EXPLORE=1 GC_WARMUP=15 GC_MEASURE=30 GC_BLOCKED=5 GC_SETTLE=5 GC_RECOVERY=10 GC_FEED="copper-plate=540,iron-plate=360" node scripts/green-circuits/validate.mjs` repeats the first row.

## Reproduce

From `factorio-command-center/`:

```
node scripts/green-circuits/generate.mjs                        # variant single-aisle; writes green-circuits.txt and manifest.json
node scripts/green-circuits/validate.mjs                        # full protocol, writes native-report.json
node scripts/green-circuits/generate.mjs                        # same string; status from the matching report
node --test tests/green-circuits.test.mjs
```

`ESSENTIALS_EXPLORE=1` with `GC_WARMUP`, `GC_MEASURE`, `GC_BLOCKED`, `GC_SETTLE` and `GC_RECOVERY` (minutes) runs a short screen. It writes `.cache/green-circuits/explore-report.json` and never touches this folder. In exploration runs only, `GC_FEED="copper-plate=540,iron-plate=360"` feeds each entrance at that exact rate; a qualification run always saturates both lanes of both entrances and refuses `GC_FEED`. `GC_SOURCE=<dir>` validates a candidate in another folder. `node scripts/green-circuits/ascii.mjs [dir]` prints a tile map.

Power is placed by `scripts/green-circuits/power.mjs`, a copy of `scripts/five-science/power.mjs` (`powerFiveLayout`) with one addition: an optional `within` rectangle, so the helper cannot put a substation outside the footprint. It picks the hole at (7..8, 3..4) by itself.

## Versions

All runs used the full protocol. Every folder under `history/` holds the string, its manifest, its report and a note.

| Variant | Size | Result |
| --- | --- | --- |
| `reference` (the spec layout) | 21 x 13 = 273 | 360/360 per minute, but the side-loaded exit tile held 6, not 8, while blocked. `history/side-loaded-exit/`. |
| `compact-side-loaded-exit` | 19 x 13 = 247 | Same rates and the same failure: the exit held 6. No folder was kept. |
| `reference-straight-exit` | 22 x 13 = 286 | Passed; superseded. `history/straight-exit-east-column/`. |
| `compact` | 19 x 13 = 247 | Passed. Published first. `history/outer-output-belts/`. |
| `twin-belt` | 19 x 10 = 190 | Passed. Published 2026-11-20, replaced for size. Exit lanes 180 and 180. `history/twin-belt-21af4618/`. |
| `single-aisle-even-lanes` | 20 x 9 = 180 | Passed. Exit lanes 180 and 180, exit on (19,4). Not published: 9 tiles larger. `history/single-aisle-even-lanes/`. |
| `single-aisle` | 19 x 9 = 171 | Passed; published. Exit lanes 270 and 90. |

## Why it stops at 19 x 9

- Width 19 is five machines and four one-tile gaps, and the gaps carry the direct cable hand-off.
- Nine rows are two machine rows and a three-row aisle. A fast arm needs its own tile between machine and belt on each side of the belt, so the aisle cannot be two rows.
- Equal exit lanes were not found in 19 x 9. Both pairs drop their circuits on row 4 and can only leave it toward the same arm row, so a side-load puts them on the same lane. The one merge that keeps the pairs on separate lanes (side-loads from opposite sides) holds 6 when blocked and needs a twentieth column for a straight exit tile. That is `single-aisle-even-lanes`.

## Review notes (2026-11-21)

The 2026-11-20 review said a 9-row version would need copper, iron and circuits on one two-lane belt. That holds for one unbroken belt in the aisle. This version keeps two separate belts in the three aisle rows by letting each dive under the other's surface tiles, so no lane ever carries two item types.

- Checked first: the 190-tile version regenerated to the same string, its report matched, and a fresh full run gave the same numbers. It had no defect.
- The harness (`control.lua`) now also counts the exit per lane and has the exploration-only exact feed. The phases, the feeding of a qualification run, the collection and the pass formula are unchanged.
- The unit test follows every belt from tile to tile: plates reach all five plate tiles and never the exit, circuits from all four drop arms reach the exit, and the two belts share no tile.
- Independent check (Opus 5.5): a fresh full-protocol run on the exact 171-tile string passed 12 of 12 and matched the committed report field for field. The string is unchanged by the follow-up.
- One shared sentence was out of date and was changed at release. The essentials guide page for this build (written by `scripts/essentials-pages.mjs`, a shared file this family does not own) said "One red belt carries up to five copies' output." With exit lanes of 270 and 90 per minute, that conflicted with the setup note above it (four copies per belt, side-loaded from alternating sides). The release replaced it with: "One red belt carries four copies' output side-loaded from alternating sides, two per lane (each exit carries 270 per minute on its north lane and 90 on its south lane)." Before release, a private rehearsal of `npm run build` then `npm test` gave 423 tests and 0 failures, both with the prototype dump (416 pass, 7 skipped) and without it (408 pass, 15 skipped).
