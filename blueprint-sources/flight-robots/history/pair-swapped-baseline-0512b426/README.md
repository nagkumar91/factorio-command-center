# Pair-swapped baseline (before the underground step)

`robots-10-roboport-1.txt` (blueprint SHA-256 `0512b42657485fad93bd0ee47e5999eba11e9f80c58ddc83a29a3035c4677add`) and `manifest.json` are written by `node scripts/flight-robots/generate.mjs`: the published layout before the underground-belt rewrite. 96 × 18, 45 assembling machines 2 and 3 chemical plants. Against the earlier 106 × 18 baseline it drops the last cable assembler (the fourth group is cable + green only) and moves the gear and pipe assemblers to the east end of the bottom row, pipe then gear.

`native-report.json` is this exact string's own full native run (15 minutes warm-up, 30 measured, 45 blocked, 2 settling, 3 measured; same harness and prototype dump as the published report): passed at 10.1 / 10.133 / 1.0 per minute, recovery 13.667 / 17.333 / 1, caps exactly 200 / 200 / 20, no idle machine. It was produced during the 2026-11-21 design review.

The family folder's `native-read-all-snapshot.json` is this baseline's native read-all belt component, which the underground step needs.
