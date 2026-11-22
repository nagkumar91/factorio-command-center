# Oil products supplier · gas, acid, lubricant, sulfur, light oil

**Qualified.** Full native run of the exact published string (SHA-256 `01becd0ac150eee407859a994f4fd6c840165b785fac37d6a71e11a223d6c39a`), fed exactly the panel figures, every output drawn at its figure: **petroleum gas 7,140.0, sulfuric acid 500.0, lubricant 150.0, sulfur 15.0 per minute** over a 60-minute window, every refinery and chemical plant working. All 7 required scenarios passed (below).

This module turns crude oil and water (and a few iron plates for the acid) into the fluids the library's factories take by pipe: **petroleum gas, sulfuric acid, lubricant and light oil**, plus **sulfur on a red belt**. One copy serves the standard 30-per-minute science factory and its medium plastic supplier at the same time: sulfuric acid 500, lubricant 150 and sulfur 15 per minute, and 7,140 petroleum gas per minute (6,000 for a 600-bar plastic supplier and 1,140 spare). A light-oil outlet serves the rocket-fuel supplier; every unit of light oil drawn there is light oil not cracked to gas.

## Size and machines

- Footprint **43 x 15 = 645 tiles**, 280 entities.
- 7 oil refineries (advanced oil processing); 11 chemical plants: 6 light-oil cracking, 2 heavy-oil cracking, 1 sulfur, 1 sulfuric acid, 1 lubricant. No modules, no beacons, no robots.
- 2 storage tanks, 2 pumps, 137 pipes, 80 pipes-to-ground, 17 red belts, 10 red underground belts, 3 fast inserters, 3 substations, 8 display panels; red circuit wires join the two tanks, the two pumps and the substations.
- Power: about 5.3 MW at full load (refinery 420 kW, chemical plant 210 kW, pump 29 kW, plus three inserters).

## How many refineries (computed from the 2.1.24 dump)

Recipes (`scripts/oil-products/shared.mjs`, compared with the dump by the generator and the test): advanced oil processing 100 crude + 50 water -> 25 heavy + 45 light + 55 gas in 5 s; heavy cracking 40 heavy + 30 water -> 30 light in 2 s; light cracking 30 light + 30 water -> 20 gas in 2 s; sulfur 30 gas + 30 water -> 2 sulfur in 1 s; sulfuric acid 5 sulfur + 1 iron + 100 water -> 50 acid in 1 s; lubricant 10 heavy -> 10 lubricant in 1 s. Refinery and chemical plant both craft at speed 1, so a refinery does 12 crafts a minute.

- Sulfuric acid 500/min = 10 crafts: 50 sulfur, 10 iron, 1,000 water. Sulfur 50 + 15 for the belt = 65/min = 32.5 crafts: **975 gas**, 975 water.
- Lubricant 150/min = 15 crafts: 150 heavy oil.
- With all other heavy and light oil cracked, each refinery adds 1,170 gas a minute (660 direct, 360 from its 540 light oil, 150 from its 300 heavy oil by way of light oil), less a fixed 75 because the lubricant's 150 heavy oil is not cracked.
- Gas needed: 6,000 for the plastic supplier + 975 for sulfur = 6,975. Refineries: (6,975 + 75) / 1,170 = **6.026, rounded up to 7** (inside the 4..9 the plan allowed).
- 7 refineries make 2,100 heavy, 3,780 light and 4,620 gas a minute directly. Heavy cracking 48.75 crafts/min = 1.625 plants -> **2**; light cracking 174.75 crafts/min = 5.825 plants -> **6**; sulfur 0.542, acid 0.167, lubricant 0.250 -> 1 each: **11 chemical plants**.
- With cracking: light oil 5,243 a minute (all cracked), gas 8,115 a minute; 975 to sulfur; **export 7,140** = 6,000 + 1,140 surplus.
- Inputs: **crude oil 8,400, water 12,880, iron plates 10 per minute.**
- Light-oil outlet: 660 light oil a minute drawn is 660 not cracked, so the gas export falls by 660 x 20/30 = 440 to **6,700** (water falls by 660 to 12,220). Measured below: 6,703.3.

