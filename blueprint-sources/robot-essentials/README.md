# Robot essentials · 5/5/0.5/2/2/2 per minute

The smaller robot workshop. It makes construction robots, logistic robots, roboports, storage chests, passive provider chests and requester chests (entity `requester-chest`) at half the rate of `robot-logistics-workshop`, from supplied electronic circuits, plates, plastic, sulfuric acid and lubricant. Everything else (cable, advanced circuits, gears, pipes, steel chests, engines, electric engines, batteries, flying robot frames) is made inside.

**Status: qualified.** `native-report.json` says `passed: true` for the exact string in `robot-essentials.txt` (SHA-256 `563311c2…a8d3`, full value `563311c2d22c7d44c9309cae8bb697d8daad3f8261fa50191dc22a08e46da8d3`), from the full protocol on Factorio 2.1.25 Space Age with every entrance saturated. `panel-supply-report.json` is the same full protocol with every belt and pipe entrance fed at exactly its panel figure; it also says `passed: true` for the same string.

**Requester chests (26 November).** The requester chest is now a sixth product, two a minute (the same as the passive provider chest), in the same single east output chest with its own cap of one full stack (50). It needs the three ingredients the other two chests use (a steel chest, 3 electronic circuits, 1 advanced circuit), so the workshop needed one more machine and its entrance figures went up: electronic circuits 155 (was 145), steel 90.5 (74.5), plastic 77 (73), copper 97 (93). Measured at the targets the steady rates are in the table under "Measured".

Why the requester chest has its own inserter: the collector fills the chest through dynamic filters set by circuit signals, and every inserter in the prototype dump holds at most five filters (`filter_count` 5), so a sixth product cannot go through the collector. Its machine stands at the east end of the top row, three tiles from the chest, and an inserter on the chest's west side picks from the machine and drops into the chest. That inserter is metered by the same latched token as the other products and stops when the chest already holds 50 requester chests (a permission decider reading the chest's own red counts, not the ring). The five ring-borne products keep their five filter deciders and the collector at the ring's north-east corner. To make room the ring grew four columns to the east (the east column, the corner collector and the chest moved from x=31 to x=35); every entrance, its panel and the output chest's relative place on the east edge are unchanged, and a third substation sits in the new ground inside the ring.

The earlier five-product string (SHA-256 `e8d154c9…46e6`, 33 x 16 = 528 tiles) is kept complete and qualified in `history/five-products-full-stack/`, and the twenty-robot string before it in `history/twenty-robot-caps/` (SHA-256 `afdc129e…4c48`). All three are listed in `manifest.json` under `versions`, newest first: "Requester chests", "Full-stack caps", "Twenty-robot caps". The text from "Supply table" down to "Earlier candidates" was written for the five-product string (the 21 and 22 November rounds); where it gives a measurement or a size it says which string it describes.

The 20 November string `history/one-speed-timer-d2c80909` was replaced by the twenty-robot string: same footprint, machines, entrances, panels, output chest and caps, one more decider. What changed and why is under "What the 21 November review changed".

## Size

| | |
| --- | --- |
| Footprint | 37 x 16 = **592 tiles** (the five-product string was 33 x 16 = 528: four columns wider, same height), 54% of the robot logistics workshop (52 x 21 = 1,092) |
| Area goal | goal 760, stretch 703, achieved 592 |
| Machines | 29: 27 assembling-machine-2, 2 chemical plants |
| Combinators | 33: 21 deciders, 12 arithmetic |
| Power | 3 substations inside the rectangle; connect electricity at the substation named as the power port in `manifest.json` |

Machine counts: advanced circuit 6, copper cable 1, flying robot frame 5, engine 3, electric engine 3, battery 2 (chemical plants), and one each of gear, pipe, steel chest, construction robot, logistic robot, roboport, storage chest, passive provider chest and requester chest.

