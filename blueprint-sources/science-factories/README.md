# Four science packs from raw materials

Each factory targets 30 automation, logistic, military and chemical science packs per minute together, using normal-quality equipment in Factorio 2.0.77 with Space Age on Nauvis. The default electric factory is now version 2. Its original version remains available in the website’s Version dropdown; the steel-furnace factory is also preserved.

## Connections and layout

Supply iron ore, copper ore, coal, stone, water and crude oil at the six labeled west-side ports. Connect external electricity to the big pole marked **P** and collect the four separate science chests on the east edge. Plates, circuits, engines and every other intermediate are made inside.

Electric v2 processes the raw inputs at the west end, then places workshops on both sides of the central bus. Feeders enter at the bus-facing end of each machine row. Intermediate routes stop after their last consumer; separate materials reuse bus rows where their routes do not overlap.

The electric factory uses electric furnaces. The steel factory makes solid fuel from light oil for its furnaces; coal remains a recipe ingredient for plastic and grenades. Both use AM2, the fast belt family, fast inserters and medium/big poles. Preserve the saved circuit wires and two clock combinators. Circuit network research is required for production controls. The six display panels label the inputs; there are no robots, modules, beacons or quality items.

| Version | Selection | Footprint | Entities | Production machines |
| --- | --- | ---: | ---: | ---: |
| Electric v2 | `science-four-pack-30-electric.txt` | 232 × 103 | 4,370 | 103 |
| Electric v1 | Electric factory’s Version dropdown | 412 × 88 | 7,984 | 102 |
| Steel v1, internal solid fuel | `science-four-pack-30-steel.txt` | 421 × 88 | 8,622 | 108 |

Electric v2 uses 34.1% less bounding-box area and 45.3% fewer entities than the published electric v1. It removes 3,494 fast belts, 106 underground-belt endpoints and 17 medium poles, while adding one iron furnace and its two inserters to sustain the balanced outputs.

## Measured rates

| Output | Electric v2 items/min | Solid-fuel items/min |
| --- | ---: | ---: |
| Automation science pack | 30.67 | 33.43 |
| Logistic science pack | 30.00 | 32.27 |
| Military science pack | 30.13 | 32.33 |
| Chemical science pack | 30.87 | 30.33 |

| Raw input | Electric v2 units/min | Solid-fuel units/min |
| --- | ---: | ---: |
| Iron ore | 853.53 | 862.50 |
| Copper ore | 337.50 | 364.30 |
| Coal | 207.53 | 213.10 |
| Stone | 324.00 | 358.27 |
| Water | 1902.67 | 2010.67 |
| Crude oil | 1243.33 | 1653.33 |

Both saved strings passed an empty-start 45-minute functional test with output collection/refill, and a separate 45-minute throughput test with 15 minutes of warmup and 30 minutes of continuous output collection. All four electric v2 outputs measured at least 30/min. The general acceptance floor remains 29.8/min for the 30/min target.

Input rates measure recipe consumption during the benchmark, including intermediate inventory accumulation. The compact factory’s measured iron consumption is higher than v1’s 825/min because of its additional furnace and greater gear startup allowance. Supply raw materials continuously and allow startup buffers to fill. Full output storage can pause production.

See [REVIEW.md](REVIEW.md), [validation.json](validation.json) and [throughput.json](throughput.json) for the matching evidence. The website recommends the newest tested revision and retains earlier published versions in the Version dropdown. Updates are applied manually without refreshing an open page.
