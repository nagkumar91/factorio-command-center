# Early Shopping: exact-count static candidate

The current candidate preserves **all 134 source recipe-machine instances (126 AM2, 8 chemical plants), all 69 recipe IDs and all 46 finished product IDs**. Every recipe's machine count and unconstrained crafting ceiling matches the module-free baseline. The full tile envelope is **116 × 39**, 28.8% smaller. This is a static design handoff; native production and relative delivered throughput remain unverified.

Import [candidate.txt](candidate.txt). Review [layout.png](layout.png), the hoverable [layout.svg](layout.svg), [products and ports](PRODUCTS-AND-PORTS.md), and [the 134-machine map](station-map.csv).

## Exact identity and attribution

- Source: **Autosaved — Early Shopping**, entry `autosaved-a2a75155ae4608cc`, imported from [Autosaved blueprints](https://autosaved.org/factorio/blueprints). Attribution is retained in the blueprint description and [source/attribution.json](source/attribution.json). No upstream license is inferred.
- Frozen import SHA-256: `8336f1d5013e22389dfc526ea2cca0b266fc94cf6317050072be23d7ba4ec511`.
- Provided module-free draft SHA-256: `af07eecfc704b1cf6092acdf74de4b3c523fc86d1882301c00df4637715cfc07`. Its entity geometry, wires and recipe-machine counts match the frozen import; its ports and production remain unreviewed. See [baseline verification](validation/baseline-audit.json).
- Candidate SHA-256: `d4c160003c2986863d0733bc12942be5c4f2e0a823a237d42032bd6039b1562c`.
- Blueprint SHA means the exact encoded blueprint string after trimming file whitespace. [hash-manifest.json](validation/hash-manifest.json) separately hashes complete artifact file bytes.

The source snapshot and both module-free baseline copies are local to [source/](source/). The provided baseline was available in the assigned worktree; an earlier “not found” observation applied only to the old shared checkout and is superseded.

## What changed

All handoffs use fast inserters with documented one-item hands. Normal, long-handed, fast and bulk inserter recipes remain products/internal recipes exactly as in the source. All placed item transport uses red belts and red underground belts. There are zero installed module requests and no beacons; efficiency, speed and productivity module recipes remain.

Six belt runs form one unbranched, circuit-limited circulation route. All original intermediate machines share this supply system without removing any instances. Separate fluid networks connect the original plastic, sulfur, acid, battery and electric-engine recipes. Nine labeled material inputs plus external electricity enter from the west. There are **26 north and 25 south passive-provider chests** covering exactly 46 finished item IDs. Extra provider chests correspond to repeated source recipe machines. No requester chests or logistic robots feed manufacturing. Connect an external roboport network for automated collection.

Manufacturing footprints are unchanged at 1,206 occupied tiles. The savings come from fewer transport/support entities and the new arrangement. [Machine-instance proof](validation/machine-instance-proof.json) maps every original recipe machine exactly once to a candidate machine.

## Footprint accounting

| Measure | Frozen source / module-free baseline | Candidate | Reduction |
|---|---:|---:|---:|
| Entity-center bbox (your rough measure) | 154 × 40 = 6,160 | 115 × 38 = 4,370 | 29.1% |
| Full outside tile envelope | 155 × 41 = 6,355 | 116 × 39 = 4,524 | 28.8% |
| Occupied surface tiles | 4,116 | 2,631 | 36.1% |
| Manufacturing-machine occupied tiles | 1,206 | 1,206 | 0% |
| Explicit paving tiles (blueprint.tiles) | 0 | 0 | — |

The rough bbox is max-minus-min entity centers, matching your 154 × 40 baseline measurement; it excludes entity half-widths. The full tile envelope contains entire entities and input signs. Occupied tiles count unique grid cells intersecting physical entity collision boxes; underground endpoints occupy cells, buried spans do not. Paving tiles are separate and absent from both blueprints. All definitions and selection-box metrics are in [footprint-comparison.json](footprint-comparison.json).

## Static evidence and limits

[The audit](validation/static-audit.json) passes **65 checks**: exact source/candidate identity, all per-recipe counts, source-instance bijection, recipe products, collisions, inserter pickup/drop contacts, a closed belt cycle, underground reach/pairing, external ports, fluid isolation/connectivity, labels, copper reach/coverage, green admission circuits, provider controls and research closure.

[Static checks](validation/checks.json) record **13/13 passing tests**, including deliberate broken-route, lost-power, lost-wire, installed-module, recipe-substitution, missing-label, reduced-count and duplicate-provenance cases. Regeneration reproduces the exact candidate string. The preview was visually inspected.

**Native testing has not run.** The user reserved the native execution slot for the blue-tier candidate. No Factorio process was started for this work. The included [run-native.mjs](run-native.mjs) and [native-control.lua](native-control.lua) are an optional integrator handoff; the runner has not been exercised against Factorio. It requires exact vanilla 2.0.77 plus Space Age, creates an isolated run directory here, feeds only outside the nine declared inputs, probes whole-loop counts, and checks cold start, all recipe instances, 15-minute warmup / 30-minute collection, five-minute output windows, refill and actual ingredient consumption. It retains failed/incomplete evidence and cannot publish.

Unchanged machine counts prove equal unconstrained crafting capacity, **not equal delivered throughput**. Red-belt sharing, one-item fast inserters, stock limits and consumer order can constrain startup or sustained simultaneous collection. [capacity-assumptions.json](capacity-assumptions.json) makes this distinction explicit for every recipe. Native lane/counter behavior, output fairness, throughput and source comparison are acceptance work for the integrator; no relative production improvement is claimed.

## Technology and reproduction

Pinned assumptions: Factorio **2.0.77**, base/quality/elevated-rails/Space Age, normal quality, no modules or quality bonuses. Research closure includes automation 2, logistics 2, fast inserters, circuit network, oil/chemical processing, advanced circuits, robotics and the three module unlocks. Required science packs: automation-science-pack, chemical-science-pack, logistic-science-pack. “Early Shopping” is the upstream name, not a claim that red/green science alone is sufficient. [technology-assumptions.json](technology-assumptions.json) lists the exact closure; [source/model.json](source/model.json) pins recipes/prototypes and the extraction hashes.

Use this exact explicit tool workdir and verify `pwd -P` before commands:

`/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center`

Run these **static-only** commands from that directory:

```sh
pwd -P
node experiments/blueprint-evolution/autosaved-derivatives/user-requested/early-shopping/generate.mjs
node experiments/blueprint-evolution/autosaved-derivatives/user-requested/early-shopping/validate.mjs
node experiments/blueprint-evolution/autosaved-derivatives/user-requested/early-shopping/render.mjs
node experiments/blueprint-evolution/autosaved-derivatives/user-requested/early-shopping/review.mjs
```

The shared library refuses execution from the shared checkout or another workdir. Files remain under this source directory. Repository-wide npm test/build were left to the integrator because their writes/deletions exceed this worker's scope. No site/index, shared script, queue/ledger, other source, Git, deployment or game-state operations were performed during this assigned-worktree rebuild.

## Preserved failed iterations

[001-104x35](versions/001-104x35/) and [002-failed-75-machines-104x27](versions/002-failed-75-machines-104x27/) preserve the earlier 75-machine candidates. Both **fail the exact machine-count contract** and are not acceptable replacements. Their smaller footprints are not compared as valid improvements. The current 134-machine candidate supersedes them.
