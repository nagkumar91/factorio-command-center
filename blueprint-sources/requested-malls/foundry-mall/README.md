# Foundry mall · lava and calcite in, six groups of products out, in list order

Status: **qualified** (full native protocol, `native-report.json`). Blueprint SHA-256 `b9243fa7ff6b0d164538d99c3d96d0315ed15feb018d74e40ab6da068f83134c`. Factorio 2.1.25 Space Age, Vulcanus, vanilla, normal quality, no modules, no beacons.

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
| 2 | white-pack platform kit | fast-inserter (kit) | 19 (signal K) | OUT-2 |
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
| 4 | inserters | fast-inserter | 50 | OUT-4 |
| 4 | inserters | bulk-inserter | 50 | OUT-4 |
| 5 | electric mining drill | electric-mining-drill | 50 | OUT-5 |
| 6 | foundry | foundry | 20 | OUT-5 |

The kit is exactly the bill in `scripts/launch-kit/bill.json` (count + spare). Fast inserters are two separate stocks: the kit's 19 go into the kit chest (OUT-2) at the kit's priority, and a full stack of 50 goes into the inserter chest (OUT-4) at the inserter group's priority, 69 in all. Each chest is counted against its own cap only; the inserter chest takes fast inserters only while the kit chest has all of its own.

## Entrances, exit, power

Tiles are counted from the blueprint's top-left tile (column, row).

| Port | What | Kind | Tile | Side | For one full fill (recipes) | Used in the measured full fill |
| --- | --- | --- | --- | --- | ---: | ---: |
| IN-1 | lava | pipe | (0, 2) | west | 508163 | 949000 |
| IN-2 | calcite | belt | (0, 0) | west | 1016 | 1898 |
| OUT-STONE | stone | belt | (0, 1) | west | 16101 | 28721 |
| IN-3 | water | pipe | (29, 4) | east | 14222 | 16800 |
| IN-4 | lubricant | pipe | (6, 32) | south | 8563 | 9425 |
| IN-5 | sulfuric-acid | pipe | (29, 31) | east | 1650 | 1970 |
| IN-6 | plastic-bar | belt | (19, 32) | south | 4122 | 4824 |
| IN-7 | tungsten-carbide | belt | (23, 32) | south | 667 | 850 |

- **Power**: connect the substation at tile (3, 8) (panel "POWER: connect this substation"). Four substations power everything. Idle draw is small; with all foundries working it reaches about 25 MW.
- **Stone** is a by-product of every lava craft. The bricks the bill needs are made inside (a five-stack brick stock); the rest leaves on the belt of OUT-STONE and must be taken away (run that belt to an inserter over lava). If the exit backs up, the two lava foundries stop and so does everything else; it carries on once the belt moves again (tested for an hour of blockage). About 93% of the stone is surplus: there is nothing in this bill to spend it on.
- **Water and lubricant** each pass a storage tank the control reads; a fluid counts as present above 500. The tanks take 25,000 each when first connected.
- **Other inputs needed** besides lava and calcite: plastic bar, tungsten carbide (foundries only), sulfuric acid (processing units, batteries), lubricant (electric engines, express belts, foundries), water (concrete, refined concrete). No oil or tungsten chain is inside.

## Output chests and caps

| Chest | Tile | Holds |
| --- | --- | --- |
| OUT-1 | (13, 28) | assembling-machine-3 |
| OUT-2 | (14, 28) | rocket-silo, cargo-landing-pad, space-platform-starter-pack, space-platform-foundation, asteroid-collector, crusher, assembling-machine-2, electric-furnace, fast-inserter, solar-panel, accumulator, constant-combinator, arithmetic-combinator, decider-combinator, passive-provider-chest, substation |
| OUT-3 | (20, 28) | express-transport-belt, express-underground-belt, express-splitter |
| OUT-4 | (21, 28) | fast-inserter, bulk-inserter |
| OUT-5 | (22, 28) | electric-mining-drill, foundry |

**Caps** live in one constant combinator at tile (13, 30) (panel "CAPS"), one positive number per product, plus signal K = the fast inserters kept in the kit chest. Edit a number and the stock follows. Nothing else holds a cap.

