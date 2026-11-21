# Space launch kit · silo, pad, starter pack and platform parts

Status: **qualified** (full native protocol, report `native-report.json`, blueprint SHA-256 `a54b80568899d01f7a1f7d436ad3a64ee3d07e1c68ca88fd203eb715d2ed0b63`).

One ground blueprint that builds, once, everything needed to set up white science from orbit, and then stops: the rocket silo, the cargo landing pad, the space platform starter pack and every item the `white-platform` and `white-pack-receiver` blueprints need. Each item sits in its own passive provider chest on the east side, capped at its count. When every chest is at its count nothing crafts any more; take items out and exactly those are made again.

## Size and machines

Footprint 32 x 27 = **864 tiles** (goal 900, stretch 780, fallback 1250). The goal is met.

29 machines: 1 accumulator, 2 advanced-circuit, 1 arithmetic-combinator, 1 assembling-machine-1, 1 assembling-machine-2, 1 asteroid-collector, 1 battery, 1 cargo-landing-pad, 1 constant-combinator, 1 copper-cable, 1 crusher, 1 decider-combinator, 1 electric-engine-unit, 1 electric-furnace, 1 engine-unit, 1 fast-inserter, 1 inserter, 1 iron-gear-wheel, 1 low-density-structure, 1 passive-provider-chest, 1 pipe, 1 processing-unit, 1 rocket-silo, 1 solar-panel, 1 space-platform-foundation, 1 space-platform-starter-pack, 1 steel-chest, 1 substation (all assembling machine 2, except the battery chemical plant). No modules, beacons, AM3, foundry or electromagnetic plant.

## Kit contents (outputs, east side)

Counts live only in `scripts/launch-kit/bill.json` (`cap = count + spare`, spare: 10% rounded up on fast inserters and foundation). Bill sources: white-platform `f4cc0325a68ecf1add4e58c71483098c77f48cee7a2f6553783165d5ac1b37d0`, white-pack-receiver `00456afec81e22b0e1201e6780fe04c27634a2f77dbbd723d2448e86a17e87ae`.

| Item | count | to the platform | to the receiver | spare | cap (chest) | max cap | control | completed at (min) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| rocket-silo | 1 |  |  | 0 | 1 | 1 | exact latch | 68.8 |
| cargo-landing-pad | 1 |  | 1 | 0 | 1 | 1 | exact latch | 53.1 |
| space-platform-starter-pack | 1 |  |  | 0 | 1 | 1 | exact latch | 28.8 |
| space-platform-foundation | 137 | 137 |  | 14 | 151 | 330 | chest condition | 66.3 |
| asteroid-collector | 4 | 4 |  | 0 | 4 | 8 | exact latch | 52.9 |
| crusher | 1 | 1 |  | 0 | 1 | 6 | exact latch | 19.8 |
| assembling-machine-2 | 4 | 4 |  | 0 | 4 | 10 | chest condition | 24.2 |
| electric-furnace | 1 | 1 |  | 0 | 1 | 4 | chest condition | 20.8 |
| fast-inserter | 17 | 16 | 1 | 2 | 19 | 50 | chest condition | 34.9 |
| solar-panel | 6 | 6 |  | 0 | 6 | 30 | chest condition | 1.9 |
| accumulator | 4 | 4 |  | 0 | 4 | 10 | chest condition | 13.8 |
| constant-combinator | 1 | 1 |  | 0 | 1 | 10 | chest condition | 2.6 |
| arithmetic-combinator | 1 | 1 |  | 0 | 1 | 10 | chest condition | 2.6 |
| decider-combinator | 5 | 5 |  | 0 | 5 | 10 | chest condition | 2.8 |
| passive-provider-chest | 1 |  | 1 | 0 | 1 | 10 | chest condition | 16.3 |
| substation | 1 |  | 1 | 0 | 1 | 10 | chest condition | 11.9 |

The rocket silo and the starter pack are for the launch itself. The platform share is the `white-platform` request: every item of that blueprint except the 110 foundation the starter pack provides (100 placed tiles and 10 in the hub).

## Rockets to lift the platform part

The starter pack (1,000 kg) flies alone in 1 rocket. The platform request then weighs **4,000 kg**: 137 space-platform-foundation x 20 kg, 4 asteroid-collector x 100 kg, 1 crusher x 100 kg, 4 assembling-machine-2 x 20 kg, 1 electric-furnace x 20 kg, 16 fast-inserter x 20 kg, 6 solar-panel x 20 kg, 4 accumulator x 20 kg, 1 constant-combinator x 20 kg, 1 arithmetic-combinator x 20 kg, 5 decider-combinator x 20 kg. At 1,000 kg a rocket that is 4 cargo rockets, each exactly full. **5 launches in all.** Only the platform shares fly: the silo, the pad and the receiver items stay on the ground, and the spares stay in the chests. The weights are the game's own (the qualifying run checks each against the prototype). The `rocket-supplies` blueprint makes the rocket parts.

