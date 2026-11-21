# Rocket supplies · 6 rockets per hour

**Qualified.** The full native protocol passed for the published string (`rocket-supplies.txt`, SHA-256 `021655202958e957f7f56646a38f19a92953cd1a59e39a670131f41e15255491`) on Factorio 2.1.24 Space Age. Report: `native-report.json`, created 2026-11-21T05:12:01Z. The same string was also run at full length with 22 feeds above the panels and kept every floor in all of them (`above-panels.json`, section "Supply above the panels"). It replaces the string `b10cbc28...` (same rectangle, same machines, same entrances and chests), which starved its low-density machines when circuits arrived above their panel; that string is kept in `history/unpaced-b10cbc28/`.

This ground blueprint keeps the three rocket ingredients side by side, ready for the rocket silo. It makes **processing units** and **low density structures** at 5 per minute each, and passes **rocket fuel** through from the rocket-fuel supplier at 5 per minute. A rocket takes 50 of each, so 5 per minute of each is one rocket every 10 minutes, or 6 rockets per hour. The whole space-launch campaign is five launches (the starter pack plus four cargo rockets), which is 250 of each ingredient. The chests stop at 400 each (8 rockets: the campaign plus three spare). The factory then stops by itself and restarts when items are taken.

## Size and machines

- Footprint: **14 x 12 = 168 tiles** (goal 260, stretch 230, fallback 340).
- Seven assembling machine 2: 2 processing unit, 2 advanced circuit, 1 copper cable and 2 low density structure. There are no other machines and no modules.
- Two decider combinators (a clock and its logic) on tiles of the arm column that were empty before. They pace the two processing-unit machines; see "How the control works".
- Layout `two-rows-tight` (rows counted from the top, 0 to 11):
  - row 0: the rocket-fuel entrance; its belt runs buried to the east, then down the chest column;
  - row 1: the sulfuric-acid entrance and header, with one substation over rows 0-1;
  - rows 2-4: four machines **outside** the ring top: advanced circuit, processing unit, processing unit, low density structure. The processing-unit machines take acid straight from the header above them;
  - column 12, rows 1-4: the clock decider (rows 1-2) and the logic decider (rows 3-4);
  - row 5: the arms of the outside machines; row 6: the ring top (flows east); row 7: the arms of the inner row;
  - rows 8-10: three machines **inside** the ring: copper cable, advanced circuit, low density structure;
  - row 11: the ring bottom (flows west). Column 0 holds the four gated belt entrances; the three chests are in column 13, rows 5-7.

```
 0 >ud...Uu##U>>v      >v< belts   u/U underground in/out   o pipe-to-ground   = pipe
 1 =odo====##..Tv      G gated entrance belt   d display panel   ## substation
 2 AAAPPPPPPLLLTv      i/I arm (circuit-controlled / plain)   B passive provider chest
 3 AAAPPPPPPLLLEv      A advanced circuit  P processing unit  C copper cable
 4 AAAPPPPPPLLLEI      L low density structure   T clock decider   E logic decider
 5 diii.ii.iiii.B   <- rocket fuel (bar 20 stacks = 400)
 6 d>>>>>>>>>>vIB   <- processing units (bar 4 stacks = 400)
 7 G^idiiiiiiivIB   <- low density structures (bar 8 stacks = 400)
 8 G^CCCAAALLLv..
 9 G^CCCAAALLLv..
10 G^CCCAAALLLv..
11 d^<<<<<<<<<<..
```

## Entrances (all west) and what to supply

Each entrance has a display panel that shows the item and the per-minute supply. The native qualification fed every entrance **throttled to exactly that figure** (not saturated), so the blueprint is proven at the panel figures. They equal the recipe demand at the targets (`nominalPerMinute`), the lowest figure the contract allows. The contract's starting figures (demand x 1.05: 5.3, 126, 48, 11, 126, 27) were lowered only after the run passed at demand.