## How it works

- **Casting core.** Two foundries make molten copper and molten iron from lava and calcite; pipes carry both to four casting foundries next to the ring. One casts iron plate. One casts steel or low density structures. One casts cable (handed straight to the two circuit machines) or copper plate. One casts gears, pipes, sticks, concrete or steel. The last three take their recipe from the circuit network.
- **Fluid ports.** In 2.1.25 a recipe with one fluid ingredient uses both input ports of a foundry as one box, and when that recipe is taken away the game pushes what is left in the box back out through either port, into any pipe that will take it. An empty pipe takes anything. So no machine here has two ports of one kind on the pipes of two fluids. The two foundries that need a second fluid get it through a pump standing directly on that port, and a pump lets nothing back: molten copper for low density structures (pump at tile (7, 9), fed straight from one output port of the copper lava foundry; its other output port feeds the pipes of the cable foundry) and water for concrete (pump at tile (25, 9)).
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

Footprint **32 × 33 = 1056 tiles**, 443 entities.

Machines: 7 foundries, 19 assembling machines 3 (two of them shadows that never craft), 1 chemical plant, 1 electric furnace. Control: 76 decider, 21 arithmetic, 6 selector and 15 constant combinators.

Bill of materials: 21 arithmetic-combinator, 19 assembling-machine-3, 43 bulk-inserter, 1 chemical-plant, 15 constant-combinator, 76 decider-combinator, 15 display-panel, 1 electric-furnace, 34 fast-inserter, 135 fast-transport-belt, 7 foundry, 2 long-handed-inserter, 5 passive-provider-chest, 40 pipe, 14 pipe-to-ground, 2 pump, 6 selector-combinator, 1 steel-chest, 2 storage-tank, 4 substation. Red belts and fast, bulk and long-handed inserters only; hand sizes are pinned (fast 1, bulk 2), so the mall behaves the same whatever inserter capacity is researched.

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
  -8 i.SS.=up.=====.u=.....=..p..dd..
  -7 v...=u.pu=...=u.===u=uu..pu=....
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
   8 ^.AAAAAASScAAAAAAddcAAASScdd.v^v
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

Every figure below is from `native-report.json` (34 scenarios, each its own headless game on a Vulcanus surface from a fresh import of this string). **Full caps**: the fill from empty and the rate scenario. **Reduced caps** (a tenth of each cap, at least 2; the silo, pad and starter pack stay at 1): refill, outage and recovery, hold, cap edits, single refills, the seven withheld-input scenarios and every fluid-safety scenario. A reduced-cap time is not a full-stack time.

### Fill from empty at the published caps: 334.9 minutes

| Product | Group | Cap | At its cap after (min) |
| --- | ---: | ---: | ---: |
| assembling-machine-3 | 1 | 50 | 50.3 |
| assembling-machine-2 | 2 | 4 | 52.7 |
| fast-inserter (kit) | 2 | 19 | 59.5 |
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
| fast-inserter (inserter group) | 4 | 50 | 252.9 |
| bulk-inserter | 4 | 50 | 296.6 |
| electric-mining-drill | 5 | 50 | 310.0 |
| foundry | 6 | 20 | 334.8 |

Minutes each level was in force: assembling machine 3 52.3, white-pack platform kit 100.6, express belts 85.2, inserters 60.3, electric mining drill 13.4, foundry 23.1. Level-gated arms enabled against the level: 0 ticks.
Used: lava 949000, calcite 1898, plastic-bar 4824, tungsten-carbide 850, sulfuric-acid 1970, lubricant 9425, water 16800; molten iron 568500, molten copper 143250; stone made 31335, used 2614, left by the exit 28721.
Left on the ring when the last chest filled (finished products not in a chest): 2 express-underground-belt, 3 fast-inserter, 4 assembling-machine-2, 2 assembling-machine-3, 8 space-platform-foundation.

### Rates (full caps)

After a full fill, one group at a time has its products taken out of its chest every second (15 minutes warm-up, 30 measured) while the groups above it stay full. The first row empties every chest at once: with strict list order that only ever shows group 1.

