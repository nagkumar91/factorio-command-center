# Advanced-circuit supplier · 187.5/min

**Qualified.** Measured over a full native run of the exact published string (SHA-256 `f385a03666dba97907209d7a254303bfdb54b1609f4ef22a0891bd350f0c5766`) with every entrance throttled to its panel figure: **187.5 advanced circuits per minute steady and 187.5 per minute in recovery**. The target is 187.5 and the pass bar is 178.1 (95%). Fed 80% of every panel figure, the same string made 150.0 per minute (149.9 in recovery).

This module turns copper plates, iron plates and plastic bars into advanced (red) circuits and sends them out east on one red belt. It makes its own copper cable and electronic circuits inside. It is the sibling of `green-circuits`; like it, it takes smelted inputs only (no ore, no fluids).

## Target

The six ground science packs at 30 of each per minute use 185 advanced circuits per minute (computed by `generate.mjs` from the 2.1.24 prototype dump, every recipe chain followed down; recorded as `manifest.targetDerivation`):

| Chain | Advanced circuits per minute |
| --- | ---: |
| chemical science pack (3 per 2 packs) | 45 |
| production science pack > electric furnace (5 per furnace, 1 furnace per 3 packs) | 50 |
| production science pack > productivity module (5 per module, 1 module per 3 packs) | 50 |
| utility science pack > processing unit (2 per unit, 2 units per 3 packs) | 40 |
| **total** | **185** |

Automation, logistic and military packs use none. One assembling machine 2 makes 7.5 a minute (6 s recipe, speed 0.75), so 185 needs 24.7 machines; rounded up to **25 machines = 187.5 per minute**. 185 lies inside 60..240, so the 120-per-minute fallback does not apply.

## Size and machines

- Footprint **66 x 14 = 924 tiles**: **4.93 tiles per circuit per minute** (the green supplier is 0.475 per green circuit; an advanced circuit takes twelve times as long to craft and needs ten cable and two green circuits, so the figures are not comparable machine for machine: here it is 22.5 tiles per machine, there 17.1).
- 41 assembling machine 2: **25 advanced circuit, 5 electronic circuit, 11 copper cable** (10.4 cable machines needed). No modules, no beacons.
- Arms: 71 fast, 37 long-handed, 9 bulk (hand 2), all at the baseline research (fast hand 1, bulk hand 2). Belts: 219 red belts and 26 red underground belts. 5 substations (one is the power connection, the other four are wired to it), 4 display panels. 412 entities. No chests, no combinators, no wires but the substation copper wires.

```
    012345678901234567890123456789012345678901234567890123456789012345
  0 D>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>v...>>>>>>>>>>>>>>>>>>>>>   top plate belt (copper | iron), then the top collector to the exit (65,0)
  1 >^<f...f..f...f..f...f..f...f..f...f..f..f...f..f..f..f..f..f..f.u   top outer arms
  2 >>^CCC.EEECCC.EEECCC.EEECCC.EEECCC.EEECCCCCC.RRRRRRRRRRRRRRRRRRRRR
  3 D..CCCbEEECCCbEEECCCbEEECCCbEEECCCbEEECCCCCC.RRRRRRRRRRRRRRRRRRRRR   top machine row
  4 D..CCC.EEECCC.EEECCC.EEECCC.EEECCC.EEECCCCCC.RRRRRRRRRRRRRRRRRRRRR
  5 >v...SSlf.....fl.SS..fl.....fl.lSS.fl.llllll.fl.flSSflfl.flSSflfl.   top aisle arms
  6 .>>>USSu>U..u>>>USSu>>>>>>>>>>>USSu>>>>>>>>>>>>>>USSu>>>>>USSu>>^U   X1: plastic (north lane) | electronic circuits (south lane)
  7 .^>>U..u>>>>>>>>U..u>>>>>>>>>>>U..u>>>>>>>>>>>>>>U..u>>>>>U..u>>v^   X2: copper cable (both lanes)
  8 ..bb....bb..fl.fl..flfl.fl.fl.fl..flfl.fl.fl.fl.fl..flfl.fl..flflu   bottom aisle arms
  9 CCCCCCCCCCCCRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR
 10 CCCCCCCCCCCCRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR   bottom machine row
 11 CCCCCCCCCCCCRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR
 12 Df.f..f..f..f..f..f..f..f..f..f..f..f..f..f..f..f..f..f..f..f..f.U   bottom outer arms
 13 >>>>>>>>>^..>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>^   bottom plate belt (copper), then the bottom collector
```

