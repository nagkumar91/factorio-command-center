# Robot logistics workshop

Simultaneous targets are 10 construction robots, 10 logistic robots, 1 roboport, 4 storage chests and 4 passive provider chests per minute. The robot rates preserve the user’s chosen profile; four of each chest per minute keeps circuit capacity available for robots. Use the manifest for the exact footprint, machine counts, clock settings and numbered connections.

Native qualification passed on official Factorio 2.1.24 Space Age. The frozen design occupies 106×24 tiles with 53 AM2s and 3 chemical plants. Measured steady delivery was 10 construction robots, 10.23 logistic robots, 1.17 roboports, 4.43 storage chests and 4.37 passive providers per minute; recovery and all five independent stocking phases passed. Qualification remains valid only when `native-report.json` reports `passed: true`, its blueprint SHA-256 matches the current import string and manifest, its prototype/harness/validator hashes match the tested sources, and the sidecar tests pass. Historical or partial runs do not qualify a new blueprint.

## Connections and operation

Supply these six marked WEST entrances. Each material has one exterior entrance; internal branches share that entrance. Electricity is supplied separately at the manifest's power pole.

| Input | Nominal amount/min |
| --- | ---: |
| Iron plates | 500 |
| Copper plates | 621 |
| Steel plates | 149 |
| Plastic bars | 146 |
| Sulfuric acid | 800 |
| Lubricant | 300 |

These are recipe-derived amounts at the declared output rates, not construction costs or a promise that feeding exactly these amounts fills startup buffers. Provide startup and throughput headroom. All circuits, gears, pipes, engines, electric engines, batteries, flying robot frames and steel chests are made internally. No finished intermediates or starter robots are required. The recipe audit uses 290 electronic circuits, 73 advanced circuits and 581 copper-cable crafts (1,162 cable items) per minute.

The design uses AM2s and chemical plants, normal quality, no installed modules, red belts/undergrounds/splitters, and fast, bulk and long-handed inserters. Substations are unlocked and power placement uses `powerFiveLayout`. Native qualification uses the unlock baseline of two items per bulk-inserter hand, with no later capacity upgrades; ordinary fast inserters use the unupgraded baseline. Do not assume later research is required to meet the targets.

All five finished products enter ONE passive provider chest on the EAST. Leave its slot bar unrestricted. `manifest.outputCaps` and each `outputs[].cap` describe the same independent per-product stock settings. Current intended caps are 20 construction robots, 20 logistic robots, 2 roboports, 10 storage chests and 10 passive provider chests. Each product has a separate stock comparison. The collector sits after both lane-balancer branches merge, so it can collect every passing product. Counts include its pending hand as well as the chest, preserving the independent caps. A stocked product must stop entering the chest while other products remain collectable.

The circulating belt has separate stock gates for intermediates. Preserve its red wires, item filters and tile-hold stock readers; each monitored tile contributes its held contents. Chest and pending-item counts, collector-filter permissions, robot export tokens and circulating stock use isolated networks and must not inflate circulating stock counts. Direct internal feeds relieve shared-belt traffic. Robot export tokens persist until pickup, so late frames do not lose a production window. Their hand signals complete the transfer and reset the token. Preserve the chained timer-input bus, token feedback wires and pending-item readers. Roboports and the two chest recipes use the saved short windows. Use the periods and token entity numbers recorded in `manifest.productionClock`.

## Native qualification and reproduction

Run from the repository root:

```sh
node scripts/robot-logistics-workshop/generate.mjs
node scripts/robot-logistics-workshop/validate.mjs
node --test tests/robot-logistics-workshop.test.mjs
```

The generator uses the official Factorio 2.1.24 raw dump below; set `FACTORIO_RAW` to relocate the same snapshot:

```text
/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json
```

Its SHA-256 is `ce40aee67d984865f22ed8e65ba6b93fefb014fc35e45b747b64aca3ed5682a3`. The installed Steam Factorio binary imports the encoded blueprint in a private native harness. Saves, mods, configuration, logs and working reports belong only under ignored `.cache/robot-logistics-workshop/`.

The default protocol warms up for 15 minutes, measures steady collection for 30 minutes, closes collection for 5 minutes while the factory naturally fills its output stocks, allows 5 minutes to settle after reopening, and measures recovery for 10 minutes. Five further phases hold one product at its cap while collecting the other four; each phase settles for 5 minutes and measures for 10 minutes. Consult the current validator and report for the exact executed durations. Short exploratory runs do not replace the full protocol.

Fixtures supply only declared exterior raw-material belt lanes, declared fluid entrances and electricity. Blocking tests only pause collection: they insert no finished products. Intermediate inventories are never injected. The workshop must fill every independent output cap through its own production and refill it while the other four products continue being collected.

A pass requires imported geometry/recipes/wiring/power, no installed modules, every machine crafting during measurement, every solid entrance feeding a productive route, both connected fluid networks accepting fluid, all five steady and recovery rates at least 95% of their declared targets, exact closed-chest caps, and all five individual-product blocking tests. In every individual blocking test the other four products must still reach their respective 95% floors. The roboport floor is **0.95/min**, never a generic target-minus-0.5 allowance.

## Provenance

This is an original generated workshop. Its starting circulation and direct cable-transfer patterns reuse `scripts/flight-robots/generate.mjs` and `scripts/rgby-science/frames.mjs`; local production-clock patterns follow the compact expansion workshop. The native runner/control were copied from `scripts/five-science/validate.mjs` and `control.lua`, then adapted locally for these five products, the shared chest, strict target fractions and independent cap tests. Power uses `scripts/five-science/power.mjs`.

Old flight-robot reports used a different recipe profile and are not production evidence for this blueprint. Only matching official-raw, exact-blueprint native evidence applies. Website publication and integration are handled separately.
