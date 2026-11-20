# Green-circuit supplier · 360/min

**Qualified.** Measured over a full native run of the exact published string (SHA-256 `21af4618a276bd193831ab3d281a23eb7839cb9e74364124b0db604c92569e56`): **360.0 electronic circuits per minute steady and 360.0 per minute in recovery**. The target is 360 and the pass bar is 342 (95%).

This module turns iron plates and copper plates into electronic (green) circuits and sends them out east on one red belt. It is the companion of `essentials-mall`, `robot-essentials` and `six-science`, which take electronic circuits as a supplied input.

## Size and machines

- Footprint **19 x 10 = 190 tiles**: 0.528 tiles per circuit per minute. It beats the 364-tile baseline (Luna compact circuits 360), the 286-tile goal, the 273-tile stretch goal and the previous 247-tile version (`history/outer-output-belts/`).
- 10 assembling machine 2: 6 copper cable and 4 electronic circuit. No modules, no beacons.
- Arms: 4 bulk (hand 2), 11 fast and 14 long-handed (hand 1). Belts: 29 red belts and 4 red underground belts. Two substations, 2 display panels.

```
  0 C C C . E E E . C C C . E E E . C C C
  1 C C C b E E E f C C C f E E E b C C C
  2 C C C . E E E . C C C . E E E . C C C
  3 > v f . L L f . . f . . L L f . . . f
  4 D > > > > > > > > > > > > > > > > > ^      belt A: plates
  5 > ^ . . > > U S S u > > > > U S S u >  ->  belt B: circuits, exit at (18,5)
  6 D L L . f L L S S L L . f L L S S L L
  7 C C C . E E E . C C C . E E E . C C C
  8 C C C b E E E f C C C f E E E b C C C
  9 C C C . E E E . C C C . E E E . C C C
```

`C` copper cable, `E` electronic circuit, `b` bulk arm, `f` fast arm, `L` long-handed arm, `U`/`u` underground entry/exit, `S` substation, `D` display panel.

## Inputs (west)

| Entrance | Tile | Nominal demand | Where it goes |
| --- | --- | ---: | --- |
| `copper-plate` | (0,3), upper | 540/min | Turns south at (1,3) and side-loads onto the north lane of plate belt A (row 4). The 6 cable machines take it from there. |
| `iron-plate` | (0,5), lower | 360/min | Turns north at (1,5) and side-loads onto the south lane of belt A. The 4 circuit machines take it from there. |

Each entrance may carry plates on both lanes; the blueprint puts each material on its own lane. Display panels at (0,4) and (0,6) label the entrances. Electricity goes in at the substation on tiles (7..8, 5..6), the single power connection. The second substation, on (15..16, 5..6), is wired to it.

## Output (east)

One red belt exit at (18,5), the east end of circuit belt B. It is a straight tile fed from behind by the underground exit at (17,5). The top row's circuits use the south lane and the bottom row's use the north lane, about 180 per minute per lane. Cap: when nothing takes circuits, the exit tile holds 8 and every machine stops. Belt it to the consumers' circuit entrances. One red belt carries 1,800 per minute, so up to five copies can share a belt.

## Copies needed

Each consumer's demand at its target, divided by the measured 360 per minute:

| Consumer | Circuits per minute | Copies |
| --- | ---: | ---: |
| six-science | 900 | 3 (1,080 supplied) |
| robot-essentials | 145 | 1 |
| essentials-mall | 84 at its floors (up to about 150 with one product drawn alone) | 1 |
| all three together | 1,129 | 4 (1,440 supplied) |

## How it works (no circuit network needed)

- There are two mirrored rows of `C E C E C` (cable, circuit, cable, circuit, cable), on rows 0..2 and 7..9. Between them is an aisle of two belts: A carries plates (row 4) and B carries circuits (row 5).
- Cable never touches a belt. Each outer cable machine gives all its cable (180/min) to its neighbouring circuit machine through one bulk arm. The middle cable machine gives 90/min to each side through one fast arm per side. Each circuit machine therefore gets 2 cable from the bulk arm and 1 from the fast arm for every craft, which is exactly the 3 a circuit needs. The hand sizes fix the split, so neither side can take all of the middle machine's cable.
- Top row (arm row 3, next to belt A): one filtered fast arm per machine takes its plate from A. Two long-handed arms per circuit machine reach over A and drop circuits on B.
- Bottom row (arm row 6, next to belt B): two filtered long-handed arms per machine reach over B and take their plate from A. One fast arm per circuit machine drops circuits on B.
- Every input arm has a one-item whitelist (copper for cable machines, iron for circuit machines) and override stack size 1.
- Belt A ends in a dead-end curve at (18,4), facing north into the last copper arm, so plates never reach belt B or the exit.
- Belt B goes underground under both substation holes. Two substations are needed: one cannot reach every arm without taking tiles that the middle cable machine's arms need.
- No ring, no chest, and no wire except the one copper wire between the substations: `loopControl: []`, `stockControl.mode: "belt-exit"`.

