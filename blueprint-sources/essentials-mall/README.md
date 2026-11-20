# Essentials mall · eight building products on demand

Status: **qualified**. `native-report.json` says `passed: true` for the exact string in `essentials-mall.txt`, from a full-protocol native run (Factorio 2.1.24 Space Age, vanilla, normal quality).

One on-demand mall that makes all eight at once and stops each product by itself at its own stock cap: assembling machine 2, fast transport belt, fast underground belt, fast splitter, fast inserter, bulk inserter, electric furnace and electric mining drill.

- Footprint **23 × 17 = 391 tiles**. The goal was 442 and the stretch 400; both are met.
- **19 assembling machine 2**, no modules, no beacons: 3 iron gear, 2 advanced circuit, and 1 each of copper cable, transport belt, underground belt, splitter, inserter, assembling machine 1 and the eight finals.
- 2 substations and 4 medium poles, all inside the rectangle. Electricity enters at the substation in the rear iron band, tiles (11..12, 11..12) (the `power` port).
- Red belts and one red underground pair; no splitter is needed any more. Fast, long-handed and bulk inserters at the unlock baseline (bulk hand 2).

```
     10123456789012345678901        x (west → east), y down
  -3 ..FS#FU#A2#DR#BI#FB#lKC        top row: finals; l = long arm to the fast-belt chest, K = cap combinator
  -2 >>##################.PP        plastic entrance; PP = east substation
  -1 Dibiibiibiibiibiibib.PP
   0 D>>>>>>>>>>>>>>>>>>>viC        ring top (east-bound); C = output chests
   1 >^iipii.ip.ii.ii.ii.viC        circuit entrance (gated belt); p = medium poles
   3 >^SP#AC#CB#IN#FI#EF#viC        inside row; copper, steel, brick entrances at rows 3, 4, 5
   5 >^.i==i.pi==i==i==i.viC        clock (3 arithmetic combinators) and the feed decider at (15..16, 5)
   6 D^<<<<<<<<<<<<<<<<<<<iC        ring bottom (west-bound); D = entrance labels
   9 .^UB#A1#GR#TB#GR#AC#GR#        bottom row; GR at the far right sits at the ring's south-east corner
  11 Db..i.i.ii.iPPii....ii.        b = bulk arm lifting iron off the rear belt; PP = rear substation (power port)
  12 >>>>>>>>>>>uPPU>>>>>>>.        iron entrance and rear iron belt (under the rear substation)
```

`node scripts/essentials-mall/preview.mjs` prints the full map.

## Inputs (west, one labelled entrance each)

| Entrance | Nominal demand at the floors (per minute) | How it enters |
| --- | ---: | --- |
| `iron-plate` (row 12) | 379.1 | Straight into the rear iron belt behind the bottom row, which feeds the three gear machines and the underground-belt, AM1 and transport-belt machines. A bulk arm at (0, 11) lifts iron onto the short belt (0, 10)–(0, 8); one admission arm at (0, 7) puts it on the ring for the drill, yellow-splitter, inserter and fast-inserter machines. |
| `electronic-circuit` (row 1) | 84 | Gated entrance belt, side-loads onto the ring |
| `copper-plate` (row 3) | 12 | Gated entrance belt (cable machine) |
| `steel-plate` (row 4) | 14 | Gated entrance belt |
| `stone-brick` (row 5) | 10 | Gated entrance belt |
| `plastic-bar` (row −2) | 12 | Belt to (0, −2), admitted by one arm onto the north-west corner |

Each entrance has a display panel within four tiles in the west column: `IN: <material>` / `WEST · <rate>/min at nominal target`. No fluids are needed. Electronic circuits are a supplied input: no machine here makes them. `greenCircuitSupply` is 84/min, so **one** `green-circuits` supplier (360/min) covers this mall. When all eight are drawn at once every product runs above its floor, so the mall takes more than the nominal numbers. In the qualification run the entrances took about 195 circuits, 722 iron, 38 steel, 30 copper, 30 plastic and 27 brick per minute.

**Plan supply above the panels if all eight should hold their floors at once.** Exploration measurements (full-length 10/20/5/5/10-minute runs with a throttled-feed copy of the harness made in the final review; its unthrottled control reproduced the published numbers; not part of the qualification):

