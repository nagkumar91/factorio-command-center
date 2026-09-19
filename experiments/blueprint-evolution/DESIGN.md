# Blueprint optimization with genetic search and wave function collapse

**Status: bounded implementation authorized and started on 2026-09-19, after the requested power workshops were deployed.**

This handoff originally paused implementation. The user subsequently requested implementation, native comparisons, and publication of verified improvements with older versions retained. The initial implementation in this directory changes only ordinary belt corridors. Experiment results live in an ignored cache; a generated candidate is not native proof. See README.md for the implemented scope and commands.

The intended outcome is to compare algorithm-generated variants with the project's existing blueprints and keep improvements supported by native Factorio evidence. A smaller picture alone is not an improvement if its production is worse.

## 1. What each part does

| Component | Responsibility | Result it hands to the next component |
| --- | --- | --- |
| Baseline snapshot | Freeze a particular saved blueprint, manifest, recipes, game version and test conditions | An immutable comparison case with exact hashes |
| Requirement model | State allowed inputs, required outputs, rates, equipment and connection rules | Hard constraints that every candidate must satisfy |
| Production model | Determine recipe dependencies and sufficient machine and transport capacities | A feasible production graph with identified bottlenecks |
| Blueprint adapter | Translate real entities into machines, inserter contacts, material routes, fluid networks and power connections | A typed spatial model and a list of editable regions |
| Tile and block library | Define legal local structures and their interfaces | Reusable domains for the constraint solver |
| Wave function collapse (WFC) | Select locally compatible tiles or blocks, propagate constraints and backtrack on contradictions | A spatially consistent candidate, or a bounded failure |
| Genetic algorithm (GA) | Evolve the choices that guide WFC and, in later stages, block placement | Successive populations of reproducible candidate designs |
| Static verifier | Reject collisions, disconnected routes, changed underground pairings and other cheap-to-detect defects | Candidates worth testing in the game |
| Native evaluator | Supply only declared external inputs and measure actual behavior in isolated Factorio tests | Delivered output rates, consumed input rates and failure diagnostics |
| Scorer and archive | Compare feasible candidates on production, footprint and construction cost | A set of tradeoffs and the evidence behind each candidate |
| Review and publication handoff | Present the winning candidate and exact comparison for the normal project workflow | A reviewable proposal, never an automatic overwrite of a published design |

WFC is the constraint-based generator. GA is the search strategy. Native Factorio is the final evaluator. None substitutes for the others.

## 2. Freeze the comparison before searching

An experiment should reference a snapshot, not whichever file is currently being edited by another agent. Save:

- The exact blueprint string, decoded entity data and blueprint SHA-256.
- Its manifest, declared ports, research closure and configuration hash.
- Game version, enabled mods, normal-quality assumptions and recipe/prototype data identity.
- Functional and throughput test settings, including warmup, collection window and input fixtures.
- Baseline footprint, construction inventory, delivered output rates and consumed input rates.
- Experiment seed, search limits and the optimizer revision once an implementation exists.

Run a baseline under the same conditions as the candidates. Existing evidence can support a comparison only if the blueprint, configuration and test protocol match. Never use peak chest stock as a production rate.

The snapshot protects this parallel research task from ongoing changes to the science factory or Military science module. A successful result is a proposed revision against its frozen source hash. If the source has changed, rebase the proposal and retest before using it.

## 3. Hard requirements and production capacity

Requirements belong to the selected blueprint and must not be inferred from a generic global preset.

For the combined science factory discussed in the main work, the intended case is four simultaneous outputs: automation, logistic, military and chemical science packs, targeting 30 of each per minute. Its outside inputs are iron ore, copper ore, coal, stone, water and crude oil, with external electricity. Inputs enter on the west and finished science leaves on the east. It uses the red belt family, assembling machine 2, steel furnaces and big/medium electric poles. Furnace fuel is solid fuel made inside; coal remains an ingredient for grenades and plastic. No robots, modules, beacons or quality bonuses should be introduced by the optimizer.

Individual early-game modules have their own allowed equipment and research. Do not silently require red belts, fast inserters or operational circuit control in a module that previously worked before those unlocks. Optional input signs must remain optional where the manifest says so.

The production model should:

