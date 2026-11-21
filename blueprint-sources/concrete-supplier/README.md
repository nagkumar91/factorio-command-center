# Concrete supplier · 45/min

**Qualified** in Factorio 2.1.24 Space Age for the exact string in `concrete-supplier.txt` (SHA-256 `449f804ab8030a03609676db13c1b320551db240776069ee99cb546abbe5afe2`), full rate-class protocol, entrances throttled to the panel figures. Report: `native-report.json`.

Makes 45 concrete a minute from stone bricks, iron ore and piped water and puts it on one red belt exit. It is the only concrete source for the space-launch kit (`launch-kit`), which takes concrete on its northernmost entrance.

## Size and machines

- Footprint 7 x 5 = 35 tiles (goal 40, stretch 36, fallback 60), variant `seven-by-five`.
- One assembling machine 2 (`concrete`, 10 s, 5 stone brick + 1 iron ore + 100 water gives 10; 4.5 crafts a minute at speed 0.75). No modules, no beacons.
- 4 fast inserters, 8 fast transport belts, 2 pipes, 1 substation, 3 display panels. No wires, no combinators, no chests.

```
   x 0123456
 y0  >iMMM..     >  stone brick (y0) and iron ore (y2) entrance belts; ==  water entrance pipe (y1)
 y1  ==MMM..     M  the concrete machine (x 2..4, y 0..2), facing west
 y2  >iMMMiv     i  fast arms; > v <  belts; E  exit (bottom row, east edge)
 y3  ppSSiv<     p  entrance panels: stone brick (0,3), water (1,3), iron ore (0,4)
 y4  p.SS>>E     S  substation (x 2..3, y 3..4)
```

## Entrances (all west)

| Material | Entrance | Panel figure (supply to plan for) | Recipe demand | Measured draw (30 min steady) |
| --- | --- | ---: | ---: | ---: |
| stone-brick | belt, row 0 | 22.5/min | 22.5/min | 22.5/min |
| water | pipe, row 1 | 450/min | 450/min | 450/min |
| iron-ore | belt, row 2 | 4.5/min | 4.5/min | 4.5/min |

The panels state the recipe demand itself: the full protocol passed with every entrance throttled to exactly that figure (the contract's starting figures 24 / 473 / 4.8 also passed; see history). Either belt may carry its item on either lane. Feeding more is harmless: the surplus backs up on the entrance stubs and in the pipe.

## Output

One `fast-transport-belt` exit on the bottom row (row 4 from the top) at the east edge, `direction` east, fed straight from behind. Cap 8 (`stockControl.mode = "belt-exit"`): when the consumer stops taking concrete the exit tile fills to 4 + 4 and the machine stops on a full output slot by itself; it restarts as soon as concrete is taken again.

Both lanes are filled by design, because a tile fed from behind holds 8 only when both lanes are full. Two fast arms take concrete out of the machine:

- the lower arm `(4,3)`, under the machine, drops from the north onto `(4,4)`, an east-running belt of the exit row; the game puts those items on the right (south) lane;
- the east arm `(5,2)` drops onto `(6,2)`, which runs south to `(6,3)`, west to `(5,3)` and south again, side-loading `(5,4)` from the north, so its items go on the north lane. `(5,4)` is fed from behind by `(4,4)` and feeds the exit `(6,4)` from behind.

Both rules were measured natively before the design was built (`scripts/concrete-supplier/probes/lanes.lua`, result `probes/results/lanes.json`: "north" `[0,4]`, side-load `[4,4]`).

## Linking to the launch kit

- `supplierLinks: [{consumer: "launch-kit", item: "concrete", exitRowFromTop: 4, perMinute: 45}]`.
- Place this supplier west of the kit with its top row `entranceRowFromTop - 4` rows below the kit's top row (the kit's concrete entrance is its northernmost entrance), any distance west, and join the exit to the entrance with a straight red belt. The supplier then lies entirely at or north of the kit's concrete row and covers no other entrance's approach.
- Copies: **one**. The kit's concrete entrance panel is 23/min and one whole kit needs 1,200 concrete (1,000 for the rocket silo, 200 for the cargo landing pad); one copy delivers 45/min, so a kit's concrete takes about 27 minutes of this supplier's output.

