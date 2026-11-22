# Processing-unit supplier · 27/min

**Qualified.** Measured over a full native run of the exact published string (SHA-256 `45ca98789920e034aa366451697bc62210e75be7bc666c07bcf99270ca1166b3`), fed exactly the panel figures: **26.83 processing units per minute steady and 26.80 per minute in recovery**. The target is 27 and the pass bar is 25.65 (95%).

This module turns copper plates, iron plates, plastic bars and sulfuric acid into processing units (blue circuits) and sends them out east on one red belt. It makes its own copper cable, electronic circuits and advanced circuits inside. It is the sibling of `green-circuits`, and a place to take processing units from for the blueprints that need them (utility science, `rocket-supplies`).

It replaces the 31 x 29 version published earlier on 2026-11-22 (`history/twin-rows-abe14cdf/`). Same machines, same entrance tiles and the same exit tile (30,16). It is one row shorter, and its exit carries processing units on both lanes and holds 8, not 4.

| | Before (`twin-rows`) | Now (`shared-channel`) |
| --- | --- | --- |
| Size | 31 x 29 = 899 tiles | **31 x 28 = 868 tiles** (3.4% smaller) |
| Tiles per processing unit per minute | 33.3 | **32.1** |
| Steady / recovery (full protocol, panel feed) | 26.57 / 26.50 | **26.83 / 26.80** |
| Exit | south lane only, holds 4 | both lanes, holds 8 |
| Entities | 355 | 333 |

## Target

Computed from the 2.1.24 prototype dump by the generator (`targetDerivation` in `manifest.json`):

- Utility science pack: 3 packs per craft from 2 processing units (and 3 low density structures, 1 flying robot frame). 30 packs per minute = 10 crafts = **20 processing units per minute**.
- `rocket-supplies` (published) makes processing units at **5 per minute** (`targets["processing-unit"]` in its manifest).
- Sum 25 per minute. One assembling machine 2 makes 0.75 / 10 s x 60 = 4.5 per minute, so 25 needs 5.56 machines: **6 machines = 27 per minute**. That is inside 15..60, so it is the target.

## Size and machines

- Footprint **31 x 28 = 868 tiles**: 32.1 tiles per processing unit per minute.
- 35 assembling machine 2: 12 copper cable, 9 electronic circuit, 8 advanced circuit, 6 processing unit. The exact need is 12, 7.2, 7.2 and 5.56 (`recipeAudit.machinesExact`). No modules, no beacons.
- Arms: 67 fast, 9 long-handed, 10 bulk (hand 2). Belts: 107 red belts, 44 red underground belts, 1 red splitter. 24 pipes and 26 pipes-to-ground. 6 substations, 4 display panels. 333 entities.
- For comparison: the green-circuit supplier is 171 tiles for 10 machines (17 tiles per machine); this module is 24.8 tiles per machine. "Why it is this size" says where the difference goes.

