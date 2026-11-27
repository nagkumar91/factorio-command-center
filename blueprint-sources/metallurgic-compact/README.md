# Metallurgic science packs, one foundry · 16 a minute

**Qualified natively** in Factorio 2.1.25 Space Age on a Vulcanus surface, for the exact string in `blueprint.txt` (SHA-256 `e71c31efd8018efcbd509acf831345267b8733ed1bca46c693c3edab30adc407`). All 5 scenarios below passed (`native-report.json`). The robot network is not part of the test: what robots would deliver is put into the requester chests by script and what they would take is removed from the provider chest by script (see "What the test does not cover").

Makes **metallurgic science packs** from tungsten carbide, tungsten plate and molten copper, 16 a minute, in **one foundry**. The two solid ingredients come from two requester chests that a robot network fills; the molten copper comes in by pipe; the packs go to one passive provider chest capped at one stack. It replaces the 110-entity "Metallurgic science pack · intermediate" flight-factory design, which was built for a mod profile that cannot be used now. Vanilla Space Age, normal quality, no modules, no beacons, no circuit network, no robots inside (no roboports). Vulcanus only: the recipe needs a surface pressure of exactly 4000.

## The recipe, read from the pinned 2.1.25 data

`metallurgic-science-pack`: 10 s in category `metallurgy`, 3 tungsten carbide + 2 tungsten plate + 200 molten copper give 1 pack; allowed only where the surface pressure is 4000. A foundry has crafting speed 4 and built-in productivity 50%, so one foundry does 24 crafts a minute and gives 1.5 packs a craft: up to **36 packs a minute**. The target 16 a minute (the old design measured 15.93; 15 or more was acceptable) needs 10.67 crafts a minute, 44.4% of one foundry.

Productivity makes the extra packs for free, so the ingredients are per craft, not per pack: at 16 packs a minute, 10.67 crafts use 32 tungsten carbide, 21.3 tungsten plate and 2,133.3 molten copper a minute.

## Size and machines

- Footprint **9 × 6 = 54 tiles**, counting every entity (14): 5 display panel, 3 fast inserter, 1 foundry, 1 passive provider chest, 1 pipe, 2 requester chest, 1 substation. The old design had 110 entities (35 substations, 3 roboports, 61 pipes, 3 panels, 5 chests, 1 foundry, 2 bulk inserters) spread over about 49 × 73 tiles.
- Machines: **1 foundry**, no spare machine. It has room to spare instead: it can make 36 a minute (2.25 times the target), so the target never needs a second one. No assembling machine 2 or 3 is used, and none could be: the recipe's category `metallurgy` is crafted only by foundries. (The brief allowed AM2/AM3 "where needed"; none is needed or possible.)
- Inserters: three fast inserters (hand size pinned to 1; the busiest carries 32 items a minute at the target).

## Layout

```
  0 ?iFFFFF..
  1 !.FFFFF.!
  2 ..FFFFFi?
  3 ?iFFFFF##
  4 !.FFFFF##
  5 ...=!..!.
```

`F` foundry, `?` requester or provider chest (west: requesters, east: provider), `i` fast inserter, `=` pipe, `#` substation, `!` display panel. Columns count from the west edge and rows from the north edge, both from 0. A drawing is in `layout.svg`. (The picture shows the chests as `?` because the shared drawing code has no letter for them; the table below names them.)

## Entrances, exit, power

Tiles are counted from the blueprint's top-left tile (column, row). Every port has a display panel beside it with the item, `IN:` or `OUT:` and the per-minute figure.

| Port | What | Kind | Tile | Side | Panel figure | Request or cap |
| --- | --- | --- | --- | --- | ---: | --- |
| IN-1 | tungsten carbide | requester chest | (0, 0) | west | 32/min | requests 64 (2 minutes of use; stack size 50, so two stacks) |
| IN-2 | tungsten plate | requester chest | (0, 3) | west | 21.3/min | requests 43 (2 minutes of use; stack size 50, under one stack) |
| IN-3 | molten copper | pipe | (3, 5) | south, connect at (3, 6) | 2,133.3/min | none |
| OUT-1 | metallurgic science pack | passive provider chest | (8, 2) | east | 16/min | one slot = one stack = 200 packs |

- **Request counts**: 64 tungsten carbide and 43 tungsten plate, each two minutes of the ingredient at 16 packs a minute, rounded up (32 × 2 = 64 and 21.3 × 2 = 42.7). Each chest has the one request at normal quality and nothing else. The panels say the same numbers.
- **Molten copper**: 2,133.3 a minute (35.6 a second) at the target, by one pipe on the foundry's south side. Both of the foundry's input ports are one box for a one-fluid recipe, so one pipe on either feeds it; the pipe stands on the left one and the right one faces nothing.
- **Output**: the foundry's inserter fills the provider chest, which holds one stack (200 packs). When nothing takes the packs the chest fills, the foundry stops with its output full, and it all starts again when robots take packs. At 16 a minute a full chest is about 12.5 minutes of output.
- **Power**: connect the substation at tiles (7–8, 3–4), marked by the panel `POWER: connect this substation` at (7, 5). One substation powers the foundry and the three inserters. The foundry is rated 2.5 MW.

## Fluids

