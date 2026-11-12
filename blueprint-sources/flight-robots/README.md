# Compact flight robot workshop

Custom Factorio 2.1.24 flight-save recipes, separate from the vanilla 2.0 catalogue. Original generated layout; based on this repository's compact science circulation and power-placement helpers.

Target: 10 construction robots, 10 logistic robots and 1 roboport per minute simultaneously. Normal quality, AM2, three chemical plants for batteries, fast inserters with stack size 1, red belts, no modules, no starter robots.

Four solid inlets: iron plates 460/min, copper plates 545/min, steel plates 85/min and plastic 130/min. Two fluid connections: sulfuric acid 800/min and lubricant 300/min. These are exact recipe requirements at the target; provide 15% headroom and extra material while the loop and machine inventories fill. All intermediate products, including batteries, are made inside.

Every finished item goes into the same steel chest. Three filtered collection inserters independently cap its inventory at 200 construction robots, 200 logistic robots and 20 roboports. Leave its slot bar unrestricted. To raise a product's storage limit, change its collection inserter's circuit condition. Increasing storage does not increase production rate.

The red belt circuit reads the circulating belt and limits each ingredient/intermediate/output stock. A separate red circuit reads the shared output chest. A mechanical splitter shares frames between the two robot assemblers; when one branch backs up, spare frames can flow to the other. Copper and plastic use dedicated rear supply belts, and copper wire transfers directly into green-circuit assemblers to reduce circulating traffic. Preserve the red wires, belt reader and inserter settings. Circuit network and all relevant production/robotics recipes must be researched.

Do not inject materials into the circulation belt: use only the numbered exterior ports. Connect electricity at the labelled pole. The preview is a schematic of the exact encoded entities, including pipe headers, belt/inserter directions and circuits.

## Reproduce and validate

```
node scripts/flight-robots/generate.mjs
RECOVERY=1 node tests/flight-robots-native.mjs
node scripts/flight-robots/preview.mjs
node --test tests/flight-robots.test.mjs
node tests/flight-robots-browser.mjs
```

The native runner copies the private flight mod profile into an isolated cache, imports the actual blueprint string, supplies only the declared external ports, and collects only the shared chest. It checks all machines, power, solid input routes and both fluid networks. Full evidence uses 15 minutes warmup and 30 minutes measurement, followed by 45 minutes of uncollected output, an exact per-product chest-cap check, 2 minutes settling and 3 minutes recovery measurement. Evidence is tied to the blueprint and prototype SHA-256 hashes. Live saves are never changed.

## Verified selection

The selected 106×18 layout uses 46 AM2s and three battery chemical plants. It produced 10.133 construction robots, 10.133 logistic robots and 1.067 roboports per minute over 30 measured minutes after 15 minutes warm-up. It passed 45 minutes of blocked outputs and subsequent recovery. The 107×18 52-machine version produced 11.233/11.233/1.1 and remains under `history/headroom-52-machines/`. The independently tested 79×34 two-loop alternative occupies 2,686 tiles; the selected layout uses 29.0% less area. See `optimization-comparison.json` for exact hashes and rates. A 104×18 nine-red-assembler candidate failed the simultaneous targets and was rejected. Reducing engine machines without also balancing frame demand failed the post-blockage logistic-robot floor. This is the best verified compact choice among the tested candidates, not a proof of global optimality.

The final 106×18 revision removes one redundant belt at the lane balancer while preserving the measured production and passing the original full recovery protocol. The previous 107×18 compact source and proof remain under `history/compact-107x18/`. Reproduce that earlier geometry with `ROBOT_BALANCER_DUMMY=1`; current defaults generate the selected revision.


## Selected underground-belt revision

The current 106×18 robot workshop retains its tested public ID and download filename. Its paired native run tested build ID `robots-underground-candidate` (run `1794494305670`), with exact selected blueprint SHA-256 `30edbea366140a650cf0aedaaef9ef6e35f8d52c9d72161b3c935173b2374386`; the full untouched paired report records the baseline and candidate IDs separately. The baseline remains preserved under `history/luna-underground-baseline-1b76c532/`.

This revision creates 4 red underground pairs (reach at most 6 tiles), removes 20 placed entities and 28 red surface belts, and leaves the bounding rectangle at 106×18 (1,908 tiles). Red-transport construction rises from 4,214 to 4,282 iron plates (+68); this is transport-only construction cost, not total factory cost. Native production remains 10.133 construction robots/min, 10.133 logistic robots/min and 1.067 roboports/min. After output was blocked for 45 minutes and each product reached its exact chest cap, 3-minute recovery rates were 11.333 / 15 / 1 per minute. Exact production, pairing and construction evidence accompanies the source.


## Reproduce the selected underground variant

With the exact Factorio 2.1.24 mod profile installed at `.cache/flight-21` (prototype SHA-256 `33912441b13d155b13734523406bbc9aa81fc0f2992344b56106b3aa5c52d19f`):

```sh
node scripts/flight-robots/underground-optimize.mjs
```

The generator reads the frozen baseline from `history/luna-underground-baseline-1b76c532/`, verifies the robot-specific native read-all snapshot and the reviewed optimizer SHA, then writes a candidate and exact construction/structural report only under `.cache/luna-underground-robots/reproduced/`. It does not modify the selected source or site. Expected candidate blueprint SHA-256: `30edbea366140a650cf0aedaaef9ef6e35f8d52c9d72161b3c935173b2374386`. The untouched paired native report and exact neighbor proof are preserved in `history/luna-underground-30edbea3/`.
