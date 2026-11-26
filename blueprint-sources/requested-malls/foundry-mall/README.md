# Foundry mall · lava and calcite in, six groups of products out, in list order

Status: **qualified** (full native protocol, `native-report.json`). Blueprint SHA-256 `a8265e7f0c7c0ff3fa824a3f790b9034b5aa408eb9483f0c2bde031c2ee0ee8c`. Factorio 2.1.25 Space Age, Vulcanus, vanilla, normal quality, no modules, no beacons.

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
| IN-1 | lava | pipe | (0, 2) | west | 508163 | 956000 |
| IN-2 | calcite | belt | (0, 0) | west | 1016 | 1912 |
| OUT-STONE | stone | belt | (0, 1) | west | 16101 | 28916 |
| IN-3 | water | pipe | (29, 4) | east | 14222 | 17500 |
| IN-4 | lubricant | pipe | (6, 32) | south | 8563 | 9305 |
| IN-5 | sulfuric-acid | pipe | (29, 31) | east | 1650 | 1975 |
| IN-6 | plastic-bar | belt | (19, 32) | south | 4122 | 4762 |
| IN-7 | tungsten-carbide | belt | (23, 32) | south | 667 | 900 |

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
- **The buffer chest.** Everything that leaves U2 goes into a steel chest first, and one arm puts it on the ring item by item while the ring holds fewer than that item's limit (finished products: 8). When U2 gives up a part-loaded foundry recipe it hands back some 150 ingredients at once; put straight on the ring they filled the lane and U2 could never be emptied again (see the section on string `b9243fa7…`). What lies in the chest still counts as stock for the rules.
- **Two universal machines.** U1 (assembling machine 3) makes 18 recipes: the small kit items, inserters, drills and refined concrete. U2 (a foundry, lubricant on its fluid box) makes the three belt tiers and the foundry, with the foundry's +50% on each. One decider per recipe ("rule") says when that recipe is wanted and makeable; a selector picks the highest; the machine takes the recipe from the circuit. A never-fed shadow machine reads out the recipe's ingredients so the input arms load exactly one craft. A recipe is changed only on the tick a craft finishes or while the machine is parked.
- **Dedicated machines** for the high-volume chain: 2 electronic circuit, 4 advanced circuit, 2 speed module, processing unit, engine, electric engine, foundation, the assembling machine 1 → 2 → 3 line, the rocket silo (loads exactly one craft), a battery plant and the brick furnace.
- **List order.** Every rule and every dedicated final shows a weight on one network; the highest weight in force sets the level (6 = assembling machine 3 … 1 = foundry). Machines and recipes of a lower level are held while a higher level is in force. The level rises at once and falls only after 120 s without a makeable product at that level.
- **Skip and return.** A rule is true only while its product is short *and* one craft's worth of every scarce ingredient is in sight (ring + the machine), and fluid recipes also need their tank above 500. A product whose outside input is missing therefore drops out of the level by itself, and comes back when the input does. The two dedicated finals use a timer instead: assembling machine 3 gives up its level after 180 s without a craft, the rocket silo after 120 s without a delivery.

### The priority rule, as built and as tested

Built: **strict sequencing by group**, not sharing. While a group has a product below its cap that can be made, no lower group loads anything: the input arms of the lower dedicated machines are switched off and the universal machines are not given lower recipes. Chosen over sharing by reserve because it can be checked exactly and needs no tuning; the cost is that a full fill is the sum of the groups, not the longest of them.
Tested natively, every tick: no level-gated arm may be enabled for more than five ticks while a higher level is in force. Reported per phase: the minutes each level was in force, the time each product reached its cap, and what each machine crafted at which level.
Limits of the rule, stated plainly: (1) a universal machine finishes the one craft it has started before it obeys a higher level; (2) inside the kit the order is the bill's order per machine, and the silo, foundation and the small items run side by side; (3) the casting foundries and the circuit machines are shared and keep the ring at its limits at every level; (4) "makeable" is read from stock in sight, so a group can lose its turn for a while if an intermediate it needs takes longer than 120 s to come round.

## Size and parts

Footprint **32 × 33 = 1056 tiles**, 450 entities.