- Every entrance fed at exactly its panel figure, all eight products drawn: assembling machine 2 made **0/min** (floor 2) and bulk inserters **0.25/min** (floor 1); the other six held their floors.
- Circuits alone limited to 360/min (one green-circuits copy), every other entrance unlimited: all eight above their floors.
- The floors therefore need about the measured draw above (195 circuits, 722 iron, 38 steel, 27 stone brick, 30 plastic, 30 copper per minute), two to three times the panels. With less supply the mall still fills every chest in turn; only the all-eight-at-once floors are lost.

## Outputs (east, one passive provider chest each, one column)

| Product | Floor (`targets`, per minute) | Cap | Measured steady | Measured recovery |
| --- | ---: | ---: | ---: | ---: |
| assembling-machine-2 | 2 | 50 | 5.25 | 5.00 |
| fast-transport-belt | 8 | 200 | 14.85 | 14.90 |
| fast-underground-belt | 1.5 | 50 | 1.90 | 2.00 |
| fast-splitter | 1 | 25 | 2.60 | 2.70 |
| fast-inserter | 6 | 50 | 18.55 | 18.40 |
| bulk-inserter | 1 | 25 | 1.45 | 1.40 |
| electric-furnace | 1 | 25 | 2.70 | 2.70 |
| electric-mining-drill | 3 | 50 | 4.00 | 4.00 |

The rates come from the published report: all eight collected at once, 20 minutes steady after a 10-minute warm-up, and 10 minutes recovery after 5 minutes blocked and 5 minutes settling. Every product passed every phase. The thinnest margins are fast undergrounds (1.90/min steady, floor 1.5) and bulk inserters (1.30/min at worst, during the fast-belt and furnace holds; floor 1).

**Caps** are circuit-set (`stockControl.mode: "chest-condition"`). The constant combinator next to the fast-belt chest holds minus the cap for each product, on a green network with the eight chests and their eight arms. Each chest arm has hand size 1, is filtered to its product, and runs while its product's signal is below zero. To change a cap, edit one number in that combinator.

Fast inserters are also an ingredient of bulk inserters, so they have two deciders on the same green network:

- **Chest arm (reserve decider at (20..21, 7)).** The fast-inserter chest arm runs on `signal-R`, which is 1 only while the chest is below its cap **and** the ring holds more than 14 fast inserters. The chest takes only fast inserters above that ring reserve.
- **Feed arm (feed decider at (15..16, 5)).** The fast-inserter machine's inserter-feed arm runs on `signal-F`, which is 1 while the fast-inserter chest is below its cap **or** the ring holds fewer than 4 fast inserters. While the chest is full the machine does not stop for good: whenever the bulk-inserter machine has drawn the ring below 4, the machine makes more and its output arm (ring limit 18) puts them back on the ring. Bulk inserters therefore keep flowing however long the fast-inserter chest stays full (see "Long holds" below).

## How the control works, in plain words

- **One ring.** A closed red-belt ring, 20 × 7 tiles (50 tiles, capacity 400 items), runs east along the top, south down the east side, west along the bottom and north up the west side. Every ring tile reads its own contents in hold mode, and all tiles share one red wire. The red network therefore always carries the count of every item on the ring.
- **Ring limits.** Everything that puts an item on the ring runs only while that item's ring count is below its limit: the four gated entrance belts, the plastic and iron admission arms, and every machine output arm. Examples are gears 36, circuits 32, fast inserters 18, iron 12, and 2 for each finished product in transit. The limits add up to 180 of 400. In the qualification run the ring peaked at 173. A gated entrance belt can overshoot its limit by one item already past the gate, and an output arm by one hand: steel and brick reached 11 against 10, copper 7 against 6, circuits 33 against 32.
- **Gated entrance belts.** Circuits, copper, steel and brick each enter on one belt tile in the west column that side-loads onto the ring's west column. The belt tile itself carries the condition `item < limit` on the ring network, so it stops and backs up when the ring holds enough. Side-loads land on the ring's outer lane. This replaced a belt-plus-arm admission per material and made the west zone one column wide.
- **Rear iron belt.** Gear machines (180 iron/min each) take iron from a dead-end belt behind the bottom row, not from the ring. The belt passes under the rear substation through one underground pair. The third gear machine sits outside the six slots, at the ring's south-east corner, inside the rectangle.
- **Gear clock.** Three arithmetic combinators in row 5 make a phase signal P (eight windows of 7.5 s, a 60 s cycle) on the ring network. Each gear-hungry final has its own bulk gear arm that runs only in its window: fast belts in windows 0–1, bulk inserters 2, drills 3, AM2 4, fast splitters 5, fast undergrounds 6–7. Each window follows one that sits further downstream on the gear path. Yellow belts, inserters and AM1 take gears freely, because their own ring limits already bound them.
- **Surplus gears to fast belts.** The fast-belt machine is the last gear consumer on the top belt. Its second gear arm runs whenever the ring holds more than 24 gears, so it only takes gears that every windowed consumer let pass.
- **Advanced circuits.** Two machines (15/min). The furnace's advanced-circuit arm runs only while at least two are on the ring, so the bulk-inserter machine is never starved.
- **Fast inserters** stop filling their chest at 50, and their machine keeps a small ring stock for the bulk-inserter machine through the feed decider (see Caps above). In the standard 10-minute hold the fast-inserter machine made 4 crafts in the last 5 minutes against 7 bulk-inserter crafts.
- **Fast belts** go from their machine to their chest through one long-handed arm, never touching the ring.

