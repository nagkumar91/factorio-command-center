# Essentials mall · eight building products on demand

Status: **qualified**. `native-report.json` says `passed: true` for the exact string in `essentials-mall.txt`, from a full-protocol native run (Factorio 2.1.24 Space Age, vanilla, normal quality).

## Versions

Two tested versions are published, and the website lets you pick either (library version picker and the guide page). `manifest.json` lists them in its `versions` field, newest first, with each one's size, machines and measured rates from its own native report; `scripts/essentials-mall/generate.mjs` writes that field from `VERSIONS` in `variants.mjs`.

| Version | String | Size | Machines | Fast belts / min (steady, recovery) | Fast inserters | Furnaces | AM2 | Fast undergrounds | Bulk inserters | Drills | Fast splitters |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sixteen rows (recommended, current) | `essentials-mall.txt`, da037182… | 23 × 16 = 368 | 19 | 13.55, 13.2 | 18.1, 18.1 | 2.65, 2.6 | 5.75, 5.5 | 2.0, 2.2 | 1.65, 1.7 | 4.35, 4.4 | 2.6, 2.7 |
| One column west (earlier) | `history/one-column-west-d894c04a/`, d894c04a… | 23 × 17 = 391 | 19 | 14.85, 14.9 | 18.55, 18.4 | 2.7, 2.7 | 5.25, 5.0 | 1.9, 2.0 | 1.45, 1.4 | 4.0, 4.0 | 2.6, 2.7 |

The smaller one makes slightly fewer fast belts, fast inserters and furnaces. Under the round's rule ("same rates or better") it was held back; on 21 November the user chose to release it as the current version and keep the faster one selectable.

One on-demand mall that makes all eight at once and stops each product by itself at its own stock cap: assembling machine 2, fast transport belt, fast underground belt, fast splitter, fast inserter, bulk inserter, electric furnace and electric mining drill.

- Footprint **23 × 16 = 368 tiles** (variant `sixteen-rows`). The goal was 442 and the stretch 400; both are met. The layout it replaces was 23 × 17 = 391.
- **19 assembling machine 2**, no modules, no beacons: 3 iron gear, 2 advanced circuit, and 1 each of copper cable, transport belt, underground belt, splitter, inserter, assembling machine 1 and the eight finals.
- 2 substations and 4 medium poles, all inside the rectangle. Electricity enters at the substation in the rear iron band, tiles (12..13, 10..11) (the `power` port).
- Red belts and one red underground pair; no splitter. Fast, long-handed and bulk inserters at the unlock baseline (bulk hand 2). 185 entities.

```
     10123456789012345678901        x (west → east), y down
  -4 ..##################==.        == clock timer
  -3 ..FS#FU#A2#AC#BI#FB#lKC        top row: finals and the second advanced-circuit machine; l = long arm to the fast-belt chest, K = cap combinator
  -2 >>##################=PP        plastic entrance; = clock divider (upright); PP = east substation
  -1 Dibiibiibiiiiibiibib=PP        top arm row; D = entrance labels
   0 D>>>>>>>>>>>>>>>>>>>viC        ring top (east-bound); C = output chests
   1 >^iipii.iipiiiiiiiiiviC        circuit entrance; the one arm row inside the ring; p = medium poles
   2 >^##################viC        copper entrance
   3 >^SP#CB#AC#FI#IN#EF#viC        steel entrance; inside row, against the ring's bottom belt
   4 >^##################viC        brick entrance
   5 D^<<<<<<<<<<<<<<<<<<<iC        ring bottom (west-bound)
   6 Diii.iiipi.ii==i==i.i==        bottom arm row; feed decider (12..13), clock phase (15..16), reserve decider (20..21)
   7 D^#####################
   8 p^UB#A1#GR#TB#GR#GR#DR#        bottom row; DR = the drill in the rear corner
   9 .^#####################
  10 Db.i..i.ii.i.PPiib.ii.i        rear arm row; b at x 0 lifts iron for the ring; PP = rear substation (power port)
  11 >>>>>>>>>>>>uPPU>>.>>.C        iron entrance and rear iron belt; two-tile gear belt at x 18..19; drill chest
```

`node scripts/essentials-mall/preview.mjs` prints this map from the string.

