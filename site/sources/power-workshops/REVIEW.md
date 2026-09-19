# Electric power workshops review

This collection contains three deterministic raw-input blueprints:

| ID | Outputs, in chest/port order | Raw ports | Footprint | Entities | Production machines |
| --- | --- | --- | ---: | ---: | ---: |
| `power-poles-substation` | medium electric pole, big electric pole, substation | iron ore, copper ore, coal, crude oil | 37 x 44 | 610 | 12 |
| `solar-raw-am2` | accumulator, solar panel, substation | iron ore, copper ore, coal, water, crude oil | 37 x 50 | 699 | 14 |
| `solar-raw-am3` | accumulator, solar panel, substation | iron ore, copper ore, coal, water, crude oil | 37 x 50 | 699 | 14 |

Each entry has three separate wooden output chests and static input display panels. The pole workshop uses three electric furnaces, seven AM2 assemblers, one refinery and one chemical plant. Each Solar copy uses three electric furnaces, one refinery, four chemical plants and six assemblers; the AM2 copy uses AM2 for assembly and the AM3 copy uses AM3. Every furnace is an `electric-furnace`; no burner fuel, modules, beacons, robots, quality, roboports or hidden processed inputs are present. A big pole marked `P` is the sole external power connection and medium poles are wired into that network.

