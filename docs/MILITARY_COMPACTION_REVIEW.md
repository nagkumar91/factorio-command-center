# Military science raw module compaction review

The published Military v2 replaces the original layout by default. Military v1 remains available through the website’s version selector, with its original blueprint string and matching native evidence.

## Selected design

The selected blueprint is the existing raw-layout generator’s attempt 186 with one targeted routing change: iron-plate splitter outlets are assigned to grenade first, then steel plate, then firearm magazine. The unprioritized compact layout sent 50% / 25% / 25% of iron-plate flow to steel, firearm, and grenade; grenade then starved at 3.733–3.8 science/min. The explicit consumer order restores the measured baseline rate without adding a machine.

Geometry and counts:

- Footprint: **34 x 30 = 1,020 tiles**, versus the baseline 19 x 77 = 1,463 tiles (about 30% less area).
- Entities: **392**, versus 731 baseline.
- Regular transport belts: **286**, versus 617 baseline.
- Yellow underground endpoints: **46**, versus 54 baseline.
- Splitters: 6; machines: 4 steel furnaces + 5 assembling-machine-2; inserters: 27; poles: 1 big + 12 medium; displays: 4.
- All four inputs remain west-facing and labeled A iron ore, C coal, B copper ore, D stone. The output chest remains the only product output.

Recursive construction expansion, including recipe result yields, is iron ore 1,561.5, stone 80, copper ore 150.5, and wood 2. The baseline is iron ore 2,128, stone 80, copper ore 150.5, and wood 2. This removes 339 placed entities and about 27% of the raw iron-equivalent construction cost.

## Native evidence

Factorio 2.0.77, fixed map seed 12345:

- Functional 45-minute run: `passed: true`; first output tick 9,600; 106 packs delivered; 94 removed at halfway; output restarted; all 32 consumers powered; all four displays verified.
- Throughput 45-minute run with 15-minute warmup and 30-minute collection: `passed: true`; 140 packs collected, **4.6666667/min**.
- Measured input consumption: iron ore 37.5/min, coal 40.1/min, copper ore 2.3667/min, stone 56.2667/min.
- Every machine produced during measurement. The grenade assembler ran 1,125 seconds and completed 113 crafts; the final science assembler completed 70 crafts. The other measured craft counts were iron plate 1,125, firearm magazine 70, steel plate 56, copper plate 71, piercing rounds 36, stone brick 844, and stone wall 169.

SHA-bound evidence:

- Blueprint SHA: `c46f80bc0f1bd30096530c001fbfcbdf00d9ce14d4db25d528c31a74702de01c`.
- Port/configuration SHA: `43813be98270629d84d8c0c4204a92bb79e5222fafbe98e67eaad4c994a631f5`.
- Current source: `blueprint-sources/early-game/early-raw-military-science-pack.txt`.
- Manifest and functional evidence: `blueprint-sources/early-game/manifest.json` and `validation.json`.
- Throughput evidence: `blueprint-sources/early-game/throughput.json`.
- Historical immutable records and evidence: `site/data/early-game/records/early-raw-military-science-pack/` and `snapshots/early-raw-military-science-pack/`.

## Implementation

The shared `scripts/raw-starter-layout.mjs` keeps the consumer recipe on reservation records and accepts an optional iron-plate consumer priority. `scripts/prepare-early-game.mjs` selects placement attempt 186 and the grenade, steel, firearm priority only for Military. Other modules retain their normal routing and attempt order.

This changes how a constrained iron supply is divided. The final pack rate matches the baseline; it does not claim every operating input falls. In particular, brick and wall buffers still fill during the measurement window.

## Reproduction

From the repository root, using isolated cache output:

```sh
STARTER_ATTEMPTS=186 OUT_ROOT=.cache/military-iron-priority \
node scripts/generate-military-layout-candidates.mjs

# Equivalent fixed one-module entry point:
node scripts/rebuild-military-compacted.mjs

STARTER_TEST_IDS=early-raw-military-science-pack \
STARTER_SOURCE_ROOT=.cache/military-iron-priority/attempt-186/blueprint-sources/early-game \
STARTER_TEST_ROOT=.cache/military-iron-priority/attempt-186/native \
node tests/early-game.mjs

STARTER_BENCHMARK=1 \
STARTER_TEST_IDS=early-raw-military-science-pack \
STARTER_SOURCE_ROOT=.cache/military-iron-priority/attempt-186/blueprint-sources/early-game \
STARTER_TEST_ROOT=.cache/military-iron-priority/attempt-186/benchmark \
node tests/early-game.mjs
```

The prior rejected layouts and their reports remain under `.cache/military-layout-candidates/`; the earlier copper-only trial remains under `.cache/military-compaction/` for comparison.

The generator was rerun after the routing option was added. Its trimmed source bytes match the tested blueprint SHA exactly (`c46f80bc0f1bd30096530c001fbfcbdf00d9ce14d4db25d528c31a74702de01c`); no post-test layout edit is required.
