# Four science packs from raw materials

Original Factorio Command Center designs for Factorio 2.0.77 with Space Age, on Nauvis. Each factory targets 30 automation, logistic, military and chemical science packs per minute together.

## Electric furnace version

Import `science-four-pack-30-electric.txt`. Connect external electricity to the big pole marked **P**. Supply the six labeled west-side ports: iron ore, copper ore, coal, stone, water and crude oil. Collect the four separate science chests on the east edge. Every intermediate, plate, circuit and chemical is made inside. Coal is used in plastic and grenades; the furnaces use electricity.

The factory uses AM2, electric furnaces, fast transport belts, fast underground belts, fast splitters, fast inserters and medium/big poles. It contains no robots, modules, beacons or quality items. Input display panels and intermediate production controls require circuit network research. Preserve the saved circuit wires and two clock combinators when building.

| Measured output | Items/min |
| --- | ---: |
| Automation science pack | 31.43 |
| Logistic science pack | 29.93 |
| Military science pack | 31.87 |
| Chemical science pack | 30.13 |

| Measured input consumption | Units/min |
| --- | ---: |
| Iron ore | 825.00 |
| Copper ore | 337.50 |
| Coal | 207.53 |
| Stone | 346.47 |
| Water | 1902.67 |
| Crude oil | 1243.33 |

These are measured consumption and collected-output averages after warmup. Feed the input belts continuously and allow startup buffers to fill; measured consumption includes intermediate inventory accumulation. The target test allows a 0.2 pack/min sampling tolerance. Outputs are collected continuously in the benchmark. Full output chests can stop the relevant production chain.

The 412 × 88 tile layout has 7,984 entities and 102 production machines. See [REVIEW.md](REVIEW.md), [validation.json](validation.json) and [throughput.json](throughput.json) for the exact saved-string tests. The website retains each published revision as an immutable record and recommends the newest tested revision by default. Unsuccessful experimental candidates are not published as usable versions.
