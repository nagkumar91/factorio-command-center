# Processing units from lava · 60 a minute

**Qualified** in Factorio 2.1.25 Space Age on a Vulcanus surface, for the exact string in `blueprint.txt` (SHA-256 `73537b41a56f3086172e57b46408e418cbe4ee49d27a2ec3d42c2ae46408735f`). All 24 scenarios of the native protocol passed. Measured over 30 minutes: **59.97 processing units a minute** with every entrance offered exactly its panel figure, 70 with every entrance offered more. Target 60, pass floor 57 (95%). Report: `native-report.json`.

Turns lava, calcite, plastic bars and sulfuric acid into processing units (blue circuits) on one belt, 60 a minute. Foundries melt the lava and cast iron plates and copper cable; the electronic and advanced circuits the recipe needs are made inside. A rocket needs 50 processing units (1 in each of its 50 parts), so this makes one rocket's worth in 50 seconds; the rocket's low density structures and fuel are not part of it. Vanilla Space Age, normal quality, no modules, no beacons, no circuit network, no robots inside. Every machine has its recipe saved in the blueprint.

## Size and machines

- Footprint **137 × 13 = 1,781 tiles**, counting every entity (625): 36 assembling machine 3, 92 bulk inserter, 7 display panel, 163 express transport belt, 28 express underground belt, 48 fast inserter, 17 fast transport belt, 16 fast underground belt, 20 foundry, 121 pipe, 30 pipe to ground, 11 substation, 20 transport belt, 16 underground belt.
- Machines: **20 foundries and 36 assembling machines 3**.

| Machine | Count | Needed at the target | One machine does (crafts a minute) | Why this count |
| --- | ---: | ---: | ---: | --- |
| lava foundry, molten copper | 2 | 1.42 | 15 | 1.42 needed |
| lava foundry, molten iron | 2 | 1.71 | 15 | 1.71 needed |
| foundry, iron plate | 8 | 6.4 | 75 | 6.4 needed, so seven would do; the eighth is a spare that keeps the plate foundries in pairs above and below the belt |
| foundry, copper cable | 8 | 6.67 | 240 | 6.67 needed, so seven would do; the eighth is a spare that keeps the two bands alike |
| assembling machine 3, electronic circuit | 14 | 9.6 | 150 | 9.6 needed; a cable foundry hands its cable to the machines beside it, and seven of the eight foundries have two, one has one and a cable tap |
| assembling machine 3, advanced circuit | 12 | 9.6 | 12.5 | 9.6 needed; they stand in pairs above and below the belt, so twelve |
| assembling machine 3, processing unit | 10 | 8 | 7.5 | exactly 8 needed; nine is the first count with a reserve, the tenth keeps the two bands alike |

Every foundry has a built-in productivity of 50% (it gives 1.5 times the products of each craft, stone included); the counts above include it. Recipes, craft times, speeds (foundry 4, assembling machine 3 1.25) and that productivity are read from the game's own data (pinned in `scripts/vulcanus-circuits/prototypes.json`) and compared with the running game in every test.

At 60 processing units a minute: 1,440 electronic circuits (1,200 for the processing units, 240 for the advanced circuits), 120 advanced circuits, 240 plastic bars, 300 sulfuric acid, 4,800 copper cable and 1,440 iron plates a minute; 9,600 molten iron and 8,000 molten copper from 46.9 lava crafts a minute: 23,467 lava and 46.9 calcite in, 864 stone out.

## Layout

