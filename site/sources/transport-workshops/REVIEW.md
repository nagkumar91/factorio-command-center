# Transport workshop design review

Published: yellow, red and blue. Green is still being tested and is excluded
from the downloadable book until its production checks pass.

Each colour was assigned to a Luna agent at maximum reasoning in an isolated
working copy. The review sequence was: complete the raw-input production
chain, reduce its footprint and construction inventory, then measure output
and adjust the intermediate capacity. The orchestrator integrated the selected
designs and reran the native checks on the exact downloadable blueprints.

The objective is a compact workshop that sustains all three products. These
are bounded design experiments, not proof of a global throughput optimum.
Adding assemblers can reduce another product's supply on a shared belt, so a
machine-count increase is accepted only with production evidence.

## Yellow

The first layout was 38×22 with 231 entities. Reducing the spacing produced
a 30×22 layout with 194 entities and the same ten production machines. The
material review removed 32 belts and five medium poles.

The agent tested extra gear, belt and circuit assemblers. Those alternatives
redistributed output between products without improving all three together.
The subsequent capacity review identified iron smelting as the more useful
addition: a fourth iron furnace fits in an unused cell of the same footprint.
The selected design therefore has 11 machines and 198 entities at 30×22.
Against the original layout, it uses 32 fewer belts and four fewer medium
poles, with one additional steel furnace and two additional fast inserters.

Both furnace-count candidates used the same 45-minute test, including a
15-minute warmup and 30-minute collection period:

| Iron furnaces | Belts/min | Underground belts/min | Splitters/min |
| --- | ---: | ---: | ---: |
| Three | 27.23 | 3.40 | 1.60 |
| Four, selected | 32.87 | 3.80 | 1.80 |

The fourth furnace improved each rate by approximately 12–21% over the compact
three-furnace version without enlarging it. The original, wider layout
measured 34.70, 3.47 and 1.33/min respectively: the selected version trades
some belt output for less space and higher underground/splitter output.
All three chests refilled after collection in the separate functional test.

## Red

The original 38×28 layout used 245 entities but could not sustain all three
outputs: its fast-belt output stopped in the full-feed collection test.
The working design gives multi-ingredient machines separate filtered pickup
paths and reserves iron plates for the circuit and belt recipes before gear
production can take them.

The selected layout is 39×22 with 252 entities, a 19.4% smaller bounding-box
area. It has four iron furnaces, one copper furnace and ten assembling
machine 2s, including two gear assemblers. Compared with the first draft it
uses three fewer medium poles, four more belts, one more furnace, one more
assembler and four more inserters. It saves space; the extra production
capacity increases its construction material requirement.

A single gear assembler failed sustained splitter collection. A fifth iron
furnace raised belt output but reduced splitter output to 0.43/min as ingredient
pickup changed. Four iron furnaces and two gear assemblers were the selected
balance: 4.60 fast belts, 0.93 fast underground belts and 1.23 fast splitters
per minute in the 45-minute/15-minute-warmup test. All three output chests
also refilled in the functional test.

## Blue

The original 54×43 layout used 580 entities and made no splitters during the
measured collection window. Small intermediate buffers, competing filtered
inserters and the large underground-belt gear recipe prevented balanced output.

The selected 48×44 layout has 494 entities and 24 production machines. It uses
96 fewer belts and two fewer surface pipes, adding one gear assembler, two
fast inserters, six underground pipes and three medium poles. Its area is
9.0% smaller and its placed-entity count is 14.8% lower than the draft.

Two gear assemblers share three iron furnaces. The input controls reserve
iron plates for other recipes, circuits for advanced circuits, and gears for
the lighter transport branches. Moving the express splitter earlier in the
recipe placement order, before the large gear sinks, restored all three
outputs in the compact layout. Simply compressing the original order failed
splitter production and was rejected.

The selected agent run measured 1.77 express belts, 0.33 express underground
belts and 0.17 express splitters per minute, plus 7.93 solid fuel/min, with
15 minutes warmup and 30 minutes collection. The separate 45-minute functional
test confirmed that all four chests refilled after collection. These small
smelting lines and shared intermediate stocks limit output; more final-item
assemblers alone would not remove that limitation.

## Test conditions and evidence

The final reports are [validation.json](validation.json) and
[throughput.json](throughput.json). Each report includes the blueprint SHA-256
and the hash of its ports, research, surface and circuit configuration.
Changing the blueprint or its declared setup invalidates the evidence.

Functional tests run for 45 simulated minutes in Factorio 2.0.77 with Space
Age and map seed 12345. They import the saved design, enable only its declared
research, keep both lanes of the labeled raw-input belts supplied, and connect
electricity at P. The saved inlet inserters control admission to the loop.
Every recipe must run, every output must arrive, and every chest must
refill after being emptied halfway through. No robots, hidden production
machines or direct insertion into machine inventories are used. Early screening
runs used the individual modules' two-items/second fixture. The final workshop
functional tests use full raw-belt supply: four furnaces plus a foundry can
exceed that earlier fixture's ore supply.

Throughput tests use the same seed and game version, continuously supply the
raw entrances, and collect outputs every second. Rates count only the 30
minutes after a 15-minute warmup. Blue and green also need their solid fuel
collected. These are simultaneous output rates, not the capacity of a single
product when the other chests are full. Shorter exploratory measurements were
used to reject candidates but are not compared as equivalent final rates.

The saved blueprints require Circuit network to control circulating stock.
The optional static input displays use the same research. Yellow, red and
blue operate on Nauvis; green requires Vulcanus pressure and supplied raw
ores, water and crude oil. Construction uses normal-quality assembling
machine 2, steel furnaces, big and medium poles, and fast inserters. Green
also uses the foundries required by its recipes.
