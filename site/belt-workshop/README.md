# On-demand belt workshop

Import `belt-workshop.txt`. One blueprint, **22 × 16 tiles, 13 assembling machine 2**, 4 substations, no modules. It is the [on-demand inserter workshop](../inserter-workshop/README.md) built for belts: one closed red-belt ring with a hold reader and per-item stock caps, plates in from the west once per material, one passive provider chest per product on the east, and a clock that shares the scarce ingredients. Inputs enter from the west, north to south: iron plates, copper plates. Six adjacent east passive provider chests, north to south: fast transport belt, fast underground belt, fast splitter, transport belt, underground belt, splitter. Each stops at **one stack** (100 belts, 50 undergrounds, 50 splitters); `manifest.json` exposes both `outputCaps` and each output's numeric `cap`.

Blueprint SHA-256: `d15f44ab586c2fef639c19e1f7e4d5ffc86df06731cab61825fe4b76328b282b`.

All three yellow chests fit without lowering the red rates: the yellow items are made anyway as ingredients of the red ones, so the yellow tier costs no extra assembler, only three chests and three export arms. There is no express tier (it needs lubricant).

## Rates

Declared continuous targets: **30 fast transport belts, 3.5 fast underground belts, 4 fast splitters, 10 transport belts, 6 underground belts and 2 splitters a minute**. The essentials mall makes about 13.6 red belts, 2 red undergrounds and 2.6 red splitters a minute.

Measured natively with all six chests emptied every second (`native-report.json`):

| | Target | Steady, 10 min | Recovery, 5 min |
| --- | --- | --- | --- |
| Fast transport belt | 30 | 36.0 | 36.0 |
| Fast underground belt | 3.5 | 4.0 | 4.0 |
| Fast splitter | 4 | 5.0 | 4.6 |
| Transport belt | 10 | 12.4 | 14.2 |
| Underground belt | 6 | 7.3 | 7.8 |
| Splitter | 2 | 2.5 | 3.0 |

## Why these targets: the gear arithmetic

From the recipes in the prototype dump, one of each product costs:

| | Gears | Iron plates direct | Circuits | Plates in all |
| --- | --- | --- | --- | --- |
| Fast transport belt | 5.5 | 0.5 | | 11.5 iron |
| Fast underground belt | 21.25 | 6.25 | | 48.75 iron |
| Fast splitter | 12 | 7 | 15 | 46 iron, 22.5 copper |
| Transport belt | 0.5 | 0.5 | | 1.5 iron |
| Underground belt | 1.25 | 6.25 | | 8.75 iron |
| Splitter | 2 | 7 | 5 | 16 iron, 7.5 copper |

An assembling machine 2 makes 90 gears a minute, so the four gear assemblers make **360 gears a minute**; the one green circuit assembler makes at most **90 circuits a minute** (its two wire assemblers make 360 wire, enough for 120). At the targets the workshop needs 30 × 5.5 + 3.5 × 21.25 + 4 × 12 + 10 × 0.5 + 6 × 1.25 + 2 × 2 = **304 gears a minute (84% of 360)** and 4 × 15 + 2 × 5 = **70 circuits a minute (78% of 90)**. Gears decide everything: with every chest emptied the four gear assemblers worked 100% of the measured time, and nothing else ran out of plates. The red belt has the largest share by design: two gear assemblers hand it all their gears directly (180 a minute, 36 red belts), which is exactly the measured rate. The rest of the gears (180 a minute) go round the ring to the yellow belt maker, the red splitter maker and the red underground maker. Each target is about 80 to 88% of the lowest rate measured for it.

## Supply

Give each entrance **960 iron plates and 130 copper plates a minute** (`requiredInputsPerMinute`). That is the measured draw with every chest emptied at once (952 iron, 129 copper), rounded up. `probe-stated-supply-report.json` is the same protocol with each entrance offered exactly those figures instead of a full belt: it passes (36.0 / 3.8 / 4.9 / 14.6 / 8.0 / 2.6 a minute).

The recipe arithmetic for exactly the targets is 799 iron and 105 copper a minute (`nominalInputsPerMinute`). That is not enough when all six chests are emptied at once, because the workshop does not share a short supply in exactly the target proportions. Offered exactly those figures it made 31.6 red belts, 3.4 red undergrounds, 4.1 red splitters, 8.3 yellow belts, 6.0 yellow undergrounds and 1.2 yellow splitters a minute (`probe-nominal-supply-report.json`, a recorded failure of the steady rate checks for the yellow belt and yellow splitter; its recovery rates and all six refills passed). With chests that are mostly full, as an on-demand workshop normally runs, any supply works: it only sets how fast a chest refills.

## How it works

One closed red-belt ring, clockwise, 43 pieces (one tile of the top row is bridged by an underground pair). A whole-belt hold reader puts the ring's stock on a red wire; every arm that adds an item to the ring works only while the ring holds less than that item's cap (`loopControl[0].limits`, 148 items in all against a ring capacity of 344). Makers sit in ring order, each downstream of the makers of its ingredients.