`C` copper cable, `E` electronic circuit, `R` advanced circuit, `f` fast arm, `l` long-handed arm, `b` bulk arm, `U`/`u` underground entry/exit, `S` substation, `D` display panel, arrows are belts. `node scripts/advanced-circuits/ascii.mjs` prints this map.

## Inputs (west)

| Entrance | Tile | Demand per minute (panel) | Where it goes |
| --- | --- | ---: | --- |
| `copper-plate` (upper) | (0,1) | 600 | Side-loads the north-facing tile (1,1) from the west; (1,0) turns it east onto the north lane of the top plate belt (row 0). The 7 top cable machines take it there. |
| `iron-plate` | (0,2) | 375 | Runs (1,2) east, (2,2) north, (2,1) west and side-loads (1,1) from the east: the south lane of the top plate belt. The 5 circuit machines take it there. |
| `plastic-bar` | (0,5) | 375 | Turns south at (1,5) and side-loads the start of X1 (1,6) from the north: X1's north lane. The red-circuit machines take it from X1. |
| `copper-plate` (lower) | (0,13) | 337.5 | Straight onto the bottom plate belt (row 13). The 4 bottom cable machines take it there. |

Copper enters twice because the cable machines sit in both rows; the two copper panels add up to the recipe demand, 937.5. Each entrance may carry its item on both lanes or on one. Display panels at (0,0), (0,3), (0,4) and (0,12) label them. Electricity goes in at any substation; `ports` names the one at (5..6, 5..6).

Supply at exactly the panel figures is enough: fed 600 / 375 / 375 / 337.5 per minute, the module made 187.5 per minute and drew exactly those figures. Fed 80% of each, it made 150.0 per minute and did not jam. Fed more, the surplus backs up on the entrance belts (a saturated exploration run made 187.5 and drew up to 360 on the lower copper entrance; the two copper entrances share their work differently then, the total stays 937.5).

## Output (east)

One red belt exit at **(65,0)** on the top row, a straight tile fed from behind by the top collector. The bottom collector climbs the last column (65) under both machine rows (undergrounds (65,12)->(65,8) and (65,6)->(65,1)) and side-loads the exit from the south.

- Cap **7**: when nothing takes circuits, the exit holds 4 on its north lane (fed from behind) and 3 on its south lane (side-loaded), and every machine stops. Measured in the full run, and again with 30 blocked minutes.
- Lanes: **52.5 per minute on the north lane** (the 7 top red-circuit machines) and **135 on the south lane** (the 18 bottom ones), measured over the 30-minute window.
- Nothing but advanced circuits ever reached the exit (`exitForeignItems: []`, checked every second of every phase).

Sharing one red belt (1,800 per minute, 900 per lane), lane sums only: four copies joined lane for lane fill the south lane to 540 of 900; side-loaded from alternating sides, each copy puts all 187.5 on one lane, so four copies per lane, eight per belt. One copy covers the 185 per minute of 30-per-minute ground science.

## How it works