```
    0 . . v u . . . U < u . S S . . U < u . . . . . U < . . S S . .
    1 . . v . . . . . f . . S S . . . f . . . . . . . f . . S S . .
    2 D . U C C C . E E E . C C C . E E E . C C C . E E E . C C C .   G row: circuits for the supply belt
    3 > > v C C C b E E E f C C C f E E E f C C C f E E E b C C C .
    4 > v v C C C . E E E . C C C . E E E . C C C . E E E . C C C .
    5 Z Z v . f . . . f . . . f . . . f . . . f . . . f . . . f . .
    6 v U > > > > > > > > > > > > > > > > > > > > > > > > > > > > v   plate belt (aisle 1)
    7 > > ^ . f . . . f . . . f . . . f . . . f . . . f . . . f . U
    8 D u . C C C . E E E . C C C . E E E . C C C . E E E . C C C .   A1
    9 . v u C C C b E E E b C C C f E E E f C C C b E E E b C C C .
   10 D v U C C C . E E E . C C C . E E E . C C C . E E E . C C C .
   11 p v p p f p = p f p = p f p = p f p = p f p = p f p = . f . .   inner row 1: arms and acid header
   12 . v . R R R = P P P . R R R = P P P . R R R = P P P p R R R .   B1
   13 . v . R R R = P P P f R R R = P P P f R R R = P P P f R R R u
   14 D U . R R R f P P P . R R R f P P P . R R R f P P P . R R R U
   15 > > > v l . . f . . . . l . . f l l . . l . . f . . . l . . .   B1 arms
   16 . u u v . S S > U . . . . . u > U . . . . S S u > > > > > > >   processing-unit belt, exit at (30,16)
   17 . v > > U S S u > > > > > > > > > > > > U S S u > > > > . . u   supply belt: circuits | plastic
   18 . > > U f u U l . . u U f u U l f f u U f u U l . . . f u > v   B2 arms; copper's second branch
   19 . . . R R R f P P P . R R R f P P P . R R R f P P P . R R R U   B2
   20 . . . R R R = P P P f R R R = P P P f R R R = P P P f R R R .
   21 . . . R R R = P P P . R R R = P P P . R R R = P P P p R R R .
   22 . . . . f . = p f p = p f p = p f p = p f p = p f p = . f . .   inner row 2
   23 . . . C C C . E E E . C C C . E E E . C C C . E E E . C C C .   A2
   24 . . . C C C b E E E b C C C f E E E f C C C b E E E b C C C .
   25 . . . C C C . E E E . C C C . E E E . C C C . E E E . C C C u
   26 . . . . f S S . f . . . f . . . f . . . f S S . f . . . f . v
   27 . . . . u S S U < < < < < < < < < < < < u S S U < < < < < < <   plate belt (aisle 2)
```

`C` copper cable, `E` electronic circuit, `R` advanced circuit, `P` processing unit (facing west), `b` bulk arm, `f` fast arm, `l` long-handed arm, `U`/`u` underground belt entry/exit, `Z` splitter, `=` pipe, `p` pipe-to-ground, `S` substation, `D` display panel, arrows are belts.

## Inputs (west)

| Entrance | Tile | Demand per minute | Accepted in the measured window | Where it goes |
| --- | --- | ---: | ---: | --- |
| `iron-plate` | (0,3) | 648 | 647.1 | East, then south down column 2; side-loads the north lane of the plate belt at (2,6). |
| `copper-plate` | (0,4) | 1,080 | 1,080.0 | South into the splitter (0..1,5). West branch: side-loads the south lane of the plate belt at (2,6). East branch: down column 1, along row 18 (buried under the arms), side-loads the same copper lane on the east column at (30,18). |
| `sulfuric-acid` (pipe) | (0,11) | 135 | 135.0 | Pipe-to-ground under the copper branch to (2,11), then the header along inner row 1. |
| `plastic-bar` | (0,15) | 108 | 108.0 | East to (3,15), south: side-loads the north lane of the supply belt at (3,17). |

Each belt entrance may carry its item on both lanes. Display panels at (0,2) iron, (0,8) copper, (0,10) acid and (0,14) plastic give the figures. Electricity goes in at any substation; the manifest names the one at (5..6, 16..17) as the power port. "Demand" is the recipe need at 27 per minute. The qualification fed exactly these figures. The machines used 1,076.1 copper, 645.9 iron and 107.3 plastic per minute (production statistics; the rest stood on the belts).

Why copper enters the plate belt twice: one belt lane carries at most 900 items per minute, and the module needs 1,080 copper. The first screen side-loaded all copper onto one lane and made 22.4 per minute (the copper entrance accepted 900). Now the west branch fills the lane for the G and A1 rows (720), and the east branch tops up the same lane after them, on the way down to A2 (360). The splitter needs no setting: when one branch backs up, the other takes the rest.

