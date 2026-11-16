# Autosaved blueprint redesigns

This directory tracks new, module-free derivatives of the complete Autosaved community import. The current checked-out catalogue contains 632 imported entries. Every original remains unchanged in `site/data/community.json`; each derivative will retain the source ID, exact source-string SHA-256, and attribution to [Autosaved Factorio blueprints](https://autosaved.org/factorio/blueprints).

## Scope snapshot

All 632 entries are inventoried and assigned. The analyzer labels 375 as `Production`; 395 entries have one or more explicit recipes and are in the recipe-bearing production scope. Three additional Train Stops entries are smelting process layouts without explicit recipe IDs in the analyzer, and have a dedicated workstream. The remaining imports are transport, defense, power, logistics, mining, space-platform infrastructure, recycling, or other utility layouts. Of the 632 entries, 395 contain module requests; the remaining 237 already have no module requests.

| Analyzer type | Entries |
| --- | ---: |
| Production | 375 |
| Transport | 108 |
| Defense | 38 |
| Smelting | 33 |
| Power | 20 |
| Mining | 14 |
| Space platform | 14 |
| Infrastructure | 12 |
| Recycling | 10 |
| Logistics | 8 |
| **Total** | **632** |

The analyzer's `Production` label and explicit recipe-bearing count differ: all 375 labeled production entries have recipes, and another 20 recipe-bearing entries are classified under power or space-platform types. The exact recipe-bearing count is frozen as `recipeBearingEntryCount` in [`inventory.json`](inventory.json).

| Category | Imported entries | Analyzer-production entries |
| --- | ---: | ---: |
| Aquilo | 17 | 15 |
| Base | 44 | 44 |
| Defense | 36 | 0 |
| Diagonal Train Segments & Intersections | 12 | 0 |
| Early Game | 11 | 11 |
| For Fun | 3 | 0 |
| Fulgora | 49 | 31 |
| Gleba | 29 | 20 |
| Intermediates | 52 | 52 |
| Late Game Beaconed Builds | 63 | 62 |
| Late Game Robot Builds | 24 | 24 |
| Magic Trains! | 66 | 0 |
| Military | 39 | 39 |
| Miscellaneous | 13 | 7 |
| Power | 7 | 0 |
| Resources | 61 | 22 |
| Robo Grid | 1 | 0 |
| Science | 23 | 22 |
| Space | 24 | 8 |
| Train Segments & Intersections | 8 | 0 |
| Train Stops | 7 | 0 |
| Train Test | 2 | 0 |
| Train Two-Way Rails | 18 | 0 |
| Vulcanus | 23 | 18 |
| **Total** | **632** | **375** |

## Redesign rules

- Preserve each imported blueprint and its attribution. Publish each redesign as a separate, versioned derivative.
- Remove installed module requests. A module may still be a recipe product in a blueprint whose purpose is to manufacture modules.
- Treat underground-belt reach as a hard game-data constraint. The pinned Factorio 2.0.77 catalogue data and the available Factorio 2.1 flight-game data both use maximum endpoint separations of 5 (yellow), 7 (red), 9 (blue), and 11 (turbo) tiles; verify the installed mod prototype before accepting a span and count endpoint separation rather than empty-gap tiles.
- For recipe factories, map every declared outside input and product to a physically connected belt, pipe, or output chest. A combinator label by itself is not a port. Prefer compact routing and underground belts where a validated route can replace a long straight belt.
- For non-production layouts, retain their purpose and optimize real endpoints: belt entry/exit, train approach and departure, mining output, power connections, recycling feeds/products, or defense access. Do not invent recipe ports for a blueprint that does not manufacture items.
- Record source and candidate hashes, game-data assumptions, footprint, entity/material counts, and structural validation. Keep recipe review, static routing checks, and native production tests as separate evidence states. Do not call an untested result optimized or native-verified.

The frozen per-entry IDs, source-string hashes, classification, recipe boundaries, module request counts, approximate dimensions, complexity flags, and work status are in [`inventory.json`](inventory.json). Regenerate with `node scripts/autosaved-blueprint-inventory.mjs` if the imported catalogue changes.

The reproducible module-free base set is generated locally with `node scripts/autosaved-derivatives/generate-module-free-bases.mjs` under ignored `.cache/autosaved-derivatives/no-module-base-v1/`. Those are intermediate drafts only; they do not claim improved routing or layout.

Work is split across six workstreams with exact, disjoint source IDs in [`assignments.json`](assignments.json). Three Train Stops entries are smelting-production layouts, so they have a dedicated owner instead of being treated as transport-only blueprints.

| Workstream | Assigned entries | Recipe-bearing entries |
| --- | ---: | ---: |
| Core production | 168 | 167 |
| Planetary | 142 | 107 |
| Late game and resources | 169 | 120 |
| Transport and defense | 149 | 0 |
| Solar pilot | 1 | 1 |
| Smelting stations | 3 | 0 |
| **Total** | **632** | **395** |

The three furnace-based Train Stops stations have module requests but no explicit recipe IDs in the analyzer. They are tracked separately as smelting process layouts for physical feed/output redesign.

## Pilot status

The initial legend-only Solar draft and the first requester-chest edge-port draft are retained as history but are superseded. The current [`route-audit-v2`](../drafts/autosaved-solar-am2-route-audit-v2/README.md) draft removes modules, preserves all 10 recipe-machine groups, keeps the original 45×41 footprint, and replaces 24 straight belt tiles with 8 normal underground endpoints. It avoids requester chests and keeps the original single roboport. Factorio 2.1.24 native import, placement, underground pairing, and fluid-network continuity checks pass for the exact candidate hash; see [`solar-native-audit/RESULT.md`](solar-native-audit/RESULT.md). The four solid and two fluid west ports still lack proven material assignments, and the three provider chests are not proven to hold only finished products. It remains a review prototype, not a finished edge-port design or a production-throughput result. Route tracing is still in progress.
