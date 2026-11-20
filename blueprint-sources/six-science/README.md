# Six-pack science · 30/min each

**Status: qualified.** The exact string in `six-science.txt` (SHA-256 `9e895b8f45a2494c97b4065d08420d1fcb14e54c2951c2601e87792d93860580`, recorded in `manifest.json`) passed the full native protocol; `native-report.json` holds the evidence for that SHA. Factorio 2.1.24 Space Age, vanilla recipes, normal quality.

Makes automation, logistic, military, chemical, production and utility science packs at 30 per minute each from smelted materials, two fluids and supplied electronic circuits. Space (white) science is out of scope; it stays the orbital cell.

## Size and machines

- Footprint: **77 x 54 = 4,158 tiles** (`starterBounds`, every entity included; columns -20 to 56, rows -1 to 52).
  - Area goal 4,400: **met, 242 tiles under**. Stretch 3,600: missed by 558 tiles. Ceiling 6,600 met.
- 122 machines: 120 assembling-machine-2 and 2 chemical plants (batteries). No machine makes electronic circuits. No modules, beacons, AM3 or furnaces.

| Recipe | Machines | | Recipe | Machines |
| --- | ---: | --- | --- | ---: |
| advanced-circuit | 26 | | engine-unit | 10 |
| copper-cable | 5 | | chemical-science-pack | 9 |
| low-density-structure | 11 | | logistic-science-pack | 5 |
| processing-unit | 5 | | production-science-pack | 5 |
| flying-robot-frame | 5 | | utility-science-pack | 5 |
| productivity-module | 4 | | automation-science-pack | 4 |
| military-science-pack | 4 | | grenade | 3 |
| electric-engine-unit | 3 | | iron-gear-wheel | 3 |
| piercing-rounds-magazine | 2 | | pipe | 2 |
| battery (chemical plant) | 2 | | electric-furnace | 2 |
| rail | 2 | | inserter, transport-belt, firearm-magazine, stone-wall, iron-stick | 1 each |

Other entities: 804 fast belts, 160 fast undergrounds (80 pairs), 12 fast splitters (all spine taps, `output_priority` toward the tap), 302 fast, 30 long-handed and 24 bulk inserters (bulk stack override 2), 42 pipes, 34 pipes-to-ground, 19 substations (no medium poles), 11 display panels, 6 passive provider chests.

## Inputs (west side, one entrance each, each labelled)

| Entrance | Nominal demand at 30/min per pack | Entrance tile |
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

**Plan supply for the measured draw, not the panels.** The panel figures are recipe totals at 30/min; packs early on the shared spines run above target and take material first, so the last packs starve when supply only equals the panels. Exploration measurements (full-length 15/30/10/5/10-minute runs with a throttled-feed copy of the harness made in the final review; its unthrottled control reproduced the published numbers; not part of the qualification):

| Supply at every entrance | Automation | Logistic | Military | Chemical | Production | Utility | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1.00x the panel figures | 33.7 | 37.6 | 29.6 | 30.5 | **16.6** | **24.0** | fails, 7 machines idle |
| 1.05x | 33.8 | 37.5 | 31.0 | 31.6 | **19.5** | 32.0 | fails |
| 1.10x | 33.8 | 37.4 | 32.5 | 31.6 | **23.1** | 32.2 | fails |
| 1.15x | 33.7 | 37.5 | 33.7 | 31.6 | 31.9 | 32.1 | passes |
| the measured draw, per entrance | 33.7 | 37.6 | 33.5 | 31.5 | 29.2 | 32.1 | passes |
| circuits only limited to 1,080 (three suppliers), rest unlimited | 33.8 | 37.5 | 33.8 | 31.5 | 31.4 | 32.1 | passes |

Measured draw per minute (panel in brackets): electronic circuits 966 (900), copper 1,105 (1,035), iron 661 (585), steel 389 (367.5), plastic 550 (520), stone brick 274 (250), coal 169 (150), stone 158 (150), sulfur 15.8 (15), sulfuric acid 557 (500), lubricant 169 (150): 5 to 13% above the panels. Three green-circuits copies (1,080/min) cover the circuit draw.

## Outputs (east side)

Six passive provider chests in column 56, adjacent rows 20 to 25, north to south: automation, logistic, military, chemical, production, utility. Each chest is limited to one stack (`bar: 1`), so each holds exactly 200 packs when collection stops. The arm into each chest is a filtered fast inserter.

