# On-demand inserter workshop

Import `inserter-workshop.txt`. One blueprint, 26×17 tiles, 13 assembling-machine-2s, no modules. Inputs enter from the west once per material: iron plates, copper plates, plastic. Four adjacent east passive-provider chests each stop at **50 items**. `manifest.json` exposes both `outputCaps` and each output's numeric `cap`.

Qualified continuous targets: **15 normal, 15 long-handed, 15 fast, 2.5 bulk inserters/minute**. This is an explicit smaller on-demand alternative to the requested 15/15/15/5 profile. The 5/min bulk attempt did not qualify. This variant retains a short shared loop and compact rear feed rather than extending the transport network. Keep the distinction when presenting its rates. Theoretical material consumption at the declared targets is 422.5 iron plates, 192.5 copper plates and 5 plastic/minute; actual uncapped collection can consume more by exceeding some targets. The originally requested profile needs 560 iron, 272.5 copper and 10 plastic/minute.

All gears, wire and green/red circuits are produced internally. Wire feeds directly between adjacent assemblers; long-handed arms carry extra rear wire into green circuits and local wire across the loop into red circuits. A filtered rear iron/copper line feeds the bottom assemblers. All transport is red belt/underground/splitter. Underground pairs preserve the same direction at both endpoints, with correct input/output order, including the westbound loop bridge. Substations power the build; supply electricity at the manifest's power port.

The workshop adapts the compact-expansion workshop's three-row loop, stock admission and 10-second arithmetic clock, the ring geometry from `scripts/rgby-science/blocks.mjs`, and uses `scripts/five-science/power.mjs` directly. Normal and fast export arms leave a two-item loop reserve for upgrades. Individual one-slot providers bound stock independently; the clock limits competing normal/long/fast ingredient pickups. Preserve all wires, filters, bars and circuit settings. Removing wires changes the tested design.

## Reproduce

From `/tmp/factorio-robot-inserters-20261117`:

```sh
export FACTORIO_RAW='/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json'
node scripts/inserter-workshop/generate.mjs
node scripts/inserter-workshop/validate.mjs
node --test tests/inserter-workshop.test.mjs
```

The copied private validator uses the installed native Factorio binary at `~/Library/Application Support/Steam/steamapps/common/Factorio/factorio.app/Contents/MacOS/factorio` (2.1.24), vanilla Space Age, the supplied official raw prototype dump, fast stack bonus zero, bulk unlock bonus one (actual hand maximum two), and no later upgrades. It uses the five-science cached bulk monitor, not the older full-surface scanning harness. Saves, mods and logs remain exclusively in `ignored.cache/inserter-workshop/`.

Native qualification imports the exact SHA-256-matched blueprint, verifies revived entity positions/directions/recipes and exterior approaches, power for all machines/arms/combinators, imported circuit gate conditions and loop wiring, productive declared inlets and every assembler crafting. Only declared raw-material belt entrances receive ingredients. No intermediates are injected.

The run measures ten minutes after ten minutes warmup, fills only final output providers and blocks collection for five minutes, settles for five minutes, then measures five minutes recovery. Both steady and recovery rates must meet **95% of each declared target**, without an absolute 0.5-item allowance. Finally it independently withdraws 25 normal/long/fast or 10 bulk inserters and requires replenishment to 50 plus new native crafts within five minutes, while the other three providers remain capped and full. `native-report.json` records all four replenishment results and matching blueprint/prototype/harness/validator hashes.

No site changes, global build or Git operations are part of this artifact.
