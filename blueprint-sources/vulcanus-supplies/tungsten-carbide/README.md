# Tungsten carbide supply · 60 a minute

**Qualified** in Factorio 2.1.25 Space Age on a Vulcanus surface for the exact string in `blueprint.txt` (SHA-256 `306d24436400fad190b8f17bd6ff4dc9f22f7e6e3ec3e264a7c17dc81b1c9d36`): the full native protocol passed in both scenarios (entrances offered generously, and each entrance throttled to exactly its panel figure). Report: `native-report.json`.

Makes tungsten carbide from tungsten ore, coal and sulfuric acid and puts it on one red belt exit. Carbon is made inside (one chemical plant, coal and acid), handed to one assembling machine 3 that makes the carbide from the ore, the carbon and more acid. Vanilla Space Age, no modules, no beacons, normal quality, powered by one substation.

## Size and machines

- Footprint 12 x 7 = 84 tiles, 36 entities (1 assembling machine 3, 1 chemical plant, 5 display panel, 6 fast inserter, 13 fast transport belt, 9 pipe, 1 substation).
- One chemical plant (`carbon`, 1 s, 2 coal + 20 acid gives 1 carbon: 60 a minute at speed 1) and one assembling machine 3 (`tungsten-carbide`, 1 s, 2 ore + 1 carbon + 10 acid gives 1 at speed 1.25: 75 a minute available).
- **Target 60 tungsten carbide a minute, the figure of the smallest sensible machine set**: the one carbon plant makes 60 carbon a minute and the carbide needs one carbon each, so the plant is the limit and the assembling machine (which could do 75) runs at 80%. A second carbon plant would lift it to 75 at the cost of another 3 x 3 machine and its arms; not built.
- 6 fast inserters (no stack or bulk inserters; hand size 1, the native force had no inserter capacity bonus), 13 red belts, 9 pipes, 1 substation, 5 display panels.

## Layout

```
   x 012345678901
 y0  =========...
 y1  .D.CCC.AAA.D
 y2  ...CCCiAAAie
 y3  ...CCC.AAA..
 y4  esDii..ii.##
 y5  .eeeeeeee.##
 y6  enD.......D.
```

`R` oil refinery, `H` heavy-oil cracker, `L` light-oil cracker, `P` plastic plant, `U` lubricant plant, `C` carbon plant, `A` assembling machine 3, `#` substation, `D` display panel, `=` pipe, `^ > v <` pipe-to-ground (the arrow is the side of its open pipe connection; its underground runs the other way), `n e s w` red belt (the way it runs), `u`/`o` underground belt in/out, `i` fast inserter, `l` long-handed inserter. Columns count from the west edge and rows from the north edge, both from 0.

## Entrances (west) and exit (east)

All solid entrances are on the west edge; each has a display panel with its item icon, `IN: <material>` and the per-minute figure the blueprint needs at the target. The panel figures are the recipe demand at 60 a minute; the throttled run passed with each entrance offered exactly that.

| Port | Material | Kind | Side | Tile | Panel text | Panel figure | Draw, throttled run | Draw, generous run |
| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: |
| IN-1 | coal | belt | west | (0,4) | `IN: coal 120/min` | 120/min | 120.0/min | 120.0/min |
| IN-2 | tungsten-ore | belt | west | (0,6) | `IN: tungsten-ore 120/min` | 120/min | 120.0/min | 120.0/min |
| IN-3 | sulfuric-acid | pipe | west | (0,0) | `IN: sulfuric-acid 1800/min` | 1,800/min | 1800.0/min | 1800.0/min |

| Port | Product | Kind | Side | Tile | Panel text | Target | Measured, throttled run | Measured, generous run |
| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: |
| OUT-1 | tungsten-carbide | belt | east | (11,2) | `OUT: tungsten-carbide 60/min` | 60/min | 60.0/min | 60.0/min |

- Coal and tungsten ore arrive on two separate entrance belts and meet on the first tile of one east-running belt: coal side-loads from the north onto the north lane, ore from the south onto the south lane. The belt holds one lane of each, so neither can crowd the other out. Both machines' arms take from that belt only what their recipe needs (the carbon plant takes coal, the assembling machine takes ore).
- The acid pipe enters at the west end of row 0 and runs over both machines: the carbon plant's two input tiles and the assembling machine's one input tile are on it. Acid is the only fluid; no other pipe exists.
- The exit is one belt tile at the east edge, fed by one arm; it holds at most 8 bars when nothing is taken.

## Power

One substation at (10,4), labelled by the display panel `POWER: connect substation` at (10,6). Connect the outside network to it with a wire (its supply area covers every machine and arm; the native test put an outside substation three tiles east at (15,5) and a 10 MW source on it).

