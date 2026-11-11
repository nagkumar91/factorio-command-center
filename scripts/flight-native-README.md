# Flight native verification

Run from the project directory. Results remain under `.cache/flight-native/reports/`;
this runner never publishes, edits a blueprint, changes installed game settings,
or changes the public catalogue.

```sh
node scripts/flight-native-run.mjs --preflight
node scripts/flight-native-run.mjs --ids item-logistic-robot-intermediary,item-logistic-robot-raw
node scripts/flight-native-run.mjs --workers 4
node scripts/flight-native-run.mjs --workers 8 --batch-size 16 --warmup-ticks 18000 --measurement-ticks 54000
node --test tests/flight-native-*.test.mjs
node tests/flight-native-negative.mjs
node scripts/flight-native-recover.mjs RUN_ID
node scripts/flight-native-reevaluate.mjs RUN_ID
node scripts/flight-native-availability.mjs
```

The defaults read `blueprint-sources/flight-factories/native-test-specs.json`,
`.cache/flight-game/script-output/data-raw-dump.json`, and
`.cache/flight-game/mods`. Override them with `--specs`, `--prototype`, or `--mods`.
Use `FACTORIO_APP`, or `FACTORIO_BIN` and `FACTORIO_DATA`, for another installation.
Only Factorio 2.0.77 is accepted. `--workers` allows 1–8 private processes, default
2. `--batch-size` defaults to 16. Each batch gives its factories separate forces
and surfaces; no logistics, power or fluid network can cross that boundary.
The first robot factory completes before the rest of the batch starts. Errors
are caught per factory so one bad import cannot invalidate its batch companions.

Each run copies the original mods/settings, verifies its own regenerated
prototype dump, and gives each batch a separate save, data directory, control-only
test mod and settings copy, with one surface and force per factory. Archive links point only
into the run's private mod snapshot. Reports record both exact byte hashes and
canonical prototype hashes, active mod versions, archive/settings hashes,
blueprint SHA-256, spec/configuration hashes, and harness source hashes. A
changed blueprint or spec produces new evidence in a new timestamped directory.
Control source bytes are captured once at run start and reused in every batch;
later edits cannot change a running batch queue. Both canonical and byte-exact
prototype comparisons must pass.
`reports/latest.json` is a convenience summary; integrations should read the
immutable run directory and match the exact blueprint and prototype hashes.
To stop scheduling safely, create `STOP_AFTER_BATCHES` in the run directory or
send `SIGUSR1` to that runner's PID. Active batches finish and pending factories
are explicitly listed; the summary cannot pass. The recovery command reads only
archived payloads, fingerprints and native results from started batches, writing
a separate recovered report set. Partial simulations never pass recovery.

Specs are an array, or an object with `factories`/`builds`/`entries` and a
`prototypeDumpSha256`. Each factory declares:

- `id`, project-relative `blueprintPath`, `blueprintSha256`,
  `prototypeDumpSha256` (alias `prototypeSha256`).
- `boundaryMode`: `raw`, `mixed`, `intermediary`, or those modes with `+startup`. Raw is the default and accepts
  only natural resources derived from the installed planet's prototypes.
  A scenario-seeded resource also requires a declared `sources` entry with
  `kind:'seeded-resource-extraction'`, the resource entity, finite amount,
  `renewable:false`, and exact map-report path/hash. The report must match this
  prototype dump, show a passed native reload, and contain at least the declared
  resource amount. Both the minimum and observed amount are recorded. Source bytes
  are archived; increased abundance does not invalidate prior evidence, and
  extraction remains outside the factory.
  If the live report changed, the runner resolves its exact declared SHA from
  `flight-map/evidence/<sha>.json` or an earlier run's archived evidence. It never
  silently substitutes a newer report. Track the versioned proof for portable
  fresh-checkout reruns.
- `inputs` and `outputs`: `{type,name,entityNumber,position}`. The saved entity
  must have matching `flight_input` / `flight_output` material-key tags; every
  blueprint entity must carry its numeric `flight_entity` ID.
- Input fluids declare an external `fixturePosition` and optional `temperature`.
  An infinity pipe there must connect only to the declared saved boundary pipe.
- Output `minPerMinute` is an optional acceptance floor. `role: 'surplus'`
  outputs are continuously removed and measured, but need not arrive steadily.
  At least one non-surplus target is required.