## Layout

```
  0 DD==========<=D.>===========.D=PP=======...
  1 LLLP.##LLLLLLUUU.LLLLLL##..LLLTTT.HHHHHHTTT
  2 LLLP.##LLLLLLUUU.LLLLLL##..LLLTTT.HHHHHHTTT
  3 LLL^...LLLLLLUUU.LLLLLL....LLLTTT.HHHHHHTTT
  4 =<^....^>==<^=...^>==<^....^>=<.^>=<==>=..=
  5 D=<v......>===<.....>===<.....>==<^>==<^.>=
  6 ==v===<v.===v>==<v.===v>==<v.===v>==<.>===.
  7 =.=<==>=<==>=<==>=<==>=<==>=<==>=.=......==
  8 RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR##..v.=D
  9 RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR##===.=.
 10 RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRAAA.SSS.
 11 RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRAAAfSSSD
 12 RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRAAA.SSSD
 13 <=>====<====>====<====>====<====>=v.f=<.f.>
 14 u=<oeeeu>=<oeeeeeu>=<oeeeeeu>=<ou>=oe...eee
```

`R` oil refinery, `L` light-oil cracking, `H` heavy-oil cracking, `S` sulfur, `A` sulfuric acid, `U` lubricant, `T` storage tank, `P` pump, `#` substation, `D` display panel, `=` pipe, `^ > v <` pipe-to-ground (the arrow is the side of its pipe connection; its underground runs the other way), `e` red belt (east), `u`/`o` red underground belt in/out, `f` fast inserter. Rows are numbered from the north edge, columns from the west edge (0-based, as in the tables).

## Inputs (west)

| Entrance | Tile | Per minute (panel) | Taken in the design run |
| --- | --- | ---: | ---: |
| water (pipe) | (0,4) | 12,880 | 12,880.0 |
| crude oil (pipe) | (0,13) | 8,400 | 8,400.0 |
| iron plates (red belt) | (0,14) | 10 | 10.0 |

Water enters at the west end of row 4, crude oil at the west end of row 13 (a pipe-to-ground facing west), iron plates on the bottom row (a red underground belt entrance facing east; plates may come on either lane). The two fluid entrances are 9 rows apart, so plain pipes can be brought straight in. A display panel near each port gives its figure (the crude and iron panels sit at the north-west corner, the nearest free tiles).

## Outputs (east and north)

| Output | Side | Tile | Per minute (panel) | Measured, design run |
| --- | --- | --- | ---: | ---: |
| petroleum gas (pipe) | east | (42,7) | 7,140 | 7,140.0 |
| sulfuric acid (pipe) | east | (42,13) | 500 | 500.0 |
| lubricant (pipe) | north | (13,0) | 150 | 150.0 |
| light oil (pipe) | north | (30,0) | 0 in normal use, up to 660 | 660.0 when drawn at 660 |
| sulfur (red belt) | east | (42,14) | 15 | 15.0 |

Gas, acid and sulfur leave east; lubricant and light oil leave **north** (row 0), straight above the lubricant plant and the light tank. On the east edge those two would need two more pipe rows or columns through the east wing; on the north edge they cost nothing. Each outlet carries only its own product: in every scenario the harness checked once a second, and no other fluid ever appeared at a fluid outlet and nothing but sulfur on the sulfur belt.

## How it works

