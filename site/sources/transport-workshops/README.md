# Combined transport workshops

Three verified Factorio Command Center blueprints for Factorio 2.0.77 with Space Age: one each for yellow, red and blue transport. Green is still being tested and is not included in the downloadable book. Each makes its belt, underground belt and splitter together, with its own smelting and intermediate production. They require no robots or imported intermediate items.

Supply external electricity at the big pole marked **P**. Medium poles distribute power internally. Follow the item and fluid displays at the left entrances, connect from the left, and press Alt to show their labels. The website preview numbers the output chests. Collect each finished product from its own chest.

| Workshop | External raw materials | Surface |
| --- | --- | --- |
| Yellow | Iron ore, copper ore, coal | Nauvis |
| Red | Iron ore, copper ore, coal | Nauvis |
| Blue | Iron ore, copper ore, coal, water, crude oil | Nauvis |

The planned green workshop requires Vulcanus pressure, foundries and additional raw materials. It will be published after verification. Published workshops use assembling machine 2 and steel furnaces.

**Circuit network is required to operate these workshops.** Keep the belt reader, green wires and inserter conditions intact. They limit stock on the shared circulating belt. Each card lists the full research requirements, including the upgraded construction machines and poles, so yellow is available later than the first Logistics unlock.

Blue cracks light oil into petroleum gas, uses petroleum for its intermediates, and turns surplus into solid fuel. Collect the solid fuel from output chest 4 as well. A full byproduct chest eventually stops refining. External power is supplied separately.

The construction-crate command contains the entities needed to place the workshop. Its operating raw materials are listed separately on the page; the blueprint does not include test fixtures or free ingredients.

## Design reviews and verification

Luna agents at maximum reasoning designed and reviewed each colour in isolated working copies. See [the design and tuning review](REVIEW.md) for footprint, material comparisons, measured output and decisions.

`validation.json` records native import, research, labeled entrances, power connection, recipe production, and output collection/replenishment checks. `throughput.json` measures simultaneous output collection with full raw input supply, after a warmup. Both reports use a fixed world seed and are tied to the exact blueprint and setup hashes. They measure the saved layouts without robots, direct machine inventory injection or extra production machines.

Rates describe compact workshops under the stated test conditions; they are not full-belt production lines. Output shares change when some chests fill or inputs run short.

Reproduce from the project root:

```sh
npm run prepare:transport
npm run test:transport
npm run benchmark:transport
cp .cache/transport-workshops/throughput/throughput.json blueprint-sources/transport-workshops/throughput.json
npm run index:atlas
npm run test:transport-browser
```

Generation uses the installed vanilla Space Age raw data dump, set with `FACTORIO_RAW` if it is outside the default cache path. The normal build and browser use the checked-in blueprints and evidence. Fresh throughput reports are written to `.cache/transport-workshops/throughput/throughput.json`; promote a successful report to this source directory before indexing a changed blueprint.

## Publish one workshop

After the source blueprint and its successful native reports have been updated:

```sh
npm run publish:transport -- transport-yellow
```

Use `transport-red` or `transport-blue` for the other published workshops, or omit the ID to publish every verified entry in `manifest.json`. Draft designs stay out of that manifest. Publication rejects failed or mismatched evidence; it checks the exact blueprint and setup hashes. It preserves other published workshops, without rebuilding the full atlas. The local server serves the new files immediately.

The storage contract is a small `site/data/transport-workshops/index.json` plus immutable per-version records. Each index entry contains its blueprint ID, name, colour, blueprint SHA-256, record revision and record URL. The record includes the complete card data, import string, construction materials, raw inputs, connections, research and measured rates. Its preview and native reports also use immutable URLs. Older versions remain readable. A serialized publisher writes the referenced files first and atomically replaces the index last.

The HTTP client checks only the small index every 30 seconds and on focus, fetches changed records, and caches unchanged revisions. A newly loaded application incorporates the current releases. Later releases wait behind **Blueprint updates available** until clicked. Applying an update preserves the route, filters and crate; it does not reload the document. Loading this new client in a tab that already has the older application still requires a user-chosen navigation or refresh once. Offline `file:` copies use their bundled catalogue and do not poll.

`npm run index:atlas` remains the full rebuild path for the bundled offline catalogue. Run it before packaging an offline release. `npm run build` packages the current website; neither command deploys to GitHub Pages or the Pi. Tests for publication and in-page updates run with `npm test` and `npm run test:blueprint-updates-browser`.