```
    0         1         2         3         4         5         6         7         8         9         0         1         2         3      
    01234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456
  0 ....CCCCC.CCCCC...PPPPPPPPPP.PPPPPPPPPP.>>>uKKKKKo>>>>>>uKKKKKo>>>>>>uKKKKKo>>>>>>uKKKKKo>>>>>>>>>>>>>>>>>>>>>>>>uvo>>>>>>>>>>>>>>>>>....
  1 ...=CCCCC=CCCCC=.=PPPPPPPPPP=PPPPPPPPPP=.b..KKKKK..b..b..KKKKK..b..b..KKKKK..b..b..KKKKK.^.b....b..b..b..b....b..!v.b.=w.b..be=w.b..be===
  2 !..=CCCCC=CCCCC=.=PPPPPPPPPP=PPPPPPPPPP=GGG.KKKKK.GGGGGG.KKKKK.GGGGGG.KKKKK.GGGGGG.KKKKK.^RRR##RRRRRRRRRRRR##RRR..vBBB=.BBBBBB=.BBBBBB=.!
  3 ====CCCCC=CCCCC=.=PPPPPPPPPP=PPPPPPPPPP=GGGbKKKKKbGGGGGGbKKKKKbGGGGGGbKKKKKbGGGGGGbKKKKKb^RRR##RRRRRRRRRRRR##RRR..vBBB==BBBBBB==BBBBBB=..
  4 ...=CCCCC=CCCCC=.=PPPPPPPPPP=PPPPPPPPPP=GGGbKKKKKbGGGGGGbKKKKKbGGGGGGbKKKKKbGGGGGGbKKKKK..RRR..RRRRRRRRRRRR..RRR..vBBB##BBBBBB##BBBBBB=..
  5 !..=.i..b=wi.b.=.=##ewb..b..=##ewb..bew=.b##e===w..b..b##e===w..b..b##e===w..b..b##e===...i.i..i.ii.ii.ii.i..i.i..vi.i##i.ii.i##i.ii.i=..
  6 >>u=wouv<<oou<e=.=##..>>>>>u=##o>>>>>>u=ou##..=o>>>>>>u##..=o>>>>>>u##..=o>>>>>>>##..=....>u<<<oo>>uuoo>>uu<<oo>uu<>uo>>uo>>uo>>uo>>uo=o>
  7 <<o=.iu<b=wi.b.=e=w...b..b.e=w...b..b.e=.b...==....b..b...==....b..b...==....b..b...==....i.i..i.ii.ii.ii.i..i.i...i.i..i.ii.i..i.ii.i=.!
  8 !..=IIIII=IIIII=.=PPPPPPPPPP=PPPPPPPPPP=GGGbKKKKKbGGGGGGbKKKKKbGGGGGGbKKKKKbGGGGGGbKKKKK..RRR..RRRRRRRRRRRR..RRR...BBB..BBBBBB..BBBBBB=..
  9 !##=IIIII=IIIII=.=PPPPPPPPPP=PPPPPPPPPP=GGGbKKKKKbGGGGGGbKKKKKbGGGGGGbKKKKKbGGGGGGbKKKKKbvRRR..RRRRRRRRRRRR..RRR...BBB==BBBBBB==BBBBBB=..
 10 .##=IIIII=IIIII=.=PPPPPPPPPP=PPPPPPPPPP=GGG.KKKKK.GGGGGG.KKKKK.GGGGGG.KKKKK.GGGGGG.KKKKK.vRRR..RRRRRRRRRRRR..RRR...BBB=.BBBBBB=.BBBBBB=..
 11 ...=IIIII=IIIII=.=PPPPPPPPPP=PPPPPPPPPP=.b..KKKKK..b..b..KKKKK..b..b..KKKKK..b..b..KKKKK.v.b....b..b..b..b....b.....b.=w.b..be=w.b..be=..
 12 ....IIIII.IIIII...PPPPPPPPPP.PPPPPPPPPP.>>>uKKKKKo>>>>>>uKKKKKo>>>>>>uKKKKKo>>>>>>uKKKKKo>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>....
```

`C` lava foundry (molten copper), `I` lava foundry (molten iron), `P` foundry casting iron plate, `K` foundry casting copper cable, `G` assembling machine 3 (electronic circuit), `R` assembling machine 3 (advanced circuit), `B` assembling machine 3 (processing unit), `#` substation, `!` display panel, `=` pipe, `n e s w` pipe-to-ground (the letter is the side of its open end; its underground runs the other way), `^ > v <` belt (the way it runs), `u`/`o` underground belt in/out, `b` bulk inserter, `i` fast inserter, `l` long-handed inserter. Columns count from the west edge and rows from the north edge, both from 0.

