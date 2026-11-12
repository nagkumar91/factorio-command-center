# Additional 30-minute full-storage stress evidence

This is separate diagnostic evidence. The original 5 + 2 + 3 qualification report is preserved. The report’s `privateStressOnly` field identifies its original isolated run, not a replacement qualification.

Blueprint SHA-256: `17fc28fa24029214b1aed34c100fbb8baabc4eb0821bd864d9ceb294bfc97d49`
Cloned Lua harness SHA-256: `2291019d4b17dfd13780f74c0c030e56681baf10e82972718b4b35a27895000f`
Report SHA-256: `f0d9a32b1718cb04026a5cf5696eb4587ba75bb93c13ad243620067d8f9d39f1`

Protocol: 15-minute empty-start warmup, 30-minute steady collection, 30-minute collection pause, original two-minute settling and three-minute recovery measurement.

All six chests: 16 total slots, inventory bar 2, one usable slot, 200/200 science packs. Each chest was full at both endpoints and every one of 120 one-second samples in the final two paused minutes. Science production-statistics deltas and assembler craft deltas were independently zero for every pack.

| Science | Collected/min in recovery | Newly crafted/min in recovery |
| --- | ---: | ---: |
| automation-science-pack | 64.667 | 61.333 |
| logistic-science-pack | 68.333 | 60.667 |
| military-science-pack | 63.333 | 64.000 |
| chemical-science-pack | 65.333 | 63.333 |
| production-science-pack | 89.000 | 66.000 |
| utility-science-pack | 94.333 | 64.000 |

Newly crafted rates use assembler products_finished deltas multiplied by each recipe result quantity, and match native item-production statistics exactly. Collected rates include release of buffered stock.

Passed: all six newly crafted and collected recovery rates >= 59.5/min, full usable chest storage, zero final-two-minute production. Every newly crafted recovery rate also exceeds 60/min.

The exact cloned `control.lua` and unchanged `report.json` are retained here. Use the frozen compact blueprint and manifest with the compact native runner’s payload format, this control file, Factorio 2.1.24 and the recorded prototype identity. The control implements the extended collection pause and the independent craft/statistics observations. Run only in a separate copied profile; do not replace the qualification harness or report. The report records the original runner/configuration hashes for provenance; machine-local runner paths, configurations, caches and mod archives are deliberately excluded.

Payload timing for reproduction (60 ticks/second): `warmup=54000`, `measure=108000`, `recovery={pauseTicks:108000,settleTicks:7200,measureTicks:10800}`. Retain the compact native runner’s entity import, input feeding, research policy and output collection. Write all results to a separate scratch run and disable its authoritative `native-report.json` copy step. The unchanged report retains the original configuration hash, so a different runner is a new reproduction, not the original run.
