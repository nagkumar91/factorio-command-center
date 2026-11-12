# Flight science, Factorio 2.1.24

Two original layouts for 60 packs/minute of each included colour, collected simultaneously. Inputs are finished plates, steel, plastic, sulfur and walls; the military build also consumes raw coal. No oil or water connection is needed. All crafting uses normal-quality assembling machine 2s, with fast inserters, the red belt family, and no modules, robots, beacons or inserter-capacity research.

## Connections

Match each input display to its nearby eastbound belt entrance and feed from the west. Press Alt to see labels. Connect electricity to the marked big pole. Collect every output chest: when a colour has multiple chests, its stated rate is the sum of those chests. Keep all colours flowing during simultaneous production. Stop collecting a colour and its machines will eventually back up normally.

Steady-state recipe demand at exactly 60/minute of each colour:

| External item | RGB / minute | RGB + military / minute |
| --- | ---: | ---: |
| Iron plates | 870 | 1140 |
| Copper plates | 600 | 630 |
| Steel plates | 60 | 75 |
| Plastic bars | 180 | 180 |
| Sulfur | 30 | 30 |
| Stone walls | — | 60 |
| Coal | — | 300 |

Provide additional stock while initially filling the belts and machine buffers. These planned rates are distinct from the measured consumption in the native report. The installed 2.1 piercing-ammunition recipe yields two magazines from two firearm magazines, one steel and two copper plates.

## Verification and optimization

`manifest.json` pins the exact import-string SHA-256, installed prototype snapshot SHA-256, machine counts, full footprint, and numbered ports. `native-report.json` records the private Factorio test of those exact strings: 15 simulated minutes of warmup and 30 measured minutes. Only declared boundary belt lanes receive ingredients; internal inventories are never seeded. Output chests are continuously collected. Every machine must craft during measurement, every input must reach a productive consumer, every output chest must deliver, and all consumers must share the saved power network. No user's live game, saves or settings are modified.

The generator compares dependency orders, bank spacing and material-row reuse, then removes empty transport corridors while preserving connections. This is a bounded layout search, not a proof of global optimality. Disconnected candidates are rejected rather than rewarded for a smaller footprint. A minimum-machine candidate is compared with a candidate providing capacity headroom using the same native protocol.

## Reproduction

Supply a private Factorio 2.1.24 profile at `.cache/flight-21` with its `mods/` directory and `script-output/data-raw-dump.json`, or use `FACTORIO_RAW` for generation and `FACTORIO_PROFILE` for testing. The original profile contains Space Age and the installed flight-save mods. Native tests make their own private copy.

```sh
node scripts/flight-science/generate.mjs
node tests/flight-science-native.mjs
node scripts/flight-science/preview.mjs
npm test
npm run build
```

The default uses the minimum whole-machine counts plus one extra copper-wire assembler, selected from native comparisons. To reproduce the rejected theoretical-minimum alternative, set `SCIENCE_EXTRA_WIRE=0` and `SCIENCE_OUTPUT=.cache/flight-science/minimal` during generation, then `SCIENCE_SOURCE=.cache/flight-science/minimal` during testing. `SHORT=1` runs a startup screen only; it is not full production evidence.

Measured selected results (all colours collected together):

| Blueprint | Full footprint | Red/min | Green/min | Blue/min | Military/min |
| --- | --- | ---: | ---: | ---: | ---: |
| RGB | 140 × 85 | 63 | 60 | 60.033 | — |
| RGB + military | 181 × 91 | 63 | 60 | 59.933 | 60 |

The declared acceptance floor is 59.5/min per colour, accounting for discrete crafting cycles over the measurement window. Both meet the nominal 60/min target within that tolerance. The four-colour build is 17.5% smaller than the passing headroom comparison (227 × 88), with less excess science capacity. The generator does not claim a globally optimal layout.

The browser preview is `site/flight-science/index.html`. Serve only `site/` or `dist/`; the preview also opens directly as a local file and contains no network dependencies. Its full-size SVGs show the saved positions and directions, recipe icons and numbered input/output legend. They are schematics, not in-game sprite screenshots.
