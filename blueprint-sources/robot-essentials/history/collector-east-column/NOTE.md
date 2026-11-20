# collector-east-column (qualified, superseded)

The 560-tile design: 35 x 16, 28 machines, published at commit e8e68687b and reviewed. The collector sat east of the ring's east column at (32,3) and the output chest at (33,3); the two extra columns also held nine combinators (the five stock deciders and the storage-chest and passive-provider-chest token parts).

- Evidence: `native-report.json` here is the full-protocol report for this exact string (SHA-256 `75a22bda…7a2a`, `passed: true`): steady 5.27 / 5.4 / 0.57 / 2.2 / 2.2, recovery 5.2 / 5.4 / 0.5 / 2.2 / 2.2, exact blocked caps, all five selective phases, ring peak 358 of 592.
- Why superseded: the reviewer's first size idea. The collector moved above the ring's north-east corner, picking from the curve at (31,0), with the chest above it on the east edge; the nine combinators moved into tiles that were empty. That removes columns 32 and 33 (33 x 16 = 528 tiles) and passed the same full protocol with identical rates.
- Reproduce: `RE_OUT=<dir> RE_OPTIONS='{"cornerChest":false,"oldPowerWording":true}' node scripts/robot-essentials/generate.mjs`
