# Rocket-fuel supplier · 6/min

**Qualified** in Factorio 2.1.24 Space Age for the exact string in `rocket-fuel-supplier.txt` (SHA-256 `5e86373d041a07540f2b52e3beba12326c760d45920d515e989377cabcdf79fb`), full rate-class protocol, light oil throttled to the panel figure. Report: `native-report.json`.

Makes 6 rocket fuel a minute from piped light oil only and puts it on one red belt exit. Solid fuel is made inside from light oil and handed machine to machine; it is not a product and has no exit. It is the only rocket-fuel source for `rocket-supplies`, which takes rocket fuel on its northernmost entrance.

## Size and machines

- Footprint 7 x 8 = 56 tiles (goal 78, stretch 66, fallback 110).
- One chemical plant (`solid-fuel-from-light-oil`, 1 s, 10 light oil gives 1; 60 a minute at speed 1) and two assembling machine 2 (`rocket-fuel`, 15 s, 10 solid fuel + 10 light oil gives 1; 3 a minute each at speed 0.75). Every machine runs at its top speed at the target. No modules, no beacons.
- 4 fast inserters, 5 fast transport belts, 7 pipes, 2 pipes-to-ground, 1 substation, 1 display panel, 2 red wires.

```
   x 0123456
 y0  ======.      =  light-oil pipe; its west end (0,0) is the entrance and the chemical plant's input
 y1  CCCuFFF      C  chemical plant (solid fuel), F  north rocket-fuel machine (input from the pipe above)
 y2  CCCiFFF      u  pipe-to-ground pair (3,1) -> (3,5) under the hand-off arm, then pipe (3,6)
 y3  CCC.FFF      R  south rocket-fuel machine, facing east (input from the pipe at (3,6))
 y4  p.i.iSS      i  fast arms: (3,2) and (2,4) hand solid fuel to F and R; (4,4) and (3,7) take rocket fuel out
 y5  RRRuvSS      v > belts; E  exit (bottom row, east edge); S  substation; p  light-oil panel
 y6  RRR=v..
 y7  RRRi>>E
```

## Entrance (west)

| Material | Entrance | Panel figure (supply to plan for) | Recipe demand | Measured draw (30 min steady) |
| --- | --- | ---: | ---: | ---: |
| light-oil | pipe, row 0 (top-left) | 660/min | 660/min (600 for solid fuel + 60 for rocket fuel) | 660/min |

