# Foundry belts and fuel mall · express belts, inserters, drills, foundries in list order · 12 rocket fuel a minute

Status: **qualified** (full native protocol, `native-report.json`). Blueprint SHA-256 `afbef0f103a871dd1c9ac768932d686b4c0e674eed9d329cf08694f78fc77346`. Factorio 2.1.25 Space Age, Vulcanus, vanilla, normal quality, no modules, no beacons.

A smaller foundry mall. It is the [foundry mall](../foundry-mall/README.md) without the assembling machine 3 product and without the platform kit, re-packed, with the rocket fuel supply attached under it. Foundries turn lava and calcite into molten metal and cast plates, gears, steel, sticks, cable and concrete; everything on the list is kept at a cap in four passive provider chests and made **in the order of the list**. The rocket fuel section makes 12 rocket fuel a minute from coal into a fifth chest; it shares no machine with the rest, so it neither waits for the list nor holds it up.

The big foundry mall is kept as it is; this is a second blueprint beside it.

## What it makes

| Priority | Group | Product | Cap | Chest |
| ---: | --- | --- | ---: | --- |
| 1 | express belts | express-transport-belt | 100 | OUT-1 |
| 1 | express belts | express-underground-belt | 50 | OUT-1 |
| 1 | express belts | express-splitter | 50 | OUT-1 |
| 2 | inserters | fast-inserter | 50 | OUT-2 |
| 2 | inserters | bulk-inserter | 50 | OUT-2 |
| 3 | electric mining drill | electric-mining-drill | 50 | OUT-3 |
| 4 | foundry | foundry | 20 | OUT-4 |
| – | rocket fuel (own section, not in the order) | rocket-fuel | 200 | OUT-5 |

Rocket fuel: the cap is 10 stacks of 20 (the stack size in the pinned prototypes), which is 4 rockets' worth (50 rocket parts a rocket, 1 rocket fuel a part). At 12 a minute the chest fills from empty in about 17 minutes.

## What is gone compared with the big foundry mall

- **Products**: the assembling machine 3 stack and all 16 items of the platform kit, with the kit's share of fast inserters.
- **Machines**: the steel and low density structure foundry, the separate plate foundry (one foundry now casts plate, gear, stick, concrete and steel), three of the four advanced circuit machines, one of the two circuit machines, both speed module machines, the processing unit, engine, electric engine and foundation machines, the assembling machine 1 → 2 → 3 line, the rocket silo machine and the battery plant. Mall part now: 5 foundries (were 7), 6 assembling machines 3 (were 19), no chemical plant (was 1).
- **Control**: 67 combinators (were 107): no kit rules, no silo loader, no level-gated arms.
- **Belts and pipes**: the brick belt, the calcite belt and the molten copper manifold. Calcite and a little stone now ride the ring; the copper lava foundry sits against the cable foundry, the iron lava foundry against the casting foundry.
- **An input that is no longer needed by the mall part**: sulfuric acid (it was only for processing units and batteries). The acid entrance here feeds the rocket fuel section only.
- **A new input**: coal, for the rocket fuel section. Its calcite is a second calcite entrance, on the coal belt's other lane.
- **New in the mall part**: a dedicated refined concrete machine and a buffer chest behind the belt foundry (see "How it works").

## Size

| | Tiles | Rectangle | Entities |
| --- | ---: | --- | ---: |
| Mall part (rows 0 to 16) | **578** | 34 × 17 | 273 |
| Rocket fuel section (rows 17 to 26) | **340** | 34 × 10 | 130 |
| Together | **918** | 34 × 27 | 403 |
| The big foundry mall | 1056 | 32 × 33 | 450 |
| The stand-alone rocket fuel supply | 340 | 34 × 10 | 129 |

The mall part is 55% of the big foundry mall. Mall and fuel together are 66% of the two blueprints placed separately, and smaller than the big foundry mall alone. The rectangle has no empty row or column: both parts are 34 wide and touch.

## Entrances, exit, power

Tiles are counted from the blueprint's top-left tile (column, row). Every entrance has a panel with its figure.

