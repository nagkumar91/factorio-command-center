# Plastic v2 · 115 plastic bars a minute from barrels

**Qualified** in Factorio 2.1.25 Space Age on a Vulcanus surface for the exact string in `blueprint.txt` (SHA-256 `453fb60b8c93c0d5b0f53b8fab661b0ccfeb76626f533348d4a6dbbd41ba2eba`): the short native protocol passed in all 3 scenarios (steady supply at 115 a minute, plastic exit blocked and released, crude barrels withheld 20 minutes, water barrels withheld 20 minutes). Report: `native-report.json`.

Makes **plastic bars and nothing else** on one belt exit: 115 a minute at the target, up to 116.9 a minute when the inputs are offered more (the limit of one oil refinery). The liquids come in as **crude oil barrels** and **water barrels**; two assembling machines 3 empty them (recipes `empty-crude-oil-barrel` and `empty-water-barrel`, 0.2 s each), advanced oil processing makes heavy oil, light oil and petroleum gas, every heavy and light oil is cracked down to petroleum gas, and one chemical plant makes plastic from the gas and coal. Nothing is left over to be burned, stored or exported: the only thing that leaves on a belt is plastic. Vanilla Space Age, fixed recipes, no modules, no beacons, normal quality, fast inserters, red belts, two substations, no circuits, no robots inside.

## Target table (arithmetic from the pinned recipes and machine speeds; every figure is computed, none typed)

Advanced oil processing (100 crude oil + 50 water gives 25 heavy oil, 45 light oil and 55 petroleum gas in 5 s) with all heavy oil cracked to light oil (40 heavy + 30 water gives 30 light in 2 s) and all light oil cracked to petroleum gas (30 light + 30 water gives 20 gas in 2 s) gives 97.5 petroleum gas per refinery craft; plastic takes 10 gas a bar (20 gas and 1 coal give 2 bars in 1 s). One crude barrel holds 50 crude oil, one water barrel 50 water. At speed 1 a refinery makes 12 crafts a minute, so one refinery tops out at 116.9 plastic a minute; a chemical plant makes up to 120 bars a minute.

| Candidate | Plastic a minute | Machines (refinery / heavy / light / plastic / crude assembler / water assembler) | Machine tiles | Footprint | Crude barrels a minute | Water barrels a minute | Empty barrels a minute |
| --- | ---: | --- | ---: | --- | ---: | ---: | ---: |
| start | 60.0 | 6: 1 / 1 / 1 / 1 / 1 / 1 | 70 | 10 x 18 = 180 (this blueprint, built) | 12.3 | 16.3 | 28.6 |
| chosen | 115.0 | 6: 1 / 1 / 1 / 1 / 1 / 1 | 70 | 10 x 18 = 180 (this blueprint, built) | 23.6 | 31.3 | 54.8 |
| ceiling of one refinery | 116.9 | 6: 1 / 1 / 1 / 1 / 1 / 1 | 70 | 10 x 18 = 180 (this blueprint, built) | 24.0 | 31.8 | 55.8 |
| second | 120.0 | 7: 2 / 1 / 1 / 1 / 1 / 1 | 95 | not laid out | 24.6 | 32.6 | 57.2 |
| third | 240.0 | 10: 3 / 1 / 2 / 2 / 1 / 1 | 138 | not laid out | 49.2 | 65.2 | 114.5 |