- **Refineries** (rows 8..12) face north; every second one is mirrored (2.x flips refineries and chemical plants; blueprint field `mirror`), so neighbouring refineries put like outputs and like inputs side by side. Row 13 carries crude oil (entrance at the west, pipe-to-ground pairs under the water inputs); row 14 links the water inputs.
- **Manifold** above the refineries: row 7 is the light-oil chain (the refinery light outputs), row 6 the gas chain (gas outputs rise into it), row 5 the heavy-oil chain (heavy outputs rise through row 6 and join row 5 where the water row above has no pipe). Each chain jumps the others' risers with pipe-to-ground pairs; a pair passes under a crossing pair without joining it (proved natively, below).
- **Water**: the entrance is the west end of row 4; row 4 runs east (pipe-to-ground pairs under the crossings) to column 34, where a pipe-to-ground pair under refinery 7 (rows 5 -> 13) takes water down to the refinery inputs.
- **Cracker row** (rows 1..3; the chemical plants face south, so their inputs are on row 4): six light-oil crackers take light oil from row 7 through vertical pipe-to-ground pairs (rows 4 -> 6) and water from row 4.
- **Gas from the light crackers** collects on row 0 and runs west to the pump in column 3, which drops it into the gas chain. The pump runs only while the **light tank** (columns 30..32, joined to the light-oil chain) holds more than 10,000: light oil is cracked only above that level, which keeps the light-oil outlet supplied. While the pump is off the crackers fill their outputs and stop.
- **Heavy-oil cracking** (two plants east of the light tank) takes heavy oil from row 5 and water from row 4; its light oil goes west on row 0 through a pump into the light tank. That pump runs only while the **heavy tank** (east end) holds more than 10,000: heavy oil is cracked only above that level, so the lubricant plant (columns 13..15, heavy oil from row 5) always has heavy oil.
- **Sulfur and acid** (east of the refineries): the sulfur plant takes gas and water from above; one fast inserter hands sulfur to the acid plant, another puts it on the sulfur belt (bottom row, east). Iron arrives on the bottom row: the belt hops east in red underground belts under the water link and ends at the acid plant's iron inserter.
- **Circuit wiring**: one red network joins both tanks, both pumps and the substations (as relays). Each pump tests its own signal (light oil or heavy oil), so the two controls do not interfere.
- **Power**: 3 substations in holes of the cracker row and the east wing cover every refinery, plant, pump and inserter; the harness checks that all of them are on one network.

What to preserve: the mirrored refineries; every pipe-to-ground pair (several pass under crossings or under refinery 7); the two pumps, their conditions and the red wires; the empty tile after the end of the iron belt (iron must never run on to the sulfur belt).

## Native scenarios (the exact published string)

Protocol: 30 min warm-up, 60 min measured; blocked scenarios: 60 min blocked (measured), 15 min settle, 60 min recovery (measured). One copy per scenario, all side by side in one headless game. Figures per minute; "drawn" is what the harness actually took at each outlet.

| Scenario | Window | Gas | Acid | Lubricant | Sulfur | Light oil | Crude in | Water in | Iron in | Result |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1. Design rates | measure | 7,140.0 | 500.0 | 150.0 | 15.0 | 0.0 | 8,400.0 | 12,880.0 | 10.0 | pass |
| 2. Acid blocked | blocked | 7,140.0 | 0.0 | 150.0 | 15.0 | 0.0 | 7,943.3 | 10,191.9 | 5.1 | pass |
| 2. Acid blocked | recovery | 7,140.0 | 500.0 | 150.0 | 15.0 | 0.0 | 8,395.0 | 12,880.0 | 10.0 | pass |
| 2. Lubricant blocked | blocked | 7,140.0 | 491.3 | 0.0 | 15.0 | 0.0 | 8,400.0 | 12,880.0 | 10.0 | pass |
| 2. Lubricant blocked | recovery | 7,140.0 | 500.0 | 150.0 | 15.0 | 0.0 | 8,400.0 | 12,880.0 | 10.0 | pass |
| 2. Sulfur belt blocked | blocked | 7,140.0 | 500.0 | 150.0 | 0.0 | 0.0 | 8,400.0 | 12,400.5 | 10.0 | pass |
| 2. Sulfur belt blocked | recovery | 7,140.0 | 500.0 | 150.0 | 15.0 | 0.0 | 8,400.0 | 12,880.0 | 10.0 | pass |
| 3. Gas blocked | blocked | 0.0 | 500.0 | 150.0 | 15.0 | 0.0 | 1,388.3 | 3,236.1 | 10.0 | pass |
| 3. Gas blocked | recovery | 7,140.0 | 500.0 | 150.0 | 15.0 | 0.0 | 8,396.7 | 12,880.0 | 10.0 | pass |
| 4. Light oil drawn 660 | measure | 6,703.3 | 500.0 | 150.0 | 15.0 | 660.0 | 8,400.0 | 12,225.6 | 10.0 | pass |
| 5. Feed at 80% | measure | 5,653.7 | 400.0 | 150.0 | 15.0 | 0.0 | 6,720.0 | 10,304.0 | 8.0 | pass |
| Sulfur 30, gas 6,000 | measure | 6,000.0 | 500.0 | 150.0 | 30.0 | 0.0 | 7,460.1 | 11,863.7 | 10.0 | informational |
| Lubricant 300, gas 6,000 | measure | 6,000.0 | 500.0 | 300.0 | 15.0 | 0.0 | 7,305.7 | 11,206.2 | 10.0 | informational |
| Acid 1,000, iron 20, gas 6,000 | measure | 6,000.0 | 871.7 | 150.0 | 15.0 | 0.0 | 7,891.7 | 13,380.0 | 20.0 | informational |
| Gas pulled at 9,000 | measure | 7,184.2 | 500.0 | 150.0 | 15.0 | 0.0 | 8,400.0 | 12,880.0 | 10.0 | informational |

