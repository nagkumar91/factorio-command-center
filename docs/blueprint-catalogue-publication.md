# Designed blueprint catalogue

The main `index.html#blueprints` explorer includes the dedicated flight workshops and preserved design versions, alongside the original local, community, recipe-cell and raw-input workshop collections.

- **Long game flight plans and strategies:** compact early controlled loops, solid-fuel ore feeder and connected science, seven earlier AM1 workshops, original combined early mall, red/green/blue/military science, all three six-pack input tiers, circuit/engine suppliers, robots/roboports, forestry, robot-serviced forestry, Luna compact circuit/science trials, the on-demand blue-tier belt/inserter mall, and the orbital white-science cell.
- **Autosaved · optimized v2:** all 125 integrated native-validated, module-free revisions. Original Autosaved records remain separately accessible. “v2” denotes the redesigned collection; the underlying candidate/evidence files preserve their own iteration numbers.
- **Science design versions · 2.1:** source-attributed pilot and batch versions. Production qualification is distinct from placement-only checks. Native version 2.1.24 is explicit; a vanilla 2.0.77 qualification is not inferred.
- **Design archive:** unselected earlier science candidates and the unfinished 46-product Early Shopping draft. They remain downloadable, are not promoted as current optimizations, and cannot inflate vanilla coverage.
- **Flight factories · historical mod profile:** 898 already-published exact-hash native designs from the older 2.0.77 EverythingOnNauvis/EV profile. These require that historical environment and do not count toward vanilla coverage or imply compatibility with the replacement 2.1 Nauvis mod.

## Operating metadata

`analysis.inputs` comes from declared exterior ports, including fluids and supplied burner fuel. Optional supplements and bootstrap seed stock are explained separately. `products` and `analysis.outputs` describe exports, never the entities used to construct a factory. Forestry tree planting/pollution absorption is a service; standing trees are not counted as a manufactured export. Historical raw-input profiles carry an explicit input-boundary classification because their mod resources are absent from the vanilla resource list.

The existing Collection, Section, Purpose, Produces this item, Needs this input and raw/intermediate/service controls all operate on these records. Search also includes collection, purpose and game profile. Changing collection clears a stale section filter.

Each entry retains source attribution, exact blueprint SHA-256, a local download, a preview, setup notes and a native report where qualified. Measured rates are kept apart from recipe capacity. A passing test for a source blueprint or a neighboring iteration never qualifies a changed string. Existing dedicated pages and blueprint books are retained.

## Reproduction and audit

Run `node scripts/index-autosaved-derivatives.mjs`, then `node scripts/index-designed-blueprints.mjs`. Both run during `npm run build`; `index:atlas` also reconnects the designed collections. Only the referenced blueprint/evidence files are required, not copied mods, game saves or simulation caches.

`site/sources/designed-blueprints/catalogue-audit.json` enumerates every registered design, input/output boundary, collection, lifecycle, game version and evidence link. The qualified Autosaved exporter separately checks exact source/candidate report hashes and passive-provider output chest prototypes.

Checks: `npm test`, `npm run build`, `npm run test:watchdog`, `node tests/designed-blueprints-browser.mjs` and the existing offline browser suite. The tests cover all exact downloads, the 125-revision census, fuel boundaries, forestry services, excluded historical coverage, section/purpose/input/output filters, and mobile layout.

## Legacy science worktree

Before removal of `/Users/nagkumar/clawd/factorio-science-60`, its untracked supplier reports, bus/four-pack candidate history and assignment were recovered into `blueprint-sources/flight-science-sided/`. Those historical candidates are preserved as source history rather than promoted into the qualified catalogue. Its committed work was already reachable from the remote monorepo. The 49 GiB worktree primarily contained repeated native-test mod snapshots (31 GiB in the project cache and 17 GiB in nested test caches). These caches are not needed to browse or reproduce the published source/evidence collection.