| Port | What | For | Kind | Tile | Edge | Panel figure (a minute) | Highest draw in a rate window, nothing held back (a minute) | Taken in the measured full fill |
| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: |
| IN-1 | lava | mall part | pipe | (0, 15) | west | 15000 | 2483 | 265100 |
| IN-2 | calcite | mall part | belt | (1, 0) | north | 30 | 5 | 628 |
| IN-3 | plastic-bar | mall part | belt | (3, 0) | north | 30 | 0 | 1167 |
| IN-4 | tungsten-carbide | mall part | belt | (5, 0) | north | 40 | 29 | 725 |
| IN-5 | lubricant | mall part | pipe | (33, 14) | east | 160 | 143 | 50420 |
| IN-6 | water | both parts | pipe | (33, 16) | east | 2070 (1320 fuel + 750 mall) | 1350 | 56140 |
| OUT-STONE | stone (out) | mall part | belt | (0, 16) | west | – | – | 7467 |
| IN-7 | sulfuric-acid | rocket fuel | pipe | (0, 17) | west | 880 | 900 | 21375 |
| IN-8 | coal | rocket fuel | belt | (0, 23) | west | 352 | 360 | 7839 |
| IN-9 | calcite | rocket fuel | belt | (0, 25) | west | 71 | 72 | 1632 |

- **Panel figures.** Rocket fuel: from the recipes at 12 a minute (the same figures as the stand-alone supply; calcite rounded up). Mall part: lava and calcite are both lava foundries running flat out; plastic is the one advanced circuit machine flat out; tungsten carbide, lubricant and water are set above the highest draw the rate windows measured. In those windows every entrance was offered more than it could take; the rocket fuel section then makes a little over 12 a minute and takes a little over its figures, and the water column there is both parts together. "Taken in the measured full fill" counts what crossed the entrance, including what was still in pipes, belts and tanks at the end.
- **Calcite has two entrances**: a belt on the north edge for the mall part (it rides the ring to the two lava foundries) and a belt on the west edge for the fuel section (one lane of the coal belt). They are not connected inside.
- **Water has one entrance** for both parts, on the east edge: the fuel section's crackers and the casting foundry (concrete) and the refined concrete machine draw on it.
- **Sulfuric acid and coal** feed only the rocket fuel section. The mall part needs neither.
- **Power**: connect the substation at tile (33, 18) (panel "POWER: connect the substation above"). Five substations in one chain power everything.
- **Stone** is a by-product of every lava craft. The bricks for concrete are made inside; the rest leaves on the belt of OUT-STONE and must be taken away. If that belt cannot move, the two lava foundries stop and so does the mall part; nothing is harmed, and it carries on when the belt moves again (tested for an hour of blockage). The rocket fuel section is not affected.
- **Lubricant** passes a storage tank the control reads; it counts as present above 500. The tank takes 25,000 when first connected.

## Output chests and caps

| Chest | Tile | Holds |
| --- | --- | --- |
| OUT-1 | (22, 1) | express-transport-belt, express-underground-belt, express-splitter |
| OUT-2 | (24, 1) | fast-inserter, bulk-inserter |
| OUT-3 | (26, 1) | electric-mining-drill |
| OUT-4 | (28, 1) | foundry |
| OUT-5 | (33, 26) | rocket-fuel |

**Caps** live in one constant combinator at tile (30, 1) (panel "CAPS"), one positive number per product, rocket fuel included. Edit a number and the stock follows. Nothing else holds a cap.

## How it works

