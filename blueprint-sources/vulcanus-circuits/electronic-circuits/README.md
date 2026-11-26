# Electronic circuits from lava · 1,200 a minute

**Qualified** in Factorio 2.1.25 Space Age on a Vulcanus surface, for the exact string in `blueprint.txt` (SHA-256 `099932f57dd9e2c2757089a0e64b4b1aeb42d43e8e4b0161cd9edf3209ae53b3`). All 22 scenarios of the native protocol passed. Measured over 30 minutes: **1,199.57 electronic circuits a minute** with every entrance offered exactly its panel figure, 1,350 with every entrance offered more. Target 1,200, pass floor 1,140 (95%). Report: `native-report.json`.

Turns lava and calcite into electronic (green) circuits on one red belt, 1,200 a minute. Foundries melt the lava into molten iron and molten copper and cast iron plates and copper cable; assembling machines 3 make the circuits. It needs nothing else: no plates, no water, no coal. Vanilla Space Age, normal quality, no modules, no beacons, no circuit network, no robots inside. Every machine has its recipe saved in the blueprint.

## Size and machines

- Footprint **74 × 13 = 962 tiles**, counting every entity (303): 12 assembling machine 3, 58 bulk inserter, 5 display panel, 4 fast inserter, 82 fast transport belt, 24 fast underground belt, 16 foundry, 75 pipe, 16 pipe to ground, 5 substation, 2 transport belt, 4 underground belt.
- Machines: **16 foundries and 12 assembling machines 3**.

| Machine | Count | Needed at the target | One machine does (crafts a minute) | Why this count |
| --- | ---: | ---: | ---: | --- |
| lava foundry, molten copper | 2 | 1.07 | 15 | one would make 5,625 molten copper a minute of the 6,000 needed |
| lava foundry, molten iron | 2 | 1.42 | 15 | one would make 5,625 molten iron a minute of the 8,000 needed |
| foundry, iron plate | 6 | 5.33 | 75 | 5.33 needed |
| foundry, copper cable | 6 | 5 | 240 | exactly 5 needed; the sixth is the spare, because five would have to cast without ever pausing |
| assembling machine 3, electronic circuit | 12 | 8 | 150 | 8 needed; each cable foundry hands its cable to two machines directly, so six foundries carry twelve, each at two thirds of its speed |

Every foundry has a built-in productivity of 50% (it gives 1.5 times the products of each craft, stone included); the counts above include it. Recipes, craft times, speeds (foundry 4, assembling machine 3 1.25) and that productivity are read from the game's own data (pinned in `scripts/vulcanus-circuits/prototypes.json`) and compared with the running game in every test.

At 1,200 circuits a minute: 1,200 iron plates and 3,600 copper cable a minute, cast from 8,000 molten iron and 6,000 molten copper, melted in 37.3 lava crafts a minute: 18,667 lava and 37.3 calcite in, 680 stone out.

## Layout

