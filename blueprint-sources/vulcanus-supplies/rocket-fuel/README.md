# Coal to rocket fuel · 12 a minute

**Qualified** in Factorio 2.1.25 Space Age on a Vulcanus surface for the exact string in `blueprint.txt` (SHA-256 `7a4378fc6d96432d0c16c58c465ae66a0287ae938e7bb22150b8e6f6e60a2003`): all 24 native scenarios passed. Report: `native-report.json`.

Makes **12 rocket fuel a minute on one belt** from coal, calcite, sulfuric acid and water: the same four inputs as the coal-to-plastic supply beside it. Inside, coal is turned into heavy oil (simple coal liquefaction, which comes with Vulcanus: no extra research, no steam), the heavy oil is cracked to light oil, most of the light oil is pressed into solid fuel, and ten solid fuel plus a little more light oil make one rocket fuel. Nothing else comes out: every fluid is used up inside, there is no by-product exit and no circuit wire.

A rocket needs 50 rocket fuel, so at 12 a minute this fills **one rocket every 4 minutes 10 seconds** (14.4 rockets an hour); measured 12.00 a minute with every input at its panel figure. (From the game's own data: the rocket silo takes 50 rocket parts and each part takes 1 rocket fuel.)

## Size and machines

- Footprint 34 x 10 = 340 tiles, counting every entity: 129 entities (3 assembling machine 3, 5 chemical plant, 6 display panel, 15 fast inserter, 37 fast transport belt, 3 oil refinery, 47 pipe, 10 pipe to ground, 3 substation).
- **3 oil refineries** (`simple-coal-liquefaction`: 10 coal + 2 calcite + 25 sulfuric acid give 50 heavy oil in 5 s; 12 crafts a minute each). Needed: 35.2 crafts a minute, so the three run at 97.8%. This is the tight spot: there is no spare refinery, and the most the build can make is 12.27 rocket fuel a minute.
- **2 chemical plants cracking heavy oil** (40 heavy oil + 30 water give 30 light oil in 2 s; 30 crafts a minute each). Needed: 44, 73.3%.
- **3 chemical plants making solid fuel** (10 light oil give 1 solid fuel in 1 s; 60 a minute each). Needed: 120 a minute, which the arithmetic gives as 2 plants at exactly 100%. **One plant more than the arithmetic was added on purpose**: with three, each plant stands beside its own assembling machine and hands its solid fuel straight across with one arm (66.7% each), so there is no solid-fuel belt and no plant has to run without a pause.
- **3 assembling machines 3** (`rocket-fuel`: 10 solid fuel + 10 light oil give 1 in 15 s, 12 s at speed 1.25; 5 a minute each). Needed: 12, 80%.
- 15 fast inserters, nothing bigger: 3 on each refinery, 1 between each solid-fuel plant and its assembling machine, 1 from each assembling machine to the exit belt. Hand size 1 in every run except the two that test bigger hands. No modules, no beacons, normal quality, no robots, no combinators.

The arithmetic at 12 a minute, from the pinned recipes: 12 rocket fuel need 120 solid fuel and 120 light oil; 120 solid fuel need 1,200 light oil; 1,320 light oil are 44 cracking crafts, 1,760 heavy oil and 1,320 water; 1,760 heavy oil are 35.2 liquefaction crafts: 352 coal, 70.4 calcite and 880 sulfuric acid.

## What one rocket fuel costs

- **29.3 coal per rocket fuel** (352 coal for 12), with 5.9 calcite, 73.3 sulfuric acid and 110 water.
- One rocket (50 rocket fuel): 1,467 coal, 293 calcite, 3,667 sulfuric acid, 5,500 water.

## Layout

```
   x 0123456789012345678901234567890123
 y0  ================.==<===>=.......##
 y1  .DRRRRRRRRRRRRRRR^HHHDHHHSSS.AAA##
 y2  ..RRRRRRRRRRRRRRR.HHH.HHHSSSiAAAis
 y3  ..RRRRRRRRRRRRRRR.HHH.HHHSSS.AAADs
 y4  ..RRRRRRRRRRRRRRR.=============..s
 y5  D.RRRRRRRRRRRRRRR.SSS.AAASSS.AAA.s
 y6  es.iii^.iii^.iii^.SSSiAAASSSiAAA.s
 y7  .eeeeeeeeeeeeeee..SSS.AAASSS.AAA.s
 y8  en..##v....v....vv##...i......i.Ds
 y9  D...##============##...eeeeeeeeeee
```

`R` oil refinery, `H` heavy-oil cracker, `S` solid-fuel plant, `A` assembling machine 3 (rocket fuel), `#` substation, `D` display panel, `=` pipe, `^ > v <` pipe-to-ground (the arrow is the side of its open pipe connection; its underground runs the other way), `n e s w` red belt (the way it runs), `i` fast inserter. Columns count from the west edge and rows from the north edge, both from 0.

- Columns 0 to 17 are the refinery row of the coal-to-plastic supply, tile for tile: the same three west entrances on the same rows, the same single belt with coal on one lane and calcite on the other, three arms per refinery, each refinery's heavy oil crossing under the belt to the pipe on row 9.
- Row 4 is the light-oil pipe. Above it stand the two crackers (H) and the first solid-fuel plant with its assembling machine; below it the other two pairs. Every machine on that pipe touches it with its own input or output and with nothing else.
- Heavy oil goes from row 9 under the ground up column 17 (rows 8 to 1) to row 0, into the west cracker at (18,0), and under the three water pipes to the east cracker at (24,0).
- Rocket fuel: the two lower assembling machines put it on the belt on row 9, the upper one on the belt down column 33; the two meet on the exit tile (33,9).

## Entrances and exit

Every port is on an edge and has a display panel with its icon, `IN:` or `OUT:`, the material and the per-minute figure. The figures are what the recipes need at 12 a minute (calcite needs 70.4 and is rounded up to 71). In the tables the "throttled run" is the full-length native run with every input at exactly its panel figure, and the "generous run" the one with every input offered more than it can use.

| Port | Material | Kind | Side | Tile | Panel text | Panel figure | Draw, throttled run | Draw, generous run |
| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: |
| IN-1 | coal | belt | west | (0,6) | `IN: coal 352/min` | 352/min | 352.0/min | 360.0/min |
| IN-2 | calcite | belt | west | (0,8) | `IN: calcite 71/min` | 71/min | 71.0/min | 72.0/min |
| IN-3 | sulfuric-acid | pipe | west | (0,0) | `IN: sulfuric-acid 880/min` | 880/min | 880.0/min | 900.0/min |
| IN-4 | water | pipe | north | (21,0) | `IN: water 1320/min` | 1,320/min | 1320.0/min | 1350.0/min |

| Port | Product | Kind | Side | Tile | Panel text | Target | Measured, throttled run | Measured, generous run |
| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: |
| OUT-1 | rocket-fuel | belt | east | (33,9) | `OUT: rocket-fuel 12/min` | 12/min | 12.0/min | 12.3/min |

- **Coal** enters on a belt at (0,6) and **calcite** on a belt at (0,8), both on the west edge. They meet on the first tile (1,7) of one east-running belt from opposite sides, so coal fills the north lane and calcite the south lane and neither can crowd the other out. Nothing feeds (1,7) from behind.
- **Sulfuric acid** enters by pipe at (0,0) on the west edge and runs along row 0 over the three refineries.
- **Water** enters by pipe at (21,0) on the north edge, the middle of three water pipes between the two crackers. Its panel stands directly below it at (21,1). Bring the water pipe in straight from the north: the pipes left and right of the water pipes on row 0 are heavy oil.
- **Rocket fuel** leaves on a belt at (33,9) on the east edge, running east. When nothing takes it, the belts fill, every machine stops on a full output, and the entrances stop taking; when it is taken again everything restarts by itself.

## Power

Three substations, wired to each other: (4,8) west, (18,8) middle and (32,0) north-east. Connect the outside network to the north-east one; the display panel `POWER: connect substation` at (32,3) marks it. No other pole is used. The machines draw about 3.4 MW when all run (3 refineries at 420 kW, 5 chemical plants at 210 kW, 3 assembling machines at 375 kW, from the pinned prototypes), plus the arms.

## Fluids: four pipe networks that never touch

Sulfuric acid (row 0, west), water (three pipes on row 0), heavy oil (row 9, column 17, row 0) and light oil (row 4). The rules this blueprint was built and tested to:

- **One fluid per pipe network.** The static model and the game's own fluid segments agree: four networks, one fluid each.
- **Every port in use meets exactly its own fluid.** A refinery's two acid inputs are one box inside the machine, and both stand on the acid pipe; its heavy-oil output stands on its own pipe-to-ground. A cracker's water input and heavy-oil input are two separate boxes on two separate pipes; its two light-oil outputs are one box and both stand on the light-oil pipe. A solid-fuel plant's two inputs are one box, both on the light-oil pipe.
- **Every port not in use faces no pipe.** Simple coal liquefaction leaves two of a refinery's three outputs unused, a solid-fuel plant has two unused outputs and an assembling machine one. The tiles in front of them (15 in all) hold an arm, a substation or nothing. A native probe put a pipe on every tile around each machine with its recipe set: the game connected only the ports listed as in use (`scripts/vulcanus-supplies/rocket-fuel/fluid-slots.json`).
- No machine changes its recipe, so no machine ever has a leftover fluid to push anywhere.

These are checked twice: by the static audit, and in the game in every scenario, where the game's own list of fluid connections must equal the static one (79 connections, none missing, none extra) and every pipe, underground and machine fluid box is read every 4 ticks for any fluid that is not its own.

## Beside the coal-to-plastic supply

The west half is the same as that supply's, so the two line up one above the other with their west edges in one column: sulfuric acid on row 0, coal on row 6 and calcite on row 8 of each. One acid pipe, one coal belt and one calcite belt running north to south along the west side can feed both, each with one branch per blueprint. Water enters each on its north edge.

For one copy of each (plastic 60 and lubricant 300 a minute, plus rocket fuel 12 a minute), by the panels:

| Input | Coal to plastic | Coal to rocket fuel | Both |
| --- | ---: | ---: | ---: |
| coal | 330/min | 352/min | **682/min** |
| calcite | 60/min | 71/min | **131/min** |
| sulfuric acid | 750/min | 880/min | **1,630/min** |
| water | 1,800/min | 1,320/min | **3,120/min** |

- 682 coal a minute fits on one red belt (1,800 a minute) or one yellow belt (900).
- **Leave at least three free rows between the two blueprints.** A pipe laid along the north or south edge of either one touches that blueprint's own pipes (the acid, heavy-oil and water pipes on row 0, the heavy-oil pipe on row 9). Bring each pipe in straight to its port and run it sideways only two rows or more away from an edge. The native test confirms the three tiles straight out from every port are free; it did not test the two blueprints standing together.

## Native evidence (exact string, Factorio 2.1.25, a Vulcanus surface)

Every scenario is its own headless game with a fresh import of the same string, on a Vulcanus surface (pressure 4000), with exactly the 46 technologies of `manifest.technologyClosure` researched and no inserter capacity bonus (except in the two hand-size runs of group 3). Inputs are supplied only at the four entrances, power only at the entry substation, and rocket fuel is taken only from the exit tile. The pass floor is 11.4 rocket fuel a minute (95% of 12). In all 24 scenarios together the fluid boxes were read 679,500 times (every pipe, underground and machine, every 4 ticks): **0 readings showed a foreign fluid**.

### 1. Supply protocol, full length (230 game minutes)

Fifteen minutes of warm-up from empty, then 30 measured minutes; then the exit blocked for 30 minutes and released; then all four inputs cut for 5 minutes and restored.

- **Every input at exactly its panel figure**: **12.00 rocket fuel a minute** over the 30 measured minutes; draw coal 352.0, calcite 71.0, sulfuric acid 880.0, water 1320.0 a minute.
- **Every input offered more than it can use** (full belts, full pipes): **12.27 rocket fuel a minute**; draw coal 360.0, calcite 72.0, sulfuric acid 900.0, water 1350.0. That is all three refineries without a pause: the ceiling.
- **Exit blocked 30 minutes**: nothing left the exit. The build went on taking coal for 12 minutes while its belts and machines filled (86 rocket fuel made after the block began), then every machine stood on a full output; none crafted in the last 5 minutes and the entrances took nothing. **Released**: back to 95% over five minutes after 300 s.
- **All inputs cut for 5 minutes**, then restored: back to 95% over five minutes after 302 s, and 12.00 a minute over the last 10 minutes.

Every input at its panel figure, by phase (per minute over the measured part of each phase):

| Phase (minutes) | Measured | rocket fuel out | coal in | calcite in | sulfuric-acid in | water in | Back to 95% over 5 minutes | Readings with a foreign fluid |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| warm-up (15) | last 15 | 11.33 | 351.9 | 70.9 | 880.0 | 1320.0 |  | 0 of 13,500 |
| steady (30) | last 30 | 12.00 | 352.0 | 71.0 | 880.0 | 1320.0 |  | 0 of 27,000 |
| exit blocked (30) | last 30 | 0.00 | 131.6 | 27.4 | 388.3 | 419.3 |  | 0 of 27,000 |
| release (15) | last 10 | 14.00 | 352.0 | 71.0 | 880.0 | 1320.0 | 300 s | 0 of 13,500 |
| input outage (5) | last 5 | 0.80 | 0.0 | 0.0 | 0.0 | 0.0 |  | 0 of 4,500 |
| recovery (20) | last 10 | 12.00 | 352.0 | 70.5 | 880.0 | 1320.0 | 302 s | 0 of 18,000 |

Every input offered more than it can use:

| Phase (minutes) | Measured | rocket fuel out | coal in | calcite in | sulfuric-acid in | water in | Back to 95% over 5 minutes | Readings with a foreign fluid |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| warm-up (15) | last 15 | 11.73 | 367.5 | 77.6 | 1031.7 | 1376.7 |  | 0 of 13,500 |
| steady (30) | last 30 | 12.27 | 360.0 | 72.0 | 900.0 | 1350.0 |  | 0 of 27,000 |
| exit blocked (30) | last 30 | 0.00 | 129.5 | 25.9 | 326.7 | 412.0 |  | 0 of 27,000 |
| release (15) | last 10 | 15.00 | 360.0 | 72.0 | 900.0 | 1395.0 | 300 s | 0 of 13,500 |
| input outage (5) | last 5 | 3.60 | 0.0 | 0.0 | 0.0 | 0.0 |  | 0 of 4,500 |
| recovery (20) | last 10 | 12.30 | 360.0 | 72.0 | 900.0 | 1350.0 | 300 s | 0 of 18,000 |

Each machine in the 30 measured minutes, every input at its panel figure:

| Machine | Entity | Recipe | Crafts/min | Status share (one sample a second) |
| --- | --- | --- | ---: | --- |
| liquefaction-1 | #1 | simple-coal-liquefaction | 12.0 | working 100% |
| liquefaction-2 | #2 | simple-coal-liquefaction | 12.0 | working 100% |
| liquefaction-3 | #3 | simple-coal-liquefaction | 11.2 | working 93%, fluid ingredient shortage 7% |
| heavy-cracking-1 | #4 | heavy-oil-cracking | 22.6 | working 75%, fluid ingredient shortage 25% |
| heavy-cracking-2 | #5 | heavy-oil-cracking | 21.4 | working 72%, fluid ingredient shortage 28% |
| solid-fuel-1 | #6 | solid-fuel-from-light-oil | 42.2 | working 70%, fluid ingredient shortage 30% |
| rocket-fuel-1 | #7 | rocket-fuel | 4.2 | working 84%, item ingredient shortage 16% |
| solid-fuel-2 | #8 | solid-fuel-from-light-oil | 39.9 | working 67%, fluid ingredient shortage 34% |
| rocket-fuel-2 | #9 | rocket-fuel | 4.0 | working 80%, item ingredient shortage 20% |
| solid-fuel-3 | #10 | solid-fuel-from-light-oil | 37.8 | working 63%, fluid ingredient shortage 37% |
| rocket-fuel-3 | #11 | rocket-fuel | 3.8 | working 76%, item ingredient shortage 24% |

### Shortened runs (groups 2 to 4)

These do not repeat the 15 + 30 minutes. After the disturbance each run goes on until the exit has given at least 11.4 a minute over 5 whole minutes in a row (it fails if that takes more than 40 minutes; the "minutes until the rate" column counts from the end of the disturbance and can not be less than 5), and the rate is then measured over 10 more minutes. Nobody helps: nothing is flushed, rebuilt or restarted.

### 2. Each input withheld from a cold start for 20 minutes, then supplied (144 game minutes)

The other three entrances are at their panel figures the whole time; the withheld one then comes in at its panel figure.

| Scenario | What happened first | Minutes until the rate | Rocket fuel a minute, next 10 minutes | Readings with a foreign fluid | Game minutes | Result |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `withheld-coal` | coal withheld from a cold start (20 min, rocket fuel out 0.00) | 6 | 12.00 | 0 of 32,400 | 36 | passed |
| `withheld-calcite` | calcite withheld from a cold start (20 min, rocket fuel out 0.00) | 6 | 12.10 | 0 of 32,400 | 36 | passed |
| `withheld-sulfuric-acid` | sulfuric-acid withheld from a cold start (20 min, rocket fuel out 0.00) | 6 | 11.80 | 0 of 32,400 | 36 | passed |
| `withheld-water` | water withheld from a cold start (20 min, rocket fuel out 0.00) | 6 | 12.10 | 0 of 32,400 | 36 | passed |

### 3. How a player builds it (301 game minutes)

Entrances are offered more than they can use, except in the two hand-size runs (panel figures).

- **Built a piece at a time** with power and all four inputs live from the first tick: one entity every 30 ticks, in three seeded shuffled orders, with all pipes first, and with all machines and substations first. Fluid runs into half-built pipe runs the whole time.
- **Power late**: everything placed and supplied, power after ten minutes.
- **Each input late**: everything placed and powered, one input connected after five minutes (for the acid and the water the outside pipe does not exist before that).
- **Exit not connected for an hour**, then connected.
- **Bigger hands**: every other run uses hand size 1. A player who has researched inserter capacity bonus has fast inserters that carry more; the two runs give the force a bonus of 1 and 3 (hand size 2 and 4, the second being the most the game's researches give), from empty.

| Scenario | What happened first | Minutes until the rate | Rocket fuel a minute, next 10 minutes | Readings with a foreign fluid | Game minutes | Result |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `build-shuffle-1` | built one entity every 30 ticks, last one at 65 s | 7 | 12.20 | 0 of 15,300 | 17 | passed |
| `build-shuffle-2` | built one entity every 30 ticks, last one at 65 s | 7 | 12.30 | 0 of 15,300 | 17 | passed |
| `build-shuffle-3` | built one entity every 30 ticks, last one at 65 s | 7 | 12.30 | 0 of 15,300 | 17 | passed |
| `build-pipes-first` | built one entity every 30 ticks, last one at 65 s | 7 | 12.30 | 0 of 15,300 | 17 | passed |
| `build-machines-first` | built one entity every 30 ticks, last one at 65 s | 7 | 12.30 | 0 of 15,300 | 17 | passed |
| `late-power` | no power for ten minutes (10 min, rocket fuel out 0.00) | 6 | 12.30 | 0 of 23,400 | 26 | passed |
| `late-coal` | coal not connected for five minutes (5 min, rocket fuel out 0.00) | 6 | 12.20 | 0 of 18,900 | 21 | passed |
| `late-calcite` | calcite not connected for five minutes (5 min, rocket fuel out 0.00) | 6 | 12.40 | 0 of 18,900 | 21 | passed |
| `late-sulfuric-acid` | sulfuric-acid not connected for five minutes (5 min, rocket fuel out 0.00) | 6 | 12.40 | 0 of 18,900 | 21 | passed |
| `late-water` | water not connected for five minutes (5 min, rocket fuel out 0.00) | 5 | 13.00 | 0 of 18,000 | 20 | passed |
| `exit-unconnected` | exit not connected for an hour (60 min, rocket fuel out 0.00) | 5 | 15.00 | 0 of 67,500 | 75 | passed |
| `hand-size-2` | fast inserters carry 2, started empty | 6 | 11.90 | 0 of 14,400 | 16 | passed |
| `hand-size-4` | fast inserters carry 4, started empty | 6 | 11.80 | 0 of 14,400 | 16 | passed |

The entities appear by script, one every half second; construction robots were not used. After the hour with the exit not connected the belts and machines are full, so the first minutes after connecting run above 12.

### 4. Placed turned and mirrored (80 game minutes)

Every input at its panel figure, from empty. Placed facing north is the two full-length runs of group 1. Turned a quarter, a half and three quarters, the game turns the published string itself. A blueprint can not be flipped by script, so for the two mirror images the runner writes the mirrored string (positions and directions mirrored, the mirror flag on the refineries and chemical plants swapped) and the game builds that. In every placement the game's own fluid connections must again equal the static model's, so every port meets its own fluid.

| Scenario | What happened first | Minutes until the rate | Rocket fuel a minute, next 10 minutes | Readings with a foreign fluid | Game minutes | Result |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `place-rot90` | turned by the game, started empty | 6 | 11.80 | 0 of 14,400 | 16 | passed |
| `place-rot180` | turned by the game, started empty | 6 | 11.80 | 0 of 14,400 | 16 | passed |
| `place-rot270` | turned by the game, started empty | 6 | 11.80 | 0 of 14,400 | 16 | passed |
| `place-flipH` | mirror image, started empty | 6 | 11.80 | 0 of 14,400 | 16 | passed |
| `place-flipV` | mirror image, started empty | 6 | 11.80 | 0 of 14,400 | 16 | passed |

## Known limits

- **No reserve in the refineries.** Twelve a minute needs 97.8% of the three refineries. If coal, calcite or acid arrive short, output falls in step; there is nothing to catch up with.
- **The calcite panel says 71, the recipes use 70.4.** Offered exactly 71, the calcite lane slowly fills and then takes 70.4.
- **A blocked exit takes a while to stop the build**: the rocket-fuel belts and the machines fill first (measured: coal was taken for 12 minutes after the block). Nothing is lost; it is all used after the release.
- The full-length runs use hand size 1 (no inserter capacity bonus). Hand sizes 2 and 4 were tested in shortened runs only.
- The mirror images were built from a mirrored string written by the test, not with the game's own flip key; the piece-by-piece builds were done by script, not by robots.
- Not tested standing next to the coal-to-plastic supply (see the spacing rule above).

## What to preserve

- The first belt tile (1,7) must have no belt behind it: coal and calcite must stay one lane each.
- Keep these 9 empty tiles free of pipes: (25,0), (27,0), (30,0), (2,6), (7,6), (12,6), (20,8), (25,8), (27,8). They face ports that are not in use (the other 6 such tiles hold an arm or a substation).
- Keep column 17 between rows 2 and 7 free of pipes: a pipe at (17,4) would join the heavy oil to the light oil.
- The west cracker is mirrored so that both crackers take water next to the gap between them. Do not turn or flip single machines; turn or flip the whole blueprint.

## Reproduce

From `factorio-command-center/`:

```
node scripts/vulcanus-supplies/generate.mjs rocket-fuel       # writes this folder (byte-identical on re-run; keeps the committed string)
node scripts/vulcanus-supplies/audit.mjs rocket-fuel          # static audit (40 checks)
node scripts/vulcanus-supplies/validate.mjs rocket-fuel       # all native scenarios, side by side within the machine's instance budget
node scripts/vulcanus-supplies/probes/ports.mjs rocket-fuel   # the native port probe behind rocket-fuel/fluid-slots.json
node --test tests/vulcanus-rocket-fuel.test.mjs
```

The validator needs the installed Factorio 2.1.25 (Steam, Space Age) and compares its game files with `scripts/vulcanus-supplies/prototypes.json`; the two recipes and two items that file lacks are pinned from the same game dump in `scripts/vulcanus-supplies/rocket-fuel/prototypes.json`. Every game runs in its own private profile under `.cache/vulcanus-supplies/` and never touches the player's game, saves or mod profile. Tests need neither the game nor the dump.
