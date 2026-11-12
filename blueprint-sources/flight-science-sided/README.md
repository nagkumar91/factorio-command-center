# Six-pack science workshops and supply factories

This separate collection targets the installed Factorio 2.1.24 flight-save recipes. It preserves the previous four-pack collection in `../flight-science/` and does not change the public vanilla 2.0.77 catalogue.

Requested science tiers all target 60/min each red, green, military, blue, purple and yellow science, with inputs on the left and outputs on the right:

1. **Integrated:** make all intermediates inside; import iron/copper/steel plates, plastic, sulfur, coal, walls, stone, sulfuric acid and lubricant. Multiple copper/iron inlets are necessary at these rates.
2. **Hybrid:** circuits, engines and rails inside; import the five heavy ingredients below.
3. **Compact:** additionally import green circuits, red circuits and engines; use the three matching supply factories.

The five heavy ingredients are processing units 40/min, low-density structures 60/min, flying robot frames 20/min, electric furnaces 20/min and productivity module 1s 20/min. Full input arithmetic for all tiers is in `six-input-comparison.json`. Theoretical machine counts are not native-tested layout claims.

## Validated supply factories

| Factory | External inputs/min | Measured output/min | Footprint |
|---|---|---:|---:|
| Green circuits | Iron plates 60; copper plates 90 | 60.00 | 16 × 5 |
| Red circuits | Iron plates 180; copper plates 450; plastic 180 | 89.83 | 55 × 17 |
| Engines | Iron plates 240; steel 60 | 62.93 | 43 × 14 |

Both green and red circuit factories insert wire directly into green-circuit assemblers. Red circuits make their own greens and wire. Engine gears and pipes are internal. Every feeder has exactly one inlet per material, all on the left, and one collection chest on the right. Normal AM2s, fast inserters and red belts; no modules, robots or inserter-capacity research.

Evidence: root `native-report.json` contains all three exact SHA-256-matched builds. It measures 30 simulated minutes after 15 minutes warmup, then blocks output collection for five minutes and tests recovery after two minutes settling over a further three-minute window. All machine recipes craft, every input has a productive physical route, all output ports collect and all machines share the external power network. Red circuits' finite measurement window collects 89.83/min against a 90/min target; the internal two green assemblers each produce exactly 90/min. No claim of exceeding the target steady rate.

## Operation

1. Supply normal-quality items to the labeled left-side belts and electricity at the marked pole.
2. Keep circuit wires and stock settings intact where present. The small green-circuit factory has no circuit dependency.
3. Allow belts and machine buffers to fill; provide extra supply during startup.
4. Collect the right-side chest(s). Their slot limits may be increased; that increases storage, not production speed.
5. Feed the compact science workshop at its listed rates. Standalone feeder evidence does not replace integrated evidence for a combined factory.

## Reproduce and validate

- `node scripts/flight-science-sided/feeders.mjs`
- `RECOVERY=1 node tests/flight-science-sided-native.mjs`
- `node scripts/flight-science-sided/compare-six-inputs.mjs`
- `node scripts/flight-science-sided/catalog.mjs`
- `node scripts/flight-science-sided/preview.mjs`
- `node --test tests/flight-science-sided.test.mjs`
- `node tests/flight-science-sided-browser.mjs`

Native runs use copied mod profiles and private saves. They do not touch the live game. Each science tier has its own generator and native harness under its `full/`, `hybrid/` or `compact/` folder. The root catalogue includes only passing, exact-hash full native reports. `catalog-manifest.json.complete` remains false until all three science tiers plus all three feeders have qualified.

`history/bus-candidates` records oversized, unvalidated exploratory layouts. They are not offered as final designs. The old four-pack prototype source `generate.mjs` is likewise not the six-pack deliverable.
