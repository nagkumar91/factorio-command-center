## Compact solid-fuel science upgrade

Use `fast-science-solid-fuel-book.txt`: the complete connected factory and its two separately placeable parts are included. `solid-science-complete.txt` includes every plate/circuit transfer, the iron-output merger and power bridge. Supply iron ore, copper ore and **finished solid fuel** at the three west entrances, plus electricity at P. The factory does not manufacture solid fuel. Red and green science output chests are adjacent. Keep both separate red stock networks, intermediate chests and stock caps. Leave the inherited east gear tap unused in the complete factory; it is not a supported feed for this version. Native raw-only measurement: **36 red / 30 green packs per minute**; recovery after full output storage: **36 / 29.8**. The feeder measured 222.7 iron plates, 58.1 copper plates and 36 green circuits per minute simultaneously. The exploratory gear-feed recovery shortfall is retained in `supplemental-observation.json` rather than advertised as a supported mode.

The new feeder is **29 × 16 tiles (464 tiles)** versus the prior dedicated feeder at 40 × 26 (1,040 tiles): **55.4% less area**. It has **10 steel furnaces and two AM2s**, produces only iron plates, copper plates and green circuits, and uses red belts and fast inserters without modules. The separate science loop remains 32 × 17 with 11 AM2s. The connected blueprint is 66 × 17, including the transfer connections; it uses 10 steel furnaces and 13 AM2s in total.

If placing the two parts separately, extract from **both iron chests** with fast inserters and merge onto one belt. Copper plates and green circuits each have one output chest. All furnace fuel is supplied solid fuel, not coal. Existing coal blueprints remain available for comparison.

Reproduce the new upgrade with `solid-science-feeder.mjs`, then `connect-solid-science.mjs`, then `LOOP_IDS=science-solid-feeder,solid-science-complete SUPPLEMENTS=1 node scripts/early-controlled-loops/validate.mjs`, then `preview.mjs` (all scripts are under `scripts/early-controlled-loops/`). Native report hashes must match the exact blueprint imports.

# Raw feeders and controlled production loops

## Faster red and green science

Use `fast-red-green-book.txt` for the dedicated science feeder and upgraded science loop. The loop is 32 × 17 tiles with 11 AM2s: four automation-science assemblers, four logistic-science assemblers, and one each for gears, yellow belts and inserters. It uses red belts, fast inserters and circuit stock controls, without modules. Native measurement: 36 red and 30 green packs/minute; after full output storage, 35.8 red and 30.2 green/min. Optional gear feed also passed recovery after lowering the stock caps to leave clear space on a single belt lane.

The matching supplier is 40 × 26 tiles with 13 steel furnaces and two AM2s. Feed iron ore, copper ore and coal. It measured 233.7 iron plates, 75.6 copper plates and 45.7 green circuits/minute simultaneously, sufficient for the loop’s recommended 210/36/30 input rates. Use fast extraction inserters at BOTH iron chests and merge their output belts with a red splitter; a single iron extraction line is too slow. Copper plates and green circuits each have one labeled output chest. The original feeder is retained for the other workshops and steel production.

Red belts alone do not raise the original one-AM1-per-colour crafting limit of 6 red/5 green per minute. The upgrade adds science assemblers and uses AM2 crafting speed; the faster belt and inserters support that throughput.

Generate upgrades after the base collection with `node scripts/early-controlled-loops/fast-science.mjs` and `node scripts/early-controlled-loops/science-feeder.mjs`, then run native validation and preview generation. Both new blueprints have exact-hash native evidence including startup, simultaneous outputs and blocked-storage recovery.


A shared raw-material feeder and three compact AM1 workshops adapted from the earlier Flight Science circulating-belt design (`scripts/flight-science/compact.mjs`). Each blueprint has one closed yellow-belt loop. Red wires connect its whole-belt reader, ingredient inserters and stock-limited assembler outputs. Ordinary filtered inserters and AM1s need no installed modules or robot supply. Circuit network and the displayed production research are required.

Open `index.html` for the exact layouts, import strings, required feeds, optional interim feeds, and per-item stock caps. All assets are local. The book contains all three blueprints.

| Group | Tiles | AM1 | Required external inputs | Optional supplement |
|---|---|---|---|---|
| Raw ore + coal feeder | 48 × 36 | 2 AM1 + 22 steel furnaces | Iron ore, copper ore, coal | None needed |
| Red + green science | 23 × 17 | 5 | Iron plates, copper plates, green circuits | Gears |
| Red belt family | 26 × 17 | 7 | Iron plates, green circuits | Gears (recommended) |
| AM2 and poles | 26 × 17 | 7 | Iron plates, copper plates, steel, green circuits | Copper cable, iron sticks |

Build the raw feeder first: its three west inputs take iron ore, copper ore and coal. Connect external electricity. Its four finished-material chests are aligned on the east edge, with icons identifying iron plates, copper plates, steel and green circuits. Add output inserters/belts to those chests and split those supplies to the workshop input ports. The feeder uses fast inserters and yellow undergrounds to pass its isolated export belts under its stock loop. The small workshop footprints exclude this shared supplier. Leave the optional workshop inputs empty initially; their gears/cable/sticks are made internally. Gears/cable/sticks are made inside when the optional feeds are empty. Optional injection uses the same item stock signal as internal producer output, so their producers pause as circulating stock fills. Machine inventories and items in inserter hands are excluded from belt stock signals.

Upstream gear and selected subrecipe inputs keep minimum iron reserves for downstream recipes. The transport loop also uses three arithmetic combinators to assign finished-product input inserters alternating ten-second windows; keep these wires and combinators. This is an on-demand low-volume mall, with individual one-stack iron output chests. They can be upgraded to passive provider chests after the research is unlocked.

## Native evidence

`native-report.json` matches all three exact blueprint hashes. Ten cases (both raw feeders, and required-only/supplemented inputs for each workshop including upgraded science) passed in isolated Factorio 2.1.24 / Space Age. Inputs are inserted only into declared exterior belt lanes, with electricity at P. No machine inventories are seeded. The harness checks imported geometry/recipes, the whole-belt reader mode, connected controllers, one power network, productive routes, every required internal recipe (duplicate feeder furnaces can idle as supply and buffers change) and simultaneous finished output.

Each case simulates 10 minutes of startup, 10 measured minutes, 5 minutes with finished-output storage deliberately filled, 5 minutes settling and 5 measured minutes of recovery. Filling finished output boxes is a backpressure fixture; it supplies no manufacturing ingredients. Every final product resumed after full storage. The HTML lists the measured output rates, including the transport throughput gain from optional gears.

## Reproduce

Use `FACTORIO_RAW` to point the generator at a private Factorio 2.1.24 vanilla / Space Age raw prototype dump (the default is an existing ignored project cache). Run:

```sh
node scripts/early-controlled-loops/generate.mjs
node scripts/early-controlled-loops/feeder.mjs
SUPPLEMENTS=1 node scripts/early-controlled-loops/validate.mjs
node scripts/early-controlled-loops/preview.mjs
```

The validation profile is private under `.cache/early-controlled-loops/`; it does not touch the user's saves, settings, blueprint library or achievement state. Preview generation copies the self-contained page to `~/Downloads/Factorio Blueprints/early-controlled-loops/`.