## Measured (full protocol)

Protocol: 15 min warm-up, 30 min steady measurement, 10 min blocked (no collection), 5 min settle, 10 min recovery measurement. Feeding only the declared entrances (both lanes of each belt every 4 ticks, fluid every tick), no seeded inventories.

| Pack | Steady (30 min) | Recovery (10 min) | Chest at end of blocked phase |
| --- | ---: | ---: | ---: |
| automation | 33.7/min | 34.0/min | 200 |
| logistic | 37.5/min | 37.8/min | 200 |
| military | 33.7/min | 35.4/min | 200 |
| chemical | 31.4/min | 31.3/min | 200 |
| production | 31.5/min | 32.2/min | 200 |
| utility | 32.2/min | 32.0/min | 200 |

Pass floor is 28.5/min (95% of 30). Every machine crafted during the steady window, every entrance and both fluids fed a productive consumer, the largest bulk-inserter hand observed was 2. Ring peaks against capacity: red-green-military 167/496, blue 138/448, frames-processors 219/496 (44%, the highest), utility-production 152/448, export 146/592 (90% is the failure line).

## How it works

West manifold on the left, export ring on the right, three bands between them.

1. **West manifold (columns -20 to -1).** Circuits, copper, iron, steel and plastic each enter on a header row (rows -1, 1, 3, 5, 7) and run down a spine (columns -6, -9, -12, -15, -18) with priority splitter taps, one tap per consumer, so every consumer takes what it needs first. Brick, coal, stone and sulfur have one consumer each and enter on their own row. Acid and lubricant enter as pipes.
2. **Advanced-circuit bank (rows -1 to 12).** Lane belts, no ring. Q (row 0) carries circuits on its south lane and advanced circuits on its north lane; its circuits are side-loaded from the south onto a short belt at row -1, columns -5 and -4, which runs east and turns south into Q, so the loaded lane stays Q's south lane. R (row 6) carries plastic (north lane) and cable (south lane, dropped by five cable makers); it tunnels under four substations that sit in 2 x 2 gaps on rows 5-6. S (row 12) carries circuits and advanced circuits. North row: 5 cable makers, 9 advanced-circuit machines, 4 productivity-module machines (fed from Q, output over Q by long-handed arms onto a module lane on row -1); south row: 17 advanced-circuit machines. Every lane holds one item.
3. **Band X (two rings): red + green + military (west) and blue (east).** Raw materials reach the machines directly from rear lane belts (iron | coal above; brick | plastic and copper | steel below, shared with band Y, far belt reached with long-handed arms). The rings carry only intermediates and small items.
4. **Band Y (two rings): frames + processors + LDS (west) and utility + production + LDS + furnaces (east).** Batteries take acid on their rear arm row, electric engines lubricant, processors acid through pipe-to-ground pairs under their circuit belt. The processors' circuit belt (row 50) starts at column 1, fed down column 1 from a circuit tap near row 44; its east end turns north (dead end).
5. **Rail cell (south-west manifold corner, columns -10 to 0, rows 44 to 52).** Rail | stick | rail with direct insertion. Stone (south lane, side-loaded into a two-row stub in column -10) and steel (north lane) arrive on a belt at row 46 above the cell. Below the cell, the rail belt on row 52 gets iron side-loaded onto its north lane at its west end, and two bulk arms drop rails on its south lane. The rail belt runs east along row 52, rises to row 51 at column 6, tunnels under the processors' pipe-to-ground ends and enters the production row's rear belt (row 50) as a curve, so both lanes keep their item.
6. **Export ring (east edge, columns 53-54, rows 7 to 43).** A two-belt ring that receives advanced circuits from Q and S and the module lane, hands advanced circuits and modules to the blue and utility-production rings, collects all six packs and feeds the six chests. It runs counter-clockwise so blue science draws advanced circuits first.

### Control (what to preserve)

