# Electric power workshops review

This collection contains three deterministic raw-input blueprints:

| ID | Outputs, in chest/port order | Raw ports | Footprint | Entities | Production machines |
| --- | --- | --- | ---: | ---: | ---: |
| `power-poles-substation` | medium electric pole, big electric pole, substation | iron ore, copper ore, coal, crude oil | 37 x 45 | 636 | 12 |
| `solar-raw-am2` | accumulator, solar panel, substation | iron ore, copper ore, coal, water, crude oil | 37 x 50 | 725 | 14 |
| `solar-raw-am3` | accumulator, solar panel, substation | iron ore, copper ore, coal, water, crude oil | 37 x 50 | 725 | 14 |

Each entry has three separate wooden output chests and static input display panels. The pole workshop uses three electric furnaces, seven AM2 assemblers, one refinery and one chemical plant. Each Solar copy uses three electric furnaces, one refinery, four chemical plants and six assemblers; the AM2 copy uses AM2 for assembly and the AM3 copy uses AM3. Every furnace is an `electric-furnace`; no burner fuel, modules, beacons, robots, quality, roboports or hidden processed inputs are present. A big pole marked `P` is the sole external power connection and medium poles are wired into that network.

The Solar source scope follows the existing community entries `Solar (AM2)` (`autosaved-614f2f4c2ed1acc9`) and `Solar (AM3)` (`autosaved-7ebdfc78270f2c20`) from [autosaved.org](https://autosaved.org/factorio/blueprints). The raw copies retain their three products and recipe family, while regenerating the production chain from ore and fluids. The original entries are not modified. Water, coal and crude oil are necessary raw ports for the internal battery, sulfuric-acid and plastic/advanced-circuit recipes; removing any of them would import a processed intermediate.

The condensation pass used bounded routing attempts. Attempt 34 was selected for the pole workshop; attempt 2 was selected for both Solar layouts. A tighter pitch 8/9 search did not produce a collision-free routed layout, so the tested pitch-10 Solar layout was kept. Compared with each 45 x 41, 666-entity community Solar blueprint, the raw copy is 37 x 50 with 725 entities: it is 8 tiles narrower and has essentially the same rectangular area while adding the required raw metallurgy and fluid chain. The raw copies remove the originals' 118/147 efficiency modules, roboport, fast transport tiers and imported intermediate lanes. The added cost is 3 electric furnaces, 1 refinery, 4 chemical plants, 5 input displays, extra pipe/belt routing and raw-feed inserters. This is a self-contained raw workshop comparison; the imported community material count is not a fair production-cost baseline.

## Native validation

The functional run used Factorio 2.0.77, map seed 12345, full exterior raw belt supply for workshops, continuous fluid fixtures and the external P network. It ran 30 simulated minutes, emptied output chests at the midpoint, and required every output and every production machine to resume. All three passed:

| ID | First output (tick) | Delivered at end | Half-drain/restart | Power | Furnace evidence |
| --- | ---: | --- | --- | --- | --- |
| `power-poles-substation` | 17,520 | medium 9, big 3, substation 4 | passed | 1 big + 48 medium, 43 consumers | 3/3 powered for 1,800 s; burner inventories empty |
| `solar-raw-am2` | 11,100 | accumulator 13, solar 5, substation 2 | passed | 1 big + 50 medium, 48 consumers | 3/3 powered for 1,800 s; burner inventories empty |
| `solar-raw-am3` | 10,800 | accumulator 13, solar 5, substation 2 | passed | 1 big + 50 medium, 48 consumers | 3/3 powered for 1,800 s; burner inventories empty |

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
| `power-poles-substation` | `161f75b7184432ed6616f56575101602f51a7fb11e4386deac17b9f610ecff8c` | `9999065137e6561df68c81ee544c616c2576b435524629b2599547935528f06b` |
| `solar-raw-am2` | `038b41c1a17927d880dce655b5c22896427f257c8185e34deaa6f29c717c5a79` | `80227543d1f8cdda64776411c591e55e8f3cc9de238ee18f87b2c347f54688df` |
| `solar-raw-am3` | `0ae407bf8a6546d6b9624e06528759fae923762b28c2104b5af283c184b798eb` | `731047b6eec2d35ffb8c1f104fd475c198441ee799fb1705cca6a912782030e8` |

## Reproduction

From the canonical project root, with the raw dump available:

```sh
FACTORIO_RAW=/Users/nagkumar/clawd/workspaces/factorio-command-center/.cache/factorio-vanilla/script-output/data-raw-dump.json \
POWER_WORKSHOP_OUT=.cache/transport-workshops/agents/yellow/.cache/power-workshops/blueprint-sources/power-workshops \
node scripts/generate-power-workshops.mjs

STARTER_TEST_IDS=power-poles-substation,solar-raw-am2,solar-raw-am3 \
STARTER_SOURCE_ROOT=.cache/transport-workshops/agents/yellow/.cache/power-workshops/blueprint-sources/power-workshops \
STARTER_TEST_ROOT=.cache/transport-workshops/agents/yellow/.cache/power-workshops/native-functional30-canonical-evidence \
SIMULATED_MINUTES=30 \
node tests/power-workshops.mjs

STARTER_BENCHMARK=1 STARTER_TEST_IDS=power-poles-substation,solar-raw-am2,solar-raw-am3 \
STARTER_SOURCE_ROOT=.cache/transport-workshops/agents/yellow/.cache/power-workshops/blueprint-sources/power-workshops \
STARTER_TEST_ROOT=.cache/transport-workshops/agents/yellow/.cache/power-workshops/throughput45-canonical-evidence \
SIMULATED_MINUTES=45 \
node tests/power-workshops.mjs
```

The reproducible generator is `scripts/generate-power-workshops.mjs`; its routing helper is `scripts/power-workshop-layout.mjs`, and the isolated native runner is `tests/power-workshops.mjs`. The source files and both reports are preserved in this collection; publication checks their blueprint and configuration hashes.
