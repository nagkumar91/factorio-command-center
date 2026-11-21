# Rocket supplies · 6 rockets per hour

**Qualified.** The full native protocol passed for the published string (`rocket-supplies.txt`, SHA-256 `b10cbc287a0104307b394c9d2dbb11d82f2fedf12251126fa42aa3585b4fd106`) on Factorio 2.1.24 Space Age. Report: `native-report.json`, created 2026-11-21T02:08:26Z. The same string was also run at full length with supply above the panels (`above-panels.json`, section "Supply above the panels").

This ground blueprint keeps the three rocket ingredients side by side, ready for the rocket silo. It makes **processing units** and **low density structures** at 5 per minute each, and passes **rocket fuel** through from the rocket-fuel supplier at 5 per minute. A rocket takes 50 of each, so 5 per minute of each is one rocket every 10 minutes, or 6 rockets per hour. The whole space-launch campaign is five launches (the starter pack plus four cargo rockets), which is 250 of each ingredient. The chests stop at 400 each (8 rockets: the campaign plus three spare). The factory then stops by itself and restarts when items are taken.

## Size and machines

- Footprint: **14 x 12 = 168 tiles** (goal 260, stretch 230, fallback 340).
- Seven assembling machine 2: 2 processing unit, 2 advanced circuit, 1 copper cable and 2 low density structure. There are no other machines and no modules.
- Layout `two-rows-tight` (rows counted from the top, 0 to 11):
  - row 0: the rocket-fuel entrance; its belt runs buried to the east, then down the chest column;
  - row 1: the sulfuric-acid entrance and header, with one substation over rows 0-1;
  - rows 2-4: four machines **outside** the ring top: advanced circuit, processing unit, processing unit, low density structure. The processing-unit machines take acid straight from the header above them;
  - row 5: their arms; row 6: the ring top (flows east); row 7: the arms of the inner row;
  - rows 8-10: three machines **inside** the ring: copper cable, advanced circuit, low density structure;
  - row 11: the ring bottom (flows west). Column 0 holds the four gated belt entrances; the three chests are in column 13, rows 5-7.