Preserve the red ring wires, all arm filters, the conditions on the four entrance belts, the three clock combinators, both deciders and the constant combinator. Also preserve the green cap wires: they run through the unconditioned ingredient arms of the top row and of the bottom advanced-circuit machine, which act only as relays.

## Native qualification (exact protocol run)

Harness: `scripts/essentials-mall/validate.mjs` and `control.lua`. Private headless game with its own `--config` and `--mod-directory` under `.cache/essentials-mall/`, mods `base`, `elevated-rails`, `quality`, `recycler`, `space-age` and the test mod.

The harness imports the string, revives every ghost, and checks geometry, directions, recipes and ingredient amounts, no modules, three clear tiles outside every port, and one power network powering every machine, arm and combinator. It also checks the per-tile hold readers on one ring network, the controlled arms, gated belts and clock arms on the ring network, the cap network isolated from the ring, and the wiring of both deciders and the gated feed arm (input red on the ring, input and output green on the cap network, feed arm reading `signal-F`). It feeds only the six entrance belts (both lanes, one item per lane every 4 ticks), plus electricity at the power port. It seeds nothing and collects only the eight products from their chests once per second.

Phases: 10 min warm-up, 20 min steady, 5 min blocked (no collection), 5 min settle, 10 min recovery. Then one cap phase per product: stop collecting it; it must reach exactly its cap within the fill limit; a 10-minute hold where the chest equals the cap at every sample, its ring count stays within its limit, its final machine crafts nothing in the last 5 minutes (fast inserters: no more than bulk-inserter crafts), and the other seven stay at or above their floors; then remove half once, and it must refill to exactly its cap within the refill limit with at least one new craft.

| Product | Fill (limit) min | Refill (limit) min | Final-machine crafts, last 5 hold min | Other product closest to its floor during the hold |
| --- | --- | --- | ---: | --- |
| assembling-machine-2 | 9.9 (50) | 3.8 (25) | 0 | drill 4.00 |
| fast-transport-belt | 13.4 (50) | 6.2 (25) | 0 | bulk inserter 1.30 |
| fast-underground-belt | 24.7 (67) | 10.9 (34) | 0 | drill 4.00 |
| fast-splitter | 9.9 (50) | 3.1 (25) | 0 | drill 4.00 |
| fast-inserter | 2.6 (17) | 1.9 (9) | 4 (bulk made 7) | fast underground 2.00 |
| bulk-inserter | 17.0 (50) | 5.9 (25) | 0 | fast underground 2.00 |
| electric-furnace | 8.9 (50) | 3.0 (25) | 0 | bulk inserter 1.30 |
| electric-mining-drill | 12.4 (34) | 5.1 (17) | 0 | fast underground 2.00 |

Every other product stayed at 130% of its floor or more in every hold. In the blocked phase no chest passed its cap; the fast-inserter chest reached exactly 50. The ring peaked at 173 of 400 and never reached 90%. Bulk-inserter hands never held more than 2. All 19 machines crafted during the steady window.

## Long holds (exploration evidence for the fast-inserter feed gate)