A drawing of the same is in `layout.svg`.

## Entrances, exits, power

Tiles are counted from the blueprint's top-left tile (column, row). Every port has a display panel beside it with the item, `IN:` or `OUT:` and the per-minute figure.

| Port | What | Kind | Tile | Side | Panel figure | Took, offered exactly the panel figure | Took, offered more |
| --- | --- | --- | --- | --- | ---: | ---: | ---: |
| IN-1 | lava | pipe | (0, 3) | west | 23,470/min | 23,470.0/min | 27,533.3/min |
| IN-2 | calcite | belt | (0, 6) | west | 47/min | 47.0/min | 55.1/min |
| IN-3 | plastic-bar | belt | (114, 0) | north | 240/min | 240.0/min | 287.4/min |
| IN-4 | sulfuric-acid | pipe | (136, 1) | east | 300/min | 300.0/min | 350.2/min |

| Exit | What | Kind | Tile | Side | Panel figure | Gave, entrances at the panel figures | Gave, entrances offered more |
| --- | --- | --- | --- | --- | ---: | ---: | ---: |
| OUT-1 | processing-unit | belt | (136, 6) | east | 60/min | 59.97/min | 70/min |
| OUT-STONE | stone | belt | (0, 7) | west | 864/min | 864.17/min | 1,014.67/min |

- **Product exit**: a yellow belt carries 900 a minute; the top machines load one lane and the bottom machines the other, 30 a minute a lane at the target. In the measured half hour the two lanes carried 907 and 892 items. When nothing takes the product the belts fill, every machine stops with its output full, and it all starts again when the belt moves.
- **Stone** is a by-product of every lava craft and nothing here uses it. It leaves on the belt at (0, 7) and **must be carried away** (for example to an arm that drops it into lava). If that belt cannot move, the lava foundries stop with their output full, the molten metal runs out and everything stops; nothing is harmed and it carries on when the belt moves again.
- **Power**: connect the substation at tiles (1–2, 9–10), marked by the panel `POWER: connect this substation`. 11 substations power everything and are wired to each other. The machines' rated draw adds up to 63.5 MW; measured average at the target 56.5 MW, and 19.9 MW averaged over the fifteen minutes with the product exit blocked (running down, then standing still).
- **Plastic**: 240 bars a minute at the target (two for each of the 120 advanced circuits). The coal-to-plastic blueprint (`vulcanus-supplies/coal-plastic-lubricant`) gives 60 a minute a copy, so this needs **4 copies** of it (or any other source of 240 a minute).
- **Sulfuric acid**: 300 a minute at the target, five per processing unit. On Vulcanus acid comes from the acid geysers; this draw is small beside what the plastic copies take (each copy of the coal-to-plastic blueprint is labelled 750 a minute).

## How it works

- **Lava block** (west, columns 0 to 16). Four lava foundries: molten copper in the top row, molten iron in the bottom row, with the lava columns (3 and 15) outside them and the metal column (9) between them. Calcite comes in on a yellow belt on row 6 and surfaces beside each pair; stone leaves on a red belt by row 7.
- **Iron block** (columns 17 to 39). Eight foundries cast iron plate onto the red belt of row 6, which runs east past every electronic circuit machine.
- **Circuit core** (columns 40 to 89). Three triplets (a cable foundry between two electronic circuit machines) and one unit with a cable tap (an electronic circuit machine, a cable foundry and one bulk arm that puts cable on a three-tile belt), each in a top band and a mirrored bottom band: eight cable foundries, fourteen electronic circuit machines. Cable reaches the circuit machines by bulk arm, never by belt.
- **Feed belts** (rows 0 and 12). The electronic circuit machines drop their circuits on the feed belt of their band (outer lane); the cable tap joins it from inside (inner lane). The belt runs east past the advanced circuit machines, which take both, and on past the processing unit machines, which take only circuits; it ends at the last of them. The cable lane beyond the advanced circuit block just stands full.
- **Advanced circuit block** (columns 90 to 111). Twelve assembling machines 3. Each takes circuits and cable from its feed belt with one bulk arm, plastic from the yellow belt of row 6 with a fast arm, and puts its advanced circuit on the red belt of row 6. Plastic comes down column 114 from the north edge and runs west; the red belt runs east and dives under it.
- **Processing unit block** (columns 115 to 133). Ten assembling machines 3. Each takes electronic circuits from its feed belt with one bulk arm and advanced circuits from the red belt of row 6 with a fast arm, and puts its processing unit on the yellow belt of row 6, which leaves at the east edge. The machines stand in pairs facing each other; the acid pipe stands between them and reaches both. Acid comes in at the east edge and travels west under row 1 (and row 11 for the bottom band); the two are joined by the pipe column 134.
- **Metal trunks.** Molten copper travels east under row 5 to the eight cable foundries, molten iron under row 7 to the three iron columns.

