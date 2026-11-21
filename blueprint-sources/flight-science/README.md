# Compact flight science — Factorio 2.1.24

Two original layouts targeting 60 packs/minute of every included colour, collected simultaneously. All machines are normal-quality AM2s, with fast inserters and red belts. No modules, robots, beacons, oil, water or inserter-capacity research are required.

**Circuit network research is required. Keep all red wires, entire-belt readers and inserter stock controls intact.** Each production block has its own circulating belt and isolated red circuit network. Controlled entrances and outputs maintain bounded material stocks, including when science output chests back up.

## Space and measured production

| Blueprint | Bus footprint | Compact footprint | Area saved | Red/min | Green/min | Blue/min | Military/min |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| RGB | 140 × 85 | **86 × 30** | **78.3%** | 63.00 | 66.80 | 63.50 | — |
| RGB + military | 181 × 91 | **101 × 30** | **81.6%** | 63.00 | 66.80 | 63.50 | 62.97 |

The tradeoff is more assemblers than the bus (80 versus 74 for RGB; 97 versus 90 with military), and distributed local entrances. Iron and copper feed more than one block. These are tested improvements, not a claim of global optimality.

Blue science is limited by its 14 engine assemblers, which make 63.0 engines/min (one engine per pack); figures above 63/min in a 30-minute window come from the engine stock built up during warmup.

### Revision of 2026-11-21

The first compact version (92 × 30 and 108 × 30, 82 and 99 assemblers) had 10 cable and 5 green-circuit assemblers working at 65% and 58%. Every inserter here moves one item per swing, so a cable assembler is held near 70 crafts/min by its single output arm and a green-circuit assembler by its two input arms. This revision has 9 cable and 4 green-circuit assemblers, with each green assembler just downstream of a cable assembler. Inlet columns now sit on machine-slot boundaries, and one green-science assembler has moved to the Science bottom row. The Military block is 4 tiles closer. Together these changes save 6 columns for RGB and 7 with military. Products, input materials, per-entrance rates, entrance sides and their order along each side are unchanged; entrance positions moved with the narrower blocks, so follow the in-game signs.

Measured in the same native tests: 3 green-circuit assemblers starve green science (26–28/min), and 8 cable assemblers lower blue science to 62.1/min. Over a 60-minute measurement both versions make exactly 63.0 engines/min and 63.2–63.4 blue/min. Fed exactly the panel figures at every entrance, both versions give 59.8–60.2/min of every colour. In that test the old RGB layout leaves a surplus cable assembler idle, and the new one has no idle assembler.

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

The previous bus layouts, import book and matching native evidence are retained in [`history/v1-bus/`](history/v1-bus/README.md). The first compact version is retained the same way, with its own native report, in [`history/compact-loops-8c30528a-d9842cff/`](history/compact-loops-8c30528a-d9842cff/NOTE.md). `comparison.json` compares all three tested generations by exact hash.

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