- Every ring is a closed belt loop; **every ring tile reads its own contents (hold) and all tiles of a ring share one red wire.** Separate rings have separate red networks. No green wire is used.
- Every arm that puts an item on a ring (admissions, machine outputs, ring-to-ring transfers) runs only while that ring holds fewer than the item's limit. Limit sums per ring (capacity in brackets): red-green-military 160 (496), blue 132 (448), frames-processors 208 (496), utility-production 144 (448), export 144 (592); each at most 60% of capacity.
- The module lane is read the same way; module output arms stop at 8 modules on the lane.
- Straight belt runs that nothing touches are buried. The shared underground optimizer buries 14 belts in 3 pairs; a second pass (`scripts/six-science/bury.mjs`) buries 157 more in 34 pairs, taking only plain belts with no reader, wire, arm or side input and a straight neighbour on both sides, and re-checking every underground pairing after each pair. Ring tiles and the module lane stay on the surface because their readers count them. The unit test checks that the pass finds nothing more to bury in the published string.
- Keep the splitter priorities, the inserter filters (every arm here is filtered), the chest limits (one stack) and the substations' copper wires.

## Reproduce

```
export FACTORIO_RAW=/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json
node scripts/six-science/generate.mjs          # writes six-science.txt and manifest.json (deterministic; status stays qualified only if native-report.json passed for the same SHA)
node scripts/six-science/validate.mjs          # full protocol (about 25 s wall), writes native-report.json and the manifest status
node --test tests/six-science.test.mjs
```

The generator keeps the manifest `qualified` only when the committed `native-report.json` passed for the exact string it just built; after any change to the string, run the validator, since the unit test requires `qualified`.

Exploration runs: `ESSENTIALS_EXPLORE=1 SIX_WARMUP=15 SIX_MEASURE=10 node scripts/six-science/validate.mjs` writes `.cache/six-science/explore-report.json`; `node scripts/six-science/diagnose.mjs` summarises pack rates, crafts per recipe, machine statuses, ring stock and entrance acceptance. `node scripts/six-science/generate.mjs --draft` prints the footprint without writing files; `SIX_LAYOUT`, `SIX_HOLES` and `SIX_G` (JSON) override layout values for experiments. The harness writes the blueprint SHA it was given into `result.json`, and the validator refuses a result whose SHA differs from the manifest; `SIX_REPORT_ONLY=1` (re-read an existing run) works only together with `ESSENTIALS_EXPLORE=1`, so it can never write the published report.

## Tried and rejected

Qualified and superseded (kept in `history/`, each with a `NOTE.md`):

- `history/stage-one`: 81 x 66 = 5,346 tiles, first full pass.
- `history/tighter-manifold`: 78 x 63 = 4,914 tiles, manifold moved two columns east.
- `history/buried-runs`: 78 x 60 = 4,680 tiles, the reviewed layout with straight manifold runs buried.
- `history/corner-rails`: 78 x 56 = 4,368 tiles, rail cell moved into the manifold corner.
- `history/top-rows`: 78 x 54 = 4,212 tiles, top two rows removed.

The published 77 x 54 adds one narrower manifold column and ends the export ring at row 43 instead of row 50 (its lowest transfer is at row 42); that shortened the lap and removed 14 belt tiles without changing the footprint.

Learned on the way (screens and drafts, not published):

- With 26 advanced-circuit machines the pack machines at full capacity want about 197 advanced circuits per minute against 195 supplied. On a clockwise export ring blue science, last in line, fell to 24-26/min. A long dead-end belt of advanced circuits to the processors and an uncapped module belt made it worse while they filled. Fixes: processors take advanced circuits from their ring, the module lane is capped, and the export ring runs counter-clockwise so blue is first.
- A tenth blue machine never crafted (blue is engine limited at 31.5/min), so nine are built.
- Spines two columns apart, with taps leaving the splitter into an underground belt: the westmost of five spines would need an 8-tile tunnel (fast undergrounds reach 7), so this does not fit five spines.
- Rail cell in the corner with its rail belt on row 51: the stone side-load needed row 43, which the plastic tap to band Y also needs, so no route was found. Moving the rail belt to row 52 and using a two-row stub on the input belt fixed it.
- A second narrower manifold column (spines at -5 to -17, west edge -19) did not route: the lubricant pipe found no path to the electric engines' header, and with the shared rear belts shifted only one column the copper tap to the shared zone found no path. Moving the west edge without moving the spines fails because the single-material rows need column W0+1 for the underground under the plastic spine.
- Replacing the export ring by lane belts (review idea, up to two columns) was analysed but not built. The bank's Q already reaches column 54, so the ring, its chest arms and the chests (columns 53 to 56) can only shrink if the ring is removed entirely; that means a new hand-off of advanced circuits and modules to the blue and utility-production rings and new pack collection. It is the highest-risk change and was left for a later round.
