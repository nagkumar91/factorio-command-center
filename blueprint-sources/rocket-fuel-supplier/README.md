# Rocket-fuel supplier · 6/min

**Qualified** in Factorio 2.1.24 Space Age for the exact string in `rocket-fuel-supplier.txt` (SHA-256 `32d9a8e9718cc3436ff3461db1ad64a61b44642e1929ee6b69e83ef574914705`), full rate-class protocol, light oil throttled to the panel figure. Report: `native-report.json`.

Makes 6 rocket fuel a minute from piped light oil only and puts it on one red belt exit. Solid fuel is made inside from light oil and handed machine to machine; it is not a product and has no exit. It is the only rocket-fuel source for `rocket-supplies`, which takes rocket fuel on its northernmost entrance.

This is the 7 x 7 layout of the design review of 11-21. It replaces the 7 x 8 layout (`history/ell-seven-by-eight-5e86373d`) in place: same product, rate, cap, machines, input and sides, seven fewer tiles.

## Size and machines

- Footprint 7 x 7 = 49 tiles (was 7 x 8 = 56; goal 78, stretch 66, fallback 110).
- One chemical plant (`solid-fuel-from-light-oil`, 1 s, 10 light oil gives 1; 60 a minute at speed 1) and two assembling machine 2 (`rocket-fuel`, 15 s, 10 solid fuel + 10 light oil gives 1; 3 a minute each at speed 0.75). Every machine runs at its top speed at the target. No modules, no beacons.
- 4 fast inserters, 4 fast transport belts, 2 fast underground belts, 3 pipes, 2 pipes-to-ground, 1 substation, 1 display panel, 2 red wires: 20 entities.

```
   x 0123456
 y0  CCCSSv<      C  chemical plant (solid fuel, faces south)    S  substation
 y1  CCCSSni      F  east rocket-fuel machine (rows 2..4, faces west)
 y2  CCCiFFF      R  south rocket-fuel machine (x 1..3, faces west)
 y3  #uiuFFF      #  light-oil entrance pipe (west edge, row 3)   =  pipe   u  pipe-to-ground pair (1,3) -> (3,3)
 y4  =RRRFFF      i  fast arms: (3,2) and (2,3) hand solid fuel to F and R; (6,1) and (4,6) take rocket fuel out
 y5  =RRR.n.      v < >  belts; n  underground belt pair (5,1) -> (5,5), under the east machine
 y6  pRRRi>E      E  exit (bottom row, east edge); p  light-oil panel
```

## Entrance (west)

| Material | Entrance | Panel figure (supply to plan for) | Recipe demand | Measured draw (30 min steady) |
| --- | --- | ---: | ---: | ---: |
| light-oil | pipe, row 3 (middle of the west side) | 660/min | 660/min (600 for solid fuel + 60 for rocket fuel) | 660/min |

The panel states the recipe demand itself: the full protocol passed with light oil throttled to exactly 660/min. One entrance feeds all three machines: the entrance pipe touches the chemical plant's south-west input, two more pipes run down the west column to the south machine's west input, and a pipe-to-ground pair passes under the south hand-off arm and opens straight into the east machine's west input. The native report shows all three on the entrance's fluid segment and all three crafting. Extra light oil simply stays in the pipe (a saturated run drew 660/min).

## Output

One `fast-transport-belt` exit on the bottom row (row 6 from the top) at the east edge, `direction` east, fed straight from behind. Cap 8 (`stockControl.mode = "belt-exit"`).

- Lanes: each rocket-fuel machine fills one lane, and both lanes reach the exit tile from behind. The east machine's arm `(6,1)` takes fuel out on that machine's north side and drops it on a west-running belt `(6,0)` from the south, which the game fills on the far (right) lane; the belt turns south at `(5,0)`, runs under the machine in an underground belt `(5,1)` to `(5,5)` and turns east into the corner tile `(5,6)`, where the right lane is the south lane. The south machine's arm `(4,6)` drops onto that corner tile from the west, which the game fills on the inner (north) lane. The lane rules were measured natively (`scripts/concrete-supplier/probes/lanes.lua`: "north" `[0,4]`, "curve" `[4,0]`), and the native report shows 4 + 4 on the exit tile.
- Gate: the exit tile reads its contents in hold mode and a red wire carries that count to the two solid-fuel hand-off arms, which run only while `rocket-fuel < 8`. When the consumer stops, the exit fills to 4 + 4, the arms stop, and the rocket-fuel machines stop on ingredient shortage after about a minute and a half (88 s and 87 s of crafting into the blocked phase) with nothing left in their output slots; when fuel is taken again everything restarts by itself. The harness checks this wiring natively (`gateWiringChecked`).
- Why the gate (measured in this layout): **it is needed to pass.** Without it the east machine first fills its whole buried lane and only then its output slot: it kept crafting for 828 s of a 20-minute blocked phase and stopped holding 4 rocket fuel, and a 10-minute blocked phase fails because that machine is still crafting in the last minute (review run with the gate and wires removed, SHA `8bf568bf...`).

