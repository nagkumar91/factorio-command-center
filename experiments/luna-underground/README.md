# Bounded underground-belt optimizer

`optimizer.mjs` exports a deterministic, non-mutating `optimizeBlueprint(wrapper, options)` function. It handles one blueprint wrapper (for example the object returned by `decodeBlueprint`), not a blueprint book.

```js
import { optimizeBlueprint } from './optimizer.mjs';

const result = optimizeBlueprint(wrapper, {
  maxDistance: 7,                 // default and pinned fast-underground reach
  minSpan: 5,                     // minimum input-to-output tile distance
  protectedEntityNumbers: [],     // entity IDs that must remain untouched
  // Optional native result for a frozen blueprint; caller verifies the SHA first.
  nativeReadAllBeltComponentEntityNumbers: undefined,
  nativeReadAllBeltComponentBaselineSha256: undefined,
});
```

The result contains:

- `wrapper`: detached updated wrapper; the input object is unchanged.
- `blueprint`: the updated inner blueprint object.
- `metrics`: before/after entity totals, placed entity savings, removed interior surface-belt IDs, new underground endpoint count, and preserved old-pair and endpoint counts. `readAllProtectionMode` reports `conservative-physical` or `native-exact`. These are entity counts, not construction-cost or raw-material savings.
- `changePairs`: exact planned input/output entity IDs, positions, direction, endpoint distance, and the interior IDs removed for each new pair. Existing endpoint IDs are reused.
- `preservedExistingPairs`: old input/output endpoint graph inferred from same-tier, same-direction endpoints using nearest compatible output within reach. Unpaired endpoints remain untouched too.
- `preservedExistingEntityNumbers`: all original underground endpoint IDs, including unpaired endpoints.
- `rejections`: bounded structural blockers encountered during generation.

## Pinned geometry and policy

The read-only Factorio 2.1 dump at `.cache/flight-21/script-output/data-raw-dump.json` declares `fast-underground-belt.max_distance = 7`; this is also checked into the implementation as `PINNED_MAX_DISTANCE`. New endpoint separation is at most seven tiles. A seven-tile pair replaces the eight surface-belt entities from its input through output with two underground entities: six interior entity IDs are removed and both endpoint IDs are retained. Raw construction cost is not scored; the red underground-belt recipe uses 40 gears and 2 yellow underground belts for 2 red underground belts and has a higher iron cost than an equivalent surface span.

Only `fast-transport-belt` runs are eligible. All four surface-belt tiers remain visible to contact and circuit-network safety checks. A deterministic interval dynamic program selects non-overlapping spans to maximize removed interior belts, then minimize pair count, with a stable longest-first tie break. The default minimum endpoint distance is five tiles. It changes no machines or non-belt metadata. It rejects an entire blueprint without edits if an inserter prototype is unknown and the entity does not supply supported array geometry in `pickup_position` plus `drop_position`/`insert_position`.

Safety anchors include actual standard and long-handed inserter pickup/drop tiles (including direction rotation and default direction 0), explicit array position overrides, direct wire endpoints and circuit references, circuit-reader belt components, tagged external ports, splitter footprint contacts, branch/turn contacts, belt control behavior, protected IDs, and cells near existing underground endpoints. All surface-belt tiers and splitter half-tile footprints participate in those checks. Parallel neighboring belts are allowed.

The default circuit-reader mode traverses a conservative physical belt network and can protect unrelated belts that touch at adjacent tiles. For a frozen baseline with a native read-all-belt audit, pass the complete `nativeReadAllBeltComponentEntityNumbers` set and its exact `nativeReadAllBeltComponentBaselineSha256`. The optimizer requires a valid SHA-256 string, requires every locally detected reader seed to appear in the set, and rejects unknown/non-belt IDs. The caller must verify that the set was produced for the exact supplied blueprint hash. In this mode the exact native set replaces only the approximate physical expansion; direct wire references and local circuit anchors remain protected.

## Limits

This is a conservative geometry filter, not a full Factorio transport simulator. It keeps endpoint orientation and lane interface in place and relies on the native runner to verify actual Factorio pairing and flow. It does not calculate belt lane contents, side-load item balance, underground recipe cost, or production throughput. Existing unpaired tunnel endpoints are preserved and reserve a reach zone, but their native pairing behavior still needs review. Custom inserter geometry must use supported array offsets directly on the entity; otherwise optimization safely stops. The default five-tile minimum is a heuristic to avoid exchanging a short surface run for expensive red underground belts, not an economic optimum.

Run fixtures with `node --test experiments/luna-underground/optimizer.test.mjs`.