The panel states the recipe demand itself: the full protocol passed with light oil throttled to exactly 660/min (the contract's starting figure 693/min also passed; see history). One entrance feeds all three machines; the native report shows all three on the entrance's fluid segment and all three crafting.

## Output

One `fast-transport-belt` exit on the bottom row (row 7 from the top) at the east edge, `direction` east, fed straight from behind. Cap 8 (`stockControl.mode = "belt-exit"`).

- Lanes: each rocket-fuel machine fills one lane. The north machine's arm `(4,4)` drops onto a south-running column from the north, which the game fills on its right lane; at the corner `(4,7)` that becomes the exit's south lane. The south machine's arm `(3,7)` drops onto the corner tile from the west, which the game fills on the north lane. Both rules were measured natively (`scripts/concrete-supplier/probes/lanes.lua`: "away" `[0,4]`, "curve" `[4,0]`).
- Gate: the exit tile reads its contents in hold mode and a red wire carries that count to the two solid-fuel hand-off arms, which run only while `rocket-fuel < 8`. When the consumer stops, the exit fills to 4 + 4, the arms stop, and the rocket-fuel machines stop on ingredient shortage after about two minutes (128 s and 115 s of crafting into the blocked phase) with nothing left in their output slots; when fuel is taken again everything restarts by itself. The harness checks this wiring natively (`gateWiringChecked`).
- Why the gate (measured in this layout): without it the layout still passes, but the rocket-fuel machines keep crafting into their output slots and stop on a full output holding 4 rocket fuel each only after 295 s and 468 s, 72 s before the last minute of the 10-minute blocked phase (review run with the gate and wires removed, SHA `553f26a8...`, also with 20 minutes blocked). The gate gives a stop about four times faster and leaves no fuel in the machines. (The probe's figure of 20 in the output, `probes/results/lanes.json` `amFuel`, is for a bare machine with no output arm and does not apply here.)

## Linking to rocket supplies

- `supplierLinks: [{consumer: "rocket-supplies", item: "rocket-fuel", exitRowFromTop: 7, perMinute: 6}]`.
- Place this supplier west of rocket supplies with its top row `entranceRowFromTop - 7` rows below the consumer's top row (the rocket-fuel entrance is its northernmost entrance), any distance west, and join the exit to the entrance with a straight red belt. The supplier then lies entirely at or north of that row and covers no other entrance's approach.
- Copies: **one**. Rocket supplies plans its rocket-fuel entrance at 5/min (its panel; one rocket every 10 minutes); one copy delivers 6/min. The campaign is five launches and needs 250 rocket fuel: about 42 minutes of this supplier.

## Bill of materials

1 chemical plant, 2 assembling machine 2, 4 fast inserters, 5 fast transport belts, 7 pipes, 2 pipes-to-ground, 1 substation, 1 display panel (`manifest.billOfMaterials.items`; no tiles), plus 2 red circuit wires.

## What to preserve

- The red wire from the exit tile (read contents, hold mode) to the two solid-fuel arms and their condition `rocket-fuel < 8`. Without it a blocked consumer leaves the rocket-fuel machines crafting for about 5 and 8 minutes until each holds 4 rocket fuel, instead of stopping after about 2 minutes with empty outputs.
- Which arm drops where: the north machine's arm onto the column, the south machine's arm onto the corner. Swapping them or moving both onto the column puts both machines on one lane and the exit then holds only 4.
- The south rocket-fuel machine faces east (its fluid input is its east side, against the pipe at (3,6)); the pipe-to-ground pair passes under the east hand-off arm.
- The exit is a straight tile fed from behind; nothing may side-load it.

## Measured (native report, full protocol)

- Steady (30 min): 6.0 rocket fuel/min; recovery (10 min): 6.0/min. Target 6, pass floor 5.7.
- Crafts in the 30-minute window: 90 and 90 rocket fuel (each machine's maximum) and 1,800 solid fuel; every machine `working` in all 1,800 one-second samples.
- Blocked (10 min, light oil still fed): exit tile 8 (4 + 4) and never more; the solid-fuel arms switched off on the circuit condition; the rocket-fuel machines stopped on ingredient shortage after about two minutes, the chemical plant on a full output slot (50 solid fuel); no machine completed a craft in the last minute.
- Light-oil draw while measuring: 660/min.

Protocol run: warm-up 15 min, steady 30 min, blocked 10 min, settle 5 min, recovery 10 min (`manifest.protocol`); light oil inserted at perMinute/3600 per tick plus the refused carry, capped at one second (CONTRACT section 11 item 4); power through one energy interface on the substation's network; nothing seeded; rocket fuel collected from the exit every 4 ticks except while blocked.

## Reproduce

From `factorio-command-center/`:

```
node scripts/rocket-fuel-supplier/generate.mjs        # writes rocket-fuel-supplier.txt and manifest.json (byte-identical on re-run)
node scripts/rocket-fuel-supplier/validate.mjs        # full protocol, writes native-report.json (about 10 s)
node scripts/rocket-fuel-supplier/generate.mjs        # picks up status "qualified" and the measured block
node --test tests/rocket-fuel-supplier.test.mjs
```

Exploration: `SPACE_EXPLORE=1` (short phases, `SUPPLIER_SATURATE=1` for saturated feed) writes `.cache/rocket-fuel-supplier/explore-report.json` and never touches the published report. Variants: `--variant ell|staggered|seven-square`, `--supply nominal|margin`, `--out <folder>` with `SUPPLIER_SOURCE=<folder>` for the validator. Needs the pinned prototype dump (`FACTORIO_RAW`) and the Steam Factorio 2.1.24 binary; runs headless with a private config and mod folder under `.cache/rocket-fuel-supplier/`.

The chemical plant's light-oil input was checked natively rather than assumed (`scripts/concrete-supplier/probes/fluidsides.lua`): either north corner input takes light oil for `solid-fuel-from-light-oil`, in every direction.

## Tried and rejected (`history/`)

- `staggered-margin-supply`: 11 x 6 = 66 tiles, close to the spec's one-row proposal (long-handed arm and stub side-load for the second lane), panel 693/min; qualified, superseded.
- `staggered`: the same at 660/min; qualified, rejected because `ell` is 10 tiles smaller.
- The spec's own one-row sketch with both output arms dropping onto the exit row from the north was not built: both arms would fill the same lane and the exit would hold 4, not 8 (lane probe).
- `seven-square-medium-pole`: 7 x 7 = 49 tiles (from the review of `926ac81b7`); full protocol passed at 660/min (SHA-256 `af139f3a...`), but it has no room for a substation and is powered by one medium electric pole, which the contract and the user's substation rule do not allow. **Waiting for the user's decision**; see its NOTE.md for how to adopt it.

## Review notes

Review of `926ac81b7` (two must-fix items, both applied):

- The blueprint description said "fast and long-handed inserters"; this layout has only fast inserters. The generator now names the inserters the variant actually uses, and its header comment describes the `ell` layout. The string changed, so the full protocol was re-run: SHA-256 `5e86373d...`, passed with the same numbers as before (6.0 / 6.0, 90 + 90 + 1,800 crafts, exit 8 = 4 + 4, machines stopped after about 2 minutes).
- The stated reason for the exit gate (a machine fills its output to 20) was measured on a bare machine and is not true here. The gate is kept, as the reviewer preferred, and its reason in `manifest.stockControl.gate.why`, this README and the generator now gives the numbers measured in this layout. `scripts/concrete-supplier/probes/README.md` now says its output limits are for a bare machine with no output arm.
- Size idea 7 x 7 = 49: not adopted (needs a substation exception from the user); kept in `history/seven-square-medium-pole/` with its own passing report.