What happens in each case (measured):

- **Design rates**: gas 7,140.0 of 7,140, so the **measured surplus** over the plastic supplier's 6,000 is **1,140.0**. Refineries 84.0 crafts/min (all 7 at full speed), light cracking 174.8, heavy cracking 48.8 crafts/min. Light tank 8,845..10,996 and heavy tank 9,694..10,034 during the window: both sit at their thresholds while the pumps open and close.
- **Acid not drawn**: the acid plant fills and stops and takes no more iron; sulfur still goes to the belt (15.0). The gas no longer needed for the acid's sulfur backs up, the gas pump cannot empty the crackers, the light tank fills (up to 25,000) and the refineries ease to 79.0 crafts/min; gas 7,140.0 and lubricant 150.0 stay at their figures. Acid 500.0 in recovery.
- **Lubricant not drawn**: the lubricant plant stops, heavy oil rises over its threshold and goes to the heavy crackers (52.5 crafts/min instead of 48.8); the rest stays at its figures (acid 491.3); lubricant 150.0 in recovery.
- **Sulfur belt not taken**: the belt fills, the sulfur plant makes only the acid's sulfur (25.0 crafts/min); the rest stays at its figures; sulfur 15.0 in recovery.
- **Gas export not drawn**: only the gas export stops. The gas chain fills, then the light crackers' outputs and the light tank, and the refineries slow to what the sulfur plant burns: **13.4 crafts/min** (of 84), taking crude 1,388.3 and water 3,236.1. Sulfuric acid 500.0, lubricant 150.0 and sulfur 15.0 carry on at full rate: the sulfur plant keeps drawing gas and so keeps the refineries turning. When the export reopens it is back to 7,140.0 with no intervention.
- **Light oil drawn at 660**: light oil 660.0, gas 6,703.3 (computed 6,700), acid, lubricant and sulfur unchanged.
- **Feed at 80%** (crude 6,720, water 10,304, iron 8): lubricant 150.0 and sulfur 15.0 keep their figures (the heavy threshold protects lubricant; the sulfur plant has spare capacity), acid follows the iron to 400.0, and gas takes the rest of the cut: 5,653.7 (computed 5,652). Every machine kept working; nothing jammed.
- **Gas pulled harder than it is made** (informational, 9,000/min asked): the export gave 7,184.2, and acid 500.0, lubricant 150.0 and sulfur 15.0 held. There is no gas-priority valve, though: by the arithmetic a copy makes 8,115 gas a minute, so sulfur or acid drawn beyond the panel figures uses gas the export would otherwise carry.