## Inputs (west, one labelled entrance each)

| Entrance | Nominal demand at the floors (per minute) | How it enters |
| --- | ---: | --- |
| `plastic-bar` (row −2) | 12 | Belt to (0, −2), admitted by one arm onto the north-west corner |
| `electronic-circuit` (row 1) | 84 | Gated entrance belt, side-loads onto the ring |
| `copper-plate` (row 2) | 12 | Gated entrance belt (cable machine) |
| `steel-plate` (row 3) | 14 | Gated entrance belt |
| `stone-brick` (row 4) | 10 | Gated entrance belt |
| `iron-plate` (row 11) | 379.1 | Straight into the rear iron belt behind the bottom row, which feeds the three gear machines and the underground-belt, AM1 and transport-belt machines. A bulk arm at (0, 10) lifts iron onto the short belt (0, 9)–(0, 7); one admission arm at (0, 6) puts it on the ring for the yellow-splitter, fast-inserter, inserter and drill machines. |

The entrances are on the same side and in the same order, north to south, as in the layout this one replaces (plastic, circuits, copper, steel, brick, iron); the four gated rows are now adjacent, and iron is one row higher. Each entrance has a display panel within four tiles in the west column: `IN: <material>` / `WEST · <rate>/min at nominal target`. No fluids are needed. Electronic circuits are a supplied input: no machine here makes them. `greenCircuitSupply` is 84/min, so **one** `green-circuits` supplier (360/min) covers this mall.

The panels are recipe totals at the floors. When all eight are drawn at once every product runs above its floor, so the mall takes more: in the qualification run the entrances took about 201 circuits, 732 iron, 38 steel, 30 copper, 30 plastic and 26 brick per minute.

**Plan supply at 1.7 times the panels or more if all eight should hold their floors at once.** Exploration measurements with the harness's supply cap (`ESSENTIALS_SUPPLY`, every entrance capped at the same multiple of its panel figure, the whole protocol with all eight cap phases; these are exploration runs, not the qualification):

| Supply at every entrance | Result for this string | Report |
| --- | --- | --- |
| 2, 1.9, 1.8, 1.75 and 1.7 times the panels | whole protocol **passed** (thinnest: AM2 2.10 against 2 at 1.75 and 1.8 times) | `supply/sixteen-rows-1.7-times-panels.json` (the other four were run and not kept) |
| 1.6 times | failed three checks: fast inserters 5.90 in recovery and 5.80 during the fast-belt hold (floor 6); one bulk-inserter craft in the last 5 minutes of its own hold | `supply/sixteen-rows-1.6-times-panels.json` |
| 1.5 times (steady and recovery only) | fast inserters 5.05 steady, bulk inserters 0.90 in recovery; the rest held | not kept |
| exactly the panels (steady and recovery only) | drill **0**, fast inserters 2.30, furnaces 0.80, bulk inserters 0.95, fast belts 7.95 (floor 8); AM2 3.10, fast undergrounds 1.90 and fast splitters 1.95 held | `supply/sixteen-rows-panel-figures.json` |
| exactly the panels, nothing collected for 240 minutes | all eight chests reached exactly their caps | `supply/sixteen-rows-panel-figures-nothing-collected.json` |

The layout this one replaces passed the whole protocol at 2 times the panels and failed at 1.9 times (AM2 1.10 steady; `history/one-column-west-d894c04a/supply/`). With less supply than 1.7 times the mall still fills every chest in turn; only the all-eight-at-once floors are lost. Circuits alone limited to 360/min (one green-circuits copy) with every other entrance unlimited kept all eight above their floors.

## Outputs (east, one passive provider chest each, one column)

North to south, the same order as before: fast belts (row −3), AM2, fast undergrounds, fast splitters, fast inserters, bulk inserters, furnaces (rows 0 to 5), drills (row 11).

