# Combined science factory review

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