- Optional `wasteOutputs` contain `{type:'item',name,entityNumber,position,
  sourceEntityNumber,inserterEntityNumber,spoiledFrom:[itemNames]}`. A dedicated
  saved steel chest must have `flight_waste:'item:name'` and
  `flight_waste_source:sourceEntityNumber` tags. Its saved inserter must pick up
  from the named source chest and drop into that waste chest, with exactly one
  enabled whitelist filter for the spoil-result item. Prototypes must verify
  every `spoiledFrom` item. Source chests cannot request that waste material or
  declare it as their normal input/output. Static geometry and actual native
  pickup/drop targets and filters are checked. The harness only empties the
  waste chest; it never removes spoilage directly from a source or machine.
  Native `wasteCollected` records separate per-port counts, excluded from
  manufactured outputs, throughput gates, and coverage.
- One `powerPoleId` chooses the saved grid connection. One energy interface
  supplies it; the harness never adds or reconnects internal poles.
- `enableAllRecipes:true` enables recipes without research bonuses, or
  `researchClosure` explicitly lists researched technologies. Surface properties
  must match the installed planet.
- Optional `infrastructureSeeds` are `{entityNumber,item:'logistic-robot',count}`
  in saved roboport robot slots only. Production statistics independently prove
  that reported robot outputs were crafted. Saved inserters that could withdraw
  those fixture robots are rejected, as are unsupported custom pickup vectors.
- Optional `materialSeeds` are `{entityNumber,type:'item',name,count}` placed once
  in dedicated ordinary or passive-provider chests tagged `flight_startup`. They
  require an explicit `+startup` boundary mode and `rawOnly:false`; regular inputs
  retain the rules of the base mode.
  They are never replenished. The full seed quantity is subtracted from any
  collected output of that material before counting output, even across warmup.
- Default `warmupTicks:54000`, `measurementTicks:108000`, and `windows:3`
  (`measurementWindows` alias). Windows must be equal whole seconds.
  Explicit `--warmup-ticks` and `--measurement-ticks` overrides are recorded in
  the effective spec/configuration hashes alongside the original spec hash.

Inputs use unlimited supply at declared boundary chests or belt entrances;
existing inserters, robot networks and pipes transport them to machines.
`ratePerSecond` / `plannedPerSecond` are planning metadata, never measured rates
or implicit supply limits. Optional `supplyRatePerSecond` explicitly limits solid
fixture supply. Input reports distinguish accepted stock from native recipe/fuel
consumption. Recipes marked `ignored_by_stats` expose the partial native count
and mark consumption unavailable instead of reporting a false zero rate.
No machine inventories or undeclared internal chests/fluidboxes are filled.
Empty initial production, import positions, directions,
recipes, entity counts, and grid connectivity are checked in the game.
Native revival can create transient explosion/smoke visuals (for example the
captive spawner); these are recorded separately. Every functional initial entity
must still belong to the blueprint or an explicitly declared fixture.

Functional success requires repeat physical collection and native production
after warmup. Native production is proved by production statistics or actual
completed-craft counters for exact matching recipe-product machines (needed for
barrel recipes excluded from statistics). The fallback requires both the installed
prototype and native row to confirm statistics exclusion. Normal-statistics
products must have actual production statistics; craft attempts cannot replace
missing successful yields. Random or potentially zero-yield products excluded
from statistics are explicitly unsupported. Craft counters are never converted
into output rates. Steady success requires positive physical collection and native
production in each of at least three windows, measured spread within 25% (or two
items of window quantization) for deterministic outputs, and each window meeting any declared floor within
the recorded tolerance. Actual output counts divided by measured minutes are the
only reported rates. Stochastic specs default to at least 100 measured target
items before passing. The stochastic policy always requires at least 100, or a
larger explicit `minimumObservedCount`;
insufficient observations are failures requiring a longer run. Surplus output rates are observations, not guaranteed
throughput claims. Plans never supply output counts.

The versioned `flight-native-conditional-poisson-v1` policy applies only when
`stochastic:true` is explicitly declared **and** the target's installed-recipe
dependency closure includes a probabilistic or ranged product. Only recipes in
the exact saved blueprint are audited. An unused random surplus does not turn a
deterministic co-product into a stochastic target. Physical integer counts must
exceed the observation floor, every window must contain native production and
collection, and the unchanged declared rate floor must pass in every window.
For equal-duration counts `c[i]`, conditional on total `N`, Pearson's statistic
is `sum((c[i]-N/k)^2/(N/k))`, with `k-1` degrees of freedom. Expected counts must
be at least 5 in every window, and upper-tail `p >= 0.05` is required. The result
means **variation consistent with stationary random output at the 5% test
level**, not proof of stationarity. Random output is modeled as independent
Poisson arrivals; rare Bernoulli yields are an approximation and transport,
batching and spoilage correlations may violate it. No multiple-test correction
is applied; this is a per-output diagnostic, not a catalogue-wide error bound.