What to preserve: the bulk arms (override stack 2) at the outer cable machines, the fast arms (override stack 1) at the middle ones, the plate filters on the input arms, and the dead-end curve at (18,4). The cable supply is exact (1,080 made, 1,080 used), so replacing a gap arm with another type breaks the 2:1 split. Each long-handed input pair runs at about 62% of its ideal rate, under the contract's 85% planning limit.

## Native evidence

- Report: `native-report.json`, `passed: true`, for the exact `blueprintSha256` in `manifest.json`. Factorio 2.1.24 Space Age headless with a private config and mod directory. Prototype SHA-256 `ce40aee67d984865f22ed8e65ba6b93fefb014fc35e45b747b64aca3ed5682a3`.
- Protocol: 15 min warm-up, 30 min steady, 5 min blocked (collection stopped, nothing injected), 5 min settle, 10 min recovery.
- Feeding: one plate per lane every 4 ticks into each entrance belt; nothing else is ever written. Collection: both lanes of the exit tile every 4 ticks, except while blocked.
- Measured:
  - Steady 360.0/min and recovery 360.0/min.
  - Each of the 10 machines made 2,700 crafts in the 30-minute window, its full rate. Nine reported `working` at all 1,800 one-second samples. The top-left circuit machine (5.5, 1.5) reported `item_ingredient_shortage` at 900 samples and `working` at 900, yet made all 2,700 of its crafts. Its inputs arrive just in time, with no slack. The reviewer's scratch build of the same layout showed the same split.
  - The entrances took 540.0 copper and 360.0 iron per minute.
  - The exit held exactly 8 at the end of the blocked phase (never more), and no machine crafted in the blocked phase's last minute.
  - Bulk hands never went above 2.
- `configurationSha256` hashes the harness payload without the manifest's `status` and `measured` fields, so it can be reproduced from the committed manifest.

## Reproduce

From `factorio-command-center/`:

```
node scripts/green-circuits/generate.mjs                        # variant twin-belt; writes green-circuits.txt and manifest.json
node scripts/green-circuits/validate.mjs                        # full protocol, writes native-report.json
node scripts/green-circuits/generate.mjs                        # same string; status from the matching report
node --test tests/green-circuits.test.mjs
```

`ESSENTIALS_EXPLORE=1` with `GC_WARMUP`, `GC_MEASURE`, `GC_BLOCKED`, `GC_SETTLE` and `GC_RECOVERY` (minutes) runs a short screen. It writes `.cache/green-circuits/explore-report.json` and never touches this folder. `GC_SOURCE=<dir>` validates a candidate in another folder. `node scripts/green-circuits/ascii.mjs [dir]` prints a tile map.

Power is placed by `scripts/green-circuits/power.mjs`, a copy of `scripts/five-science/power.mjs` (`powerFiveLayout`) with one addition: an optional `within` rectangle. The shared helper's greedy choice put the second substation outside the footprint, making it 19 x 12. With `within` set to the footprint, the helper uses the two holes. Without the option it behaves exactly as the original.

## Tried and rejected

All runs used the full protocol.

| Variant | Size | Result |
| --- | --- | --- |
| `reference` (the spec layout) | 21 x 13 = 273 | 360/360 per minute, but the side-loaded exit tile held 6, not 8, while blocked. Kept in `history/side-loaded-exit/`. |
| `compact-side-loaded-exit` | 19 x 13 = 247 | Same rates and the same failure: the exit held 6. |
| `reference-straight-exit` | 22 x 13 = 286 | Passed; superseded. Kept in `history/straight-exit-east-column/`. |
| `compact` | 19 x 13 = 247 | Passed. Published first, then superseded by `twin-belt`. Kept in `history/outer-output-belts/`. |
| `twin-belt` | 19 x 10 = 190 | Passed; published. |

The width is the minimum for this machine arrangement: 5 machines and 4 one-tile gaps make 19 columns, and the gaps carry the direct cable hand-off. A 9-row version would put copper, iron and circuits on one two-lane dead-end belt, which the contract forbids.

## Review notes

The review found no defect in the 19 x 13 build and gave the verdict "fix" for size only. It asked for its scratch twin-belt layout to be rebuilt in the committed generator, with power from the shared helper. This was applied as asked:

- The `twin-belt` variant reproduces the scratch geometry tile for tile. The only differences are the blueprint label and description, the entity numbers, and the power port the helper chose.
- Power: the shared helper would not use the two holes on its own, so it was copied and restricted (see Reproduce). The substation assertion is now 2 for this variant.
- The full protocol passed on the exact published string.
- The minor notes were also handled:
  - The validator's configuration hash can now be reproduced.
  - The two older history manifests were regenerated so their status comes from their own reports: `not-qualified` for `side-loaded-exit`, `qualified` for `straight-exit-east-column`. Their strings are unchanged.
  - The unit test now asserts that the only wires are substation copper wires and that there are no chests.
- The review's second size idea says nothing further is worth a round, so there was no next idea to try.