```
    0         1         2         3         4         5         6         7   
    01234567890123456789012345678901234567890123456789012345678901234567890123
  0 ....CCCCC.CCCCC...PPPPPPPPPP.PPPPP>>>uKKKKKo>>>>>>uKKKKKo>>>>>>uKKKKKo>>>v
  1 ...=CCCCC=CCCCC=.=PPPPPPPPPP=PPPPP.b..KKKKK..b..b..KKKKK..b..b..KKKKK..b.v
  2 !..=CCCCC=CCCCC=.=PPPPPPPPPP=PPPPPGGG.KKKKK.GGGGGG.KKKKK.GGGGGG.KKKKK.GGGv
  3 ====CCCCC=CCCCC=.=PPPPPPPPPP=PPPPPGGGbKKKKKbGGGGGGbKKKKKbGGGGGGbKKKKKbGGGv
  4 ...=CCCCC=CCCCC=.=PPPPPPPPPP=PPPPPGGGbKKKKKbGGGGGGbKKKKKbGGGGGGbKKKKKbGGGv
  5 !..=.i..b=wi.b.=.=##ewb..b..=ewb...b##e===w..b..b##e===w..b..b##e===...b.v
  6 >>u=wouv<<oou<e=.=##..>>>>>u=o>>>>>u##..=o>>>>>>u##..=o>>>>>>u##..=o>>>>!>
  7 <<o=.iu<b=wi.b.=e=w...b..b.e=..b...b...==....b..b...==....b..b...==....b.^
  8 !..=IIIII=IIIII=.=PPPPPPPPPP=PPPPPGGGbKKKKKbGGGGGGbKKKKKbGGGGGGbKKKKKbGGG^
  9 !##=IIIII=IIIII=.=PPPPPPPPPP=PPPPPGGGbKKKKKbGGGGGGbKKKKKbGGGGGGbKKKKKbGGG^
 10 .##=IIIII=IIIII=.=PPPPPPPPPP=PPPPPGGG.KKKKK.GGGGGG.KKKKK.GGGGGG.KKKKK.GGG^
 11 ...=IIIII=IIIII=.=PPPPPPPPPP=PPPPP.b..KKKKK..b..b..KKKKK..b..b..KKKKK..b.^
 12 ....IIIII.IIIII...PPPPPPPPPP.PPPPP>>>uKKKKKo>>>>>>uKKKKKo>>>>>>uKKKKKo>>>^
```

`C` lava foundry (molten copper), `I` lava foundry (molten iron), `P` foundry casting iron plate, `K` foundry casting copper cable, `G` assembling machine 3 (electronic circuit), `R` assembling machine 3 (advanced circuit), `B` assembling machine 3 (processing unit), `#` substation, `!` display panel, `=` pipe, `n e s w` pipe-to-ground (the letter is the side of its open end; its underground runs the other way), `^ > v <` belt (the way it runs), `u`/`o` underground belt in/out, `b` bulk inserter, `i` fast inserter, `l` long-handed inserter. Columns count from the west edge and rows from the north edge, both from 0.

A drawing of the same is in `layout.svg`.

## Entrances, exits, power

Tiles are counted from the blueprint's top-left tile (column, row). Every port has a display panel beside it with the item, `IN:` or `OUT:` and the per-minute figure.

| Port | What | Kind | Tile | Side | Panel figure | Took, offered exactly the panel figure | Took, offered more |
| --- | --- | --- | --- | --- | ---: | ---: | ---: |
| IN-1 | lava | pipe | (0, 3) | west | 18,670/min | 18,670.0/min | 21,016.7/min |
| IN-2 | calcite | belt | (0, 6) | west | 38/min | 38.0/min | 42.1/min |

| Exit | What | Kind | Tile | Side | Panel figure | Gave, entrances at the panel figures | Gave, entrances offered more |
| --- | --- | --- | --- | --- | ---: | ---: | ---: |
| OUT-1 | electronic-circuit | belt | (73, 6) | east | 1,200/min | 1,199.57/min | 1,350/min |
| OUT-STONE | stone | belt | (0, 7) | west | 680/min | 680.07/min | 764.7/min |

- **Product exit**: a red belt carries 1,800 a minute (900 a lane); the two bands load one lane each, 600 a minute a lane at the target. In the measured half hour the two lanes carried 18,247 and 17,740 items. When nothing takes the product the belts fill, every machine stops with its output full, and it all starts again when the belt moves.
- **Stone** is a by-product of every lava craft and nothing here uses it. It leaves on the belt at (0, 7) and **must be carried away** (for example to an arm that drops it into lava). If that belt cannot move, the lava foundries stop with their output full, the molten metal runs out and everything stops; nothing is harmed and it carries on when the belt moves again.
- **Power**: connect the substation at tiles (1–2, 9–10), marked by the panel `POWER: connect this substation`. 5 substations power everything and are wired to each other. The machines' rated draw adds up to 44.5 MW; measured average at the target 38.9 MW, and 3.2 MW averaged over the fifteen minutes with the product exit blocked (running down, then standing still).