| Entrance | Row from top | Kind | Panel (`perMinute`) | Measured draw (steady 30 min) | Comes from |
| --- | ---: | --- | ---: | ---: | --- |
| rocket-fuel | 0 (northernmost) | belt | 5/min | 5.0/min | one `rocket-fuel-supplier` (6/min) |
| sulfuric-acid | 1 | pipe | 25/min | 25.0/min | |
| copper-plate | 7 | belt | 120/min | 119.6/min | smelting |
| plastic-bar | 8 | belt | 45/min | 45.0/min | |
| steel-plate | 9 | belt | 10/min | 10.0/min | smelting |
| electronic-circuit | 10 (southernmost) | belt | 120/min | 120.0/min | one `green-circuits` copy (360/min), shared with the launch kit |

The blueprint takes no iron and no lubricant. Nothing here crafts electronic circuits or rocket fuel.

**Any supply at or above the panels works, in any combination.** A green-circuit supplier split with the kit offers more than 120 circuits per minute and an acid pipe is rarely throttled; that is the usual case and needs nothing extra. See the next section.

## Supply above the panels

Measured on the published string, full protocol lengths (15 / 30 / 140 / 5 / 10 minutes), exploration mode, with the named entrances fed above their panels and the others at their panels (`node scripts/rocket-supplies/above-panels.mjs`, results in `above-panels.json`). Per minute, steady / recovery; floor 4.75. The last-but-two column is the string this one replaced, run with the same feeds (`history/unpaced-b10cbc28/above-panels-wider.json`); bold is below the floor.

