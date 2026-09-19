# Bounded blueprint evolution experiment

Implemented after the requested raw-input electric power workshops were deployed on 2026-09-19. The design was informed by Alex Wittman's [A.I. Learns to Optimize Factorio Blueprints](https://www.youtube.com/watch?v=mGOKKtIDNbk), whose full transcript was reviewed, and the author's [write-up](https://www.reddit.com/r/factorio/comments/1tirq60/i_tried_training_ai_to_optimize_blueprints_and/).

This implementation optimizes ordinary belt corridors only. It fixes machines, recipes, inserter pickup/drop contacts, external ports, underground endpoints, fluids and the power grid. An adapter finds single-material chains and small editable regions. It reserves foreign entities and places where an unintended side load would be created. Candidate regions stay inside the baseline footprint.

WFC domains contain an empty tile and twelve directed straight/corner tiles. Neighbor edge constraints propagate before each lowest-entropy collapse; bounded backtracking handles contradictions. A global check requires one complete source-to-destination path, without disconnected loops. The genetic search uses tournament selection, per-cell crossover, mutation, elitism and fresh genomes. Candidate layouts and genomes are deduplicated. Search workers run in parallel and save their results by model/configuration/implementation hash, so completed regions can be reused on rerun.

A baseline seed, a deterministic shortest-path seed, and a separate WFC-only control are retained. The first accepted changes matched the shortest-path control; there is no evidence here that GA was necessary or superior. The implemented scope cannot improve machine placement or production ratios.

From the repository root:

```sh
node --test experiments/blueprint-evolution/wfc.test.mjs
node experiments/blueprint-evolution/run.mjs

# Search another published module in an isolated cache:
OPTIMIZE_ID=early-raw-grenade node experiments/blueprint-evolution/run.mjs
```

The default run uses the current Military module, a population of 12, 10 generations, a 500-branch WFC limit and up to 12 regions. `OPTIMIZE_WORKERS`, `OPTIMIZE_REGIONS`, `OPTIMIZE_SOURCE` and `OPTIMIZE_OUT` adjust the bounded run. A source must have a manifest and native functional/throughput reports. Baseline strings, evidence, model domains, seeds, control results, candidate lineage and comparison summaries are saved under `.cache/blueprint-evolution/`.

The runner does **not** publish candidates. A promising candidate must pass the normal isolated native test and sustained benchmark with exactly matching string/configuration hashes. Its measured outputs must match or exceed the baseline, its full footprint must not grow, and its construction count must improve. User-approved publication then goes through the normal collection index, preserving the old version.

The first experiment accepted five two-belt savings after native tests. Military v2 and stone brick were retained without changes. See [the published comparison](../../blueprint-sources/early-game/REVIEW.md). Exact accepted edits are replayable through `scripts/saved-corridor-optimizations.mjs`; source generation refuses a changed baseline instead of applying stale edits.