1. Expand each final product into its shared intermediate recipe dependencies using the pinned game data.
2. Count recipe results correctly, including recipes that yield multiple items.
3. Determine crafting capacity from machine speed and recipe duration.
4. Account for inserter transfer limits, belt lanes, branching and fluid demand.
5. Balance shared intermediates across all outputs being collected together.
6. Include burner fuel and stable oil processing. An accumulating oil byproduct can eventually stop the factory.
7. Distinguish exact target demand from the extra demand caused by whole-machine capacity and temporary buffer filling.

“Raw inputs only” applies at the outside boundary. Internal steel furnaces legitimately consume iron plates made inside. The fuel policy is a separate constraint.

## 4. Spatial representation and editable scope

Start with a deliberately bounded representation: **reroute ordinary belt corridors while preserving machines, recipes, inserters, external ports, fluid systems and the power network**. This can test the method against real designs without requiring a complete whole-factory generator first.

A corridor is a chain between fixed interfaces with known material and direction. Branches, splitters, inserter contacts, input displays, external ports and underground endpoints are anchors until explicitly supported. The adapter must identify all consumers and producers touching a route; a visually empty belt tile can still be an inserter pickup point.

For each editable region, record:

- Occupied and reserved tiles, including full machine footprints and space needed for external connections.
- Material identity, direction and lane behavior at every boundary crossing.
- Fixed entry and exit coordinates and the required entry/exit directions.
- Entities, wires, tags and circuit conditions that must be preserved.
- Adjacent routes that could accidentally receive or inject items through side loading.
- Maximum region dimensions and a search budget.

Keep fluids fixed in the first experiment. Keep underground endpoints and pairings fixed until their reach, orientation and possible interference have an explicit model. Keep circuit-controlled circulating belts outside the initial scope; removing a belt there can change stock measurement and control behavior.

Later stages can move tested production blocks, alter machine counts and support underground routing. They require additional constraints and new native comparisons; they are not implicit features of the initial corridor optimizer.

## 5. Tile and block library

The initial belt library needs an empty tile, directed straight belts and directed corners. Each nonempty tile declares one entrance, one exit, material identity and belt tier. Adjacent edges must agree on connection presence, direction and material.

Factorio side loading must be modeled explicitly. Two neighboring belts that satisfy abstract graph rules may behave differently in the game. The first version should reject unintended side loading and preserve the lane interface at fixed endpoints. Lane merging, lane swapping and splitters can become separate supported structures later.

Use the pinned prototypes for collision boxes, orientations, wire reach and underground reach. Do not assume the older editor's entity definitions are correct for Space Age.

A later block library should represent a complete useful unit, such as an assembler with its ingredient/output inserters, or a smelting pair. Each block declares its footprint, ports, recipes, capacities, power needs and allowed rotations. A 3×3 machine represented by several cells must have a shared identity and constraints that force all its pieces to appear together. Partial or overlapping machines are invalid.

Blocks reduce the search space. WFC should not repeatedly rediscover how to place the same machine and two inserters when that arrangement is already known to work.

## 6. How WFC should behave

Each cell begins with a domain of possible tiles. Fixed machinery and reserved interfaces restrict the initial domains.

The conceptual cycle is:

1. Apply boundary and occupancy constraints.
2. Remove neighbor possibilities incompatible with any remaining possibility in an adjacent cell.
3. Continue propagation until domains stop changing.
4. Select an unresolved cell with the fewest possibilities, using a reproducible tie-break.
5. Choose a tile according to that cell's priority ordering supplied by the genome.
6. Propagate again. If a domain becomes empty, backtrack within the configured budget.
7. Once resolved, apply global connectivity and completeness checks.

Local compatibility is insufficient. Global checks must ensure the required source can reach the required consumer, every required recipe has ingredient delivery and output removal, and no disconnected loop or dead route is mistaken for productive infrastructure. Later block placement also needs exact or bounded machine multiplicities and complete multi-cell machine identities.

An unsatisfiable region should produce a reason and stop at its budget. It should not run indefinitely, relax a required input/output constraint or silently delete a machine to achieve a solution.

WFC's result is **structurally plausible**, not “game tested.” It still needs the static verifier and native evaluator.

## 7. What the genetic algorithm should evolve