- **Casting band.** Two lava foundries lie on their sides: lava in on one side, molten metal out of the other, straight into the next foundry's ports. Molten copper goes to the cable foundry, molten iron to the one casting foundry, which casts plate, gear, stick, concrete or steel as the stock asks, each from half its limit up to the limit.
- **One ring** of 76 red belt tiles carries every intermediate and finished item. An arm that adds an item works only while the ring holds fewer than that item's limit. Calcite for the lava foundries and a little stone for the brick furnace ride it too.
- **Inside the ring**: the circuit machine, the advanced circuit machine, U1 (an assembling machine 3 that makes inserter, fast inserter, bulk inserter and drill, one recipe at a time), the refined concrete machine and the brick furnace.
- **U2**, a foundry with lubricant on its ports, makes the three belt tiers and the foundry, one recipe at a time.
- **The buffer chest.** Everything that leaves U2 goes into a steel chest first, and one arm puts it on the ring item by item while the ring holds fewer than that item's limit (finished products: 8). Reason, measured: when U2 gives up a half-loaded foundry recipe it hands back some 150 ingredients at once; put straight on the ring they filled the lane, U2 could not be emptied, a foundry that cannot be emptied takes no new recipe, and the mall stood still. What lies in the chest still counts as stock for the rules.
- **Fluid ports.** A recipe with one fluid ingredient uses both input ports of a machine as one box, and a recipe change pushes what is left in a box out through any of its ports. So no machine here has two ports of one kind on the pipes of two fluids: the casting foundry gets its water through a pump standing directly on that port, and a pump lets nothing back.
- **List order.** Every rule shows a weight on one network; the highest weight in force sets the level (4 = express belts, 3 = inserters, 2 = electric mining drill, 1 = foundry). U1 and U2 are not given a recipe of a lower level while a higher level is in force. The level rises at once and falls only after 120 s without a higher rule.
- **Skip and return.** A rule is true only while its product is short and one craft's worth of every scarce ingredient is in sight; the belt rules also need lubricant in the tank. A product whose outside input is missing drops out of the level by itself and comes back when the input does.
- **The rocket fuel section** is the stand-alone rocket fuel supply (`blueprint-sources/vulcanus-supplies/rocket-fuel`) tile for tile: three refineries (simple coal liquefaction), two heavy oil crackers, three solid fuel plants handing straight to three assemblers. No rule and no level touches it. Its only link to the control is the cap: its chest and its four output arms read the caps combinator, so the arms stop when the chest holds its cap and the machines fill up behind them.

### The fuel section and the stand-alone rocket fuel blueprint

Same machines, same pipes, same coal belt, same panel figures (coal 352, calcite 71, sulfuric acid 880, water 1320 a minute). Three differences: the rocket fuel ends in a passive provider chest in the south-east corner instead of leaving on a belt; the four output arms stop at the cap; the water comes from this blueprint's one water entrance instead of the supply's own inlet on its north edge. **If you place this blueprint you do not need the stand-alone rocket fuel supply.**

### The priority rule, as built and as tested

Built: **strict sequencing by group**. While a group has a product below its cap that can be made, U1 and U2 are given no recipe of a lower group. The circuit machines, the casting foundry and the refined concrete machine are shared and are not gated; they only refill ring stock up to its limits.
Tested natively: in the fill from empty at the published caps every product of a group was at its cap before any product of the next group was. Rocket fuel is outside the rule by design.
Limits, stated plainly: (1) U1 or U2 finishes the one craft it has started before it obeys a higher level; (2) inside a group the order is the rule order per machine.

## Parts

Machines: 5 foundries, 9 assembling machines 3 (two of them shadows that never craft, three in the fuel section), 3 oil refineries, 5 chemical plants, 1 electric furnace. Control: 45 decider, 18 arithmetic, 4 selector and 5 constant combinators.
Bill of materials: 18 arithmetic-combinator, 9 assembling-machine-3, 20 bulk-inserter, 5 chemical-plant, 5 constant-combinator, 45 decider-combinator, 17 display-panel, 1 electric-furnace, 30 fast-inserter, 134 fast-transport-belt, 5 foundry, 3 oil-refinery, 5 passive-provider-chest, 78 pipe, 16 pipe-to-ground, 1 pump, 4 selector-combinator, 1 steel-chest, 1 storage-tank, 5 substation. Red belts and fast and bulk inserters only; hand sizes are pinned (fast 1, bulk 2), so it behaves the same whatever inserter capacity is researched.

