# Vulcanus science · production and utility packs, 60 a minute each, from lava and calcite

Status: **qualified** (full native protocol, `native-report.json`, 29 scenarios). Blueprint SHA-256 `5a7706d13895ae4af78dc66a42c259cabed44a974bd45b086629d2db36442022`. Factorio 2.1.25 Space Age, Vulcanus, vanilla, normal quality, no modules, no beacons, every recipe fixed in the blueprint.

One blueprint for Vulcanus. Nine foundries turn lava and calcite into molten iron and molten copper; 32 more cast iron plate, copper plate, steel, gears, sticks, pipes, cable and low density structures; assembling machines 3 make electronic and advanced circuits, processing units, productivity modules, electric furnaces, rails, engines, electric engines and flying robot frames; chemical plants make batteries; electric furnaces make stone bricks. The two packs end in their own passive provider chests. It makes production (purple) and utility (yellow) science only: the other four packs stay with the six-pack design.

## What it makes

| Pack | Target | Measured, every port offered more than it takes | Measured, every port held to its panel figure | Chest |
| --- | ---: | ---: | ---: | --- |
| production-science-pack | 60/min | 60.00/min | 60.00/min | passive provider at tile (60, 16), 1,000 packs (five stacks, one rocket load) |
| utility-science-pack | 60/min | 60.00/min | 60.00/min | passive provider at tile (83, 80), 1,000 packs (five stacks, one rocket load) |

Measured over 30 minutes after a 15-minute warm-up from empty; the pass floor is 57 a minute. A governor beside each chest hands over exactly one pack a second, so the build draws what its panels say and no more. When both chests are full and nothing is collected, everything stops; it starts again when packs are taken.

## Size and machines

Footprint **91 × 103 = 9,373 tiles** (every entity counted), 3,178 entities. This is a large blueprint: nothing is brought in but plastic and two fluids, so all the smelting and all the circuits (1,560 electronic and 280 advanced circuits a minute) are made inside, without modules.

| Recipe | Machine | Needed at 60/min (recipe arithmetic) | Whole machines | Built |
| --- | --- | ---: | ---: | ---: |
| advanced-circuit | assembling-machine-3 | 22.40 | 23 | 24 |
| electronic-circuit | assembling-machine-3 | 10.40 | 11 | 12 |
| casting-copper-cable | foundry | 8.06 | 9 | 10 |
| casting-iron | foundry | 7.11 | 8 | 9 |
| production-science-pack | assembling-machine-3 | 5.60 | 6 | 6 |
| utility-science-pack | assembling-machine-3 | 5.60 | 6 | 6 |
| stone-brick | electric-furnace | 5.33 | 6 | 6 |
| processing-unit | assembling-machine-3 | 5.33 | 6 | 6 |
| flying-robot-frame | assembling-machine-3 | 5.33 | 6 | 6 |
| casting-steel | foundry | 4.80 | 5 | 6 |
| molten-iron-from-lava | foundry | 4.66 | 5 | 5 |
| productivity-module | assembling-machine-3 | 4.00 | 4 | 4 |
| molten-copper-from-lava | foundry | 3.54 | 4 | 4 |
| electric-engine-unit | assembling-machine-3 | 2.67 | 3 | 3 |
| engine-unit | assembling-machine-3 | 2.67 | 3 | 3 |
| battery | chemical-plant | 2.67 | 3 | 3 |
| casting-low-density-structure | foundry | 2.50 | 3 | 3 |
| rail | assembling-machine-3 | 2.00 | 2 | 3 |
| electric-furnace | assembling-machine-3 | 1.33 | 2 | 2 |
| casting-iron-stick | foundry | 0.21 | 1 | 1 |
| casting-copper | foundry | 0.18 | 1 | 1 |
| casting-pipe | foundry | 0.17 | 1 | 1 |
| casting-iron-gear-wheel | foundry | 0.06 | 1 | 1 |

