# Advanced circuits from lava · 240 a minute

**Qualified** in Factorio 2.1.25 Space Age on a Vulcanus surface, for the exact string in `blueprint.txt` (SHA-256 `58b1a9e4c23f8d7ec7251798fd13854e3f4ca0fc8ad1f77a8799c80f5f21624a`). All 23 scenarios of the native protocol passed. Measured over 30 minutes: **240.1 advanced circuits a minute** with every entrance offered exactly its panel figure, 250 with every entrance offered more. Target 240, pass floor 228 (95%). Report: `native-report.json`.

Turns lava, calcite and plastic bars into advanced (red) circuits on one red belt, 240 a minute. Foundries melt the lava and cast iron plates and copper cable; the electronic circuits the recipe needs are made inside as well. The only item to bring besides lava and calcite is plastic. Vanilla Space Age, normal quality, no modules, no beacons, no circuit network, no robots inside. Every machine has its recipe saved in the blueprint.

## Size and machines

- Footprint **82 × 13 = 1,066 tiles**, counting every entity (369): 24 assembling machine 3, 46 bulk inserter, 6 display panel, 42 fast inserter, 123 fast transport belt, 24 fast underground belt, 10 foundry, 59 pipe, 8 pipe to ground, 7 substation, 8 transport belt, 12 underground belt.
- Machines: **10 foundries and 24 assembling machines 3**.

| Machine | Count | Needed at the target | One machine does (crafts a minute) | Why this count |
| --- | ---: | ---: | ---: | --- |
| lava foundry, molten copper | 1 | 0.71 | 15 | 0.71 needed |
| lava foundry, molten iron | 1 | 0.57 | 15 | 0.57 needed |
| foundry, iron plate | 4 | 2.13 | 75 | 2.13 needed, so three would do; the fourth is a spare that keeps the plate foundries in pairs above and below the belt |
| foundry, copper cable | 4 | 3.33 | 240 | 3.33 needed |
| assembling machine 3, electronic circuit | 4 | 3.2 | 150 | 3.2 needed |
| assembling machine 3, advanced circuit | 20 | 19.2 | 12.5 | 19.2 needed |

Every foundry has a built-in productivity of 50% (it gives 1.5 times the products of each craft, stone included); the counts above include it. Recipes, craft times, speeds (foundry 4, assembling machine 3 1.25) and that productivity are read from the game's own data (pinned in `scripts/vulcanus-circuits/prototypes.json`) and compared with the running game in every test.

At 240 advanced circuits a minute: 480 electronic circuits, 480 plastic bars and 2,400 copper cable a minute (1,440 of it for the electronic circuits), 480 iron plates; 3,200 molten iron and 4,000 molten copper from 19.2 lava crafts a minute: 9,600 lava and 19.2 calcite in, 368 stone out.

## Layout

