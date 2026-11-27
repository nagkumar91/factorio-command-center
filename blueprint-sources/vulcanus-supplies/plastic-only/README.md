# Plastic only · 60 plastic bars a minute

**Qualified** in Factorio 2.1.25 Space Age on a Vulcanus surface for the exact string in `blueprint.txt` (SHA-256 `0a1e72b362120745e12618e39b684c118a09364d9e5a6e833f6161bc4fe3a900`): the native protocol passed in all 3 scenarios (steady supply, exit blocked and released, coal withheld 20 minutes, petroleum gas withheld 20 minutes). Report: `native-report.json`.

Makes **plastic bars and nothing else**: 60 a minute on one red belt exit. One chemical plant runs the plastic recipe (1 coal + 20 petroleum gas gives 2 bars in 1 s). There is no lubricant recipe, no lubricant port and no other output: the only thing that leaves is plastic on the exit belt. Vanilla Space Age, fixed recipe, no modules, no beacons, normal quality, one substation, no circuits.

## Which inputs, and why these

The brief let the input set be chosen for the smallest footprint, so the inputs are the plastic recipe's own two: **coal on a belt and petroleum gas by pipe**. Nothing in between is built here, which is why this is 6 x 5 = 30 tiles and one machine. The cost is that petroleum gas has to come from somewhere else on your base. Calcite, sulfuric acid and water are **not** inputs here (they only feed liquefaction and cracking).

If you would rather make the gas on site from coal, the coal-plastic-lubricant chemistry with the lubricant branch dropped needs (arithmetic from the pinned recipes, not built, not tested): 2 oil refineries (simple coal liquefaction, 24.0 crafts a minute), 1 heavy-oil cracker (30.0 crafts a minute), 1 light-oil cracker (30.0 crafts a minute) and this plastic plant, on 270 coal, 48 calcite, 600 sulfuric acid and 1,800 water a minute. That is the coal-plastic-lubricant chemistry with the lubricant plant and one of its three refineries left out; every machine in it would run at its limit, and all the heavy oil goes to the cracker, so none is left to be sold or stored.

## Size and machines

- Footprint 6 x 5 = 30 tiles, 13 entities (1 chemical plant, 4 display panel, 2 fast inserter, 4 fast transport belt, 1 pipe, 1 substation).
- 1 chemical plant, recipe `plastic-bar` (1 coal + 20 petroleum gas gives 2 bars in 1 s): at speed 1 it can do 60 crafts a minute, 120 bars. The target needs 30 crafts a minute (60 bars), so the plant runs at 50% and the supply has headroom: more coal and gas would give up to 120 a minute, and the exit belt and arm carry that.
- 2 fast inserters (hand size 1; the native force had no inserter capacity bonus), 4 red belts, 1 pipe, 1 substation, 4 display panels.
- Panel figures at 60 a minute: coal 30 a minute, petroleum gas 600 a minute.

## Layout

```
   x 012345
 y0  ....##
 y1  PPPD##
 y2  PPPiww
 y3  PPPiee
 y4  =D.DD.
```

`R` oil refinery, `H` heavy-oil cracker, `L` light-oil cracker, `P` plastic plant, `U` lubricant plant, `C` carbon plant, `A` assembling machine 3, `#` substation, `D` display panel, `=` pipe, `^ > v <` pipe-to-ground (the arrow is the side of its open pipe connection; its underground runs the other way), `n e s w` red belt (the way it runs), `u`/`o` underground belt in/out, `i` fast inserter, `l` long-handed inserter. Columns count from the west edge and rows from the north edge, both from 0.

The plant faces south: its petroleum gas input is on the south side, so the one gas pipe is at (0,4). Its two unused fluid ports are on the north side, at (0,0) and (2,0), and **nothing may stand in front of them as a pipe**: no pipe, no pipe-to-ground opening, no other machine port faces them. The static audit and the native run check this.

## Entrances and exit

Both solid ports are on the east edge, the gas pipe on the west edge. Each has a display panel with its item or fluid icon, `IN: <material>` or `OUT: <product>` and the per-minute figure at the target.

| Port | Material | Kind | Side | Tile | Panel text | Panel figure | Draw, throttled run | Draw, generous run |
| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: |
| IN-1 | coal | belt | east | (5,2) | `IN: coal 30/min` | 30/min | 30.0/min | - |
| IN-2 | petroleum-gas | pipe | west | (0,4) | `IN: petroleum-gas 600/min` | 600/min | 600.0/min | - |