## Native evidence (exact string, 2.1.25, protocol in `native-report.json`)

Research: exactly the technology closure in `manifest.technologyClosure` (46 technologies, recorded there), nothing else. Surface: Vulcanus (pressure 4000). Every import check passed (59 checks per run: every entity, recipe, filter-free arm, route, fluid network, power connection and approach).

- **Rate, throttled run** (each entrance offered exactly its panel figure): 60.0 tungsten carbide a minute over 30 measured minutes after a 15-minute warm-up; draw coal 120.0, tungsten ore 120.0, sulfuric acid 1800.0 a minute.
- **Rate, generous run** (full belts, full pipe): 60.0 a minute; draw coal 120.0, ore 120.0, acid 1800.0.
- **Exit blocked 15 minutes**: nothing taken, both machines stop on a full output and no machine crafts in the last 5 minutes; the entrances take nothing. Released, the trailing-minute rate is back to 95% after 60 s.
- **Five-minute outage of every input**, then recovery: back to 95% after 60 s.
- No pipe, underground or machine ever held a fluid other than acid (checked once a second); the exit never held anything but tungsten carbide.

Throttled run, by phase (per minute, over the measured part of each phase):

| Phase (minutes) | Measured | tungsten-carbide | coal in | tungsten-ore in | sulfuric-acid in | Back to 95% | Foreign fluid seconds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| warm-up (15) | last 15 | 59.5 | 119.9 | 119.9 | 1800.0 |  | 0 |
| steady (30) | last 30 | 60.0 | 120.0 | 120.0 | 1800.0 |  | 0 |
| exit blocked (15) | last 10 | 0.0 | 0.0 | 0.0 | 0.0 |  | 0 |
| release (15) | last 10 | 60.0 | 120.0 | 120.0 | 1800.0 | 60 s | 0 |
| input outage (5) | last 5 | 4.0 | 0.0 | 0.0 | 0.0 |  | 0 |
| recovery (15) | last 10 | 60.0 | 120.0 | 120.0 | 1800.0 | 60 s | 0 |

Generous run:

| Phase (minutes) | Measured | tungsten-carbide | coal in | tungsten-ore in | sulfuric-acid in | Back to 95% | Foreign fluid seconds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| warm-up (15) | last 15 | 59.8 | 123.5 | 123.3 | 1872.0 |  | 0 |
| steady (30) | last 30 | 60.0 | 120.0 | 120.0 | 1800.0 |  | 0 |
| exit blocked (15) | last 10 | 0.0 | 0.0 | 0.0 | 0.0 |  | 0 |
| release (15) | last 10 | 60.0 | 120.0 | 120.0 | 1800.0 | 60 s | 0 |
| input outage (5) | last 5 | 4.2 | 0.0 | 0.0 | 0.0 |  | 0 |
| recovery (15) | last 10 | 60.0 | 120.0 | 120.0 | 1800.0 | 60 s | 0 |

Per-machine craft counts and status shares in the 30 measured minutes (throttled run):

| Machine | Entity | Recipe | Crafts/min | Status share (one sample a second) |
| --- | --- | --- | ---: | --- |
| carbon | #1 | carbon | 60.0 | working 100% |
| tungsten-carbide | #2 | tungsten-carbide | 60.0 | working 100% |

## What to preserve

- The first belt tile (1,5) must have no belt behind it: it is fed only from the north (coal) and the south (ore). If a belt feeds it from the west, the lanes merge differently.
- The two coal arms (3,4) and (4,4) and the two ore arms (7,4) and (8,4): one arm per machine is not enough for 2 items a second at hand size 1.
- The pipe row over both machines; no other pipe may touch it.
- The exit tile is fed from behind only; nothing may side-load it.

## Reproduce

From `factorio-command-center/`:

```
node scripts/vulcanus-supplies/generate.mjs tungsten-carbide     # writes this folder (byte-identical on re-run; keeps the committed string)
node scripts/vulcanus-supplies/audit.mjs tungsten-carbide        # static audit (36 checks)
node scripts/vulcanus-supplies/validate.mjs tungsten-carbide     # full native protocol, both scenarios (about 2 minutes each, in parallel)
node --test tests/vulcanus-supplies.test.mjs
```

The validator needs the installed Factorio 2.1.25 (Steam, Space Age) and compares its game files with `scripts/vulcanus-supplies/prototypes.json` (pinned from `--dump-data`, `pin-prototypes.mjs`). It runs in a private profile under `.cache/vulcanus-supplies/` and never touches the player's saves or mod profile. Tests skip what needs the game or the dump.