Research needed (53 technologies in the closure), among them: foundry, calcite processing (simple coal liquefaction), advanced oil processing, rocket fuel, automation 3, logistics 3, bulk inserter, advanced combinators.

```
   0 sv.v.v.addddsdddddddddddddaaaaaa..
   1 sv!v!v!addddsdddddddddP!P!P!P!c!..
   2 .i.i.iddddaaaaddddddssicici.i.....
   3 >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>v
   4 ^AAAAAAdaAAAAAAKKKdAAAdddddAAAdddv
   5 ^AAAAAAdaAAAAAAKKKdAAAdddddAAAdddv
   6 ^AAAAAASSAAAAAAKKKaAAAdddSSAAAaaav
   7 ^bbbbbiSSbbbddci.iabubdddSS...aaav
   8 ^<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
   9 ....baa.iaaaa.i.i.b.b.i.bbbdd.bddc
  10 FFFFF.FFFFF.FFFFFdFFFFFdFFFFFbBddd
  11 FFFFF=FFFFF=FFFFFdFFFFFdFFFFFddddd
  12 FFFFF.FFFFF=FFFFF.FFFFFsFFFFFTTTa.
  13 FFFFF=FFFFF=FFFFF=FFFFFsFFFFFTTTa!
  14 FFFFF!FFFFF=FFFFF=FFFFF.FFFFFTTT==
  15 =======ubu==ddbdd===updd.=======.!
  16 <<<<<<<<<<<<<<<!....=p=uaaaaaa...u
  17 ================.==u===u=.......SS
  18 .!RRRRRRRRRRRRRRRuCCC.CCCCCC.AAASS
  19 ..RRRRRRRRRRRRRRR.CCC.CCCCCCiAAAiv
  20 ..RRRRRRRRRRRRRRR.CCC.CCCCCC.AAA!v
  21 ..RRRRRRRRRRRRRRR.=============..v
  22 !.RRRRRRRRRRRRRRR.CCC.AAACCC.AAA.v
  23 >v.iiiu.iiiu.iiiu.CCCiAAACCCiAAA.v
  24 .>>>>>>>>>>>>>>>..CCC.AAACCC.AAA>v
  25 >^..SSu....u....uuSS...i......i!^i
  26 !...SS============SS...>>>>>>>>>^P
```

F foundry · R oil refinery · A assembling machine 3 · C chemical plant · K furnace · T tank · p pump · S substation · P provider chest · > < ^ v belt · = pipe · u underground pipe · i fast · b bulk inserter · d a s c combinators · ! panel · B buffer chest

## Measured natively

Every figure below is from `native-report.json` (42 scenarios, each its own headless game on a Vulcanus surface from a fresh import of this string). **Full caps**: the fills from empty, the rate scenario and the rocket fuel scenarios. **Reduced caps** (a tenth of each cap, at least 2): refill, outage and recovery, hold, cap edits, single refills, the withheld-input scenarios and every fluid-safety scenario. A reduced-cap time is not a full-stack time.

### Fill from empty at the published caps: 179.8 minutes

| Product | Group | Cap | At its cap after (min) |
| --- | ---: | ---: | ---: |
| rocket-fuel | – | 200 | 17.0 |
| express-transport-belt | 1 | 100 | 21.4 |
| express-underground-belt | 1 | 50 | 46.2 |
| express-splitter | 1 | 50 | 92.1 |
| fast-inserter | 2 | 50 | 101.7 |
| bulk-inserter | 2 | 50 | 142.5 |
| electric-mining-drill | 3 | 50 | 153.3 |
| foundry | 4 | 20 | 179.8 |

Minutes each level was in force: express belts 93.8, inserters 50.5, electric mining drill 10.9, foundry 24.6.
Taken at the entrances: lava 265100, calcite 628, plastic-bar 1167, tungsten-carbide 725, lubricant 50420, water 56140, sulfuric-acid 21375, coal 7839, calcite-fuel 1632; stone left by the exit 7467.

### The mall part's fill time with and without the fuel section