| Measured window | Products per minute | lava | calcite | plastic-bar | tungsten-carbide | sulfuric-acid | lubricant | water | stone out |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| every chest emptied | assembling machine 3 1 | 2316.7 | 4.6 | 41.3 | 0 | 0 | 0 | 0 | 82.5 |
| group 2 (white-pack platform kit) | assembling machine 2 3.5, fast inserter (kit) 2.37, electric furnace 0.63, platform foundation 1.3 | 6733.3 | 13.5 | 20.1 | 0 | 17.2 | 65.5 | 196.7 | 186.7 |
| group 3 (express belts) | express transport belt 5.43 | 900 | 1.8 | 0 | 0 | 0 | 73.3 | 0 | 26.3 |
| group 4 (inserters) | fast inserter 3.47 | 350 | 0.7 | 0 | 0 | 0 | 0 | 0 | 12.2 |
| group 5 (electric mining drill) | electric mining drill 3.63 | 833.3 | 1.7 | 0 | 0 | 0 | 0 | 0 | 26.8 |
| group 6 (foundry) | foundry 0.9 | 3333.3 | 6.7 | 0 | 36.7 | 0 | 14.7 | 366.7 | 80.2 |

Inputs are what the machines consumed per minute in the window (production statistics): the draw each entrance has to meet.

### Refilling one collected product (reduced caps)

| Product | Taken | Back at cap after (min) | lava | calcite | plastic | carbide | acid | lubricant | water |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| assembling-machine-3 | 5 | 1.0 | 2000 | 4 | 30 | 0 | 0 | 0 | 0 |
| fast-inserter (kit) | 2 | 2.3 | 6500 | 13 | 96 | 0 | 0 | 0 | 0 |
| fast-inserter | 5 | 3.8 | 3000 | 6 | 82 | 0 | 0 | 0 | 0 |
| express-transport-belt | 10 | 2.7 | 1500 | 3 | 0 | 0 | 0 | 160 | 0 |
| express-underground-belt | 5 | 1.8 | 2500 | 5 | 0 | 0 | 0 | 40 | 0 |
| express-splitter | 5 | 3.0 | 3500 | 7 | 78 | 0 | 0 | 320 | 0 |
| bulk-inserter | 5 | 4.5 | 3500 | 7 | 8 | 0 | 0 | 0 | 0 |
| electric-mining-drill | 5 | 3.2 | 1500 | 3 | 0 | 0 | 0 | 0 | 0 |
| foundry | 2 | 4.2 | 9000 | 18 | 0 | 100 | 0 | 40 | 1100 |

Draw is the total consumed during that refill; it includes topping the ring back up.

### Refill, outage, hold, cap edits (reduced caps)

| Scenario | Phase | Minutes | Ended by |
| --- | --- | ---: | --- |
| fill | fill from empty | 334.9 | every cap reached |
| fill | refill after complete collection | 115.2 | every cap reached |
| fill | five-minute outage of every input | 5.0 | fixed length |
| fill | recovery after the outage | 110.6 | every cap reached |
| hold | fill from empty | 134.8 | every cap reached |
| hold | settle at full stock | 10.0 | fixed length |
| hold | one-hour hold at full stock | 60.0 | fixed length |
| hold | refill after collection | 109.4 | every cap reached |
| caps | fill from empty | 134.8 | every cap reached |
| caps | caps raised | 6.9 | every cap reached |
| caps | caps lowered, those products collected | 4.6 | every cap reached |
| caps | caps restored | 3.8 | every cap reached |

Hold: for one hour at full stock no chest changed and the final machines crafted 0 times.

Cap edits (written into the caps combinator by script, as a player would): raised to {"assembling-machine-3":9,"express-transport-belt":16,"space-platform-foundation":25} → every chest at the new caps in 6.9 min; lowered to {"assembling-machine-3":2,"express-transport-belt":5,"space-platform-foundation":8} with those chests emptied → refilled to exactly the lower caps in 4.6 min; restored in 3.8 min.

### Skip and return, one outside input withheld from a cold start (reduced caps)

