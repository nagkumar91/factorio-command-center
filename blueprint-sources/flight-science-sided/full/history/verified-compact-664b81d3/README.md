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

- Blueprint SHA-256: `664b81d34df0b9a6ef969cad3f3a45f70f9ae67b35464710f9200bcf586f7548`
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
| Blue | 62.80 | 62.00 |
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
trunk without changing nominal recipe inputs. The final revision also removes
a serial blue-science output inserter and uses three parallel fast inserters at
its collection chest. That clears stored output promptly after a shutdown,
without adding crafting machines or increasing the footprint.

[Version history](history/index.json) preserves exact encoded blueprints,
matching native reports and controllers. The wide baseline and selected compact
build both retain generator/helper snapshots. Rejected candidates remain
historical evidence and are excluded from public selectable downloads. Archived
generators are restoration snapshots for their original script directory.

## Full-storage recovery

A separate [60-minute collection-pause test](../evidence/fully-integrated-storage-60/report.json)
passed on this exact blueprint. All ten output chests remained full in all 121
samples during the final two pause minutes, and every science assembler stopped
producing throughout that window. After two minutes settling, all six packs
were freshly produced at least 60/min during the next three minutes:

| Science | Fresh production/min after full storage |
| --- | ---: |
| Red | 63.00 |
| Green | 64.67 |
| Blue | 64.00 |
| Military | 63.33 |
| Purple | 79.00 |
| Yellow | 79.00 |

These are actual assembler production deltas, corroborated by independent
production statistics. Collected backlog is excluded. The
[exact storage-test controller](../evidence/fully-integrated-storage-60/control.lua)
has SHA-256 `0adf5bbc9b65ebe901a06e4e9e979cee7441eddbc34aa4b93483f16e0733ae00`.
This separate test does not replace the original passing 15/30-minute and
5/2/3-minute qualification.

The previous compact `678b0965` version passed the original qualification but
failed this extended test at 57.33 fresh blue packs/min. Its exact blueprint,
qualification, failed diagnostic and controllers remain in
[history](history/verified-compact-678b0965/). The selected revision resolves that
observed output-collection bottleneck.

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