## Linking to rocket supplies

- `supplierLinks: [{consumer: "rocket-supplies", item: "rocket-fuel", exitRowFromTop: 6, perMinute: 6}]`.
- Place this supplier west of rocket supplies with its top row `entranceRowFromTop - 6` rows below the consumer's top row (the rocket-fuel entrance is its northernmost entrance, row 0, so the supplier's top row is 6 rows above the consumer's), any distance west, and join the exit to the entrance with a straight red belt. The supplier then lies entirely at or north of that row and covers no other entrance's approach.
- Copies: **one**. Rocket supplies plans its rocket-fuel entrance at 5/min (its panel; one rocket every 10 minutes); one copy delivers 6/min. The campaign is five launches and needs 250 rocket fuel: about 42 minutes of this supplier.

## Bill of materials

1 chemical plant, 2 assembling machine 2, 4 fast inserters, 4 fast transport belts, 2 fast underground belts, 3 pipes, 2 pipes-to-ground, 1 substation, 1 display panel (`manifest.billOfMaterials.items`; no tiles), plus 2 red circuit wires.

## What to preserve

- The red wire from the exit tile (read contents, hold mode) to the two solid-fuel arms and their condition `rocket-fuel < 8`. Without it a blocked consumer leaves the east machine crafting for about 14 minutes while it fills the buried belt.
- Which arm drops where: the east machine's arm onto the row-0 belt from the south, the south machine's arm onto the corner tile behind the exit from the west. Do not move an arm onto the exit tile itself: an arm dropping on a blocked belt tile fills only 3 of that lane's 4 places, and the exit would hold 7 (`history/seven-square-substation-exit-holds-seven`).
- The underground belt pair `(5,1)` to `(5,5)` and the two belts that feed it on row 0. Nothing may drop on or side-load the two underground ends.
- Both rocket-fuel machines face west (their light-oil inputs are their west sides); the chemical plant faces south; the pipe-to-ground pair passes under the south hand-off arm.
- The exit is a straight tile fed from behind; nothing may side-load it.

## Measured (native report, full protocol)