| Withheld | Products that need it | Everything else at its cap after (min) | After it returned: all at cap after (min) |
| --- | --- | ---: | ---: |
| lava | all | nothing can be made (15.0 min, nothing made) | 139.5 |
| calcite | all | nothing can be made (15.0 min, nothing made) | 137.6 |
| plastic-bar | assembling machine 3, rocket silo, cargo landing pad, platform starter pack, asteroid collector, crusher, electric furnace, passive provider chest, substation, express splitter, bulk inserter | 78.3 | 99.5 |
| tungsten-carbide | foundry | 133.9 | 3.6 |
| sulfuric-acid | rocket silo, cargo landing pad, platform starter pack, asteroid collector, accumulator | 107.9 | 73.1 |
| lubricant | rocket silo, asteroid collector, crusher, express transport belt, express underground belt, express splitter, foundry | 114.4 | 55.6 |
| water | rocket silo, cargo landing pad, foundry | 131.2 | 31.4 |

In the withheld phase the mall must hold every cap that does not need the input for two minutes while the dependent products stay short; then the input returns and every cap must be reached.

### Fluid safety (reduced caps)

These scenarios place and feed the mall the way a player does rather than the way a test does. In all of them, as in every other scenario, every fluid segment and pump is read every tick and every machine fluid box every second.

| Scenario | What is done | Verdict | Foreign fluid | Afterwards |
| --- | --- | --- | --- | --- |
| ports | Port matrix: every recipe change of every recipe-switching foundry, with each network on its ports full or empty | passed | none | 192 recipe changes, 0 put a fluid into another network |
| build:shuffle-1 | Built one entity every 20 ticks in a shuffled order, supply and power already connected (built in 2.5 min) | passed | none | every cap reached 136.5 min after |
| build:shuffle-2 | Same, second shuffle (built in 2.5 min) | passed | none | every cap reached 140.1 min after |
| build:shuffle-3 | Same, third shuffle (built in 2.5 min) | passed | none | every cap reached 133.3 min after |
| build:pipes-first | Built piecemeal, all pipes, tanks and pumps first (built in 2.5 min) | passed | none | every cap reached 135.7 min after |
| build:machines-first | Built piecemeal, machines and substations first (built in 2.5 min) | passed | none | every cap reached 143.1 min after |
| build:combinators-last | Built piecemeal, every combinator last (built in 2.5 min) | passed | none | every cap reached 138.5 min after |
| build:copper-foundry-last | Built piecemeal; the molten copper foundry arrives ten minutes after everything else (built in 12.5 min) | passed | none | every cap reached 139.6 min after |
| build:iron-foundry-last | Built piecemeal; the molten iron foundry arrives ten minutes after everything else (built in 12.5 min) | passed | none | every cap reached 137.5 min after |
| build:robots-25 | Built by 25 of the game's own construction robots from a ghost blueprint (built in 5 min) | passed | none | every cap reached 133.6 min after |
| build:robots-200 | Built by 200 construction robots from a ghost blueprint (built in 0.6 min) | passed | none | every cap reached 137.2 min after |
| late:power | Everything connected, no power for five minutes | passed | none | every cap reached 136.7 min after |
| late:stone-exit | Stone exit not connected for an hour (the stone belt fills), then connected | passed | none | every cap reached 129 min after |
| thin:lava | Lava at 100 a second for an hour (the two lava foundries take 250), then in full | passed | none | every cap reached 137.5 min after |
| thin:calcite | Calcite at 12 a minute for an hour (they take 30), then in full | passed | none | every cap reached 133 min after |
| starve:supply | After a fill: every chest emptied and lava cut for ten minutes; then the same with calcite | passed | none | every cap reached 107.7 min after |
| starve:foundry | After a fill: every chest emptied and the molten copper foundry stopped for fifteen minutes; then the same with the molten iron foundry | passed | none | every cap reached 116.3 min after |
| place:rot90 | Placed turned a quarter clockwise | passed | none | every cap reached 134.9 min after |
| place:rot180 | Placed turned a half | passed | none | every cap reached 134.9 min after |
| place:rot270 | Placed turned three quarters | passed | none | every cap reached 134.9 min after |
| place:flipH | Placed mirrored left to right | passed | none | every cap reached 141.4 min after |
| place:flipV | Placed mirrored top to bottom | passed | none | every cap reached 141.4 min after |