The arithmetic counts the foundry's built-in +50% productivity on every casting recipe that allows it (not on pipes). In all: 41 foundries, 75 assembling machines 3, 3 chemical plants, 6 electric furnaces.

Spares, and why: casting-steel 6 (5), advanced-circuit 24 (23), electronic-circuit 12 (11), casting-iron 9 (8), casting-copper-cable 10 (9), rail 3 (2) (built, with the whole-machine count in brackets).
- casting-steel 6 for 4.80: three foundries feed the rail machines and three the furnace machines, each group on its own belt lane; five shared would have had 4% to spare.
- casting-iron 9 for 7.11: eight feed the circuit machines, one more stands beside the battery plants so that their plates do not ride the circuit belt.
- casting-copper-cable 10 for 8.06: eight hand cable straight to the circuit machines (two foundries for every three machines), two more feed the advanced-circuit rows.
- advanced-circuit 24 for 22.40, electronic-circuit 12 for 10.40, rail 3 for exactly 2.00: a machine that would have to run all the time is given a neighbour.
- productivity-module 4 for exactly 4.00, no spare, on purpose: a fifth machine took advanced circuits the electric-furnace machines needed for as long as it was filling its belt; in the native run of that five-machine version production science made 56.4 a minute in the measured ten minutes after a start without plastic. The four run all the time.

Other entities: 4 arithmetic combinator, 130 bulk inserter, 2 constant combinator, 2 decider combinator, 9 display panel, 4 express splitter, 688 express transport belt, 42 express underground belt, 136 fast inserter, 2 fast splitter, 1,086 fast transport belt, 30 fast underground belt, 90 long handed inserter, 2 passive provider chest, 714 pipe, 78 pipe to ground, 34 substation. Hand sizes are pinned (fast 1, bulk 2, long-handed 1), so the build behaves the same whatever inserter capacity is researched. Research needed: 52 technologies, among them foundry, automation 3, bulk inserter, logistics 3 (express belts), production and utility science.

## Ports

Tiles are counted from the blueprint's top-left tile (column, row). Every port has a panel beside it with the same figure.

| Port | What | Kind | Side | Tile | Panel figure | Recipe total at 60/min | Taken, offered more | Taken, held to the panel |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| IN-1 | lava | pipe | west | (0, 0) | 62,000/min | 61,511.1 | 61,683.3 | 61,363.4 |
| IN-2 | calcite | belt | west | (0, 8) | 124/min | 123.0 | 123.3 | 124.0 |
| IN-3 | plastic-bar | belt | north | (68, 0) | 760/min | 760.0 | 777.9 | 760.0 |
| IN-4 | sulfuric-acid | pipe | south | (47, 102) | 1,000/min | 1,000.0 | 929.3 | 1,000.0 |
| IN-5 | lubricant | pipe | south | (17, 102) | 300/min | 300.0 | 337.5 | 300.0 |
| OUT-STONE | stone (out) | belt | west | (0, 43) | 1,544/min | 1,544.0 | 1,496.4 | 1,494.7 |

- **Power**: connect the substation at tile (5, 33) (panel "POWER: connect this substation"). 34 substations power everything; with everything working the build draws about 132 MW for the machines alone.
- **Lava**: 61,511 a minute is 1,025 a second, about what one offshore pump gives (1,200 a second). **Calcite**: 123.0 a minute on a belt.
- **Stone** is a by-product of every lava craft: 2,244 a minute are made, the rails and the stone bricks use 700, and 1,544 a minute (25.7 a second) leave on the express belt of OUT-STONE. Take it away, for example into lava with several inserters. If that belt backs up, the lava foundries stop and so does everything else; it starts again when the belt moves.
- **Nothing else comes in**: no coal, no water, no stone, no plates, no circuits.

## Supplies it needs

