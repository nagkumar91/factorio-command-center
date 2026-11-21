# Compact flight science — Factorio 2.1.24

Two original layouts targeting 60 packs/minute of every included colour, collected simultaneously. All machines are normal-quality AM2s, with fast inserters and red belts. No modules, robots, beacons, oil, water or inserter-capacity research are required.

**Circuit network research is required. Keep all red wires, entire-belt readers and inserter stock controls intact.** Each production block has its own circulating belt and isolated red circuit network. Controlled entrances and outputs maintain bounded material stocks, including when science output chests back up.

## Space and measured production

| Blueprint | Previous footprint | Compact footprint | Area saved | Red/min | Green/min | Blue/min | Military/min |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| RGB | 140 × 85 | **92 × 30** | **76.8%** | 62.90 | 65.13 | 63.80 | — |
| RGB + military | 181 × 91 | **108 × 30** | **80.3%** | 62.90 | 65.13 | 63.80 | 62.97 |

The tradeoff is more assemblers (82 versus 74 for RGB; 99 versus 90 with military), and distributed local entrances. Iron and copper feed more than one block. These are tested improvements, not a claim of global optimality.

## Connections

Follow each input display: entrances face **north or south**, as indicated in the preview legend and in-game sign. Connect electricity to the big pole marked P. Collect the labeled output chests. The short belts between Circuits, Engines and Science are already connected; they are internal routes, not extra external inputs.

At exactly 60/minute of each colour, external recipe demand totals:

| External item | RGB/min | RGB + military/min |
| --- | ---: | ---: |
| Iron plates | 870 | 1140 |
| Copper plates | 600 | 630 |
| Steel plates | 60 | 75 |
| Plastic bars | 180 | 180 |
| Sulfur | 30 | 30 |
| Finished stone walls | — | 60 |
| Coal | — | 300 |

The preview lists each local inlet's share. Supply extra during startup and when collecting above the nominal 60/min rate. Planned recipe demand is distinct from measured consumption and initial belt/machine stock filling.

## Native verification

`manifest.json` pins the import-string and prototype SHA-256 hashes, full footprint, machine counts, ports and loop controls. `native-report.json` matches those exact strings and records:

- 15 simulated minutes of warmup and 30 measured minutes, collecting all colours simultaneously.
- Ingredient injection only into declared exterior belt lanes; no internal inventory seeding.
- Every machine crafting, every inlet reaching a productive consumer, every output chest delivering, and one connected power network.
- Correct entire-belt reader mode, connected stock controllers, separate loop networks and bounded circulating stock.
- Five minutes without output collection, followed by two minutes settling and three measured minutes of resumed output. Every colour recovered above 60/min, with no loop deadlock.

The acceptance floor is 59.5/min per colour to allow discrete crafting cycles. The current compact layouts exceed 60/min in both the steady-state and recovery measurements. Private tests never change the user's active game, saves or settings.

The previous bus layouts, import book and matching native evidence are retained in [`history/v1-bus/`](history/v1-bus/README.md). `comparison.json` compares the exact old and new tested hashes.

## Reproduce

Provide a private Factorio 2.1.24 profile in `.cache/flight-21`, including `mods/` and `script-output/data-raw-dump.json`. Override with `FACTORIO_RAW` for generation and `FACTORIO_PROFILE` for native testing if necessary.

```sh
node scripts/flight-science/compact.mjs
SCIENCE_SOURCE=.cache/flight-science/compact RECOVERY=1 node tests/flight-science-native.mjs
node scripts/flight-science/select.mjs
node scripts/flight-science/preview.mjs
npm test
npm run build
node tests/flight-science-browser.mjs
```

`SHORT=1` is a startup screen, not production evidence. The older bus generator remains in `scripts/flight-science/generate.mjs` for historical reproduction.

Open `site/flight-science/index.html` directly in a browser, or serve only `site/` or `dist/`. The offline preview includes numbered ports, block names, connection directions, fit/detail views, import strings, a combined book and the previous book. Its SVGs show exact entity positions and directions schematically, not in-game sprites.