### Fluids

- **lava**: one pipe network of 27 pipes and underground pieces, joined to 4 machine ports.
- **molten-copper**: one pipe network of 43 pipes and underground pieces, joined to 10 machine ports.
- **molten-iron**: one pipe network of 44 pipes and underground pieces, joined to 10 machine ports.
- **sulfuric-acid**: one pipe network of 37 pipes and underground pieces, joined to 10 machine ports.
- One fluid per pipe network. Every port a recipe uses stands on a pipe of its own fluid; every port a recipe does not use (the output side of a casting foundry, both sides of a circuit machine without a fluid) faces no pipe. No machine has ports on the pipes of two fluids, so nothing can push one metal into the other's pipes; no pump and no tank is needed. The static audit recomputes this from the string and every native scenario reads every pipe run every tick.
- Measured in the game before anything was laid out (`scripts/vulcanus-circuits/fluid-slots.json`): a foundry recipe with one fluid ingredient uses both input ports as one box; a lava foundry gives its metal by both output ports; a port the recipe does not use joins nothing; and a foundry whose recipe is taken away pushes its leftover fluid into the pipe on its other port when the first is full. That last one is why the rule above is kept even for ports that are idle.

## Measured natively

Every figure below is from `native-report.json`: 24 scenarios, each its own headless game on a Vulcanus surface (pressure 4000) from a fresh import of this exact string, with only the 50 technologies in `manifest.technologyClosure` researched. Supply is put only into the entrances; a belt is placed beyond each exit, the way a player would connect one, and emptied. "Rate reached" means the trailing minute of the product exit at 95% of the target or more.

### Full-length runs

From empty: 15 minutes of warm-up, then 30 minutes measured.

| Entrances | processing units a minute | Least and most in one minute | Stone out a minute | lava in | calcite in | plastic-bar in | sulfuric-acid in |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| offered exactly the panel figures | 59.97 | 56–63 | 864.17 | 23,470.0 | 47.0 | 240.0 | 300.0 |
| offered more than they can take | 70 | 69–71 | 1,014.67 | 27,533.3 | 55.1 | 287.4 | 350.2 |

Offered more, it makes more than the target: the ten processing unit machines can do 75 a minute between them, and everything before them has the reserve for it.

Share of the measured half hour each group of machines spent working:

| Machines | Count | Working, panel figures | Working, offered more |
| --- | ---: | ---: | ---: |
| lava foundries (molten copper) | 2 | 71% | 84% |
| lava foundries (molten iron) | 2 | 85% | 100% |
| foundries (iron plate) | 8 | 83% | 92% |
| foundries (copper cable) | 8 | 82% | 98% |
| electronic circuit machines | 14 | 60% | 83% |
| advanced circuit machines | 12 | 79% | 96% |
| processing unit machines | 10 | 80% | 93% |