| Product | Floor (`targets`, per minute) | Cap | Measured steady | Measured recovery | Replaced layout, steady / recovery |
| --- | ---: | ---: | ---: | ---: | ---: |
| assembling-machine-2 | 2 | 50 | 5.75 | 5.50 | 5.25 / 5.00 |
| fast-transport-belt | 8 | 200 | 13.55 | 13.20 | 14.85 / 14.90 |
| fast-underground-belt | 1.5 | 50 | 2.00 | 2.20 | 1.90 / 2.00 |
| fast-splitter | 1 | 25 | 2.60 | 2.70 | 2.60 / 2.70 |
| fast-inserter | 6 | 50 | 18.10 | 18.10 | 18.55 / 18.40 |
| bulk-inserter | 1 | 25 | 1.65 | 1.70 | 1.45 / 1.40 |
| electric-furnace | 1 | 25 | 2.65 | 2.60 | 2.70 / 2.70 |
| electric-mining-drill | 3 | 50 | 4.35 | 4.40 | 4.00 / 4.00 |

The rates come from the published report: all eight collected at once, 20 minutes steady after a 10-minute warm-up, and 10 minutes recovery after 5 minutes blocked and 5 minutes settling. Every product passed every phase. The three gear machines run without pause (1800 crafts each in the 20 minutes), so gears are shared out, not spare: against the replaced layout the four thinnest products gained (bulk inserters, drills, fast undergrounds, AM2) and three gave some back, all still far above their floors: fast belts 13.55 against 14.85 (floor 8), fast inserters 18.10 against 18.55 (floor 6) and furnaces 2.65 against 2.70 (floor 1). The thinnest margin anywhere in the protocol is fast undergrounds at 2.00 per minute against a floor of 1.5 (133%); it was 1.90 (127%) before.

**Caps** are circuit-set (`stockControl.mode: "chest-condition"`). The constant combinator next to the fast-belt chest holds minus the cap for each product, on a green network with the eight chests and their eight arms. Each chest arm has hand size 1, is filtered to its product, and runs while its product's signal is below zero. To change a cap, edit one number in that combinator.

Fast inserters are also an ingredient of bulk inserters, so they have two deciders on the same green network:

- **Chest arm (reserve decider at (20..21, 6)).** The fast-inserter chest arm runs on `signal-R`, which is 1 only while the chest is below its cap **and** the ring holds more than 14 fast inserters. The chest takes only fast inserters above that ring reserve.
- **Feed arm (feed decider at (12..13, 6)).** The fast-inserter machine's inserter-feed arm runs on `signal-F`, which is 1 while the fast-inserter chest is below its cap **or** the ring holds fewer than 4 fast inserters. While the chest is full the machine does not stop for good: whenever the bulk-inserter machine has drawn the ring below 4, the machine makes more and its output arm (ring limit 18) puts them back on the ring. Bulk inserters therefore keep flowing however long the fast-inserter chest stays full (see "Long holds" below).

## How the control works, in plain words

