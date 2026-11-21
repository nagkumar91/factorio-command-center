# Concrete supplier · 45/min

**Qualified** in Factorio 2.1.24 Space Age for the exact string in `concrete-supplier.txt` (SHA-256 `3550a2f8d2615e7f396eb5948d8a7a7f3447ad3e55ae597a872cc08558419336`), full rate-class protocol, entrances throttled to the panel figures. Report: `native-report.json`.

Makes 45 concrete a minute from stone bricks, iron ore and piped water and puts it on one red belt exit. It is the only concrete source for the space-launch kit (`launch-kit`), which takes concrete on its northernmost entrance.

## Size and machines

- Footprint 5 x 6 = 30 tiles (goal 40, stretch 36, fallback 60), variant `five-by-six`. The version before it was 7 x 5 = 35 (`history/seven-by-five-449f804a`).
- One assembling machine 2 (`concrete`, 10 s, 5 stone brick + 1 iron ore + 100 water gives 10; 4.5 crafts a minute at speed 0.75). No modules, no beacons.
- 3 fast inserters, 1 long-handed inserter, 6 fast transport belts, 2 pipes, 1 substation, 3 display panels. No wires, no combinators, no chests.

```
   x 01234
 y0  >iMMM     >  stone brick (y0) and iron ore (y2) entrance belts; ==  water entrance pipe (y1)
 y1  ==MMM     M  the concrete machine (x 2..4, y 0..2), facing west
 y2  >iMMM     i  fast arms; L  the long-handed arm; > v  belts; E  exit (bottom row, east edge)
 y3  ppLi.     p  entrance panels: stone brick (0,3), water (1,3), iron ore (2,4)
 y4  SSpv.     S  substation (x 0..1, y 4..5)
 y5  SS>>E     .  empty
```

## Entrances (all west)

| Material | Entrance | Panel figure (supply to plan for) | Recipe demand | Measured draw (30 min steady) |
| --- | --- | ---: | ---: | ---: |
| stone-brick | belt, row 0 | 22.5/min | 22.5/min | 22.5/min |
| water | pipe, row 1 | 450/min | 450/min | 450/min |
| iron-ore | belt, row 2 | 4.5/min | 4.5/min | 4.5/min |

The entrances are where they were in the 7 x 5 version (rows 0, 1 and 2 of the west edge). The panels state the recipe demand itself: the full protocol passed with every entrance throttled to exactly that figure. Either belt may carry its item on either lane. Feeding more is harmless: the surplus backs up on the entrance stubs and in the pipe (measured with saturated entrances: 45.0 a minute, exit 8 when blocked).

## Output

One `fast-transport-belt` exit on the bottom row (row 5 from the top) at the east edge, `direction` east, fed straight from behind. Cap 8 (`stockControl.mode = "belt-exit"`): when the consumer stops taking concrete the exit tile fills to 4 + 4 and the machine stops on a full output slot by itself; it restarts as soon as concrete is taken again.

Both lanes are filled by design, because a tile fed from behind holds 8 only when both lanes are full. Two arms under the machine take concrete out of it:

- the long-handed arm `(2,3)` picks from the machine's middle row, swings over the iron-ore panel at `(2,4)` and drops from the north onto `(2,5)`, the first east-running belt of the exit row; the game puts those items on the right (south) lane;
- the fast arm `(3,3)` drops onto `(3,4)`, which runs south and side-loads `(3,5)` from the north, so its items go on the north lane. `(3,5)` is fed from behind by `(2,5)` and feeds the exit `(4,5)` from behind.

Both rules were measured natively (`scripts/concrete-supplier/probes/reach.lua`, result `probes/results/reach.json`: `longNorth` `[0,4]`, `fiveBySixPair` `[4,4]`; the fast-arm rules are in `probes/lanes.lua`).

## Linking to the launch kit

- `supplierLinks: [{consumer: "launch-kit", item: "concrete", exitRowFromTop: 5, perMinute: 45}]`.
- Place this supplier west of the kit with its top row `entranceRowFromTop - 5` rows below the kit's top row (the kit's concrete entrance is its northernmost entrance, so in practice 5 rows above the kit's top row), any distance west, and join the exit to the entrance with a straight red belt. The supplier then lies entirely at or north of the kit's concrete row and covers no other entrance's approach.
- Replacing a built 7 x 5 copy: with the entrances left where they are, the exit is now one row lower and two columns further west (it was on row 4, column 6; it is on row 5, column 4).
- Copies: **one**. The kit's concrete entrance panel is 23/min and one whole kit needs 1,200 concrete (1,000 for the rocket silo, 200 for the cargo landing pad); one copy delivers 45/min, so a kit's concrete takes about 27 minutes of this supplier's output.

## Bill of materials

1 assembling machine 2, 3 fast inserters, 1 long-handed inserter, 6 fast transport belts, 2 pipes, 1 substation, 3 display panels (`manifest.billOfMaterials.items`; no tiles).

## What to preserve

- The machine faces west: its water input is the west side, against the entrance pipe.
- The two output arms and the three belts under them: one arm per lane of the exit. The long-handed arm must stay long-handed (a fast arm there would drop on the panel tile), and the stub `(3,4)` must keep running south into `(3,5)`; with both arms on one lane the exit holds only 4.
- The exit is a straight tile fed from behind; nothing may side-load it.
- The input arms carry a one-item whitelist (stone brick, iron ore).