| Scenario | What is done | Verdict | Game minutes | Rate reached after | Then, ten measured minutes (a minute) | Foreign fluid |
| --- | --- | --- | ---: | --- | ---: | --- |
| cold:lava | lava withheld from a cold start for 20 minutes, then supplied (also: lava connected late) | passed | 31.8 | 107 s | 69.9 | none |
| cold:calcite | calcite withheld from a cold start for 20 minutes, then supplied (also: calcite connected late) | passed | 31.9 | 112 s | 69.8 | none |
| cold:plastic-bar | plastic-bar withheld from a cold start for 20 minutes, then supplied (also: plastic-bar connected late) | passed | 31.6 | 93 s | 74 | none |
| cold:sulfuric-acid | sulfuric-acid withheld from a cold start for 20 minutes, then supplied (also: sulfuric-acid connected late) | passed | 31.0 | 60 s | 74.3 | none |
| late:stone-exit | stone exit not connected for an hour, then connected | passed | 71.8 | 107 s | 70 | none |

### Goal-ended runs

These end each wait as soon as the rate is reached (the limit of 30 minutes is a failure) and then measure ten minutes. Fixed parts keep their full length: blocked exits 15 minutes, outage 5, no power 5, cuts 10, stopped foundries 15, the pause before a late lava foundry group 10.

| Scenario | What is done | Verdict | Game minutes | Rate reached after | Then, ten measured minutes (a minute) | Foreign fluid |
| --- | --- | --- | ---: | --- | ---: | --- |
| blocks | product exit blocked and released, stone exit blocked and released, five-minute outage of every input | passed | 50.8 | 112 s, 60 s, 88 s, 86 s | 71.7 | none |
| build:shuffle-1 | built a few entities at a time in a seeded shuffled order (built in 1.7 min) | passed | 13.5 | 104 s | 69.9 | none |
| build:shuffle-2 | built a few entities at a time in a seeded shuffled order (built in 1.7 min) | passed | 13.5 | 103 s | 69.8 | none |
| build:shuffle-3 | built a few entities at a time in a seeded shuffled order (built in 1.7 min) | passed | 13.5 | 104 s | 69.7 | none |
| build:pipes-first | built a few entities at a time, every pipe first (built in 1.7 min) | passed | 13.4 | 97 s | 70.1 | none |
| build:machines-first | built a few entities at a time, machines and substations first (built in 1.7 min) | passed | 13.4 | 100 s | 69.9 | none |
| build:copper-lava-last | built a few entities at a time; the molten copper lava foundries arrive ten minutes after everything else (built in 11.7 min) | passed | 23.6 | 114 s | 71.3 | none |
| build:iron-lava-last | built a few entities at a time; the molten iron lava foundries arrive ten minutes after everything else (built in 11.7 min) | passed | 23.5 | 106 s | 69.3 | none |
| late:power | everything connected, no power for five minutes | passed | 16.8 | 107 s | 69.9 | none |
| starve:supply | in mid-run lava cut for ten minutes, then calcite cut for ten minutes | passed | 35.2 | 112 s, 100 s, 100 s | 70.5 | none |
| starve:foundry | in mid-run one molten metal runs dry while the other is full: each lava foundry group stopped for fifteen minutes in turn | passed | 44.9 | 112 s, 82 s, 99 s | 69.4 | none |

- **Product exit blocked** for 15 minutes: nothing left by the exit, no machine crafted in the last 5 minutes and none was working at the end (held). Released: rate back after 60 s.
- **Stone exit blocked** for 15 minutes: the build ran its molten metal down and stopped, no machine crafting in the last 5 minutes (held). Cleared: rate back after 88 s.
- **Five-minute outage of every input**: rate back 86 s after supply returned.
- **Piecemeal construction**: 2 entities every 20 ticks, in the order named, with lava, calcite, the other inputs and power connected from the first tick. The game refused no entity in any order.

### Shortened runs

Placement and research runs wait for the rate from empty and then measure ten minutes; they are not 45-minute runs.