- **One ring.** A closed red-belt ring, 20 × 6 tiles (48 tiles, capacity 384 items), runs east along the top, south down the east side, west along the bottom and north up the west side. Every ring tile reads its own contents in hold mode, and all tiles share one red wire. The red network therefore always carries the count of every item on the ring.
- **One arm row inside the ring.** The six inside machines sit against the ring's bottom belt; all their arms are in the row under the top belt, and both take from and deliver to the top belt (outer lane). That is the row this layout saves. The inserter machine sits downstream of the fast-inserter machine, so inserters travel one lap to reach it, which keeps fast inserters near their earlier rate.
- **Ring limits.** Everything that puts an item on the ring runs only while that item's ring count is below its limit: the four gated entrance belts, the plastic and iron admission arms, and every machine output arm. Examples are gears 36, circuits 32, iron 20, fast inserters 18, and 2 for each finished product in transit. The limits add up to 186 of 384. In the qualification run the ring peaked at 177. A gated entrance belt can overshoot its limit by one item already past the gate, and an output arm by one hand: steel and brick reached 11 against 10, copper 7 against 6, circuits 33 against 32, gears 38 against 36, advanced circuits 7 against 6.
- **Gated entrance belts.** Circuits, copper, steel and brick each enter on one belt tile in the west column that side-loads onto the ring's west column. The belt tile itself carries the condition `item < limit` on the ring network, so it stops and backs up when the ring holds enough.
- **Rear iron belt.** Gear machines (180 iron/min each) take iron from a dead-end belt behind the bottom row, not from the ring. The belt passes under the rear substation through one underground pair and ends at the last gear machine.
- **Six ring-fed chests, two direct ones.** The six ring tiles of the east column feed six chests. Fast belts go from their machine to their chest through one long-handed arm; drills go from the drill machine in the rear corner straight down into the drill chest at the foot of the chest column. Neither rides the ring.
- **Drill gear hand-off.** Hardly any gear reaches the ring's south-east corner, because every top-row final takes them first. The last gear machine therefore also drops gears on a two-tile belt behind it (tiles (18..19, 11), apart from the iron belt), and the drill's rear arm takes them from there. That arm is the drill's stock gate: it stops while the drill chest is full, so the drill machine stops after the gears it holds. The hand-off arm has no condition; the belt's few slots bound it. The drill takes circuits and iron from the ring through one arm on the south-east corner.
- **Gear clock.** Three arithmetic combinators make a phase signal P (seven windows of 7.5 s, a 52.5 s cycle) on the ring network. Each gear-hungry top-row final has its own bulk gear arm that runs only in its window: fast belts in windows 0–1, bulk inserters 2, AM2 3, fast splitters 4, fast undergrounds 5–6. Every window has an owner, and each follows one that sits further downstream on the gear path. Yellow belts, inserters and AM1 take gears freely, because their own ring limits already bound them.
- **Surplus gears to fast belts.** The fast-belt machine is the last gear consumer on the top belt. Its second gear arm runs whenever the ring holds more than 16 gears, so it only takes gears that every windowed consumer let pass.
- **Circuit reserve for short supply.** The circuit-and-iron arms of the inserter and fast-inserter machines run only while the ring holds more than 10 circuits. With full supply the ring always holds about 32, and the arms never pause: steady and recovery rates are the same with and without the condition. With short supply these two machines (fast inserters run at three times their floor) give way to the drill and the AM1 machine at the end of the circuit route. This is what lets the mall hold all eight floors from 1.7 times the panels.
- **Advanced circuits.** Two machines (15/min), one in the inside row and one in the top row. The furnace's advanced-circuit arm runs only while at least two are on the ring, so the bulk-inserter machine is never starved.
- **Fast inserters** stop filling their chest at 50, and their machine keeps a small ring stock for the bulk-inserter machine through the feed decider (see Caps above). In the standard 10-minute hold the fast-inserter machine made 7 crafts in the last 5 minutes against 9 bulk-inserter crafts.

Preserve the red ring wires, all arm filters and conditions, the conditions on the four entrance belts, the three clock combinators, both deciders, the constant combinator and the two-tile gear belt behind the drill. Also preserve the green cap wires: one runs through the furnace's steel-and-brick arm, which acts only as a relay to the fast-inserter feed arm.

## Native qualification (exact protocol run)

Harness: `scripts/essentials-mall/validate.mjs` and `control.lua`. Private headless game with its own `--config` and `--mod-directory` under `.cache/essentials-mall/`, mods `base`, `elevated-rails`, `quality`, `recycler`, `space-age` and the test mod.

The harness imports the string, revives every ghost, and checks geometry, directions, recipes and ingredient amounts, no modules, three clear tiles outside every port, and one power network powering every machine, arm and combinator. It also checks the per-tile hold readers on one ring network, the controlled arms, gated belts and clock arms on the ring network, the cap network isolated from the ring, and the wiring of both deciders and the gated feed arm (input red on the ring, input and output green on the cap network, feed arm reading `signal-F`). It feeds only the six entrance belts (both lanes, one item per lane every 4 ticks), plus electricity at the power port. It seeds nothing and collects only the eight products from their chests once per second.

Phases: 10 min warm-up, 20 min steady, 5 min blocked (no collection), 5 min settle, 10 min recovery. Then one cap phase per product: stop collecting it; it must reach exactly its cap within the fill limit; a 10-minute hold where the chest equals the cap at every sample, its ring count stays within its limit, its final machine crafts nothing in the last 5 minutes (fast inserters: no more than bulk-inserter crafts), and the other seven stay at or above their floors; then remove half once, and it must refill to exactly its cap within the refill limit with at least one new craft. The protocol, floors, caps and limits are the ones that qualified the replaced layout; nothing was weakened.