```
 -4 .=BBBGGGSSSCCCAAAAAAAAAAAAAAAAAAQQQ.D
 -3 ==BBBGGGSSSCCCAAAAAAAAAAAAAAAAAAQQQ.D
 -2 d=BBBGGGSSSCCCAAAAAAAAAAAAAAAAAAQQQi@
 -1 d#i.ibbii.ii.biiiiiiiiiiiiiiiiiii...i
  0 d>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>v
  1 >^ii.ii....ii.ii.ii.ii.ii....ii.DDDDv
  2 >^FFFFFF...FFFFFFFFFRRRLLL...HHHDDDDv
  3 >^FFFFFF$$.FFFFFFFFFRRRLLL$$+HHH+$$Dv
  4 >^FFFFFF$$.FFFFFFFFFRRRLLL$$+HHH+$$Dv
  5 >^..i..i.....i..iDDiDDi++iDD.DDi++..v
  6 d^<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  7 d#i.ii.ii.ii.ii.iiiii.ii.ii.ii.iDD++D
  8 d=BBBEEEEEEEEEPPPOOONNNNNNNNNVVV++++D
  9 ..BBBEEEEEEEEEPPPOOONNNNNNNNNVVV++DD.
 10 d.BBBEEEEEEEEEPPPOOONNNNNNNNNVVVDD++.
 11 =============......++++DD++DDDD.++DD.
```