- Steady (30 min): 6.0 rocket fuel/min; recovery (10 min): 6.0/min. Target 6, pass floor 5.7.
- Crafts in the 30-minute window: 90 and 90 rocket fuel (each machine's maximum) and 1,800 solid fuel; every machine `working` in all 1,800 one-second samples.
- Blocked (10 min, light oil still fed): exit tile 8 (4 + 4) and never more; the solid-fuel arms switched off on the circuit condition; the rocket-fuel machines stopped on ingredient shortage after 88 s and 87 s, the chemical plant on a full output slot (50 solid fuel); no machine completed a craft in the last minute.
- Light-oil draw while measuring: 660/min.

Protocol run: warm-up 15 min, steady 30 min, blocked 10 min, settle 5 min, recovery 10 min (`manifest.protocol`); light oil inserted at perMinute/3600 per tick plus the refused carry, capped at one second (CONTRACT section 11 item 4); power through one energy interface on the substation's network; nothing seeded; rocket fuel collected from the exit every 4 ticks except while blocked. The protocol, harness and validator are the ones that qualified the 7 x 8 layout, unchanged.

Extra behaviour runs on this string (exploration, not part of the qualification): saturated light oil (draw stays 660/min, same results); a 120-minute blocked phase (exit stays at 8, 6.0/min again after the 5-minute settle); a consumer taking 5/min (delivers 5.0/min) and one taking 1/min (delivers 1.0/min, exit never above 8); a consumer taking one lane only for an hour (that lane's machine delivers 3/min; the other machine fills its lane and stops on a full output holding 3 rocket fuel, and the supplier delivers 6.0/min again once both lanes are taken). No jam, no overflow, no starving machine. With a consumer that leaves the south lane untaken, about 20 rocket fuel wait on the east machine's belts.

## Reproduce

From `factorio-command-center/`:

```
node scripts/rocket-fuel-supplier/generate.mjs        # writes rocket-fuel-supplier.txt and manifest.json (byte-identical on re-run)
node scripts/rocket-fuel-supplier/validate.mjs        # full protocol, writes native-report.json (about 10 s)
node scripts/rocket-fuel-supplier/generate.mjs        # picks up status "qualified" and the measured block
node --test tests/rocket-fuel-supplier.test.mjs
```

Exploration: `SPACE_EXPLORE=1` (short phases, `SUPPLIER_SATURATE=1` for saturated feed) writes `.cache/rocket-fuel-supplier/explore-report.json` and never touches the published report. Variants: `--variant seven-square-buried|ell|staggered|seven-square|seven-square-substation`, `--supply nominal|margin`, `--out <folder>` with `SUPPLIER_SOURCE=<folder>` for the validator. Needs the pinned prototype dump (`FACTORIO_RAW`) and the Steam Factorio 2.1.24 binary; runs headless with a private config and mod folder under `.cache/rocket-fuel-supplier/`.

The chemical plant's light-oil input was checked natively rather than assumed (`scripts/concrete-supplier/probes/fluidsides.lua`): either input corner on the side it faces takes light oil for `solid-fuel-from-light-oil`, in every direction; an assembling machine 2 takes light oil on the side it faces.

## Why 7 x 7 and not smaller (`scripts/rocket-fuel-supplier/layout-search.mjs`)

The three machines, four arms, substation, panel, entrance pipe and exit tile need 38 tiles. The search script places the machines, arms, substation, belts and pipes in every possible way in a given rectangle (fast or long-handed arms, up to three pipe-to-ground pairs, up to two idle belt tiles, underground belts entered from behind; lane rules from the native lane probe; splitters not modelled) and keeps the layouts whose exit tile is fed on both lanes from behind. Run on all 65 rectangles of 53 tiles or fewer on 11-21:

- Without underground belts: none, in any rectangle.
- With underground belts: this layout, in 7 x 7 only. (Allowing an arm to drop on the outer side of a curve, which has not been measured, adds only a mirror image of it with the plant in the south-west, also 7 x 7.) Nothing in 8 x 6 or 6 x 8 (48 tiles), 13 x 4 (52) or any thinner rectangle; rectangles 5 wide or 5 tall cannot hold the three machines with their hand-off arms at all.

```
node scripts/rocket-fuel-supplier/layout-search.mjs 7x7                          # found 0
node scripts/rocket-fuel-supplier/layout-search.mjs 7x7 --underground-belts      # found 1: the published layout
node scripts/rocket-fuel-supplier/layout-search.mjs 8x6 --underground-belts --long-arms --three-pipe-pairs --outer-curve-drops   # found 0
```

## Tried and rejected (`history/`)

- `ell-seven-by-eight-5e86373d`: 7 x 8 = 56 tiles, a light-oil pipe along row 0; published until 11-21, qualified, superseded by this layout as 7 tiles larger.
- `seven-square-substation-exit-holds-seven`: 7 x 7 with a substation but without the underground belt; the east machine's arm drops straight onto the exit tile, which then holds 7 (4 + 3) when blocked, not 8 (full protocol passed with the cap declared as 7, SHA-256 `3911d283...`). Rejected: it changes the cap. It is the native evidence for the direct-drop rule above.
- `seven-square-medium-pole`: 7 x 7 (from the review of `926ac81b7`); full protocol passed at 660/min (SHA-256 `af139f3a...`), but it has no room for a substation and is powered by one medium electric pole, which the contract and the user's substation rule do not allow. Superseded: this layout is 7 x 7 with a substation.
- `staggered-margin-supply`: 11 x 6 = 66 tiles, close to the spec's one-row proposal (long-handed arm and stub side-load for the second lane), panel 693/min; qualified, superseded.
- `staggered`: the same at 660/min; qualified, rejected as larger.
- The spec's own one-row sketch with both output arms dropping onto the exit row from the north was not built: both arms would fill the same lane and the exit would hold 4, not 8 (lane probe).

## Review notes

Design review of 11-21 (this version):

- The 7 x 8 string was re-checked first: the generator reproduced SHA-256 `5e86373d...` byte for byte, the full protocol passed again on a copy with the same numbers (6.0 / 6.0, 90 + 90 + 1,800 crafts, exit 8 = 4 + 4, draw 660/min), its published figures agreed with the report, and the extra behaviour runs (saturated supply, 120 minutes blocked, 5/min, 1/min and one-lane consumers) found no defect.
- Size: the 7 x 8 layout spent a whole row on the light-oil pipe. Moving the pipe into the arm row leaves 7 x 7, but then the east machine's arm cannot reach the tile behind the exit, and dropping it on the exit tile gives 7, not 8 (measured). Taking that machine's fuel out on its north side and bringing it round under the machine in an underground belt fixes it. Full protocol passed for the new string with the same harness and validator: 6.0 / 6.0, 90 + 90 + 1,800 crafts, exit 8 = 4 + 4, machines stopped after 88 s and 87 s.
- The gate's stated reason was measured again for this layout (it differs from the 7 x 8 layout, where the gate only made the stop faster).

Review of `926ac81b7` (7 x 8 layout; two must-fix items, both applied then):

- The blueprint description named long-handed inserters the layout did not have; the generator names the inserters the variant actually uses.
- The stated reason for the exit gate (a machine fills its output to 20) was measured on a bare machine and was not true for the built layout; the reason given is now always the one measured in the layout it describes. `scripts/concrete-supplier/probes/README.md` says its output limits are for a bare machine with no output arm.