Machines: 7 foundries, 19 assembling machines 3 (two of them shadows that never craft), 1 chemical plant, 1 electric furnace. Control: 77 decider, 24 arithmetic, 6 selector and 17 constant combinators.

Bill of materials: 24 arithmetic-combinator, 19 assembling-machine-3, 43 bulk-inserter, 1 chemical-plant, 17 constant-combinator, 77 decider-combinator, 15 display-panel, 1 electric-furnace, 34 fast-inserter, 135 fast-transport-belt, 7 foundry, 2 long-handed-inserter, 5 passive-provider-chest, 40 pipe, 14 pipe-to-ground, 2 pump, 6 selector-combinator, 2 steel-chest, 2 storage-tank, 4 substation. Red belts and fast, bulk and long-handed inserters only; hand sizes are pinned (fast 1, bulk 2), so the mall behaves the same whatever inserter capacity is researched.

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
  11 i.iaddbcbbbaaii.bbbiiiiib.ii.i..
  12 AAAaddBbFFFFFPPiAAA^PPP^AAACCC..
  13 AAA=TTT=FFFFF!!cAAA^!!!^AAACCC..
  14 AAAdTTT=FFFFFcc!AAA^ccc^AAACCC..
  15 aaadTTT=FFFFFaaddd.^ddd^.=====..
  16 aaadd!=cFFFFFaaddd!^ddd^!dd..!..
