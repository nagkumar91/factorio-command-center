# Coal to plastic bars and lubricant · 60 and 300 a minute

**Qualified** in Factorio 2.1.25 Space Age on a Vulcanus surface for the exact string in `blueprint.txt` (SHA-256 `6722724d25e8058d913a1fc38654ec69f67fd9c6707ae6007811dae7b0d8f9eb`): the full native protocol passed in both scenarios (entrances offered generously, and each entrance throttled to exactly its panel figure). Report: `native-report.json`.

Makes **60 plastic bars a minute on a belt and 300 lubricant a minute by pipe at the same time** from coal, calcite, sulfuric acid and water, using simple coal liquefaction (it comes with Vulcanus; no coal-liquefaction research, no steam). Heavy oil from the refineries is cracked to light oil and then petroleum gas for the plastic, and part of it goes straight to the lubricant plant. Light oil and petroleum gas are used up inside: no flare, no by-product exit, no circuit wire.

## Size and machines

- Footprint 32 x 10 = 320 tiles, 111 entities (4 chemical plant, 7 display panel, 11 fast inserter, 26 fast transport belt, 3 oil refinery, 51 pipe, 6 pipe to ground, 3 substation).
- 3 oil refineries (`simple-coal-liquefaction`: 10 coal + 2 calcite + 25 acid gives 50 heavy oil in 5 s, 12 crafts a minute each, so 1,800 heavy oil a minute available), 1 heavy-oil cracker (40 heavy + 30 water gives 30 light oil in 2 s), 1 light-oil cracker (30 light + 30 water gives 20 petroleum gas in 2 s), 1 plastic plant (20 gas + 1 coal gives 2 bars in 1 s), 1 lubricant plant (10 heavy gives 10 lubricant in 1 s). All chemical plants and refineries run at speed 1, no modules, no beacons.
- 11 fast inserters (hand size 1; the native force had no inserter capacity bonus), 26 red belts, 51 pipes, 6 pipes-to-ground, 3 substations, 7 display panels.
- The heavy-oil cracker, the light-oil cracker and the plastic plant touch each other and connect box to box: no pipe between them.

Sizing at the targets (from the pinned recipes): plastic 60 a minute is 30 crafts, 600 petroleum gas, 900 light oil, 30 heavy-cracking crafts, 1,200 heavy oil; lubricant 300 a minute is 30 crafts, 300 heavy oil; together 1,500 heavy oil, 30 liquefaction crafts of the 36 the refineries can do (83%). The cracker and the light-oil cracker are each exactly at their 30 crafts a minute at the target, which is the natural count: they also cap plastic at 60 a minute however much is taken, so plastic can never starve the lubricant plant of the 300 it needs.

## Coal cost

- **4.5 coal per plastic bar**: 4 for the heavy oil (a bar needs 10 petroleum gas, which is 20 heavy oil through both crackings, which is 0.4 liquefaction crafts of 10 coal) plus 0.5 in the plastic plant (1 coal per 2 bars). Calcite 0.8 and acid 10 per bar come with the 4 coal.
- **0.2 coal per lubricant** (10 coal for 50 heavy oil, 1 heavy oil per lubricant; calcite 0.04, acid 0.5).
- At 60 plastic and 300 lubricant together: 330 coal a minute (270 + 60), 60 calcite, 750 sulfuric acid, 1,800 water.
- Full coal liquefaction would save (arithmetic only, not built): its craft returns 65 net heavy oil, 20 light oil and 10 petroleum gas for 10 coal, worth 55.8 petroleum gas against 25.0 for a simple-liquefaction craft; so a plastic bar would cost 2.3 coal instead of 4.5 (49% less) and a lubricant 0.15 instead of 0.2 coal, at the price of 50 steam a craft and recycling 25 heavy oil.

## Layout

```
   x 01234567890123456789012345678901
 y0  ================...n....====....
 y1  .DRRRRRRRRRRRRRRR##nDLLL=..=D##D
 y2  ..RRRRRRRRRRRRRRR##i.LLL...=.##.
 y3  ..RRRRRRRRRRRRRRR.PPPLLLHHH=....
 y4  ..RRRRRRRRRRRRRRR.PPP...HHH.....
 y5  D.RRRRRRRRRRRRRRR.PPP...HHH=....
 y6  es.iii^.iii^.iii^..i.......=UUU=
 y7  .eeeeeeeeeeeeeeeeeeee......=UUUD
 y8  en..##v....v....v..........=UUU.
 y9  D...##======================....
```

