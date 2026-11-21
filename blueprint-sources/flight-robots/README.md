# Compact flight robot workshop

Custom Factorio 2.1.24 flight-save recipes, separate from the vanilla 2.0 catalogue. Original generated layout; based on this repository's compact science circulation and power-placement helpers.

Target: 10 construction robots, 10 logistic robots and 1 roboport per minute simultaneously. Normal quality, AM2, three chemical plants for batteries, fast inserters with stack size 1, red belts, no modules, no starter robots.

Four solid inlets: iron plates 460/min, copper plates 545/min, steel plates 85/min and plastic 130/min. Two fluid connections: sulfuric acid 800/min and lubricant 300/min. These are exact recipe requirements at the target; provide 15% headroom and extra material while the loop and machine inventories fill. All intermediate products, including batteries, are made inside.

Every finished item goes into the same steel chest. Three filtered collection inserters independently cap its inventory at 200 construction robots, 200 logistic robots and 20 roboports. Leave its slot bar unrestricted. To raise a product's storage limit, change its collection inserter's circuit condition. Increasing storage does not increase production rate.

The red belt circuit reads the circulating belt and limits each ingredient/intermediate/output stock. A separate red circuit reads the shared output chest. A mechanical splitter shares frames between the two robot assemblers; when one branch backs up, spare frames can flow to the other. Copper and plastic use dedicated rear supply belts, and copper wire transfers directly into green-circuit assemblers to reduce circulating traffic. Preserve the red wires, belt reader and inserter settings. Circuit network and all relevant production/robotics recipes must be researched.

Do not inject materials into the circulation belt: use only the numbered exterior ports. Connect electricity at the labelled pole. The preview is a schematic of the exact encoded entities, including pipe headers, belt/inserter directions and circuits.

## Versions

Two qualified versions are offered. Both meet every target in the full native protocol for their exact strings (15 minutes warm-up, 30 minutes measured; then 45 minutes of blocked output, 2 minutes settling and 3 minutes measured). The manifest's `versions` list (the shared convention in `scripts/blueprint-versions.mjs`) holds each version's label, file, manifest, report, size, machines and steady and recovery rates; the craft counts below come from each version's own report. The website's library card and guide page show both versions from that list.

| | Current (smaller) | Earlier (slightly faster) |
| --- | --- | --- |
| File | `robots-10-roboport-1.txt` | `history/luna-underground-30edbea3/robots-10-roboport-1.txt` |
| Blueprint SHA-256 | `120a56b5…` | `30edbea3…` |
| Footprint | 96 × 18 = 1,728 tiles | 106 × 18 = 1,908 tiles |
| Machines | 45 AM2 + 3 chemical plants | 46 AM2 + 3 chemical plants |
| Construction robots/min (30 min) | 10.100 (303 crafts) | 10.133 (304) |
| Logistic robots/min (30 min) | 10.133 (304) | 10.133 (304) |
| Roboports/min (30 min) | 1.000 (30) | 1.067 (32) |
| After blocked output (3 min) | 13.667 / 17.333 / 1 | 11.333 / 15 / 1 |

Which to choose: the current version by default. It takes 9.4% fewer tiles and one assembling machine fewer. Choose the earlier version if you have the room and want its extra crafts (one more construction robot and two more roboports in a 30-minute window). With nine frame assemblers the robot total is fixed by the frames (both versions run them flat out), so the steady differences are one to three crafts per window. On 2026-11-21 the user accepted this trade for the smaller version.

The current version drops the last cable assembler (the fourth cable/green group is cable + green only) and moves the gear and pipe assemblers to the east end of the bottom row, pipe then gear. Its pre-underground baseline `0512b426…` and that baseline's own passing native report are under `history/pair-swapped-baseline-0512b426/`. The underground step then buries three rear-belt spans: 15 fewer placed entities, 21 fewer red surface belts, 6 more red underground endpoints, 51 more iron plates for red transport. `native-pairing-report.json` shows all three new pairs and the three existing ones forming natively, with no unpaired tunnel; `underground-proof.json` summarises the checks.

Supply: in a design-review probe on the current layout's baseline, fed at exactly the panel figures, it fell short on logistic robots (8.13/min) and also fell short at 1.05×; it met every target at 1.10× and 1.15×. The earlier version behaved the same way (it failed at 1.00× and 1.05×). Provide the 15% headroom stated above.

Older preserved designs: `history/compact-107x18/` (107 × 18, 10.133 / 10.133 / 1.067), `history/headroom-52-machines/` (52 machines, 11.233 / 11.233 / 1.1), `history/luna-underground-baseline-1b76c532/` (the earlier version before its underground step) and `history/two-loop-alternative/` (79 × 34, 2,686 tiles). A 104 × 18 nine-red-assembler candidate failed the simultaneous targets and was rejected. See `optimization-comparison.json` for exact hashes and rates. These are the best verified choices among the tested candidates, not a proof of global optimality.

## Reproduce and validate

```
node scripts/flight-robots/generate.mjs            # baseline -> history/pair-swapped-baseline-0512b426, published string, optimizer report, manifest
RECOVERY=1 node tests/flight-robots-native.mjs     # full native protocol for the exact published string; writes native-report.json
node scripts/flight-robots/native-pairing.mjs blueprint-sources/flight-robots/robots-10-roboport-1.txt blueprint-sources/flight-robots/manifest.json blueprint-sources/flight-robots/native-pairing-report.json blueprint-sources/flight-robots/optimizer-report.json
node scripts/flight-robots/underground-proof.mjs
node scripts/flight-robots/generate.mjs            # again, to record the evidence hashes and the version list
node scripts/flight-robots/preview.mjs
node --test tests/flight-robots.test.mjs
node tests/flight-robots-browser.mjs
```

The generator and native tools read the private flight-21 profile in `.cache/flight-21/` (mods and `data-raw-dump.json`, SHA-256 `33912441…`). The generator pins the baseline hash and needs the committed `native-read-all-snapshot.json` for it (made with `native-pairing.mjs` on the baseline); on a re-run it leaves this folder byte-identical. Screening a different layout: set `ROBOT_OUTPUT` to a scratch folder plus the layout switches listed at the top of `generate.mjs`; `ROBOT_LAST_GROUP=triple ROBOT_PARTS_SIDE=top` reproduces the earlier baseline `1b76c532…`, and `node scripts/flight-robots/underground-optimize.mjs` with no arguments reproduces the earlier version `30edbea3…` from it.

The native runner copies the private flight mod profile into an isolated cache, imports the actual blueprint string, supplies only the declared external ports, and collects only the shared chest. It checks all machines, power, solid input routes and both fluid networks. Evidence is tied to the blueprint and prototype SHA-256 hashes. Live saves are never changed.