| Scenario | What is done | Verdict | Game minutes | Rate reached after | Then, ten measured minutes (a minute) | Foreign fluid |
| --- | --- | --- | ---: | --- | ---: | --- |
| place:rot90 | placed turned a quarter clockwise | passed | 11.9 | 112 s | 69.8 | none |
| place:rot180 | placed turned a half | passed | 11.9 | 112 s | 69.8 | none |
| place:rot270 | placed turned three quarters | passed | 11.9 | 112 s | 69.8 | none |
| place:flipH | placed mirrored left to right | passed | 11.9 | 111 s | 69.8 | none |
| place:flipV | placed mirrored top to bottom | passed | 11.9 | 111 s | 69.8 | none |
| research:max | every inserter capacity research done (the pinned hand sizes must hold) | passed | 11.9 | 112 s | 69.8 | none |

Turning is done by the game (the blueprint is built in that direction). A mirror image is written by the test as its own string (positions and directions mirrored, the mirror flag set on the foundries), because the game has no script call that flips a blueprint; the game's own flip key was not pressed. `research:max` runs with inserter capacity as after all seven capacity researches (stack size bonus 2, bulk bonus 11): the arms carry what is pinned in the blueprint, and the result is the same.

### Checks in every scenario

- Import: every entity at its position and direction, every recipe, crafting speed and built-in productivity, every arm's pinned hand size, filter and the two entities it reaches, every panel text, one electric network (23 checks in a plain run).
- Fluids: every pipe run read every tick (972,000 readings in the throttled rate run), every machine fluid box every five ticks (972,000): no foreign fluid, in any scenario. Every machine port once a second: none joined to a pipe of another fluid, no unused port joined to anything.
- Belts: every belt of every line read every five seconds: no item on a line that does not declare it. The exits gave only their own item.
- The fluid watch was tested on itself (`validate.mjs --explore --sabotage molten-copper,molten-iron`): molten iron put into the copper pipes by script fails the run on the next tick.

All 24 games together simulated 10.4 game hours; each ran at 50 to 148 times real time (one update thread, only the chunks under the blueprint kept).

## Things to know

- Connect the stone exit before anything else; with it unconnected the build stops within minutes and waits.
- Ports are on three sides: lava, calcite, stone and power on the west; plastic on the north edge at column 114; acid (row 1) and the product (row 6) on the east.
- The figures hold at the panel supply. With less of any input it makes less; the cut, outage and late-input tests show it does not jam and returns to the rate when supply does.
- The product belt is yellow: 60 a minute is a fifteenth of what it carries.
- At exactly the panel supply two of the twelve advanced circuit machines stand idle: plastic comes from the east, the ten machines nearest to it take all 240 bars, and the pair furthest west (column 90) waits. Offered more plastic they work too.
- The feed belts and the plate belt are express belts: each feed belt carries 720 electronic circuits a minute on one lane and the plate belt 720 plates a lane, more than arms can reliably put on a red lane (900). The other belts are red and yellow.
- Research needed (50 technologies in the closure), among them: processing-unit, foundry, steam-power, logistics, logistics-2, fast-inserter, bulk-inserter, electric-energy-distribution-2, logistics-3, automation-3, circuit-network, electronics, advanced-circuit.
- Arms: fast and long-handed arms carry 1, bulk arms 2, pinned in the blueprint. That is what a bulk arm carries when it has just been researched, so inserter capacity research changes nothing here.

## Reproduce

From `factorio-command-center/`:

```
node scripts/vulcanus-circuits/generate.mjs processing-units     # writes this folder from the pinned data (keeps the committed string)
node scripts/vulcanus-circuits/audit.mjs processing-units        # static audit (43 checks)
node scripts/vulcanus-circuits/validate.mjs processing-units     # the native protocol (needs the game): 24 headless games, a few minutes
node --test tests/vulcanus-circuits.test.mjs
```

The validator needs the installed Factorio 2.1.25 (Steam, Space Age) and compares its game files with the pinned snapshot. It runs in private profiles under `.cache/vulcanus-circuits/` and never touches the player's game, saves or mod profile. The tests need neither the game nor the prototype dump.
