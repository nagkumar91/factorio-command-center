# Robot essentials · 5/5/0.5/2/2 per minute

The smaller robot workshop. It makes construction robots, logistic robots, roboports, storage chests and passive provider chests at half the rate of `robot-logistics-workshop`, from supplied electronic circuits, plates, plastic, sulfuric acid and lubricant. Everything else (cable, advanced circuits, gears, pipes, steel chests, engines, electric engines, batteries, flying robot frames) is made inside.

**Status: qualified.** `native-report.json` says `passed: true` for the exact string in `robot-essentials.txt` (SHA-256 `afdc129e…4c48`, full value in `manifest.json`), from the full protocol on Factorio 2.1.24 Space Age with every entrance saturated. `panel-supply-report.json` is the same full protocol with every belt and pipe entrance fed at exactly its panel figure; it also says `passed: true` for the same string.

This string replaces the one published on 20 November (`history/one-speed-timer-d2c80909`). Same footprint, machines, entrances, panels, output chest and caps; one more decider. What changed and why is under "What the 21 November review changed".

## Size

| | |
| --- | --- |
| Footprint | 33 x 16 = **528 tiles**, 21% of the current robot workshop (106 x 24 = 2,544) |
| Area goal | goal 760, stretch 703, achieved 528 |
| Machines | 28: 26 assembling-machine-2, 2 chemical plants |
| Combinators | 27: 16 deciders, 11 arithmetic (one decider more than the replaced string) |
| Power | 2 substations inside the rectangle; connect electricity at the substation named as the power port in `manifest.json` |

Machine counts: advanced circuit 6, copper cable 1, flying robot frame 5, engine 3, electric engine 3, battery 2 (chemical plants), and one each of gear, pipe, steel chest, construction robot, logistic robot, roboport, storage chest and passive provider chest.

```
 -4 .=BBBGGGSSSCCCAAAAAAAAAAAAAAAAAAD    B battery   G gear   S steel chest   C cable   A advanced circuit
 -3 ==BBBGGGSSSCCCAAAAAAAAAAAAAAAAAAD    F frame   R construction robot   L logistic robot   H storage chest
 -2 d=BBBGGGSSSCCCAAAAAAAAAAAAAAAAAA@    E electric engine   P pipe   O roboport   N engine   V passive provider chest
 -1 d#i.ibbii.ii.biiiiiiiiiiiiiiiiiii    > < ^ v belts   i fast / b bulk inserter   = pipe   # pipe-to-ground
  0 d>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>v    $ substation   D decider   + arithmetic   d display panel   @ output chest
  1 >^ii.ii....ii.ii.ii.ii.ii.DDDii.v
  2 >^FFFFFF...FFFFFFFFFRRRLLLDDDHHHv
  3 >^FFFFFF$$+FFFFFFFFFRRRLLL$$DHHHv
  4 >^FFFFFF$$+FFFFFFFFFRRRLLL$$DHHHv
  5 >^..iDDi++.DDi++iDDiDDi++iDD.++iv
  6 d^<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  7 d#i.ii.ii.ii.ii.iiiii.ii.ii.ii.iD
  8 d=BBBEEEEEEEEEPPPOOONNNNNNNNNVVVD
  9 ..BBBEEEEEEEEEPPPOOONNNNNNNNNVVV+
 10 d.BBBEEEEEEEEEPPPOOONNNNNNNNNVVV+
 11 =============DD++DD++DD++DD++++DD
```

## Inputs (all on the WEST side, one entrance each, each with a display panel)

| Entrance | Row | Panel, per minute | Drawn with every entrance saturated | Where it goes |
| --- | ---: | ---: | ---: | --- |
| sulfuric-acid (pipe) | -3 | 400 | 450 | both battery plants; the bottom plant through an underground pipe beneath the ring's west column |
| electronic-circuit (belt) | 1 | 145 | 165 | ring |
| iron-plate (belt) | 2 | 105 | 120 | ring |
| copper-plate (belt) | 3 | 93 | 107 | ring |
| steel-plate (belt) | 4 | 74.5 | 85 | ring |
| plastic-bar (belt) | 5 | 73 | 84 | ring |
| lubricant (pipe) | 11 | 150 | 169 | header under the three electric-engine machines |