| Condition | Mall part full after (min) |
| --- | ---: |
| Fuel section fills its own chest at the start, then stops (the fill above) | 179.8 |
| Fuel section never runs (coal withheld) | 179.8 |
| Rocket fuel taken out all the time for the first 60.0 minutes, entrances at panel figures | 179.8 |

### Rocket fuel: 12 a minute, thirty-minute windows, entrances at their panel figures

| Condition | Rocket fuel a minute | Coal | Calcite (fuel) | Sulfuric acid | Water | Mall products a minute in the same window |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Mall part full and idle | **12** | 352 | 70 | 880 | 1320 | none taken |
| Mall part filling from empty | **11.93** | 352 | 71 | 880 | 1321 | none taken |
| Every mall chest emptied every second as well | **12** | 352 | 70 | 880 | 1321 | express transport belt 6.83 |
| Only foundries and rocket fuel emptied (both use the water entrance) | **12.03** | 352 | 70 | 880 | 1987 | foundry 0.8 |

Each window follows a 30-minute warm-up under the same supply (after a long stop the pipes are full and the first minutes run above 12) and must show rocket fuel between 11.75 and 12.25 a minute. Coal, the fuel's calcite and sulfuric acid are supplied at exactly their panel figures; water at 1320 a minute while the mall part is idle and at the whole panel figure (2070) while it also draws. The inputs columns are what crossed each entrance in the window.
When the chest is not emptied it stops at exactly its cap (200) and the section stands still: in the one-hour hold no chest changed and no rocket fuel assembler crafted.

### Mall rates (full caps)

After a full fill, one group at a time has its products taken out of its chest every second (15 minutes warm-up, 30 measured) while the groups above it stay full. The first row empties every mall chest at once: with strict list order that only ever shows group 1. Entrances unrestricted.

| Measured window | Products a minute | lava | calcite | plastic | carbide | lubricant | water |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| every chest emptied | rocket fuel 12.63, express transport belt 6.63 | 950 | 1.9 | 0 | 0 | 143.3 | 1350 |
| group 2 (inserters) | fast inserter 6.6 | 1133 | 2.3 | 0 | 0 | 0 | 0 |
| group 3 (electric mining drill) | electric mining drill 6.13 | 2050 | 4.1 | 0 | 0 | 0 | 0 |
| group 4 (foundry) | foundry 0.9 | 2483 | 5 | 0 | 28.6 | 12 | 620 |

Inputs are what crossed each entrance per minute in the window. Water in these windows is the mall part alone (the fuel chest is full and its section stands still).

### Refilling one collected product (reduced caps)

| Product | Taken | Back at cap after (min) |
| --- | ---: | ---: |
| express-transport-belt | 10 | 2.7 |
| express-underground-belt | 5 | 1.5 |
| express-splitter | 5 | 5.4 |
| fast-inserter | 5 | 2.1 |
| bulk-inserter | 5 | 3.0 |
| electric-mining-drill | 5 | 2.8 |
| foundry | 2 | 3.9 |
| rocket-fuel | 20 | 1.1 |

In each of these no other chest changed.

### Refill, outage, hold, cap edits (reduced caps; the first fill of "fill" is at full caps)

| Scenario | Phase | Minutes | Ended by |
| --- | --- | ---: | --- |
| fill | fill from empty | 179.8 | every cap reached |
| fill | refill after complete collection | 18.7 | every cap reached |
| fill | five-minute outage of every input | 5.0 | fixed length |
| fill | recovery after the outage | 20.2 | every cap reached |
| hold | fill from empty | 43.8 | every cap reached |
| hold | settle at full stock | 10.0 | fixed length |
| hold | one-hour hold at full stock | 60.0 | fixed length |
| hold | refill after collection | 34.2 | every cap reached |
| caps | fill from empty | 43.8 | every cap reached |
| caps | caps raised | 5.7 | every cap reached |
| caps | caps lowered, those products collected | 2.9 | every cap reached |
| caps | caps restored | 4.5 | every cap reached |

### Hand-back: U2 part-loaded with the foundry recipe, then express belts taken (reduced caps, then full caps)