- **Top row**, above the ring: a gear assembler, then the yellow underground, yellow splitter, red splitter and red underground makers. They take ingredients from the ring and return products to it.
- **Inside the ring**: wire, green circuits, wire, gears. Both wire assemblers hand wire straight to the green assembler between them; wire never goes on the ring. The inside gear assembler lays gears on the ring and hands gears across the ring's top row to the red underground maker by a long-handed arm in the bridged tile.
- **Bottom row**: gear, red belt, gear, and the yellow belt maker. The two gear assemblers either side of the red belt maker hand it all their gears directly. The red belt maker takes yellow belts off the ring's bottom row. The yellow belt maker lays its belts on the bottom row just upstream of it, so red belts get yellow belts first.
- **Iron** enters once. Two arms lift it onto the ring's west column. The same belt then dives under the copper row, feeds the west gear assembler directly, runs east along the bottom edge and turns north between the middle gear assembler and the yellow belt maker, feeding both directly. It then passes under the ring into a riser inside it, where one arm lays iron on the ring's **outer lane**, just upstream of the inside gear assembler. Arms outside the ring can only reach the inner lane, which carries every product.
- **Copper** is lifted onto the west column by its own two capped arms; only the two wire assemblers take it.
- **Clock**: a constant 1 plus the counter's own output, taken modulo 1800, counts 0 to 1799 for ever; divided by 150 it gives twelve phases of 2.5 seconds. The yellow splitter maker's ingredient arms work in phases 0 to 5, the yellow underground maker's in 8 to 11, and the yellow belt chest's export arm in 0 to 7. Without the clock the yellow makers eat the belts and circuits the red makers need (first screening: 11 red belts a minute and 60 yellow belts) and the yellow belt chest takes every yellow belt that reaches it. The red makers' arms always work.
- **Exits**: one arm and one passive provider chest per product on the east column, each chest limited to one stack.

All transport is red belt and red underground belt; all arms are bulk inserters at their unlock hand size of two, plus one long-handed inserter. Preserve all wires, filters, bars and circuit settings: removing wires changes the tested design.

## Reproduce

From the `factorio-command-center` folder:

```sh
export FACTORIO_RAW='/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json'
node scripts/belt-workshop/generate.mjs
node scripts/belt-workshop/validate.mjs
BELT_SUPPLY=stated BELT_PROBE_NAME=stated-supply node scripts/belt-workshop/validate.mjs
BELT_BLOCK_MINUTES=30 BELT_PROBE_NAME=long-block node scripts/belt-workshop/validate.mjs
BELT_SUPPLY='{"iron-plate":799.125,"copper-plate":105}' BELT_PROBE_NAME=nominal-supply node scripts/belt-workshop/validate.mjs   # exits 1: recorded failure
node --test tests/belt-workshop.test.mjs
```

The generator leaves this folder byte-identical on a re-run, keeps the committed string when a regeneration decodes to the same blueprint, and marks the manifest verified only when `native-report.json` passed for the exact string. The validator runs the installed Factorio 2.1.24 binary headless (vanilla Space Age, the official prototype dump, fast stack bonus zero, bulk unlock bonus one so the hand holds at most two, no later upgrades) with a private configuration, mod folder, saves and logs under the git-ignored `.cache/belt-workshop/`. Only the standard protocol writes `native-report.json` and the manifest status; the probes write their own `probe-*-report.json`.

## Native qualification

The run imports the exact SHA-256-matched string and verifies revived entity positions, directions and recipes, clear exterior approaches, power for every machine, arm and combinator, the imported circuit gate conditions and ring wiring, a productive route from every declared entrance, and every assembler crafting. Only the declared entrance belts receive plates. No intermediates are injected.

It measures ten minutes after ten minutes of warm-up, then fills only the six product chests and stops collecting for five minutes, settles for five minutes and measures five minutes of recovery. Steady and recovery rates must each reach **95% of every declared target**. While collection is stopped every chest must stay at exactly its cap, no assembler may finish a craft in the last minute of the hold, and the ring's stock of every item must be within its cap (plus at most one hand of two per arm that adds that item, since arms released together each check the cap before they swing). Finally it withdraws half a stack (50 belts, 25 undergrounds or splitters) from one chest at a time and requires that chest back at its cap with new crafts within five minutes while the other five stay full. `native-report.json` records the six refills, the rest check, the blueprint, prototype, harness and validator hashes, and, for the steady measurement window, each assembler's status shares and which ingredient it lacked while waiting, the mean ring stock per item, each arm's status shares and the seconds seen in each clock phase.

`probe-long-block-report.json` holds the full chests for 30 minutes instead of five: the chests stay at exactly their caps, the workshop is at rest, the ring never passes 170 items, and every rate and refill check passes afterwards.

## Candidates

All screened natively with every chest emptied (red belt, red underground, red splitter, yellow belt, yellow underground, yellow splitter, a minute):

- First ring, 22 × 16, 13 assemblers, yellow belt maker in the top row, three bottom gear assemblers sharing gears between the ring and the red belt maker: 11.4 / 1.6 / 4.4 / 59.6 / 0 / 0.6 (five-minute screen). The yellow belt chest took the belts the red belt maker needed.
- Yellow belt maker moved to the bottom row upstream of the red belt maker: 18.8 / 6.0 / 4.4 / 33.8 / 3.8 / 1.6 (five minutes). The inside gear assembler starved for iron.
- Riser iron on the outer lane, both bottom gear assemblers dedicated to the red belt maker, yellow belt chest open in 4 of 12 phases: 36.0 / 4.2 / 4.6 / 6.6 / 8.0 / 3.1 (ten minutes).
- The same with the yellow belt chest open in 6, 8 (this design) or 9 phases: 36.0 / 4.2 / 4.4 / 9.4 / 7.4 / 3.5; 36.0 / 4.0 / 5.0 / 12.4 / 7.3 / 2.5; 36.0 / 3.6 / 5.1 / 18.9 / 6.6 / 1.9. Moving the yellow underground maker to phases 9 to 11 as well: 36.0 / 4.4 / 4.6 / 18.8 / 3.4 / 3.0. Eight phases gives every yellow chest a useful rate.
