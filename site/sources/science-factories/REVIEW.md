# Combined science factory review

## Electric version 3: distributed ports and local science collectors

Electric v3 is the default electric revision. It is 205 × 100 tiles with 3,517 entities and 104 production machines. The six raw inputs remain the only material inputs: iron ore, copper ore, coal, stone, water and crude oil. Raw ingress is kept near the processing banks under `portPolicy: distributed`; attach to each labeled external fixture, with the current raw belt and fluid fixtures facing west. External electricity connects to the saved big pole marked **P**.

The four science outputs no longer use full-width output buses. Each collector is reversed toward the outer end of its own science row and feeds a nearby indexed chest: OUT 1 automation is north, OUT 2 logistic is south, OUT 3 military is north, and OUT 4 chemical is north. The approach tile beside every raw or output port is reserved for the external connection. The manifest and native harness use the same distributed port configuration.

The compact routing plan has nine shared physical rows carrying 22 material routes. It combines dense mixed C/result lanes, filtered inserters and a rear guide where a mixed lane needs a straight connection. Grouped underground crossings reduce duplicate endpoints while preserving every machine contact. The placement search used GA seed 5030, population 100, 600 generations and gap 11. This is a tested placement and routing candidate, not a whole-factory wave-function-collapse search or a claim of a global optimum.

| Measure | Electric v2 | Electric v3 |
| --- | ---: | ---: |
| Width × height | 232 × 103 | **205 × 100** |
| Bounding-box area | 23,896 | **20,500** |
| Entities | 4,370 | **3,517** |
| Fast belts | 2,969 | **2,361** |
| Fast underground endpoints | 604 | **312** |
| Fast splitters | 41 | **41** |
| Medium poles | 121 | **116** |
| Electric furnaces | 43 | **43** |
| AM2 assemblers | 54 | **55** |
| Production machines | 103 | **104** |

The earlier local-output-only candidate passed its native check at 30.6667 automation, 30.0000 logistic, 30.3333 military and 31.0000 chemical packs/min, but occupied 231 × 100 tiles with 4,130 entities. The accepted v3 retained the balanced margin while reaching 205 × 100 and 3,517 entities. An initial dense layout with outward collectors produced 30.6667 automation and 31.6000 chemical but zero logistic and military, so it was rejected. An earlier routing trial also failed to sustain three outputs. The mixed-lane failure was traced to an inlet belt automatically curving and filling both lanes with its ingredient; the rear guide preserves a separate result lane. A regression test now rejects blocks without that guide. These failed candidates remain local cache evidence rather than published revisions.

The accepted v3 blueprint passed two independent native Factorio 2.0.77 runs on map seed 12345. The functional run simulated 45 minutes from an empty start, crafted and powered all 104 production machines, drained 200 items from each output, and verified refill at all four ports. The throughput run simulated 45 minutes with 15 minutes of warmup and 30 minutes of continuous collection. It measured 30.7000 automation, 30.5667 logistic, 30.6667 military and 30.9333 chemical science packs/min; every output cleared the 30/min target. Static routing and the native run reported no rejections.

The throughput report records these simultaneous input deltas, including buffer filling: iron ore 845.4333/min, copper ore 337.5000/min, coal 207.8667/min, stone 327.3333/min, water 1,899.0000/min and crude oil 1,240.0000/min. They are measured recipe consumption rates, not theoretical minimums or a claim that all raw usage falls with the compact layout.

Blueprint SHA-256: `8e90fd9029f580e5d1a24cf38987dd811092ff76fddf6a89ac484309183761d1`.

Distributed port configuration SHA-256: `e00124325643dcad7eff6d6252acb22fb24569d8b2b2aaef079a3c5ffa0726c8`.

The accepted native evidence is preserved in [throughput.json](throughput.json) and [validation.json](validation.json), and in the website version snapshots. Experiment logs remain in the ignored `.cache/electric-v3/` directory. The fifth logistic-science assembler adds recovery capacity; four AM2s have exactly 30/min theoretical capacity and measured 29.9/min with transport interruptions. The extra assembler and small inserter/belt production allowances raised green science to 30.5667/min without expanding the footprint. Area falls 14.2% and total entities fall 19.5% relative to v2; external collection belts from these local outputs to a lab area are excluded. The source reproduction is:

```sh
node scripts/science-factory/local-ports/generate.mjs
node scripts/science-factory/local-ports/apply-caps.mjs
```

It writes to `.cache/science-factory/reproduce-electric-v3/`. The v2, v1 and steel reviews below remain archived and describe their original saved strings and evidence.

## Electric version 2: direct feeders on both sides of the bus

The accepted blueprint is 232 × 103 tiles with 4,370 entities and 103 production machines. Raw smelting precedes every downstream workshop. Production occupies both sides of the eastbound bus; each input branch runs directly to a bus-facing inlet, and each intermediate bus terminates after its final consumer. All six raw inputs share the west boundary and all four output chests share the east boundary.

The exact saved string passed two independent 45-minute native simulations in Factorio 2.0.77 with Space Age, map seed 12345. The functional run starts empty with only raw inputs and external electricity, drains every output at the midpoint and verifies refill. Every machine crafted and every electric consumer reached the saved P network. All 43 furnaces used electricity. The second run has a 15-minute warmup and a 30-minute collection window; it measured 30.6667 automation, 30.0000 logistic, 30.1333 military and 30.8667 chemical science packs per minute together.

Blueprint SHA-256: `c4c6520e988710484a0baa28f912ca9a2e3d98d49ade9689e6088b69009b16ad`.

Configuration SHA-256: `107a4030a121bb8621ca359c8f36b6533b3bcc1884e6bb4118dfe058aa193f3d`.

The native importer checks the saved recipes, positions, directions, circuit conditions, arithmetic controls and any enabled inserter filters. No processed ingredients, furnace fuel, robots, modules, beacons or research productivity bonuses are injected. Static item routing found zero issues and zero unreachable consumers; the generator’s independent route audit reached all 66 routes. Native measurements provide the production evidence.

## Condensation and capacity review

| Measure | Published electric v1 | Electric v2 |
| --- | ---: | ---: |
| Width × height | 412 × 88 | 232 × 103 |
| Bounding-box area | 36,256 | 23,896 |
| Entities | 7,984 | 4,370 |
| Fast belts | 6,463 | 2,969 |
| Fast underground endpoints | 710 | 604 |
| Fast splitters | 41 | 41 |
| Medium poles | 138 | 121 |
| Electric furnaces | 42 | 43 |
| AM2 assemblers | 54 | 54 |
| Production machines | 102 | 103 |

Area falls 34.1%, width 43.7%, and entity count 45.3%. Most savings come from removing long return feeders and placing blocks closer together. The condensed layout retains the seven engine assemblers, seven advanced-circuit assemblers, four cable assemblers and nine chemical-science assemblers that supply the target with recovery capacity. There are 23 iron, nine copper, six steel and five brick furnaces, two refineries and four chemical plants.

A seeded genetic placement search (seed 2919, population 100, 350 generations) orders the recipe blocks, chooses their bank and reserves branch columns. Raw smelters are hard predecessors of all workshops; material producers precede their consumers. The selected plan uses a 16-tile minimum same-bank spacing, direct inlet columns and clearance around underground crossings. Deterministic routing constructs the belts, interval coloring reuses ten physical bus rows for 26 material routes, and a final connection-preserving pass removes transport-only rows and columns before rebuilding power. This revision uses genetic block placement and deterministic tile routing; it does not claim a globally optimal layout or a whole-factory WFC solution.

The first inward-feeder version kept 22 iron furnaces and measured only 26.7333 chemical packs/min, despite reaching the other three targets. Recipe-level evidence located the shortage in engine supply. One added iron furnace and a gear limit of 126/min raised chemical production to 30.8667/min. The same geometry with a 117/min gear limit delivered 29.8667 chemical/min; the higher limit provides more recovery margin. Automation and military production are limited near 30/min to share intermediates. The accepted blueprint uses the ordinary two-combinator clock, without a startup hold or burst controller.

Input consumption includes buffer filling. Measured iron rises from 825 to 853.5333/min; stone falls from 346.4667 to 324/min. These are simultaneous production-window measurements, not theoretical minimum ingredients or an assertion that every raw input rate decreases with compactness.

