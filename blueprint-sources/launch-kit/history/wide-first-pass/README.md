# Space launch kit · silo, pad, starter pack and platform parts

Status: **qualified** (full native protocol, report `native-report.json`, blueprint SHA-256 `12dd9948e0e2b5b597d7855cf99c8e27c82c951f3cbb5d4a392200e1273a5c27`).

One ground blueprint that builds, once, everything needed to set up white science from orbit, and then stops: the rocket silo, the cargo landing pad, the space platform starter pack and every item the `white-platform` and `white-pack-receiver` blueprints need. Each item sits in its own passive provider chest on the east side, capped at its count. When every chest is at its count nothing crafts any more; take items out and exactly those are made again.

## Size and machines

Footprint 37 x 27 = **999 tiles** (goal 900, stretch 780, fallback 1250). The goal is missed by 99 tiles: 16 chests need 16 rows of the east column next to five exact machines (3 rows each) and the silo needs a sixth arm side, which sets the height at 27; the ring, two lane belts and 29 machines set the width.

29 machines: 1 accumulator, 2 advanced-circuit, 1 arithmetic-combinator, 1 assembling-machine-1, 1 assembling-machine-2, 1 asteroid-collector, 1 battery, 1 cargo-landing-pad, 1 constant-combinator, 1 copper-cable, 1 crusher, 1 decider-combinator, 1 electric-engine-unit, 1 electric-furnace, 1 engine-unit, 1 fast-inserter, 1 inserter, 1 iron-gear-wheel, 1 low-density-structure, 1 passive-provider-chest, 1 pipe, 1 processing-unit, 1 rocket-silo, 1 solar-panel, 1 space-platform-foundation, 1 space-platform-starter-pack, 1 steel-chest, 1 substation (all assembling machine 2, except the battery chemical plant). No modules, beacons, AM3, foundry or electromagnetic plant.

## Kit contents (outputs, east side)

Counts live only in `scripts/launch-kit/bill.json` (`cap = count + spare`, spare: 10% rounded up on fast inserters and foundation). Bill sources: white-platform `planning`, white-pack-receiver `planning`.

| Item | count | spare | cap (chest) | max cap | control | completed at (min) |
| --- | ---: | ---: | ---: | ---: | --- | ---: |
| rocket-silo | 1 | 0 | 1 | 1 | exact latch | 66.5 |
| cargo-landing-pad | 1 | 0 | 1 | 1 | exact latch | 49 |
| space-platform-starter-pack | 1 | 0 | 1 | 1 | exact latch | 22.8 |
| space-platform-foundation | 173 | 18 | 191 | 330 | chest condition | 63.8 |
| asteroid-collector | 4 | 0 | 4 | 8 | exact latch | 61.2 |
| crusher | 3 | 0 | 3 | 6 | exact latch | 34.5 |
| assembling-machine-2 | 4 | 0 | 4 | 10 | chest condition | 22.4 |
| electric-furnace | 1 | 0 | 1 | 4 | chest condition | 10.8 |
| fast-inserter | 21 | 3 | 24 | 50 | chest condition | 36.2 |
| solar-panel | 10 | 0 | 10 | 30 | chest condition | 3.3 |
| accumulator | 1 | 0 | 1 | 10 | chest condition | 4.9 |
| constant-combinator | 1 | 0 | 1 | 10 | chest condition | 2.3 |
| arithmetic-combinator | 1 | 0 | 1 | 10 | chest condition | 2.1 |
| decider-combinator | 4 | 0 | 4 | 10 | chest condition | 2.3 |
| passive-provider-chest | 1 | 0 | 1 | 10 | chest condition | 4.2 |
| substation | 1 | 0 | 1 | 10 | chest condition | 3.6 |

## Entrances (west side, one labelled entrance each)

Panel figure = the supply the kit was qualified at (the qualifying run feeds exactly this, throttled). `perKit` is the recipe demand of one whole kit computed from the dump.