- **Two machine rows and one aisle.** The aisle has four rows: arm row 5, belt X1 (row 6), belt X2 (row 7), arm row 8. A top machine reaches X1 with a fast arm and X2 with a long-handed arm; a bottom machine the other way round. Arms drop on the far lane, so everything dropped from the top lands on south lanes and everything from the bottom on north lanes; the lanes are assigned so that no lane ever carries two items: X1 north = plastic (entrance), X1 south = electronic circuits (top circuit machines), X2 south = cable (top cable machines), X2 north = cable (bottom cable machines).
- **Each machine row also has an outer side.** West of the red-circuit machines the outer belt is a plate belt that dead-ends (top: copper and iron, bottom: copper); east of them it is a collector for the product. The plate belts end in a tile turned into their last arm ((41,0) south, (9,13) north), so plates never reach a collector.
- **Electronic circuits.** Each of the 5 circuit machines has its own cable machine to its west that hands it all its cable (180 per minute) through one bulk arm in the gap column. The circuit machine needs 225 per minute at 75 circuits per minute; it tops up from X2 with a long-handed arm, takes iron from the top plate belt and drops circuits on X1's south lane with a fast arm.
- **Cable for the aisle.** Two top cable machines drop cable on X2 with three long-handed arms each; four bottom cable machines drop it with one bulk arm each. The bottom ones sit at the west end, under the circuit machines, so the circuit machines' top-ups and the first red-circuit machines are downstream of a cable source.
- **Red circuits.** Each of the 25 machines takes circuits and plastic from X1 and cable from X2 (one fast and one long-handed arm, about 30 items a minute each) and drops its product on its outer collector with one fast arm.
- **The last cable machine of a pair has a spare outlet.** With plates fed at exactly the panel figures the westmost circuit machines take a little more iron than 75 a minute (they also get a little more cable), so the last circuit machine runs short of iron about half the time. Its cable machine therefore also drops spare cable on X2 with one long-handed arm instead of stopping on a full output; without that arm the build drew less copper than its panel figure and made 184 a minute instead of 187.5 (see Candidates).
- **Power.** Five substations stand in two-column holes of the aisle at columns 5, 17, 32, 50 and 59; X1 and X2 pass under each hole on underground pairs. Each hole lies on a machine boundary (or over a cable machine's free columns) so that no machine loses an arm it needs.
- **Belts that would run with nothing to do are buried**: X1 and X2 under the holes and under untouched runs of four or more columns, and the climbing collector.

What to preserve: the plate filters on the 16 plate arms, the bulk arms of the five pairs, the spare-cable arm of the last pair, the stub at (1,7) (it is the second side input that keeps (1,6) a straight tile, so plastic goes on one lane and never meets the circuits), the merge at (1,1) with its two side inputs, the underground pairs, the dead ends of the plate belts and of X1 ((64,6) north) and X2 ((64,7) south).

### Machine rates (30-minute window, entrances at the panel figures)

| Machines | Per minute each |
| --- | --- |
| 25 advanced circuit | 7.5 each, `working` at all 1,800 one-second samples |
| 5 electronic circuit, west to east | 82.5, 83.7, 82.5, 82.5, 43.7 (total 375) |
| 11 copper cable (cable per minute) | 8 at 180; the last pair's 170; one top long-arm machine 130; one bottom bulk machine 135 (total 1,875) |

The intermediate machines are not all at full rate, by design and by the feed: 10.4 cable machines' worth of copper is shared by 11, and the circuit machines share iron first come, first served. The qualification therefore asks every advanced-circuit machine to work at least 95% of the time and every other machine to craft; it does not ask the intermediates to run flat out.

## Native evidence

- Report: `native-report.json`, `passed: true`, for the exact `blueprintSha256` in `manifest.json`. Factorio 2.1.24 Space Age headless with a private config and mod directory (`.cache/advanced-circuits/`). Prototype SHA-256 `ce40aee67d984865f22ed8e65ba6b93fefb014fc35e45b747b64aca3ed5682a3`.
- Protocol: 15 min warm-up, 30 min steady, **10 min blocked** (collection stopped, entrances still fed; 10 rather than 5 because the two collectors and the machines' output slots take more than three minutes to fill: a 3-minute block in exploration left machines still crafting), 5 min settle, 10 min recovery.
- Feeding (the harness of `concrete-supplier`, CONTRACT section 11 item 4): each entrance gets a credit of perMinute/3600 per tick, capped at 8, and one item per credit on alternating lanes. The same game runs a second copy of the string on its own surface fed 80% of every figure (`underfed` in the report). Nothing else is written; no inventory is seeded.
- Checks (`checks` in the report, all true): finished; steady and recovery at least 178.1; every machine crafted; every advanced-circuit machine working at least 95% of the measured seconds; every entrance reached a machine that used its item and drew no more than its panel figure; output delivered; only advanced circuits ever at the exit; exit exactly 7 when blocked and never more; no machine crafted in the blocked phase's last minute; power and geometry as imported; bulk hands at most 2; the underfed copy made 95..103% of 150 before and after its blocked phase, drew no more than 80% of the panels and also held 7.
- Measured: 187.5 steady, 187.5 recovery; entrances 600.0 / 375.0 / 375.0 / 337.5 per minute; exit lanes 52.5 north and 135 south; exit 7 at the end of the blocked phase; underfed 150.0 steady and 149.9 in recovery.

Exploration runs on the same string (`AC_EXPLORE=1`, not qualifications, not stored here):

| Run | Result |
| --- | --- |
| Entrances saturated, full phase lengths | 187.5 steady, 187.5 recovery, exit 7, nothing foreign at the exit |
| 1 minute of warm-up, 30 minutes blocked | 187.2 steady, exit 7 at the end of the block and never more, machines stopped, 187.5 recovery |

## Candidates

All candidates are 66 x 14 (the topology below); they differ in the spare-cable arms. Each was generated and run natively with the harness in exploration mode (10 min warm-up, 10 min steady, 8 min blocked).

| Candidate | Result |
| --- | --- |
| No spare-cable arm | 184.0 steady, 186.0 recovery. The last pair's cable machine stopped on a full output almost half the time, the upper copper entrance drew 589.6 of 600, and the last top red-circuit machine was short of cable (54% working). Its exit held 7, not the 8 first declared. Rejected. |
| A spare-cable arm on every pair's cable machine | 170.4 steady. The spare arms took cable the circuit machines needed: every circuit machine fell to about 68 a minute. Rejected. |
| A spare-cable arm on the last pair only | 187.5 steady, 186.4 recovery in exploration; then qualified with the full protocol. **Published.** |

Topologies weighed on paper and not built (estimates; none was run natively):

- Cable handed straight from cable machines to red-circuit machines through gap arms: a red-circuit machine needs only 30 cable a minute, so a cable machine between two red-circuit machines runs at a third of its rate and every red-circuit machine needs a gap column. About 18 cable machines and 172 machine columns over two rows: roughly 86 x 13 = 1,100 tiles.
- A green-supplier-style producer block west of a red-circuit strip: the block needs the same 14 rows to hand its belts to the strip, and two rows of 8 producers leave the red-circuit rows' space under them unused: roughly 940 to 980 tiles.
- Cable on the outer belts with the product in the aisle (no climbing collector): needs seven input lanes (two copper, iron, plastic, circuits and two cable) and the layout offers six; with circuit machines in one row only, the plate/product boundary of the shared aisle belt leaves a 30-column dead area. Not buildable in 14 rows.
- Three aisle belts (15 rows) so circuit machines can sit in both rows: about 65 x 15 = 975 tiles.

### Compaction round (2026-11-22)

Goal: at least 10% under 924 tiles (831 or fewer), same interface, target and protocol. Two further topologies were built and screened natively (same exploration phases as above, entrances at their panel figures). Neither is smaller, so the 66 x 14 string stays published, unchanged.

| Candidate | Size | Measured (exploration) | Outcome |
| --- | --- | --- | --- |
| **Four machine rows, back to back** (`node scripts/advanced-circuits/stack.mjs`): two halves of this layout share one outer row; its west part is the copper belt of both halves' bottom cable machines, its east part one collector both bottom rows drop on, ending at the exit (35,13); each half's top collector climbs down or up the last column and side-loads the exit. 6 circuit machines (3 per half, each half feeds its own aisle), 12 cable, 25 red-circuit; 6 substations. | 36 x 27 = **972** | 181.5 steady, 188.2 recovery; exit held 8; the last north red-circuit machine was short of ingredients (28% working) and two entrances drew below their panels | Rejected: 5% larger. Sharing the middle row saves one outer row per pair of machine rows, but the outermost rows still need theirs and each half needs its own circuit machines and plate merge. |
| **Green-supplier chain in the top row** (`--variant green-chain`): the five circuit machines in one chain `C E C E C E C E C E C`, as in `green-circuits` (end cable machines hand over with a bulk arm, inner ones with a fast arm to each side). | 69 x 14 = **966** | 164.6 steady, 176.4 recovery; one circuit machine stopped on a full output for the whole window | Rejected: larger (ten gap columns instead of five) and failed the rate. |

Estimated on paper and not built, because each estimate is above 831:

- **Producer-only outer rows (no outer belt) around a shared collector** (23 rows for four machine rows): an aisle shared by a cable-machine row and a red-circuit row has exactly four lanes (copper and cable on one belt, circuits and plastic on the other), so the outer rows can hold cable machines only. The circuit machines need iron and must sit in the inner rows, and all 25 red-circuit machines must sit in the two inner rows (the only rows next to a collector): about 55 x 23 = 1,265 tiles.
- **Product on a lane of the aisle** (the top row all red-circuit machines dropping on the far lane of the near aisle belt, which ends in a filter splitter; 12 or 13 rows): with the top row's outer belt gone, the aisle and the bottom plate belt offer six lanes for seven streams (product, circuits, cable, plastic, iron, and copper, which at 937.5 a minute needs two lanes); the 13-row version also has the red-circuit machines at the west end of the top row upstream of every circuit and cable machine, which starves them. About 65 to 68 x 13 = 845 to 884 tiles, before the splitter and its exit columns.
- **A woven three-row aisle** (one belt in the middle row, the other two weaving through the arm rows on underground pairs, 13 rows): a top machine can then only reach the belt woven through the bottom arm row and the other way round, so the top red-circuit machines can only get cable from top-row cable machines, and every top cable machine blocks the aisle under it. About 77 x 13 = 1,000 tiles.

Why 66 x 14: the columns are fixed by packing. The top row needs 3 columns of plate merge, 35 for the five pairs, 6 for two long-arm cable machines; the bottom row 12 for four cable machines; plus 75 for 25 red-circuit machines: 131 columns over two rows, at least 66. 14 rows are two machine rows (6), a four-row aisle (a fast and a long-handed arm per side need two belt rows and an arm row each side) and an outer arm row and belt row per machine row (the product cannot share an aisle lane: the four aisle lanes already carry plastic, circuits and cable, and a top and a bottom machine always drop on opposite lanes).

## Reproduce

From `factorio-command-center/`:

```
node scripts/advanced-circuits/generate.mjs        # variant outer-exits; writes advanced-circuits.txt and manifest.json
node scripts/advanced-circuits/validate.mjs        # full protocol plus the 80% copy, writes native-report.json (about 20 s)
node scripts/advanced-circuits/generate.mjs        # same string; status and measured from the matching report
node --test tests/advanced-circuits.test.mjs
```

`AC_EXPLORE=1` with `AC_WARMUP`, `AC_MEASURE`, `AC_BLOCKED`, `AC_SETTLE` and `AC_RECOVERY` (minutes) runs a short screen and writes `.cache/advanced-circuits/explore-report.json`; `AC_SATURATE=1` saturates the entrances (exploration only), `AC_DEBUG=1` adds belt contents, `AC_SOURCE=<dir>` validates a candidate generated with `--out <dir>`. The generator needs the pinned prototype dump (`FACTORIO_RAW`); the unit test skips only its regeneration check without it. zlib's bytes differ between platforms, so the generator keeps the committed `advanced-circuits.txt` whenever it decodes to exactly the blueprint it builds; the unit test also checks that a fresh encoding decodes to the committed blueprint.

Compaction screens: `node scripts/advanced-circuits/generate.mjs --variant green-chain --out <dir>`; `node scripts/advanced-circuits/stack.mjs --out <dir>` (builds the halves `stack-half-north` and `stack-half-south` with `--module-out` and joins them); then `AC_EXPLORE=1 AC_SOURCE=<dir> node scripts/advanced-circuits/validate.mjs`.

Power is placed by `scripts/advanced-circuits/power.mjs`, a copy of `scripts/green-circuits/power.mjs` (substations only, inside the rectangle). The harness `control.lua` is the `concrete-supplier` harness with a per-build feed scale, per-lane exit counts and the foreign-item check at the exit.
