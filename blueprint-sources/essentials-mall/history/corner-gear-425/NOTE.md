# corner-gear-425

The first qualified essentials mall: 25 × 17 = 425 tiles and 19 machines. The west zone is three columns wide, with two bulk circuit-admission arms. Fast belts get gear windows 0–1 only. Ring gear limit 48.

`native-report.json` here is its own full-protocol report and says `passed: true` for this exact string (committed in 23a2420ac). Measured steady / recovery per minute:

| | AM2 | fast belt | fast UG | fast splitter | fast inserter | bulk inserter | furnace | drill |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| steady | 5.55 | 9.35 | 2.90 | 2.50 | 14.65 | 1.40 | 1.55 | 3.95 |
| recovery | 5.40 | 9.40 | 2.80 | 2.60 | 12.80 | 1.50 | 1.60 | 3.80 |

It was replaced by the smaller `narrow-west-outer` (24 × 17 = 408), which passed the full protocol itself. That change took three steps:

- A two-column west zone. With only one circuit admission arm, the ring's inner lane at the west column was too full to drop circuits into, so the last circuit consumers starved.
- The fast-inserter reserve moved to the ring's outer lane (fast inserters in the inside row), and the gear limit dropped from 48 to 36 (steel, brick and iron also lowered). This freed space on the inner lane.
- A surplus gear arm on the fast-belt machine (runs while the ring holds more than 24 gears). The fast belt is the last gear consumer on the top belt, so it takes only gears that every windowed consumer let pass. Fast belts rose from about 9 to about 18 per minute.

This candidate stays a valid, slightly roomier alternative. It has more circuit admission headroom: the fast-belt floor margin was its thinnest, at 8.8/min worst during a hold.
