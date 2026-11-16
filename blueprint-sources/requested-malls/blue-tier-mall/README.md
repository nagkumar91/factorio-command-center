# Blue-tier on-demand mall

Reviewable **Factorio 2.1.24 Space Age** candidate: seven AM2s, fast handling inserters, red transport belts, **one passive-provider output chest**, no modules or beacons. The blueprint has **149 entities**. Its full selection envelope is **33 × 13 = 429 tiles**, including display-panel overhang; the occupied construction grid is **33 × 12 = 396 tiles**. External supply infrastructure is excluded. No minimum-area or items/min claim is made.

Import [candidate/blueprint.txt](candidate/blueprint.txt). Inspect the [decoded blueprint](candidate/blueprint.json), [layout schematic](layout.png), [static audit](static-audit.json), and [manifest](manifest.json).

**Status:** 138 static checks and 11 audit tests pass. Native production is **not validated**. The installed 2.1.24 executable and prototype identity were checked, and an isolated native runner was prepared for the integrator. The only game invocation performed for this candidate was an isolated `--dump-data`; it loaded no save. See [native status](validation/native-status.json).

Candidate SHA-256, over the blueprint string with surrounding whitespace removed:

```text
6762edae35e066d821cc12143411004e1fe1b0a3a7cb6e6998360d385f5a867f
```

## Requested outputs and recipes

“Blue inserter” means **fast-inserter**. The corrected scope excludes `stack-inserter` and `stack-filter-inserter`. There are no unrelated output recipes. Every product below is actually assigned to an assembler and has a physical route to the shared provider; construction inventory is not counted as production coverage.

| Product / recipe ID | Ingredients per craft | Result per craft | Recipe seconds | Default stock cap |
| --- | --- | --- | --- | --- |
| `express-transport-belt` | 10 iron gears + 1 fast transport belt + 20 lubricant | 1 | 0.5 | 30 |
| `express-underground-belt` | 80 iron gears + 2 fast underground belts + 40 lubricant | 2 | 2 | 10 |
| `express-splitter` | 1 fast splitter + 10 iron gears + 10 advanced circuits + 80 lubricant | 1 | 2 | 5 |
| `inserter` | 1 electronic circuit + 1 iron gear + 1 iron plate | 1 | 0.5 | 5 |
| `long-handed-inserter` | 1 iron gear + 1 iron plate + 1 inserter | 1 | 0.5 | 5 |
| `fast-inserter` | 2 electronic circuits + 2 iron plates + 1 inserter | 1 | 0.5 | 5 |
| `bulk-inserter` | 15 iron gears + 15 electronic circuits + 1 advanced circuit + 1 fast inserter | 1 | 0.5 | 5 |

AM2 crafting speed is 0.75. The times above are recipe times, not promised production rates. [coverage.json](coverage.json) records exact recipes, ingredients, batch sizes, machine IDs and collecting inserters.

## Stable input boundary

Use **normal-quality** ingredients. There is exactly one entrance for each of seven solid materials and one lubricant entrance. Upstream gears, circuits, red-tier belt items and lubricant are supplied externally; this is an upgrade mall, not an ore-to-products factory. There are no duplicate material entrances and no external yellow/fast/bulk inserter inputs.

Coordinates below are entity centers in the decoded blueprint. Importing can translate the entire layout; relative geometry remains the same. North is negative Y. Solid inputs are labeled **steel chests**, each barred to one slot. Fill those chests manually or with external belt-to-chest inserters. They are not requester chests and do not require robots. The external contact is a clear adjacent tile for an external feeder, not another included chest.

| Port | Material | Chest/pipe center | External contact | Flow | Exact display-panel text | Loop cap |
| --- | --- | --- | --- | --- | --- | --- |
| IN-1 | `iron-gear-wheel` | (2.5, -1.5) | (2.5, -2.5) | North → south | `IN 1: iron-gear-wheel \| N -> S` | 32 |
| IN-2 | `iron-plate` | (4.5, -1.5) | (4.5, -2.5) | North → south | `IN 2: iron-plate \| N -> S` | 12 |
| IN-3 | `electronic-circuit` | (6.5, -1.5) | (6.5, -2.5) | North → south | `IN 3: electronic-circuit \| N -> S` | 32 |
| IN-4 | `advanced-circuit` | (8.5, -1.5) | (8.5, -2.5) | North → south | `IN 4: advanced-circuit \| N -> S` | 12 |
| IN-5 | `fast-transport-belt` | (10.5, -1.5) | (10.5, -2.5) | North → south | `IN 5: fast-transport-belt \| N -> S` | 4 |
| IN-6 | `fast-underground-belt` | (12.5, -1.5) | (12.5, -2.5) | North → south | `IN 6: fast-underground-belt \| N -> S` | 4 |
| IN-7 | `fast-splitter` | (14.5, -1.5) | (14.5, -2.5) | North → south | `IN 7: fast-splitter \| N -> S` | 4 |
| IN-8 | `lubricant` | (-1.5, 9.5) | (-2.5, 9.5) | West → east | `IN 8: lubricant \| W -> E` | Fluid supply |