| Port | Product | Kind | Side | Tile | Panel text | Target | Measured, throttled run | Measured, generous run |
| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: |
| OUT-1 | plastic-bar | belt | east | (5,3) | `OUT: plastic-bar 60/min` | 60/min | 60.0/min | - |

- **Coal** enters at (5,2) on a belt running west to (4,2); the coal arm (3,2) takes from (4,2) into the plant. One belt, one material.
- **Petroleum gas** enters at the pipe (0,4) on the west edge, which touches the plant's input tile (0,3). It is the only fluid network in the blueprint (one pipe, one fluid). The plant's second input tile (2,4) is left empty on purpose: the two tiles are one fluid box.
- **Plastic bars** leave on the belt (4,3) to (5,3): one arm (3,3) puts them on it and the exit tile is (5,3) at the east edge. When nothing is taken it holds 8.
- There is no second exit and no pipe output. Nothing in this recipe makes lubricant, light oil or heavy oil, so nothing has to be burned off or sold.

## Power

One substation at (4,0), labelled by the display panel `POWER: connect substation` at (4,4). Connect the outside network to it with a wire; its supply area covers the plant and both arms (the native test put an outside substation at (9,1) and a 10 MW source beside it).

## Native evidence (exact string, 2.1.25, protocol in `native-report.json`)

Research: exactly the technology closure in `manifest.technologyClosure` (21 technologies), nothing else. Surface: Vulcanus (pressure 4000). Each scenario is its own game with a fresh import of this string; every entrance is offered exactly its panel figure; the exit belt is emptied every four ticks unless the phase says it is blocked. Pass floor: 57 plastic bars a minute (95% of 60).

- **Steady** (15 minutes warm-up, then 30 measured): 60.0 plastic bars a minute; draw coal 30.0, petroleum gas 600.0 a minute.
- **Exit blocked 15 minutes**: 0.0 bars taken over the last 10; the plant stops on a full output, no machine crafts in the last 5 minutes and the entrances take nothing. **Released**: back to 95% after 60 s; 60.0 a minute over the measured part.
- **Coal withheld 20 minutes from a cold start**: 0.0 bars (none can be made); **supplied**: back to 95% after 60 s, 60.0 a minute over the measured part.
- **Petroleum gas withheld 20 minutes from a cold start**: 0.0 bars; **supplied**: back to 95% after 60 s, 60.0 a minute.
- Every pipe and machine fluid box was read every second in every scenario: nothing but petroleum gas, ever. Only plastic bars appeared on the exit.

Supply scenario by phase (per minute, over the measured part; the first 5 minutes of a blocked or released phase are not measured):

| Phase (minutes) | Measured | plastic-bar | coal in | petroleum-gas in | Back to 95% | Foreign fluid seconds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| warm-up (15) | last 15 | 59.8 | 29.9 | 600.0 |  | 0 |
| steady (30) | last 30 | 60.0 | 30.0 | 600.0 |  | 0 |
| exit blocked (15) | last 10 | 0.0 | 0.0 | 0.0 |  | 0 |
| release (15) | last 10 | 60.0 | 30.0 | 600.0 | 60 s | 0 |

Per-machine craft count and status share in the 30 measured minutes:

| Machine | Entity | Recipe | Crafts/min | Status share (one sample a second) |
| --- | --- | --- | ---: | --- |
| plastic | #1 | plastic-bar | 30.0 | working 50%, item ingredient shortage 50% |

## What to preserve

- Nothing but the one gas pipe on the plant's south side (the tile (2,4) stays empty), and nothing facing the north tiles (0,0) and (2,0).
- The coal belt ends at (4,2) in front of the arm; nothing may feed it from behind and the exit belt must not touch it.
- The exit tile (5,3) is fed only by its own belt.
- The four panels (they are the labels).

## Reproduce

From `factorio-command-center/`:

```
node scripts/vulcanus-supplies/generate.mjs plastic-only     # writes this folder (byte-identical on re-run; keeps the committed string)
node scripts/vulcanus-supplies/audit.mjs plastic-only        # static audit (37 checks)
node scripts/vulcanus-supplies/validate.mjs plastic-only     # native protocol, three scenarios
node --test tests/vulcanus-plastic-only.test.mjs
```

The validator needs the installed Factorio 2.1.25 (Steam, Space Age) and compares its game files with `scripts/vulcanus-supplies/prototypes.json`. It runs in a private profile under `.cache/vulcanus-supplies/` and never touches the player's saves or mod profile.