| Entrance (north to south) | kind | panel /min | per kit | accepted to kit completion | ratio | average draw /min | peak minute |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| concrete | belt | 25 | 1200 | 1232 | 1.027 | 18.5 | 25 |
| plastic-bar | belt | 35 | 1722 | 1894 | 1.1 | 28.5 | 41 |
| iron-plate | belt | 26 | 1391 | 1534 | 1.103 | 23.1 | 26 |
| stone-brick | belt | 1 | 10 | 30 (consumed 10) | 3 | 0.5 | 1 |
| sulfuric-acid | pipe | 23 | 1350 | 1528.7 | 1.132 | 23 | 23 |
| lubricant | pipe | 64 | 3930 | 4253.9 | 1.082 | 64 | 64 |
| copper-plate | belt | 130 | 6405 | 6879 | 1.074 | 103.5 | 132 |
| steel-plate | belt | 135 | 6723 | 7094 | 1.055 | 106.7 | 135 |
| electronic-circuit | belt | 140 | 6822 | 7338 | 1.076 | 110.4 | 140 |

Suppliers (contract section 13): 1 `concrete-supplier` copy for concrete (entrance row 0 from the top, 25/min planned); 1 `green-circuits` copy for electronic-circuit (entrance row 25 from the top, 140/min planned). Concrete is the northernmost entrance and electronic circuits the southernmost, with no other entrance in the five rows north of it. One green-circuits copy (360/min) covers this kit and rocket supplies together.

## How it works

- **Lane belts** (no control, they back up): row 20 carries steel (north lane) and electronic circuits (south lane) to the foundation, the processing-unit and the two advanced-circuit machines; row 19 carries copper to the low-density and cable machines.
- **One ring** of 114 red belt tiles (capacity 912), every tile a per-tile hold reader on one red network. Every arm that puts an item on the ring runs only while that item is below its ring limit (sum of limits 214, 23% of capacity). It carries the small flows (iron, ring shares of steel, copper and circuits, plastic, concrete, brick), the intermediates (gears, pipes, engines, cable, advanced circuits, processing units, electric engines, low density structures, foundation) and the travelling finals to their chests. Pipe and gear makers take iron only above a ring reserve (pipe 2, gear 10), so the electric-engine chain starts at once.
- **Caps**: one constant combinator carries every cap as a negative number on the green cap network that every chest also writes to. Chest arms (hand 1) run while their item is below 0. Ordinary finals load ingredients only while (chest - cap) plus their own ring stock is below 0.
- **Exact latches** for rocket-silo, cargo-landing-pad, space-platform-starter-pack, asteroid-collector, crusher: each stands next to its own chest (machine, arm, chest); the machine reads its contents including the craft in progress; each ingredient arm runs while that ingredient is below one craft; a decider writes 100000 on every ingredient once the product (chest - cap + machine + output hand) reaches 0. They complete exactly cap crafts.
- **Silo reserves**: the silo is first on the ring for processing units and electric engines, so two deciders shut its PU and EE arms while the ring holds no more than a small reserve; the collector, crusher, pad and starter pack still find what they need.
- **Foundation**: the foundation machine crafts while its chest is short or the starter-pack machine lacks its 60 foundation (decider F); the foundation chest arm runs only once the starter pack holds its 60 (decider C), so the starter pack is not starved.
- **AM1**: the AM1 machine runs only while the AM2 deficit exceeds the AM1s already made (an arithmetic combinator turns the AM1 count of both machines into the AM2 signal), so it does not over-make AM1.
- Direct hand-offs: AM1 to AM2, inserter to fast inserter, steel chest to provider chest, battery to accumulator, cable to foundation and to the first advanced-circuit machine, both advanced-circuit machines to the processing-unit machine.
- Fluids: lubricant to the electric-engine machine, sulfuric acid to the processing-unit machine and the battery plant, under the belts with pipe-to-ground.

## Measured (full protocol)

