# fast-gear-arm (rejected screen)

Same 35 x 18 layout as the first qualified design (`rear-belt`), but the gear machine took iron from the ring with a fast inserter.

- Screen: `ESSENTIALS_EXPLORE=1`, 10 min warm-up, 10 min measured (`explore-report.json`, `short: true`).
- Failed: logistic robots 4.2/min (floor 4.75). Construction robots 5.3, roboports 0.6, both chests 2.2.
- Diagnostics: the gear machine was short of iron 60% of the time although the ring held its 40-iron limit. A fast arm catches too few of the sparse iron plates passing on the ring. Gears ran short, so engines, then electric engines, then the two downstream frame machines starved (frames 10.5/min); the construction robot machine sits upstream on the top belt and took its frames first.
- Next: one change, the gear machine's iron arm became a bulk inserter (hand 2). Frames rose to 11.3/min and all five products cleared their floors; that candidate qualified.
- Reproduce: `RE_OPTIONS='{"supplyGate":false,"cornerChest":false,"oldPowerWording":true,"rear":true,"acid":"row","gearArms":1,"gearArm":"fast"}'`
