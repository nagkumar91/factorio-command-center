# straight-exit-east-column (22 x 13 = 286 tiles, passed, superseded)

Variant `reference-straight-exit` of `scripts/green-circuits/generate.mjs`: the spec reference with one straight exit tile added east of the side-load merge, so the exit is fed from behind and holds 8 circuits when blocked.

Result: passed the full protocol (15 / 30 / 5 / 5 / 10 minutes). Steady 360.0/min, recovery 360.0/min, exit held exactly 8 while blocked, every machine stopped, bulk hands at most 2.

Why it is not published: `compact` (19 x 13 = 247 tiles) passes the same protocol with the same rates. It saves three columns: the entrances sit under the first cable machine and turn through curves into the side-load, and the output belts dive under the last cable machine to a merge tile there.
