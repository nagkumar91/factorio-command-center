# Flight forest system

Generate: node scripts/flight-forest/generate.mjs

Private native test (180 simulated minutes): node tests/flight-forest-native.mjs

Idle probe: FOREST_IDS=standing-grove FOREST_MINUTES=30 FOREST_CONTROL=tests/flight-forest-idle-control.lua FOREST_REPORT=idle-mechanics-report.json node tests/flight-forest-native.mjs

Render: node scripts/flight-forest/preview.mjs

Open site/flight-forest/index.html for full instructions, exact strings and evidence.

Requires the installed modded 2.1.24 profile; not the vanilla 2.0.77 catalogue. Original local designs. Tree nursery is renewable after seeding and solar startup; infrastructure materials remain external. Autonomous forest uses reserve-gated harvesting and solar power; requires 50 initial seeds but no ongoing inputs or exports. Idle tower emissions were measured to stop, so no power-switch clock is needed. Standing groves remain a manual alternative: seed supply and grid power while planting, with optional tower removal to reuse the equipment; idle towers need not be removed for net absorption. No fixed forest guarantees absorption of unlimited pollution.
