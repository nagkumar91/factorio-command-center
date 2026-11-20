# outer-output-belts (19 x 13 = 247 tiles, passed, superseded)

Variant `compact` of `scripts/green-circuits/generate.mjs`, the first published green-circuits blueprint (SHA-256 `44e0e190068346971959c818db05b7e3052150385f523dea2723686a260e1148`, commit 9e83036c4). The two machine rows share one plate belt in the middle, and each row sends circuits out on its own outer belt (rows 0 and 12). Both outer belts dive under the last cable machine and side-load a merge tile, which feeds the straight exit tile from behind.

Result: passed the full protocol (15 / 30 / 5 / 5 / 10 minutes). Steady 360.0/min, recovery 360.0/min, all 10 machines made 2,700 crafts and were working at every one-second sample, the exit held exactly 8 while blocked, every machine stopped, and bulk hands never went above 2. The report in this folder is that run.

Why it is not published: `twin-belt` (19 x 10 = 190 tiles) passes the same protocol with the same rates. It removes the four outer rows (two output belts and their arm rows) by putting a second, circuit belt next to the plate belt in the middle aisle. Long-handed arms reach across the nearer belt. It needs a second substation because one cannot reach every arm without taking tiles the middle cable machine's arms need.