For the initial corridor experiment, a genome controls per-cell tile preference orderings and deterministic tie-breaks. This follows the video's useful separation: WFC handles compatibility while the genome changes which compatible outcomes are explored.

The original layout is an explicit baseline and seed. The initial population should also contain varied priority orderings, so the experiment is not just replaying the original design.

The GA needs these distinct operations:

- **Selection:** favor better evaluated candidates while preserving some diversity. Tournament selection is a reasonable initial choice.
- **Crossover:** combine parents' priority orderings for cells or whole regions. WFC must resolve the offspring again; directly splicing two built layouts can break routes.
- **Mutation:** occasionally reorder a cell's tile priorities or change a region-level choice. Record the seed and mutation settings.
- **Elitism:** retain a small number of the best verified candidates so a good result cannot disappear from the archive.
- **Fresh candidates:** introduce occasional new genomes to limit premature convergence.
- **Duplicate detection:** cache identical decoded layouts as well as identical genomes. Different genomes may produce the same blueprint.
- **Stopping:** enforce generation, evaluation, backtracking and wall-time limits, plus a no-improvement stopping condition.

Later genomes may include production-block positions, rotations, routing order and machine multiplicities within approved bounds. Those genes require a capacity-feasibility check before spatial generation. A lower assembler count is not beneficial if it makes the output target impossible.

Keep population state, candidate hashes, parentage and scores in resumable checkpoints. A restarted search should retain useful evidence without rerunning identical native tests.

## 8. Evaluation and scoring

Use a staged evaluation pipeline to spend game simulation time on promising candidates:

| Stage | Checks | Failure handling |
| --- | --- | --- |
| Decode and inventory | Blueprint format, entity identity, equipment/research constraints | Reject with a specific reason |
| Spatial and connection checks | Collisions, complete machines, inserter contacts, route continuity, material separation, underground pairing, power and external access | Reject before simulation |
| Capacity estimate | Sufficient recipe and transfer capacity; valid fuel/fluid balance | Reject impossible rate targets |
| Optional short simulation | Detect obvious stalls or disconnected delivery | Screening only; never publication evidence |
| Full native tests | Cold start, continued delivery, refill after collection, simultaneous output and actual input consumption | Record exact evidence or reject |
| Comparison | Production floor, footprint, belt count and construction cost | Archive feasible tradeoffs |

Hard requirements come before compactness. Define the output floor and measurement tolerance before the search. A target-based factory must meet every output target simultaneously. For a module without an explicit target, compare each output against its baseline under the same protocol. Do not permit a large reduction in one product to be hidden by gains in another.

Among feasible candidates, maintain a Pareto archive: a candidate is dominated if another is no worse on all selected objectives and strictly better on at least one. Useful objectives are:

- Full blueprint footprint area and dimensions, including access/signs where the published design includes them.
- Construction quantities by entity type, including belts, underground endpoints, splitters, inserters and poles.
- Raw construction requirements using a consistent recipe basis. Show solids and fluids separately rather than adding unlike units into an unexplained number.
- Delivered output rates for every product.
- Raw input consumption at comparable delivered production rates.
- Startup time and observed stalls as secondary diagnostics.

If a single score is needed for selection, document its normalization and weights. Keep hard constraint failures separate from its compactness score. Do not reward mere machine presence, inserter movement, belt occupancy or internal item circulation as though they were finished production.

Output per minute alone is also insufficient: unrestricted machine growth can increase it while making the layout much larger. The accepted comparison must reflect the user's chosen production target and compactness/material goals.

## 9. Native Factorio measurements

Use a private test directory, save, mod directory and configuration. Never operate on the user's active game or alter its settings. Feed only declared boundary inputs and external electricity; do not insert ingredients into internal machine inventories to rescue a candidate.

Use the same warmup and measurement protocol for both baseline and candidate. The project's current throughput approach uses 15 simulated minutes of warmup followed by 30 measured minutes, continuously collecting all output chests. Preserve the exact selected protocol and record it with the evidence.

Output rate is collected finished items divided by measured minutes. Input rate is actual consumption over the same window, including recipe ingredients, fluids and burner fuel. Count deltas must be tied to the candidate's isolated force/surface. Factorio's production-statistics `output_counts` represent consumption; `input_counts` represent production. Validate the interpretation against a known case before relying on the counters.