## Reproduction and version history

The accepted generator reproduces both the saved string byte for byte and its configuration hash:

```sh
node scripts/science-factory/two-bank/generate.mjs
node scripts/science-factory/two-bank/apply-caps.mjs
```

Output is isolated under `.cache/science-factory/reproduce-electric-v2/`. The pinned vanilla prototype dump is required at `.cache/factorio-vanilla/script-output/data-raw-dump.json`. The saved bank plan and search input are in `scripts/science-factory/two-bank/`; `python3 scripts/science-factory/two-bank/search.py` reruns placement exploration into a separate cache directory. Generation and search do not publish untested candidates.

Run `npm run test:science`, `npm run benchmark:science`, then `npm run publish:science` to test and publish matching artifacts. Native reports are bound to exact blueprint and configuration hashes. The site retains the electric v1 string and its native evidence in immutable version records; the steel-furnace version is unchanged.

## Archived electric v1 review

The following review describes the preserved v1, not the default v2. Its original generator remains under `scripts/science-factory/`.

## Electric furnace factory

The exact imported blueprint `science-four-pack-30-electric.txt` passed two independent 45-minute native Factorio 2.0.77 simulations, map seed 12345. The functional run starts empty with only six raw input fixtures and external electricity, collects outputs at the midpoint and verifies all four refill. The throughput run warms up for 15 minutes and measures continuous collection for 30 minutes. It delivered 31.4333 automation, 29.9333 logistic, 31.8667 military and 30.1333 chemical science packs per minute together; every output exceeded the 29.8/min acceptance floor for the 30/min target.

Every production machine crafted, all machines and inserters were connected to the saved P network, all 42 electric furnaces operated on electricity, and the six raw inputs were consumed. No intermediate items, furnace fuel, modules, beacons, robots or research productivity bonuses were injected. The native runner revives the saved blueprint rather than manually repairing its entities. It also verifies imported recipes, circuit enable settings, clock arithmetic and belt reading settings against the saved blueprint, so ignored serialized controls cannot silently pass.

SHA-256: `b3937f62b4df18a7d98bf604c47e7ca633ec294c5cd96c1f3246da9f6842176c`. Both reports bind evidence to this string and its exact input/output/power/fuel/research configuration. Static connection checks found zero route issues and zero unreachable item consumers before the native tests. Native tests are the production evidence; the static graph alone cannot prove throughput.

## Condensation and material review

Compact deterministic recipe blocks share ingredient belts; independent material routes reuse horizontal rows where their occupied intervals do not overlap. A subsequent pass removes transport-only rows and columns only when it preserves inserter contacts, route connectivity and underground pairings, then reconnects medium poles to the one external big pole. Circuit production limits are added after that pass.

The first integrated electric experiment was 501 × 122 tiles with 10,749 entities and did not meet the production target. The accepted layout is 412 × 88 with 7,984 entities: 40.7% less bounding-box area and 25.7% fewer entities than that experimental baseline. This is a compaction comparison against an unsuccessful preliminary layout, not a claim of a globally optimal factory or a throughput improvement over a published version.

Its 102 production machines comprise 42 electric furnaces, 54 AM2 assemblers, two refineries and four chemical plants. Four cable assemblers, seven advanced-circuit assemblers and nine chemical-science assemblers provide enough capacity to recover from unequal belt-buffer filling. Seven engine assemblers supply chemical science. A shared circuit clock limits surplus intermediates so early branches do not consume the supply needed by later products. Cable and engine production remain uncapped. It uses 138 medium poles plus one big pole, with the saved circuit and copper networks verified natively.

Additional machines were accepted only after the capacity review and simultaneous four-product benchmark passed. The earlier three-cable/six-advanced/eight-chemical designs missed the chemical target. Reducing those machines merely to lower the entity count would remove the measured recovery margin. The long shared bus still costs transport material; further topology changes require a new saved-string test and a new published revision.

## Limits and reproduction

Rates are averages over the stated window, not theoretical maxima or guarantees under interrupted raw supply. Buffer filling contributes to measured input consumption. The logistic result is 29.9333/min and passes the explicit 0.2/min sampling tolerance. Blueprints run with normal-quality equipment and no modules. All raw item belts are supplied continuously; water and oil fixtures maintain supply. Production may pause when output storage fills.