The material-to-recipe mapping is included in [ports.json](ports.json). Lubricant is the only external fluid. Its surface-pipe manifold reaches the south-facing input of all three express-belt AM2s. No underground crossings are needed; all installed belts are red transport belts. Red underground belts are input ingredients for the express underground recipe, not construction entities in this layout.

**Electricity:** connect an external pole to the medium pole at (1.5, 1.5). The documented external pole position is (-1.5, -3.5), within its wire reach. Its panel reads `POWER: connect medium pole | external electricity`. The included copper network connects nine medium poles and supplies every AM2 and inserter. Provide electricity for the full mall; the validation fixture supplies 5 MW without treating that fixture capacity as a measured load.

**Output:** the sole passive provider is at **(28.5, 2.5)**. Its north collector moves south into the chest; its east collector moves west into the same chest. Two collectors are used because a fast inserter has five filter slots and this mall has seven products. The panel reads `OUT: 3 express belts + 4 inserters | one provider`. Take items directly from this chest, or cover it with an external logistics network.

## Physical routes and on-demand behavior

The 66 red belt tiles form a single clockwise, unbranched closed loop. Input inserters transfer from the seven boundary chests onto the loop. Each AM2 has two filtered ingredient pickup arms and one capped product output arm. Every finished product circulates to one of the two filtered collectors feeding the common provider.

Three always-enabled direct transfers preserve intermediate supply independently of finished-product stock caps:

- `inserter` AM2 → `long-handed-inserter` AM2, westward through (16.5, 6.5).
- `inserter` AM2 → `fast-inserter` AM2, eastward through (20.5, 6.5).
- `fast-inserter` AM2 → `bulk-inserter` AM2, eastward through (24.5, 6.5).

One belt reader reports the entire loop. The provider reports its contents onto the same green circuit. Each input feeder runs while its material count is below its loop cap; each product output arm runs while the sum of that product in the loop and provider is below its stock cap. Taking items from the provider therefore reopens the corresponding output arm. Machines may retain ordinary ingredient/output buffers while idle. Those buffers are not the advertised available stock.

All handling arms have hand size one. The input caps total 100 and product caps total 65. Allowing one additional in-flight item for each of 14 producers gives a conservative circulating bound of **179 items**. These feeds use the inner lane; ignoring all four corner tiles gives at least **248 straight-lane slots**, leaving 69 slots free under this model. At most seven provider slots are needed for the current product caps, including one-item overshoot. This is structural capacity evidence; native liveness is still pending.

Keep the stock caps modest. Increasing all caps without rechecking lane capacity can fill the circulation lane. The generator and audit keep that constraint reviewable. No spoilable material enters this corrected design.

## Tier and technology gates

The prototype snapshot comes from the installed **2.1.24** game with base, Space Age, quality and elevated rails enabled. The user's corrected recipe scope is applied while retaining the original requested 2.1.24 target; backward import compatibility with the site's 2.0.77 catalogue is not claimed.

- **Express products:** `logistics-3`, gated by `production-science-pack` (purple science) and `lubricant`; external lubricant is required.
- **Inserters:** `electronics` for yellow inserters, `automation` for long-handed inserters, `fast-inserter` for blue fast inserters, and `bulk-inserter` for bulk inserters. Bulk requires fast inserters, logistics 2 and advanced circuits; it does not require Gleba.
- **Construction/control:** `automation-2`, `electric-energy-distribution-1`, and `circuit-network` for AM2s, medium poles, circuits and display panels.
- **Provider:** `construction-robotics` is the selected unlock; `logistic-robotics` is an alternative unlock. The chest works as an ordinary container without robots. Robot collection additionally needs an external powered roboport and logistics robots.