## Bill of materials

1 assembling machine 2, 4 fast inserters, 8 fast transport belts, 2 pipes, 1 substation, 3 display panels (`manifest.billOfMaterials.items`; no tiles).

## What to preserve

- The machine faces west: its water input is the west side, against the entrance pipe.
- The two output arms and the belt shapes south and east of the machine: one arm per lane of the exit. Dropping both onto the exit row, or straightening the stub so it no longer side-loads `(5,4)`, puts both arms on one lane and the exit then holds only 4.
- The exit is a straight tile fed from behind; nothing may side-load it.
- The input arms carry a one-item whitelist (stone brick, iron ore).

## Measured (native report, full protocol)

- Steady (30 min): 45.0 concrete/min; recovery (10 min): 45.0/min. Target 45, pass floor 42.75.
- The machine made 135 crafts in the 30-minute window (its maximum) and was `working` in all 1,800 one-second samples.
- Blocked (5 min, entrances still fed): exit tile 8 (4 + 4) and never more; the machine stopped on `full_output` after about 73 seconds with 30 concrete in its output slot and completed no craft in the last minute.
- Entrance draw while measuring: stone brick 22.5, iron ore 4.5, water 450 per minute; every entrance reached the machine that crafted with it.

Protocol run: warm-up 15 min, steady 30 min, blocked 5 min, settle 5 min, recovery 10 min (`manifest.protocol`); entrances throttled as CONTRACT section 11 item 4 (belt credit of perMinute/3600 per tick capped at 8, alternating lanes; fluid perMinute/3600 per tick plus the refused carry, capped at one second); power through one energy interface on the substation's network; nothing seeded; concrete collected from the exit every 4 ticks except while blocked.

## Reproduce

From `factorio-command-center/`:

```
node scripts/concrete-supplier/generate.mjs          # writes concrete-supplier.txt and manifest.json (byte-identical on re-run)
node scripts/concrete-supplier/validate.mjs          # full protocol, writes native-report.json (about 10 s)
node scripts/concrete-supplier/generate.mjs          # picks up status "qualified" and the measured block
node --test tests/concrete-supplier.test.mjs
```

Exploration: `SPACE_EXPLORE=1` (short phases, `SUPPLIER_SATURATE=1` for saturated feed) writes `.cache/concrete-supplier/explore-report.json` and never touches the published report. Variants: `--variant seven-by-five|four-row|five-row`, `--supply nominal|margin`, `--out <folder>` with `SUPPLIER_SOURCE=<folder>` for the validator. Needs the pinned prototype dump (`FACTORIO_RAW`) and the Steam Factorio 2.1.24 binary; runs headless with a private config and mod folder under `.cache/concrete-supplier/`.

## Tried and rejected (`history/`)

- `four-row`: 9 x 4 = 36 tiles, published in `926ac81b7`; qualified, superseded by `seven-by-five` (one tile smaller, one more belt).
- `four-row-margin-supply`: the four-row layout with the panels at the starting figures 24 / 473 / 4.8; qualified, superseded by the lower figures.
- `five-row`: 8 x 5 = 40 tiles (exit row under an arm row, second lane by a stub side-load); qualified, rejected as larger. `seven-by-five` is this layout with the stub folded back west.
- No 8 x 4 layout was found: with the measured lane rules, two arms on the column east of the machine cannot fill both lanes of a tile that then feeds the exit from behind (the reviewer reached the same result).

## Review notes

- Review of `926ac81b7`: no must-fix for this blueprint. Its size idea (7 x 5 = 35, the five-row layout with the stub folded back west) was adopted: the full protocol passed for SHA-256 `449f804a...` at 22.5 / 4.5 / 450, the same string the reviewer measured.