```
    0         1         2         3         4         5         6         7         8 
    0123456789012345678901234567890123456789012345678901234567890123456789012345678901
  0 ....CCCCC...PPPPPPPPPP.>>>uKKKKKo>>>>uKKKKKo>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>....
  1 ...=CCCCC=.=PPPPPPPPPP=.b..KKKKK.^.b..KKKKK.^.b....b..b..b..b....b..b..b..b..b....
  2 !..=CCCCC=.=PPPPPPPPPP=GGG.KKKKK.^GGG.KKKKK.^RRR##RRRRRRRRRRRR##RRRRRRRRRRRRRRR##.
  3 ====CCCCC=.=PPPPPPPPPP=GGGbKKKKKb^GGGbKKKKKb^RRR##RRRRRRRRRRRR##RRRRRRRRRRRRRRR##.
  4 ...=CCCCC=.=PPPPPPPPPP=GGGbKKKKK..GGGbKKKKK..RRR..RRRRRRRRRRRR..RRRRRRRRRRRRRRR...
  5 !..=.i..b=w=##..b..bew=.b##e===w...b##e===...i.i..i.ii.ii.ii.i..i.ii.ii.ii.ii.i..!
  6 >>u=.o.v<..=##..>>>>>u=ou##..=o>>>>>##..=....>u<<<oo>>uuoo>>uu<<oo>>uuoo>>uuoo>vu<
  7 <<o=.iu<b===w...b..b.e=.b...==.....b...==....i.i..i.ii.ii.ii.i..i.ii.ii.ii.ii.i>>>
  8 !..=IIIII=.=PPPPPPPPPP=GGGbKKKKK..GGGbKKKKK..RRR..RRRRRRRRRRRR..RRRRRRRRRRRRRRR..!
  9 !##=IIIII=.=PPPPPPPPPP=GGGbKKKKKbvGGGbKKKKKbvRRR..RRRRRRRRRRRR..RRRRRRRRRRRRRRR...
 10 .##=IIIII=.=PPPPPPPPPP=GGG.KKKKK.vGGG.KKKKK.vRRR..RRRRRRRRRRRR..RRRRRRRRRRRRRRR...
 11 ...=IIIII=.=PPPPPPPPPP=.b..KKKKK.v.b..KKKKK.v.b....b..b..b..b....b..b..b..b..b....
 12 ....IIIII...PPPPPPPPPP.>>>uKKKKKo>>>>uKKKKKo>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>....
```

`C` lava foundry (molten copper), `I` lava foundry (molten iron), `P` foundry casting iron plate, `K` foundry casting copper cable, `G` assembling machine 3 (electronic circuit), `R` assembling machine 3 (advanced circuit), `B` assembling machine 3 (processing unit), `#` substation, `!` display panel, `=` pipe, `n e s w` pipe-to-ground (the letter is the side of its open end; its underground runs the other way), `^ > v <` belt (the way it runs), `u`/`o` underground belt in/out, `b` bulk inserter, `i` fast inserter, `l` long-handed inserter. Columns count from the west edge and rows from the north edge, both from 0.

A drawing of the same is in `layout.svg`.

## Entrances, exits, power

Tiles are counted from the blueprint's top-left tile (column, row). Every port has a display panel beside it with the item, `IN:` or `OUT:` and the per-minute figure.

| Port | What | Kind | Tile | Side | Panel figure | Took, offered exactly the panel figure | Took, offered more |
| --- | --- | --- | --- | --- | ---: | ---: | ---: |
| IN-1 | lava | pipe | (0, 3) | west | 9,600/min | 9,600.0/min | 10,016.7/min |
| IN-2 | calcite | belt | (0, 6) | west | 20/min | 20.0/min | 20.1/min |
| IN-3 | plastic-bar | belt | (81, 6) | east | 480/min | 479.6/min | 500.0/min |

| Exit | What | Kind | Tile | Side | Panel figure | Gave, entrances at the panel figures | Gave, entrances offered more |
| --- | --- | --- | --- | --- | ---: | ---: | ---: |
| OUT-1 | advanced-circuit | belt | (81, 7) | east | 240/min | 240.1/min | 250/min |
| OUT-STONE | stone | belt | (0, 7) | west | 368/min | 368/min | 383.43/min |

- **Product exit**: a red belt carries 1,800 a minute; the top machines load one lane and the bottom machines the other, 120 a minute a lane at the target. In the measured half hour the two lanes carried 3,609 and 3,594 items. When nothing takes the product the belts fill, every machine stops with its output full, and it all starts again when the belt moves.
- **Stone** is a by-product of every lava craft and nothing here uses it. It leaves on the belt at (0, 7) and **must be carried away** (for example to an arm that drops it into lava). If that belt cannot move, the lava foundries stop with their output full, the molten metal runs out and everything stops; nothing is harmed and it carries on when the belt moves again.
- **Power**: connect the substation at tiles (1–2, 9–10), marked by the panel `POWER: connect this substation`. 7 substations power everything and are wired to each other. The machines' rated draw adds up to 34.0 MW; measured average at the target 28.2 MW, and 5.0 MW averaged over the fifteen minutes with the product exit blocked (running down, then standing still).
- **Plastic**: 480 bars a minute at the target, two per circuit. The coal-to-plastic blueprint (`vulcanus-supplies/coal-plastic-lubricant`) gives 60 a minute a copy, so this needs **8 copies** of it (or any other source of 480 a minute). A yellow belt carries 900 a minute; the entrance is one.

