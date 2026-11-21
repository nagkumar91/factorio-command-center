# Six-pack science · 30/min each

**Status: qualified.** The exact string in `six-science.txt` (SHA-256 `e64dad17476403da1b06444955025d92c0ccb0e29503af68bcc37acdece7d653`, recorded in `manifest.json`) passed the full native protocol twice, once with every entrance offered a full belt and once with every entrance limited to exactly its panel figure; `native-report.json` holds both runs for that SHA. Factorio 2.1.24 Space Age, vanilla recipes, normal quality.

Makes automation, logistic, military, chemical, production and utility science packs at 30 per minute each from smelted materials, two fluids and supplied electronic circuits. A pack governor beside the chests hands over exactly 30 of each pack per minute, so the build draws the figures on its entrance panels. Space (white) science is out of scope; it stays the orbital cell.

## Size and machines

- Footprint: **77 x 54 = 4,158 tiles** (`starterBounds`, every entity included; columns -20 to 56, rows -1 to 52).
  - Area goal 4,400: **met, 242 tiles under**. Stretch 3,600: missed by 558 tiles. Ceiling 6,600 met.
- 115 machines: 113 assembling-machine-2 and 2 chemical plants (batteries). No machine makes electronic circuits. No modules, beacons, AM3 or furnaces. Every recipe has the whole-machine count its recipe arithmetic needs at 30 packs per minute and no spare machine; engines are the one exception, made on two rings (7 for an exact 6.67 on the blue ring, 3 for 2.22 on the frames ring).

| Recipe | Machines | | Recipe | Machines |
| --- | ---: | --- | --- | ---: |
| advanced-circuit | 25 | | engine-unit | 10 |
| low-density-structure | 10 | | chemical-science-pack | 8 |
| copper-cable | 5 | | production-science-pack | 5 |
| processing-unit | 5 | | utility-science-pack | 5 |
| flying-robot-frame | 5 | | logistic-science-pack | 4 |
| productivity-module | 4 | | automation-science-pack | 4 |
| military-science-pack | 4 | | grenade | 3 |
| electric-engine-unit | 3 | | iron-gear-wheel | 2 |
| battery (chemical plant) | 2 | | electric-furnace | 2 |
| rail | 2 | | pipe, piercing-rounds-magazine, inserter, transport-belt, firearm-magazine, stone-wall, iron-stick | 1 each |