## How it works

- **Lava block** (west, columns 0 to 16). Four lava foundries: two for molten copper in the top row, two for molten iron in the bottom row. Lava comes in at the west edge and reaches every foundry through the two lava columns (3 and 15, joined by one underground pipe under row 6). The column between the foundries (9) is the only place the metals come out: molten copper in its top half, molten iron in its bottom half, with the stone belt between them.
- **Calcite and stone share row 6.** Calcite comes in on a yellow belt and runs east underground, surfacing on one tile beside each pair of foundries; a filtered fast arm per foundry takes it there. Stone is dropped by one bulk arm per foundry onto a red belt running west, which dives under the calcite tiles and leaves by row 7. Yellow and red underground belts do not join, which is what lets the two cross.
- **Iron block** (columns 17 to 33). Six foundries cast iron plate, three above and three below the corridor, fed from two iron pipe columns (17 and 28). Each drops its plates with one bulk arm onto the red belt of row 6, which runs east through the circuit core; the top row loads one lane and the bottom row the other.
- **Circuit core** (columns 34 to 72). Three triplets, each a cable foundry between two assembling machines 3, in a top band and a mirrored bottom band: six cable foundries and twelve circuit machines. Cable never touches a belt: two bulk arms carry it from the foundry straight into each machine. Each machine takes plates from the belt of row 6 with one bulk arm and puts its circuits with one bulk arm on the belt of its band (row 0 or row 12), which dives under the cable foundries.
- **Metal trunks.** Molten copper travels east under row 5 and molten iron under row 7, as underground pipe wherever something stands in the way. Copper comes up under every cable foundry of the top band and crosses row 6 there on one pipe to the foundry below; iron comes up at the two iron columns.
- **Exit.** The two circuit belts turn into column 73 and load the exit tile from the north and from the south, one lane each.

### Fluids

- **lava**: one pipe network of 27 pipes and underground pieces, joined to 4 machine ports.
- **molten-copper**: one pipe network of 33 pipes and underground pieces, joined to 8 machine ports.
- **molten-iron**: one pipe network of 31 pipes and underground pieces, joined to 8 machine ports.
- One fluid per pipe network. Every port a recipe uses stands on a pipe of its own fluid; every port a recipe does not use (the output side of a casting foundry, both sides of a circuit machine without a fluid) faces no pipe. No machine has ports on the pipes of two fluids, so nothing can push one metal into the other's pipes; no pump and no tank is needed. The static audit recomputes this from the string and every native scenario reads every pipe run every tick.
- Measured in the game before anything was laid out (`scripts/vulcanus-circuits/fluid-slots.json`): a foundry recipe with one fluid ingredient uses both input ports as one box; a lava foundry gives its metal by both output ports; a port the recipe does not use joins nothing; and a foundry whose recipe is taken away pushes its leftover fluid into the pipe on its other port when the first is full. That last one is why the rule above is kept even for ports that are idle.

## Measured natively

Every figure below is from `native-report.json`: 22 scenarios, each its own headless game on a Vulcanus surface (pressure 4000) from a fresh import of this exact string, with only the 49 technologies in `manifest.technologyClosure` researched. Supply is put only into the entrances; a belt is placed beyond each exit, the way a player would connect one, and emptied. "Rate reached" means the trailing minute of the product exit at 95% of the target or more.

### Full-length runs

From empty: 15 minutes of warm-up, then 30 minutes measured.

| Entrances | electronic circuits a minute | Least and most in one minute | Stone out a minute | lava in | calcite in |
| --- | ---: | ---: | ---: | ---: | ---: |
| offered exactly the panel figures | 1,199.57 | 1143–1256 | 680.07 | 18,670.0 | 38.0 |
| offered more than they can take | 1,350 | 1350–1350 | 764.7 | 21,016.7 | 42.1 |

Offered more, it makes more than the target: the six plate foundries then cast without pause and set the pace.

Share of the measured half hour each group of machines spent working:

| Machines | Count | Working, panel figures | Working, offered more |
| --- | ---: | ---: | ---: |
| lava foundries (molten copper) | 2 | 53% | 60% |
| lava foundries (molten iron) | 2 | 71% | 80% |
| foundries (iron plate) | 6 | 86% | 100% |
| foundries (copper cable) | 6 | 83% | 93% |
| electronic circuit machines | 12 | 60% | 89% |

| Scenario | What is done | Verdict | Game minutes | Rate reached after | Then, ten measured minutes (a minute) | Foreign fluid |
| --- | --- | --- | ---: | --- | ---: | --- |
| cold:lava | lava withheld from a cold start for 20 minutes, then supplied (also: lava connected late) | passed | 31.2 | 74 s | 1,349.7 | none |
| cold:calcite | calcite withheld from a cold start for 20 minutes, then supplied (also: calcite connected late) | passed | 31.3 | 78 s | 1,350.1 | none |
| late:stone-exit | stone exit not connected for an hour, then connected | passed | 71.3 | 79 s | 1,349.9 | none |

### Goal-ended runs

These end each wait as soon as the rate is reached (the limit of 30 minutes is a failure) and then measure ten minutes. Fixed parts keep their full length: blocked exits 15 minutes, outage 5, no power 5, cuts 10, stopped foundries 15, the pause before a late lava foundry group 10.

| Scenario | What is done | Verdict | Game minutes | Rate reached after | Then, ten measured minutes (a minute) | Foreign fluid |
| --- | --- | --- | ---: | --- | ---: | --- |
| blocks | product exit blocked and released, stone exit blocked and released, five-minute outage of every input | passed | 49.5 | 78 s, 60 s, 60 s, 73 s | 1,349.6 | none |
| build:shuffle-1 | built a few entities at a time in a seeded shuffled order (built in 0.8 min) | passed | 12.1 | 74 s | 1,349.9 | none |
| build:shuffle-2 | built a few entities at a time in a seeded shuffled order (built in 0.8 min) | passed | 12.0 | 71 s | 1,349.8 | none |
| build:shuffle-3 | built a few entities at a time in a seeded shuffled order (built in 0.8 min) | passed | 12.1 | 73 s | 1,349.7 | none |
| build:pipes-first | built a few entities at a time, every pipe first (built in 0.8 min) | passed | 12.1 | 73 s | 1,349.9 | none |
| build:machines-first | built a few entities at a time, machines and substations first (built in 0.8 min) | passed | 12.1 | 76 s | 1,349.7 | none |
| build:copper-lava-last | built a few entities at a time; the molten copper lava foundries arrive ten minutes after everything else (built in 10.8 min) | passed | 21.8 | 60 s | 1,368.6 | none |
| build:iron-lava-last | built a few entities at a time; the molten iron lava foundries arrive ten minutes after everything else (built in 10.8 min) | passed | 22.1 | 74 s | 1,349 | none |
| late:power | everything connected, no power for five minutes | passed | 16.2 | 74 s | 1,349.8 | none |
| starve:supply | in mid-run lava cut for ten minutes, then calcite cut for ten minutes | passed | 33.8 | 78 s, 73 s, 76 s | 1,349.8 | none |
| starve:foundry | in mid-run one molten metal runs dry while the other is full: each lava foundry group stopped for fifteen minutes in turn | passed | 43.5 | 78 s, 60 s, 69 s | 1,348.7 | none |

- **Product exit blocked** for 15 minutes: nothing left by the exit, no machine crafted in the last 5 minutes and none was working at the end (held). Released: rate back after 60 s.
- **Stone exit blocked** for 15 minutes: the build ran its molten metal down and stopped, no machine crafting in the last 5 minutes (held). Cleared: rate back after 60 s.
- **Five-minute outage of every input**: rate back 73 s after supply returned.
- **Piecemeal construction**: 2 entities every 20 ticks, in the order named, with lava, calcite and power connected from the first tick. The game refused no entity in any order.