## How it works

- **Lava block** (west, columns 0 to 10). Two lava foundries, molten copper above and molten iron below, both fed from the lava column (3). Their metal comes out in column 9: molten copper in its top half, molten iron in its bottom half. Calcite comes in on a yellow belt on row 6 and surfaces beside the foundries; stone leaves on a red belt by row 7.
- **Iron block** (columns 11 to 22). Four foundries cast iron plate and drop it on the red belt of row 6, which runs east to the electronic circuit machines.
- **Circuit core** (columns 23 to 44). Two units, each in a top band and a mirrored bottom band: an assembling machine 3 making electronic circuits, a cable foundry beside it handing it cable with two bulk arms, and on the foundry's other side one bulk arm that puts cable on a three-tile belt. Four cable foundries and four electronic circuit machines.
- **Feed belts** (rows 0 and 12). Each electronic circuit machine drops its circuits on the feed belt of its band; they land on the outer lane. Each cable belt joins the same feed belt from the inner side, so the cable lands on the inner lane. The belt carries both east, one lane each, and ends at the last advanced circuit machine.
- **Advanced circuit block** (columns 45 to 78). Twenty assembling machines 3, ten above and ten below. One bulk arm takes electronic circuits and cable from the feed belt; one fast arm takes plastic from the yellow belt of row 6; one fast arm puts the finished circuit on the red belt of row 6. That row is two belts braided: plastic runs west from the east edge and is on the surface for two tiles in every pair of machines, and the red product belt dives under those tiles on its way east.
- **Metal trunks.** Molten copper travels east under row 5 to the four cable foundries, molten iron under row 7 to the two iron columns.

### Fluids

- **lava**: one pipe network of 14 pipes and underground pieces, joined to 2 machine ports.
- **molten-copper**: one pipe network of 23 pipes and underground pieces, joined to 5 machine ports.
- **molten-iron**: one pipe network of 30 pipes and underground pieces, joined to 5 machine ports.
- One fluid per pipe network. Every port a recipe uses stands on a pipe of its own fluid; every port a recipe does not use (the output side of a casting foundry, both sides of a circuit machine without a fluid) faces no pipe. No machine has ports on the pipes of two fluids, so nothing can push one metal into the other's pipes; no pump and no tank is needed. The static audit recomputes this from the string and every native scenario reads every pipe run every tick.
- Measured in the game before anything was laid out (`scripts/vulcanus-circuits/fluid-slots.json`): a foundry recipe with one fluid ingredient uses both input ports as one box; a lava foundry gives its metal by both output ports; a port the recipe does not use joins nothing; and a foundry whose recipe is taken away pushes its leftover fluid into the pipe on its other port when the first is full. That last one is why the rule above is kept even for ports that are idle.

## Measured natively

Every figure below is from `native-report.json`: 23 scenarios, each its own headless game on a Vulcanus surface (pressure 4000) from a fresh import of this exact string, with only the 49 technologies in `manifest.technologyClosure` researched. Supply is put only into the entrances; a belt is placed beyond each exit, the way a player would connect one, and emptied. "Rate reached" means the trailing minute of the product exit at 95% of the target or more.

### Full-length runs

From empty: 15 minutes of warm-up, then 30 minutes measured.

| Entrances | advanced circuits a minute | Least and most in one minute | Stone out a minute | lava in | calcite in | plastic-bar in |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| offered exactly the panel figures | 240.1 | 224–253 | 368 | 9,600.0 | 20.0 | 479.6 |
| offered more than they can take | 250 | 248–252 | 383.43 | 10,016.7 | 20.1 | 500.0 |

Offered more, it makes a little more than the target: the twenty advanced circuit machines can do 250 a minute between them.

