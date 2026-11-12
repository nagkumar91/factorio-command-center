# Integrated six-pack science factory

The selected blueprint targets 60 packs/min each of red, green, blue, military,
purple and yellow science, with every intermediate made inside. It uses normal
quality AM2, electric furnaces, chemical plants, red belts and fast inserters,
without installed modules or robots. All material inputs enter from the west;
science output chests are on the east. Supply external electricity and retain
the circuit wires that regulate intermediate stock.

This build is for the pinned Factorio 2.1.24 flight-save profile. It is separate
from the public vanilla 2.0.77 catalogue. The raw-prototype SHA-256 and exact
native mod list are recorded in the manifest and report.

## Selected build and evidence

- Blueprint SHA-256: `678b096548995153ecabf9d9d8fa6d1f7871a6870723be153cb3811dc08c9414`
- Footprint: 169 × 366 = 61,854 tiles²; 325 crafting machines.
- [Blueprint import string](six-pack-integrated-60.txt), [manifest](manifest.json)
  and [matching native qualification](native-report.json).
- Exact test controller: `tests/flight-science-sided-full-control.lua`, SHA-256
  `877a326872bece4f26a81ca8d695ec1eceacd29403af02b91d8c85de9ae97e46`.

Native qualification starts empty, warms up for 15 minutes, then measures all
six products simultaneously for 30 minutes. The recovery check pauses science
collection for five minutes, settles for two minutes, then measures for three
minutes. Every pack must reach at least 59.5/min in both windows. The fixture
feeds only declared boundary belts and fluid pipes; it does not supply internal
intermediates. All 325 crafting machines produced during the measured window.
Exact imported entities, recipes, power, ingredient routes, fluid consumers and
three clear approach tiles at every external connection also passed.

| Science | Measured collection/min | Recovery collection/min |
| --- | ---: | ---: |
| Red | 63.00 | 63.00 |
| Green | 67.07 | 66.00 |
| Blue | 62.77 | 62.00 |
| Military | 63.00 | 63.33 |
| Purple | 71.43 | 68.00 |
| Yellow | 60.50 | 62.00 |

These are measured window rates. Intermediate buffers accumulated during warmup
can temporarily raise collection rates; the nominal design target remains
60/min per pack. The five-minute collection pause does not establish that all
ten science chests filled.

## Compaction and preserved versions

The [qualified wide baseline](history/verified-wide-baseline/manifest.json) used
195 × 399 = 77,805 tiles² and 331 crafting machines. The selected design uses
20.5% less area and six fewer machines. It is the smallest integrated candidate
that passed the tested protocol; global optimality has not been established.

The changes pack header rows and shared trunks more closely, share six direct
wire assemblers between adjacent yellow-science green-circuit pairs, and assign
solid-input branches by best-fit decreasing demand. The original 1,400/min
nominal trunk cap is retained. Better branch assignment removes one copper
trunk without changing nominal recipe inputs.

[Version history](history/index.json) preserves exact encoded blueprints,
matching native reports and controllers. The wide baseline and selected compact
build both retain generator/helper snapshots. Rejected candidates remain
historical evidence and are excluded from public selectable downloads. Archived
generators are restoration snapshots for their original script directory.

## Longer shutdown limitation

A separate [60-minute collection-pause diagnostic](../evidence/integrated-storage-60-diagnostic/report.json)
filled all ten output chests and stopped all science production during the final
two pause minutes. After two minutes settling, fresh blue-science production
measured 57.33/min over three minutes, below the optional 60/min threshold.
Other packs exceeded 60/min. This extended test failed; it does not invalidate
the separate passing five-minute-pause qualification or qualify as a full-storage
recovery pass. Collected backlog is excluded from the fresh-production measure.
The diagnostic's [exact controller](../evidence/integrated-storage-60-diagnostic/control.lua)
is separate from the qualification controller.

## Reproduction

Run from the repository root with the pinned prototype dump and frozen component
sources present:

```sh
node scripts/flight-science-sided/full/generate.mjs
RECOVERY=1 node tests/flight-science-sided-full-native.mjs
node scripts/flight-science-sided/full/generate.mjs
node scripts/flight-science-sided/full/preview.mjs
node --test tests/flight-science-sided-full.test.mjs
node tests/flight-science-sided-full-browser.mjs
```

The second generator run attaches verification metadata only when the exact
blueprint and current controller match a passing full native report. Native
runs use copied private mods, configuration and saves. Serve only `site/` or
generated `dist/`; caches, the raw game dump and native saves are private.
