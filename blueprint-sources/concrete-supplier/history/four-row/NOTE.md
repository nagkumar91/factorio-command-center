# four-row (9 x 4 = 36 tiles, superseded by seven-by-five)

The layout published in `926ac81b7`. Machine on rows 1..3 facing west; row 0 holds the three panels and the substation. The lower output arm drops onto (6,3), a belt running straight away from it (south lane); the upper arm drops onto (6,2), which turns south at (7,2) and side-loads (7,3) (north lane); exit (8,3), exit row 3 from the top. 7 belts.

Full protocol passed at 22.5 / 4.5 / 450 (`native-report.json` here, SHA-256 `673b20b13c15ea0d1b890bd14f8184a52f7f04603f532c73afa80f67945f8cd3`): 45.0 steady, 45.0 recovery, 135 crafts, exit 8 = 4 + 4 when blocked, machine stopped on a full output after about 73 s. Superseded because `seven-by-five` (7 x 5 = 35) passes the same protocol in one tile less, at the cost of one more belt.
