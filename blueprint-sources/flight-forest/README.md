# Flight forest system

Generate: node scripts/flight-forest/generate.mjs

Private native test (180 simulated minutes): node tests/flight-forest-native.mjs

Idle probe: FOREST_IDS=standing-grove FOREST_MINUTES=30 FOREST_CONTROL=tests/flight-forest-idle-control.lua FOREST_REPORT=idle-mechanics-report.json node tests/flight-forest-native.mjs

Render: node scripts/flight-forest/preview.mjs

Open site/flight-forest/index.html for full instructions, exact strings and evidence.

Requires the installed modded 2.1.24 profile; not the vanilla 2.0.77 catalogue. Original local designs. Tree nursery is renewable after seeding and solar startup; infrastructure materials remain external. Autonomous forest uses reserve-gated harvesting and solar power; uses 6 panels / 6 accumulators (30 MJ), requires 50 initial seeds but no ongoing inputs or exports. The original 16/14 version and matching proof remain in history/v1-solar-16-14/. Versions replaced on 2026-11-21 (tower machinery packed into two planting cells, solar fields and their poles outside the planting area, two-row workshop ring) remain in history/ with a NOTE.md each. Idle tower emissions were measured to stop, so no power-switch clock is needed. Standing groves remain a manual alternative: seed supply and grid power while planting, with optional tower removal to reuse the equipment; idle towers need not be removed for net absorption. No fixed forest guarantees absorption of unlimited pollution.

## Review notes

2026-11-21 verifier fix: in the compact nursery and autonomous forest the START display panel touched only the wood chest, so its "leave 20 seeds here" pointed at the wrong chest (seeds put there grew 0 trees in a probe). The two chests swapped roles inside the same cells: the wood chest is now north, the seed chest south, and the panel sits directly below the seed chest, sharing an edge with it and touching no other chest. The panel text and the page now say "the chest directly above" the panel. Both strings were re-proved with the unchanged 180-minute protocol; every measured figure is identical to the version they replace on the branch.