| Scenario | Phase | Minutes | Ended by |
| --- | --- | ---: | --- |
| handback:U2:foundry:foundry:tungsten-carbide:express-transport-belt | fill from empty | 43.8 | every cap reached |
| handback:U2:foundry:foundry:tungsten-carbide:express-transport-belt | foundry taken with tungsten-carbide cut; until U2 holds a part-loaded foundry | 0.0 | LIMIT |
| handback:U2:foundry:foundry:tungsten-carbide:express-transport-belt | express-transport-belt taken, tungsten-carbide still cut: U2 must drop foundry and refill express-transport-belt | 7.7 | every cap reached |
| handback:U2:foundry:foundry:tungsten-carbide:express-transport-belt | after tungsten-carbide returned | 2.9 | every cap reached |
| handback:U2:foundry:foundry:tungsten-carbide:express-transport-belt:10:full | fill from empty | 179.8 | every cap reached |
| handback:U2:foundry:foundry:tungsten-carbide:express-transport-belt:10:full | foundry taken with tungsten-carbide cut; until U2 holds a part-loaded foundry | 0.0 | LIMIT |
| handback:U2:foundry:foundry:tungsten-carbide:express-transport-belt:10:full | express-transport-belt taken, tungsten-carbide still cut: U2 must drop foundry and refill express-transport-belt | 22.0 | every cap reached |
| handback:U2:foundry:foundry:tungsten-carbide:express-transport-belt:10:full | after tungsten-carbide returned | 23.0 | every cap reached |

With tungsten carbide cut U2 cannot finish the foundry recipe; when express belts are taken it drops the recipe after its give-up time, hands what it holds into the buffer chest and refills the belts with the carbide still cut.

Hold: for one hour at full stock no chest changed (the rocket fuel chest included) and the final machines crafted 0 times.

### Skip and return, one entrance withheld from a cold start (reduced caps)

| Withheld | Products that need it | Everything else at its cap after (min) | After it returned: all at cap after (min) |
| --- | --- | ---: | ---: |
| plastic-bar | express splitter, bulk inserter | 21.9 | 11.1 |
| tungsten-carbide | foundry | 41.2 | 4.4 |
| lubricant | express transport belt, express underground belt, express splitter, foundry | 24.7 | 21.7 |
| water | foundry, rocket fuel | 39.0 | 6.8 |
| sulfuric-acid | rocket fuel | 45.7 | 2.3 |
| coal | rocket fuel | 45.7 | 2.4 |
| calcite-fuel | rocket fuel | 45.7 | 2.3 |
| calcite | express transport belt, express underground belt, express splitter, fast inserter, bulk inserter, electric mining drill, foundry | 4.3 | 49.2 |
| lava | express transport belt, express underground belt, express splitter, fast inserter, bulk inserter, electric mining drill, foundry | 4.3 | 42.6 |

In the withheld phase everything that does not need the entrance must reach and hold its cap for two minutes while the products that need it stay short; then the entrance returns and every cap must be reached. Coal, sulfuric acid or the fuel's calcite withheld stops only rocket fuel; lava or the mall part's calcite withheld stops only the mall part.

### Fluid safety (reduced caps)

In these, as in every other scenario, every fluid segment and the pump are read every tick and every machine fluid box every second.