The protocol's 10-minute hold is too short to show whether bulk inserters keep flowing while the fast-inserter chest stays full. So the fast-inserter cap phase was also run with a 40-minute hold (`ESSENTIALS_EXPLORE=1 ESSENTIALS_CAP=fast-inserter ESSENTIALS_HOLD=40`, same 10/20/5/5/10 phases before it). These are exploration runs (`short: true`), not the qualification.

| String | Bulk inserters per minute over the 40-minute hold | Fast-inserter chest at exactly 50 | Crafts in the last 20 hold minutes, fast-inserter / bulk-inserter | Report |
| --- | ---: | --- | --- | --- |
| published, `one-column-west` (391 tiles) | **1.475** | all 2400 samples | 30 / 29 | `long-hold/one-column-west-fast-inserter-hold-40min.json` |
| `narrow-west-feed` (408 tiles, history) | **1.375** | all 2400 samples | 28 / 28 | `long-hold/narrow-west-feed-fast-inserter-hold-40min.json` |

Bulk inserters stayed above their floor of 1 per minute over the whole hold, and every other product stayed above its floor (closest: fast undergrounds 2.00 against 1.5). Before the fix the review measured 0.95 bulk inserters per minute over a 20-minute hold and 0.475 over 40, with none at all in the second half.

The 40-minute run of the published string reports `passed: false` for one reason only: in its last 20 minutes the fast-inserter machine made 30 crafts and the bulk-inserter machine 29. That is the window-edge effect the review described: with the feed gate the two machines run one-for-one with a short lag, so a window can catch one extra fast-inserter craft. The chest stayed at exactly 50 throughout, so none of those crafts was overproduction. The standard 10-minute hold passes with room (4 against 7), because the ring stock runs down for most of it.

## Reproduce

```sh
export FACTORIO_RAW=/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json
node scripts/essentials-mall/generate.mjs              # writes essentials-mall.txt and manifest.json (variant one-column-west)
node scripts/essentials-mall/validate.mjs              # full protocol, writes native-report.json (about 35 s wall time)
node --test tests/essentials-mall.test.mjs
node scripts/essentials-mall/preview.mjs               # ASCII map
# long hold, exploration only (writes .cache/essentials-mall/explore-report.json and <run folder>/report.json):
ESSENTIALS_EXPLORE=1 ESSENTIALS_CAP=fast-inserter ESSENTIALS_HOLD=40 node scripts/essentials-mall/validate.mjs
```

The generator is pure Node and reproducible: the same variant always gives the same string. Every candidate tried is a named variant in `scripts/essentials-mall/variants.mjs`. Exploration runs (`ESSENTIALS_EXPLORE=1`, optional `ESSENTIALS_PHASES=5,10,0,0,0`, `ESSENTIALS_CAP=none|all|item,...`, `ESSENTIALS_HOLD=<minutes>`, `ESSENTIALS_SOURCE=<candidate dir>`) never touch the published report. A full-protocol run refuses any other phase lengths and ignores `ESSENTIALS_HOLD`.

## Deviations from the spec, and what was tried

- **19 machines instead of 17.** The spec's reference (2 gear machines, 1 advanced-circuit machine, four 10 s gear windows) produced 0.4 fast belts/min and 0.3 bulk inserters/min in its first native screen. Two gear machines leave about 20% slack over the eight floors, and windows shared between several greedy products could not divide it fairly. One advanced-circuit machine (7.5/min) leaves furnaces and bulk inserters within about 20% of their floors. The third gear machine uses the ring's south-east corner, inside the rectangle, and the second advanced-circuit machine takes the bottom slot that frees up. The review's own screen with the corner gear machine removed gave fast belts 5.15 per minute (floor 8).
- **Eight gear windows instead of four**, with one gear-hungry final per window, plus a surplus-only gear arm on the fast-belt machine.
- **Two fast-inserter deciders.** The chest arm takes only fast inserters above a ring reserve of 14; the feed arm runs while the chest is below its cap or the ring holds fewer than 4.
- **Row assignment.** The top row has fast splitter, fast underground, AM2, drill, bulk inserter, fast belt. The inside row has yellow splitter, advanced circuit, cable, inserter, fast inserter, furnace. The bottom row has underground belt, AM1, gear, transport belt, gear, advanced circuit, and the corner gear machine. Ring limits for gears, steel, brick and iron are lower than the spec's table (36/10/10/12) to keep the ring's inner lane open.
- **Gated entrance belts instead of admission arms** for circuits, copper, steel and brick (see Review notes).