Outputs expose `stabilityMethod`, `stabilityTest` (method, alpha, statistic,
degrees of freedom, p-value, expected count, acceptance, interpretation and
assumptions), and a 95% `rateConfidenceInterval` for the **mean collected output
per minute**. Garwood Poisson limits are `chi2(alpha/2,2N)/(2T)` and
`chi2(1-alpha/2,2(N+1))/(2T)`; the lower limit is zero when `N=0`. These are
model-based mean-rate intervals, not guarantees for an individual minute.
The physical point rate remains exactly `N/T`. Mathematical tests include
[NIST chi-square critical values](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3674.htm),
analytic gamma cases, known Poisson limits, gross trends and empty windows.

`flight-native-reevaluate.mjs RUN_ID [--ids id,id]` writes a new timestamped
report directory, leaving every original report and simulation untouched. It
verifies archived blueprint, prototype, native result and control bytes and
preserves original spec/configuration fingerprints and native observations.
The default reanalyses all declared stochastic cases uniformly; it does not
select successful outcomes. Top-level `evaluation` records policy ID,
`originalRunId`, `originalReportSha256`, `nativeReportSha256`,
`nativeControlSha256`, `evaluatorSha256`, `statisticsSha256`,
`reevaluatorSha256`, and the prototype-derived `stochasticDependencyAudit`.
Original simulation/process errors remain errors. Reanalysis cannot create
new native production evidence or change the simulation duration.

`passed`, `failed`, `unsupported`, and `error` are separate outcomes. Unsupported
mechanics include unknown/changed prototypes, undeclared ports, raw factories
fed manufactured intermediates, missing import tags, preloaded items/modules,
quality variants, blueprint tiles, undeclared startup catalysts, and unimplemented special
process entities. Game launch/import failures retain logs and an error report.
Failed production retains counts, machine status samples, inventories, power and
logistics diagnostics. Container snapshots include native request sections,
compiled filters and deliveries; inserter snapshots include held items, filters,
status and actual source/destination entity IDs. These are read-only snapshots.
An optional transport diagnostic failure is explicitly listed in
`native.diagnosticErrors`; it cannot manufacture production evidence.
A complete batch always continues past an individual
failure and exits nonzero if any entry did not pass. Preflight readiness is never
native evidence. Integration and publication belong to the main thread.

## Independent loaded-map availability

The original map's initialization report and reload-exit check did not establish
persistent resources: deferred surface clearing invalidated those historical
availability claims. That does not change factory production observed with the
declared boundary inputs. A native factory test does not mine its external inputs.

Current `environmentAvailability` is therefore separate from native production
status. It validates a `loaded-save-runtime-state` proof, the actual installed
save SHA, scenario control SHA, matching prototype SHA, and the consistency of
the loaded resource census. Each explicitly declared seeded resource must yield
the declared material in the installed prototypes and meet its recorded minimum
amount. Native inputs, outputs, durations and historical spec/configuration
fingerprints are never changed by this verification. `verified-after-supersession`
explicitly identifies the invalidated earlier evidence and corrected proof;
`verified-loaded-map` binds an already-current declaration. `unverified` prevents
a map-availability claim. `not-required-by-declared-boundaries` makes no claim
about extraction or about manufactured intermediary supply chains.

New runs capture the independent proof once and archive its exact bytes.
Production can be measured when availability is unverified, but publication of
an available raw factory must check both statuses. The availability CLI scans
immutable native reports and writes `.cache/flight-native/availability/*/bindings.json`.
Bindings use the **original report byte SHA**, native report SHA, blueprint,
prototype, spec and configuration hashes; integrations attach the resulting
`environmentAvailability` only after those identities match. The CLI never edits
an old report or changes report selection/ranking. Rerun it after new native runs
finish. `--reports`, `--proof`, `--map-report`, and `--save` select explicit inputs.
`readLoadedEnvironment()` and `bindEnvironmentAvailability()` are also exported
for integration. Player-join behavior, mining, and transport from the map remain
outside this factory evidence scope.
