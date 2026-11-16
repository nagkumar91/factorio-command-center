# Five-pack science from plates, powered by substations

This extension preserves the published four-pack production core and adds a separately supplied purple-science bank. All five packs target approximately 30/min simultaneously. The original four-pack imports and native evidence remain at `../rgby-science/`.

All labeled operating inputs enter on the west; finished science collects in five adjacent passive-provider chests on the east. Supply both the upper core and lower purple bank. Stone and stone bricks are separate ingredients: rails consume stone; electric furnaces consume bricks. External inputs are iron plates, copper plates, steel plates, plastic, sulfur, sulfuric acid, lubricant, stone and bricks. Rates are in `manifest.json` and the website guide.

Normal AM2s, chemical plants, red transport and substations. No installed modules. Productivity modules are manufactured as an ingredient of purple science. Selected bulk inserters need only the capacity granted by the bulk-inserter unlock; no later capacity upgrade is assumed. Rails use a separate short feed to avoid crowding the mixed ingredient loop.

The connected variants manufacture all five packs and feed them physically to labs. The native probe requires one of each pack per 60-second research unit. It uses 15 labs at effective 2× speed or 30 at 1× speed. No science is injected. Actual supported lab count depends on technology duration, pack quantities and research speed. Technologies requiring military, space or planetary packs need those additional packs separately.

## Reproduce

Use the installed official Factorio 2.1.24 Space Age prototype dump through `FACTORIO_RAW`. The native harness runs only private test saves and official mods, with caches under ignored `.cache/five-science/`.

```
node scripts/five-science/generate.mjs
node scripts/five-science/connect-labs.mjs
node scripts/five-science/qualify-all.mjs
node scripts/five-science/build-page.mjs
npm test
npm run build
```

`FIVE_IMPORT_ONLY=1 node scripts/five-science/validate.mjs` checks native blueprint geometry, stock-control wiring, approach clearance and power without claiming production throughput. Full qualification launches one isolated native process per layout in parallel (five-minute factory priming and fifteen-minute lab priming), then measures sustained simultaneous delivery plus recovery after filling final science chests. Connected variants instead measure research progress from actual factory production. Every published native record must match the exact import SHA-256.

Green circuit geometry derives from the preserved supervised Luna compact circuit trial at `../recovered-workshops/luna-circuits-r7-360.txt`. The core's provenance is retained in its original four-pack sources. Separate purple/circuit component evidence lives in `components/`; component proofs do not qualify the assembled factory.