## Pairing with the library

Copies of this supplier each consumer needs at the panel figures of one copy (acid 500, lubricant 150, sulfur 15, gas 7,140, light oil 660). Demands from the read-only library survey of 2026-11-22.

| Consumer | Takes per minute | Copies |
| --- | --- | ---: |
| Six-pack science, fully integrated, 60/min each (`flight-science-sided/full`) | sulfuric acid 1,000, lubricant 300, sulfur 30 | 2 |
| Robots 10/min + roboport 1/min (`flight-robots`) | sulfuric acid 800, lubricant 300 | 2 |
| Robot logistics workshop (`robot-logistics-workshop`) | sulfuric acid 800, lubricant 300 | 2 |
| Four-pack science 30/min each (and the 15- and 30-lab versions) (`rgby-science`) | sulfuric acid 500, lubricant 150, sulfur 15 | 1 |
| Five-pack science 30/min each (and the 15- and 30-lab versions) (`five-science`) | sulfuric acid 500, lubricant 150, sulfur 15 | 1 |
| Six-pack science 30/min each (from supplied circuits) (`six-science`) | sulfuric acid 500, lubricant 150, sulfur 15 | 1 |
| Robot essentials (half-rate robot workshop) (`robot-essentials`) | sulfuric acid 400, lubricant 150 | 1 |
| Processing-unit supplier (unpublished branch) (`processing-units`) | sulfuric acid 135 | 1 |
| Space launch kit (one-off) (`launch-kit`) | sulfuric acid 38, lubricant 82 | 1 |
| Rocket supplies (`rocket-supplies`) | sulfuric acid 25 | 1 |
| Science RGB 60/min (and RGB + military) (`flight-science`) | sulfur 30 | 2 |
| Six-pack science, hybrid and compact sided, 60/min each (`flight-science-sided/hybrid`) | sulfur 30 | 2 |
| Rocket-fuel supplier (`rocket-fuel-supplier`) | light oil 660 | 1 |
| Blue-tier mall (on demand, no figure published) (`requested-malls/blue-tier-mall`) | lubricant (no figure) | 1 (no figure published; on demand) |
| Plastic supplier, 240 bars/min (designed in parallel) (`plastic-supplier`) | petroleum gas 2,400 | 1 |
| Plastic supplier, 600 bars/min (designed in parallel) (`plastic-supplier`) | petroleum gas 6,000 | 1 |
| Plastic supplier, 1,200 bars/min (designed in parallel) (`plastic-supplier`) | petroleum gas 12,000 | 2 |

