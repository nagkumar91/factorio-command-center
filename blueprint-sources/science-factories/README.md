# Four science packs from raw materials

Each factory targets 30 automation, logistic, military and chemical science packs per minute together, using normal-quality equipment in Factorio 2.0.77 with Space Age on Nauvis. The default electric factory is **version 3**. Versions 1 and 2 remain available in the website's Version dropdown, and the steel-furnace factory is preserved as a separate choice.

## Electric v3 connections and layout

Supply only iron ore, copper ore, coal, stone, water and crude oil. The six labeled raw-input ports use the distributed port policy and sit beside the processing banks; connect each belt or pipe on its labeled external side. Connect external electricity to the big pole marked **P**. The four indexed science outputs are local chests at the outer ends of their rows: automation is **OUT 1 north**, logistic is **OUT 2 south**, military is **OUT 3 north**, and chemical is **OUT 4 north**. Keep the approach tile beside each port clear for input connections and output collection.

The v3 electric layout is 205 × 100 tiles with 3,517 entities and 104 production machines. It has no full-width science-output buses. Each science collector is reversed toward its own outer end and feeds its nearby chest. Dense mixed C/result lanes use filtered inserters and a rear guide where needed; grouped underground crossings route nine shared physical rows across 22 material routes. Plates, circuits, engines and every other intermediate are made inside from the raw inputs.

The factory uses electric furnaces, AM2 assemblers, fast belts, fast inserters and medium/big poles. Preserve the saved circuit wires and two clock combinators. Circuit-network research is required for production controls. The six display panels label the inputs. There are no robots, modules, beacons or quality items, and no intermediate items or furnace fuel are external inputs.

| Version | Selection | Footprint | Entities | Belts | Underground endpoints | Splitters | Medium poles | AM2 | Production machines |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Electric v3 (default)** | `science-four-pack-30-electric.txt` | **205 × 100** | **3,517** | **2,361** | **312** | **41** | **116** | **55** | **104** |
| Electric v2 | Electric factory's Version dropdown | 232 × 103 | 4,370 | 2,969 | 604 | 41 | 121 | 54 | 103 |
| Electric v1 | Electric factory's Version dropdown | 412 × 88 | 7,984 | 6,463 | 710 | 41 | 138 | 54 | 102 |
| Steel v1, internal solid fuel | `science-four-pack-30-steel.txt` | 421 × 88 | 8,622 | — | — | — | 133 | 57 | 108 |

Compared with electric v2, v3 removes 27 tiles of width, 3 tiles of height, 853 entities, 608 belts, 292 underground endpoints and five medium poles while adding one AM2 and one production machine. That reduces bounding-box area by 14.2% and total entities by 19.5%. The fifth logistic-science assembler provides recovery capacity within the existing footprint. External belts that combine the four science outputs for a lab area are outside this comparison.

## Measured rates

The accepted v3 throughput run used a 15-minute warmup followed by 30 minutes of continuous output collection. It measured:

| Output | Electric v3 items/min | Electric v2 items/min | Solid-fuel items/min |
| --- | ---: | ---: | ---: |
| Automation science pack | **30.70** | 30.67 | 33.43 |
| Logistic science pack | **30.57** | 30.00 | 32.27 |
| Military science pack | **30.67** | 30.13 | 32.33 |
| Chemical science pack | **30.93** | 30.87 | 30.33 |

The same v3 run measured these recipe input deltas during the collection window:

| Raw input | Electric v3 units/min |
| --- | ---: |
| Iron ore | 845.4333 |
| Copper ore | 337.50 |
| Coal | 207.8667 |
| Stone | 327.3333 |
| Water | 1,899.00 |
| Crude oil | 1,240.00 |

These input rates include buffer filling and are not theoretical minimums or a claim that every raw usage drops. Supply the six raw materials continuously and allow startup buffers to fill. Full output storage can pause production.

Two independent native runs passed on Factorio 2.0.77 with map seed 12345. The 45-minute functional run started empty, crafted and powered all 104 production machines, drained 200 items from each output, and verified that all four output ports refilled. The separate 45-minute throughput run used the 15-minute warmup and 30-minute measurement window above; all four outputs exceeded 30/min. The saved blueprint SHA-256 is `8e90fd9029f580e5d1a24cf38987dd811092ff76fddf6a89ac484309183761d1`; its distributed port configuration SHA-256 is `e00124325643dcad7eff6d6252acb22fb24569d8b2b2aaef079a3c5ffa0726c8`.

## Reproduction

The v3 source reproduces the candidate in an ignored cache directory:

```sh
node scripts/science-factory/local-ports/generate.mjs
node scripts/science-factory/local-ports/apply-caps.mjs
```

The output is `.cache/science-factory/reproduce-electric-v3/`. The pinned vanilla prototype dump is required at `.cache/factorio-vanilla/script-output/data-raw-dump.json` (or `FACTORIO_RAW` where supported). See [REVIEW.md](REVIEW.md) for the v3 search limits, preserved v2/v1/steel reviews, and native evidence paths. The public catalogue keeps earlier versions in the Version dropdown; generation does not publish an untested candidate.