| Scenario | What is done | Verdict | Foreign fluid | Afterwards |
| --- | --- | --- | --- | --- |
| ports | Port matrix: every recipe change of the two recipe-switching foundries, with each network on their ports full or empty | passed | none | 144 recipe changes, 0 put a fluid into another network |
| build:shuffle-1 | Built one entity every 20 ticks in a shuffled order, supply and power already connected (built in 2.2 min) | passed | none | every cap reached 32.7 min after |
| build:shuffle-2 | Same, second shuffle (built in 2.2 min) | passed | none | every cap reached 44.2 min after |
| build:shuffle-3 | Same, third shuffle (built in 2.2 min) | passed | none | every cap reached 47.1 min after |
| build:pipes-first | Built piecemeal, all pipes, tanks and pumps first (built in 2.2 min) | passed | none | every cap reached 43 min after |
| build:machines-first | Built piecemeal, machines and substations first (built in 2.2 min) | passed | none | every cap reached 44 min after |
| build:combinators-last | Built piecemeal, every combinator last (built in 2.2 min) | passed | none | every cap reached 41.7 min after |
| build:copper-foundry-last | Built piecemeal; the molten copper foundry arrives ten minutes after everything else (built in 12.2 min) | passed | none | every cap reached 25 min after |
| build:iron-foundry-last | Built piecemeal; the molten iron foundry arrives ten minutes after everything else (built in 12.2 min) | passed | none | every cap reached 27.6 min after |
| build:robots-25 | Built by 25 of the game's own construction robots from a ghost blueprint (built in 5 min) | passed | none | every cap reached 31.1 min after |
| build:robots-200 | Built by 200 construction robots from a ghost blueprint (built in 0.6 min) | passed | none | every cap reached 42.8 min after |
| late:power | Everything connected, no power for five minutes | passed | none | every cap reached 43.8 min after |
| late:stone-exit | Stone exit not connected for an hour (the stone belt fills), then connected | passed | none | every cap reached 16 min after |
| thin:lava | Lava at 100 a second for an hour (the two lava foundries take 250), then in full | passed | none | every cap reached 21.2 min after |
| thin:calcite | The mall part's calcite at 12 a minute for an hour (it takes up to 30), then in full | passed | none | every cap reached 36.4 min after |
| starve:supply | After a fill: every chest emptied and lava cut for ten minutes; then the same with the mall part's calcite | passed | none | every cap reached 12.6 min after |
| starve:foundry | After a fill: every chest emptied and the molten copper foundry stopped for fifteen minutes; then the same with the molten iron foundry | passed | none | every cap reached 22.6 min after |
| place:rot90 | Placed turned a quarter clockwise | passed | none | every cap reached 43.8 min after |
| place:rot180 | Placed turned a half | passed | none | every cap reached 43.8 min after |
| place:rot270 | Placed turned three quarters | passed | none | every cap reached 43.8 min after |
| place:flipH | Placed mirrored left to right | passed | none | every cap reached 43.8 min after |
| place:flipV | Placed mirrored top to bottom | passed | none | every cap reached 43.8 min after |

A mirror image is written by the test as its own string (positions and directions mirrored, the mirror flag toggled on foundries, refineries and chemical plants), because the game has no script call that flips a blueprint; the game's own flip key was not exercised. Turning is done by the game.

### Checks in every scenario

- Import: every entity at its position and direction, every recipe or circuit recipe control, every arm's hand size, filters and conditions, every combinator's parameters, every circuit net as one network with no two nets joined, one electric network.
- Chests: no chest ever held an item it does not declare (held in all).
- Fluids: every fluid segment and the pump read every tick, 10 readings a tick: no foreign fluid, ever (held in all). Every machine's fluid boxes read every second: none joined to the pipes of two fluids except through a pump (held in all).
- Recipes: every recipe-switching machine read every 10 ticks: it never held a recipe none of its rules asks for (held in all).
- Ring: peak 339 items against a bound of 432 (75% of both lanes); static lane limits inner 216, outer 98 of 288 per lane.

### Switching machines in the full fill

| Machine | Recipe changes | Time per recipe (min) |
| --- | ---: | --- |
| caster-C | 1124 | iron-ore-melting 118.9, casting-iron 21.4, casting-iron-gear-wheel 14.8, concrete-from-molten-iron 11.7, casting-steel 6.8, changing 5.9, casting-iron-stick 0.2 |
| U2 | 325 | iron-ore-melting 77.4, foundry 24.2, express-underground-belt 16.7, express-splitter 14.3, fast-splitter 9.6, express-transport-belt 9.6, fast-underground-belt 7.6, splitter 5.9, transport-belt 5.7, fast-transport-belt 4.9, underground-belt 2.4, changing 1.5 |
| U1 | 89 | wooden-chest 121.6, bulk-inserter 31.5, fast-inserter 10.5, electric-mining-drill 8.9, inserter 6.7, changing 0.6 |