- **Plastic bars**: 760 a minute. One copy of the coal to plastic bars and lubricant supply makes 60 plastic and 300 lubricant a minute (its own native report), so this build needs **13 copies** for the plastic (12.7 exactly). 560 of the plastic go into advanced circuits, 200 into low density structures.
- **Lubricant**: 300 a minute, for the electric engines: **1 copy** covers it. The 13 copies built for the plastic can make 3,900 lubricant a minute, far more than is used here; in that supply's own native test plastic kept coming at 60 a minute with its lubricant exit blocked, so the unused lubricant exits can be left closed.
- **Sulfuric acid**: 1,000 a minute (800 for batteries, 200 for processing units), from your own source.

## How it works

- **Lava foundries** (top row): lava comes in along the top, each foundry takes calcite from the belt under it and puts its stone on the stone belt; the molten metal goes down into two mains (iron row 10, copper row 12) and from there down the west edge and east to the circuit band.
- **Heads and bodies.** Each band has foundries at its west end, above and below one belt, so that each side loads its own lane (steel and sticks; steel and bricks; cable; iron and copper plate; gears and pipes). The machines of the band stand east of them along the same belt.
- **Production science**: three rail machines each stand between two pack machines and hand them the rails directly; electric furnaces and productivity modules arrive on one belt, a lane each.
- **Electronic circuits** (east column): cable foundries stand between the circuit machines and hand them cable directly, two foundries for three machines; iron plates run down the middle belt.
- **Advanced circuits**: two rows of twelve around one cable belt; circuits on the near belt, plastic on the far belt.
- **South strip**: engines and electric engines, low density structures, batteries, then processing units over utility science over frames.
- **Governors**: beside each chest a timer adds one a tick; the chest arm runs while it shows 60 ticks more than the start delay, and every pack it lifts takes 60 off. One pack a second, 60 a minute. Nothing is handed over for the first 10 minutes after the governors get power, so belts and machines fill first; after a pause at most 10 extra packs follow. These eight combinators are the only circuits; no machine has a circuit connection.
- **Fluids**: one fluid per pipe network. A foundry with a one-fluid recipe takes that fluid on both of its input ports (the game joins them), so no port is left to meet a wrong pipe; the low density structure foundries take iron on one port from a pipe and copper on the other through a pipe-to-ground that passes under the iron main.

## Measured natively

Every figure below is from `native-report.json`: 29 scenarios, each its own headless game on a Vulcanus surface from a fresh import of this string, with only the technology closure researched. Rates are production / utility packs a minute taken from the chests.

### Full-length runs

| Scenario | Result |
| --- | --- |
| Every port offered more than it takes | 60.00 / 60.00 over 30 minutes after 15 minutes from empty |
| Every port held to exactly its panel figure | 60.00 / 60.00 over 30 minutes after 15 minutes from empty |
| Chests not emptied | both chests at exactly 1000 and 1000 and the pack machines still after 24.0 minutes; 10 minutes held with 0 and 0 pack crafts; after release 60.00 / 60.00 (minutes 10 to 20) |
| Every input cut for 5 minutes | during the outage 31.40 / 60.00; afterwards 60.00 / 60.00 (minutes 10 to 20 after supply returned) |
| Stone exit blocked | pack machines still after 10.5 minutes; 0 and 0 pack crafts in the next 5 minutes; after release 60.00 / 60.00 (minutes 20 to 30) |

### Shortened runs

Each of these ends with 10 minutes measured (not 30). Staged builds and turned placements run 25 minutes first. A withheld-input start runs, once the input is supplied, until both packs have kept the floor of 57 a minute for ten minutes (the time that took is in the table), and is then measured for 10 more.

