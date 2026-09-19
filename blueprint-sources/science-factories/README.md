# Four science packs from raw materials

Choose either furnace version. Each original Factorio Command Center design targets 30 automation, logistic, military and chemical science packs per minute together, using normal-quality equipment in Factorio 2.0.77 with Space Age on Nauvis.

## Connecting the factory

Import the chosen `.txt` blueprint, supply the six labeled west-side ports, connect external electricity to the big pole marked **P**, and collect the four separate science chests on the east edge. The inputs are iron ore, copper ore, coal, stone, water and crude oil. Plates, circuits, engines and all other intermediates are made inside.

The electric version uses electric furnaces. The steel version makes solid fuel from light oil for every furnace; coal is reserved for plastic and grenades. Both use AM2, fast transport belts, fast underground belts, fast splitters, fast inserters and medium/big poles. Keep their saved circuit wires and two clock combinators connected. There are no robots, modules, beacons or quality items. Circuit network research is required for the production controls; input display panels label each connection.

| Version | Blueprint file | Footprint | Entities | Production machines |
| --- | --- | ---: | ---: | ---: |
| Electric furnaces | `science-four-pack-30-electric.txt` | 412 × 88 | 7,984 | 102 |
| Steel furnaces, internal solid fuel | `science-four-pack-30-steel.txt` | 421 × 88 | 8,622 | 108 |

## Measured rates

| Output | Electric items/min | Solid-fuel items/min |
| --- | ---: | ---: |
| Automation science pack | 31.43 | 33.43 |
| Logistic science pack | 29.93 | 32.27 |
| Military science pack | 31.87 | 32.33 |
| Chemical science pack | 30.13 | 30.33 |

| Raw input | Electric units/min | Solid-fuel units/min |
| --- | ---: | ---: |
| Iron ore | 825.00 | 862.50 |
| Copper ore | 337.50 | 364.30 |
| Coal | 207.53 | 213.10 |
| Stone | 346.47 | 358.27 |
| Water | 1902.67 | 2010.67 |
| Crude oil | 1243.33 | 1653.33 |

Both exact saved strings passed a 45-minute startup/refill test and a separate 45-minute throughput test: 15 minutes of warmup followed by 30 minutes of continuous output collection. Every output passed the 29.8/min acceptance floor for the 30/min target. Input figures measure consumption during that window, including intermediate inventory accumulation. Supply the raw belts and fluids continuously and allow startup buffers to fill; full output chests can pause production.

See [REVIEW.md](REVIEW.md), [validation.json](validation.json) and [throughput.json](throughput.json) for exact evidence and limits. The website recommends the newest tested revision and retains earlier published revisions in its Version dropdown. Unsuccessful experiments are excluded from the usable catalogue.
