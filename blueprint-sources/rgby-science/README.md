# Four-pack science from plates

Target: 30 automation, logistic, chemical and utility science packs per minute.
All circuits, engines, batteries, flying robot frames, processing units and low-density structures are manufactured inside. Normal AM2s and chemical plants; no modules. Red transport, fast inserters and selected bulk admissions (bulk-inserter unlock only; no later capacity upgrades).

Supply west: iron plates, copper plates (both labeled entrances), steel plates, plastic, sulfur, sulfuric acid, lubricant and electricity. Recipe demand is calculated from the installed prototype snapshot in `requirements.mjs`. Four finished pack buffers are passive providers at the east edge. Preserve stock-control wires and buffer limits.

Variants ending `labs-15` and `labs-30` connect all four outputs physically to research labs through two mixed-lane belts. They consume science instead of exporting it. Supported lab count depends on technology time and effective lab speed: `floor(SPM × seconds / (60 × speed))`. The native research probes use 15 labs at 2× speed and 30 labs at 1× speed for 60-second units. No science is injected into these probes.

## Reproduce

Use the Factorio 2.1.24 Space Age prototype dump via `FACTORIO_RAW` and the installed macOS Factorio binary for native tests. Test saves and mods stay under ignored `.cache/rgby-science/`.

```
node scripts/rgby-science/generate.mjs
node scripts/rgby-science/connect-labs.mjs
node scripts/rgby-science/validate.mjs
node scripts/rgby-science/build-page.mjs
npm test
npm run build
```

`native-report.json` must match each exact import SHA-256. Separate component proofs do not qualify the assembled factory. The standard factory test supplies only exterior inputs and electricity, checks every productive machine and fluid consumer, collects finished packs, fills the final science chests for a blocked-output interval, then measures recovery. Lab variants perform research using only the factory's actual science production.

Green circuit geometry derives from the preserved, supervised Luna compact circuit trial at `../recovered-workshops/luna-circuits-r7-360.txt`. Other workshops and connectors are generated in `scripts/rgby-science/`. Component evidence is retained below `components/`; only completed exact-hash native improvements are promoted in the main catalogue.