No carbon fiber, jelly, agricultural science, Gleba research or stack-inserter technology is required. [technology-prerequisites.json](technology-prerequisites.json) contains the complete 34-technology prerequisite closure in research order, unlock alternatives and science/trigger requirements. Upstream module technologies in that closure are ordinary prerequisites for purple science; no modules are installed in this blueprint.

## Reference review and provenance

Reviewed `mall/compact_turbo_tesla_mall.txt` and `scripts/generate-belt-tesla-mall.mjs`. The source has 1,678 entities and 16 passive providers. Its relevant recipe nodes are 1157 (`inserter`), 1161 (`fast-inserter`), 1165 (`bulk-inserter`), 1170 (`long-handed-inserter`), 1244–1254 (the three express products).

This candidate reuses the source's capped-loop design principle and recipe subgraph with fresh compact geometry. It replaces AM3s, stack handling arms and turbo transport with AM2s, fast handling arms and red transport. Ore processing, Tesla, robots, power infrastructure and all unrelated production chains are omitted. It imports shared intermediates once per material and consolidates finished output into one provider. This is not a measured performance comparison against the much broader source mall.

[reference-review.json](reference-review.json) records source hashes and exact recipe nodes. Frozen source copies are in [references/](references/). Rebuilding uses these frozen copies so later changes elsewhere in the repository do not silently alter provenance. [prototypes.json](prototypes.json) records the native raw-dump hash, installed source hashes, relevant recipes, item stack sizes, collision/connection prototypes and technology data.

The first candidate had two direct-transfer arms outside pole coverage. Its exact blueprint and failing audit are retained under `history/5a9f8b32d4da2491bda1d5bc7116c789e387e1c79a9f93be1ce36d34583e7701/`. The current candidate fixes pole coverage without enlarging the footprint.

## Reproduce and hand off

Run these commands **from this directory**:

```sh
npm run build
npm test
node run-native.mjs --prepare
```

Build regenerates only this artifact set and runs the static audit. Tests deliberately break belt direction, ingredient contacts, direct transfers, fluid taps, collector filters, circuit sensing, wiring, collisions and recipe scope to verify that the audit rejects them. These are experiment-local npm scripts. The repository-root build writes `site/` and `dist/`, so it was not run under the user's path restriction.

For the integrator's isolated native test:

```sh
node run-native.mjs --run
```

The runner checks the candidate and prototype hashes and installed game source identity. It creates a new config, mod directory, force, surface and save under `.runtime/native-<timestamp>/`; it accepts no existing-save argument. It imports and revives the exact blueprint without adding or repairing candidate entities. It supplies only the declared input chests, an external lubricant pipe, and external electricity. It researches only the documented prerequisite closure.

The protocol allows 15 simulated minutes to fill stocks from empty, collects everything, allows 15 minutes to refill, collects again, stops boundary supply for 5 minutes while preserving internal buffers, then restores supply and allows 15 minutes to recover. All seven products must reach their stock caps in each fill phase. The report binds actual recipe/circuit/power/route checks, delivered collections, stock samples and production/consumption statistics to the exact blueprint and configuration hashes. Accepted boundary supply is recorded separately from recipe consumption. There is no items/min threshold.

Current native status is **prepared-not-run**. Native reports will be written under `validation/` only after the integrator runs the command. The schematic is not an in-game screenshot. Benchmark acceptance, actual lane behavior and exact blueprint import remain unverified until then.

`FACTORIO_APP`, or the pair `FACTORIO_DATA`/`FACTORIO_BIN`, may point the runner at another **matching 2.1.24** installation. `npm run prototypes` performs a new isolated prototype dump; it is not required to rebuild this frozen candidate. Runtime configurations, the complete raw dump, logs and future test saves remain in ignored `.runtime/` directories and are not publishing inputs.

No live save, site/index, shared script, queue/ledger, Git history or remote was modified. No files were deleted. Site integration, native acceptance and publishing belong to the integrator. The separate `design-2026-11-13T15-08-43-481Z-fa1cdff5/` work in this directory is not part of this candidate and was not modified by this task.

API references used for the runner and serializer: [BlueprintEntity](https://lua-api.factorio.com/2.1.24/concepts/BlueprintEntity.html), [BlueprintWire](https://lua-api.factorio.com/2.1.24/concepts/BlueprintWire.html), and [transport-belt control behavior](https://lua-api.factorio.com/2.1.24/classes/LuaTransportBeltControlBehavior.html).