- Kit complete from empty in **66.5 minutes** at the panel supply (limit 90); last chest: rocket-silo.
- Rocket silo, cargo landing pad and starter pack each crafted exactly once by the blueprint's own machines (products finished and production statistics). Exact finals completed exactly their caps: rocket-silo 1, cargo-landing-pad 1, space-platform-starter-pack 1, asteroid-collector 4, crusher 3.
- Hold 15 min and long hold 30 min: every chest at its cap at every one-second sample (0 mismatches); no final machine crafted in the last 10 / 20 minutes; finished items outside their chest at most {"space-platform-foundation":3,"solar-panel":1} (slack allowed: ring limit + 2).
- Selective refill (removed 50 space-platform-foundation, 5 solar-panel, 12 fast-inserter, 1 cargo-landing-pad, 1 asteroid-collector): all five back at their caps in 10.8 minutes; no other chest moved, no other final machine crafted, the pad machine crafted exactly one more.
- Ring peak stock 192 of 912 (limit 90%: 820).
- Idle stock once the kit is complete (ring): 8 pipe, 4 stone-brick, 16 concrete, 1 solar-panel, 20 iron-plate, 8 copper-plate, 24 steel-plate, 28 plastic-bar, 8 iron-gear-wheel, 24 copper-cable, 16 electronic-circuit, 6 advanced-circuit, 6 processing-unit, 6 electric-engine-unit, 6 low-density-structure, 3 space-platform-foundation.

## Protocol

Private headless Factorio 2.1.24 (Space Age) from `scripts/launch-kit/validate.mjs` with `control.lua`: import the string, revive, check geometry, recipes, wiring, one power network and clear approaches; feed only the declared entrances, each throttled to its panel figure (belt credit capped at 8; fluids per tick with a one-second carry); seed nothing. Fill from empty (limit 90 min), hold 15 min, selective refill (limit 30 min), long hold 30 min. Pass formula: launch-kit.md section 8.

Reproduce: `FACTORIO_RAW=<dump> node scripts/launch-kit/generate.mjs` then `node scripts/launch-kit/validate.mjs` (about 25 s wall time). Exploration: `LAUNCH_KIT_EXPLORE=1 LAUNCH_KIT_PHASES=kit,hold,refill,longhold LAUNCH_KIT_SOURCE=<dir> node scripts/launch-kit/validate.mjs`.

## Deviation from the spec (stated, not hidden)

`measuredPerKit <= 1.15 x perKit` cannot hold for stone brick: one kit needs 10 bricks, but the entrance belt alone holds 16 and the ring limit 4, so any supply fills them (measured: 30 accepted, 10 consumed). For an entrance whose 15% margin is smaller than its own static storage (dead-end entrance belt at 8 items per tile plus its ring limit) the rule is applied to what was consumed (accepted minus what still sits on belts, the ring, machine inputs and hands at kit completion). Only stone brick qualifies for this; every other entrance meets the rule on accepted items.

## Preserve

The red ring wires and per-tile hold readers, the green cap wires, the five latch deciders with their red wires, the two silo reserve deciders, the foundation deciders F and C, the AM1 arithmetic combinator, all arm filters and conditions. Change counts only in `bill.json` (any cap from 0 to `max` uses the same entities).

## Bill of materials

1 arithmetic-combinator, 28 assembling-machine-2, 1 chemical-plant, 1 constant-combinator, 9 decider-combinator, 9 display-panel, 94 fast-inserter, 164 fast-transport-belt, 4 fast-underground-belt, 5 long-handed-inserter, 16 passive-provider-chest, 15 pipe, 10 pipe-to-ground, 5 substation.

## How it links to the other blueprints

- `concrete-supplier` feeds the concrete entrance; one `green-circuits` copy feeds the circuit entrance.
- The chests hold the `white-platform` request (foundation, collectors, crushers, assembling machines, furnace, fast inserters, solar panels, accumulator, combinators) and the `white-pack-receiver` items (cargo landing pad, fast inserter, provider chest, substation), plus the rocket silo and the starter pack. `rocket-supplies` makes the rocket parts.

## Tried and rejected

Kept under `history/` (string, manifest, exploration report, NOTE.md):

- `silo-first-on-the-ring`: one AC machine, the silo took every PU and EE first; collectors and crushers finished last, kit 92.5 min, fluid and iron draws above 1.15x.
- `four-way-priority`: silo held until the other four exact finals were done; PU and EE production stalled behind it, silo incomplete at 100 min.
- `one-advanced-circuit-machine`: all hold and refill checks passed, but one AC machine set the kit at 78.2 min and acid and lubricant draws at 1.22 and 1.23x.
- `gear-before-pipe`: two AC machines, but the gear maker took the early iron and the electric-engine chain started at minute 12; kit 72.5 min, acid 1.29x.