## Measured (native report, full protocol)

- Steady (30 min): 45.0 concrete/min; recovery (10 min): 45.0/min. Target 45, pass floor 42.75.
- The machine made 135 crafts in the 30-minute window (its maximum) and was `working` in all 1,800 one-second samples.
- Blocked (5 min, entrances still fed): exit tile 8 (4 + 4) and never more; the machine stopped on `full_output` after about 73 seconds with 36 concrete in its output slot and completed no craft in the last minute.
- Entrance draw while measuring: stone brick 22.5, iron ore 4.5, water 450 per minute; every entrance reached the machine that crafted with it.

Protocol run: warm-up 15 min, steady 30 min, blocked 5 min, settle 5 min, recovery 10 min (`manifest.protocol`); entrances throttled as CONTRACT section 11 item 4 (belt credit of perMinute/3600 per tick capped at 8, alternating lanes; fluid perMinute/3600 per tick plus the refused carry, capped at one second); power through one energy interface on the substation's network; nothing seeded; concrete collected from the exit every 4 ticks except while blocked.

Two exploration runs on the same string, outside the report (short phases, so they do not qualify anything): entrances saturated for 20 minutes, 45.0 a minute and exit 8 when blocked; collection stopped for 60 minutes, exit 8 the whole time, machine stopped, 45.0 a minute after release.

## Reproduce

From `factorio-command-center/`:

```
node scripts/concrete-supplier/generate.mjs          # writes concrete-supplier.txt and manifest.json (byte-identical on re-run)
node scripts/concrete-supplier/validate.mjs          # full protocol, writes native-report.json (about 10 s)
node scripts/concrete-supplier/generate.mjs          # picks up status "qualified" and the measured block
node --test tests/concrete-supplier.test.mjs
```

Exploration: `SPACE_EXPLORE=1` (short phases, `SUPPLIER_SATURATE=1` for saturated feed) writes `.cache/concrete-supplier/explore-report.json` and never touches the published report. Variants: `--variant five-by-six|eight-by-four|seven-by-five|four-row|five-row`, `--supply nominal|margin`, `--out <folder>` with `SUPPLIER_SOURCE=<folder>` for the validator. Needs the pinned prototype dump (`FACTORIO_RAW`) and the Steam Factorio 2.1.24 binary; runs headless with a private config and mod folder under `.cache/concrete-supplier/`.

## Tried and rejected (`history/`)

- `seven-by-five-449f804a`: 7 x 5 = 35 tiles, the version published in the space-launch round; qualified, superseded by `five-by-six` (5 fewer tiles, 2 fewer belts).
- `eight-by-four`: 8 x 4 = 32 tiles, a long-handed arm dropping onto a belt that runs towards it; qualified in the design review, rejected as larger than `five-by-six`.
- `four-row`: 9 x 4 = 36 tiles, published in `926ac81b7`; qualified, superseded by `seven-by-five` (one tile smaller, one more belt).
- `four-row-margin-supply`: the four-row layout with the panels at the starting figures 24 / 473 / 4.8; qualified, superseded by the lower figures.
- `five-row`: 8 x 5 = 40 tiles (exit row under an arm row, second lane by a stub side-load); qualified, rejected as larger.

Why 30 tiles looks like the floor (reasoned on paper, not searched by machine). The parts cannot shrink: the machine (9 tiles), the substation (4), three panels, two entrance belts with an arm each, two pipes, two output arms (one per lane; one arm fills one lane and the exit would hold 4), and at least three exit belts. Smaller rectangles fail as follows:

- 5 x 5 = 25: the machine and the two west columns fill rows 0..2; the 10 tiles left must hold the substation, three panels, two arms and at least two belts, which is 11.
- 7 x 4 and 4 x 7 = 28: in 7 x 4 the substation only fits in the two columns east of the machine and leaves four tiles there, not enough for two arms, a side-load and the exit; in 4 x 7 the machine fills the width beside the pipe column, so stone bricks and iron ore each need a belt row and an arm row above and below it, and the exit row is then the iron-ore belt's row, where both output arms can only drop on the south lane.
- 9 x 3 = 27 and 10 x 3 = 30: with three rows everything else sits east of the machine. 9 x 3 does not hold it (13 tiles of parts in 12); 10 x 3 would, but it is no smaller and its panels would be 5 to 7 tiles from their entrances (the contract asks for 4 or less). Not tested natively.
- 6 x 5 = 30: with one free column east of the machine both output arms must sit under it and both then drop on the south lane; nothing can reach the exit row from the north for the other lane.

## Review notes

- Review of `926ac81b7`: no must-fix for this blueprint. Its size idea (7 x 5 = 35, the five-row layout with the stub folded back west) was adopted.
- Design review (11-21): the 7 x 5 version re-qualified unchanged (regenerated to the same SHA-256, full protocol passed again). Two smaller layouts with one long-handed output arm were then built and qualified: 8 x 4 = 32 and 5 x 6 = 30. The 5 x 6 one is published. The exit row moved from row 4 to row 5 from the top, so the supplier now sits 5 rows above the kit's top row instead of 4.