The five belt entrances are circuit-gated belts that side-load straight onto the ring. The panel figures are recipe totals at the targets. One `green-circuits` copy (360 per minute) covers the electronic circuits at either supply.

**The panels are the supply to plan for.** Fed at exactly the panel figures the workshop passes the full protocol at about 4.9 / 4.9 / 0.5 / 2.0 / 2.0 per minute (`panel-supply-report.json`). With more supply it makes more, up to about 5.5 / 5.5 / 0.57 / 2.2 / 2.2 from roughly 1.25 times the panels upward, drawing at most the saturated column above. Below the panel figures the roboport falls short first (see the table).

### Supply table (exploration runs, full protocol lengths)

Every belt and both fluids fed at the stated multiple of the panel figures. Supply the workshop does not take waits as a backlog of 16 items per belt entrance (two belt tiles) or two seconds of fluid, and is lost beyond that, like a supplier that stalls on a full belt. Steady rates per minute in the order construction robot / logistic robot / roboport / storage chest / passive provider chest. "Replaced" is the 20 November string on the same harness. All 43 runs are in `exploration-supply-sweep.json`; they are exploration measurements, and only the 1.00x and saturated rows of this string are also published reports.

| Supply vs panels | This string | Result | Replaced string | Result |
| --- | --- | --- | --- | --- |
| 0.95x | 4.90 / 4.60 / 0.43 / 2.00 / 2.00 | fails | 3.10 / 0.10 / 0.60 / 2.20 / 2.20 | fails |
| 0.98x | 4.90 / 4.90 / 0.50 / 2.00 / 2.00 | passes | not run | |
| 0.99x | 4.90 / 4.90 / **0.47** / 2.00 / 2.00 | fails (14 roboports in 30 minutes, 15 needed) | not run | |
| **1.00x** | 4.90 / 4.90 / 0.50 / 2.00 / 2.00 | **passes** | 4.90 / **1.17** / 0.57 / 2.20 / 2.20 | fails |
| 1.01x | 4.90 / 4.90 / 0.50 / 2.00 / 2.00 | passes | not run | |
| 1.02x | 4.90 / 4.90 / 0.50 / 2.00 / 2.00 | passes | 5.10 / **1.77** / 0.57 / 2.20 / 2.20 | fails |
| 1.05x | 4.97 / 4.97 / 0.50 / 2.03 / 2.03 | passes | 5.17 / **3.03** / 0.57 / 2.20 / 2.20 | fails |
| 1.10x | 5.07 / 5.07 / 0.53 / 2.07 / 2.07 | passes | 5.27 / 5.17 / 0.57 / 2.20 / 2.20 | passes |
| 1.15x | 5.30 / 5.30 / 0.53 / 2.17 / 2.17 | passes | 5.27 / 5.40 / 0.57 / 2.20 / 2.20 | passes |
| 1.20x | 5.47 / 5.43 / 0.57 / 2.17 / 2.17 | passes | 5.27 / 5.40 / 0.57 / 2.20 / 2.20 | passes |
| 1.25x | 5.47 / 5.43 / 0.57 / 2.20 / 2.20 | passes | 5.27 / 5.40 / 0.57 / 2.20 / 2.20 | passes |
| 1.30x | 5.47 / 5.47 / 0.57 / 2.20 / 2.20 | passes | 5.27 / 5.40 / 0.57 / 2.20 / 2.20 | passes |
| saturated | 5.53 / 5.50 / 0.60 / 2.20 / 2.20 | passes | 5.27 / 5.40 / 0.57 / 2.20 / 2.20 | passes |

How to read it:

- **1.00x to 1.05x**: this string passes where the replaced one starved its logistic robots.
- **1.10x to 1.20x**: both pass, and this string makes less than the replaced one for some products while staying above every target. At 1.10x: 0.20 fewer construction robots, 0.10 fewer logistic robots, 0.04 fewer roboports and 0.13 fewer of each chest per minute. At 1.15x: 0.10 fewer logistic robots, 0.04 fewer roboports, 0.03 fewer of each chest. At 1.20x: 0.03 fewer of each chest. The boost switches off whenever a refill of the roboport's ingredients dips a ring stock, so in this band it runs 28 to 89% of the time. Anyone who sized supply at 1.10 to 1.20 times the panels for the replaced string gets these lower rates after swapping; from 1.25x there is no loss.
- **1.25x and above, and saturated**: every product is at or above the replaced string's rate.
- **0.99x fails and 0.98x passes**: below the panels the roboport is one roboport short in some windows and not in others. Treat 1.00x as the floor.

The 1.00x pass was repeated with a belt backlog of 4 and of 64 items, with 13 and 17 minute warm-ups, with 120 minutes measured (4.90 / 4.88 / 0.51 / 1.98 / 1.98), with fluids left saturated, and with a 60 minute blocked hold; all passed.

One entrance at its panel figure and the rest saturated (same harness, same file):

| At 1.00x | This string | Result | Replaced string | Result |
| --- | --- | --- | --- | --- |
| steel | 5.00 / 4.97 / 0.50 / 2.00 / 2.00 | passes | 4.80 / 1.13 / 0.57 / 2.20 / 2.20 | fails |
| iron | 5.00 / 5.00 / 0.50 / 2.00 / 2.00 | passes | 5.27 / 3.73 / 0.57 / 2.20 / 2.20 | fails |
| copper | 4.90 / 4.90 / 0.53 / 2.00 / 2.00 | passes | 5.27 / 4.03 / 0.53 / 2.20 / 2.20 | fails |
| plastic | 4.90 / 4.90 / 0.50 / 2.00 / 2.00 | passes | 5.27 / 5.40 / 0.47 / 2.20 / 2.20 | fails |
| both fluids | 4.90 / 4.90 / 0.50 / 2.00 / 2.00 | passes | 5.27 / 4.73 / 0.57 / 2.20 / 2.20 | fails |
| electronic circuits | 4.90 / **4.47** / 0.50 / 2.00 / 2.00 | **fails** (steady window only) | 5.27 / 4.20 / 0.50 / 2.20 / 2.20 | fails |

Known gap: with only the electronic circuits at exactly 145 per minute and everything else abundant, logistic robots were 4.47 per minute in the measured half hour (4.9 in recovery and in every selective phase). The gate does not watch electronic circuits directly, because their ring count dips even when the belt is saturated. One `green-circuits` copy delivers 360 per minute, so this case needs a deliberately throttled circuit belt.

## Output (EAST)

One passive provider chest on the east edge, above the ring's north-east corner, holds all five products with independent caps: 20 construction robots, 20 logistic robots, 2 roboports, 10 storage chests, 10 passive provider chests. Leave the chest unrestricted (no bar). A filtered fast inserter directly below it picks from the ring's corner tile (31,0) and loads it; its filters come from five decider combinators (`product in chest + in hand < cap`), so a capped product stays on the ring while the others keep flowing.

## How the control works