| Scenario | Start | Rate over the measured 10 minutes | Foreign fluid |
| --- | --- | ---: | ---: |
| single:production-science-pack | only the production-science-pack chest emptied, the other left to fill (1000 packs in it at the end) | 60.00 (the emptied pack) | 0 |
| single:utility-science-pack | only the utility-science-pack chest emptied, the other left to fill (1000 packs in it at the end) | 60.00 (the emptied pack) | 0 |
| withheld:lava | cold start with lava withheld for 20 minutes (production 0.0, utility 0.0 a minute meanwhile), then supplied: both packs at the floor for ten minutes 21.3 minutes later | 60.00 / 60.00 | 0 |
| withheld:calcite | cold start with calcite withheld for 20 minutes (production 0.0, utility 0.0 a minute meanwhile), then supplied: both packs at the floor for ten minutes 20.7 minutes later | 60.00 / 60.00 | 0 |
| withheld:plastic-bar | cold start with plastic-bar withheld for 20 minutes (production 0.0, utility 0.0 a minute meanwhile), then supplied: both packs at the floor for ten minutes 14.6 minutes later | 60.00 / 60.00 | 0 |
| withheld:sulfuric-acid | cold start with sulfuric-acid withheld for 20 minutes (production 30.0, utility 0.0 a minute meanwhile), then supplied: both packs at the floor for ten minutes 10.6 minutes later | 60.00 / 60.00 | 0 |
| withheld:lubricant | cold start with lubricant withheld for 20 minutes (production 30.0, utility 0.0 a minute meanwhile), then supplied: both packs at the floor for ten minutes 10.6 minutes later | 60.00 / 60.00 | 0 |
| build:shuffle-1:live | built 3 entities every 6 ticks, order shuffle-1 (complete after 106.0 s), power and every input live from the first tick | 60.00 / 60.00 | 0 |
| build:shuffle-1:late | built 3 entities every 6 ticks, order shuffle-1 (complete after 106.0 s), supplies connected a minute after the last entity | 60.00 / 60.00 | 0 |
| build:shuffle-2:live | built 3 entities every 6 ticks, order shuffle-2 (complete after 106.0 s), power and every input live from the first tick | 60.00 / 60.00 | 0 |
| build:shuffle-2:late | built 3 entities every 6 ticks, order shuffle-2 (complete after 106.0 s), supplies connected a minute after the last entity | 60.00 / 60.00 | 0 |
| build:shuffle-3:live | built 3 entities every 6 ticks, order shuffle-3 (complete after 106.0 s), power and every input live from the first tick | 60.00 / 60.00 | 0 |
| build:shuffle-3:late | built 3 entities every 6 ticks, order shuffle-3 (complete after 106.0 s), supplies connected a minute after the last entity | 60.00 / 60.00 | 0 |
| build:pipes-first:live | built 3 entities every 6 ticks, order pipes-first (complete after 106.0 s), power and every input live from the first tick | 60.00 / 60.00 | 0 |
| build:pipes-first:late | built 3 entities every 6 ticks, order pipes-first (complete after 106.0 s), supplies connected a minute after the last entity | 60.00 / 60.00 | 0 |
| build:machines-first:live | built 3 entities every 6 ticks, order machines-first (complete after 106.0 s), power and every input live from the first tick | 60.00 / 60.00 | 0 |
| build:machines-first:late | built 3 entities every 6 ticks, order machines-first (complete after 106.0 s), supplies connected a minute after the last entity | 60.00 / 60.00 | 0 |
| build:foundries-last:live | built 3 entities every 6 ticks, order foundries-last (complete after 106.0 s), power and every input live from the first tick | 60.00 / 60.00 | 0 |
| build:foundries-last:late | built 3 entities every 6 ticks, order foundries-last (complete after 106.0 s), supplies connected a minute after the last entity | 60.00 / 60.00 | 0 |
| orient:east | placed east (the game's own rotation of this string) | 60.00 / 60.00 | 0 |
| orient:south | placed south (the game's own rotation of this string) | 60.00 / 60.00 | 0 |
| orient:west | placed west (the game's own rotation of this string) | 60.00 / 60.00 | 0 |
| orient:flip-horizontal | placed flipped horizontal (a flipped copy of the string, see below) | 60.00 / 60.00 | 0 |
| orient:flip-vertical | placed flipped vertical (a flipped copy of the string, see below) | 60.00 / 60.00 | 0 |

**Fluid watch**: in every scenario every pipe network and every machine was checked every 5 ticks (while a staged build is going up: every pipe, pipe-to-ground and machine one by one; afterwards one pipe of each network and every machine, and every entity one by one every 600 ticks). 829,620 sweeps in all, **0 foreign fluids found**. At import the harness also checks that every machine port joins a pipe of exactly its own fluid or nothing.

**Flips**: the headless game has no player cursor to flip a blueprint with. The two flipped placements are copies of the string turned over by the game's own rule for each entity (`LuaEntity.flip`, recorded in `fluid-slots.json` by a native probe), imported and run like the others; their strings differ from the published one (`placedSha256` in the report). The three rotations are the game's own `build_blueprint` rotation of the published string.

Harness speed: about 272 times real time per game; 1 minutes of wall time for 19.2 game hours.

## Good to know

- The first packs reach the chests 10 minutes after the substations get power, whatever else is ready. From then on it is one pack of each kind a second.
- Take the stone away: 1,544 a minute leave on one express belt on the west edge. A blocked stone belt stops the whole build (measured above).
- Both packs share the lava foundries, the stone belt, the circuit column and the plastic. If only one chest is emptied, that pack keeps its rate and the other line stops with its chest full (measured above, 35 minutes each way).
- Belts are fast (red) and express (blue) as placed; do not swap the blue ones for red: the stone belt, the plate belt and the circuit belts carry more than a red lane holds.
- It can be placed in any of the four rotations and flipped on either axis (measured above). Leave the tile beyond each port free for your own belt or pipe.
- The electric furnaces that make stone bricks have no recipe to set: a furnace smelts what it is given, and they are given only stone.

## Layout

```
=====================================================..............!v.....===============..
!.....##IIIIIIIIIIIIIIIIIIIIIIIIICCCCCCCCCCCCCCCCCCCC...............v.....=ppppp.v.ppppp=..
......##IIIIIIIIIIIIIIIIIIIIIIIIICCCCCCCCCCCCCCCCCCCC...............v.....=pppppbvbppppp=..
........IIIIIIIIIIIIIIIIIIIIIIIIICCCCCCCCCCCCCCCCCCCC...............v.....=ppppp.v.ppppp=..
........IIIIIIIIIIIIIIIIIIIIIIIIICCCCCCCCCCCCCCCCCCCC...............v.....=pppppbvbppppp=..
........IIIIIIIIIIIIIIIIIIIIIIIIICCCCCCCCCCCCCCCCCCCC...............v..##.=ppppp.v.ppppp=##
........bnl.bbnl.bbnl.bbnl.bbnl.bbnl.bbnl.bbnl.bbnl.b...............v..##.=ppppp.v.ppppp=##
......v<<<<<<<<<<<<<<<<<<<<<<<<<<>>>>>>>>>>>>>>>>>>>>>>>>>>>>v......v.....=pppppbvbppppp=..
>>>>>(v)>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>........v<<####v.....=ppppp.v.ppppp=..
!.....>>(u)>>(u)>>(u)>>(u)>>(u)>>>>>>>>>>>>>>>>>>>>>>>>>>>>>(v)^####(.....=pppppbvbppppp=..
..==========================================================wve============ppppp.v.ppppp=..
..=...............................u....u....u....u...........v............=ppppp.v.ppppp=..
..=.========================================================wve==========.=pppppbvbppppp=..
..=.=...................##.................##................v......)...=.=ppppp.v.ppppp=..
..=w=e================..##.................##................v......v...=.=pppppbvbppppp=..
..=.=.##sssssssssssssss.....................................!v......v...=.=ppppp.v.ppppp=..
..=.=.##sssssssssssssss..................................ddd$v......v...=.=ppppp.v.ppppp=..
..=.=.##sssssssssssssss.........##................##.....dddiv......v...=.=pppppbvbppppp=..
..=.=.##sssssssssssssss.........##................##.......d^v......v...=.=ppppp.v.ppppp=..
..=.=...sssssssssssssss.....................................^v......v...=.=pppppbvbppppp=..
..=.=.....b....b....b......>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>^v......v...=..ppppp.v.ppppp...
..=.=...>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>.v......v...========wve========
..=.=....##...b.b...........l..b.b..l..l..b.b..l..l..b.b..l..v......v...=..v.GGG.v.GGG.v..=
..=.=....##..ttttt.........PPP.rrr.PPPPPP.rrr.PPPPPP.rrr.PPP.v......v...=..vbGGGbvbGGGbv..=
..=.=........ttttt.........PPPbrrrbPPPPPPbrrrbPPPPPPbrrrbPPP.v......v...=##v.GGG.v.GGG.v..=
..=.=........ttttt.........PPP.rrr.PPPPPP.rrr.PPPPPP.rrr.PPP.v......v...=##v.b.b.v.b.b.v..=
..=.=........ttttt..........l...b...l..l...b...l..l...b...l..v......v...=..(cccccvccccc(..=
..=.=........ttttt........v<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<......v.##====cccccvccccc====
..=w=e===========.........v.<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<.....v.##..=)cccccvccccc)=##
..=.=.....................v...................................^.....v.....=vcccccvcccccv=##
..=w=e================....v...................................^.....v.....=vcccccvcccccv=..
..=.=...sssssssssssssss...v...................................^.....v.....=v.b.b.v.b.b.v=..
..=.=...sssssssssssssss...v...................................^.....v.....=v.GGG.v.GGG.v=..
..=.=##!sssssssssssssss##.v...................................^.....v.....=vbGGGbvbGGGbv=..
..=.=##.sssssssssssssss##.v...................................^.....v.....=v.GGG.v.GGG.v=..
..=.=...sssssssssssssss...v...................................^.....v.....=v.b.b.v.b.b.v=..
..=.=...b.b....b....b.....v...................................^.....v.....=(cccccvccccc(=..
..=.=..v<>>>>>>>>>>>>>>>>(v)>>>>>>>##.........................^.....v.....==cccccvccccc==..
..=.=..v.i..i..i..i..i..i.v..b.bb.b##.........................^.....v.....=)cccccvccccc)=..
..=.=..vKKKKKKKKKKKKKKKKKKv..FFFFFF...........................^.....v.....=vcccccvcccccv=..
..=.=..vKKKKKKKKKKKKKKKKKKv..FFFFFF##.........................^.....v.....=vcccccvcccccv=..
..=.=..vKKKKKKKKKKKKKKKKKKv..FFFFFF##.........................^.....v.....=v.b.b.v.b.b.v=..
..=.=..(.i..i..i..i..i..i.v..i.li.l...........................^.....v.....=v.GGG.v.GGG.v=..
<)=.=(<<<<<<<<<<<<<<<<<<<<<>>>>>>>>...........................^.....v.....=vbGGGbvbGGGbv=..
!.=.=..)...................^.>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>^.....v.....=v.GGG.v.GGG.v=..
..=.=..v...................^..i..i..i..i............................v.....=v.GGG.v.GGG.v=..
..=.=..v...................^.MMMMMMMMMMMM...........................v.....=vbGGGbvbGGGbv=..
..=.=..v...................^.MMMMMMMMMMMM...........................v.....=v.GGG.v.GGG.v=..
..=.=..v...................^.MMMMMMMMMMMM...........................v.....=v.b.b.v.b.b.v=..
..=.=..v...................^.i.li.li.li.l...........................v...##=(cccccvccccc(=##
..=.=..v...................^.<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<)v(<<##==cccccvccccc==##
..=.=..v...................^<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<.%%.^..=)cccccvccccc)=..
..=.=..v.v<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<)^(<v.^..=vcccccvcccccv=..
..=.==wv.ve============.>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>.^##v.^..=vcccccvcccccv=..
..=.=..v.v.........ccccc^i.li.li.l..i.li.li.li.li.l..i.li.li.li.l.^##v.^..=v.b.b.v.b.b.v=..
..=.=..(.v.........ccccc^RRRRRRRRR..RRRRRRRRRRRRRRR..RRRRRRRRRRRR.^..v.^..=v.GGG.v.GGG.v=..
..=.=.v<<<.........ccccc^RRRRRRRRR..RRRRRRRRRRRRRRR..RRRRRRRRRRRR.^..v.^..=vbGGGbvbGGGbv=..
..=.=.v)........##.ccccc^RRRRRRRRR##RRRRRRRRRRRRRRR##RRRRRRRRRRRR.^..v.^..=v.GGG.v.GGG.v=..
..=.=.vv........##.ccccc^i.li.li.l##i.li.li.li.li.l##i.li.li.li.l.^..v.^..=v.b.b.v.b.b.v=..
..=.=.vv...........b.b.b)>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>^..v.^..=(cccccvccccc(=..
..=.=.vv...........>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>.^..v.^..==cccccvccccc==..
..=.=.vv...........b.b.b(>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>%^..v.^...)cccccvccccc)...
..=.=.vv...........ccccc^i.li.li.l..i.li.li.li.li.l..i.li.li.li.l%v..v.^...vcccccvcccccv...
..=.=.vv...........ccccc^RRRRRRRRR..RRRRRRRRRRRRRRR..RRRRRRRRRRRR.v..v.^...vcccccvcccccv...
..=.=.vv...........ccccc^RRRRRRRRR..RRRRRRRRRRRRRRR..RRRRRRRRRRRR.v..v.^...v.b.b.v.b.b.v...
..=.=.vv...........ccccc^RRRRRRRRR..RRRRRRRRRRRRRRR..RRRRRRRRRRRR.v..v.^...v.GGG.v.GGG.v...
..=.=.vv...........ccccc^i.li.li.l..i.li.li.li.li.l..i.li.li.li.l.v..v.^...vbGGGbvbGGGbv...
..=.=wvve==============.^>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>.(..v.^...v.GGG.v.GGG.v...
..=.=.vv................%%<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<.^...v.##........v...
..=.=.vv................^<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<..^%..%%##........v...
..=.=wvve=================================.............##.........).^<<<%<<<>>>>>>>>>>(v)v.
..=...vv..................n....n....n....n.............##.........>>>>>>>>>>>>>>>>>v...v.v.
..=w..vve======================================..........=======================.v)v(<<<.v.
..=...vv.=.=..............u.=..u.=..u.=..u.=.=...........=....n..n..n....n..n..n.v.v.....v.
..=...vvggggg............LLLLLLLLLLLLLLL.=ppppp..........=...<<<<<<<<<<<<<<<<<<<<<.v.....v.
..=...vvggggg............LLLLLLLLLLLLLLL.=ppppp===========...buibuibui..buibuibui^.v.....v.
..=...vvggggg##..........LLLLLLLLLLLLLLL.=ppppp=BBBBBBBBB....UUUUUUUUU..UUUUUUUUU^<<.....v.
..=...vvggggg##..........LLLLLLLLLLLLLLL.=ppppp=BBBBBBBBB....UUUUUUUUU..UUUUUUUUU........v.
..=...vvggggg............LLLLLLLLLLLLLLL.=ppppp=BBBBBBBBB....UUUUUUUUU..UUUUUUUUU........v.
..=...v>(i)>>>>>>>>>>>v...i.l..i.l..i.l..=..i..ni.li.li.l.....i..i..i....i..i..i...!.....v.
..=...v.>>>>>>>>>>>>>.v..<<<<<<<<<<<<<<<<=>>>>>>>>>>>>>>>....>>>>>>>>>>>>>>>>>>>>>i$d....v.
..=...v...i..i.li.li.lv..>>>>>>>>>>>>>>v^=..i..u>>>>>>>>>v...i.ii.ii.i..i.ii.ii.i.ddd....v.
..=...v.jjjjjEEEEEEEEEv##..........##..v^=qqqqq=....##...v...YYYYYYYYY##YYYYYYYYY.ddd##..v.
..=...v.jjjjjEEEEEEEEEv##..........##..v^=qqqqq=....##...v...YYYYYYYYY##YYYYYYYYY....##..v.
..=...v.jjjjjEEEEEEEEEv................v^=qqqqq=.........v...YYYYYYYYY..YYYYYYYYY........v.
..=...v.jjjjj.i..i..i.(................v^=qqqqq=.........v....i..i..i....i..i..i.........v.
..=...v.jjjjj<<<<<<<<<<<...............v^.qqqqq=.........v.>>>>>>>>>>>>>>>>>>>>>>........v.
..=w..ve====..i..i..i.)^...............v^......=.........v.^..i..i..i....i..i..i.........v.
......v##....XXXXXXXXXv^...............v)......n.........(.^.ZZZZZZZZZ..ZZZZZZZZZ........v.
......v##....XXXXXXXXXv^...............>>>>>>>>>>>>>>>>>>>>^.ZZZZZZZZZ..ZZZZZZZZZ........%%
......v......XXXXXXXXXv^................(......u.........)...ZZZZZZZZZ..ZZZZZZZZZ........vv
......v......in.in.in.()................^......n.........v...i.li.li.l..i.li.li.lv<<<<<<<<v
......v......>>>>>>>>>>>>>>>>>>>>>>>>>>(^)>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>.v........v
......v.......u..u..u.)(................^......u.............<<<<<<<<<<<<<<<<<<<<<........v
......v.......=======.v^................^......=.................................^........v
......v..........=....v^................^......n.................................)........v
......v..........=....v^<<<<<<<<<<<<<<<)^(<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
......v..........n....(.................^......u.................................(.........
......>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>^......=.................................^.........
.................u....)........................n.................................^.........
.................=....>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>^.........
.................=.............................u...........................................
................!=............................!=...........................................
```

`I` `C` lava foundries (molten iron, molten copper) · `p` iron plate · `q` copper plate · `s` steel · `t` iron stick · `g` gear · `j` pipe · `c` copper cable · `L` low density structure (foundries, 5 × 5) · `G` electronic circuit · `R` advanced circuit · `U` processing unit · `M` productivity module · `F` electric furnace (the item) · `r` rail · `P` production science · `Y` utility science · `Z` flying robot frame · `E` engine · `X` electric engine (assembling machines 3, 3 × 3) · `B` battery (chemical plant) · `K` brick furnace · `#` substation · `$` provider chest · `!` panel · `d` combinator · `^ > v <` belt · `( )` underground belt in and out · `%` splitter · `=` pipe · `n e u w` pipe-to-ground (the letter is the side its mouth faces: north, east, south = u, west) · `i` fast, `b` bulk, `l` long-handed inserter

## Reproduce

```
node scripts/vulcanus-science/production-utility-science/generate.mjs          # blueprint, manifest, ports, audit, README
node scripts/vulcanus-science/production-utility-science/validate.mjs          # the full native protocol (needs the game)
node scripts/vulcanus-science/production-utility-science/probes/fluid-slots.mjs # the fluid ports and flip rule, read from the game
node --test tests/vulcanus-science.test.mjs                                    # no game needed
```

Static audit: passed, 25 checks (`static-audit.json`). Arm rates and what a machine holds before it stops: `scripts/vulcanus-science/production-utility-science/rates.json` (native probe).
