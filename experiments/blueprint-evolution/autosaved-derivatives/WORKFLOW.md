# Parallel Autosaved blueprint workflow

The redesign queue covers the 395 sources with recipe outputs. Run `node scripts/autosaved-derivatives/build-interface-revision-queue.mjs` before `node scripts/autosaved-derivatives/build-work-queue.mjs`; the first command records any already-indexed candidates missing an in-blueprint display for a raw input, and the second refreshes `work-queue.json` from the frozen inventory, validation ledger, assignments, interface revisions, and current in-progress IDs.

Before marking a source unavailable, recover it from the local Autosaved community catalogue with `node scripts/autosaved-derivatives/extract-frozen-source.mjs <source-id> <worktree-relative-output-file>`. It writes the exact imported blueprint string without a trailing newline, so a direct SHA-256 of the file matches the frozen inventory. It accepts and normalizes only whitespace around a string whose trimmed hash already matches; all other mismatches refuse overwrite. The imported source is embedded in `site/data/community.json`, so a missing standalone file is not evidence that the source bytes are unavailable. Only add a missing-source blocker after this exact-hash recovery path and the other documented stores have been checked.

## Order and parallel work

The queue ranks by recipe count, entity count, ports, underground belts, splitters, fluid machines, beacons, and existing complexity flags. It exposes six next worker slots by default, matching the active subagent thread limit. Workers may work in parallel only on different source IDs from the current lowest-complexity batch. When a source is claimed, add it to `work-queue-state.json` before delegating so another worker cannot take it. When its exact-hash evidence is accepted and indexed, add it to the validation ledger and remove it from the active list; then regenerate the queue.

### Worktree safety for delegated workers

The coordinator may be running inside a Git worktree while a worker's default shell directory points at `/Users/nagkumar/clawd/workspaces/factorio-command-center`. Never assume the default directory is authorized. Give each worker the full active worktree path. Before writing files or launching Factorio, the worker must run `pwd -P` with that exact directory as the shell tool's `workdir` and confirm it matches the assignment. Every subsequent file-writing command and native-run command must also use that same explicit `workdir`. If the tool cannot target the assigned worktree, stop and report the limitation; do not write into the Clawd workspace checkout or another worktree. Before integration, verify every artifact resolves beneath the assigned worktree.

Each worker uses an isolated directory or worktree and returns an immutable candidate, exact source/candidate hashes, source attribution, physical input/output map, structural checks, and native reports. Recipe inputs enter at the west edge and finished products leave at the east edge when the source layout allows it. Every recipe-input port needs a matching `display-panel` in the downloadable blueprint; output labels should also be shown when the output is not self-evident. Any output chest is a `passive-provider-chest`. Modules are removed from installed entities, while module-making recipes remain valid products.

## Input-display compliance revisions

Earlier indexed candidates can be native-valid while missing the in-blueprint item labels. The generated `interface-revision-queue.json` identifies those exact source/candidate hashes and input items. Keep those versions and reports intact, add the missing display panels as a new candidate version, rerun the exact-hash native validation, and then replace the indexed candidate only after the new report passes. Do not count a source as fully complete while its display revision is outstanding.

## Per-blueprint acceptance and publication

The integrator processes completed candidates one source at a time, even while other workers keep designing. For each source:

1. Verify the source hash against the frozen community import and preserve its attribution.
2. Verify the candidate hash, zero module requests, recipe coverage, and legal underground endpoints.
3. Verify every declared port is physically connected, material-labeled, lane-documented, and on the intended side; confirm any output chest is passive-provider.
4. Run the candidate's exact-hash native route and production evidence checks. Keep source-to-candidate comparisons distinct from candidate-only results.
5. Add versioned candidate and evidence files, update the validation ledger and local catalogue, regenerate the page, then run `npm test` and `npm run build`.
6. Commit only that source's candidate, evidence, ledger/index, and generated site files. Push and publish the completed source before integrating the next completed source. Never stage another agent's active files.

The public Pages and Pi deployments use the repository's validated publication path in `deploy/README.md` and `ops/REPAIR_AGENT.md`. Preserve their isolation, and never put saves, credentials, logs, caches, dependencies, or generated game artifacts in the site.

## Current queue state

`work-queue-state.json` reserves the solar, science, military, and in-flight parallel design sources. It also records existing core, planetary, and green-circuit candidate work from isolated worktrees as review claims so the scheduler will not send a duplicate design. The generated queue distinguishes integrated sources, currently assigned sources, existing candidates awaiting acceptance review, and untouched queued sources. Candidate-review claims still need the same physical-port and exact-hash checks before they can enter the validation ledger. The forest-planting blueprint is a separate requested design and is not counted among the 395 Autosaved recipe-production sources.