Run `npm run test:science` and `npm run benchmark:science` against the preserved source, then `npm run publish:science` to validate matching evidence and publish immutable website records. The generator and native evidence are independent: generated changes must be tested before publication. Failed experimental strings are kept only in the ignored local cache.

The deterministic electric generator reproduces the accepted encoded blueprint byte for byte:

```sh
node scripts/science-factory/generate.mjs
node scripts/science-factory/compacted-equilibrium/compact.mjs
node scripts/science-factory/apply-caps.mjs
```

The default output is the ignored `.cache/science-factory/reproduce-electric/` directory. It requires the pinned vanilla game prototype dump at `.cache/factorio-vanilla/script-output/data-raw-dump.json` (or `FACTORIO_RAW` where supported). The oil component is preserved under `components/`; its geometry and all external interfaces are included in the full saved-string native tests. Generation does not publish or overwrite the accepted source.


## Steel furnace factory with internal solid fuel

The steel version is a separate choice, preserving the electric version. Its accepted layout is 421 × 88 tiles with 8,622 entities and 108 production machines: 44 steel furnaces, 57 AM2 assemblers, two refineries and five chemical plants. It has one external big pole and 133 medium poles. Coal is used by grenade and plastic recipes; all 44 furnaces burn solid fuel made inside from light oil. The six raw inputs remain aligned on the west side and all four output chests on the east.

The exact saved string passed both 45-minute native tests with no supplied intermediates or furnace fuel. The 15-minute warmup / 30-minute measurement run delivered 33.4333 automation, 32.2667 logistic, 32.3333 military and 30.3333 chemical packs per minute together. All machines crafted, every output refilled after collection, all electric consumers reached P, and every furnace burned the internally made fuel.

Blueprint SHA-256: `14e317387ba3ac2a671975043b1ecd7a41832bfe31bbfa066264d07412093fba`. The final text and controls are bound to the matching native reports. The additional publication unit checks reject stale saved strings and any pack below the production floor.

Fuel is distributed through seven independent circuits. Each reads its branch and mixed furnace input belt and limits buffered fuel to 24 items. A diagnostic exposed 12 fuel items trapped on three unused belts beyond each last furnace pickup; a 16-item limit could then permanently close the feed. Removing those 21 unused belts both reduced construction material and eliminated that stalled reserve. Each gate remains isolated from the others and the shared production clock. Connection checks found no unreachable consumers or unintended material routes.

The capacity review added two smelting furnaces and three assemblers compared with the first trimmed 103-machine candidate: 23 iron furnaces, 10 copper furnaces, eight engine assemblers, eight advanced-circuit assemblers and five logistic-science assemblers. Four cable and nine chemical-science assemblers remain. The extra capacity lets later stages recover from unequal startup buffer filling while the intermediate limits keep the shared supply balanced. It preserves the 421 × 88 footprint. The earlier trimmed candidate produced only 27.4 chemical packs/min over the same window and was not published.

The electric choice is nine tiles narrower and uses 638 fewer entities, with six fewer production machines. These variants have different furnace construction costs and energy/fuel behavior; entity count alone is not an ore-equivalent construction-cost comparison. Their observed rates are window averages under continuous raw supply, not claims of global layout optimality.

The deterministic steel generator reproduces the accepted blueprint bytes and the exact research/input/output configuration bound to both native reports:

```sh
node scripts/science-factory/steel/generate.mjs
node scripts/science-factory/steel/compact.mjs
node scripts/science-factory/steel/apply-caps.mjs
node scripts/science-factory/steel/apply-fuel-limits.mjs
node scripts/science-factory/steel/trim.mjs
```

The default output is `.cache/science-factory/reproduce-steel/final/`; the pinned prototype dump and catalog are the same as for the electric generator. The final pass removes the unused furnace-belt tails, sets the verified 24-item fuel reserves, and preserves the tested steel-furnace research requirements. Generation stays in the ignored cache and cannot publish an untested change. The oil component is preserved in `components/oil-steel-bus.json`.