- **Chosen target 115 a minute**, pass floor 109.25 a minute (95%). The brief started at 60 (the plastic-only supply's size); the same 10 x 18 blueprint already makes 116.9, because the machines are the same for 60 and for 116.9 (one of each): only the barrel and coal figures change. 60 a minute is 51.3% of the refinery, 115 is 98.3%.
- 120 a minute needs a second refinery (and the single plastic plant at 100%), 240 a minute three refineries, two light-oil crackers and two plastic plants: 7 and 10 machines. Those two were not laid out or built (they would repeat the refinery, cracker and plant block of this layout); only the machine counts and tiles are stated.
- The unbarrelling is never the limit: one assembling machine 3 empties 6.3 barrels a second, the target needs 0.4 crude and 0.5 water barrels a second.

## Size and machines

- Footprint 10 x 18 = 180 tiles, 73 entities (2 assembling machine 3, 3 chemical plant, 6 display panel, 5 fast inserter, 22 fast transport belt, 1 long handed inserter, 1 oil refinery, 1 passive provider chest, 20 pipe, 10 pipe to ground, 2 substation).
- 6 machines: 1 oil refinery (`advanced-oil-processing`), 1 heavy-oil cracker, 1 light-oil cracker, 1 plastic plant, 2 assembling machines 3 (`empty-crude-oil-barrel`, `empty-water-barrel`). Machine tiles 70 of the 180.
- The refinery, the three plants and the two assemblers touch each other or are joined by a few pipes and 10 pipes-to-ground; 2 of the 40 fluid connections of the blueprint are machine to machine (direct contact, no pipe between).
- 5 fast inserters, 1 long-handed inserter (the crude barrels sit one belt row further away), 22 red belts, 2 substations, 6 display panels and one passive provider chest.

## Layout

```
   x 0123456789
 y0  eeeeeesn..
 y1  D.....snD.
 y2  =<.D##ii>=
 y3  ^===##PPP=
 y4  .^.HHHPPP=
 y5  .v.HHHPPP=
 y6  .=<HHH>=.=
 y7  .=.==RRRRR
 y8  .LLL^RRRRR
 y9  .LLL.RRRRR
 y10 vLLL.RRRRR
 y11 ==..vRRRRR
 y12 .AAA===AAA
 y13 .AAA=D.AAA
 y14 .AAAi?iAAA
 y15 D.i..##.l.
 y16 eeeD.##...
 y17 eeeeeeeee.
```

`R` oil refinery, `H` heavy-oil cracker, `L` light-oil cracker, `P` plastic plant, `U` lubricant plant, `C` carbon plant, `A` assembling machine 3, `#` substation, `D` display panel, `=` pipe, `^ > v <` pipe-to-ground (the arrow is the side of its open pipe connection; its underground runs the other way), `n e s w` red belt (the way it runs), `u`/`o` underground belt in/out, `i` fast inserter, `l` long-handed inserter. Columns count from the west edge and rows from the north edge, both from 0. `i` fast inserter, `l` long-handed inserter, `e s w n` belts, `?` the passive provider chest.

Every port a recipe does not use faces nothing; the static audit checks this on the port tables probed in the game (`fluid-slots.json`, `unusedPorts`) and the native run checks it again on the built blueprint.

## Entrances, exit and the empty barrels

All three solid entrances are belts on the west edge, the plastic exit is one belt on the north edge. Each has a display panel with its item icon, `IN: <item>` or `OUT: <item>` and the per-minute figure at the target. There is no pipe entrance: the water comes in as barrels as well.

| Port | Material | Kind | Side | Tile | Panel text | Panel figure | Draw, steady native run |
| --- | --- | --- | --- | --- | --- | ---: | ---: |
| IN-1 | crude-oil-barrel | belt | west | (0,17) | `IN: crude-oil-barrel 23.6/min` | 23.6/min | 23.6/min |
| IN-2 | water-barrel | belt | west | (0,16) | `IN: water-barrel 31.3/min` | 31.3/min | 31.3/min |
| IN-3 | coal | belt | west | (0,0) | `IN: coal 58/min` | 58.0/min | 58.0/min |

| Port | Product | Kind | Side | Tile | Panel text | Target | Measured, steady native run |
| --- | --- | --- | --- | --- | --- | ---: | ---: |
| OUT-1 | plastic-bar | belt | north | (7,0) | `OUT: plastic-bar 115/min` | 115.0/min | 115.2/min |

- **Crude oil barrels** (belt, not a chest): the belt on row 17 ends at the long-handed arm over the crude barrel assembler. 23.6 barrels a minute at the target (1179.5 crude oil a minute).
- **Water barrels** (belt): 31.3 barrels a minute (1,563 water a minute: 590 for the refinery, 221 for the heavy cracker, 752 for the light cracker).
- **Coal** (belt): 57.5 a minute.
- **Plastic bars** leave on the exit belt (column 7, north edge); nothing else is ever put on it.
- **Empty barrels are a by-product of unbarrelling and cannot vanish.** Both assemblers hand them to **one passive provider chest** at (5,14) between them, labelled by a display panel (54.8 a minute at the target). It holds 480 barrels (48 slots of 10), which is 8.8 minutes at the target: **something outside must empty it** (logistic robots take from a passive provider chest, or take the barrels out by hand). If the chest fills, the assemblers stop and so does the supply. It is not an output belt and no other item enters it. The native test empties it every four ticks, as logistics would.

## Power

Two substations: the north one at (4,2) is the entry, labelled by the display panel `POWER: connect substation`; the south one is wired to it and covers the barrel end. Connect the outside network to the entry substation with a wire (the native test put an outside substation at (13,3) and a 10 MW source beside it).

## Native evidence (exact string, 2.1.25, protocol in `native-report.json`)

Research: exactly the technology closure in `manifest.technologyClosure` (35 technologies), nothing else. Surface: Vulcanus (pressure 4000). Each scenario is its own game with a fresh import of this string; every entrance is offered exactly its panel figure; the exit belt and the empty-barrel chest are emptied every four ticks unless the phase says the exit is blocked. Pass floor: 109.25 plastic bars a minute (95% of 115). Short protocol (the brief's budget): warm-up 15 minutes, 15 measured.

- **Steady** (15 minutes warm-up, then 15 measured): 115.2 plastic bars a minute; draw crude barrels 23.6, water barrels 31.3, coal 58.0 a minute.
- **Plastic exit blocked 10 minutes**: 0.0 bars taken over the last 5; no machine crafts in the last 3 minutes. **Released**: back to 95% after 60 s; 120.0 a minute over the measured part.
- **Crude barrels withheld 20 minutes from a cold start**: 0.0 bars; **supplied**: back to 95% after 73 s, 114.9 a minute over the measured part.
- **Water barrels withheld 20 minutes from a cold start**: 0.0 bars; **supplied**: back to 95% after 96 s, 115.4 a minute.
- Every pipe and machine fluid box was read every second in every scenario: no foreign fluid, ever. Only plastic bars appeared on the exit and only empty barrels in the chest.

Supply scenario by phase (per minute, over the measured part):

| Phase (minutes) | Measured | plastic-bar | crude-oil-barrel in | water-barrel in | coal in | Back to 95% | Foreign fluid seconds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| warm-up (15) | last 15 | 112.7 | 23.5 | 31.3 | 57.9 |  | 0 |
| steady (15) | last 15 | 115.2 | 23.6 | 31.3 | 58.0 |  | 0 |
| exit blocked (10) | last 5 | 0.0 | 0.8 | 0.0 | 0.0 |  | 0 |
| release (10) | last 7 | 120.0 | 24.0 | 31.9 | 58.0 | 60 s | 0 |

Per-machine craft count and status share in the 15 measured minutes:

| Machine | Entity | Recipe | Crafts/min | Status share (one sample a second) |
| --- | --- | --- | ---: | --- |
| refinery | #1 | advanced-oil-processing | 11.8 | working 98%, fluid ingredient shortage 2% |
| heavy-cracking | #2 | heavy-oil-cracking | 7.4 | fluid ingredient shortage 75%, working 25% |
| plastic | #3 | plastic-bar | 57.6 | working 96%, fluid ingredient shortage 4% |
| crude-barrels | #4 | empty-crude-oil-barrel | 23.6 | item ingredient shortage 94%, working 6% |
| light-cracking | #5 | light-oil-cracking | 25.1 | working 84%, fluid ingredient shortage 16% |
| water-barrels | #6 | empty-water-barrel | 31.3 | item ingredient shortage 92%, working 8% |

## What to preserve

- The pipe runs and undergrounds exactly as drawn: the light-oil and petroleum-gas tunnels cross under other runs, and two same-axis tunnels never overlap.
- Nothing in front of a machine port that its recipe does not use, and nothing but the pipes shown on the used ones.
- The three entrance belts end in front of their arms; nothing may feed them from behind. The exit tile is fed only by its own belt.
- The panels (they are the labels) and the empty-barrel chest being emptied.

## Reproduce

From `factorio-command-center/`:

```
node scripts/vulcanus-supplies/generate.mjs plastic-v2     # writes this folder (byte-identical on re-run; keeps the committed string)
node scripts/vulcanus-supplies/audit.mjs plastic-v2        # static audit (37 checks)
node scripts/vulcanus-supplies/validate.mjs plastic-v2     # native protocol, three scenarios
node --test tests/vulcanus-plastic-v2.test.mjs
```

The member's own pins (`scripts/vulcanus-supplies/plastic-v2/prototypes.json`, `fluid-slots.json`) come from the same official dump as the family pins: `pin-prototypes.mjs plastic-v2` and `probes/ports.mjs plastic-v2`. The machine placement was found by a search over the port tables (direct contacts first, then pipe runs with undergrounds, checked by the same fluid model as the audit); the generator holds the result as data.

The validator needs the installed Factorio 2.1.25 (Steam, Space Age) and compares its game files with `scripts/vulcanus-supplies/prototypes.json`. It runs in a private profile under `.cache/vulcanus-supplies/` and never touches the player's saves or mod profile.