Fed less, it makes proportionally less. At 80% of every panel figure (864 copper, 518.4 iron, 86.4 plastic, 108 acid) it made 21.57 per minute steady and 21.80 in recovery. Every machine crafted, the exit held 8 when blocked and every machine stopped. Nothing jammed.

## Output (east)

One red belt exit at (30,16), a straight tile fed from behind by (29,16). Processing units arrive on both lanes: B1's arms drop on the south lane of row 16 and B2's long arms drop on its north lane (405 and 400 in the 30-minute window, 13.5 and 13.3 per minute). Cap: when nothing takes them, the exit tile holds **8** and every machine stops.

27 per minute is 3% of one lane, so many copies can share a belt.

## How it works

Three rows of `C E C E C E C` (cable, circuit) and two rows of `R P R P R P R` (advanced circuit, processing unit), each machine in a 4-tile slot (3 tiles of machine, 1 tile of gap).

- **G row (top) and A1** share the plate belt on row 6 (iron on the north lane, copper on the south lane). Every machine takes its plate through one filtered fast arm. **A2** (bottom) has the same plate belt on row 27. The belt reaches it by the east column: down from row 6, buried, past the exit.
- **Cable** never touches a belt. In every circuit row each E takes cable from the C on both sides through the gap arms. In A1 and A2 the outer E's take it through bulk arms from both neighbours, so they get a full 270 per minute first; the middle E gets what is left. Each C in A1 and A2 also hands cable straight down (A1) or up (A2) to the R below or above it (inner rows 11 and 22).
- **Processing units:** each E in A1 / A2 hands its circuits straight to the P below / above it. The R's hand advanced circuits sideways to the P's through the gaps: each outer P gets them from two R's, and the middle P from its two neighbours, which it shares with the outer P's.
- **The channel (rows 15..18)** is four rows: B1's arm row, the processing-unit belt (row 16), the supply belt (row 17) and B2's arm row. B1's arms reach the processing-unit belt with fast arms and the supply belt with long-handed arms; B2's arms reach the supply belt with fast arms and the processing-unit belt with long-handed arms over it.
- **Supply belt (row 17):** the G row's three E's drop their circuits (240 per minute) on row 0. That belt runs west, down the riser in column 2 (buried under the plate and acid crossings) and east along row 17, circuits on its south lane; plastic is side-loaded onto its north lane at (3,17). Every R takes circuits and plastic from it, and the middle P of each row tops up its circuits from it (two arms). The belt ends at (27,17) facing an empty tile, so it never reaches the exit.
- **Acid:** the processing-unit machines face west, so the acid input is in the west gap of each (the dump's fluid box rotates with the machine; checked natively). Each gets acid from a pipe dropped from the header on its inner row. Inner row 1 is the header: pipes in the gap columns and pipe-to-ground pairs under the arms. From its east end a pipe-to-ground pair runs down the gap at x = 26, from (26,12) to (26,21), under the channel, to inner row 2. Circuit, cable and advanced-circuit machines have no fluid boxes with their recipes (checked natively), so the pipes next to them do not connect. The harness confirms that all six processing-unit machines share the entrance's fluid segment.
- **Power:** six substations in holes left where belts are buried (rows 0..1, 16..17 and 26..27, two each).
- No ring, no chest, no wire: `loopControl: []`, `stockControl.mode: "belt-exit"`.

What to preserve: the plate filters on the plate arms; the bulk arms (hand 2) on both sides of the outer E's in A1 and A2; that only the middle P of each row has supply-belt arms; the processing-unit machines facing west; every underground belt and pipe-to-ground pair; the splitter; the empty tile (28,17) after the supply belt's end.

Why only the middle P tops up from the supply belt: in the first screen every P had two supply arms. The western P's then took supply-belt circuits as fast as their own E's could fill them, their E's stood with full output (the A1 west E made 49 per minute instead of 90), and the machines at the east end of the supply belt starved (22.4 per minute in total). With the outer E's fed a full share of cable and only the middle P topping up, the circuits from the G row reach the whole belt.

## Native evidence

- Report: `native-report.json`, `passed: true`, for the exact `blueprintSha256` in `manifest.json`. Factorio 2.1.24 Space Age headless with a private config and mod directory (`.cache/processing-units/`). Prototype SHA-256 `ce40aee67d984865f22ed8e65ba6b93fefb014fc35e45b747b64aca3ed5682a3`.
- Protocol: 15 min warm-up, 30 min steady, **30 min blocked** (collection stopped), 5 min settle, 10 min recovery. The rate-class minimum for the blocked phase is 5 minutes. Here the processing-unit belt and the machines' buffers hold about 200 units before the westmost machines stop, so the protocol blocks for 30.
- Feeding (`scripts/processing-units/control.lua`, from the green supplier's harness with `rocket-supplies`' throttling): each belt entrance gets its panel figure / 3600 items of credit per tick (capped at 8), one item at a time on alternating lanes; the acid entrance gets 135 / 3600 per tick plus what it refused before (carry capped at one second). Nothing else is ever written. Collection: both lanes of the exit tile every 4 ticks, except while blocked. Once a second the exit tile is read for any item other than processing units.
- Measured:
  - Steady 26.83/min and recovery 26.80/min (pass bar 25.65). Made in the window: 26.80/min.
  - Entrances accepted copper 1,080.0, iron 647.1, plastic 108.0 and acid 135.0 per minute.
  - All 35 machines crafted. Per machine (per minute; machine maximum 4.5 for processing units, 7.5 advanced circuits, 90 circuits and cable crafts):
    - Processing unit: 4.4 / 4.5 / 4.4 (B1) and 4.5 / 4.5 / 4.5 (B2).
    - Advanced circuit: 5.7, 7.5, 7.5, 5.9 (B1) and 4.5, 7.5, 7.5, 7.5 (B2). The outer R's wait with full output because each feeds one P.
    - Electronic circuit: G row 88.3, 60.9, 90.0; A1 88.4, 28.5, 87.7; A2 90.0, 22.1, 90.0.
    - Cable: every machine 90.0 except the G row's westmost (88.9) and A2's westmost (87.2).
  - No item other than processing units ever stood on the exit tile (`wrongItemsAtExit: {}`).
  - The exit held exactly 8 at the end of the blocked phase (never more), and no machine crafted in the blocked phase's last minute.
  - Bulk hands never went above 2. All six processing-unit machines on the entrance acid segment.
- `configurationSha256` hashes the harness payload without the manifest's `status` and `measured` fields, so it can be reproduced from the committed manifest.

Runs that are not qualifications (exploration mode, not stored here):

| Run | Result |
| --- | --- |
| Fed 80% of every panel figure, full phase lengths | 21.57 steady, 21.80 recovery; entrances accepted 864, 518.4, 86.4 and acid 108; exit 8, machines stopped, every machine crafted, nothing jammed |

`PU_EXPLORE=1 PU_FEED_SCALE=0.8 PU_WARMUP=15 PU_MEASURE=30 PU_BLOCKED=30 PU_SETTLE=5 PU_RECOVERY=10 node scripts/processing-units/validate.mjs` repeats it.

## Candidates

| Candidate | Size | Result |
| --- | --- | --- |
| `twin-rows`, first version: all copper side-loaded onto one lane of the plate belt, every P topping up from the supply belt, the plate belt turned down the east column without a second copper branch | 30 x 29 = 870 | Short screen (6 + 5 + 3 + 2 + 4 min): 22.4 per minute steady, 22.25 recovery. The copper entrance accepted only 900 per minute (one lane) and the west P's starved the east end of the supply belt. Not kept. |
| `twin-rows` | 31 x 29 = 899 | Five-row channel: one processing-unit belt per row with the supply belt between them; exit on one lane, holds 4. Short screen 26.83 / 26.60; full protocol 26.57 / 26.50, passed. Published first; now in `history/twin-rows-abe14cdf/`. |
| `shared-channel` (published) | 31 x 28 = 868 | Four-row channel, one processing-unit belt on both lanes; acid link down the gap at x = 26. Short screen (10 + 10 + 25 + 3 + 6 min) 26.80 / 26.67; full protocol 26.83 / 26.80, passed; 80% feed 21.57 / 21.80. |

The 2026-11-22 compaction round looked for 650 tiles or fewer. The constraints below kept this layout near its present size:

- **Machine slots.** 35 machines are five rows of seven 4-tile slots. The cable count fixes it: a `C E C E C E C` row has 720 cable per minute, a full processing-unit machine needs 270 of it through its circuit machine, and the advanced-circuit machines take 108 more per row. So three such rows are needed (12 cable machines), and two rows of `R P R P R P R` hold exactly the 8 advanced-circuit and 6 processing-unit machines.
- **The advanced-circuit machines need a belt.** Above and below them are a cable machine (cable) and the channel; the gaps beside them hand advanced circuits to the processing units. Plastic can only come from a belt, so the channel cannot go, and the extra circuits (240 per minute) have to reach it.
- **Rows.** 28: 15 machine rows, 2 inner rows, the 4-row channel, a shared 3-row plate aisle, a 2-row plate aisle and the G row's 2-row output.
- **Width.** 27 for the body plus routing. Copper (1,080 per minute) is more than one lane carries, so it is split and enters in two places. That split and the circuit riser take the 3 strip columns, and the plate belt's turn down the east column takes 1 more. A 2-column strip with the exit on the body's edge would be 29 x 28 = 812 (not built).

Layouts worked out on paper and not built, with why (no native measurement, so no rate is claimed for them):

- 19 wide, three processing-unit rows of `R P R P R` over `C E C E C` (the green supplier's exact 3:2 cable ratio): about 40 rows, 760+ tiles before the entrance strip, and three supply channels to feed instead of one.
- Two green-circuit suppliers feeding a separate advanced-circuit and processing-unit block over belts: the green suppliers use all their cable inside, so the advanced circuits need their own cable machines and copper; estimated 700+ tiles with the routing.
- 27 wide with every P fed only by its own E: a `C E C E C E C` row has 4 cable machines for 3 circuit machines (720 cable per minute against the 810 three full E's need), so the middle P always needs circuits from elsewhere.

## Versions

Every folder under `history/` holds the string, its manifest, its report and a note.

| Variant | Size | Result |
| --- | --- | --- |
| `twin-rows` | 31 x 29 = 899 | Passed (26.57 / 26.50). Replaced for size and exit. `history/twin-rows-abe14cdf/`. |
| `shared-channel` | 31 x 28 = 868 | Passed (26.83 / 26.80); published. |

## Reproduce

From `factorio-command-center/`:

```
node scripts/processing-units/generate.mjs        # variant shared-channel; writes processing-units.txt and manifest.json
node scripts/processing-units/validate.mjs        # full protocol at the panel figures, writes native-report.json
node scripts/processing-units/generate.mjs        # same string; status from the matching report
node --test tests/processing-units.test.mjs
```

`--variant twin-rows --out <dir>` regenerates the replaced version. The generator keeps the committed string when a regeneration decodes to the same blueprint, so a zlib build that compresses differently does not change the SHA-256. `PU_EXPLORE=1` with `PU_WARMUP`, `PU_MEASURE`, `PU_BLOCKED`, `PU_SETTLE` and `PU_RECOVERY` (minutes) runs a short screen. It writes `.cache/processing-units/explore-report.json` and never touches this folder. In exploration runs only, `PU_FEED_SCALE=0.8` feeds every entrance at that fraction of its panel figure; a qualification run always feeds exactly the panel figures and refuses it. `PU_SOURCE=<dir>` validates a candidate in another folder. `node scripts/processing-units/ascii.mjs [dir]` prints the tile map.