## Entrances (west side, one labelled entrance each)

Panel figure = the supply the kit was qualified at (the qualifying run feeds exactly this, throttled). `perKit` is the recipe demand of one whole kit computed from the dump. The figures are computed from the bill by one rule, not tuned by hand: `perMinute = roundUp(headroom x perKit / designMinutes)`, where `designMinutes` (55.56 for this bill) is the longest machine chain of the bill (here processing-unit: crafts x craft time / speed / machines), headroom 1.05 on belts and 1.25 on the two fluids, at least 0.5/min, whole numbers at 10 and above. A single minute can exceed the panel figure by up to 8 items because the throttled feed carries up to 8 items of credit; the average over the fill stays at or below it.

| Entrance (north to south) | kind | panel /min | per kit | accepted to kit completion | ratio | average draw /min | peak minute |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| concrete | belt | 23 | 1200 | 1232 | 1.027 | 17.9 | 23 |
| plastic-bar | belt | 29 | 1522 | 1706 | 1.121 | 24.8 | 29 |
| iron-plate | belt | 25 | 1307 | 1424 | 1.09 | 20.7 | 25 |
| stone-brick | belt | 0.5 | 10 | 30 (consumed 10) | 3 | 0.4 | 1 |
| sulfuric-acid | pipe | 38 | 1650 | 2612.5 (consumed 1720) | 1.583 | 38 | 38 |
| lubricant | pipe | 82 | 3630 | 4765 (consumed 3705) | 1.313 | 69.3 | 82 |
| copper-plate | belt | 99 | 5203 | 5708 | 1.097 | 83 | 99 |
| steel-plate | belt | 110 | 5783 | 6067 | 1.049 | 88.2 | 110 |
| electronic-circuit | belt | 127 | 6712 | 7197 | 1.072 | 104.7 | 129 |

Fluids: the pipes and machine input boxes hold sulfuric-acid 3500, lubricant 2000 units of fluid (every pipe and pipe-to-ground at 100, one 1000-unit input box per machine using the fluid). That is far more than 15% of a kit's demand, so the fluid entrances are judged on what was consumed by kit completion, like stone brick (column "ratio" is accepted / perKit; the consumed ratio is in the manifest).

Unthrottled (exploration run `history/saturated-entrances`, every belt entrance fed as fast as it takes and every pipe at 6000/min, same layout at the planning bill, so per-kit figures differ from this bill): kit complete in 62.3 min; accepted by completion concrete 1232 (1.027x), plastic-bar 1916 (1.113x), iron-plate 1536 (1.104x), stone-brick 40 (4x, consumed 1x), copper-plate 6915 (1.08x), steel-plate 7045 (1.048x), electronic-circuit 7349 (1.077x), sulfuric-acid 3080 (2.281x, consumed 1.096x), lubricant 5065 (1.289x, consumed 1.019x). An unthrottled pipe fills the pipes and boxes first, so plan the fluid supply at the panel figure, not at what an open pipe will take at the start.

Suppliers (contract section 13): 1 `concrete-supplier` copy for concrete (entrance row 0 from the top, 23/min planned); 1 `green-circuits` copy for electronic-circuit (entrance row 25 from the top, 127/min planned). Concrete is the northernmost entrance and electronic circuits the southernmost, with no other entrance in the five rows north of it. One green-circuits copy (360/min) covers this kit and rocket supplies together.

## How it works

