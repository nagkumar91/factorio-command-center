# Purple advanced circuit component

Import `makePurpleAdvanced(raw)` from `scripts/five-science/advanced.mjs`. Returns the requested component fields without power poles; snapshot supplies a separate removable power grid. Reuses the balanced loop and stock gates from `scripts/rgby-science/blocks.mjs`, extending the rear copper feed pattern in `makeAdvanced`.

16 advanced-circuit AM2s + 3 copper-cable AM2s; no modules. Three rows of 7/6/6 machines. Footprint 31 × 17, bounds x=[-3,28), y=[-6,11). The dedicated rear copper belt serves all three cable machines. Proper lane balancer retained. Two output-transfer bulk inserters have override 3; native research is fast bonus 0, bulk unlock-equivalent bonus +1 only (observed hand maximum 2).

Native Factorio 2.1.24: **119.9/min steady**, **120.8/min recovery**. Ten-minute warmup, ten-minute steady collection, five-minute output pause, five-minute settling, five-minute recovery collection. The output chest reached its barred 200-item capacity during pause. Recovery collection can include buffered output. All 19 assemblers productive, all three inputs productive, power and clear exterior approaches verified. Exact import SHA-256: `9044fd702e1dc1509c2f67abc53c3d494c502b600dd268aab7f0ab1c58c26566`.

Frozen local material ports (do not move during integration):

| Item | Kind | Entity | Position | Approach |
|---|---|---:|---|---|
| copper-plate | input belt | 147 | (-2.5, -5.5) | west; belt east (4) |
| electronic-circuit | input belt | 116 | (-2.5, 1.5) | west; belt east (4) |
| plastic-bar | input belt | 121 | (-2.5, 3.5) | west; belt east (4) |
| advanced-circuit | passive provider | 146 | (23.5, 10.5) | east |

Each input declares 240/min at theoretical 120/min output. Snapshot power port is (-2,-4), entity 175; parent may strip all poles and provide shared substations, then qualify the integrated exact blueprint separately.

Generate with FACTORIO_RAW set to the supplied prototype dump: `node scripts/five-science/advanced.mjs`. Qualify with `RGBY_SOURCE=blueprint-sources/five-science/components/advanced node scripts/rgby-science/validate.mjs` and the same FACTORIO_RAW. `native-report.json` binds production to the exact blueprint and harness hashes; `qualification.json` records generator/dependency SHA-256 values and frozen ports.
