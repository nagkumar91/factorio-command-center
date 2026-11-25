# Foundry mall · lava and calcite in, six groups of products out, in list order

Status: **qualified** (full native protocol, `native-report.json`). Blueprint SHA-256 `ac47881a85bbdb33d2dd0c05a6b099749d261a2a9e4feae351da598c8a4c0f81`. Factorio 2.1.25 Space Age, Vulcanus, vanilla, normal quality, no modules, no beacons.

One blueprint for Vulcanus. Foundries turn lava and calcite into molten iron and molten copper and cast plates, steel, gears, pipes, sticks, cable, low density structures and concrete; assembling machines 3 make the rest. Everything is kept at a cap in five passive provider chests on the south edge, and made **in the order of the list**: a group lower on the list waits while a group above it has something it can make.

Rocket parts (the 50 processing units, 50 low density structures and 50 rocket fuel per launch) are **not** part of this blueprint.

## What it makes

| Priority | Group | Product | Cap | Chest |
| ---: | --- | --- | ---: | --- |
| 1 | assembling machine 3 | assembling-machine-3 | 50 | OUT-1 |
| 2 | white-pack platform kit | rocket-silo | 1 | OUT-2 |
| 2 | white-pack platform kit | cargo-landing-pad | 1 | OUT-2 |
| 2 | white-pack platform kit | space-platform-starter-pack | 1 | OUT-2 |
| 2 | white-pack platform kit | space-platform-foundation | 151 | OUT-2 |
| 2 | white-pack platform kit | asteroid-collector | 4 | OUT-2 |
| 2 | white-pack platform kit | crusher | 1 | OUT-2 |
| 2 | white-pack platform kit | assembling-machine-2 | 4 | OUT-2 |
| 2 | white-pack platform kit | electric-furnace | 1 | OUT-2 |
| 2 | white-pack platform kit | solar-panel | 6 | OUT-2 |
| 2 | white-pack platform kit | accumulator | 4 | OUT-2 |
| 2 | white-pack platform kit | constant-combinator | 1 | OUT-2 |
| 2 | white-pack platform kit | arithmetic-combinator | 1 | OUT-2 |
| 2 | white-pack platform kit | decider-combinator | 5 | OUT-2 |
| 2 | white-pack platform kit | passive-provider-chest | 1 | OUT-2 |
| 2 | white-pack platform kit | substation | 1 | OUT-2 |
| 3 | express belts | express-transport-belt | 100 | OUT-3 |
| 3 | express belts | express-underground-belt | 50 | OUT-3 |
| 3 | express belts | express-splitter | 50 | OUT-3 |
| 4 | inserters | fast-inserter | 50 (the first 19 at the kit's priority) | OUT-4 |
| 4 | inserters | bulk-inserter | 50 | OUT-4 |
| 5 | electric mining drill | electric-mining-drill | 50 | OUT-5 |
| 6 | foundry | foundry | 20 | OUT-5 |

The kit is exactly the bill in `scripts/launch-kit/bill.json` (count + spare). Fast inserters are one stock with two priorities: the kit's 19 are made at the kit's priority, the rest of the stack at the inserter group's. They sit in the inserter chest (OUT-4), not in the kit chest.

## Entrances, exit, power

Tiles are counted from the blueprint's top-left tile (column, row).

| Port | What | Kind | Tile | Side | For one full fill (recipes) | Used in the measured full fill |
| --- | --- | --- | --- | --- | ---: | ---: |
| IN-1 | lava | pipe | (0, 2) | west | 506600 | 955500 |
| IN-2 | calcite | belt | (0, 0) | west | 1013 | 1911 |
| OUT-STONE | stone | belt | (0, 1) | west | 16049 | 28891 |
| IN-3 | water | pipe | (29, 4) | east | 14222 | 17200 |
| IN-4 | lubricant | pipe | (6, 32) | south | 8563 | 9445 |
| IN-5 | sulfuric-acid | pipe | (29, 31) | east | 1650 | 1970 |
| IN-6 | plastic-bar | belt | (19, 32) | south | 4122 | 4826 |
| IN-7 | tungsten-carbide | belt | (23, 32) | south | 667 | 900 |

- **Power**: connect the substation at tile (3, 8) (panel "POWER: connect this substation"). Four substations power everything. Idle draw is small; with all foundries working it reaches about 25 MW.
- **Stone** is a by-product of every lava craft. The bricks the bill needs are made inside (a five-stack brick stock); the rest leaves on the belt of OUT-STONE and must be taken away (run that belt to an inserter over lava). If the exit backs up, the two lava foundries stop and so does everything else. About 93% of the stone is surplus: there is nothing in this bill to spend it on.
- **Water and lubricant** each pass a storage tank the control reads; a fluid counts as present above 500. The tanks take 25,000 each when first connected.
- **Other inputs needed** besides lava and calcite: plastic bar, tungsten carbide (foundries only), sulfuric acid (processing units, batteries), lubricant (electric engines, express belts, foundries), water (concrete, refined concrete). No oil or tungsten chain is inside.

## Output chests and caps

| Chest | Tile | Holds |
| --- | --- | --- |
| OUT-1 | (13, 28) | assembling-machine-3 |
| OUT-2 | (14, 28) | rocket-silo, cargo-landing-pad, space-platform-starter-pack, space-platform-foundation, asteroid-collector, crusher, assembling-machine-2, electric-furnace, solar-panel, accumulator, constant-combinator, arithmetic-combinator, decider-combinator, passive-provider-chest, substation |
| OUT-3 | (20, 28) | express-transport-belt, express-underground-belt, express-splitter |
| OUT-4 | (21, 28) | fast-inserter, bulk-inserter |
| OUT-5 | (22, 28) | electric-mining-drill, foundry |

**Caps** live in one constant combinator at tile (13, 30) (panel "CAPS"), one positive number per product, plus signal K = the kit's share of the fast inserters. Edit a number and the stock follows. Nothing else holds a cap.

## How it works

- **Casting core.** Two foundries make molten copper and molten iron from lava and calcite; pipes carry both to four casting foundries next to the ring. One casts iron plate. One casts steel or low density structures. One casts cable (handed straight to the two circuit machines) or copper plate. One casts gears, pipes, sticks, concrete or steel. The last three take their recipe from the circuit network.
- **One ring** of 98 red belt tiles carries every intermediate and finished item. An arm that adds an item works only while the ring holds fewer than that item's limit; a recipe-switching machine is told to make an item only while the stock in sight is below its limit.
- **Two universal machines.** U1 (assembling machine 3) makes 18 recipes: the small kit items, inserters, drills and refined concrete. U2 (a foundry, lubricant on its fluid box) makes the three belt tiers and the foundry, with the foundry's +50% on each. One decider per recipe ("rule") says when that recipe is wanted and makeable; a selector picks the highest; the machine takes the recipe from the circuit. A never-fed shadow machine reads out the recipe's ingredients so the input arms load exactly one craft. A recipe is changed only on the tick a craft finishes or while the machine is parked.
- **Dedicated machines** for the high-volume chain: 2 electronic circuit, 4 advanced circuit, 2 speed module, processing unit, engine, electric engine, foundation, the assembling machine 1 → 2 → 3 line, the rocket silo (loads exactly one craft), a battery plant and the brick furnace.
- **List order.** Every rule and every dedicated final shows a weight on one network; the highest weight in force sets the level (6 = assembling machine 3 … 1 = foundry). Machines and recipes of a lower level are held while a higher level is in force. The level rises at once and falls only after 120 s without a makeable product at that level.
- **Skip and return.** A rule is true only while its product is short *and* one craft's worth of every scarce ingredient is in sight (ring + the machine), and fluid recipes also need their tank above 500. A product whose outside input is missing therefore drops out of the level by itself, and comes back when the input does. The two dedicated finals use a timer instead: assembling machine 3 gives up its level after 180 s without a craft, the rocket silo after 120 s without a delivery.

### The priority rule, as built and as tested

Built: **strict sequencing by group**, not sharing. While a group has a product below its cap that can be made, no lower group loads anything: the input arms of the lower dedicated machines are switched off and the universal machines are not given lower recipes. Chosen over sharing by reserve because it can be checked exactly and needs no tuning; the cost is that a full fill is the sum of the groups, not the longest of them.
Tested natively, every tick: no level-gated arm may be enabled for more than five ticks while a higher level is in force. Reported per phase: the minutes each level was in force, the time each product reached its cap, and what each machine crafted at which level.
Limits of the rule, stated plainly: (1) a universal machine finishes the one craft it has started before it obeys a higher level; (2) inside the kit the order is the bill's order per machine, and the silo, foundation and the small items run side by side; (3) the casting foundries and the circuit machines are shared and keep the ring at its limits at every level; (4) "makeable" is read from stock in sight, so a group can lose its turn for a while if an intermediate it needs takes longer than 120 s to come round.

## Size and parts

Footprint **32 × 33 = 1056 tiles**, 441 entities.

Machines: 7 foundries, 19 assembling machines 3 (two of them shadows that never craft), 1 chemical plant, 1 electric furnace. Control: 75 decider, 21 arithmetic, 6 selector and 14 constant combinators.

Bill of materials: 21 arithmetic-combinator, 19 assembling-machine-3, 43 bulk-inserter, 1 chemical-plant, 14 constant-combinator, 75 decider-combinator, 15 display-panel, 1 electric-furnace, 34 fast-inserter, 135 fast-transport-belt, 7 foundry, 2 long-handed-inserter, 5 passive-provider-chest, 41 pipe, 14 pipe-to-ground, 1 pump, 6 selector-combinator, 1 steel-chest, 2 storage-tank, 4 substation. Red belts and fast, bulk and long-handed inserters only; hand sizes are pinned (fast 1, bulk 2), so the mall behaves the same whatever inserter capacity is researched.

Research needed (55 technologies in the closure), among them: foundry, automation 3, logistics 3, bulk inserter, rocket silo, space platform (the asteroid collector and crusher recipes), advanced combinators (the selector combinator), electric energy distribution 2.

```
 -16 >>>>>>>>>>>.ddddddddddsaddaa....
 -15 <<<<<<<<<<.!ddddddddddsaddaa....
 -14 =ui!blu=ublu=.dddddddddddddddd..
 -13 KKK.FFFFFFFFFFdddddddddddddddd..
 -12 KKK!FFFFFFFFFFddddddds.=======..
 -11 KKK.FFFFFFFFFFddddddds=TTTdd.!..
 -10 i.!.FFFFFFFFFFddddd.SS=TTTdddd..
  -9 B.SSFFFFFFFFFFddddd.SS=TTTdddd..
  -8 i.SS=u.=u=====u....u=u=..pu=dd..
  -7 v...=..=u=.....u===...u..p.=....
  -6 vFFFFFFFFFFsasaFFFFFas.sFFFFFa..
  -5 vFFFFFFFFFFsasaFFFFFascsFFFFFa..
  -4 vFFFFFFFFFFAAAbFFFFFbAAAFFFFF...
  -3 vFFFFFFFFFFAAAbFFFFFbAAAFFFFF...
  -2 vFFFFFFFFFFAAAcFFFFF.AAAFFFFF...
  -1 i.b.b.b.b.ibcb.b.b.b.b.bb.b.i...
   0 >>>>>>>>>>>>>>>>>>>>>>>>>>>>>v..
   1 ^bbibbibbibbii.ii.ib..cbbbaa.v>v
   2 ^AAAAAAAAAAAAAAAAAAAAAuAAAAAAv^v
   3 ^AAAAAAAAAAAAAAAAAAAAA=AAAAAAv^v
   4 ^AAAAAAAAAAAAAAAAAAAAA.AAAAAAv^v
   5 ^dddddddd.cdddddd...i.ddddaa.v^v
   6 ^.AAAAAAdddAAAAAAdddAAAddddadv^v
   7 ^.AAAAAASSdAAAAAAdddAAASSddadv^v
   8 ^.AAAAAASScAAAAAA...AAASScdd.v^v
   9 ^.bbii.iaa.i.iaaaaaabciaaaaaa>^v
  10 ^<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  11 i.i.....bbbbbii.bbbiiiiib.ii.i..
  12 AAA.ddddFFFFFPPiAAA^PPP^AAACCC..
  13 AAA=TTT=FFFFF!!cAAA^!!!^AAACCC..
  14 AAAdTTT=FFFFFcc!AAA^ccc^AAACCC..
  15 aa.dTTT=FFFFFaaddd.^ddd^.=====..
  16 aa...!=.FFFFFaaddd!^ddd^!dd..!..
```

F foundry · A assembling machine 3 · C chemical plant · K furnace · T tank · p pump · S substation · P provider chest · B brick chest · > < ^ v belt · = pipe · u underground pipe · i fast · b bulk · l long-handed inserter · d a s c combinators · ! panel

## Measured natively

Every figure below is from `native-report.json` (12 scenarios, each its own headless game on a Vulcanus surface from a fresh import of this string). **Full caps**: the fill from empty and the rate scenario. **Reduced caps** (a tenth of each cap, at least 2; the silo, pad and starter pack stay at 1): refill, outage and recovery, hold, cap edits, single refills and the seven withheld-input scenarios. A reduced-cap time is not a full-stack time.

### Fill from empty at the published caps: 333.9 minutes

| Product | Group | Cap | At its cap after (min) |
| --- | ---: | ---: | ---: |
| assembling-machine-3 | 1 | 50 | 50.3 |
| assembling-machine-2 | 2 | 4 | 52.7 |
| electric-furnace | 2 | 1 | 60.1 |
| solar-panel | 2 | 6 | 62.4 |
| constant-combinator | 2 | 1 | 63.7 |
| accumulator | 2 | 4 | 64.2 |
| arithmetic-combinator | 2 | 1 | 64.3 |
| decider-combinator | 2 | 5 | 64.6 |
| passive-provider-chest | 2 | 1 | 65.1 |
| substation | 2 | 1 | 65.3 |
| crusher | 2 | 1 | 102.8 |
| rocket-silo | 2 | 1 | 108.4 |
| asteroid-collector | 2 | 4 | 112.8 |
| cargo-landing-pad | 2 | 1 | 119.0 |
| space-platform-starter-pack | 2 | 1 | 141.1 |
| space-platform-foundation | 2 | 151 | 151.3 |
| express-transport-belt | 3 | 100 | 177.6 |
| express-underground-belt | 3 | 50 | 209.2 |
| express-splitter | 3 | 50 | 236.7 |
| fast-inserter | 4 | 50 | 246.3 |
| bulk-inserter | 4 | 50 | 293.5 |
| electric-mining-drill | 5 | 50 | 308.2 |
| foundry | 6 | 20 | 333.8 |

Minutes each level was in force: assembling machine 3 52.3, white-pack platform kit 100.6, express belts 85.2, inserters 57.2, electric mining drill 14.7, foundry 23.9. Level-gated arms enabled against the level: 0 ticks.
Used: lava 955500, calcite 1911, plastic-bar 4826, tungsten-carbide 900, sulfuric-acid 1970, lubricant 9445, water 17200; molten iron 573250, molten copper 143250; stone made 31525, used 2632, left by the exit 28891.
Left on the ring when the last chest filled (finished products not in a chest): 2 express-underground-belt, 5 fast-inserter, 4 assembling-machine-2, 2 assembling-machine-3, 8 space-platform-foundation.

### Rates (full caps)

After a full fill, one group at a time has its products taken out of its chest every second (15 minutes warm-up, 30 measured) while the groups above it stay full. The first row empties every chest at once: with strict list order that only ever shows group 1.

| Measured window | Products per minute | lava | calcite | plastic-bar | tungsten-carbide | sulfuric-acid | lubricant | water | stone out |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| every chest emptied | assembling machine 3 1 | 2233.3 | 4.5 | 39.4 | 0 | 0 | 0 | 0 | 79.7 |
| group 2 (white-pack platform kit) | assembling machine 2 3.6, electric furnace 0.67, solar panel 1.5, platform foundation 1.1 | 7116.7 | 14.2 | 19.1 | 0 | 15.8 | 63 | 196.7 | 202.4 |
| group 3 (express belts) | express transport belt 5 | 800 | 1.6 | 0 | 0 | 0 | 68 | 0 | 23.7 |
| group 4 (inserters) | fast inserter 3.17 | 350 | 0.7 | 0 | 0 | 0 | 0 | 0 | 11 |
| group 5 (electric mining drill) | electric mining drill 3.73 | 850 | 1.7 | 0 | 0 | 0 | 0 | 0 | 26.8 |
| group 6 (foundry) | foundry 0.87 | 3350 | 6.7 | 0 | 38.3 | 0 | 15.3 | 370 | 82 |

Inputs are what the machines consumed per minute in the window (production statistics): the draw each entrance has to meet.

### Refilling one collected product (reduced caps)

| Product | Taken | Back at cap after (min) | lava | calcite | plastic | carbide | acid | lubricant | water |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| assembling-machine-3 | 5 | 1.1 | 0 | 0 | 30 | 0 | 0 | 0 | 0 |
| express-transport-belt | 10 | 4.7 | 10000 | 20 | 174 | 0 | 0 | 140 | 0 |
| express-underground-belt | 5 | 1.6 | 1500 | 3 | 0 | 0 | 0 | 40 | 0 |
| express-splitter | 5 | 2.1 | 4500 | 9 | 70 | 0 | 0 | 320 | 0 |
| bulk-inserter | 5 | 3.0 | 3000 | 6 | 14 | 0 | 0 | 0 | 0 |
| electric-mining-drill | 5 | 3.6 | 1500 | 3 | 0 | 0 | 0 | 0 | 0 |
| foundry | 2 | 4.4 | 8500 | 17 | 0 | 100 | 0 | 40 | 700 |

Draw is the total consumed during that refill; it includes topping the ring back up.

### Refill, outage, hold, cap edits (reduced caps)

| Scenario | Phase | Minutes | Ended by |
| --- | --- | ---: | --- |
| fill | fill from empty | 333.9 | every cap reached |
| fill | refill after complete collection | 96.9 | every cap reached |
| fill | five-minute outage of every input | 5.0 | fixed length |
| fill | recovery after the outage | 107.0 | every cap reached |
| hold | fill from empty | 135.6 | every cap reached |
| hold | settle at full stock | 10.0 | fixed length |
| hold | one-hour hold at full stock | 60.0 | fixed length |
| hold | refill after collection | 96.1 | every cap reached |
| caps | fill from empty | 135.6 | every cap reached |
| caps | caps raised | 6.5 | every cap reached |
| caps | caps lowered, those products collected | 3.6 | every cap reached |
| caps | caps restored | 8.3 | every cap reached |

Hold: for one hour at full stock no chest changed and the final machines crafted 0 times.

Cap edits (written into the caps combinator by script, as a player would): raised to {"assembling-machine-3":9,"express-transport-belt":16,"space-platform-foundation":25} → every chest at the new caps in 6.5 min; lowered to {"assembling-machine-3":2,"express-transport-belt":5,"space-platform-foundation":8} with those chests emptied → refilled to exactly the lower caps in 3.6 min; restored in 8.3 min.

### Skip and return, one outside input withheld from a cold start (reduced caps)

| Withheld | Products that need it | Everything else at its cap after (min) | After it returned: all at cap after (min) |
| --- | --- | ---: | ---: |
| lava | all | nothing can be made (15.0 min, nothing made) | 136.6 |
| calcite | all | nothing can be made (15.0 min, nothing made) | 146.1 |
| plastic-bar | assembling machine 3, rocket silo, cargo landing pad, platform starter pack, asteroid collector, crusher, electric furnace, passive provider chest, substation, express splitter, bulk inserter | 78.3 | 98.1 |
| tungsten-carbide | foundry | 136.0 | 3.7 |
| sulfuric-acid | rocket silo, cargo landing pad, platform starter pack, asteroid collector, accumulator | 107.9 | 71.8 |
| lubricant | rocket silo, asteroid collector, crusher, express transport belt, express underground belt, express splitter, foundry | 115.8 | 54.0 |
| water | rocket silo, cargo landing pad, foundry | 128.9 | 29.7 |

In the withheld phase the mall must hold every cap that does not need the input for two minutes while the dependent products stay short; then the input returns and every cap must be reached.

### Checks in every scenario

- Import: every entity at its position and direction, every recipe or circuit recipe control, every arm's hand size, filters and conditions, every combinator's parameters, every circuit net as one network with no two nets joined, one electric network.
- Chests: no chest ever held an item it does not declare (held in all).
- Pipes: every pipe, underground pipe and tank carried only its own fluid, sampled every ten seconds (held in all).
- Ring: peak 400 items against a bound of 540 (75% of both lanes); static lane limits inner 334, outer 84 of 360 per lane.
- Level gate: 0 ticks with a gated arm enabled against the level, over all scenarios.

### Switching machines in the full fill

| Machine | Recipe changes | Time per recipe (min) |
| --- | ---: | --- |
| caster-S | 666 | iron-ore-melting 290.9, casting-steel 36.8, casting-low-density-structure 5.8, changing 0.4 |
| caster-D | 1316 | changing 252.3, casting-copper-cable 81.2, casting-copper 0.4 |
| caster-G | 1987 | iron-ore-melting 244.8, casting-steel 27.5, concrete-from-molten-iron 21.7, casting-iron-gear-wheel 19.0, changing 18.7, casting-pipe 1.9, casting-iron-stick 0.3 |
| U1 | 138 | wooden-chest 200.1, bulk-inserter 30.7, refined-concrete 23.2, space-platform-starter-pack 22.1, fast-inserter 18.1, inserter 13.7, electric-mining-drill 12.7, cargo-landing-pad 4.3, solar-panel 2.3, asteroid-collector 2.1, accumulator 1.8, changing 0.8, crusher 0.5, electric-furnace 0.4, passive-provider-chest 0.3, decider-combinator 0.3, steel-chest 0.2, substation 0.1, arithmetic-combinator 0.1, constant-combinator 0.1 |
| U2 | 207 | iron-ore-melting 232.6, express-underground-belt 20.7, foundry 18.1, express-transport-belt 13.1, express-splitter 12.0, fast-underground-belt 8.6, fast-splitter 7.9, splitter 5.6, fast-transport-belt 5.6, transport-belt 4.1, underground-belt 3.8, changing 1.8 |

"iron-ore-melting" and "wooden-chest" are the parking recipes: recipes the machine can never start, held while it has nothing to make.

### Harness speed

Scenarios ran side by side at 558, 558, 562, 566, 566, 567, 569, 571, 574, 577, 580, 580 times real time; 243 s of wall time in all for 57.6 game hours.

## Bill from the recipes (expected values, productivity counted)

| Group | lava | calcite | plastic | carbide | acid | lubricant | water | molten iron | molten copper | stone made | stone used |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 assembling machine 3 | 87111 | 174 | 2000 | 0 | 0 | 0 | 0 | 40667 | 24667 | 3107 | 0 |
| 2 white-pack platform kit | 306591 | 613 | 1355 | 0 | 1650 | 3630 | 8000 | 169160 | 60783 | 10413 | 820 |
| 3 express belts | 48735 | 97 | 667 | 0 | 0 | 4667 | 0 | 29514 | 7037 | 1603 | 0 |
| 4 inserters | 28556 | 57 | 100 | 0 | 0 | 0 | 0 | 15333 | 6083 | 978 | 0 |
| 5 electric mining drill | 9000 | 18 | 0 | 0 | 0 | 0 | 0 | 6000 | 750 | 285 | 0 |
| 6 foundry | 26607 | 53 | 0 | 667 | 0 | 267 | 6222 | 17956 | 2000 | 838 | 356 |
| **one full fill** | 506600 | 1013 | 4122 | 667 | 1650 | 8563 | 14222 | 278630 | 101320 | 17224 | 1176 |

The measured fill uses more than this: the ring, the machines' input buffers and the brick stock are filled as well, and both lava recipes run whenever either metal is short.

## Things to know

- The asteroid collector and crusher recipes exist only once a space platform has been created. On Vulcanus that is always the case.
- A universal machine that has started loading a recipe keeps it until the craft is done; if the input it is waiting for never comes, it gives the recipe up after 15 minutes (U1) or 5 minutes (U2) and hands the loaded items back to the ring.
- Tiny recipes can run one craft over their cap (an arm's second item is a full set). The extra rides the ring, counts as stock and goes into the chest after the next collection.
- Kit items enter the kit chest only while no assembling machine 3 is wanted.
- Collecting from a chest reopens that product's level; lower groups pause until it is full again.
- The brick stock (5 stacks) is filled from surplus stone whenever metal is cast, so concrete can be made later when little stone is flowing.

## Tried and rejected (native exploration, not kept as strings)

- **One recipe signal per machine without a parking recipe**: a machine that reads its own contents takes the item signals of what it still holds as recipe signals once the real signal is gone, and keeps crafting (gears to 150 on the ring).
- **Recipe following the pick at once**: an arm carrying an ingredient when the recipe changes holds it for good; the machine also flipped between two recipes hundreds of times while a product changed hands.
- **Counting what a switching machine has loaded as ring stock** for the casting rules: the caster stopped at the limit while the landing pad still waited for 180 concrete.
- **A 78-tile ring**: the inner lane filled at about 300 items and everything stopped; the ring is folded twice at its east end for 20 more tiles.
- **The water pipe straight into the gear foundry**: when that foundry changes recipe, its leftover molten iron flows out into any connected pipe that will take it; with water not yet connected it filled the water tank with molten iron, and water could never enter. A pump now stands between the tank and the foundry.
- **Casting copper plate in the steel foundry**: with empty pipes the game gave the molten copper the first fluid box, which is plumbed for iron; molten copper ended in the iron pipes.
- **A level that falls at once**: lower groups slipped in during the seconds a kit item waited for processing units.
- **Sharing by reserve instead of strict order**, and **dedicated machines for every recipe** (about 55 machines): not built; estimated only.

Kept exploration reports: `exploration-max-inserter-capacity-report.json`.

## Reproduce

```
node scripts/requested-malls/foundry-mall/generate.mjs      # writes this folder from the pinned prototypes
node scripts/requested-malls/foundry-mall/audit.mjs         # static audit
node scripts/requested-malls/foundry-mall/validate.mjs      # full native protocol (needs the game), about three minutes
```

Static audit: passed, 47 checks. Prototypes pinned from a private `--dump-data` of Factorio 2.1.25 (`scripts/requested-malls/foundry-mall/prototypes.json`).

