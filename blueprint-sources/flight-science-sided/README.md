# Six-pack science workshops and supply factories

This separate collection targets the installed Factorio 2.1.24 flight-save recipes. It preserves the previous four-pack collection in `../flight-science/` and does not change the public vanilla 2.0.77 catalogue.

Requested science tiers all target 60/min each red, green, military, blue, purple and yellow science, with inputs on the left and outputs on the right:

1. **Integrated:** make all intermediates inside; import iron/copper/steel plates, plastic, sulfur, coal, walls, stone, sulfuric acid and lubricant. Multiple copper/iron inlets are necessary at these rates.
2. **Hybrid:** circuits, engines and rails inside; import the five heavy ingredients below.
3. **Compact:** additionally import green circuits, red circuits and engines; use the three matching supply factories.

The five heavy ingredients are processing units 40/min, low-density structures 60/min, flying robot frames 20/min, electric furnaces 20/min and productivity module 1s 20/min. Full input arithmetic for all tiers is in `six-input-comparison.json`. Theoretical machine counts are not native-tested layout claims.

The input figures on the science tiers' panels are recipe arithmetic for exactly 60/min of each pack. The qualifying native runs feed the entrances on demand, and there the tiers take about 3 to 7% (compact, hybrid) and 10 to 15% (fully integrated) more of most materials than those figures because several packs run above 60/min. A 2026-11-21 review probe fed every entrance at exactly its panel figure, with unaccepted items queued, using the same 15 + 30 minute protocol: compact measured green 58.83/min and military 59.07/min, hybrid military 55.80/min and green 59.10/min, fully integrated yellow 48.60/min; every other pack stayed at 59.8/min or more. Feed these tiers above their panel figures (the on-demand intake is in each `native-report.json`). The three supply factories reach their targets at exactly their panel figures (green circuits 60.00, red circuits 89.97, engines 60.00/min).

## Validated supply factories

| Factory | External inputs/min | Measured output/min | Footprint | Assemblers |
|---|---|---:|---:|---:|
| Green circuits | Iron plates 60; copper plates 90 | 60.00 | 16 × 5 | 2 |
| Red circuits | Iron plates 180; copper plates 450; plastic 180 | 90.17 | 49 × 16 | 20 (6 wire, 2 green, 12 red) |
| Engines | Iron plates 240; steel 60 | 63.00 | 40 × 13 | 17 (1 gear, 2 pipe, 14 engine) |
| Electric furnaces | Steel plates 200; stone bricks 200; advanced circuits 100 | 20.00 | 15 × 7 | 3 |
| Productivity modules | Advanced circuits 100; electronic circuits 100 | 20.00 | 25 × 7 | 7 |
| Low-density structures | Steel plates 120; plastic bars 300; copper plates 1,200 | 60.00 | 34 × 13 | 20 |
| Processing units | Advanced circuits 80; electronic circuits 800; sulfuric acid 200 (pipe) | 40.00 | 36 × 7 | 9 |
| Flying robot frames | Iron plates 120; copper plates 40; steel plates 40; electronic circuits 100; lubricant 300 (pipe); sulfuric acid 800 (pipe) | 20.03 | 31 × 15 | 24 (21 assemblers, 3 battery chemical plants) |

The last five rows are the compact tier's five south entrance supplies (the purple and yellow block's heavy ingredients), each in `heavy-supplies/<name>/` with its own manifest, native report and README, qualified on the family's flight-21 profile at its panel figures. The flying-robot-frame factory's run at 80% of the feed (15.97 steady, 15.00 in its three-minute recovery window against a proportional 16) is reported in its README and is not a pass bar.

Both green and red circuit factories insert wire directly into green-circuit assemblers. Red circuits make their own greens and wire. Engine gears and pipes are internal. Every feeder has exactly one inlet per material, all on the left, and one collection chest on the right. Normal AM2s, fast inserters and red belts; no modules, robots or inserter-capacity research.

Evidence: root `native-report.json` contains all three exact SHA-256-matched builds. It measures 30 simulated minutes after 15 minutes warmup, then blocks output collection for five minutes and tests recovery after two minutes settling over a further three-minute window. All machine recipes craft, every input has a productive physical route, all output ports collect and all machines share the external power network. The two internal green-circuit assemblers each run at 100% (90/min each), which sets the red-circuit rate at 90/min; the twelve red-circuit assemblers also run at 100%. No claim of exceeding the target steady rate.

Fed at exactly the panel figures (a separate probe, not the qualifying protocol) the red-circuit factory collected 89.97/min and the engine factory 60.00/min.

Previous versions, replaced 2026-11-21 after review, are kept with their qualifying report and a NOTE.md: `history/thirteen-reds-9d4902c4/` (red circuits, 55 × 17, 13 red-circuit assemblers, 89.83/min; the 13th assembler was spare) and `history/wide-ring-489b5ff9/` (engines, 43 × 14, 62.93/min; its ring had three empty columns and a spare row). The new red-circuit factory places its copper approach tunnel directly in the generator, the same pair the frozen optimizer (`history/suppliers-underground-9f49e92e/`) chose for the old one; the green-circuit factory still reproduces through that optimizer.

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