The Solar source scope follows the existing community entries `Solar (AM2)` (`autosaved-614f2f4c2ed1acc9`) and `Solar (AM3)` (`autosaved-7ebdfc78270f2c20`) from [autosaved.org](https://autosaved.org/factorio/blueprints). The raw copies retain their three products and recipe family, while regenerating the production chain from ore and fluids. The original entries are not modified. Water, coal and crude oil are necessary raw ports for the internal battery, sulfuric-acid and plastic/advanced-circuit recipes; removing any of them would import a processed intermediate.

The current source is the pole-optimized revision of these layouts. A deterministic connected-coverage pass retains the marked big pole, removes only redundant medium poles and rebuilds only pole-to-pole wires. Every non-pole entity, recipe, belt/pipe route, inserter, display, output port and external power port remains unchanged. The pole/substation layout changes from 48 to 22 medium poles and 636 to 610 entities; each Solar layout changes from 50 to 24 medium poles and 725 to 699 entities. The pole/substation footprint is 37 x 45 before pruning and 37 x 44 after; Solar remains 37 x 50.

Each removed medium pole saves one medium-electric-pole item. Its vanilla recipe is 4 iron sticks, 2 steel plates and 2 copper cables, so each blueprint saves 26 medium poles, 104 iron sticks, 52 steel plates and 52 copper cables. Expanded through the vanilla ingredient recipes, that is 364 iron plates and 52 copper plates of raw-equivalent ingredients. These are direct pole-recipe deltas; the measured production rates and raw-feed consumption are unchanged. The previously published pole layouts remain the v1 immutable records when this revision is indexed.

The measured before/after comparison is exact over the same 45-minute run (15-minute warmup, 30-minute measurement):

| ID | Output rates, v1 → v2 per minute | Raw consumption, v1 → v2 per minute |
| --- | --- | --- |
| `power-poles-substation` | medium 0.6000 → 0.6000; big 0.2333 → 0.2333; substation 0.2333 → 0.2333 | iron 37.5 → 37.5; copper 25.7 → 25.7; coal 3.8333 → 3.8333; crude 170 → 170 |
| `solar-raw-am2` | accumulator 0.8667 → 0.8667; solar 0.3333 → 0.3333; substation 0.1667 → 0.1667 | iron 37.5 → 37.5; copper 33.3333 → 33.3333; coal 2.3333 → 2.3333; water 325.6667 → 325.6667; crude 770 → 770 |
| `solar-raw-am3` | accumulator 0.8667 → 0.8667; solar 0.3333 → 0.3333; substation 0.1667 → 0.1667 | iron 37.5 → 37.5; copper 33.5 → 33.5; coal 2.3333 → 2.3333; water 325.6667 → 325.6667; crude 770 → 770 |

The condensation pass used bounded routing attempts. Attempt 34 was selected for the pole workshop; attempt 2 was selected for both Solar layouts. A tighter pitch 8/9 search did not produce a collision-free routed layout, so the tested pitch-10 Solar layout was kept. Compared with each 45 x 41, 666-entity community Solar blueprint, the current raw copy is 37 x 50 with 699 entities (the pre-optimization raw layout had 725): it is 8 tiles narrower and has essentially the same rectangular area while adding the required raw metallurgy and fluid chain. The raw copies remove the originals' 118/147 efficiency modules, roboport, fast transport tiers and imported intermediate lanes. The added cost is 3 electric furnaces, 1 refinery, 4 chemical plants, 5 input displays, extra pipe/belt routing and raw-feed inserters. This is a self-contained raw workshop comparison; the imported community material count is not a fair production-cost baseline.

## Native validation

The functional run used Factorio 2.0.77, map seed 12345, full exterior raw belt supply for workshops, continuous fluid fixtures and the external P network. It ran 30 simulated minutes, emptied output chests at the midpoint, and required every output and every production machine to resume. All three passed:

| ID | First output (tick) | Delivered at end | Half-drain/restart | Power | Furnace evidence |
| --- | ---: | --- | --- | --- | --- |
| `power-poles-substation` | 17,520 | medium 9, big 3, substation 4 | passed | 1 big + 22 medium, 43 checked consumers | 3/3 powered for 1,800 s; burner inventories empty |
| `solar-raw-am2` | 11,100 | accumulator 13, solar 5, substation 2 | passed | 1 big + 24 medium, 48 checked consumers | 3/3 powered for 1,800 s; burner inventories empty |
| `solar-raw-am3` | 10,800 | accumulator 13, solar 5, substation 2 | passed | 1 big + 24 medium, 48 checked consumers | 3/3 powered for 1,800 s; burner inventories empty |

The exact functional evidence is in `validation.json` alongside these sources. It includes `power.allConnected`, saved-source input samples and empty electric-furnace fuel inventories.

## Throughput validation

The benchmark ran 45 simulated minutes with a 15-minute warmup and 30-minute measurement window. Output chests were collected continuously after warmup; the rate basis is the measured output collection. Rates below are per minute:

| ID | Output rates | Raw consumption rates |
| --- | --- | --- |
| `power-poles-substation` | medium 0.6000, big 0.2333, substation 0.2333 | iron 37.5, copper 25.7, coal 3.8333, crude 170 |
| `solar-raw-am2` | accumulator 0.8667, solar 0.3333, substation 0.1667 | iron 37.5, copper 33.3333, coal 2.3333, water 325.6667, crude 770 |
| `solar-raw-am3` | accumulator 0.8667, solar 0.3333, substation 0.1667 | iron 37.5, copper 33.5, coal 2.3333, water 325.6667, crude 770 |

The exact benchmark evidence is in `throughput.json` alongside these sources. The main bottlenecks are the single iron furnace at 37.5 ore/min, shared copper cable/electronic-circuit routing, and the single advanced-circuit branch feeding substations and Solar panels. AM3 increases assembler speed but does not increase rates because upstream raw smelting and circuit allocation are already limiting. The rates are measured window averages under the supplied raw-feed fixture, not a mathematical maximum.

The tested blueprint SHA/config SHA pairs are:

| ID | Blueprint SHA-256 | Port/config SHA-256 |
| --- | --- | --- |
| `power-poles-substation` | `28522fd9ea8fe4f5578ef98f5423997dab9f92a1226d4a04c80827518379d942` | `fa958684387784885483c5c1430ae64e3978d1a861dda5180c8b4d8f0ad86f55` |
| `solar-raw-am2` | `1b4bbf42f4cca85a42cb0cdc80f5362ad194f1f09d9ebaddc5ca717088e6fb` | `f0a3d9a960c387da843c5c2e14488cfa5feafa6c9aca692c333754c656d8fd12` |
| `solar-raw-am3` | `a567e90951bb81c260fc71f4d5b36cf7d72f5c8ebfd5bec4862b555f17998401` | `78595b4b9b4591add998ad459f0ad4767983ce2a073f00e33abdacbc49f814b6` |

## Reproduction

From the canonical project root, with the raw dump available:

```sh
FACTORIO_RAW=/Users/nagkumar/clawd/workspaces/factorio-command-center/.cache/factorio-vanilla/script-output/data-raw-dump.json \
POWER_WORKSHOP_OUT=.cache/power-workshops/reproduced \
node scripts/generate-power-workshops.mjs

STARTER_TEST_IDS=power-poles-substation,solar-raw-am2,solar-raw-am3 \
STARTER_SOURCE_ROOT=.cache/power-workshops/reproduced \
STARTER_TEST_ROOT=.cache/power-workshops/native-functional30-canonical-evidence \
SIMULATED_MINUTES=30 \
node tests/power-workshops.mjs

STARTER_BENCHMARK=1 STARTER_TEST_IDS=power-poles-substation,solar-raw-am2,solar-raw-am3 \
STARTER_SOURCE_ROOT=.cache/power-workshops/reproduced \
STARTER_TEST_ROOT=.cache/power-workshops/throughput45-canonical-evidence \
SIMULATED_MINUTES=45 \
node tests/power-workshops.mjs
```

The reproducible generator is `scripts/generate-power-workshops.mjs`; its routing helper is `scripts/power-workshop-layout.mjs`, its deterministic pole pass is `scripts/power-pole-optimization.mjs`, and the isolated native runner is `tests/power-workshops.mjs`. The source files and both reports are preserved in this collection; publication checks their blueprint and configuration hashes.
