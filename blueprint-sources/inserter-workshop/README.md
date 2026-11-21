# On-demand inserter workshop

Import `inserter-workshop.txt`. One blueprint, **22 × 15 tiles, 12 assembling machine 2**, 3 substations, no modules. Inputs enter from the west once per material, north to south: iron plates, copper plates, plastic. Four adjacent east passive provider chests each stop at **50 items**. `manifest.json` exposes both `outputCaps` and each output's numeric `cap`.

Blueprint SHA-256: `d4b131ea48e51fc985f3f145b4951a78991edc89b289dd060cb84c91a20feec5`. It replaces the first version (26 × 17, 13 assemblers, `history/first-ring-b69ef44b/`) in place: same products, targets, caps, input materials and sides.

## Rates

Declared continuous targets: **15 normal, 15 long-handed, 15 fast, 2.5 bulk inserters a minute**. This is an explicit smaller on-demand alternative to the requested 15/15/15/5 profile; keep the distinction when presenting its rates.

Measured natively with all four chests emptied every second (`native-report.json`):

| | Target | Steady, 10 min | Recovery, 5 min | First version, steady |
| --- | --- | --- | --- | --- |
| Inserter | 15 | 26.1 | 25.0 | 18.2 |
| Long-handed inserter | 15 | 26.2 | 26.8 | 19.2 |
| Fast inserter | 15 | 21.2 | 21.8 | 18.2 |
| Bulk inserter | 2.5 | 3.0 | 2.8 | 2.5 |

## Supply

Give each entrance **630 iron plates, 275 copper plates and 7 plastic a minute** (`requiredInputsPerMinute`). That is the measured draw with every chest emptied at once (622 iron, 269 copper, 5 to 6 plastic), rounded up. `probe-stated-supply-report.json` is the same protocol with each entrance offered exactly those figures instead of a full belt: it passes (25.7 / 25.6 / 21.5 / 3.0 a minute).

The recipe arithmetic for exactly the targets is 422.5 iron, 192.5 copper and 5 plastic a minute (`nominalInputsPerMinute`; 560, 272.5 and 10 for the requested 5 a minute of bulk). That is not enough when all four chests are emptied at once: the workshop does not share a short supply evenly. Offered exactly those figures it made 35.1 normal and 19.1 fast but only 9.1 long-handed and 1.2 bulk a minute (`probe-nominal-supply-report.json`, a recorded failure of the rate checks; the four refills still passed). The first version had the same weakness (21.4 / 12.3 / 20.0 / 1.6) and failed the rate checks at every limited supply tried up to 630 iron a minute; it passed only on full belts. With chests that are mostly full, as an on-demand workshop normally runs, any supply works: it only sets how fast a chest refills.

## How it works

One closed red-belt ring, clockwise, 42 pieces. A whole-belt hold reader puts the ring's stock on a red wire; every arm that adds an item to the ring works only while the ring holds less than that item's cap (`loopControl[0].limits`, 156 items in all against a ring capacity of 336).

- **Top row**, above the ring: the four inserter tiers and the red-circuit assembler. They take ingredients from the ring and return products to it.
- **Inside the ring**: cable, green, green, cable. Each cable assembler hands wire straight to the green assembler beside it and puts the rest on the ring. A long-handed arm in a bridged ring tile carries cable from the east cable assembler into the red-circuit assembler.
- **Bottom row**: a gear assembler at each end, and the rear cable assembler, whose wire crosses the ring through a second bridged tile into the second green assembler.
- **Iron** enters once. Two arms lift it onto the ring's west column. The same belt then dives under the copper and plastic rows, passes the west gear assembler (fed directly), runs buried under the bottom row, passes the east gear assembler (fed directly) and rises under the ring to a tile inside it. An arm standing inside the ring lays iron on the ring's **outer lane**, just upstream of the two arms that feed the green assemblers. Arms outside the ring can only reach the inner lane, which also carries copper, gears and finished inserters; in the first version that lane had no room for the iron the green assemblers needed, and green circuits limited everything.
- **Copper and plastic** are lifted onto the west column by their own capped arms.
- **Clock**: a constant 1 plus the counter's own output, taken modulo 1800, counts 0 to 1799 for ever; divided by 150 it gives twelve phases of 2.5 seconds. The normal tier's ingredient arms work in phases 0 to 9, the long-handed tier's in 0 to 4, the fast tier's in 6 to 11. The bulk tier is last on the ring and takes what the others leave. The first version's free-running counter reaches the 32-bit limit after 414 days of game time; a native probe showed its phase then never enables the fast tier again.
- **Exits**: one arm and one passive provider chest per tier on the east column, each chest limited to one stack. The normal and fast export arms leave two on the ring for the next tier.

All transport is red belt and red underground belt; all arms are bulk inserters at their unlock hand size of two, plus two long-handed inserters. Preserve all wires, filters, bars and circuit settings: removing wires changes the tested design.

## Reproduce

From the `factorio-command-center` folder:

```sh
export FACTORIO_RAW='/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json'
node scripts/inserter-workshop/generate.mjs
node scripts/inserter-workshop/validate.mjs
INSERTER_SUPPLY=stated INSERTER_PROBE_NAME=stated-supply node scripts/inserter-workshop/validate.mjs
INSERTER_BLOCK_MINUTES=30 INSERTER_PROBE_NAME=long-block node scripts/inserter-workshop/validate.mjs
INSERTER_SUPPLY='{"iron-plate":422.5,"copper-plate":192.5,"plastic-bar":5}' INSERTER_PROBE_NAME=nominal-supply node scripts/inserter-workshop/validate.mjs   # exits 1: recorded failure
node --test tests/inserter-workshop.test.mjs
```

The generator leaves this folder byte-identical on a re-run and marks the manifest verified only when `native-report.json` passed for the exact string it produced. The validator runs the installed Factorio 2.1.24 binary headless (vanilla Space Age, the official prototype dump, fast stack bonus zero, bulk unlock bonus one so the hand holds at most two, no later upgrades) with a private configuration, mod folder, saves and logs under the git-ignored `.cache/inserter-workshop/`. Only the standard protocol writes `native-report.json` and the manifest status; the probes write their own `probe-*-report.json`.

## Native qualification

The run imports the exact SHA-256-matched string and verifies revived entity positions, directions and recipes, clear exterior approaches, power for every machine, arm and combinator, the imported circuit gate conditions and ring wiring, a productive route from every declared entrance, and every assembler crafting. Only the declared entrance belts receive ingredients. No intermediates are injected.

It measures ten minutes after ten minutes of warm-up, then fills only the four product chests and stops collecting for five minutes, settles for five minutes and measures five minutes of recovery. Steady and recovery rates must each reach **95% of every declared target**. Finally it withdraws 25 normal, long-handed or fast inserters, or 10 bulk, from one chest at a time and requires that chest back at 50 with new crafts within five minutes while the other three stay full. `native-report.json` records the four refills, the blueprint, prototype, harness and validator hashes, and for each assembler which ingredient it lacked while waiting, the mean ring stock per item, each arm's status shares and the seconds seen in each clock phase.

`probe-long-block-report.json` holds the full chests for 30 minutes instead of five: the chests stay at exactly 50, the ring never passes 185 items and every rate and refill check passes afterwards.

## History

`history/first-ring-b69ef44b/` keeps the first version with its manifest and passing report.