Candidates kept under `history/`, each with `NOTE.md`:

- `reference-layout`: the spec reference. Its short screen failed fast belts and bulk inserters.
- `top-drill`: 18 machines. Its full exploration run failed only the fast-inserter hold check (10 vs 9).
- `corner-gear-425`: 25 × 17, **qualified** with its own full report. Replaced by smaller layouts.
- `narrow-west-feed-408`: 24 × 17, the review's feed fix applied to the earlier published `narrow-west-outer`; **qualified** with its own full report. Replaced by this one.
- `no-rear-345`: 23 × 15, the review's second size idea (no rear iron band, 18 machines). Its full protocol failed one check (AM2 1.90 against 2 during the furnace hold). See Review notes.

The earlier published `narrow-west-outer` (commit 7f363c43e, 24 × 17) is not kept: it had the bulk-inserter stall the review found. Other variants screened and rejected are in `variants.mjs`:

- `narrow-west` and `narrow-west-splitter`: the single circuit arm could not drop into the full inner lane.
- Nine-window clocks: bulk inserters fell below 1.
- Bulk inserters sharing the fast-belt windows: they took every gear.
- A ring gear limit of 48 in the narrow layout: AM2 was starved of circuits.

## Review notes

The review (verdict "fix") asked for four things. All four are applied:

1. **Bulk-inserter stall while the fast-inserter chest is full.** Fixed with the feed decider described above, generated by `generate.mjs` (`feedGate` in `variants.mjs`), recorded in `manifest.stockControl.feedGate`, checked in `control.lua`, and named in the blueprint description's preserve list. The fast-inserter hold check is no longer met by stopping the fast-inserter machine outright.
2. **Long-hold evidence.** `validate.mjs` takes `ESSENTIALS_HOLD` in exploration mode only; see "Long holds".
3. **Published text.** `setupNotes[1]` is now generated from the layout and names the machines the rear belt and the ring actually feed; the caps section and the fast-inserter bullet describe the corrected gate.
4. **Unit tests.** `tests/essentials-mall.test.mjs` pins the machine counts (3 gear, 2 advanced circuit, 1 of each other recipe, 19 in all), asserts both terms of the feed decider, its wiring and the feed arm's `signal-F` condition, and asserts a whitelist filter on every arm.

Size: the review's first idea (one-column west zone, 23 × 17 = 391) is the published layout. It is generator output, not the review's post-processed string, so its entity numbers and SHA-256 differ (`d894c04a…` here, `d5ab6c77…` in the review); the measured rates came out the same.

Points to settle in later rounds:

- **"Admission arms."** The contract speaks of admission arms. The four gated entrance belts carry the same rule (`item < limit` on the ring network, listed in `loopControl.controlled`), so I read them as meeting it, as the review did. The unit test checks each gated belt is the declared entrance for its item and side-loads onto the ring.
- **Fast-inserter hold check.** In a long hold it can miss by one craft at a window edge (30 against 29 above). The standard 10-minute hold passes with room. The review suggested allowing the consumer's crafts plus 2 in later contracts; this round keeps the check as written.
- **Size idea 2, no rear iron band (23 × 15 = 345): tried, not qualified.** Ten candidates screened, all generator output (the five main layouts are `no-rear*` variants in `variants.mjs`, the others limit and arm tweaks of them; generator options `noRear` and `cornerFeed`). Iron enters on a gated belt that side-loads onto the ring's outer lane, circuits enter on the inner lane through one bulk arm at the corner, the three gear machines take the first top-row slots, and the second advanced-circuit machine is dropped (the corner slot has no room for arms without the rear band). The closest, `history/no-rear-345`, failed the full protocol on one check: AM2 1.90 per minute during the furnace hold. The binding limit is iron intake: one side-loaded entrance delivers about 530 iron per minute against 722 in the published layout, and each fix screened with the full protocol moved the shortfall to another product (fast inserters 5.90 in recovery; fast undergrounds 1.00 steady). Getting there would need a second iron path onto the ring's inner lane, which one west column and one entrance per material do not leave room for. With idea 2 giving nothing and no further idea in the review, the size work stops at 391 tiles.