| Product | Fill (limit) min | Refill (limit) min | Final-machine crafts, last 5 hold min | Other product closest to its floor during the hold |
| --- | --- | --- | ---: | --- |
| assembling-machine-2 | 8.4 (50) | 3.9 (25) | 0 | bulk inserter 1.60 |
| fast-transport-belt | 14.3 (50) | 7.0 (25) | 0 | drill 5.00 |
| fast-underground-belt | 25.4 (67) | 9.3 (34) | 0 | drill 4.90 |
| fast-splitter | 9.1 (50) | 3.1 (25) | 0 | drill 4.70 |
| fast-inserter | 2.7 (17) | 1.9 (9) | 7 (bulk made 9) | fast underground 2.00 |
| bulk-inserter | 15.2 (50) | 4.0 (25) | 0 | fast underground 2.00 |
| electric-furnace | 9.2 (50) | 2.8 (25) | 0 | fast underground 2.00 |
| electric-mining-drill | 10.5 (34) | 4.5 (17) | 0 | fast underground 2.20 |

Every other product stayed at 133% of its floor or more in every hold. In the blocked phase no chest passed its cap; the fast-inserter chest reached exactly 50. The ring peaked at 177 of 384 and never reached 90%. Bulk-inserter hands never held more than 2. All 19 machines crafted during the steady window.

## Long holds and long blocks (exploration evidence)

The protocol's 10-minute hold is too short to show whether bulk inserters keep flowing while the fast-inserter chest stays full. So the fast-inserter cap phase was also run with a 40-minute hold (`ESSENTIALS_EXPLORE=1 ESSENTIALS_CAP=fast-inserter ESSENTIALS_HOLD=40`, same 10/20/5/5/10 phases before it). These are exploration runs (`short: true`), not the qualification.

| String | Bulk inserters per minute over the 40-minute hold | Fast-inserter chest at exactly 50 | Crafts in the last 20 hold minutes, fast-inserter / bulk-inserter | Report |
| --- | ---: | --- | --- | --- |
| published, `sixteen-rows` (368 tiles) | **1.70** | all 2400 samples | 35 / 34 | `long-hold/sixteen-rows-fast-inserter-hold-40min.json` |
| `one-column-west` (391 tiles, history) | 1.475 | all 2400 samples | 30 / 29 | `long-hold/one-column-west-fast-inserter-hold-40min.json` |
| `narrow-west-feed` (408 tiles, history) | 1.375 | all 2400 samples | 28 / 28 | `long-hold/narrow-west-feed-fast-inserter-hold-40min.json` |

Bulk inserters stayed above their floor of 1 per minute over the whole hold, and every other product stayed above its floor (closest: fast undergrounds 1.90 against 1.5).

The 40-minute run of the published string reports `passed: false` for one reason only: in its last 20 minutes the fast-inserter machine made 35 crafts and the bulk-inserter machine 34. That is the same window-edge effect as in the replaced layout (30 against 29): with the feed gate the two machines run one-for-one with a short lag, so a window can catch one extra fast-inserter craft. The chest stayed at exactly 50 throughout, so none of those crafts was overproduction. The standard 10-minute hold passes (7 against 9).

A 60-minute blocked phase (`ESSENTIALS_PHASES=10,20,60,5,10`, nothing collected) was also run on the published string: all eight chests ended at exactly their caps, none ever passed its cap, the ring peaked at 177, and all eight were above their floors in the recovery window after it. The report was not kept; the command reproduces it.

## Reproduce

```sh
export FACTORIO_RAW=/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json
node scripts/essentials-mall/generate.mjs              # writes essentials-mall.txt and manifest.json (variant sixteen-rows)
node scripts/essentials-mall/validate.mjs              # full protocol, writes native-report.json (about 50 s wall time)
node --test tests/essentials-mall.test.mjs
node scripts/essentials-mall/preview.mjs               # ASCII map
# exploration only (each writes .cache/essentials-mall/explore-report.json and <run folder>/report.json):
ESSENTIALS_EXPLORE=1 ESSENTIALS_CAP=fast-inserter ESSENTIALS_HOLD=40 node scripts/essentials-mall/validate.mjs
ESSENTIALS_EXPLORE=1 ESSENTIALS_CAP=all ESSENTIALS_SUPPLY='{"iron-plate":644.5,"electronic-circuit":142.8,"steel-plate":23.8,"copper-plate":20.4,"plastic-bar":20.4,"stone-brick":17}' node scripts/essentials-mall/validate.mjs
ESSENTIALS_EXPLORE=1 ESSENTIALS_CAP=none ESSENTIALS_PHASES=10,20,60,5,10 node scripts/essentials-mall/validate.mjs
```