- **Lubricant 300 and acid 800 to 1,000** (the integrated six-pack factory, flight robots, the robot logistics workshop): two copies side by side, each giving 500 acid and 150 lubricant; their gas exports can join (two copies also feed the 1,200-bar plastic supplier's 12,000). Measured headroom of one copy whose gas goes to one medium plastic supplier (6,000): lubricant 300.0 when drawn at 300 and sulfur 30.0 when taken at 30, with the other outputs at their figures; acid only 871.7 when drawn at 1,000 with 20 iron plates (the sulfur plant is the limit). So one copy can cover lubricant 300 or sulfur 30 on its own, but not acid 1,000: plan two copies for the largest factory.
- Small consumers (processing units 135, rocket supplies 25, the launch kit) can share one copy's acid and lubricant pipes with a science factory as long as the sums stay inside 500 and 150.
- The rocket-fuel supplier takes light oil 660 from the north outlet; that copy then exports about 6,700 gas (measured above).

## Candidates

Both arrangements were built and run through the full native protocol (every scenario above).

| Candidate | Size | Tiles | Entities | Design run: gas / acid / lubricant / sulfur | Result |
| --- | --- | ---: | ---: | --- | --- |
| `east-wing` (published): east wing, three substations | 43 x 15 | 645 | 280 | 7,140.0 / 500.0 / 150.0 / 15.0 | qualified |
| `east-wing-four-substations`: east wing, four substations | 44 x 15 | 660 | 287 | 7,139.7 / 500.0 / 150.0 / 15.0 | qualified |

The four-substation candidate keeps lubricant in the third gap of the cracker row and needs a fourth substation to bridge from the middle of the row to the east wing; moving lubricant to the second gap lets one substation in the third gap reach both the first gap and the east wing (18 tiles each way), which frees a column at the east end. Its string, manifest and native report are in `candidates/east-wing-four-substations/`.

Layouts screened on paper with the fluid model and not built: chemical plants below the refineries (water at hand, but every oil product would have to cross the refinery and both input rows), all eleven plants in one row above the manifold (the refinery outputs leave only 7 light and 7 heavy columns over 35 tiles, too few slots), and the manifold with gas on top and heavy oil beneath it (heavy oil then cannot get east past the last refinery's gas riser).

## Mechanics proved natively (Factorio 2.1.24, headless probes)

Probe scripts: `scripts/oil-products/probes/`. What the layout relies on:

- **Mirroring**: a blueprint entity with `mirror: true` imports mirrored (`LuaEntity.mirroring`) for oil refineries and chemical plants, and the fluid connections flip across the facing axis (a north-facing refinery swaps its water and crude inputs and its heavy and gas outputs).
- **Fluid boxes per recipe** (`get_fluid_box_pipe_connections`, `get_fluid_filter`): north-facing refinery on advanced oil processing: water input at (-1, +3), crude at (+1, +3), heavy (-2, -3), light (0, -3), gas (+2, -3) from its centre. In 2.1 a chemical plant merges its boxes when a recipe uses fewer fluids: both cracking outputs carry the one product; sulfur has no fluid output; sulfuric acid takes water at both inputs; lubricant takes heavy oil at both inputs.
- **Pipe-to-ground**: ends up to 10 tiles apart pair (9 tiles between); 11 apart do not. Two facing pipes-to-ground on adjacent tiles pair (a vertical-only connector). A pair passes under a perpendicular pair, and under a refinery, without joining anything.
- **Tanks and pumps**: a storage tank and the pipes joined to it form one fluid segment, and the tank's circuit signal is its share of the segment. A pump with a circuit condition on that signal holds the tank at the threshold. Scripted `insert_fluid` and `remove_fluid` on a pipe add to and take from its segment (the harness feeds and draws that way).

## Native evidence

- Report: `native-report.json`, `passed: true`, blueprint SHA-256 `01becd0ac150eee407859a994f4fd6c840165b785fac37d6a71e11a223d6c39a`, prototype SHA-256 `ce40aee67d984865f22ed8e65ba6b93fefb014fc35e45b747b64aca3ed5682a3`, created 2026-11-22T05:28:47.596Z. Factorio 2.1.24 Space Age, headless benchmark with a private config and mod directory under `.cache/oil-products/`.
- Feeding: Declared west entrances only, at the panel figures (scaled or overridden only where a scenario says so): fluids get perMinute/3600 per tick plus what they refused before (carry capped at one second of supply); the iron belt gets a credit of perMinute/3600 per tick (capped at 8), one plate per credit on alternating lanes. Nothing else is seeded.
- Drawing: Declared outputs only, at the scenario figure: fluids remove perMinute/3600 per tick plus the unmet carry (capped at one second) from the outlet pipe; the sulfur belt is emptied every 4 ticks up to its credit. Once a second every outlet is checked for any other fluid (or, on the belt, any other item).
- Every copy checks on import: geometry, direction, mirroring and recipe of every machine, no modules, both pump conditions and that each pump shares the red network with its tank; one second in, that every machine, pump and inserter is powered from one network; and that three tiles outward from every port are free.
- `node scripts/oil-products/generate.mjs` writes this folder (string, manifest, README, candidate); `node scripts/oil-products/validate.mjs` runs the native protocol (`OIL_VARIANT=east-wing-four-substations` for the candidate, `OIL_EXPLORE=1` for a short run that never touches the report).