```

F foundry · A assembling machine 3 · C chemical plant · K furnace · T tank · p pump · S substation · P provider chest · B brick chest · > < ^ v belt · = pipe · u underground pipe · i fast · b bulk · l long-handed inserter · d a s c combinators · ! panel

## Measured natively

Every figure below is from `native-report.json` (44 scenarios, each its own headless game on a Vulcanus surface from a fresh import of this string). **Full caps**: the fill from empty and the rate scenario. **Reduced caps** (a tenth of each cap, at least 2; the silo, pad and starter pack stay at 1): refill, outage and recovery, hold, cap edits, single refills, the seven withheld-input scenarios and every fluid-safety scenario. A reduced-cap time is not a full-stack time.

### Fill from empty at the published caps: 341.3 minutes

| Product | Group | Cap | At its cap after (min) |
| --- | ---: | ---: | ---: |
| assembling-machine-3 | 1 | 50 | 50.1 |
| assembling-machine-2 | 2 | 4 | 52.2 |
| electric-furnace | 2 | 1 | 59.8 |
| fast-inserter (kit) | 2 | 19 | 59.9 |
| solar-panel | 2 | 6 | 62.1 |
| constant-combinator | 2 | 1 | 63.6 |
| arithmetic-combinator | 2 | 1 | 63.6 |
| accumulator | 2 | 4 | 64.1 |
| decider-combinator | 2 | 5 | 64.4 |
| passive-provider-chest | 2 | 1 | 64.9 |
| substation | 2 | 1 | 65.1 |
| crusher | 2 | 1 | 103.4 |
| rocket-silo | 2 | 1 | 110.5 |
| asteroid-collector | 2 | 4 | 115.8 |
| cargo-landing-pad | 2 | 1 | 123.2 |
| space-platform-starter-pack | 2 | 1 | 145.2 |
| space-platform-foundation | 2 | 151 | 150.7 |
| express-transport-belt | 3 | 100 | 176.5 |
| express-underground-belt | 3 | 50 | 210.2 |
| express-splitter | 3 | 50 | 234.7 |
| fast-inserter (inserter group) | 4 | 50 | 251.7 |
| bulk-inserter | 4 | 50 | 300.9 |
| electric-mining-drill | 5 | 50 | 315.0 |
| foundry | 6 | 20 | 341.3 |

Minutes each level was in force: assembling machine 3 52.1, white-pack platform kit 100.2, express belts 84.0, inserters 66.3, electric mining drill 14.1, foundry 24.5. Level-gated arms enabled against the level: 0 ticks.
Used: lava 956000, calcite 1912, plastic-bar 4762, tungsten-carbide 900, sulfuric-acid 1975, lubricant 9305, water 17500; molten iron 571250, molten copper 145500; stone made 31580, used 2664, left by the exit 28916.
Left on the ring when the last chest filled (finished products not in a chest): 4 express-underground-belt, 6 fast-inserter, 4 assembling-machine-2, 2 assembling-machine-3, 8 space-platform-foundation.

### Rates (full caps)

After a full fill, one group at a time has its products taken out of its chest every second (15 minutes warm-up, 30 measured) while the groups above it stay full. The first row empties every chest at once: with strict list order that only ever shows group 1.

| Measured window | Products per minute | lava | calcite | plastic-bar | tungsten-carbide | sulfuric-acid | lubricant | water | stone out |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| every chest emptied | assembling machine 3 1.03 | 2300 | 4.6 | 40.5 | 0 | 0 | 0 | 0 | 81.8 |
| group 2 (white-pack platform kit) | assembling machine 2 3.53, cargo landing pad 0.03, fast inserter (kit) 2.1, electric furnace 0.63, platform foundation 1.23 | 6533.3 | 13.1 | 19.3 | 0 | 16.7 | 68 | 226.7 | 177.6 |
| group 3 (express belts) | express transport belt 5.03 | 833.3 | 1.7 | 0 | 0 | 0 | 68.7 | 0 | 24.3 |
| group 4 (inserters) | fast inserter 3.2 | 300 | 0.6 | 0 | 0 | 0 | 0 | 0 | 10.3 |
| group 5 (electric mining drill) | electric mining drill 3.67 | 866.7 | 1.7 | 0 | 0 | 0 | 0 | 0 | 27.5 |
| group 6 (foundry) | foundry 0.87 | 3483.3 | 7 | 0 | 38.3 | 0 | 15.3 | 376.7 | 84.1 |

Inputs are what the machines consumed per minute in the window (production statistics): the draw each entrance has to meet.

### Refilling one collected product (reduced caps)

| Product | Taken | Back at cap after (min) | lava | calcite | plastic | carbide | acid | lubricant | water |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| assembling-machine-3 | 5 | 0.2 | 0 | 0 | 2 | 0 | 0 | 0 | 0 |
| fast-inserter (kit) | 2 | 2.2 | 7500 | 15 | 86 | 0 | 0 | 0 | 0 |
| fast-inserter | 5 | 2.1 | 2000 | 4 | 78 | 0 | 0 | 0 | 0 |
| express-transport-belt | 10 | 2.7 | 3500 | 7 | 30 | 0 | 0 | 140 | 0 |
| express-underground-belt | 5 | 2.0 | 1500 | 3 | 0 | 0 | 0 | 40 | 0 |
| express-splitter | 5 | 5.0 | 4500 | 9 | 98 | 0 | 0 | 400 | 0 |
| bulk-inserter | 5 | 5.7 | 5000 | 10 | 18 | 0 | 0 | 0 | 0 |
| electric-mining-drill | 5 | 3.4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| foundry | 2 | 4.3 | 9000 | 18 | 0 | 100 | 0 | 40 | 900 |

Draw is the total consumed during that refill; it includes topping the ring back up.

### Refill, outage, hold, cap edits (reduced caps)

| Scenario | Phase | Minutes | Ended by |
| --- | --- | ---: | --- |
| fill | fill from empty | 341.3 | every cap reached |
| fill | refill after complete collection | 112.8 | every cap reached |
| fill | five-minute outage of every input | 5.0 | fixed length |
| fill | recovery after the outage | 113.5 | every cap reached |
| hold | fill from empty | 140.8 | every cap reached |
| hold | settle at full stock | 10.0 | fixed length |
| hold | one-hour hold at full stock | 60.0 | fixed length |
| hold | refill after collection | 111.3 | every cap reached |
| caps | fill from empty | 140.8 | every cap reached |
| caps | caps raised | 6.0 | every cap reached |
| caps | caps lowered, those products collected | 4.7 | every cap reached |
| caps | caps restored | 3.6 | every cap reached |

Hold: for one hour at full stock no chest changed and the final machines crafted 0 times.

Cap edits (written into the caps combinator by script, as a player would): raised to {"assembling-machine-3":9,"express-transport-belt":16,"space-platform-foundation":25} → every chest at the new caps in 6.0 min; lowered to {"assembling-machine-3":2,"express-transport-belt":5,"space-platform-foundation":8} with those chests emptied → refilled to exactly the lower caps in 4.7 min; restored in 3.6 min.

### Skip and return, one outside input withheld from a cold start (reduced caps)

| Withheld | Products that need it | Everything else at its cap after (min) | After it returned: all at cap after (min) |
| --- | --- | ---: | ---: |
| lava | all | nothing can be made (15.0 min, nothing made) | 140.4 |
| calcite | all | nothing can be made (15.0 min, nothing made) | 135.0 |
| plastic-bar | assembling machine 3, rocket silo, cargo landing pad, platform starter pack, asteroid collector, crusher, electric furnace, passive provider chest, substation, express splitter, bulk inserter | 77.4 | 99.1 |
| tungsten-carbide | foundry | 134.9 | 4.3 |
| sulfuric-acid | rocket silo, cargo landing pad, platform starter pack, asteroid collector, accumulator | 107.0 | 75.1 |
| lubricant | rocket silo, asteroid collector, crusher, express transport belt, express underground belt, express splitter, foundry | 112.6 | 55.2 |
| water | rocket silo, cargo landing pad, foundry | 128.0 | 29.7 |

In the withheld phase the mall must hold every cap that does not need the input for two minutes while the dependent products stay short; then the input returns and every cap must be reached.

### Hand-back and outages

A universal machine that has loaded part of a recipe and cannot finish it drops the recipe after its give-up time when something of a higher rank is wanted, and hands back what it holds. Each hand-back row: a product is taken with an entrance cut, so the machine stands part-loaded; then a higher product is taken. Where the higher product does not need the cut entrance it must be refilled with the entrance still cut. Each outage row: every chest emptied and the entrance cut for twenty minutes, then a fill.

| Scenario | Caps | Verdict | Higher product | After the entrance returned | U2 at the end |
| --- | --- | --- | --- | --- | --- |
| foundry taken with tungsten-carbide cut; then express-transport-belt taken, tungsten-carbide still cut | reduced | passed | refilled after 7.7 min | every cap reached 4.9 min after | iron-ore-melting, 0 waiting to leave |
| foundry taken with tungsten-carbide cut; then express-transport-belt taken, tungsten-carbide still cut | full | passed | refilled after 27.1 min | every cap reached 24.3 min after | iron-ore-melting, 0 waiting to leave |
| foundry taken with tungsten-carbide cut; then express-splitter taken, tungsten-carbide still cut | reduced | passed | refilled after 8.3 min | every cap reached 4.8 min after | iron-ore-melting, 0 waiting to leave |
| express-underground-belt taken with lava cut; then express-transport-belt taken, lava still cut, 10 minutes | reduced | passed | waited 10 min | every cap reached 0.1 min after | iron-ore-melting, 0 waiting to leave |
| space-platform-starter-pack taken with lava cut; then cargo-landing-pad taken, lava still cut, 20 minutes | reduced | passed | waited 20 min | every cap reached 20.4 min after | iron-ore-melting, 0 waiting to leave |
| asteroid-collector taken with plastic-bar cut; then cargo-landing-pad taken, plastic-bar still cut, 20 minutes | full | passed | waited 20 min | every cap reached 3.7 min after | iron-ore-melting, 0 waiting to leave |
| every input cut for 20 minutes, every chest emptied | reduced | passed | – | every cap reached 107.9 min after | iron-ore-melting, 0 waiting to leave |
| tungsten-carbide cut for 20 minutes, every chest emptied | reduced | passed | – | every cap reached 88.5 min after | iron-ore-melting, 0 waiting to leave |
| lava cut for 20 minutes, every chest emptied | reduced | passed | – | every cap reached 106.6 min after | iron-ore-melting, 0 waiting to leave |
| every input cut for 20 minutes, every chest emptied | full | passed | – | every cap reached 315.5 min after | iron-ore-melting, 0 waiting to leave |

### The string published before this one, `b9243fa7…`, in the same scenarios

That string had no buffer chest: U2's two output arms dropped straight onto the ring. **It jams when U2 drops a part-loaded foundry recipe.** The way there: tungsten carbide runs out while foundries are being made, so U2 stands with the carbide it could get, 50 steel, 30 circuits and 20 refined concrete; the ring is refilled to its limits meanwhile; then express belts, underground belts or splitters are wanted. After five minutes U2 drops the foundry recipe and its arms put the load back on the ring until the lane is full. What is left stays in U2, and a foundry that still holds something takes no new recipe.
Measured on that string at reduced caps: express belts not refilled in 180 minutes; U2 at the end: no recipe, 45 items waiting to leave, 440 items on the ring; and after the tungsten carbide returned it stood for another 180 minutes with 2 products short. It does not clear by itself.

| Scenario | Caps | Verdict | Higher product | After the entrance returned | U2 at the end |
| --- | --- | --- | --- | --- | --- |
| foundry taken with tungsten-carbide cut; then express-transport-belt taken, tungsten-carbide still cut | reduced | FAILED | NOT refilled in 180 min | NOT filled: 2 products short after 180 min | no recipe, 45 waiting to leave |
| foundry taken with tungsten-carbide cut; then express-transport-belt taken, tungsten-carbide still cut | full | FAILED | NOT refilled in 180 min | NOT filled: 2 products short after 180 min | no recipe, 24 waiting to leave |
| foundry taken with tungsten-carbide cut; then express-splitter taken, tungsten-carbide still cut | reduced | FAILED | NOT refilled in 180 min | NOT filled: 2 products short after 180 min | no recipe, 45 waiting to leave |
| express-underground-belt taken with lava cut; then express-transport-belt taken, lava still cut, 10 minutes | reduced | passed | waited 10 min | every cap reached 0.1 min after | iron-ore-melting, 0 waiting to leave |
| space-platform-starter-pack taken with lava cut; then cargo-landing-pad taken, lava still cut, 20 minutes | reduced | passed | waited 20 min | every cap reached 20.8 min after | iron-ore-melting, 0 waiting to leave |
| asteroid-collector taken with plastic-bar cut; then cargo-landing-pad taken, plastic-bar still cut, 20 minutes | full | passed | waited 20 min | every cap reached 4 min after | iron-ore-melting, 0 waiting to leave |
| every input cut for 20 minutes, every chest emptied | reduced | passed | – | every cap reached 108.7 min after | iron-ore-melting, 0 waiting to leave |
| tungsten-carbide cut for 20 minutes, every chest emptied | reduced | passed | – | every cap reached 88.6 min after | iron-ore-melting, 0 waiting to leave |
| lava cut for 20 minutes, every chest emptied | reduced | passed | – | every cap reached 106.6 min after | iron-ore-melting, 0 waiting to leave |
| every input cut for 20 minutes, every chest emptied | full | passed | – | every cap reached 314.7 min after | iron-ore-melting, 0 waiting to leave |

From `published-b9243fa7-handback-scenarios.json` (`node scripts/requested-malls/foundry-mall/validate.mjs --explore --skip-audit --scenario handback:U2:foundry:foundry:tungsten-carbide:express-transport-belt,handback:U2:foundry:foundry:tungsten-carbide:express-transport-belt:10:full,handback:U2:foundry:foundry:tungsten-carbide:express-splitter,handback:U2:express-underground-belt:express-underground-belt:lava:express-transport-belt,handback:U1:space-platform-starter-pack:space-platform-starter-pack:lava:cargo-landing-pad,handback:U1:asteroid-collector:asteroid-collector:plastic-bar:cargo-landing-pad:10:full,outage:all:20,outage:tungsten-carbide:20,outage:lava:20,outage:all:20:full,recover:empty-by-hand,recover:take-all` on that string). It did not jam in the twenty-minute outages, in U1's hand-backs (U1 stands inside the ring and hands back onto the other lane, which has room) or when U2 dropped a part-loaded underground belt recipe (what it hands back there is what the belts it turns to are made of).
Clearing it, tested on that string: with U2 jammed, everything it held was taken out by hand (45 items): express belts were refilled 5 minutes later and every cap was reached 3.2 minutes after the tungsten carbide returned.
Emptying every chest instead (so that the other machines use up what crowds the ring): it cleared; everything that does not need tungsten carbide was refilled after 108.9 minutes.

### Fluid safety (reduced caps)

These scenarios place and feed the mall the way a player does rather than the way a test does. In all of them, as in every other scenario, every fluid segment and pump is read every tick and every machine fluid box every second.

| Scenario | What is done | Verdict | Foreign fluid | Afterwards |
| --- | --- | --- | --- | --- |
| ports | Port matrix: every recipe change of every recipe-switching foundry, with each network on its ports full or empty | passed | none | 192 recipe changes, 0 put a fluid into another network |
| build:shuffle-1 | Built one entity every 20 ticks in a shuffled order, supply and power already connected (built in 2.5 min) | passed | none | every cap reached 136.8 min after |
| build:shuffle-2 | Same, second shuffle (built in 2.5 min) | passed | none | every cap reached 138.6 min after |
| build:shuffle-3 | Same, third shuffle (built in 2.5 min) | passed | none | every cap reached 137.5 min after |
| build:pipes-first | Built piecemeal, all pipes, tanks and pumps first (built in 2.5 min) | passed | none | every cap reached 137.5 min after |
| build:machines-first | Built piecemeal, machines and substations first (built in 2.5 min) | passed | none | every cap reached 137.1 min after |
| build:combinators-last | Built piecemeal, every combinator last (built in 2.5 min) | passed | none | every cap reached 137.7 min after |
| build:copper-foundry-last | Built piecemeal; the molten copper foundry arrives ten minutes after everything else (built in 12.5 min) | passed | none | every cap reached 137.1 min after |
| build:iron-foundry-last | Built piecemeal; the molten iron foundry arrives ten minutes after everything else (built in 12.5 min) | passed | none | every cap reached 134.8 min after |
| build:robots-25 | Built by 25 of the game's own construction robots from a ghost blueprint (built in 5.1 min) | passed | none | every cap reached 136.9 min after |
| build:robots-200 | Built by 200 construction robots from a ghost blueprint (built in 0.6 min) | passed | none | every cap reached 139.1 min after |
| late:power | Everything connected, no power for five minutes | passed | none | every cap reached 135.5 min after |
| late:stone-exit | Stone exit not connected for an hour (the stone belt fills), then connected | passed | none | every cap reached 127.7 min after |
| thin:lava | Lava at 100 a second for an hour (the two lava foundries take 250), then in full | passed | none | every cap reached 134.4 min after |
| thin:calcite | Calcite at 12 a minute for an hour (they take 30), then in full | passed | none | every cap reached 139.3 min after |
| starve:supply | After a fill: every chest emptied and lava cut for ten minutes; then the same with calcite | passed | none | every cap reached 106.4 min after |
| starve:foundry | After a fill: every chest emptied and the molten copper foundry stopped for fifteen minutes; then the same with the molten iron foundry | passed | none | every cap reached 109.7 min after |
| place:rot90 | Placed turned a quarter clockwise | passed | none | every cap reached 140.9 min after |
| place:rot180 | Placed turned a half | passed | none | every cap reached 140.9 min after |
| place:rot270 | Placed turned three quarters | passed | none | every cap reached 140.9 min after |
| place:flipH | Placed mirrored left to right | passed | none | every cap reached 139.3 min after |
| place:flipV | Placed mirrored top to bottom | passed | none | every cap reached 139.3 min after |

Port matrix: 192 cases. Each one sets a recipe on one recipe-switching foundry through its own red wire (taken off the mall's selector and put on a test combinator for this scenario), fills or empties the networks on its ports, asks for another recipe and reads every segment for two seconds. Fluid put into another network: 0 cases. Fluid box joined to the pipes of two fluids: 0.
Piecemeal construction: the game refused no entity for fluid reasons in any order (it has no such rule: an empty pipe run accepts whichever fluid arrives first). A mirror image is written by the test as its own string (positions and directions mirrored, the mirror flag set on foundries and the chemical plant, the tanks on their other diagonal), because the game has no script call that flips a blueprint; the game's own flip key was not exercised. Turning is done by the game.

### An earlier string, `7977ee59…`, in the fluid scenarios

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
- Ring: peak 422 items against a bound of 540 (75% of both lanes); static lane limits inner 334, outer 84 of 360 per lane.
- Level gate: 0 ticks with a gated arm enabled against the level, over all scenarios.

### Switching machines in the full fill

| Machine | Recipe changes | Time per recipe (min) |
| --- | ---: | --- |
| caster-S | 660 | iron-ore-melting 297.7, casting-steel 37.2, casting-low-density-structure 5.9, changing 0.5 |
| caster-D | 1337 | changing 259.5, casting-copper-cable 81.4, casting-copper 0.4 |
| caster-G | 1969 | iron-ore-melting 255.6, casting-steel 27.0, concrete-from-molten-iron 21.5, casting-iron-gear-wheel 19.3, changing 15.8, casting-pipe 1.8, casting-iron-stick 0.2 |
| U1 | 141 | wooden-chest 197.3, bulk-inserter 29.8, refined-concrete 24.0, fast-inserter 23.8, space-platform-starter-pack 22.0, inserter 18.2, electric-mining-drill 12.2, cargo-landing-pad 5.1, asteroid-collector 2.2, solar-panel 2.2, accumulator 1.9, changing 0.8, crusher 0.6, passive-provider-chest 0.4, electric-furnace 0.3, decider-combinator 0.2, steel-chest 0.2, substation 0.1, constant-combinator 0.1, arithmetic-combinator 0.0 |
| U2 | 232 | iron-ore-melting 241.7, express-underground-belt 21.6, foundry 17.8, express-transport-belt 12.0, express-splitter 11.5, fast-underground-belt 9.6, fast-splitter 7.4, fast-transport-belt 6.2, splitter 4.7, transport-belt 4.4, underground-belt 3.6, changing 1.0 |

"iron-ore-melting" and "wooden-chest" are the parking recipes: recipes the machine can never start, held while it has nothing to make.

### Harness speed

Scenarios ran side by side at 457, 467, 468, 470, 471, 471, 471, 471, 473, 473, 474, 475, 475, 476, 476, 477, 478, 478, 480, 482, 482, 482, 483, 484, 484, 484, 484, 485, 486, 486, 487, 488, 488, 488, 489, 489, 491, 491, 491, 494, 496, 498, 506, 520 times real time; 1381 s of wall time in all for 166.5 game hours.

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
- A universal machine that has started loading a recipe keeps it until the craft is done; if the input it is waiting for never comes and something of a higher rank is wanted, it gives the recipe up after 15 minutes (U1) or 5 minutes (U2). U1 hands the loaded items back to the ring, U2 into its buffer chest.
- The buffer chest can hold intermediates for a long time when the ring is at its limits. They count as stock and are used first when the ring has room.
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

## If you already placed the string before this one (`b9243fa7…`)

**How to recognise the jam.** U2 is the foundry in the south-west corner with the lubricant tank beside it.

1. U2 shows no recipe and does nothing, although express belts, underground belts or splitters are below their caps.
2. Open it: its output or trash slots hold tungsten carbide, steel, circuits or refined concrete. The two arms above its right half stand still with their hands full.
3. The ring is crowded with the same things: far more tungsten carbide than the 8 it normally carries.

**How to clear it by hand.**

1. Open U2 and take out everything it holds, slots and trash. It takes a recipe again within seconds.
2. Pick the surplus tungsten carbide off the ring, or simply restore the tungsten carbide supply: the next foundry uses it up.
3. It can happen again whenever U2 has to drop a part-loaded foundry recipe, so treat this as first aid.

**How to get the fix without rebuilding.** This string differs from that one only around U2:

1. Remove the two bulk inserters above the right half of U2 (tiles (11, 27) and (12, 27)) and the decider combinator at U2's top-left corner (tiles (6, 28) and (7, 28)).
2. Place this blueprint exactly on top of the old one. Robots add the buffer chest at (6, 28), the arm from U2 into it, the arm from it onto the ring, seven combinators and their wires. Nothing else moves; entrances, chests and caps stay where they are.
3. Tested natively: this string placed over that one after removing those 3 entities (10 entities added). Every circuit net came out whole, the hand-back that jammed the old string passed and a fill from empty reached every cap. The test places the blueprint by script, the way a blueprint is placed over standing entities; a player's own paste in a running game with stock on the ring was not exercised.

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

Static audit: passed, 53 checks. Prototypes pinned from a private `--dump-data` of Factorio 2.1.25 (`scripts/requested-malls/foundry-mall/prototypes.json`).