```
 0 >ud...Uu##U>>v      >v< belts   u/U underground in/out   o pipe-to-ground   = pipe
 1 =odo====##...v      G gated entrance belt   d display panel   ## substation
 2 AAAPPPPPPLLL.v      i/I arm (circuit-controlled / plain)   B passive provider chest
 3 AAAPPPPPPLLL.v      A advanced circuit  P processing unit  C copper cable
 4 AAAPPPPPPLLL.I      L low density structure
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
| copper-plate | 7 | belt | 120/min | 120.0/min | smelting |
| plastic-bar | 8 | belt | 45/min | 45.0/min | |
| steel-plate | 9 | belt | 10/min | 10.0/min | smelting |
| electronic-circuit | 10 (southernmost) | belt | 120/min | 120.0/min | one `green-circuits` copy (360/min), shared with the launch kit |

The blueprint takes no iron and no lubricant. Nothing here crafts electronic circuits or rocket fuel. At the contract's starting figures (x 1.05) this layout made 5.23 processing units, 5.30 low density structures and 5.30 rocket fuel per minute (exploration run of the earlier limits, full protocol lengths, all checks passed).

**If circuits and acid come in above their panels, supply copper at 150 per minute.** That is the usual case: a green-circuit supplier split with the kit offers more than 120 circuits per minute, and an acid pipe is rarely throttled. See the next section.

## Supply above the panels

Measured on the published string, full protocol lengths (15 / 30 / 140 / 5 / 10 minutes), exploration mode, with the named entrances fed above their panels and the others at their panels (`node scripts/rocket-supplies/above-panels.mjs`, results in `above-panels.json`). Per minute, steady / recovery; floor 4.75.

| Feed | Processing units | Low density structures | Copper drawn | Result |
| --- | ---: | ---: | ---: | --- |
| every entrance saturated | 7.50 / 7.50 | 6.00 / 6.00 | 150.0 | passes |
| every entrance at 150% of its panel | 7.53 / 7.50 | 6.00 / 6.00 | 150.3 | passes |
| circuits 220, plastic 100, copper 240, steel 40 | 5.00 / 7.60 | 6.00 / 6.00 | 140.0 | passes |
| circuits 220, plastic 90, copper 150 | 5.00 / 7.60 | 5.00 / 5.10 | 120.0 | passes |
| circuits 220, plastic 90, acid 50, copper 150 | 7.50 / 7.40 | 5.00 / 5.20 | 130.0 | passes |
| circuits 220, plastic 90 (copper 120) | 5.00 / 7.60 | 5.00 / **4.50** | 120.0 | recovery below the floor |
| circuits 360, plastic 90 (copper 120) | 5.00 / 7.30 | 5.00 / **4.50** | 120.0 | recovery below the floor |
| circuits 220, plastic 90, acid 50 (copper 120) | 7.50 / 7.50 | **4.50** / **4.50** | 120.0 | steady and recovery below the floor |

In every run each chest ended the blocked phase at exactly 400 (never above), every machine stopped in the last blocked minute, and the ring peaked at 111 to 115 of 240 (under 48%). The only other failing check is "draw within the panels", which cannot hold when the feed is above the panels.

Why copper matters: with circuits plentiful, the processing-unit line is limited only by acid, and with acid above 25 per minute (or acid stored in the pipes during a block) it runs at up to 7.5 per minute. Its cable then takes 30 copper per minute instead of 20. With copper at exactly 120, low density structures get 90 copper per minute and run at about **4.5 per minute until the processing-unit chest is full**; then they get it all and run at 6. The chests still fill: 400 of each needs 9,600 copper, 80 minutes at 120 per minute either way. Supplying copper at 150 per minute (125% of the panel) removes the dip in every run above.

The ring itself is no longer the limit: in every run copper was drawn either at its full offered rate or as fast as the machines used it (the low-density line is held to 5 per minute by steel at 10). (Before the review fix it was: see "Review notes".)

## Outputs (all east)

Three passive provider chests stand in one column on the east edge. From the north they hold **rocket fuel, processing units and low density structures**. One fast arm with a one-item filter fills each chest. The chest bars are the caps (`stockControl.mode = "bar"`): 20 stacks of rocket fuel, 4 stacks of processing units and 8 stacks of low density structures, 400 of each. Take items from these chests for the silo, with robots or with inserters into a requester chest next to the silo.

## How the control works

- **One ring** (30 belt tiles, capacity 240) carries everything: plates, plastic, circuits, cable, advanced circuits and both products. Every ring tile reads its own contents (per-tile hold) onto one red network, so the network always shows how many of each item are on the ring.
- **Entrance gates:** each of the four belt entrances is itself a circuit-enabled belt that side-loads onto the ring's west column. It runs only while the ring holds less than the limit for its item: circuits 24, copper 40, plastic 12, steel 6. All four side-load onto the **same lane** of the ring (4 slots per tile, 120 on the lane); their limits sum to 82, under the generator's cap of 75% (90), so that copper can still merge when circuits and plastic sit at their limits.
- **Arms that put items on the ring** run only while the ring holds less than their item's limit: cable 16, advanced circuits 8, processing units 4, low density structures 4. All limits together sum to 114, 48% of capacity (the generator caps the sum at 60%). Each entrance limit still covers more than one lap of its flow (lap 8 s: 16 circuits, 6 plastic).
- **Every ingredient arm waits on its line's product.** The five machines of the processing-unit line (cable, both advanced-circuit machines and both processing-unit machines) take ingredients only while the ring holds fewer than 4 processing units. The two low-density machines take ingredients only while it holds fewer than 4 low density structures. When a chest is full its arm stops, the product collects on the ring up to its limit, and every machine of that line stops within one craft. No machine hoards.
- **No reserve gates; each line is held to its rate by its own input.** Along the eastbound ring top the cable and advanced-circuit machines pick copper and plastic before the low-density machines. At the panel figures this does no harm: the processing-unit line is held to 5 per minute by the acid (25 per minute) and the circuits (120), the low-density line by the steel (10), and copper (120) covers both. When circuits and acid arrive above their panels, the processing-unit line runs faster and takes more copper first; that is the copper note under "Supply above the panels". Advanced-circuit and processing-unit machines share the circuits, but processing units cannot be made faster than advanced circuits arrive, so neither starves the other.
- **Rocket fuel** never touches the ring. Its own belt, buried where it runs straight, goes from the northernmost entrance to an arm above its chest. When the chest is full the belt fills and the entrance stops accepting.
- **Acid** runs along row 1 straight into the north inputs of the two processing-unit machines.

Keep these when you place the blueprint: the red wires on all ring tiles, on the four entrance belts and on the circuit-controlled arms; the arm whitelists; and the chest bars. One substation (rows 0-1, x 8-9) is the only external power connection.

## Links to the other blueprints of this round

- `rocket-fuel-supplier` (6/min, one copy): its belt exit is on its bottom row. Place it directly west with its exit on this blueprint's row 0, and join the exit to the rocket-fuel entrance with a straight red belt (`supplierLinks`: entrance row 0).
- `green-circuits` (360/min, one copy shared with `launch-kit`): split its exit belt; this blueprint takes 120/min on row 10. No row north of the circuit entrance is clear: copper, plastic and steel enter on rows 7-9, all side-loading onto the ring's west column. So a `green-circuits` copy cannot sit directly west with its exit on row 10 without covering those approaches. Place it further south or west and bring its belt in on row 10 (`supplierLinks[1].note`).
- The rocket silo (from `launch-kit`) takes 50 of each chest's item per rocket. With full chests (2,400 items) the whole campaign is in stock before the silo exists.

## Bill of materials

7 assembling machine 2, 20 fast inserter, 41 fast transport belt, 4 fast underground belt, 5 pipe, 2 pipe-to-ground, 3 passive provider chest, 1 substation and 6 display panel. No tiles.

## Native qualification (what was run)

`node scripts/rocket-supplies/validate.mjs` runs a private headless Factorio 2.1.24 (Space Age, with a private `--config` and `--mod-directory` under `.cache/rocket-supplies/`). It imports and revives the string, then checks natively: geometry, directions, recipes, ingredient amounts, chest bars, ring readers, every circuit condition, fluid segments, power, and the three clear tiles outside every port. It feeds only the six declared entrances, each throttled to its panel figure, and collects only the declared items from the three chests, once per second.

Protocol (`manifest.protocol`): warm-up 15 min, steady measurement 30 min, **blocked 140 min** (chests not emptied, entrances still fed at their throttle), settle 5 min, recovery 10 min. The spec asked for 95 blocked minutes, which is too short for the rocket-fuel check. The chest takes 400, then the fuel belt itself holds about 130 more before the entrance stops (534 were accepted while blocked), which takes about 107 minutes at 5 per minute. So the blocked phase was lengthened, never shortened. The entrance accepted nothing in the last 5 minutes.

Measured (published report):

| | rocket fuel | processing units | low density structures |
| --- | ---: | ---: | ---: |
| steady, per minute (target 5, floor 4.75) | 5.00 | 5.00 | 5.00 |
| recovery, per minute | 5.00 | 5.00 | 5.00 |
| chest at the end of the blocked phase (max while blocked) | 400 (400) | 400 (400) | 400 (400) |

Crafts in the 30 measured minutes: processing unit 135 and 15, advanced circuit 152 and 147, copper cable 598, low density structure 60 and 90. Entrance draw: rocket fuel 5, copper 119.97, plastic 45, steel 10, circuits 120, acid 25 per minute; while blocked the rocket-fuel entrance accepted 534 and nothing in the last 5 minutes. One processing-unit machine runs at its 4.5/min maximum and the second makes the rest, because 5 per minute needs 1.1 machines. No machine crafted in the last minute of the blocked phase. The ring peaked at 116 of 240 (48%; the harness fails a run at 90%). Every check in `native-report.json` passed: steady, recovery, every machine crafted, entrances and acid productive, draw within the panels, outputs delivered, caps exact, machines stopped, rocket-fuel entrance stopped, ring below 90%, and wiring and power.

## Reproduce

```
npm ci
node scripts/rocket-supplies/generate.mjs           # writes blueprint-sources/rocket-supplies (needs FACTORIO_RAW or the pinned dump)
node scripts/rocket-supplies/validate.mjs           # full protocol, about 20 s wall time; rewrites native-report.json
node scripts/rocket-supplies/above-panels.mjs       # eight full-length runs above the panels (exploration); rewrites above-panels.json
node scripts/rocket-supplies/generate.mjs           # sets status "qualified" and "measured" from the passing report
node --test tests/rocket-supplies.test.mjs
```

Exploration never touches `native-report.json`. `RS_OPTIONS='{"variant":"ring-all"}' scripts/rocket-supplies/screen.sh` generates into `.cache/rocket-supplies/candidate` and runs the protocol with `SPACE_EXPLORE=1`. `RS_SATURATE=1` saturates the entrances, `RS_FEED='{"electronic-circuit":220}'` feeds the named entrances at other figures, `RS_REPORT=<file>` writes the exploration report elsewhere, and `RS_WARMUP=10 RS_MEASURE=10 RS_BLOCKED=0 ...` shorten the phases. `node scripts/rocket-supplies/summary.mjs <report>` prints per-machine crafts and waits, ring stock and entrance draw. `node scripts/rocket-supplies/ascii.mjs [folder]` draws a string.

## Tried and rejected

All five layouts passed the full-length protocol at the same supply figures, and the smallest is published. The three single-row layouts are kept in `history/`, each with its string, manifest, full-protocol report and a note.

| Layout | Size | Result | Why not published |
| --- | --- | --- | --- |
| `inner-row` | 30 x 8 = 240 | qualified: 5.03 / 5.00 / 5.00 steady (processing units, low density structures, rocket fuel); processing-unit recovery 4.90 | the spec's layout, with direct hand-offs so cable and advanced circuits never touch a belt; four gap columns and two near-empty rows above the ring |
| `ring-ac` | 28 x 8 = 224 | qualified: 5.00 each | advanced circuits on the ring; still has two cable gaps |
| `ring-all` | 26 x 8 = 208 | qualified: 5.00 / 5.03 / 5.00 | no gaps, one row inside the ring; the two rows above the ring are still mostly empty |
| `two-rows` | 15 x 12 = 180 | passed a full-length exploration run | superseded by `two-rows-tight` (ring east column moved in by one) |
| **`two-rows-tight`** | **14 x 12 = 168** | **qualified (published)** | |
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
