# Five-pack science from plates, powered by substations

This extension preserves the published four-pack production core and adds a separately supplied purple-science bank. All five packs target approximately 30/min simultaneously. The original four-pack imports and native evidence remain at `../rgby-science/`.

All labeled operating inputs enter on the west; finished science collects in five adjacent passive-provider chests on the east. Supply both the upper core and lower purple bank. Stone and stone bricks are separate ingredients: rails consume stone; electric furnaces consume bricks. External inputs are iron plates, copper plates, steel plates, plastic, sulfur, sulfuric acid, lubricant, stone and bricks. Rates are in `manifest.json` and the website guide.

Sizes: the factory is 132 x 92; with 15 connected labs 141 x 92; with 30 connected labs 149 x 92. The purple bank starts on the row directly under the four-pack core and all its connecting belts stay inside its own rows; long plain connecting belts run underground. Inside the purple finishing ring, iron plates are admitted from the inside onto the top belt so that stone, bricks and circuits keep the west column's other lane, and the west rail assembler has a third pickup arm. The green-circuit splitter serves the advanced-circuit block first.

Normal AM2s, chemical plants, red transport and substations. No installed modules. Productivity modules are manufactured as an ingredient of purple science. Selected bulk inserters need only the capacity granted by the bulk-inserter unlock; no later capacity upgrade is assumed. Rails use a separate short feed to avoid crowding the mixed ingredient loop.

The connected variants manufacture all five packs and feed them physically to labs. The lab annex stands on the east side beside the four-pack core, above the five science chests; inserters take each pack from its chest onto two short mixed belts, and one purple belt serves both lab rows. The native probe requires one of each pack per 60-second research unit. It uses 15 labs at effective 2× speed or 30 at 1× speed. No science is injected. Actual supported lab count depends on technology duration, pack quantities and research speed. Technologies requiring military, space or planetary packs need those additional packs separately.

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

Green circuit geometry derives from the preserved supervised Luna compact circuit trial at `../recovered-workshops/history/return-belt-pair-bf4d6a63/luna-circuits-r7-360.txt` (the 26 x 14 return-belt pair, since replaced in the library by a smaller version; this copy is unchanged). The core's provenance is retained in its original four-pack sources. Separate purple/circuit component evidence lives in `components/`; component proofs do not qualify the assembled factory.

## Versions

The 2026-11-21 review replaced the first published strings (132 x 100, 141 x 112 and 141 x 119; SHA-256 386ecb95..., a71852bb... and 4ff74162...). They, their manifest and their passing native report are kept in `history/annex-below-386ecb95/`. The current strings have the same entrances in the same order on the west (the purple bank's six are two rows higher), the same science exits, the same 139 assembling machines and 2 chemical plants, and passed the same native protocol (same harness and validator): 36 / 30 / 29.6 / 30 / 32.4 per minute for red, green, blue, yellow and purple (recovery 36 / 30.4 / 30.4 / 31.2 / 32.0), and 30.0 research units per minute for both lab variants.

`generate.mjs` and `connect-labs.mjs` mark an import `native-qualified` only when `native-report.json` beside it holds a passing run for its exact SHA-256; `qualify-all.mjs` stamps the manifest after a full run. A re-run of the generators therefore leaves this folder byte-identical.