### Shortened runs

Placement and research runs wait for the rate from empty and then measure ten minutes; they are not 45-minute runs.

| Scenario | What is done | Verdict | Game minutes | Rate reached after | Then, ten measured minutes (a minute) | Foreign fluid |
| --- | --- | --- | ---: | --- | ---: | --- |
| place:rot90 | placed turned a quarter clockwise | passed | 11.3 | 78 s | 1,350.1 | none |
| place:rot180 | placed turned a half | passed | 11.3 | 78 s | 1,350.1 | none |
| place:rot270 | placed turned three quarters | passed | 11.3 | 78 s | 1,350.1 | none |
| place:flipH | placed mirrored left to right | passed | 11.3 | 78 s | 1,350.1 | none |
| place:flipV | placed mirrored top to bottom | passed | 11.3 | 78 s | 1,350.1 | none |
| research:max | every inserter capacity research done (the pinned hand sizes must hold) | passed | 11.3 | 78 s | 1,350.1 | none |

Turning is done by the game (the blueprint is built in that direction). A mirror image is written by the test as its own string (positions and directions mirrored, the mirror flag set on the foundries), because the game has no script call that flips a blueprint; the game's own flip key was not pressed. `research:max` runs with inserter capacity as after all seven capacity researches (stack size bonus 2, bulk bonus 11): the arms carry what is pinned in the blueprint, and the result is the same.

### Checks in every scenario

- Import: every entity at its position and direction, every recipe, crafting speed and built-in productivity, every arm's pinned hand size, filter and the two entities it reaches, every panel text, one electric network (22 checks in a plain run).
- Fluids: every pipe run read every tick (648,000 readings in the throttled rate run), every machine fluid box every five ticks (518,400): no foreign fluid, in any scenario. Every machine port once a second: none joined to a pipe of another fluid, no unused port joined to anything.
- Belts: every belt of every line read every five seconds: no item on a line that does not declare it. The exits gave only their own item.
- The fluid watch was tested on itself (`validate.mjs --explore --sabotage molten-copper,molten-iron`): molten iron put into the copper pipes by script fails the run on the next tick.

All 22 games together simulated 9.0 game hours; each ran at 467 to 1121 times real time (one update thread, only the chunks under the blueprint kept).

## Things to know

- Connect the stone exit before anything else. Unconnected, the build makes a few hundred circuits from what is in its pipes and then stands still; it was left like that for an hour in the test and carried on within two minutes of being connected.
- The figures hold at the panel supply. With less lava or calcite it makes less; the cut, outage and late-input tests show it does not jam and returns to the rate when supply does.
- The exit belt is red and carries 1,800 a minute; at the target each lane holds 600 of its 900. Do not replace it with a yellow belt (900 a minute in all).
- The calcite entrance is a yellow belt; any belt can feed it. Only about 38 calcite a minute are used.
- Research needed (49 technologies in the closure), among them: electronics, foundry, steam-power, logistics, logistics-2, fast-inserter, bulk-inserter, electric-energy-distribution-2, automation-3, circuit-network.
- Arms: fast and long-handed arms carry 1, bulk arms 2, pinned in the blueprint. That is what a bulk arm carries when it has just been researched, so inserter capacity research changes nothing here.

## Reproduce

From `factorio-command-center/`:

```
node scripts/vulcanus-circuits/generate.mjs electronic-circuits     # writes this folder from the pinned data (keeps the committed string)
node scripts/vulcanus-circuits/audit.mjs electronic-circuits        # static audit (43 checks)
node scripts/vulcanus-circuits/validate.mjs electronic-circuits     # the native protocol (needs the game): 22 headless games, a few minutes
node --test tests/vulcanus-circuits.test.mjs
```

The validator needs the installed Factorio 2.1.25 (Steam, Space Age) and compares its game files with the pinned snapshot. It runs in private profiles under `.cache/vulcanus-circuits/` and never touches the player's game, saves or mod profile. The tests need neither the game nor the prototype dump.