Port matrix: 192 cases. Each one sets a recipe on one recipe-switching foundry through its own red wire (taken off the mall's selector and put on a test combinator for this scenario), fills or empties the networks on its ports, asks for another recipe and reads every segment for two seconds. Fluid put into another network: 0 cases. Fluid box joined to the pipes of two fluids: 0.
Piecemeal construction: the game refused no entity for fluid reasons in any order (it has no such rule: an empty pipe run accepts whichever fluid arrives first). A mirror image is written by the test as its own string (positions and directions mirrored, the mirror flag set on foundries and the chemical plant, the tanks on their other diagonal), because the game has no script call that flips a blueprint; the game's own flip key was not exercised. Turning is done by the game.

### The string published before this one, `7977ee59…`, in the same scenarios

That string had the molten copper pipe directly on the second input port of the steel foundry. Whenever that foundry cast steel, its one molten iron box was joined to the iron trunk on one port and to the copper pipes on the other. When it stopped casting steel with the iron trunk full and the copper pipes empty, the game pushed the molten iron left in the box (up to 330) into the copper pipes. After that the copper lava foundry could not put molten copper into its own pipes, no cable was cast, and the mall stood still for good.
The plain way to get there: **the stone exit not connected**. The stone belt fills, both lava foundries stop with their output full, cable casting empties the copper pipes while the iron trunk stays full, and the next time the steel foundry lets go of its recipe the iron goes in. Measured on that string: molten iron in the copper pipes 3.5 minutes after a cold start (330 units; at that moment the lava foundries were: molten-copper full output, molten-iron full output; the iron trunk held 1700 of 1700), still there 236.5 minutes later, and after the stone exit was connected no product was ever made again.

| Scenario | Verdict | Foreign fluid | Fluid box joined to two fluids | Afterwards |
| --- | --- | --- | --- | --- |
| ports | FAILED | molten-iron in the molten-copper pipes from minute 0.4 for 0.1 min | caster-S on casting-steel: its molten-iron box on a molten-copper pipe (474 s) | 192 recipe changes, 2 put a fluid into another network |
| build:shuffle-1 | FAILED | none | caster-S on casting-steel: its molten-iron box on a molten-copper pipe (1128 s) | every cap reached 136.5 min after |
| build:shuffle-2 | FAILED | none | caster-S on casting-steel: its molten-iron box on a molten-copper pipe (1160 s) | every cap reached 141 min after |
| build:shuffle-3 | FAILED | none | caster-S on casting-steel: its molten-iron box on a molten-copper pipe (1123 s) | every cap reached 133.3 min after |
| build:pipes-first | FAILED | none | caster-S on casting-steel: its molten-iron box on a molten-copper pipe (1133 s) | every cap reached 135.7 min after |
| build:machines-first | FAILED | none | caster-S on casting-steel: its molten-iron box on a molten-copper pipe (1155 s) | every cap reached 143.1 min after |
| build:combinators-last | FAILED | none | caster-S on casting-steel: its molten-iron box on a molten-copper pipe (1129 s) | every cap reached 138.5 min after |
| build:copper-foundry-last | FAILED | none | caster-S on casting-steel: its molten-iron box on a molten-copper pipe (1037 s) | every cap reached 141.3 min after |
| build:iron-foundry-last | FAILED | none | caster-S on casting-steel: its molten-iron box on a molten-copper pipe (1128 s) | every cap reached 143.1 min after |
| build:robots-25 | FAILED | none | caster-S on casting-steel: its molten-iron box on a molten-copper pipe (1131 s) | every cap reached 136.8 min after |
| build:robots-200 | FAILED | none | caster-S on casting-steel: its molten-iron box on a molten-copper pipe (1113 s) | every cap reached 132.8 min after |
| late:power | FAILED | none | caster-S on casting-steel: its molten-iron box on a molten-copper pipe (1434 s) | every cap reached 136.7 min after |
| late:stone-exit | FAILED | molten-iron in the molten-copper pipes from minute 3.5 for 236.5 min | caster-S on casting-steel: its molten-iron box on a molten-copper pipe (28 s) | NOT filled: 24 products short after 180 min |
| thin:lava | FAILED | none | caster-S on casting-steel: its molten-iron box on a molten-copper pipe (1259 s) | every cap reached 132.4 min after |
| thin:calcite | FAILED | none | caster-S on casting-steel: its molten-iron box on a molten-copper pipe (1219 s) | every cap reached 137.7 min after |
| starve:supply | FAILED | none | caster-S on casting-steel: its molten-iron box on a molten-copper pipe (3262 s) | every cap reached 105 min after |
| starve:foundry | FAILED | none | caster-S on casting-steel: its molten-iron box on a molten-copper pipe (3057 s) | every cap reached 112.8 min after |
| place:rot90 | FAILED | none | caster-S on casting-steel: its molten-iron box on a molten-copper pipe (1110 s) | every cap reached 134.9 min after |
| place:rot180 | FAILED | none | caster-S on casting-steel: its molten-iron box on a molten-copper pipe (1110 s) | every cap reached 134.9 min after |
| place:rot270 | FAILED | none | caster-S on casting-steel: its molten-iron box on a molten-copper pipe (1110 s) | every cap reached 134.9 min after |
| place:flipH | FAILED | none | caster-S on casting-steel: its molten-iron box on a molten-copper pipe (1133 s) | every cap reached 141.4 min after |
| place:flipV | FAILED | none | caster-S on casting-steel: its molten-iron box on a molten-copper pipe (1133 s) | every cap reached 141.4 min after |

First aid, tested on that string (`recover:flush`): after the hour of blocked stone the exit was connected and nothing else done: 24 of 24 products still short 20 minutes later. Then the pipe run holding the wrong fluid was emptied, as the flush button of a pipe does (330 molten-iron out of the molten-copper pipes): every cap was reached 139.2 minutes after. The flush was done by script; the button itself was not pressed.

From `published-7977ee59-fluid-scenarios.json` (`node scripts/requested-malls/foundry-mall/validate.mjs --explore --skip-audit --limit 648000 --scenario ports,build:shuffle-1,build:shuffle-2,build:shuffle-3,build:pipes-first,build:machines-first,build:combinators-last,build:copper-foundry-last,build:iron-foundry-last,build:robots-25,build:robots-200,late:power,late:stone-exit,thin:lava,thin:calcite,starve:supply,starve:foundry,place:rot90,place:rot180,place:rot270,place:flipH,place:flipV,recover:flush` on the earlier string, fill limit 180 minutes). On that string the open joint shows in every scenario; molten iron actually crossed where the copper pipes were empty at the wrong moment (ports, late:stone-exit, recover:flush), and the mall never filled again in late:stone-exit. Molten copper in the iron pipes was not produced by any scenario: on that string no single box ever joined copper to the iron trunk.

### Checks in every scenario

- Import: every entity at its position and direction, every recipe or circuit recipe control, every arm's hand size, filters and conditions, every combinator's parameters, every circuit net as one network with no two nets joined, one electric network.
- Chests: no chest ever held an item it does not declare (held in all).
- Fluids: every fluid segment (pipes, underground pipes, tanks) and both pumps read every tick, 8 readings a tick: no foreign fluid, ever (held in all). Every machine's fluid boxes read every second: none joined to the pipes of two fluids except through a pump (held in all).
- Recipes: every recipe-switching machine read every 10 ticks: it never held a recipe none of its rules asks for (held in all).
- Ring: peak 432 items against a bound of 540 (75% of both lanes); static lane limits inner 334, outer 84 of 360 per lane.
- Level gate: 0 ticks with a gated arm enabled against the level, over all scenarios.

### Switching machines in the full fill

| Machine | Recipe changes | Time per recipe (min) |
| --- | ---: | --- |
| caster-S | 655 | iron-ore-melting 292.3, casting-steel 36.5, casting-low-density-structure 5.8, changing 0.3 |
| caster-D | 1310 | changing 253.2, casting-copper-cable 81.3, casting-copper 0.4 |
| caster-G | 1978 | iron-ore-melting 245.9, casting-steel 27.3, concrete-from-molten-iron 21.8, casting-iron-gear-wheel 19.1, changing 18.7, casting-pipe 1.9, casting-iron-stick 0.2 |
| U1 | 139 | wooden-chest 200.4, bulk-inserter 30.3, space-platform-starter-pack 22.1, refined-concrete 22.0, fast-inserter 19.3, inserter 16.0, electric-mining-drill 11.4, cargo-landing-pad 4.3, solar-panel 2.3, asteroid-collector 2.1, accumulator 1.8, changing 0.8, crusher 0.5, electric-furnace 0.4, passive-provider-chest 0.3, decider-combinator 0.3, steel-chest 0.2, substation 0.1, arithmetic-combinator 0.1, constant-combinator 0.1 |
| U2 | 200 | iron-ore-melting 234.0, express-underground-belt 20.7, foundry 17.7, express-transport-belt 13.1, express-splitter 12.0, fast-underground-belt 8.6, fast-splitter 7.9, splitter 5.6, fast-transport-belt 5.6, transport-belt 4.1, underground-belt 3.8, changing 1.8 |

"iron-ore-melting" and "wooden-chest" are the parking recipes: recipes the machine can never start, held while it has nothing to make.

### Harness speed

Scenarios ran side by side at 320, 335, 341, 343, 344, 345, 345, 346, 346, 347, 348, 348, 352, 353, 355, 358, 360, 361, 366, 366, 372, 373, 374, 391, 391, 392, 396, 396, 401, 406, 418, 432, 439, 458 times real time; 439 s of wall time in all for 118.1 game hours.

## Bill from the recipes (expected values, productivity counted)

| Group | lava | calcite | plastic | carbide | acid | lubricant | water | molten iron | molten copper | stone made | stone used |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 assembling machine 3 | 87111 | 174 | 2000 | 0 | 0 | 0 | 0 | 40667 | 24667 | 3107 | 0 |
| 2 white-pack platform kit | 308153 | 616 | 1355 | 0 | 1650 | 3630 | 8000 | 170047 | 61068 | 10466 | 820 |
| 3 express belts | 48735 | 97 | 667 | 0 | 0 | 4667 | 0 | 29514 | 7037 | 1603 | 0 |
| 4 inserters | 28556 | 57 | 100 | 0 | 0 | 0 | 0 | 15333 | 6083 | 978 | 0 |
| 5 electric mining drill | 9000 | 18 | 0 | 0 | 0 | 0 | 0 | 6000 | 750 | 285 | 0 |
| 6 foundry | 26607 | 53 | 0 | 667 | 0 | 267 | 6222 | 17956 | 2000 | 838 | 356 |
| **one full fill** | 508163 | 1016 | 4122 | 667 | 1650 | 8563 | 14222 | 279517 | 101605 | 17277 | 1176 |

The measured fill uses more than this: the ring, the machines' input buffers and the brick stock are filled as well, and both lava recipes run whenever either metal is short.

## Things to know

- The asteroid collector and crusher recipes exist only once a space platform has been created. On Vulcanus that is always the case.
- A universal machine that has started loading a recipe keeps it until the craft is done; if the input it is waiting for never comes, it gives the recipe up after 15 minutes (U1) or 5 minutes (U2) and hands the loaded items back to the ring.
- Tiny recipes can run one craft over their cap (an arm's second item is a full set). The extra rides the ring, counts as stock and goes into the chest after the next collection.
- Kit items enter the kit chest only while no assembling machine 3 is wanted.
- Collecting from a chest reopens that product's level; lower groups pause until it is full again.
- Connect the stone exit. A stone belt that cannot move stops the two lava foundries, and with them everything; nothing is harmed and the mall carries on when the belt moves again.
- The brick stock (5 stacks) is filled from surplus stone whenever metal is cast, so concrete can be made later when little stone is flowing.

## Tried and rejected (native exploration, not kept as strings)

- **One recipe signal per machine without a parking recipe**: a machine that reads its own contents takes the item signals of what it still holds as recipe signals once the real signal is gone, and keeps crafting (gears to 150 on the ring).
- **Recipe following the pick at once**: an arm carrying an ingredient when the recipe changes holds it for good; the machine also flipped between two recipes hundreds of times while a product changed hands.
- **Counting what a switching machine has loaded as ring stock** for the casting rules: the caster stopped at the limit while the landing pad still waited for 180 concrete.
- **A 78-tile ring**: the inner lane filled at about 300 items and everything stopped; the ring is folded twice at its east end for 20 more tiles.
- **The water pipe straight into the gear foundry**: when that foundry changes recipe, its leftover molten iron flows out into any connected pipe that will take it; with water not yet connected it filled the water tank with molten iron, and water could never enter. A pump now stands between the tank and the foundry.
- **The molten copper pipe straight into the steel foundry** (published as `7977ee59…` and withdrawn): the same fault with molten iron and the copper pipes; see the section on that string above. A pump now stands on that port too, and the static audit refuses any machine with two ports of one kind on the pipes of two fluids.
- **A recipe wire that is empty for one tick while a universal machine parks**: a machine that reads its own contents takes them as its recipe for that tick (the belt foundry showed casting-iron-gear-wheel for one tick). Harmless on these pipes, closed anyway.
- **Casting copper plate in the steel foundry**: a one-fluid recipe uses both input ports as one box, so the molten copper box sat on the iron trunk as well; molten copper ended in the iron pipes.
- **A level that falls at once**: lower groups slipped in during the seconds a kit item waited for processing units.
- **Sharing by reserve instead of strict order**, and **dedicated machines for every recipe** (about 55 machines): not built; estimated only.

Kept exploration reports: `exploration-max-inserter-capacity-report.json`.

## If you already placed the earlier string (`7977ee59…`)

**How to tell it is contaminated.** Hold the pointer over the pipes (or turn on the detailed view, Alt):

1. The copper pipes are the two pipes directly under the west lava foundry (the one set to molten copper) and the three pipes on top of the cable foundry. They must show molten copper or nothing. If they show **molten iron**, that is the fault.
2. The signs around it: the copper lava foundry stands still with its output full, the cable foundry waits for molten copper, the two circuit machines wait for cable, and nothing new arrives in the chests.
3. Look at the iron pipes too (the row under the east lava foundry and the pipe above each of the other casting foundries): they must show molten iron or nothing. No test put molten copper there, but look.

**How to clear it without rebuilding.**

1. Click one of the copper pipes that shows molten iron. In the window that opens, press the flush (bin) button next to the fluid. That empties the whole connected run of pipes, underground pieces included; you need to do it once.
2. If the iron pipes show molten copper, do the same on one iron pipe.
3. Connect the stone exit (the belt on the north-west corner marked "OUT: surplus stone") to something that takes the stone away. A stone belt that cannot move is what sets the fault off.
4. Molten copper returns and the mall carries on (tested: see the first-aid line under the table of the earlier string). On the earlier string it can happen again whenever the copper pipes run empty, so treat this as first aid.

**How to fix it for good.** Use this string instead. Only two rows of pipes and two combinator settings differ, everything else is on the same tiles:

1. Remove every pipe and underground pipe on tile rows 8 and 9 (the two rows between the lava foundries and the casting foundries). The water pump in those rows can stay.
2. Place this blueprint exactly on top of the old one. Robots put in the new pump (column 7, rows 8 and 9) and the pipes and underground pipes of those two rows. Nothing else moves; chests, caps and entrances stay where they are. That is the whole fluid fix.
3. Two combinator settings and two wires also differ (they close a one-tick recipe gap that does no harm on these pipes). Placing the blueprint over the old one was not tested for carrying those over; to be sure of having them, take the old mall down and place this one.

## Reproduce

```
node scripts/requested-malls/foundry-mall/generate.mjs      # writes this folder from the pinned prototypes
node scripts/requested-malls/foundry-mall/audit.mjs         # static audit
node scripts/requested-malls/foundry-mall/validate.mjs      # full native protocol (needs the game): 34 headless games, a few minutes on ten cores
```

Static audit: passed, 52 checks. Prototypes pinned from a private `--dump-data` of Factorio 2.1.25 (`scripts/requested-malls/foundry-mall/prototypes.json`).

