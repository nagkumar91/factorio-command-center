# Robot essentials · 5/5/0.5/2/2 per minute

The smaller robot workshop. It makes construction robots, logistic robots, roboports, storage chests and passive provider chests at half the rate of `robot-logistics-workshop`, from supplied electronic circuits, plates, plastic, sulfuric acid and lubricant. Everything else (cable, advanced circuits, gears, pipes, steel chests, engines, electric engines, batteries, flying robot frames) is made inside.

**Status: qualified.** `native-report.json` says `passed: true` for the exact string in `robot-essentials.txt` (SHA-256 `d2c80909…0763`, full value in `manifest.json`), from the full protocol on Factorio 2.1.24 Space Age.

## Size

| | |
| --- | --- |
| Footprint | 33 x 16 = **528 tiles**, 21% of the current robot workshop (106 x 24 = 2,544) |
| Area goal | goal 760, stretch 703, achieved 528 |
| Machines | 28: 26 assembling-machine-2, 2 chemical plants |
| Power | 2 substations inside the rectangle; connect electricity at the substation named as the power port in `manifest.json` |

Machine counts: advanced circuit 6, copper cable 1, flying robot frame 5, engine 3, electric engine 3, battery 2 (chemical plants), and one each of gear, pipe, steel chest, construction robot, logistic robot, roboport, storage chest and passive provider chest.

```
 -4 .=BBBGGGSSSCCCAAAAAAAAAAAAAAAAAAD    B battery   G gear   S steel chest   C cable   A advanced circuit
 -3 ==BBBGGGSSSCCCAAAAAAAAAAAAAAAAAAD    F frame   R construction robot   L logistic robot   H storage chest
 -2 d=BBBGGGSSSCCCAAAAAAAAAAAAAAAAAA@    E electric engine   P pipe   N engine   O roboport   V passive provider chest
 -1 d#i.ibbii.ii.biiiiiiiiiiiiiiiiiii    > < ^ v belts   i fast / b bulk inserter   = pipe   # pipe-to-ground
  0 d>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>v    $ substation   D decider   + arithmetic   d display panel   @ output chest
  1 >^ii.ii....ii.ii.ii.ii.ii.DDDii.v
  2 >^FFFFFF...FFFFFFFFFRRRLLLDDDHHHv
  3 >^FFFFFF$$+FFFFFFFFFRRRLLL$$DHHHv
  4 >^FFFFFF$$+FFFFFFFFFRRRLLL$$DHHHv
  5 >^..i..i++.DDi++iDDiDDi++iDD.++iv
  6 d^<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  7 d#i.ii.ii.ii.ii.ii.ii.ii.iiiii.i+
  8 d=BBBEEEEEEEEEPPPNNNNNNNNNOOOVVV+
  9 ..BBBEEEEEEEEEPPPNNNNNNNNNOOOVVVD
 10 d.BBBEEEEEEEEEPPPNNNNNNNNNOOOVVVD
 11 =============++DD++++DDDD++DDDD++
```

## Inputs (all on the WEST side, one entrance each, each with a display panel)

| Entrance | Row | Nominal per minute | Where it goes |
| --- | ---: | ---: | --- |
| sulfuric-acid (pipe) | -3 | 400 | both battery plants; the bottom plant through an underground pipe beneath the ring's west column |
| electronic-circuit (belt) | 1 | 145 | ring |
| iron-plate (belt) | 2 | 105 | ring |
| copper-plate (belt) | 3 | 93 | ring |
| steel-plate (belt) | 4 | 74.5 | ring |
| plastic-bar (belt) | 5 | 73 | ring |
| lubricant (pipe) | 11 | 150 | header under the three electric-engine machines |

The five belt entrances are circuit-gated belts that side-load straight onto the ring. Nominal amounts are recipe totals at the targets. The native run measured more (163 circuits, 121 iron, 107 copper, 86 steel, 85 plastic per minute) because the production tokens run each product 5 to 15% above target. One `green-circuits` copy (360 per minute) covers the 145 circuits per minute, and also the measured 163.