Other entities: 796 fast belts, 162 fast undergrounds (81 pairs), 12 fast splitters (all spine taps, `output_priority` toward the tap), 291 fast, 28 long-handed and 24 bulk inserters (bulk stack override 2), 42 pipes, 34 pipes-to-ground, 19 substations (no medium poles), 12 display panels (11 entrances and the governor's label), 6 passive provider chests, and the governor's 4 combinators (1 constant, 1 decider, 2 arithmetic). 1,545 entities in all.

## Inputs (west side, one entrance each, each labelled)

| Entrance | Panel figure: what the build draws at 30/min per pack | Entrance tile |
| --- | ---: | --- |
| copper-plate | 1,035/min | belt, row 1 |
| electronic-circuit | 900/min | belt, row -1 |
| iron-plate | 585/min | belt, row 3 |
| plastic-bar | 520/min | belt, row 7 |
| steel-plate | 367.5/min | belt, row 5 |
| stone-brick | 250/min | belt, row 26 |
| coal | 150/min | belt, row 14 |
| stone | 150/min | belt, row 45 |
| sulfur | 15/min | belt, row 21 |
| sulfuric-acid | 500/min | pipe, row 34 |
| lubricant | 150/min | pipe, row 46 |

All entrances are in column -20. Supply both lanes of every belt entrance. Electronic circuits: 900/min, which is **3 copies of the green-circuits supplier** (360/min each). Power enters at the substation recorded as the `power` port; the whole build is one electric network.

**The panels are the supply to plan for.** They are the recipe totals at 30 packs per minute, and the governor lets no pack leave faster, so a full build draws them and no more. Both qualification runs, 30-minute steady window, accepted at the entrances per minute:

| Entrance | Panel | Full belt offered | Limited to the panel |
| --- | ---: | ---: | ---: |
| electronic-circuit | 900 | 902.3 | 900.0 |
| copper-plate | 1,035 | 1,033.8 | 1,030.8 |
| iron-plate | 585 | 587.5 | 585.0 |
| plastic-bar | 520 | 518.8 | 518.0 |
| steel-plate | 367.5 | 370.0 | 367.5 |
| stone-brick | 250 | 251.3 | 250.0 |
| coal | 150 | 150.7 | 150.0 |
| stone | 150 | 151.4 | 150.0 |
| sulfur | 15 | 14.9 | 15.0 |
| sulfuric-acid | 500 | 497.2 | 500.0 |
| lubricant | 150 | 149.5 | 150.0 |

Exploration runs of this string (not part of the qualification): four hours measured at exactly the panel figures after 45 minutes gave 30.00/min of every pack with every entrance taking its panel figure; four hours with full belts followed by a 60-minute blocked phase gave 30.00/min of every pack and full chests of 200. Fed at 0.95 of every panel the last packs on the shared spines fall first (production 26.3/min, utility 28.7/min, the other four 30.0/min); fed at 1.05 every pack stays at 30.0/min and the entrances take 0 to 2% more than their panels.

**Start-up.** The governor hands over nothing for the first 10 minutes after its combinators are powered. The rings and machines fill at full speed meanwhile, and from then on each chest receives one pack every 2 seconds. With supply already connected the build holds 30/min of every pack at the panel figures from the first hand-over. If supply arrives later than those 10 minutes the build still settles at 30/min each, but while it fills the last packs on the shared spines run a little short: an exploration run of a copy without the start delay, fed exactly the panel figures, made 28.6 production, 29.2 utility and 29.6 military packs per minute over minutes 15 to 45, and 29.9 to 30.4 of every pack over minutes 60 to 70.

## Outputs (east side)

Six passive provider chests in column 56, adjacent rows 20 to 25, north to south: automation, logistic, military, chemical, production, utility. Each chest is limited to one stack (`bar: 1`), so each holds exactly 200 packs when collection stops. The arm into each chest is a filtered fast inserter run by the governor (one pack per swing).

## Measured (full protocol, two runs)

Protocol: 15 min warm-up, 30 min steady measurement, 10 min blocked (no collection), 5 min settle, 10 min recovery measurement, no seeded inventories. Run one feeds only the declared entrances with a full belt (both lanes every 4 ticks, fluid every tick). Run two is the same string and phases with every entrance limited to exactly its panel figure.

| Pack | Full belt: steady | Full belt: recovery | Panel supply: steady | Panel supply: recovery | Chest at end of blocked phase (both) |
| --- | ---: | ---: | ---: | ---: | ---: |
| automation | 30.03/min | 30.1/min | 30.03/min | 29.9/min | 200 |
| logistic | 30.03/min | 30.0/min | 30.00/min | 30.0/min | 200 |
| military | 30.00/min | 30.0/min | 29.97/min | 29.9/min | 200 |
| chemical | 30.00/min | 30.1/min | 29.97/min | 30.0/min | 200 |
| production | 30.00/min | 30.0/min | 30.00/min | 30.1/min | 200 |
| utility | 30.00/min | 30.0/min | 30.00/min | 30.0/min | 200 |

A pack more or less in a window comes from collection falling on either side of the window edge and from packs still travelling on the export ring; the timers allow one pack per 120 ticks.

Pass floor is 28.5/min (95% of 30); the governed ceiling is 30.6/min (102%). In both runs every machine crafted during the steady window, every entrance and both fluids fed a productive consumer, the largest bulk-inserter hand observed was 2, and the harness checked the governor's power, its three networks and the six arms' conditions. Ring peaks against capacity (full belt / panel supply): red-green-military 168 / 168 of 496, blue 145 / 145 of 448, frames-processors 217 / 220 of 496 (44%, the highest), utility-production 155 / 155 of 448, export 166 / 166 of 592 (90% is the failure line).

## How it works

West manifold on the left, export ring on the right, three bands between them.

1. **West manifold (columns -20 to -1).** Circuits, copper, iron, steel and plastic each enter on a header row (rows -1, 1, 3, 5, 7) and run down a spine (columns -6, -9, -12, -15, -18) with priority splitter taps, one tap per consumer, so every consumer takes what it needs first. Brick, coal, stone and sulfur have one consumer each and enter on their own row. Acid and lubricant enter as pipes.
2. **Advanced-circuit bank (rows -1 to 12).** Lane belts, no ring. Q (row 0) carries circuits on its south lane and advanced circuits on its north lane; its circuits are side-loaded from the south onto a short belt at row -1, columns -5 and -4, which runs east and turns south into Q, so the loaded lane stays Q's south lane. R (row 6) carries plastic (north lane) and cable (south lane, dropped by five cable makers); it tunnels under four substations that sit in 2 x 2 gaps on rows 5-6. S (row 12) carries circuits and advanced circuits. North row: 5 cable makers, 9 advanced-circuit machines, 4 productivity-module machines (fed from Q, output over Q by long-handed arms onto a module lane on row -1); south row: 16 advanced-circuit machines in 17 slots (the east slot is empty). Every lane holds one item.
3. **Band X (two rings): red + green + military (west) and blue (east).** Raw materials reach the machines directly from rear lane belts (iron | coal above; brick | plastic and copper | steel below, shared with band Y, far belt reached with long-handed arms). The rings carry only intermediates and small items. The blue ring's gear and pipe machines also make the 10 gears and 20 pipes a minute that the engines on the frames ring take.
4. **Band Y (two rings): frames + processors + LDS (west) and utility + production + LDS + furnaces (east).** Batteries take acid on their rear arm row, electric engines lubricant, processors acid through pipe-to-ground pairs under their circuit belt. Gears and pipes for the three engine machines on the frames ring arrive from the blue ring over the export ring and the utility ring. The processors' circuit belt (row 50) starts at column 1, fed down column 1 from a circuit tap near row 44; its east end turns north (dead end).
5. **Rail cell (south-west manifold corner, columns -10 to 0, rows 44 to 52).** Rail | stick | rail with direct insertion. Stone (south lane, side-loaded into a two-row stub in column -10) and steel (north lane) arrive on a belt at row 46 above the cell. Below the cell, the rail belt on row 52 gets iron side-loaded onto its north lane at its west end, and two bulk arms drop rails on its south lane. The rail belt runs east along row 52, rises to row 51 at column 6, tunnels under the processors' pipe-to-ground ends and enters the production row's rear belt (row 50) as a curve, so both lanes keep their item.
6. **Export ring (east edge, columns 53-54, rows 7 to 43).** A two-belt ring that receives advanced circuits from Q and S and the module lane, hands advanced circuits and modules to the blue and utility-production rings, carries gears and pipes from the blue ring down to the utility ring, collects all six packs and feeds the six chests. It runs counter-clockwise so blue science draws advanced circuits first.

7. **Pack governor (columns 55-56, rows 26 to 29, south of the chest arms).** One constant, one decider and two arithmetic combinators and a label. Each pack has a timer: the decider adds one per tick, the chest arm runs while its timer shows the start delay plus one period (120 ticks), and every pack the arm lifts takes one period off (the arm reads its hand as a pulse; the second arithmetic combinator multiplies it by -120). So each chest receives one pack per 120 ticks, 30 per minute, and everything upstream stops at its stock limits.

### Control (what to preserve)

- Every ring is a closed belt loop; **every ring tile reads its own contents (hold) and all tiles of a ring share one red wire.** Separate rings have separate red networks.
- Every arm that puts an item on a ring (admissions, machine outputs, ring-to-ring transfers) runs only while that ring holds fewer than the item's limit. Limit sums per ring (capacity in brackets): red-green-military 160 (496), blue 132 (448), frames-processors 208 (496), utility-production 144 (448), export 164 (592); each at most 60% of capacity.
- The module lane is read the same way; module output arms stop at 8 modules on the lane.
- **The governor's three networks.** Green: the constant (1,000 of each pack, the bias that keeps every pack signal non-zero for the "each" conditions), the decider's input, the memory's output and the six chest arms. Red between the six chest arms and the subtractor's input: the hand pulses. Red between the decider's output, the subtractor's output and the memory's input and output: the memory loop. The arms run at 37,120 and above (bias + 36,000 ticks of start delay + one period); the decider stops counting at 38,200 (ten periods saved), so after a pause at most ten extra packs of each kind follow. The green wires are the governor's only; no ring carries one.
- Straight belt runs that nothing touches are buried. The shared underground optimizer buries 14 belts in 3 pairs; a second pass (`scripts/six-science/bury.mjs`) buries 159 more in 35 pairs, taking only plain belts with no reader, wire, arm or side input and a straight neighbour on both sides, and re-checking every underground pairing after each pair. Ring tiles and the module lane stay on the surface because their readers count them. The unit test checks that the pass finds nothing more to bury in the published string.
- Keep the splitter priorities, the inserter filters (every arm here is filtered), the chest limits (one stack) and the substations' copper wires.

## Reproduce

```
export FACTORIO_RAW=/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json
node scripts/six-science/generate.mjs          # writes six-science.txt and manifest.json (deterministic; status stays qualified only if native-report.json passed for the same SHA)
node scripts/six-science/validate.mjs          # both full-protocol runs (about 1 min wall), writes native-report.json and the manifest status
node --test tests/six-science.test.mjs
```

The generator keeps the manifest `qualified` only when the committed `native-report.json` passed for the exact string it just built; after any change to the string, run the validator, since the unit test requires `qualified`.

Exploration runs: `ESSENTIALS_EXPLORE=1 SIX_WARMUP=15 SIX_MEASURE=10 node scripts/six-science/validate.mjs` writes `.cache/six-science/explore-report.json`; `SIX_SUPPLY_SCALE=0.95` limits every entrance to that multiple of its panel figure and `SIX_COLLECT=30` limits collection per chest and minute (both exploration only); `node scripts/six-science/diagnose.mjs` summarises pack rates, crafts per recipe, machine statuses, ring stock and entrance acceptance. `node scripts/six-science/generate.mjs --draft` prints the footprint without writing files; `SIX_LAYOUT`, `SIX_HOLES` and `SIX_G` (JSON) override layout values for experiments (for example `SIX_LAYOUT='{"governor":{"startDelay":0}}'`). The harness writes the blueprint SHA it was given into `result.json`, and the validator refuses a result whose SHA differs from the manifest; `SIX_REPORT_ONLY=1` (re-read an existing run) works only together with `ESSENTIALS_EXPLORE=1`, so it can never write the published report.

## Tried and rejected

Qualified and superseded (kept in `history/`, each with a `NOTE.md`):

- `history/stage-one`: 81 x 66 = 5,346 tiles, first full pass.
- `history/tighter-manifold`: 78 x 63 = 4,914 tiles, manifold moved two columns east.
- `history/buried-runs`: 78 x 60 = 4,680 tiles, the reviewed layout with straight manifold runs buried.
- `history/corner-rails`: 78 x 56 = 4,368 tiles, rail cell moved into the manifold corner.
- `history/top-rows`: 78 x 54 = 4,212 tiles, top two rows removed.
- `history/ungoverned-9e895b8f`: 77 x 54 = 4,158 tiles, 122 machines, no governor. Fed a full belt it made 31.4 to 37.5 packs per minute; fed exactly its panel figures it starved production and utility science.

The 77 x 54 rectangle (kept by the governed version) adds one narrower manifold column and ends the export ring at row 43 instead of row 50 (its lowest transfer is at row 42); that shortened the lap and removed 14 belt tiles without changing the footprint.

Learned on the way (screens and drafts, not published):

- Before the governor, with 26 advanced-circuit machines the pack machines at full capacity wanted about 197 advanced circuits per minute against 195 supplied. On a clockwise export ring blue science, last in line, fell to 24-26/min. A long dead-end belt of advanced circuits to the processors and an uncapped module belt made it worse while they filled. Fixes: processors take advanced circuits from their ring, the module lane is capped, and the export ring runs counter-clockwise so blue is first.
- A tenth blue machine never crafted (blue is engine limited at 31.5/min), so nine are built.
- Spines two columns apart, with taps leaving the splitter into an underground belt: the westmost of five spines would need an 8-tile tunnel (fast undergrounds reach 7), so this does not fit five spines.
- Rail cell in the corner with its rail belt on row 51: the stone side-load needed row 43, which the plastic tap to band Y also needs, so no route was found. Moving the rail belt to row 52 and using a two-row stub on the input belt fixed it.
- A second narrower manifold column (spines at -5 to -17, west edge -19) did not route: the lubricant pipe found no path to the electric engines' header, and with the shared rear belts shifted only one column the copper tap to the shared zone found no path. Moving the west edge without moving the spines fails because the single-material rows need column W0+1 for the underground under the plastic spine.
- Replacing the export ring by lane belts (review idea, up to two columns) was analysed but not built. The bank's Q already reaches column 54, so the ring, its chest arms and the chests (columns 53 to 56) can only shrink if the ring is removed entirely; that means a new hand-off of advanced circuits and modules to the blue and utility-production rings and new pack collection. It is the highest-risk change and was left for a later round.

Design review of 21 November (governed version; screens are full-length runs, each with a full belt and at exactly the panel figures):

- Why the old version starved at its panels: the pack machines set the rates (five logistic machines 37.5/min, four automation and four military machines up to 36/min), iron ran out first, and the last iron tap (sticks for rails) and with it production science paid for all of it.
- Governor without a start delay, on the 122-machine layout: every pack 30/min with full belts, but fed exactly the panels production science made 21.9/min over minutes 15 to 45, because the pack lines with little spare capacity fill their machines and rings only as fast as that spare allows, and exact supply has nothing left over for it. A 5-minute delay gave utility 29.4/min in the window, 10 minutes gave 30.0 for all six. On the published 115-machine layout the same test without the delay gave 28.6 for production, so the delay matters less there; it is kept because it gives 30.0 from the first hand-over.
- Holding the old version to 30/min from outside (collection limited to 30 per chest and minute, panel supply): after two hours utility was still at 27/min, because the 200-pack chests of the faster lines were still filling.
- Machines removed one at a time, each passing both screens, then together, then four hours at exactly the panel figures: one advanced-circuit machine (25 make 187.5 for a need of 185), one logistic machine (4 make exactly 30), one chemical machine (8 make exactly 30), one low-density machine (10 make exactly 30), one piercing-rounds machine (1 makes exactly 7.5), and the utility ring's gear and pipe machines (the blue ring's machines have the capacity; gears and pipes ride the export ring). Stages that now run all the time have no spare capacity: what such a stage loses in a supply gap it does not make up, it only returns to 30/min.
- Not tried: a smaller rectangle. A cut of 5% needs three rows or four columns; every row carries machines, arms or a lane belt, and the two column ideas (a narrower manifold, lane belts in place of the export ring) are the ones recorded above.