- **Lane belts** (no control, they back up): row 20 carries steel (north lane) and electronic circuits (south lane) to the foundation, steel-chest, processing-unit and first advanced-circuit machines (the second takes its circuits from the ring and puts its advanced circuits on the ring for the processing-unit machine); row 19 carries copper to the low-density and cable machines. The steel-chest machine sits in the middle, fed by a long arm from the steel lane, and hands its chest straight to the provider-chest machine.
- **One ring** of 104 red belt tiles (capacity 832), every tile a per-tile hold reader on one red network. Every arm that puts an item on the ring runs only while that item is below its ring limit (sum of limits 195, 23% of capacity). It carries the small flows (iron, ring shares of steel, copper and circuits, plastic, concrete, brick), the intermediates (gears, pipes, engines, cable, advanced circuits, processing units, electric engines, low density structures, foundation) and the travelling finals to their chests. Pipe and gear makers take iron only above a ring reserve (pipe 2, gear 10), so the electric-engine chain starts at once. The iron chain is kept lean because whatever it holds when the kit is complete is iron drawn but not used: ring limits iron 12, gears 4, pipes 4, engines 3, electric engines 4, and the engine and electric-engine machines load ingredients only while their own product is below its ring limit.
- **Caps**: one constant combinator carries every cap as a negative number on the green cap network that every chest also writes to. Chest arms (hand 1) run while their item is below 0. Ordinary finals load ingredients only while (chest - cap) plus their own ring stock is below 0.
- **Exact latches** for rocket-silo, cargo-landing-pad, space-platform-starter-pack, asteroid-collector, crusher: each stands next to its own chest (machine, arm, chest); the machine reads its contents including the craft in progress; each ingredient arm runs while that ingredient is below one craft; a decider writes 100000 on every ingredient once the product (chest - cap + machine + output hand) reaches 0. They complete exactly cap crafts.
- **Silo reserves**: the silo is first on the ring for processing units and electric engines, so two deciders shut its PU and EE arms while the ring holds no more than a small reserve; the collector, crusher, pad and starter pack still find what they need.
- **Foundation**: the foundation machine crafts while its chest is short or the starter-pack machine lacks its 60 foundation (decider F); the foundation chest arm runs only once the starter pack holds its 60 (decider C), so the starter pack is not starved.
- **AM1**: the AM1 machine takes gears and circuits only while the AM2 deficit exceeds the AM1s already made (an arithmetic combinator turns the AM1 count of both machines into the AM2 signal), so it does not over-make AM1. Its iron comes by a separate arm, one craft at a time (iron < 9 on the machine's own red network), so it never sits on three crafts of iron while it waits for gears.
- Direct hand-offs: AM1 to AM2, steel chest to provider chest, battery to accumulator, cable to foundation and to the first advanced-circuit machine, the first advanced-circuit machine to the processing-unit machine. Gears, pipes and engines reach the engine and electric-engine machines, and inserters the fast-inserter machine, over the ring.
- Fluids: lubricant to the electric-engine machine, sulfuric acid to the processing-unit machine and the battery plant, under the belts with pipe-to-ground.

## Measured (full protocol)

- Kit complete from empty in **68.8 minutes** at the panel supply (limit 90); last chest: rocket-silo.
- Rocket silo, cargo landing pad and starter pack each crafted exactly once by the blueprint's own machines (products finished and production statistics). Exact finals completed exactly their caps: rocket-silo 1, cargo-landing-pad 1, space-platform-starter-pack 1, asteroid-collector 4, crusher 1.
- Hold 15 min and long hold 30 min: every chest at its cap at every one-second sample (0 mismatches); no final machine crafted in the last 10 / 20 minutes; finished items outside their chest at most {"space-platform-foundation":3,"solar-panel":1,"decider-combinator":2} (slack allowed: ring limit + 2).
- Selective refill (removed 50 space-platform-foundation, 3 solar-panel, 9 fast-inserter, 1 cargo-landing-pad, 1 asteroid-collector): all five back at their caps in 10.8 minutes; no other chest moved, no other final machine crafted, the pad machine crafted exactly one more.
- Ring peak stock 174 of 832 (limit 90%: 748).
- Idle stock once the kit is complete (ring): 4 pipe, 2 decider-combinator, 4 stone-brick, 16 concrete, 2 solar-panel, 12 iron-plate, 8 copper-plate, 24 steel-plate, 28 plastic-bar, 4 iron-gear-wheel, 24 copper-cable, 16 electronic-circuit, 6 advanced-circuit, 5 processing-unit, 3 engine-unit, 4 electric-engine-unit, 6 low-density-structure, 3 space-platform-foundation.

## Protocol

Private headless Factorio 2.1.24 (Space Age) from `scripts/launch-kit/validate.mjs` with `control.lua`: import the string, revive, check geometry, recipes, wiring, one power network and clear approaches; feed only the declared entrances, each throttled to its panel figure (belt credit capped at 8; fluids per tick with a one-second carry); seed nothing. Fill from empty (limit 90 min), hold 15 min, selective refill (limit 30 min), long hold 30 min. Pass formula: launch-kit.md section 8.

Reproduce: `FACTORIO_RAW=<dump> node scripts/launch-kit/generate.mjs` then `node scripts/launch-kit/validate.mjs` (about 25 s wall time). Exploration: `LAUNCH_KIT_EXPLORE=1 LAUNCH_KIT_PHASES=kit,hold,refill,longhold LAUNCH_KIT_SOURCE=<dir> node scripts/launch-kit/validate.mjs`.

## Deviation from the spec (stated, not hidden)

`measuredPerKit <= 1.15 x perKit` cannot hold where an entrance's own static storage is larger than 15% of a kit. Stone brick: one kit needs 10 bricks, but the entrance belt alone holds 16 and the ring limit 4, so any supply fills them (measured: 30 accepted, 10 consumed). Sulfuric acid and lubricant: the pipes and machine boxes hold sulfuric-acid 3500, lubricant 2000 units, against 15% margins of 248 and 545. For such an entrance (`staticStorage` on the port) the rule is applied to what was consumed (accepted minus what still sits on belts, the ring, machine inputs, hands, pipes and fluid boxes at kit completion): measured sulfuric-acid 1720 consumed of 1650, lubricant 3705 consumed of 3630. Every other entrance meets the rule on accepted items. The reviewer confirmed the stone-brick reading and recommended the same for the fluids (review of b638f4a39, must-fix 4); the planner should confirm it in the spec.

## Changing the bill

Counts live only in `scripts/launch-kit/bill.json`. The bill stage is: edit `bill.json`, run `node scripts/launch-kit/generate.mjs` (it rewrites the cap combinator, the panel figures by the supply rule above, the panel texts, `kitLimitMinutes` and the manifest, and asserts every cap is within 0..max), then run the full protocol with `node scripts/launch-kit/validate.mjs`. The unit test reads counts and spares from `bill.json` and the per-kit demands from the manifest's recipe audit (recomputed from the dump when it is readable); only the fixed 16-item list and the max caps are written in the test, and the planning table of launch-kit.md section 2 is asserted only while both `bill.sources` say `planning`.

The bill stage has run once: the planning bill (launch-kit.md section 2) was replaced by the counts of the qualified `white-platform` and `white-pack-receiver` strings named in `bill.sources`, and this string was qualified with the full protocol at that bill.

`history/platform-request-bill` is the earlier exploration run at the same counts (the same string as this one), made before the platform lane had finished: every check passed; kit complete in 68.8 min, refill 10.8 min, ring peak 174.

Cap edge cases: a foundation cap of 0 still makes the 60 foundation the starter pack needs (spec section 10; the harness allows the foundation machine the starter pack's foundation plus its ring slack and no more), and a starter-pack cap of 0 does not stop the foundation chest. An entrance whose per-kit demand is 0 is not required to accept anything. Exploration evidence for the cap range (`history/cap-range-stress`, an older string of the same layout): with six caps at their max and two at 0, every chest reached exactly its cap and the zero-cap machines never crafted.

## Review notes

Fix stage after the review of b638f4a39 (verdict fix). Every must-fix was applied; none is disputed:
1. Counts left the test file: it reads counts and spares from `bill.json`, keeps only the item list and max caps, checks each port's `perKit` against the recipe audit (and against the dump when readable), and asserts the planning table only while both bill sources say `planning`. Measured: changing a count and a source in a scratch copy and regenerating fails only the two stale-report tests.
2. Panel figures follow the bill by the supply rule (no hand-tuned constant); first shown at the platform's counts in `history/platform-request-bill`, now qualified at them.
3. Iron overhead cut: lower iron-chain ring limits, engine and electric-engine machines gated on their ring stock, and the AM1 machine's iron one craft at a time. Iron draw at this bill 1.09x (the previous string took 1.154x at these counts and 1.124x at the planning bill).
4. Fluids declare `staticStorage` and are judged on consumed amounts, their panel figures carry 25% headroom, and the README states the pipe volume and the unthrottled draw.

Size ideas from the review, tried in order on paper against the layout map; neither reached a buildable candidate, so no native run was made and the size stays 32 x 27:
- One row less (32 x 26): removing row 11 frees the east column, but the west side is also 27 rows with no slack: the west column holds four machines on rows 5 to 17 with the battery hand-off on row 8, row 18 carries the copper underground, rows 19 and 20 the lanes and rows 21 to 26 the bottom band. One of the four west machines would have to leave the column, and the only ring-adjacent cells left are taken (top row, inner east column, the dent under the small-chest column). With the silo also needing circuit-set filters on shared arms, this is a new layout, not a fix.
- West margin of two columns (31 x 27): with the ring on column 2, every ring crossing puts its underground exit on the arm column inside the ring, where the copper, steel and circuit admission arms (which need a pickup tile directly east and the ring directly west), the steel and circuit side-load head and the low-density machine's two copper long arms all compete for the same three cells on rows 17 to 21. The best arrangement found leaves the low-density machine one copper arm and still no cell for the copper admission arm.

## First launch (a save that has never created a space platform)

The asteroid-collector and crusher recipes are unlocked only by creating the first space platform (trigger technology `space-platform`), so the full-protocol figures above (every recipe enabled) apply to a save where a platform already exists. Exploration runs of this exact string with those recipes disabled (`history/first-launch-order`, same harness): locked throughout, 14 of 16 chests reach their caps (starter pack at 28.8 min, rocket silo last at 65.5 min) and the collector and crusher machines wait with `recipe_not_researched`; unlocked at minute 75, the crusher is done at 75.2 min and the fourth collector at 92.9 min, and every hold and refill check passes. So on a first launch, place the silo and create the platform as soon as the silo and starter pack are in their chests; the kit then finishes by itself and the last cargo rocket waits for the collectors and crusher.

## Preserve

The red ring wires and per-tile hold readers, the green cap wires, the five latch deciders with their red wires, the two silo reserve deciders, the foundation deciders F and C, the AM1 arithmetic combinator and the AM1 iron arm's red wire, the ring conditions on the engine and electric-engine input arms, all arm filters and conditions. Change counts only in `bill.json` (any cap from 0 to `max` uses the same entities).

## Bill of materials

1 arithmetic-combinator, 28 assembling-machine-2, 1 chemical-plant, 1 constant-combinator, 9 decider-combinator, 9 display-panel, 94 fast-inserter, 150 fast-transport-belt, 4 fast-underground-belt, 6 long-handed-inserter, 16 passive-provider-chest, 15 pipe, 10 pipe-to-ground, 6 substation.

## How it links to the other blueprints

- `concrete-supplier` feeds the concrete entrance; one `green-circuits` copy feeds the circuit entrance.
- The chests hold the `white-platform` request (137 space-platform-foundation, 4 asteroid-collector, 1 crusher, 4 assembling-machine-2, 1 electric-furnace, 16 fast-inserter, 6 solar-panel, 4 accumulator, 1 constant-combinator, 1 arithmetic-combinator, 5 decider-combinator) and the `white-pack-receiver` items (1 cargo-landing-pad, 1 fast-inserter, 1 passive-provider-chest, 1 substation), plus the rocket silo, the starter pack and the spares. `rocket-supplies` makes the rocket parts.

## Tried and rejected

Kept under `history/` (string, manifest, report, NOTE.md):

- `hand-tuned-panel-figures`: qualified, the same 32 x 27 layout with hand-tuned panel figures (fluids held at the consumption rate) and a looser iron chain; kit in 68.3 min at the planning bill, but at the platform's counts 82.0 min with iron 1.154x and lubricant 1.342x. Replaced by the supply rule and the lean iron chain.
- `saturated-entrances`: exploration evidence for the same layout at the planning bill (a different string, since the caps differ), quoted above. `platform-request-bill`: the exploration run of this exact string before the bill stage.
- `compact-33`: qualified, 33 x 27 = 891 tiles, kit in 68.3 min (full-protocol report). Replaced by this layout, which sends inserters to the fast-inserter machine and the second advanced-circuit machine's output over the ring.
- `wide-first-pass`: the first qualified pass, 37 x 27 = 999 tiles, kit in 66.5 min (full-protocol report). Replaced by the 33 x 27 compact layout, which uses the empty middle for the steel-chest machine and packs the east column around a corner substation.
- `silo-first-on-the-ring`: one AC machine, the silo took every PU and EE first; collectors and crushers finished last, kit 92.5 min, fluid and iron draws above 1.15x.
- `four-way-priority`: silo held until the other four exact finals were done; PU and EE production stalled behind it, silo incomplete at 100 min.
- `one-advanced-circuit-machine`: all hold and refill checks passed, but one AC machine set the kit at 78.2 min and acid and lubricant draws at 1.22 and 1.23x.
- `gear-before-pipe`: two AC machines, but the gear maker took the early iron and the electric-engine chain started at minute 12; kit 72.5 min, acid 1.29x.
- Counting the iron already in the AM1 machine as AM1s on the way (iron / 9 into the AM2 signal) deadlocked: the arm loaded three crafts of iron before any gears and then stopped for good, so the AM2 chest stayed at 1 (exploration, not kept). The separate one-craft iron arm replaced it.