The generator is pure Node and reproducible: the same variant always gives the same string. Every candidate tried is a named variant in `scripts/essentials-mall/variants.mjs`. Exploration runs (`ESSENTIALS_EXPLORE=1`, optional `ESSENTIALS_PHASES=5,10,0,0,0`, `ESSENTIALS_CAP=none|all|item,...`, `ESSENTIALS_HOLD=<minutes>`, `ESSENTIALS_SUPPLY=<items per minute per entrance>`, `ESSENTIALS_SOURCE=<candidate dir>`) never touch the published report. A full-protocol run refuses any other phase lengths and ignores `ESSENTIALS_HOLD` and `ESSENTIALS_SUPPLY`.

## Deviations from the spec, and what was tried

- **19 machines instead of 17.** The spec's reference (2 gear machines, 1 advanced-circuit machine, four 10 s gear windows) produced 0.4 fast belts/min and 0.3 bulk inserters/min in its first native screen. Two gear machines leave about 20% slack over the eight floors, and windows shared between several greedy products could not divide it fairly. One advanced-circuit machine (7.5/min) leaves furnaces and bulk inserters within about 20% of their floors. In this layout all three gear machines and both advanced-circuit machines run without pause in the steady window.
- **Seven gear windows instead of four**, one gear-hungry top-row final per window (fast belts and fast undergrounds two each), plus a surplus-only gear arm on the fast-belt machine and the drill's own hand-off.
- **Two fast-inserter deciders.** The chest arm takes only fast inserters above a ring reserve of 14; the feed arm runs while the chest is below its cap or the ring holds fewer than 4.
- **Row assignment.** The top row has fast splitter, fast underground, AM2, advanced circuit, bulk inserter, fast belt. The inside row has yellow splitter, cable, advanced circuit, fast inserter, inserter, furnace. The bottom row has underground belt, AM1, gear, transport belt, gear, gear, and the drill in the rear corner. Ring limits for gears, steel and brick are lower than the spec's table (36/10/10) to keep the ring's inner lane open; iron is 20 because the drill is the last iron user on the ring.
- **Gated entrance belts instead of admission arms** for circuits, copper, steel and brick (see Review notes).

Candidates kept under `history/`, each with `NOTE.md`:

- `reference-layout`: the spec reference. Its short screen failed fast belts and bulk inserters.
- `top-drill`: 18 machines. Its full exploration run failed only the fast-inserter hold check (10 vs 9).
- `corner-gear-425`: 25 × 17, **qualified** with its own full report. Replaced by smaller layouts.
- `narrow-west-feed-408`: 24 × 17, the review's feed fix applied to the earlier published `narrow-west-outer`; **qualified** with its own full report.
- `one-column-west-d894c04a`: 23 × 17 = 391, **qualified** with its own full report; the published layout until the design review of 11-21. Still published as the earlier, selectable version (see Versions above).
- `no-rear-345`: 23 × 15, the first review's second size idea (no rear iron band, 18 machines). Its full protocol failed one check (AM2 1.90 against 2 during the furnace hold).

The earlier published `narrow-west-outer` (commit 7f363c43e, 24 × 17) is not kept: it had the bulk-inserter stall the first review found. Other variants screened and rejected are in `variants.mjs`:

- `narrow-west` and `narrow-west-splitter`: the single circuit arm could not drop into the full inner lane.
- Nine-window clocks: bulk inserters fell below 1.
- Bulk inserters sharing the fast-belt windows: they took every gear.
- A ring gear limit of 48 in the narrow layout: AM2 was starved of circuits.

## Review notes

### Design review of 11-21 (this layout)

The review re-ran the published 23 × 17 layout first: the generator reproduced its string, and a fresh full-protocol run reproduced its report number for number. Its findings and what was done:

1. **One row of the 17 was not needed.** The inside row had two arm rows, but no inside machine needs more than three arms, so one arm row holds them all. Without the second row the ring is six rows tall and its east column has six tiles for seven ring-fed chests. The drill therefore moved to the rear corner slot with its chest directly below it, at the foot of the same chest column; the third gear machine took the last bottom slot and the second advanced-circuit machine the drill's old top slot. Result: 23 × 16 = 368 tiles, 5.9% fewer, same 19 machines.
2. **The drill starved in the corner at first** (0.4 to 2.9 per minute against 3 across twelve steady screens): gears that reach the south-east corner have passed every top-row final. Clocked or reserve-gated corner arms did not help; a gear arm dropping onto the iron belt deadlocked on a full belt (0 drills). The hand-off over its own two-tile belt fixed it. With the drill off the clock, eight windows left one window without an owner; seven owned windows gave the thin products more.
3. **Short supply.** The first sixteen-row candidate needed more supply than the replaced layout (at 2 times the panels AM2 made 1.85 against 2). The circuit reserve on the two inserter machines fixed that without changing full-supply behaviour. Reserves of 8, 10, 12, 14, 16 and 24 were screened; 10 passed the whole protocol from 1.7 times the panels (table above). Priority tiers for more arms (fast splitter, AM2) only moved the shortfall to another product at 1.5 and 1.25 times, so the mall still does not hold all eight floors at the panel figures themselves.
4. **Measured rates moved, in both directions** (table under Outputs). The gear machines are the limit in both layouts, so no layout with three of them can raise all eight at once. Eight-window candidates kept fast belts near 16 per minute but left AM2 at 4.6 to 4.9 (5.25 before) and fast splitters at 2.3 to 2.5 (2.60 before); the seven-window clock was chosen because its thinnest margin is the widest (133% of a floor against 127% before).
5. **Harness.** `control.lua` and `validate.mjs` gained the exploration-only supply cap (`ESSENTIALS_SUPPLY`); a qualification run never sets it and feeds full belts as before. `preview.mjs` draws upright combinators.

Not done: no layout with fewer than 19 machines was tried again (two earlier 18-machine candidates failed), and 23 × 15 without the rear iron band stays unqualified (`no-rear-345`).

### First review (11-20)

The first review (verdict "fix") asked for four things. All four are applied and carried into this layout:

1. **Bulk-inserter stall while the fast-inserter chest is full.** Fixed with the feed decider described above, generated by `generate.mjs` (`feedGate` in `variants.mjs`), recorded in `manifest.stockControl.feedGate`, checked in `control.lua`, and named in the blueprint description's preserve list. The fast-inserter hold check is no longer met by stopping the fast-inserter machine outright.
2. **Long-hold evidence.** `validate.mjs` takes `ESSENTIALS_HOLD` in exploration mode only; see "Long holds".
3. **Published text.** `setupNotes[1]` is generated from the layout and names the machines the rear belt and the ring actually feed; the caps section and the fast-inserter bullet describe the corrected gate.
4. **Unit tests.** `tests/essentials-mall.test.mjs` pins the machine counts (3 gear, 2 advanced circuit, 1 of each other recipe, 19 in all), asserts both terms of the feed decider, its wiring and the feed arm's `signal-F` condition, and asserts a whitelist filter on every arm. For this layout it also pins the size, the six-row ring, the single arm row, the chest order, the drill hand-off, the circuit reserve and the seven owned windows.

Points to settle in later rounds:

- **"Admission arms."** The contract speaks of admission arms. The four gated entrance belts carry the same rule (`item < limit` on the ring network, listed in `loopControl.controlled`), so they are read as meeting it, as the first review did. The unit test checks each gated belt is the declared entrance for its item and side-loads onto the ring.
- **Fast-inserter hold check.** In a long hold it can miss by one craft at a window edge (35 against 34 above). The standard 10-minute hold passes (7 against 9, where the replaced layout had 4 against 7). The first review suggested allowing the consumer's crafts plus 2 in later contracts; the check is kept as written.
- **Supply at the panel figures.** The panels state recipe totals at the floors, and the mall needs 1.7 times that to hold all eight floors at once. Holding them at the panels themselves would need each product rationed to its floor, which this control does not do.