**Plan supply for the measured draw, not the panels.** The panel figures are recipe totals at the targets. Size smelting and circuit supply for about 163 electronic circuits, 121 iron, 107 copper, 86 steel and 85 plastic per minute (about 15% above the panels), and fluids for about 442 sulfuric acid and 165 lubricant per minute (about 10% above theirs; from the full run's accepted fluid over 30 minutes). Fed at exactly the panel figures, the workshop makes only about 1 logistic robot per minute.

This was measured in an exploration variant of the harness (a scratch copy that feeds each belt entrance at a multiple of its panel figure, fluids unchanged, full protocol lengths), not in the published protocol, which saturates every entrance. The reviewer built the variant and ran it on the previous 560-tile design (a 6x control run reproduced the published numbers there); the fixer re-ran it on this 528-tile string. Steady rates per minute:

| Belt supply vs panel figure | Construction | Logistic | Roboport | Storage | Provider | Result (528) | Logistic on the 560 design |
| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| 1.00x (145 / 105 / 93 / 74.5 / 73) | 4.87 | **1.07** | 0.57 | 2.2 | 2.2 | fails | 1.30, fails |
| 1.05x | 5.0 | **2.93** | 0.57 | 2.2 | 2.2 | fails | 3.00, fails |
| 1.10x | 5.27 | **4.43** | 0.57 | 2.2 | 2.2 | fails | 5.05, passes |
| 1.15x | 5.27 | 5.23 | 0.57 | 2.2 | 2.2 | passes | 5.22, passes |
| 1.20x | 5.27 | 5.4 | 0.57 | 2.2 | 2.2 | passes | 5.40, passes |

The pass line sits between 1.10x and 1.15x and moves a little with the layout, so plan for the measured draw (1.15x), not for the panels.

Cause: the tokens let the roboport and the two chest recipes run 10 to 15% above target, and those machines sit upstream of the engine machines for steel. At 74.5 steel per minute the roboport and the steel-chest machine took about 62 of it, the three engine machines were short of steel about half the time, frames fell to 6.4 per minute, and the construction robot machine, which sees frames first, took 5.0 of them, leaving little for logistic robots. Steel reaches the engines last.

## Output (EAST)

One passive provider chest on the east edge, above the ring's north-east corner, holds all five products with independent caps: 20 construction robots, 20 logistic robots, 2 roboports, 10 storage chests, 10 passive provider chests. Leave the chest unrestricted (no bar). A filtered fast inserter directly below it picks from the ring's corner tile (31,0) and loads it; its filters come from five decider combinators (`product in chest + in hand < cap`), so a capped product stays on the ring while the others keep flowing.

## How the control works

- **One ring.** A closed red-belt loop of 74 tiles runs east along the top, south down the east side, west along the bottom and north up the west side. Three machine rows surround it: the top row and the bottom row work from the outside, the middle row from inside. Every ring tile reads its own contents (hold mode) on one red wire, so the red network carries the count of every item on the ring.
- **Stock limits.** Every arm that puts an item on the ring, and every entrance belt, is enabled only while that item's ring count is below its limit: circuits 64, cable 52, iron 36, copper 32, steel 32, plastic 24, advanced circuits 24, gears 24, pipes 12, batteries 12, engines / electric engines / frames 6, steel chests 4, each product 4, roboports 2. The limits sum to 352 of 592 slots (59%); the highest ring stock measured was 357 (60%), against the 90% failure line.
- **Lanes.** The entrance belts side-load onto the outer lane of the west column; machine output arms on the top and bottom rows drop on the inner lane. Raw materials and intermediates therefore mostly use different lanes.
- **Reserves.** Arms that feed an upstream consumer of a shared item wait while the ring is low: advanced-circuit machines take circuits only above 16; the gear machine (two bulk arms) and the pipe machine take iron only above 8; the steel-chest machine takes steel only above 8; the roboport takes gears only above 8 and advanced circuits (with steel) only above 8.
- **Production tokens.** Each product's output arm is metered by a latched token: one free-running timer, one modulo per product (periods 685, 666, 6,260, 1,636 and 1,636 ticks), a latch that holds the token from each period start until the output arm holds the product, a permission decider (`product on ring < limit AND token`) and a hand-read reset. This keeps the construction robot from taking every frame and the roboport from taking every advanced circuit.

Preserve: the red wires on the ring tiles, the entrance belts and the controlled arms; the green chest, cap and token wires; the arm filters; the combinator settings. `manifest.json` lists every limit, reserve, token and entity number.

## Measured (native-report.json, full protocol)

Protocol: 15 min warm-up, 30 min measured, 8 min blocked (collection stopped, nothing injected), 5 min settle, 10 min recovery, then five 15-minute selective phases (one product's collection stopped; 5 min settle, 10 min measured).

| Product | Target | Floor (95%) | Steady | Recovery |
| --- | ---: | ---: | ---: | ---: |
| construction-robot | 5 | 4.75 | 5.27 | 5.2 |
| logistic-robot | 5 | 4.75 | 5.4 | 5.4 |
| roboport | 0.5 | 0.475 | 0.57 | 0.5 |
| storage-chest | 2 | 1.9 | 2.2 | 2.2 |
| passive-provider-chest | 2 | 1.9 | 2.2 | 2.2 |

At the end of the blocked phase the chest held exactly 20, 20, 2, 10 and 10. In every selective phase the stopped product ended exactly at its cap and the other four stayed above their floors (lowest: construction robots 5.2, roboports 0.6). Every machine crafted during measurement, every entrance fed a productive machine, both fluids reached crafting consumers (two battery plants, three electric-engine machines), bulk hands never exceeded 2. Frames ran at 11.1 per minute with all five frame machines near 100%.

Margins to know about: the roboport recovery figure is exactly 5 roboports in 10 minutes, the smallest count that clears its floor; the frame machines run at about 98%, so frames are the binding constraint for the two robots.

## Reproduce

From the repository root (worktree), with the official raw dump at the default path or in `FACTORIO_RAW`:

```sh
node scripts/robot-essentials/generate.mjs                  # robot-essentials.txt and manifest.json
RE_IMPORT_ONLY=1 node scripts/robot-essentials/validate.mjs # import, wiring, gates, fluids, power (61 ticks)
node scripts/robot-essentials/validate.mjs                  # full protocol, writes native-report.json
node --test tests/robot-essentials.test.mjs
```

The generator is deterministic; `RE_OPTIONS` rebuilds the history candidates (each `NOTE.md` gives its options). `scripts/robot-essentials/screen.sh` runs a short exploration (`ESSENTIALS_EXPLORE=1`; it writes `.cache/robot-essentials/explore-report.json` and never the published report), `summary.mjs` prints per-machine crafts, status shares and missing ingredients, and `preview.mjs` draws the layout. The native harness (`control.lua`, `validate.mjs`) is copied from `scripts/robot-logistics-workshop/` and adapted to take its phase lengths from the manifest; it feeds only the declared entrance lanes and fluid pipes plus electricity and collects only from the declared chest. A full run takes about 25 seconds of wall time.

## Tried and rejected

Each folder under `history/` has the string, manifest, a report and a `NOTE.md`.

| Candidate | Size | Result | Lesson |
| --- | ---: | --- | --- |
| `fast-gear-arm` | 630 | screen failed, logistic robots 4.2 | a fast arm catches too little of the sparse iron on the ring; gears starve engines, electric engines and frames |
| `rear-belt` | 630 | **qualified** (full protocol), superseded | plastic and cable on a rear belt cost two whole rows |
| `ring-fed-one-gear-arm` | 595 | screen failed, logistic robots 4.6 | with plastic and cable on the ring the iron limit had to drop, and one gear arm was short again |
| `ring-fed-acid-row` | 595 | exploration pass, superseded | two bulk iron arms on the gear machine fix the gear chain |
| `west-acid-circuit-56` | 560 | exploration pass, not published | circuits 56 left the downstream circuit users shorter than circuits 64 |
| `collector-east-column` | 560 | **qualified** (full protocol), reviewed, superseded | the collector, chest and nine combinators needed two columns east of the ring; a corner collector does without them |

What was not tried: a nine-slot ring with machines east of the ring (about 612 tiles, larger than 528), and the spec's optional two-combinator cap logic and bare pickup windows, which save combinators but no area here because the combinators already sit in tiles the rectangle needs anyway.

## Review notes

The Fable review of the 560-tile design (head e8e68687b) asked for one fix and listed size ideas. What the fixer did:

- **Must fix, supply documentation: applied.** The setup notes in `manifest.json` and the Inputs section above now say the panels are recipe totals and that supply should be planned for the measured draw. The fix landed first on the unchanged 560 string (commit df3dae79d, report re-run so its configuration hash matches the manifest). After the size change below, the fixer re-measured the supply table on the new string: the pass line moved from between 1.05x and 1.10x to between 1.10x and 1.15x, still inside the "plan for about 15% above the panels" advice.
- **Size idea 1, collector and chest into a ring corner: done, 560 to 528 tiles.** Collector at (31,-1) picking from the corner curve (31,0), chest at (31,-2) on the east edge. The generator's greedy combinator placement re-homed the nine combinators into existing empty slots plus three new ones: (31,-4..-3), (31,7..10) and (30..31,11). The curve pickup cost nothing measurable: every steady and recovery figure equals the 560 design's, the selective phases match (one phase 0.1 per minute higher), and the ring peak was 357 against 358. Option `cornerChest` (default true).
- **Size idea 2, two-combinator cap logic: not built.** It saves no area by itself; its only purpose was to make idea 1 easier to wire, and idea 1 wired without it.
- **Size idea 3: not pursued**, per the reviewer's own analysis (lubricant row, four-row fold, merged machines). With ideas 2 and 3 giving nothing, the search stopped there.
- **Description wording: fixed.** The blueprint description now says "Supply electricity at either substation; the two are wired together" instead of "the marked substation". History candidates keep the old text through option `oldPowerWording`, so each `NOTE.md` command still rebuilds its string exactly (checked for all six).