`R` oil refinery, `H` heavy-oil cracker, `L` light-oil cracker, `P` plastic plant, `U` lubricant plant, `C` carbon plant, `A` assembling machine 3, `#` substation, `D` display panel, `=` pipe, `^ > v <` pipe-to-ground (the arrow is the side of its open pipe connection; its underground runs the other way), `n e s w` red belt (the way it runs), `u`/`o` underground belt in/out, `i` fast inserter, `l` long-handed inserter. Columns count from the west edge and rows from the north edge, both from 0.

- Rows 1 to 5: three refineries (R, facing south, columns 2 to 16), the plastic plant (P), the light-oil cracker (L, rows 1 to 3) and the heavy-oil cracker (H, rows 3 to 5) in one chain, and the lubricant plant (U) below it.
- Row 7 is the one belt. Rows 6 and 8 to 9 carry the arms and the heavy-oil pipes.

## Entrances and exits

All solid entrances are on the west edge, each with a display panel (item or fluid icon, `IN: <material>` and the per-minute figure at the targets). The panel figures are the recipe demand; the throttled run passed with each entrance offered exactly that. Fluid entrances and every exit have panels too.

| Port | Material | Kind | Side | Tile | Panel text | Panel figure | Draw, throttled run | Draw, generous run |
| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: |
| IN-1 | coal | belt | west | (0,6) | `IN: coal 330/min` | 330/min | 330.0/min | 330.7/min |
| IN-2 | calcite | belt | west | (0,8) | `IN: calcite 60/min` | 60/min | 60.0/min | 60.2/min |
| IN-3 | sulfuric-acid | pipe | west | (0,0) | `IN: sulfuric-acid 750/min` | 750/min | 750.0/min | 752.5/min |
| IN-4 | water | pipe | north | (27,0) | `IN: water 1800/min` | 1,800/min | 1800.0/min | 1800.0/min |

| Port | Product | Kind | Side | Tile | Panel text | Target | Measured, throttled run | Measured, generous run |
| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: |
| OUT-1 | plastic-bar | belt | north | (19,0) | `OUT: plastic-bar 60/min` | 60/min | 60.0/min | 60.0/min |
| OUT-2 | lubricant | pipe | east | (31,6) | `OUT: lubricant 300/min` | 300/min | 300.0/min | 300.0/min |

- **Coal and calcite belts** enter at (0,6) and (0,8) and side-load onto the first tile (1,7) of one east-running belt from opposite sides: coal fills the north lane, calcite the south lane. Nothing feeds (1,7) from behind. Each refinery has three arms taking from that belt only what the recipe needs (coal or calcite); the plastic plant has one arm for coal at the far end.
- **Sulfuric acid** enters at (0,0) and runs along row 0 over the three refineries' inputs.
- **Water** enters at (27,0) on the north edge, runs along row 0 to the light-oil cracker's input at (24,1) and down column 27 to the heavy-oil cracker's input at (27,3).
- **Plastic bars** leave on a belt: one arm puts them on (19,1) and the belt runs north to the exit tile (19,0) at the north edge. When nothing is taken it holds 8.
- **Lubricant** leaves at the pipe (31,6) on the east edge. The lubricant plant's other output tile, (31,8), has no pipe.
- Heavy oil: each refinery's output crosses the belt in a pipe-to-ground pair and joins row 9, which runs east to column 27; column 27 feeds the heavy-oil cracker at (27,5) and the lubricant plant at (27,6) and (27,8).

## Power

Three substations: (4,8) west, (17,1) middle and (29,1) north-east. The entry is the north-east one at (29,1), labelled by the display panel `POWER: connect substation` at (31,1). They are wired to each other (copper); connect the outside network to the entry substation (the native test put an outside substation at (34,2) and a 10 MW source on it). Every machine and arm is inside a supply area (checked statically and natively).

## How it balances itself (no circuits)

There is one heavy-oil network and nothing else decides where heavy oil goes: the lubricant plant and the heavy-oil cracker both draw on it.