- **molten-copper**: one pipe network of 1 pipe, joined to 1 foundry port.
- One fluid per network, no machine on two fluids, so no pump and no tank is needed. Every port the recipe does not use (the second input port and both output ports) faces nothing.
- The foundry's input-port behaviour comes from the native probe of the Vulcanus circuits family (a foundry recipe with one fluid ingredient uses both input ports as one box). That probe was run for casting iron; this blueprint's table (`scripts/metallurgic-compact/fluid-slots.json`) copies it with the fluid renamed, and the native run above confirms it for this recipe (the one pipe feeds the foundry at full rate and the foundry reports exactly one port on a pipe).

## How it differs from the old 110-entity design

- Same machine and the same idea (one foundry, two requester chests, molten copper by pipe, output to a provider chest). The old one needed 35 substations and 3 roboports, a long pipe run and several displays; this one has one substation, no roboports and one pipe.
- Rewritten for the vanilla 2.1.25 recipe read from the game's own data, not the old mod profile.
- Every input is exactly one labelled entrance with a per-minute figure on its own panel, and the two solid inputs are requester chests with their request counts written on the panel.

## Measured natively

Every figure is from `native-report.json`: 5 scenarios, each its own headless game on a Vulcanus surface (pressure 4000) from a fresh import of this exact string, with only the 46 technologies in `manifest.technologyClosure` researched.

| What is measured | Result |
| --- | --- |
| Packs a minute, every entrance offered exactly its panel figure (30 minutes after 10 minutes of warm-up) | **16** (target 16) |
| Packs a minute, every entrance offered more than it can take (20 minutes) | **36** |
| Foundry state over the panel-figure half hour | item ingredient shortage 56%, working 44%, full output 0% |
| Foundry state offered more | working 100% |

| Port | What | Panel figure | Taken, offered the panel figure | Taken, offered more |
| --- | --- | ---: | ---: | ---: |
| IN-1 | tungsten-carbide | 32/min | 32/min | 72/min |
| IN-2 | tungsten-plate | 21.3/min | 21.3/min | 48/min |
| IN-3 | molten-copper | 2,133.3/min | 2,133.3/min | 4,800/min |

| Scenario | What is done | Verdict | Result |
| --- | --- | --- | --- |
| generous | every entrance offered more than needed; 5 minutes warm-up, 20 measured, then the product exit blocked for 15 minutes, then released for 10 | passed | 36 a minute; with the exit blocked the chest filled to exactly 200 (one stack) and the foundry stopped with its output full (559 of 900 seconds in that state); released, back to the rate in 60 s (36 a minute) |
| panel | every entrance offered exactly its panel figure; 10 minutes warm-up, 30 measured | passed | 16 a minute |
| withheld:IN-1 | tungsten-carbide withheld from a cold start for 20 minutes, then supplied; the others offered more | passed | nothing made while withheld; back to 95% of the target 60 s after supply; 36 a minute over the next ten minutes |
| withheld:IN-2 | tungsten-plate withheld from a cold start for 20 minutes, then supplied; the others offered more | passed | nothing made while withheld; back to 95% of the target 60 s after supply; 36 a minute over the next ten minutes |
| withheld:IN-3 | molten-copper withheld from a cold start for 20 minutes, then supplied; the others offered more | passed | nothing made while withheld; back to 95% of the target 60 s after supply; 36 a minute over the next ten minutes |

### Checks in every scenario

- Import: every entity at its exact position and direction, the recipe, no modules, crafting speed 4 and built-in productivity 50% read from the running game and compared with the pinned data, every panel text, every inserter's pickup and drop where the audit says, the two requests as the game reads them, the provider chest limited to one slot, one electric network.
- Ports: exactly one fluid connection of the foundry stands on a pipe (the copper entrance); the second input port and both output ports face nothing.
- Every second: no fluid but molten copper in the foundry or any pipe; the output chest never holds more than one stack (200); the power stays on.
- All 5 games together simulated 3.3 game hours.

### What the test does not cover

- **The robot network.** Delivery to the requester chests and collection from the provider chest are done by script. Whether robots keep up depends on your network.
- **Placed turned or mirrored, piecemeal construction.** Not run; this is one machine and one pipe, and the blueprint has no belts to break.
- **Different research states.** Only the research needed to build and run it was done.

## Things to know

- Vulcanus only. The recipe's surface condition is pressure 4000; on another surface the foundry will not craft it.
- The requesters ask for 64 and 43; a robot network that is slower than two minutes of use can starve the foundry. Raise the request counts in the game if your deliveries are slow; the panel figures stay the same.
- Research needed (46 technologies in the closure), among them: metallurgic-science-pack (metallurgic-science-pack), foundry (foundry), logistic-system (requester-chest), fast-inserter (fast-inserter), construction-robotics (passive-provider-chest), electric-energy-distribution-2 (substation).
- Arms: three fast inserters carry 1 item a swing (pinned in the blueprint), so inserter capacity research changes nothing here.

## Reproduce

From `factorio-command-center/`:

```
node scripts/metallurgic-compact/generate.mjs      # writes this folder from the pinned data (keeps the committed string)
node scripts/metallurgic-compact/native.mjs        # 5 headless games, about a minute (needs the game)
node --test tests/metallurgic-compact.test.mjs
```

The pinned data is `scripts/metallurgic-compact/prototypes.json`, taken from `factorio --dump-data` of the installed 2.1.25 game by `pin-prototypes.mjs`. The tests need neither the game nor the dump. The native runner needs the installed Factorio 2.1.25 (Steam, Space Age), compares its game files with the pinned snapshot, and runs in private profiles under `.cache/metallurgic-compact/`; it never touches the player's game.