| Feed | Processing units | Low density structures | Low density structures, replaced string | Copper drawn | Plastic drawn |
| --- | ---: | ---: | ---: | ---: | ---: |
| every entrance saturated | 7.50 / 7.50 | 6.00 / 6.00 | 6.00 / 6.00 | 149.8 | 60.0 |
| every entrance at 150% of its panel | 7.50 / 7.50 | 6.00 / 6.00 | 6.00 / 6.00 | 150.0 | 60.0 |
| every entrance at 105% of its panel (the contract's starting figures) | 5.07 / 5.10 | 5.27 / 5.40 | 5.30 / 5.20 | 126.0 | 47.4 |
| circuits 220, everything else at its panel | 5.00 / 5.10 | 5.00 / 5.00 | 5.00 / **3.10** | 120.0 | 45.0 |
| circuits 220 and acid 50, everything else at its panel | 5.10 / 5.10 | 4.93 / 5.00 | **3.00** / **3.00** | 119.1 | 45.0 |
| circuits 130 and acid 50, everything else at its panel | 5.07 / 5.00 | 4.93 / 5.00 | **4.70** / 4.80 | 119.2 | 45.0 |
| circuits 220, acid 50 and steel 40; copper and plastic at their panels | 5.07 / 5.20 | 4.90 / 5.00 | **3.00** / **3.00** | 118.6 | 45.0 |
| circuits 220, acid 50 and copper 150; plastic at its panel (45) | 5.07 / 5.10 | 4.97 / 5.00 | **3.03** / **3.10** | 119.4 | 45.0 |
| circuits 220, acid 50, steel 40 and copper 240; plastic at its panel (45) | 5.07 / 5.10 | 4.90 / 5.00 | **2.97** / **3.00** | 119.0 | 45.0 |
| circuits 220, acid 50, steel 40 and plastic 90; copper at its panel (120) | 5.07 / 5.10 | 5.00 / 5.00 | **4.53** / **4.50** | 120.0 | 45.0 |
| circuits 220 and plastic 90, everything else at its panel | 5.00 / 5.00 | 5.00 / 5.10 | 5.00 / **4.50** | 120.0 | 44.9 |
| circuits 360 and plastic 90, everything else at its panel | 5.00 / 5.00 | 5.00 / 5.00 | 5.00 / **4.50** | 120.0 | 45.1 |
| circuits 220, plastic 90 and acid 50; copper at its panel (120) | 5.07 / 5.00 | 5.00 / 4.90 | **4.50** / **4.50** | 120.0 | 45.1 |
| circuits 220, plastic 90, copper 150 | 5.00 / 8.00 | 5.00 / 5.10 | 5.00 / 5.10 | 119.8 | 45.0 |
| circuits 220, plastic 90, acid 50, copper 150 | 7.53 / 7.60 | 5.00 / 5.10 | 5.00 / 5.20 | 130.1 | 55.0 |
| circuits 220, plastic 100, copper 240, steel 40 | 5.03 / 7.30 | 6.00 / 6.00 | 6.00 / 6.00 | 140.1 | 50.0 |
| plastic 50; circuits 220, acid 50, steel 40, copper 240 | 5.10 / 5.00 | 5.97 / 6.00 | **4.03** / **4.00** | 139.2 | 50.0 |
| copper 130; circuits 220, acid 50, steel 40, plastic 90 | 5.07 / 5.10 | 5.50 / 5.50 | 5.00 / 4.90 | 130.0 | 47.7 |
| acid 50, everything else at its panel | 5.00 / 5.10 | 5.00 / 5.00 | 4.97 / 5.00 | 119.8 | 45.0 |
| steel 40, everything else at its panel | 5.00 / 5.10 | 5.00 / 5.00 | 5.00 / 5.00 | 119.7 | 45.0 |
| plastic 90, everything else at its panel | 5.00 / 5.10 | 5.00 / 5.00 | 5.00 / 5.00 | 120.0 | 44.8 |
| copper 240, everything else at its panel | 5.00 / 5.10 | 5.00 / 5.00 | 5.03 / 5.00 | 119.8 | 45.0 |

All 22 feeds keep every floor: the lowest figure in the table is 4.90 (the replaced string failed a floor in 11 of them, down to 2.97). In every run each chest ended the blocked phase at exactly 400 (never above), every machine stopped in the last blocked minute, and the ring peaked at 112 to 116 of 240 (under 49%). The only failing check anywhere is "draw within the panels", in two runs: the saturated run, where it cannot hold, and "circuits 220", where the steel entrance took 301 plates in the 30 measured minutes against 300 (the harness lets an entrance that was closed for a moment catch up by a few items).

Why it works, and what it costs:

- Copper and plastic are shared, and the cable and advanced-circuit machines pick them from the ring before the low-density machines do. A processing unit costs 4 plastic and 4 copper, a low density structure 5 plastic and 20 copper, and the panels (45 and 120) cover exactly 5 of each. Unpaced, a surplus of circuits and acid let the processing-unit line run at 7.5 per minute and take 30 plastic and 30 copper, leaving the low-density line 15 plastic: 3 per minute.
- The two deciders hold the processing-unit machines to **5.07 per minute** while the ring holds fewer than 20 copper plates or fewer than 6 plastic bars. That leaves the low-density line at least 24.7 plastic and 99.7 copper per minute (98.9% and 99.7% of its need) when those arrive at exactly their panels.
- When copper and plastic both arrive faster than both lines use them (about 150 copper and 60 plastic per minute), the ring holds both reserves and the processing-unit machines run free: 7.5 and 6.0 per minute, as before.
- The cost: when copper or plastic arrives only a little above its panel, the surplus now goes to the low-density line, not to the processing units. With every entrance at 105% the string makes 5.07 processing units (the replaced string 5.23) and 5.27 low density structures (5.30); with copper at 130 and everything else high, 5.07 and 5.50 (the replaced string 7.50 and 5.00). A rocket takes the two in equal numbers, so the rocket rate is the lower figure of each pair.

## Outputs (all east)

Three passive provider chests stand in one column on the east edge. From the north they hold **rocket fuel, processing units and low density structures**. One fast arm with a one-item filter fills each chest. The chest bars are the caps (`stockControl.mode = "bar"`): 20 stacks of rocket fuel, 4 stacks of processing units and 8 stacks of low density structures, 400 of each. Take items from these chests for the silo, with robots or with inserters into a requester chest next to the silo.

## How the control works

- **One ring** (30 belt tiles, capacity 240) carries everything: plates, plastic, circuits, cable, advanced circuits and both products. Every ring tile reads its own contents (per-tile hold) onto one red network, so the network always shows how many of each item are on the ring.
- **Entrance gates:** each of the four belt entrances is itself a circuit-enabled belt that side-loads onto the ring's west column. It runs only while the ring holds less than the limit for its item: circuits 24, copper 40, plastic 12, steel 6. All four side-load onto the **same lane** of the ring (4 slots per tile, 120 on the lane); their limits sum to 82, under the generator's cap of 75% (90), so that copper can still merge when circuits and plastic sit at their limits.
- **Arms that put items on the ring** run only while the ring holds less than their item's limit: cable 16, advanced circuits 8, processing units 4, low density structures 4. All limits together sum to 114, 48% of capacity (the generator caps the sum at 60%). Each entrance limit still covers more than one lap of its flow (lap 8 s: 16 circuits, 6 plastic).
- **Every ingredient arm waits on its line's product.** The five machines of the processing-unit line (cable, both advanced-circuit machines and both processing-unit machines) take ingredients only while the ring holds fewer than 4 processing units. The two low-density machines take ingredients only while it holds fewer than 4 low density structures. When a chest is full its arm stops, the product collects on the ring up to its limit, and every machine of that line stops within one craft. No machine hoards.
- **The processing-unit machines are paced.** Along the eastbound ring top the cable and advanced-circuit machines pick copper and plastic before the low-density machines, so nothing but the processing-unit line's own appetite limits what it takes. At the panel figures that appetite is 5 per minute (acid 25, circuits 120). Above them it is held by two decider combinators north of the chests:
  - the **clock** is wired from its output to its own input on a green wire and adds 1 each tick: signal T counts 0 to 102 and starts again (103 ticks);
  - the **logic** reads T on green and the ring on red, and sends E = 1 while **T < 58, or the ring holds at least 20 copper plates and at least 6 plastic bars**;
  - both processing-unit machines are enabled only while E > 0 (one green wire from the logic to the nearer machine and on to the other). A disabled machine keeps its craft progress, so in the window alone the two make exactly 9 x 58 / 103 = 5.07 per minute.
  The cable and advanced-circuit machines are not paced: after a start they fill their small buffers at full speed (cable limit 16, advanced circuits 8 on the ring) and then make only what the processing-unit machines take. Advanced-circuit and processing-unit machines share the circuits, but processing units cannot be made faster than advanced circuits arrive, so neither starves the other.
- **Rocket fuel** never touches the ring. Its own belt, buried where it runs straight, goes from the northernmost entrance to an arm above its chest. When the chest is full the belt fills and the entrance stops accepting.
- **Acid** runs along row 1 straight into the north inputs of the two processing-unit machines.

Keep these when you place the blueprint: the red wires on all ring tiles, on the four entrance belts and on the circuit-controlled arms; the two decider combinators with their settings, their green wires (clock to itself, clock to logic, logic to both processing-unit machines) and the red wire from the logic to the ring; the arm whitelists; and the chest bars. One substation (rows 0-1, x 8-9) is the only external power connection.

## Links to the other blueprints of this round

- `rocket-fuel-supplier` (6/min, one copy): its belt exit is on its bottom row. Place it directly west with its exit on this blueprint's row 0, and join the exit to the rocket-fuel entrance with a straight red belt (`supplierLinks`: entrance row 0).
- `green-circuits` (360/min, one copy shared with `launch-kit`): split its exit belt; this blueprint takes 120/min on row 10. No row north of the circuit entrance is clear: copper, plastic and steel enter on rows 7-9, all side-loading onto the ring's west column. So a `green-circuits` copy cannot sit directly west with its exit on row 10 without covering those approaches. Place it further south or west and bring its belt in on row 10 (`supplierLinks[1].note`).
- The rocket silo (from `launch-kit`) takes 50 of each chest's item per rocket. With full chests (2,400 items) the whole campaign is in stock before the silo exists.

## Bill of materials

7 assembling machine 2, 20 fast inserter, 41 fast transport belt, 4 fast underground belt, 5 pipe, 2 pipe-to-ground, 3 passive provider chest, 2 decider combinator, 1 substation and 6 display panel. No tiles.

## Native qualification (what was run)

`node scripts/rocket-supplies/validate.mjs` runs a private headless Factorio 2.1.24 (Space Age, with a private `--config` and `--mod-directory` under `.cache/rocket-supplies/`). It imports and revives the string, then checks natively: geometry, directions, recipes, ingredient amounts, chest bars, ring readers, every circuit condition, the pacing (both deciders' settings and wiring read back, no other green wire or combinator anywhere, the clock read tick by tick for two periods, and afterwards the logic's output compared with its three conditions once a second for the whole run: 11,998 samples, no mismatch), fluid segments, power, and the three clear tiles outside every port. It feeds only the six declared entrances, each throttled to its panel figure, and collects only the declared items from the three chests, once per second.

Protocol (`manifest.protocol`): warm-up 15 min, steady measurement 30 min, **blocked 140 min** (chests not emptied, entrances still fed at their throttle), settle 5 min, recovery 10 min. The spec asked for 95 blocked minutes, which is too short for the rocket-fuel check. The chest takes 400, then the fuel belt itself holds about 130 more before the entrance stops (534 were accepted while blocked), which takes about 107 minutes at 5 per minute. So the blocked phase was lengthened, never shortened. The entrance accepted nothing in the last 5 minutes.

Measured (published report):

| | rocket fuel | processing units | low density structures |
| --- | ---: | ---: | ---: |
| steady, per minute (target 5, floor 4.75) | 5.00 | 5.00 | 5.00 |
| recovery, per minute | 5.00 | 5.00 | 5.00 |
| chest at the end of the blocked phase (max while blocked) | 400 (400) | 400 (400) | 400 (400) |

Crafts in the 30 measured minutes: processing unit 76 and 74, advanced circuit 151 and 148, copper cable 604, low density structure 60 and 90. Entrance draw: rocket fuel 5, copper 119.57, plastic 45, steel 9.97, circuits 120, acid 25 per minute; while blocked the rocket-fuel entrance accepted 534 and nothing in the last 5 minutes. The two processing-unit machines now share the work evenly (each is enabled 56% of the time and works whenever it is enabled); before pacing one ran at its 4.5/min maximum and the second made the rest. At the panel figures the ring never held both reserves in the measured minutes, so the machines ran in the window only; in the blocked phase it did (copper 40, plastic 12), which is how the run saw both branches of the logic. No machine crafted in the last minute of the blocked phase. The ring peaked at 115 of 240 (48%; the harness fails a run at 90%). Every check in `native-report.json` passed: steady, recovery, every machine crafted, entrances and acid productive, draw within the panels, outputs delivered, caps exact, machines stopped, rocket-fuel entrance stopped, ring below 90%, wiring and power, and pacing.

## Reproduce

```
npm ci
node scripts/rocket-supplies/generate.mjs           # writes blueprint-sources/rocket-supplies (needs FACTORIO_RAW or the pinned dump)
node scripts/rocket-supplies/validate.mjs           # full protocol, about 20 s wall time; rewrites native-report.json
node scripts/rocket-supplies/above-panels.mjs       # 22 full-length runs above the panels (exploration, about 4 minutes); rewrites above-panels.json
node scripts/rocket-supplies/generate.mjs           # sets status "qualified" and "measured" from the passing report
node --test tests/rocket-supplies.test.mjs
```

Exploration never touches `native-report.json`. `RS_OPTIONS='{"variant":"ring-all"}' scripts/rocket-supplies/screen.sh` generates into `.cache/rocket-supplies/candidate` and runs the protocol with `SPACE_EXPLORE=1`. `RS_SATURATE=1` saturates the entrances, `RS_FEED='{"electronic-circuit":220}'` feeds the named entrances at other figures, `RS_REPORT=<file>` writes the exploration report elsewhere, and `RS_WARMUP=10 RS_MEASURE=10 RS_BLOCKED=0 ...` shorten the phases. `node scripts/rocket-supplies/summary.mjs <report>` prints per-machine crafts and waits, ring stock and entrance draw. `node scripts/rocket-supplies/ascii.mjs [folder]` draws a string. `RS_OPTIONS='{"pacing":null}'` generates the replaced string `b10cbc28...`; `RS_OPTIONS='{"pacing":{"periodTicks":103,"windowTicks":58,"reserves":{"copper-plate":20,"plastic-bar":6},"clockAt":[12,1],"logicAt":[12,3]}}'` is the published pacing spelled out. `RS_ABOVE_SOURCE=<folder> RS_ABOVE_OUT=<file> node scripts/rocket-supplies/above-panels.mjs` runs the 22 feeds on another string.

## Tried and rejected

All five layouts passed the full-length protocol at the same supply figures, and the smallest is published, now with pacing. The three single-row layouts and the unpaced `two-rows-tight` string are kept in `history/`, each with its string, manifest, full-protocol report and a note.

| Layout | Size | Result | Why not published |
| --- | --- | --- | --- |
| `inner-row` | 30 x 8 = 240 | qualified: 5.03 / 5.00 / 5.00 steady (processing units, low density structures, rocket fuel); processing-unit recovery 4.90 | the spec's layout, with direct hand-offs so cable and advanced circuits never touch a belt; four gap columns and two near-empty rows above the ring |
| `ring-ac` | 28 x 8 = 224 | qualified: 5.00 each | advanced circuits on the ring; still has two cable gaps |
| `ring-all` | 26 x 8 = 208 | qualified: 5.00 / 5.03 / 5.00 | no gaps, one row inside the ring; the two rows above the ring are still mostly empty |
| `two-rows` | 15 x 12 = 180 | passed a full-length exploration run | superseded by `two-rows-tight` (ring east column moved in by one) |
| `two-rows-tight`, unpaced (SHA `b10cbc28...`) | 14 x 12 = 168 | qualified at the panels | low density structures fell to 3.0 per minute with circuits and acid above their panels and plastic at its panel; 11 of 22 above-panel feeds failed a floor. Kept in `history/unpaced-b10cbc28/` |
| **`two-rows-tight` with paced processing-unit machines** | **14 x 12 = 168** | **qualified (published)**; all 22 above-panel feeds keep every floor | |
| the same, pacing the cable machine instead (window 20.4 crafts per minute) | 14 x 12 = 168 | passed 16 feeds, but low density structures 4.93 steady at the panel figures | after a start the line fills its advanced-circuit buffer through the window's small margin, which takes 30 to 50 minutes and takes plastic from the low-density line all that time. Exploration only, not kept |
| the same, other clock settings (period 300, window 170 to 175; periods 60 to 400) | 14 x 12 = 168 | all pass the floors | a long period makes the machines work in bursts and the 10-minute recovery count wobbles by one craft (4.90 or 5.10 for 5.00); a wider window (5.19 or more per minute) left low density structures at 4.77 with plastic at its panel. Period 103 with window 58 gave 5.00 for every figure at the panels |
| `two-rows-tight` with circuit limit 40, plastic 20 | 14 x 12 = 168 | qualified at the panels (SHA `568cd418...`) | low density structures fell to 4.1-4.6 per minute with circuits in surplus; replaced by limits 24 and 12 (see "Review notes") |
| `two-rows-cable-last` | 14 x 12 = 168 | failed: processing-unit recovery 3.4 per minute even at the panel figures | inner row turned round so both low-density copper arms pick before the cable arm; after a block the low-density line (steel stored on the ring) then takes the copper the processing-unit line needs. Exploration only, not kept |

The published layout puts cable and advanced circuits on the ring. The spec preferred direct hand-offs, but the user's first goal is the smallest rectangle that passes. If you prefer the hand-offs, `history/inner-row` is qualified and keeps them.

From the `inner-row` runs: at the starting figures (x 1.05) it made 5.27 of each product per minute. The saturated figures for the published layout are in "Supply above the panels".

## Review notes

Review of 2026-11-21 (verdict: fix), applied:

1. **Ring limits.** All four belt entrances side-load onto one lane of the ring. With the earlier limits (circuits 40, plastic 20, copper 40, steel 6: 106 of the lane's 120 slots, plus cable 16 on the same lane), surplus circuits and plastic filled the lane and copper could not merge: low density structures measured 4.33 per minute with every entrance saturated and 4.13 to 4.57 with circuits at 220. The limits are now circuits 24 and plastic 12 (entrance share 82, 68% of the lane), and the generator asserts the share stays at or below 75% (`loopControl[0].entranceLane`). Republished as SHA `b10cbc28...`; the full protocol passed again at the panels (above). Saturated, low density structures now make 6.00 per minute.
2. **Runs above the panels.** Done at full length on the published string: saturated, and with only circuits and plastic above the panels, plus six more feeds ("Supply above the panels"). Saturated passes every check except draw-within-panels. **With only circuits and plastic above the panels (copper and acid at their panels) steady is 5.00 / 5.00 / 5.00 but low-density recovery is 4.50, below the 4.75 the review asked for.** This is not the ring defect (copper is drawn at its full 120 and the ring peaks at 114 of 240); it is the copper sharing the review itself describes in its third point. After the 140-minute block the processing-unit machines start with acid stored in the pipes, run at 7.6 per minute for the 10 recovery minutes, and their cable takes the extra copper. A layout that lets the low-density line pick copper first (`two-rows-cable-last`) moved the shortage to processing units instead (recovery 3.4 per minute even at the panels), so it was rejected. Holding both lines to a fair copper split needs a clock or rate limiter, which is more circuitry than this fix round covers. The practical answer is in the panels note and `setupNotes`: when circuits and acid come in above their panels, supply copper at 150 per minute, which passes every check in every run.
3. **README corrections.** "Feeding more than the panel figures does no harm" and "No reserves are needed" are replaced by the measured behaviour; the saturated figures quoted are now this layout's own (7.50 and 6.00); the copper note is added.
4. **Generator header** now describes `two-rows-tight`.

Size ideas from the review: the first ("no cheap saving") names no change to try. The second, burying the ring's return under the inner arm row (14 x 11 = 154), puts underground belts inside the ring; contract section 8 allows that only when the spec says so, and this spec does not, so it was not tried. Two ideas in a row gave nothing, so the size work stopped at 14 x 12 = 168.

Design review of 2026-11-21 (verdict: defect fixed, string replaced):

1. **The defect.** The copper note above (point 2) was true as far as it went, but the runs behind it all had plastic at 90. With plastic at its panel the same sharing is much worse: circuits alone at 220 gave low density structures 3.10 per minute in recovery, circuits 220 with acid 50 gave 3.00 steady, and copper at 150 did not help (3.03). A split green-circuit belt and an open acid pipe are the usual case, so the published advice ("supply copper at 150") did not cover it.
2. **The fix** is the clock that point 2 said was needed: two decider combinators on empty tiles of the arm column pace the two processing-unit machines ("How the control works"). Same rectangle, same seven machines, same entrances, panels and chests. Decoded side by side, all 89 earlier entities are where they were with the same settings; the only changes are the enable condition on the two processing-unit machines, the two deciders, and five wires (four green, one red from the logic to the ring). The full protocol passed again at the panels with 5.00 for all six figures, and all 22 above-panel feeds keep every floor ("Supply above the panels").
3. **Probed first** (private headless game): a decider wired output to input with the outputs "T, input count" and "T, constant 1" counts one step a tick and wraps one tick after its condition fails (period = constant + 1); an assembling machine 2 disabled by its circuit condition keeps its craft progress (a cable machine enabled 73 ticks in 319 made 206 crafts in 10 minutes; 90 x 73 / 319 x 10 = 206.0).
4. **Size.** The rectangle is at its floor for this topology. The ring's return row cannot be buried under the inner arm row: that row holds eight arms and a panel in nine tiles, and a 10-tile underground run needs two more belt tiles in it. No column can go: the north row of four machines is 12 wide, and the chests need an arm column between them and the ring. Every machine count equals the recipe arithmetic (1.11 processing-unit, 1.33 advanced-circuit, 0.22 cable and 1.67 low-density machines needed).