Share of the measured half hour each group of machines spent working:

| Machines | Count | Working, panel figures | Working, offered more |
| --- | ---: | ---: | ---: |
| lava foundries (molten copper) | 1 | 71% | 74% |
| lava foundries (molten iron) | 1 | 57% | 60% |
| foundries (iron plate) | 4 | 53% | 56% |
| foundries (copper cable) | 4 | 83% | 86% |
| electronic circuit machines | 4 | 80% | 83% |
| advanced circuit machines | 20 | 96% | 100% |

| Scenario | What is done | Verdict | Game minutes | Rate reached after | Then, ten measured minutes (a minute) | Foreign fluid |
| --- | --- | --- | ---: | --- | ---: | --- |
| cold:lava | lava withheld from a cold start for 20 minutes, then supplied (also: lava connected late) | passed | 31.5 | 90 s | 250 | none |
| cold:calcite | calcite withheld from a cold start for 20 minutes, then supplied (also: calcite connected late) | passed | 31.6 | 94 s | 250 | none |
| cold:plastic-bar | plastic-bar withheld from a cold start for 20 minutes, then supplied (also: plastic-bar connected late) | passed | 31.4 | 81 s | 250 | none |
| late:stone-exit | stone exit not connected for an hour, then connected | passed | 71.5 | 90 s | 250 | none |

### Goal-ended runs

These end each wait as soon as the rate is reached (the limit of 30 minutes is a failure) and then measure ten minutes. Fixed parts keep their full length: blocked exits 15 minutes, outage 5, no power 5, cuts 10, stopped foundries 15, the pause before a late lava foundry group 10.

| Scenario | What is done | Verdict | Game minutes | Rate reached after | Then, ten measured minutes (a minute) | Foreign fluid |
| --- | --- | --- | ---: | --- | ---: | --- |
| blocks | product exit blocked and released, stone exit blocked and released, five-minute outage of every input | passed | 50.5 | 92 s, 60 s, 95 s, 81 s | 250 | none |
| build:shuffle-1 | built a few entities at a time in a seeded shuffled order (built in 1.0 min) | passed | 12.5 | 88 s | 250 | none |
| build:shuffle-2 | built a few entities at a time in a seeded shuffled order (built in 1.0 min) | passed | 12.5 | 88 s | 250 | none |
| build:shuffle-3 | built a few entities at a time in a seeded shuffled order (built in 1.0 min) | passed | 12.5 | 91 s | 250 | none |
| build:pipes-first | built a few entities at a time, every pipe first (built in 1.0 min) | passed | 12.4 | 82 s | 250 | none |
| build:machines-first | built a few entities at a time, machines and substations first (built in 1.0 min) | passed | 12.4 | 83 s | 250 | none |
| build:copper-lava-last | built a few entities at a time; the molten copper lava foundries arrive ten minutes after everything else (built in 11.0 min) | passed | 22.5 | 88 s | 250 | none |
| build:iron-lava-last | built a few entities at a time; the molten iron lava foundries arrive ten minutes after everything else (built in 11.0 min) | passed | 22.5 | 90 s | 250 | none |
| late:power | everything connected, no power for five minutes | passed | 16.5 | 91 s | 250 | none |
| starve:supply | in mid-run lava cut for ten minutes, then calcite cut for ten minutes | passed | 34.5 | 92 s, 88 s, 90 s | 250 | none |
| starve:foundry | in mid-run one molten metal runs dry while the other is full: each lava foundry group stopped for fifteen minutes in turn | passed | 44.4 | 92 s, 86 s, 88 s | 250 | none |

- **Product exit blocked** for 15 minutes: nothing left by the exit, no machine crafted in the last 5 minutes and none was working at the end (held). Released: rate back after 60 s.
- **Stone exit blocked** for 15 minutes: the build ran its molten metal down and stopped, no machine crafting in the last 5 minutes (held). Cleared: rate back after 95 s.
- **Five-minute outage of every input**: rate back 81 s after supply returned.
- **Piecemeal construction**: 2 entities every 20 ticks, in the order named, with lava, calcite, the other inputs and power connected from the first tick. The game refused no entity in any order.