- **One ring.** A closed red-belt loop of 74 tiles runs east along the top, south down the east side, west along the bottom and north up the west side. Three machine rows surround it: the top row and the bottom row work from the outside, the middle row from inside. Every ring tile reads its own contents (hold mode) on one red wire, so the red network carries the count of every item on the ring.
- **Stock limits.** Every arm that puts an item on the ring, and every entrance belt, is enabled only while that item's ring count is below its limit: circuits 64, cable 52, iron 36, copper 32, steel 32, plastic 24, advanced circuits 24, gears 24, pipes 12, batteries 12, engines / electric engines / frames 6, steel chests 4, each product 4, roboports 2. The limits sum to 352 of 592 slots (59%); the highest ring stock measured was 359 (61%), against the 90% failure line.
- **Lanes.** The entrance belts side-load onto the outer lane of the west column; machine output arms on the top and bottom rows drop on the inner lane.
- **Reserves.** Arms that feed an upstream user of a shared item wait while the ring is low, and the hungriest users wait longest: advanced-circuit machines take circuits only above 16; the gear machine (two bulk arms) takes iron only above 16 and the pipe machine above 8; the steel-chest machine takes steel only above 8; the cable machine takes copper only above 8; the roboport takes gears only above 8 and advanced circuits (with steel) only above 16.
- **Roboport last.** On the bottom row the roboport sits west of the three engine machines. The bottom belt runs west, so the roboport is the last machine offered steel, gears and advanced circuits. Its machine holds ingredients for two crafts (90 steel, 90 gears, 90 advanced circuits) and crafts ahead of its tokens; in this position that buffer only takes what the other machines left.
- **Production tokens.** Each product's output arm is metered by a latched token: one timer, one modulo per product, a latch that holds the token from each period start until the output arm holds the product, a permission decider (`product on ring < limit AND token`) and a hand-read reset. This keeps the construction robot from taking every frame and the roboport from taking every advanced circuit.
- **Two-speed clock.** The timer adds 8 every tick. The periods (5,877 / 5,907 / 56,916 / 14,619 / 14,619 timer units) pace the products at 4.90 / 4.88 / 0.506 / 1.97 / 1.97 per minute, which together ask every entrance for no more than its panel figure (plastic, 72.9 of 73, is the tightest). The roboport's pace is above its target because the protocol needs five in every ten minutes; the others sit 1.5 to 2.5% below theirs, inside the 95% floors.
- **Supply gate.** One decider reads the ring and adds 1 more to the timer (9 a tick, one eighth faster: 5.51 / 5.49 / 0.569 / 2.22 / 2.22 per minute) while all of these hold: plastic > 18, copper > 20, steel > 16, gears > 10, advanced circuits > 8, batteries > 6, electric engines > 3. Plastic and copper are the tightest entrances; gears fall when iron is short, advanced circuits when circuits, plastic or copper are, batteries when sulfuric acid is, electric engines when lubricant is. With every entrance saturated the gate was open 1,797 of 1,800 sampled seconds; at the panel figures it stayed closed.
- **Timer wrap.** At 9 a tick the timer passes 2,147,483,647 after about 46 days of play and continues from the negative end. The latches accept a period start on either side of zero, so the clock keeps working; the period at the wrap is irregular. `probe-clock-wrap.mjs` confirms natively that the signal wraps and that the remainder of a negative value is negative or zero. The wrap itself was not run in the workshop (it would need 46 days of simulated time).

Preserve: the red wires on the ring tiles, the entrance belts and the controlled arms; the green chest, cap and token wires; the arm filters; the combinator settings. `manifest.json` lists every limit, reserve, token, the gate thresholds and entity numbers.

## Measured (full protocol)