Exterior feed acceptance is useful diagnostic data, but includes stock filling belts, pipes and inventories. It must not be mislabeled as consumption. Report startup stock separately where relevant.

The functional run should verify empty-start production and resumed delivery after output collection. The sustained run must verify every required product together. Fuel-constrained factories also need observed fuel inventories/burning state and evidence that the internal fuel chain ran. All tested machines, consumers and poles must satisfy the existing native validation rules.

Every report must carry the exact blueprint and configuration hashes. Testing a nearby revision is not evidence for the candidate being proposed.

## 10. Experiment sequence and useful controls

1. Validate WFC concepts on a small belt-routing case with known possible and impossible connections.
2. Use an already compact simple module as a control. “No improvement” should remain an acceptable result.
3. Snapshot an existing automation-science module and the Military science module as practical routing cases. The latter was specifically flagged for wasted belt space.
4. Run bounded corridor searches and combine only nonconflicting changes.
5. Compare the frozen originals and best candidates with full native tests.
6. Expand to movable production blocks only after the corridor model has demonstrated correct Factorio behavior.
7. Consider the combined science factory only after there is a saved, validated baseline suitable for comparison.

Include controls that distinguish algorithmic benefit from extra compute: original layout, a simple deterministic shortening heuristic, WFC without evolution, and GA-guided WFC. Use comparable budgets and multiple fixed seeds for any broad claim that one method performs better. A good isolated result is a candidate improvement, not proof of global optimality.

A result can be “smaller,” “cheaper,” “faster,” or a tradeoff. Report exactly which property improved and whether the change passed the production floor. Preserve unsuccessful candidates' diagnostic summaries so later agents do not repeat the same failures.

## 11. Storage and handoff

Proposed future experiment storage under an ignored cache directory:

| Artifact | Contents |
| --- | --- |
| Experiment manifest | Frozen source identity, requirements, data version, seed and budgets |
| Baseline snapshot | Blueprint, manifest and matching measurements |
| Candidate records | Genome, decoded blueprint hash, metrics, ancestry and status |
| Generation log | Valid/invalid counts, best scores, diversity and elapsed evaluation time |
| Native evidence | Functional and throughput reports keyed by exact candidate/configuration hashes |
| Comparison report | Baseline/candidate metrics, tradeoffs, diagrams and limitations |
| Review proposal | Exact blueprint and the evidence needed to decide whether to adopt it |

Cache keys must include the blueprint, manifest/configuration, game/prototype data and test protocol. An output target change or new research bonus invalidates comparisons based on the old context.

Publish only through the existing verified publication process when that work is subsequently requested. The optimizer must never update source manifests, website records, GitHub Pages, the Pi or the user's open browser tab by itself. An experiment may finish with a report and no replacement blueprint.

## 12. Existing project entry points

These are reference points for a future implementation, not files to modify as part of this design handoff:

- [Blueprint encoding and construction inventory](../../scripts/blueprints.mjs)
- [Raw starter layout generation](../../scripts/raw-starter-layout.mjs)
- [Existing connection-preserving compaction](../../scripts/compact-starter-layout.mjs)
- [Starter configuration hashes](../../scripts/starter-verification.mjs)
- [Native early-game testing](../../tests/early-game.mjs)
- [Native combined-science testing](../../tests/science-factory.mjs)
- [Native rate evidence validation](../../scripts/blueprint-rate-evidence.mjs)
- [Verified versioned publication](../../scripts/transport-workshop-publication.mjs)

Read their current contents when implementation resumes: the main thread may improve them independently. Reuse their contracts where appropriate; do not assume a draft runner or generator already demonstrates a working design.

## 13. Inspiration and limits

Alex Wittman's [A.I. Learns to Optimize Factorio Blueprints](https://www.youtube.com/watch?v=mGOKKtIDNbk) and [the creator's accompanying explanation](https://www.reddit.com/r/factorio/comments/1tirq60/i_tried_training_ai_to_optimize_blueprints_and/) motivated the separation of adjacency-constrained generation, genetic search, delivered-production scoring and construction cost.

This proposal adds a deliberately staged scope, frozen comparisons, existing-layout seeds, budget controls and the project's native verification requirements. It does not reproduce the creator's implementation or claim that the complete factory search is computationally practical. Those are questions for the later experiment.