### Shortened runs

Placement and research runs wait for the rate from empty and then measure ten minutes; they are not 45-minute runs.

| Scenario | What is done | Verdict | Game minutes | Rate reached after | Then, ten measured minutes (a minute) | Foreign fluid |
| --- | --- | --- | ---: | --- | ---: | --- |
| place:rot90 | placed turned a quarter clockwise | passed | 11.5 | 92 s | 250 | none |
| place:rot180 | placed turned a half | passed | 11.5 | 92 s | 250 | none |
| place:rot270 | placed turned three quarters | passed | 11.5 | 92 s | 250 | none |
| place:flipH | placed mirrored left to right | passed | 11.5 | 92 s | 250 | none |
| place:flipV | placed mirrored top to bottom | passed | 11.5 | 92 s | 250 | none |
| research:max | every inserter capacity research done (the pinned hand sizes must hold) | passed | 11.5 | 92 s | 250 | none |

Turning is done by the game (the blueprint is built in that direction). A mirror image is written by the test as its own string (positions and directions mirrored, the mirror flag set on the foundries), because the game has no script call that flips a blueprint; the game's own flip key was not pressed. `research:max` runs with inserter capacity as after all seven capacity researches (stack size bonus 2, bulk bonus 11): the arms carry what is pinned in the blueprint, and the result is the same.

### Checks in every scenario

- Import: every entity at its position and direction, every recipe, crafting speed and built-in productivity, every arm's pinned hand size, filter and the two entities it reaches, every panel text, one electric network (23 checks in a plain run).
- Fluids: every pipe run read every tick (648,000 readings in the throttled rate run), every machine fluid box every five ticks (324,000): no foreign fluid, in any scenario. Every machine port once a second: none joined to a pipe of another fluid, no unused port joined to anything.
- Belts: every belt of every line read every five seconds: no item on a line that does not declare it. The exits gave only their own item.
- The fluid watch was tested on itself (`validate.mjs --explore --sabotage molten-copper,molten-iron`): molten iron put into the copper pipes by script fails the run on the next tick.

All 23 games together simulated 9.6 game hours; each ran at 66 to 204 times real time (one update thread, only the chunks under the blueprint kept).

## Things to know

- Connect the stone exit before anything else; with it unconnected the build stops within minutes and waits.
- The two eastern ports are on neighbouring rows: plastic comes in on row 6 (yellow belt, running west), advanced circuits leave on row 7 (red belt, running east).
- The figures hold at the panel supply. With less plastic, lava or calcite it makes less; the cut, outage and late-input tests show it does not jam and returns to the rate when supply does.
- Electronic circuits and cable are made only as fast as the advanced circuit machines take them: both ride the feed belts, which fill and stop the machines behind them.
- Research needed (49 technologies in the closure), among them: advanced-circuit, foundry, steam-power, logistics, logistics-2, fast-inserter, bulk-inserter, electric-energy-distribution-2, automation-3, circuit-network, electronics.
- Arms: fast and long-handed arms carry 1, bulk arms 2, pinned in the blueprint. That is what a bulk arm carries when it has just been researched, so inserter capacity research changes nothing here.

## Reproduce

From `factorio-command-center/`:

```
node scripts/vulcanus-circuits/generate.mjs advanced-circuits     # writes this folder from the pinned data (keeps the committed string)
node scripts/vulcanus-circuits/audit.mjs advanced-circuits        # static audit (43 checks)
node scripts/vulcanus-circuits/validate.mjs advanced-circuits     # the native protocol (needs the game): 23 headless games, a few minutes
node --test tests/vulcanus-circuits.test.mjs
```

The validator needs the installed Factorio 2.1.25 (Steam, Space Age) and compares its game files with the pinned snapshot. It runs in private profiles under `.cache/vulcanus-circuits/` and never touches the player's game, saves or mod profile. The tests need neither the game nor the prototype dump.