Protocol: 15 min warm-up, 30 min measured, 8 min blocked (collection stopped, nothing injected), 5 min settle, 10 min recovery, then five 15-minute selective phases (one product's collection stopped; 5 min settle, 10 min measured).

| Product | Target | Floor (95%) | Saturated: steady | Saturated: recovery | Panel supply: steady | Panel supply: recovery |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| construction-robot | 5 | 4.75 | 5.53 | 5.5 | 4.9 | 4.9 |
| logistic-robot | 5 | 4.75 | 5.5 | 5.4 | 4.9 | 4.9 |
| roboport | 0.5 | 0.475 | 0.6 | 0.6 | 0.5 | 0.5 |
| storage-chest | 2 | 1.9 | 2.2 | 2.2 | 2.0 | 2.0 |
| passive-provider-chest | 2 | 1.9 | 2.2 | 2.2 | 2.0 | 1.9 |

Saturated is `native-report.json`, the qualifying run. Panel supply is `panel-supply-report.json`: the same harness, validator, protocol and pass formula, with each belt entrance and each pipe fed at exactly its panel figure (accepted during measurement: 144.8 circuits, 105 iron, 93 copper, 74.5 steel, 73 plastic, 400 acid, 150 lubricant per minute).

In both runs the chest held exactly 20, 20, 2, 10 and 10 at the end of the blocked phase; in every selective phase the stopped product ended exactly at its cap and the other four stayed at or above their floors; every machine crafted during measurement; every entrance fed a productive machine; both fluids reached crafting consumers; bulk hands never exceeded 2.

Margins to know about:

- Saturated: the five frame machines ran at 100% (11.3 frames per minute), so frames bind the two robots; the lowest selective figures were construction robots 5.4 and roboports 0.5 (exactly 5 in 10 minutes).
- Panel supply: the ten-minute counts are near their minimum by design. Roboports were exactly 5 in the recovery window and in three of the four selective windows that count them, and passive provider chests were 19 in the recovery window (the floor is 19). There is no slack below the panels: see the 0.99x row above.
- Compared with the replaced string, the saturated draw is: circuits 165 (was 163), iron 120 (121), copper 107 (107), steel 85 (86), plastic 84 (85), acid 450 (442), lubricant 169 (165).

## Reproduce

From the repository root (worktree), with the official raw dump at the default path or in `FACTORIO_RAW`:

```sh
node scripts/robot-essentials/generate.mjs                    # robot-essentials.txt and manifest.json
RE_IMPORT_ONLY=1 node scripts/robot-essentials/validate.mjs   # import, wiring, gates, fluids, power (61 ticks)
node scripts/robot-essentials/validate.mjs                    # full protocol, saturated: native-report.json
RE_PANEL_SUPPLY=1 node scripts/robot-essentials/validate.mjs  # full protocol at the panel figures: panel-supply-report.json
node scripts/robot-essentials/probe-clock-wrap.mjs            # timer overflow and negative remainder
node --test tests/robot-essentials.test.mjs
```

The generator is deterministic; `RE_OPTIONS` rebuilds the history candidates (each `NOTE.md` gives its options; `"supplyGate":false` selects the earlier clock, machine order and reserves). `scripts/robot-essentials/screen.sh` runs a short exploration (`ESSENTIALS_EXPLORE=1`; it writes `.cache/robot-essentials/explore-report.json` and never a published report), `summary.mjs` prints per-machine crafts, status shares and missing ingredients, and `preview.mjs` draws the layout. Exploration runs can limit supply: `RE_SUPPLY=1.05` (belts), `RE_FLUID_SUPPLY=1.05` (pipes), `RE_SUPPLY_ITEMS='{"steel-plate":1}'` (single entrances), `RE_SUPPLY_BACKLOG=64`; `RE_RING_SERIES=1` records the ring stock every second. The native harness (`control.lua`, `validate.mjs`) is copied from `scripts/robot-logistics-workshop/` and adapted; it feeds only the declared entrance lanes and fluid pipes plus electricity and collects only from the declared chest. A full run takes about 25 seconds of wall time.

## What the 21 November review changed

The replaced string passed its protocol only because the protocol saturates every entrance. Its tokens ran the products 5 to 15% above target at any supply, and the roboport sat upstream of the engine machines, so at the panel figures the roboport and the chests took the steel and logistic robots fell to about 1 per minute. The README said so and told the reader to plan 15% above the panels. The review treated that as a defect of the string and fixed it without changing the footprint, the machines or the interface:

1. **Two-speed clock with a supply gate** (one new decider in two tiles that were empty, (4,5) and (5,5)). The base pace fits the panels; the boost restores the old measured rates when the ring shows surplus.
2. **Roboport moved west of the engines** (machine order on the bottom row). Its two-craft buffer no longer comes before the engines for steel and gears.
3. **Reserves**: gear machine iron 8 to 16, roboport advanced circuits 8 to 16, cable machine copper none to 8. Each one stops a machine that runs ahead for the roboport from starving the machine after it on the route (the pipe machine and the bottom battery plant for iron, the logistic robot for advanced circuits, the bottom battery plant for copper).

Size was reviewed and left alone. The rectangle has 34 empty tiles of 528, single tiles and pairs between arms, none of them a free row or column. Reaching the 5% line (501 tiles) needs a whole row or two columns gone, which means the lubricant header row or the ring's east column; the previous review examined both and rejected them, and this review found nothing new there. The machine counts are at the recipe arithmetic: saturated, the frame machines run at 100% and the advanced-circuit machines at 87 to 97%.

Candidates tried on the way (exploration runs, strings not kept):

| Idea | Result | Lesson |
| --- | --- | --- |
| Pause the timer while any raw stock is below a threshold | only 71 to 77% of the panel supply was taken | a paused clock overshoots: the ring fills, the entrances close and supply is lost; a timer paused on a period start would also hand out tokens freely |
| Boost of one seventh (7 and 8 a tick) | passed, but the boost ran 43% of the time at 1.15x | the boosted draw must stay well below the supply it is meant for |
| Roboport gear and steel arm gated on engine stock | roboport 0.4 per minute | engines on the ring are low whenever electric engines are hungry, not only when the engine machines starve |
| Roboport steel arm gated on ring steel | passed, but 1.2% of the plastic supply was refused and the roboport machine made 14 in 30 minutes | advanced circuits share that arm, so the advanced-circuit machines idled whenever steel was low |
| Pipe machine iron reserve lowered to 4 | logistic robots 4.3 | the pipe machine then took the bottom battery plant's iron; the gear machine's reserve was the one to raise |
| Five-signal gate (plastic, copper, steel > 12, gears > 8, circuits > 8) | uniform supply passed; one entrance at its panel figure failed for steel, iron, copper, circuits and fluids | the boost must also watch stocks that fall when a single entrance or a fluid is short |
| Seven-signal gate with steel > 20 and gears > 12 | same passes as published, boost 60% of the time at 1.15x | the published thresholds (16 and 10) give 70% there and keep the single-entrance passes |

## Earlier candidates

Each folder under `history/` has the string, manifest, a report and a `NOTE.md`.

| Candidate | Size | Result | Lesson |
| --- | ---: | --- | --- |
| `fast-gear-arm` | 630 | screen failed, logistic robots 4.2 | a fast arm catches too little of the sparse iron on the ring; gears starve engines, electric engines and frames |
| `rear-belt` | 630 | **qualified** (full protocol), superseded | plastic and cable on a rear belt cost two whole rows |
| `ring-fed-one-gear-arm` | 595 | screen failed, logistic robots 4.6 | with plastic and cable on the ring the iron limit had to drop, and one gear arm was short again |
| `ring-fed-acid-row` | 595 | exploration pass, superseded | two bulk iron arms on the gear machine fix the gear chain |
| `west-acid-circuit-56` | 560 | exploration pass, not published | circuits 56 left the downstream circuit users shorter than circuits 64 |
| `collector-east-column` | 560 | **qualified** (full protocol), reviewed, superseded | the collector, chest and nine combinators needed two columns east of the ring; a corner collector does without them |
| `one-speed-timer-d2c80909` | 528 | **qualified** (full protocol, saturated), superseded | a free-running clock above target starves the last machine on the route at the panel figures |

What was not tried: a nine-slot ring with machines east of the ring (about 612 tiles, larger than 528), and the spec's optional two-combinator cap logic and bare pickup windows, which save combinators but no area here because the combinators already sit in tiles the rectangle needs anyway.