- **Lubricant not taken**: the lubricant plant fills and stops; all heavy oil goes to the cracker. Plastic stays at its 60 (it is capped there by the crackers, and the refineries have 1,800 heavy oil to give for the 1,200 it needs).
- **Plastic not taken**: the plastic belt backs up, the plastic plant stops, petroleum gas, light oil and the cracker back up in turn; the lubricant plant keeps drawing from the refineries (measured: 300 a minute at the target draw, 600 a minute when taken without limit).
- **Neither taken**: everything backs up to the refineries and stops; no machine crafts in the last 5 minutes of a 15-minute block and none is working at the end. **Taken again**: everything restarts by itself.
- **Fluids never mix**: six pipe networks (acid, heavy oil, light oil, petroleum gas, water, lubricant). The harness proves it natively: every pipe, underground and machine box is checked once a second for a fluid other than its network's, and the game's own fluid segments are compared with the static networks at the start.
- Taking more than 300 lubricant a minute takes heavy oil from the cracker: with both exits taken without limit the exit gave 600.0 lubricant and 60.0 plastic a minute (the refineries' 1,800 heavy oil is exactly 1,200 + 600).

## Native evidence (exact string, 2.1.25, protocol in `native-report.json`)

Research: exactly the technology closure in `manifest.technologyClosure` (40 technologies), nothing else. Surface: Vulcanus (pressure 4000). Every import check passed (121 checks in the throttled run: every entity, recipe, route, machine fluid box, fluid network, power connection and approach). "Drained" means plastic bars taken off the exit belt as fast as they arrive and lubricant taken at its 300 a minute.

- **Rates, throttled run** (each entrance offered exactly its panel figure): plastic 60.0 and lubricant 300.0 a minute at the same time over 30 measured minutes after a 15-minute warm-up; draw coal 330.0, calcite 60.0, sulfuric acid 750.0, water 1800.0 a minute.
- **Rates, generous run** (full belts, full pipes): plastic 60.0, lubricant 300.0; draw coal 330.7, calcite 60.2, acid 752.5, water 1800.0.
- **Lubricant exit blocked 15 minutes**: plastic 60.0 a minute over the last 10 (generous run 60.0).
- **Plastic exit blocked 15 minutes**: lubricant 300.0 a minute over the last 10 (generous run 300.0); with the lubricant exit taken without limit and plastic blocked: 600.0 a minute.
- **Both blocked 15 minutes**: nothing taken, no machine crafted in the last 5 minutes, none working at the end, no foreign fluid, entrances take nothing. Released, the trailing-minute rates are back to 95% after 60 s (plastic) and 60 s (lubricant), throttled run.
- **Five-minute outage of every input**, then recovery: plastic back to 95% after 168 s and lubricant after 60 s (throttled run).
- No pipe, underground or machine ever held a fluid other than its network's; no exit ever held anything but its own product.

Throttled run, by phase (per minute, over the measured part of each phase; the first 5 minutes of a blocked or released phase are not measured):

| Phase (minutes) | Measured | plastic-bar | lubricant | coal in | calcite in | sulfuric-acid in | water in | Back to 95% | Foreign fluid seconds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| warm-up (15) | last 15 | 56.4 | 295.8 | 329.9 | 60.0 | 750.0 | 1777.8 |  | 0 |
| steady (30) | last 30 | 60.0 | 300.0 | 330.0 | 60.0 | 750.0 | 1800.0 |  | 0 |
| lubricant exit blocked (15) | last 10 | 60.0 | 0.0 | 314.6 | 60.0 | 750.0 | 1800.0 |  | 0 |
| release after lubricant block (10) | last 5 | 60.0 | 300.0 | 330.0 | 60.0 | 750.0 | 1800.0 | 60 s / 60 s | 0 |
| plastic exit blocked (15) | last 10 | 0.0 | 300.0 | 60.0 | 12.0 | 150.0 | 0.0 |  | 0 |
| release after plastic block (10) | last 5 | 60.0 | 300.0 | 330.0 | 59.8 | 749.5 | 1800.0 | 60 s / 60 s | 0 |
| both exits blocked (15) | last 10 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |  | 0 |
| release after both blocked (15) | last 10 | 60.0 | 300.0 | 330.0 | 60.0 | 750.0 | 1800.0 | 60 s / 60 s | 0 |
| input outage (5) | last 5 | 8.4 | 300.0 | 0.0 | 0.0 | 0.0 | 0.0 |  | 0 |
| recovery after outage (15) | last 10 | 60.0 | 300.0 | 330.0 | 60.0 | 750.0 | 1800.0 | 168 s / 60 s | 0 |

Generous run:

| Phase (minutes) | Measured | plastic-bar | lubricant | coal in | calcite in | sulfuric-acid in | water in | Back to 95% | Foreign fluid seconds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| warm-up (15) | last 15 | 58.9 | 296.9 | 390.7 | 77.3 | 1011.7 | 1851.9 |  | 0 |
| steady (30) | last 30 | 60.0 | 300.0 | 330.7 | 60.2 | 752.5 | 1800.0 |  | 0 |
| lubricant exit blocked (15) | last 10 | 60.0 | 0.0 | 268.2 | 47.7 | 597.5 | 1800.0 |  | 0 |
| release after lubricant block (10) | last 5 | 60.0 | 300.0 | 328.2 | 59.4 | 745.0 | 1800.0 | 60 s / 60 s | 0 |
| plastic exit blocked (15) | last 10 | 0.0 | 300.0 | 63.0 | 12.6 | 155.0 | 0.0 |  | 0 |
| release after plastic block (10) | last 5 | 60.0 | 300.0 | 328.8 | 58.8 | 750.0 | 1800.0 | 60 s / 60 s | 0 |
| both exits blocked (15) | last 10 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |  | 0 |
| release after both blocked (15) | last 10 | 60.0 | 300.0 | 328.8 | 59.7 | 745.0 | 1800.0 | 60 s / 60 s | 0 |
| input outage (5) | last 5 | 8.4 | 300.0 | 0.0 | 0.0 | 0.0 | 0.0 |  | 0 |
| recovery after outage (15) | last 10 | 60.0 | 300.0 | 335.7 | 61.2 | 767.5 | 1800.0 | 60 s / 60 s | 0 |
| capacity: both exits unlimited (10) | last 5 | 60.0 | 600.0 | 389.4 | 71.4 | 900.0 | 1800.0 |  | 0 |
| capacity: lubricant unlimited, plastic blocked (10) | last 5 | 0.0 | 600.0 | 120.0 | 24.0 | 295.0 | 0.0 |  | 0 |

Per-machine craft counts and status shares in the 30 measured minutes (throttled run):

| Machine | Entity | Recipe | Crafts/min | Status share (one sample a second) |
| --- | --- | --- | ---: | --- |
| liquefaction-1 | #1 | simple-coal-liquefaction | 12.0 | working 100% |
| liquefaction-2 | #2 | simple-coal-liquefaction | 12.0 | working 100% |
| liquefaction-3 | #3 | simple-coal-liquefaction | 6.0 | working 50%, fluid ingredient shortage 50% |
| plastic | #4 | plastic-bar | 30.0 | fluid ingredient shortage 50%, working 50% |
| light-cracking | #5 | light-oil-cracking | 30.0 | working 100% |
| heavy-cracking | #6 | heavy-oil-cracking | 30.0 | working 100% |
| lubricant | #7 | lubricant | 30.0 | working 50%, full output 50% |

The heavy-oil cracker and the light-oil cracker are each at their limit at the target, so plastic sits at 60.0 whenever the refineries can supply it. **Nominal capacity equals the target** for plastic, not above it (the machine count the brief calls natural); the refineries keep 17% of their heavy oil in reserve and the lubricant plant could make 600 a minute.

## What to preserve

- The first belt tile (1,7) must have no belt behind it (the side-loads put coal and calcite on separate lanes).
- Every pipe-to-ground pair: the refineries' heavy-oil outputs cross the belt through them.
- The cracker, the light-oil cracker and the plastic plant must stay edge to edge with their mirror and direction as drawn (the cracker is offset two rows from the light-oil cracker so only one of its output tiles meets the light-oil input; the other meets nothing).
- No pipe on the tiles beside those machines that are not listed: the light-oil cracker's other output tile (20,1) and the lubricant plant's (31,8) must stay empty.

## Reproduce

From `factorio-command-center/`:

```
node scripts/vulcanus-supplies/generate.mjs coal-plastic-lubricant     # writes this folder (byte-identical on re-run; keeps the committed string)
node scripts/vulcanus-supplies/audit.mjs coal-plastic-lubricant        # static audit (36 checks)
node scripts/vulcanus-supplies/validate.mjs coal-plastic-lubricant     # full native protocol, both scenarios (about 3 minutes each, in parallel)
node --test tests/vulcanus-supplies.test.mjs
```

The validator needs the installed Factorio 2.1.25 (Steam, Space Age) and compares its game files with `scripts/vulcanus-supplies/prototypes.json`. It runs in a private profile under `.cache/vulcanus-supplies/` and never touches the player's saves or mod profile. Tests skip what needs the game or the dump.