(Letters: `B` battery, `G` gear, `S` steel chest, `C` cable, `A` advanced circuit, `F` frame, `R` construction robot, `L` logistic robot, `H` storage chest, `E` electric engine, `P` pipe, `O` roboport, `N` engine, `V` passive provider chest, `Q` requester chest, `@` output chest, `D` decider, `+` arithmetic, `$` substation, `d` display panel, `i` / `b` fast / bulk inserter; the inserter between `Q` and `@` is the requester chest's own.)

## Inputs (all on the WEST side, one entrance each, each with a display panel)

| Entrance | Row | Panel, per minute | Drawn with every entrance saturated | Where it goes |
| --- | ---: | ---: | ---: | --- |
| sulfuric-acid (pipe) | -3 | 400 | 450 | both battery plants; the bottom plant through an underground pipe beneath the ring's west column |
| electronic-circuit (belt) | 1 | 155 | 176 | ring |
| iron-plate (belt) | 2 | 105 | 120 | ring |
| copper-plate (belt) | 3 | 97 | 110 | ring |
| steel-plate (belt) | 4 | 90.5 | 101 | ring |
| plastic-bar (belt) | 5 | 77 | 88 | ring |
| lubricant (pipe) | 11 | 150 | 169 | header under the three electric-engine machines |

The five belt entrances are circuit-gated belts that side-load straight onto the ring. The panel figures are recipe totals at the targets. One `green-circuits` copy (360 per minute) covers the electronic circuits at either supply.

**The panels are the supply to plan for.** Fed at exactly the panel figures the workshop passes the full protocol at about 4.9 / 4.87 / 0.53 / 2.0 / 2.0 / 1.97 per minute (`panel-supply-report.json`). With more supply it makes more: saturated it measured 5.53 / 5.47 / 0.53 / 2.2 / 2.2 / 2.23, drawing the saturated column above. Below the panel figures the roboport falls short first (see the table). The supply table below, and the 1.25 times figure where the boost starts, were measured on the five-product string and have not been measured again for this one; the saturated and panel-supply runs above are this string's.

### Supply table (five-product string, exploration runs, full protocol lengths)

Every belt and both fluids fed at the stated multiple of the panel figures (measured on the twenty-robot string, five products; the chest caps do not touch supply, rates or ring limits, and the chest is emptied every second in these runs). Supply the workshop does not take waits as a backlog of 16 items per belt entrance (two belt tiles) or two seconds of fluid, and is lost beyond that, like a supplier that stalls on a full belt. Steady rates per minute in the order construction robot / logistic robot / roboport / storage chest / passive provider chest (no requester chest in this string). "Replaced" is the 20 November string on the same harness. All 43 runs are in `exploration-supply-sweep.json`; they are exploration measurements, and only the 1.00x and saturated rows of this string are also published reports.

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

Known gap (five-product string): with only the electronic circuits at exactly 145 per minute and everything else abundant, logistic robots were 4.47 per minute in the measured half hour (4.9 in recovery and in every selective phase). The gate does not watch electronic circuits directly, because their ring count dips even when the belt is saturated. One `green-circuits` copy delivers 360 per minute, so this case needs a deliberately throttled circuit belt.

## Output (EAST)

One passive provider chest on the east edge, above the ring's north-east corner, holds all six products with independent caps: 50 construction robots, 50 logistic robots, 10 roboports, 50 storage chests, 50 passive provider chests and 50 requester chests (one full stack of each; the twenty-robot version stops at 20 / 20 / 2 / 10 / 10). Leave the chest unrestricted (no bar). A passive provider chest has 48 slots and the six products at their caps fill 6 (50 / 50 + 50 / 50 + 10 / 10 + 50 / 50 + 50 / 50 + 50 / 50 = 6 slots), so the chest is never the limit.

Two ways in. The five ring-borne products come through a filtered fast inserter directly below the chest, which picks from the ring's corner tile (35,0); its filters come from five decider combinators (`product in chest + in hand < cap`), so a capped product stays on the ring while the others keep flowing. The requester chests do not ride the ring: the requester chest machine (last on the top row, x 31 to 33) takes a steel chest, electronic circuits and advanced circuits from the ring through one filtered arm and an inserter on the chest's west side (34,-2) moves each finished requester chest into the chest. That inserter is enabled by its token and by a permission decider that reads the chest's own red counts (`requester chests in chest < 50`), so it stops exactly at 50 and starts again when the player takes some. The east approach to the chest (three tiles) stays clear.

## How the control works

- **One ring.** A closed red-belt loop of 82 tiles runs east along the top, south down the east side, west along the bottom and north up the west side. Three machine rows surround it: the top row and the bottom row work from the outside, the middle row from inside. Every ring tile reads its own contents (hold mode) on one red wire, so the red network carries the count of every item on the ring.
- **Stock limits.** Every arm that puts an item on the ring, and every entrance belt, is enabled only while that item's ring count is below its limit: circuits 64, cable 52, iron 36, copper 32, steel 32, plastic 24, advanced circuits 24, gears 24, pipes 12, batteries 12, engines / electric engines / frames 6, steel chests 4, each product 4, roboports 2. The limits sum to 352 of 656 slots (54%); the highest ring stock measured was 363 (55%), against the 90% failure line.
- **Lanes.** The entrance belts side-load onto the outer lane of the west column; machine output arms on the top and bottom rows drop on the inner lane.
- **Reserves.** Arms that feed an upstream user of a shared item wait while the ring is low, and the hungriest users wait longest: advanced-circuit machines take circuits only above 16; the gear machine (two bulk arms) takes iron only above 16 and the pipe machine above 8; the steel-chest machine takes steel only above 8; the cable machine takes copper only above 8; the roboport takes gears only above 8 and advanced circuits (with steel) only above 16.
- **Roboport last.** On the bottom row the roboport sits west of the three engine machines. The bottom belt runs west, so the roboport is the last machine offered steel, gears and advanced circuits. Its machine holds ingredients for two crafts (90 steel, 90 gears, 90 advanced circuits) and crafts ahead of its tokens; in this position that buffer only takes what the other machines left.
- **Production tokens.** Each product's output arm is metered by a latched token: one timer, one modulo per product, a latch that holds the token from each period start until the output arm holds the product, a permission decider (`product on ring < limit AND token`; for the requester chest `requester chests in the chest < 50 AND token`) and a hand-read reset. This keeps the construction robot from taking every frame and the roboport from taking every advanced circuit.
- **Two-speed clock.** The timer adds 8 every tick. The periods (5,877 / 5,907 / 56,916 / 14,619 / 14,619 / 14,619 timer units) pace the products at 4.90 / 4.88 / 0.506 / 1.97 / 1.97 / 1.97 per minute, which together ask every entrance for no more than its panel figure. The roboport's pace is above its target because the protocol needs five in every ten minutes; the others sit 1.5 to 2.5% below theirs, inside the 95% floors.
- **Supply gate.** One decider reads the ring and adds 1 more to the timer (9 a tick, one eighth faster: 5.51 / 5.49 / 0.569 / 2.22 / 2.22 / 2.22 per minute) while all of these hold: plastic > 18, copper > 20, steel > 16, gears > 10, advanced circuits > 8, batteries > 6, electric engines > 3. Plastic and copper are the tightest entrances; gears fall when iron is short, advanced circuits when circuits, plastic or copper are, batteries when sulfuric acid is, electric engines when lubricant is. With every entrance saturated the gate was open all 1,800 sampled seconds; at the panel figures it stayed closed.
- **Timer wrap.** At 9 a tick the timer passes 2,147,483,647 after about 46 days of play and continues from the negative end. The latches accept a period start on either side of zero, so the clock keeps working; the period at the wrap is irregular. `probe-clock-wrap.mjs` confirms natively that the signal wraps and that the remainder of a negative value is negative or zero. The wrap itself was not run in the workshop (it would need 46 days of simulated time).

Preserve: the red wires on the ring tiles, the entrance belts and the controlled arms; the green chest, cap and token wires, and the red wire from the chest to the requester chest's permission decider; the arm filters; the combinator settings. `manifest.json` lists every limit, reserve, token, the gate thresholds and entity numbers.

## Measured (full protocol)

Run on 26 November 2026 on the installed Factorio 2.1.25 Space Age (vanilla), headless with a private profile; each full run took about 52 seconds of wall time.

Protocol: 15 min warm-up, 30 min measured, **30 min** blocked (collection stopped, nothing injected), 5 min settle, 10 min recovery, then six **40-minute** selective phases (one product's collection stopped; **30 min** settle, 10 min measured). The twenty-robot string ran 8 minutes blocked and 15-minute selective phases (5 settle, 10 measured). The chest is empty when a hold starts, so the hold must outlast the time one product needs to reach its cap at the measured rate: 50 storage, passive provider or requester chests at 2.0 to 2.2 per minute is 23 to 25 minutes, 10 roboports at 0.5 to 0.6 is 17 to 20, 50 robots at 4.9 to 5.5 is 9 to 10. The harness records the minute each cap was reached, and `capsReachedInTime` fails the run unless every cap was reached inside the closed hold and inside each selective settle, so the other five products are always measured while the blocked one is stocked. Pass bars are otherwise unchanged.

| Product | Target | Floor (95%) | Saturated: steady | Saturated: recovery | Panel supply: steady | Panel supply: recovery |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| construction-robot | 5 | 4.75 | 5.53 | 5.4 | 4.9 | 4.9 |
| logistic-robot | 5 | 4.75 | 5.47 | 5.4 | 4.87 | 4.9 |
| roboport | 0.5 | 0.475 | 0.53 | 0.6 | 0.53 | 0.5 |
| storage-chest | 2 | 1.9 | 2.2 | 2.2 | 2.0 | 2.0 |
| passive-provider-chest | 2 | 1.9 | 2.2 | 2.2 | 2.0 | 2.0 |
| requester-chest | 2 | 1.9 | 2.23 | 2.2 | 1.97 | 1.9 |

Saturated is `native-report.json`, the qualifying run. Panel supply is `panel-supply-report.json`: the same harness, validator, protocol and pass formula, with each belt entrance and each pipe fed at exactly its panel figure (accepted during measurement: 155 circuits, 105 iron, 97 copper, 90.5 steel, 77 plastic, 400 acid, 150 lubricant per minute).

In both runs the chest held exactly 50, 50, 10, 50, 50 and 50 at the end of the blocked phase; in every selective phase the stopped product ended exactly at its cap (the requester chest too, through its own inserter) and the other five stayed at or above their floors. Minutes to reach the cap from an empty chest (closed hold, saturated / panel supply): construction robot 9.1 / 10.2, logistic robot 9.0 / 10.1, roboport 15.6 / 18.3, storage chest 22.3 / 24.5, passive provider chest 22.3 / 24.5, requester chest 22.4 / 24.2 (30 allowed); in the selective phases 8.9 to 22.8 minutes saturated and 10.1 to 25.1 at the panels (30 allowed). Lowest other-product rates while one was held at its cap: saturated, logistic robot 5.5, roboport 0.5, chests 2.2; panel supply, logistic robot 4.8, roboport 0.5, chests 2.0. Ring peak 363 of 656 saturated, 361 at the panels. Every machine crafted during measurement; every entrance fed a productive machine; both fluids reached crafting consumers; bulk hands never exceeded 2.

Margins to know about:

- **The advanced-circuit machines are the limit.** Saturated, the six machines make 43.7 advanced circuits a minute of the 45 they can (five of them at 96 to 100% working); the single cable machine makes 88 of its 90 crafts. The requester chest adds 2 advanced circuits (and 8 cable) a minute, and the roboport, last in line for them, pays: it measured 0.53 steady with saturated entrances (the five-product string 0.6) and 0.5 in the recovery window at the panels. Both are above the 0.475 floor, and every other product is at or above its earlier rate. More roboport margin needs a seventh advanced-circuit machine and a second cable machine, which is more ground than this change took.
- Saturated: the five frame machines ran at 100% (11.2 frames per minute), so frames bind the two robots.
- Panel supply: the ten-minute counts are near their minimum by design. The requester chest was 19 in the recovery window (the floor is 19, like the other chests in the five-product string), and the lowest selective roboport figure was exactly 5 in 10 minutes. There is no slack below the panels.
- Compared with the five-product string, the saturated draw is: circuits 176 (was 165), iron 120 (120), copper 110 (107), steel 101 (85), plastic 88 (84), acid 450 (450), lubricant 169 (169).

## Reproduce

From the repository root (worktree), with the official raw dump at the default path or in `FACTORIO_RAW` (generated with `factorio --dump-data` from the installed 2.1.25 game, in an isolated config and mod directory; SHA-256 `289d0de81102a710f16fc989a5df399facdef91c100901da87e5e69b4d911495`):

```sh
node scripts/robot-essentials/generate.mjs                    # robot-essentials.txt and manifest.json (keeps the committed string when it decodes to the same blueprint)
RE_IMPORT_ONLY=1 node scripts/robot-essentials/validate.mjs   # import, wiring, gates, fluids, power (61 ticks)
node scripts/robot-essentials/validate.mjs                    # full protocol, saturated: native-report.json
RE_PANEL_SUPPLY=1 node scripts/robot-essentials/validate.mjs  # full protocol at the panel figures: panel-supply-report.json
node scripts/robot-essentials/probe-clock-wrap.mjs            # timer overflow and negative remainder
node --test tests/robot-essentials.test.mjs
```

The generator is deterministic; `RE_OPTIONS` rebuilds the history candidates (including `caps` and `protocol` overrides) (each `NOTE.md` gives its options; `"supplyGate":false` selects the earlier clock, machine order and reserves). `scripts/robot-essentials/screen.sh` runs a short exploration (`ESSENTIALS_EXPLORE=1`; it writes `.cache/robot-essentials/explore-report.json` and never a published report), `summary.mjs` prints per-machine crafts, status shares and missing ingredients, and `preview.mjs` draws the layout. Exploration runs can limit supply: `RE_SUPPLY=1.05` (belts), `RE_FLUID_SUPPLY=1.05` (pipes), `RE_SUPPLY_ITEMS='{"steel-plate":1}'` (single entrances), `RE_SUPPLY_BACKLOG=64`; `RE_RING_SERIES=1` records the ring stock every second. The native harness (`control.lua`, `validate.mjs`) is copied from `scripts/robot-logistics-workshop/` and adapted; it feeds only the declared entrance lanes and fluid pipes plus electricity and collects only from the declared chest. A full run takes about 52 seconds of wall time.

## What the 21 November review changed

(The numbers in this section and in the candidate table describe the five-product string of that time.)

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
| `five-products-full-stack` | 528 | **qualified** (full protocol, saturated and at the panels, Factorio 2.1.24), superseded by the requester chests | the 22 November string: five products, caps 50 / 50 / 10 / 50 / 50, steady 5.53 / 5.5 / 0.6 / 2.2 / 2.2; kept selectable |
| `twenty-robot-caps` | 528 | **qualified** (full protocol, saturated and at the panels), superseded by the full-stack caps | same string with chest caps 20 / 20 / 2 / 10 / 10; kept selectable. `RE_OPTIONS='{"caps":{"construction-robot":20,"logistic-robot":20,"roboport":2,"storage-chest":10,"passive-provider-chest":10},"protocol":{"blockedMinutes":8,"selectiveSettleMinutes":5}}'` rebuilds it |
| `fast-gear-arm` | 630 | screen failed, logistic robots 4.2 | a fast arm catches too little of the sparse iron on the ring; gears starve engines, electric engines and frames |
| `rear-belt` | 630 | **qualified** (full protocol), superseded | plastic and cable on a rear belt cost two whole rows |
| `ring-fed-one-gear-arm` | 595 | screen failed, logistic robots 4.6 | with plastic and cable on the ring the iron limit had to drop, and one gear arm was short again |
| `ring-fed-acid-row` | 595 | exploration pass, superseded | two bulk iron arms on the gear machine fix the gear chain |
| `west-acid-circuit-56` | 560 | exploration pass, not published | circuits 56 left the downstream circuit users shorter than circuits 64 |
| `collector-east-column` | 560 | **qualified** (full protocol), reviewed, superseded | the collector, chest and nine combinators needed two columns east of the ring; a corner collector does without them |
| `one-speed-timer-d2c80909` | 528 | **qualified** (full protocol, saturated), superseded | a free-running clock above target starves the last machine on the route at the panel figures |

What was not tried: a nine-slot ring with machines east of the ring (about 612 tiles, larger than 528), and the spec's optional two-combinator cap logic and bare pickup windows, which save combinators but no area here because the combinators already sit in tiles the rectangle needs anyway.