"iron-ore-melting" and "wooden-chest" are the parking recipes: recipes the machine can never start, held while it has nothing to make.

### Against the big foundry mall, same products

The big mall reaches these products after its assembling machine 3 stack and its kit; here they are the whole list. Its measured full fill: express belts at cap after 234.7 min, foundries after 341.3 min, of which the first 150.7 min are assembling machine 3 and the kit. Here: express belts after 92.1 min, foundries after 179.8 min.

### Harness speed

Scenarios ran side by side at 470, 473, 473, 477, 479, 480, 480, 480, 481, 481, 482, 482, 483, 484, 487, 488, 488, 488, 489, 489, 491, 491, 492, 492, 495, 495, 495, 498, 499, 500, 501, 504, 504, 508, 508, 513, 517, 520, 525, 554, 693, 707 times real time; 881 s of wall time in all for 66.7 game hours.

## Bill from the recipes (expected values, productivity counted)

| Group | lava | calcite | plastic-bar | tungsten-carbide | lubricant | water | sulfuric-acid | coal | calcite-fuel | molten iron | molten copper | stone made | stone used |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 express belts | 48735 | 97 | 667 | 0 | 4667 | 0 | 0 | 0 | 0 | 29514 | 7037 | 1603 | 0 |
| 2 inserters | 28556 | 57 | 100 | 0 | 0 | 0 | 0 | 0 | 0 | 15333 | 6083 | 978 | 0 |
| 3 electric mining drill | 9000 | 18 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 6000 | 750 | 285 | 0 |
| 4 foundry | 26607 | 53 | 0 | 667 | 267 | 6222 | 0 | 0 | 0 | 17956 | 2000 | 838 | 356 |
| rocket fuel, 200 | 0 | 0 | 0 | 0 | 0 | 22000 | 14667 | 5867 | 1173 | 0 | 0 | 0 | 0 |
| **one full fill** | 112898 | 226 | 767 | 667 | 4933 | 28222 | 14667 | 5867 | 1173 | 68803 | 15870 | 3704 | 356 |

The measured fill takes more than this: the ring, the machines' input buffers, the pipes and the tank are filled as well, and both lava recipes run whenever either metal is short.

## Known limits

- One foundry casts all five iron products. It keeps up with this list; it would not keep up with the big mall's kit.
- U1 or U2 that has started loading a recipe keeps it until the craft is done; if the input it is waiting for never comes, it gives the recipe up after 15 minutes (U1) or 5 minutes (U2). U1 hands the loaded items back to the ring, U2 into its buffer chest.
- The buffer chest can hold intermediates for a long time when the ring is at its limits. They count as stock and are used first when the ring has room.
- There is no water tank: nothing in the control waits for water. With water missing the casting foundry may sit on the concrete recipe while nothing else is asked of it; plate, gear and stick still come first, and only foundries (and rocket fuel) need water.
- Tiny recipes can run one craft over their cap; the extra rides the ring or lies in the buffer chest and goes into the chest after the next collection.
- Collecting from a chest reopens that product's level; lower groups pause until it is full again. Rocket fuel is never paused by this.
- The rocket fuel section's figures hold with all three refineries fed: coal 352, calcite 71, sulfuric acid 880, water 1320 a minute.

## Reproduce

```
node scripts/requested-malls/foundry-belts-fuel-mall/generate.mjs      # writes this folder from the pinned prototypes
node scripts/requested-malls/foundry-belts-fuel-mall/audit.mjs         # static audit
node scripts/requested-malls/foundry-belts-fuel-mall/validate.mjs      # full native protocol (needs the game)
```

Static audit: passed, 60 checks. Prototypes pinned from a private `--dump-data` of Factorio 2.1.25. The validator and the harness are the foundry mall's (`scripts/requested-malls/foundry-mall/validate.mjs`, `control.lua`), pointed at this folder; the fuel section's ports are checked against the rocket fuel supply's measured port tables.

