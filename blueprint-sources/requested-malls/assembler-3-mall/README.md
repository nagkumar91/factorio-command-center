# Assembling machine 3 supply mall

**Factorio 2.1.24 Space Age.** Eight assembling machines 2, fast inserters, red transport belts and medium poles make **assembling machine 2** and **assembling machine 3** from smelted plates. Each product drops into its **own passive provider chest** (one stack of 50 each). The user supplies four materials on four labelled belts: iron plate, steel plate, copper plate and **plastic bar**. Plastic is not smelted; it is the one input that has to come from a chemical plant. Everything else (cable, green and red circuits, gears, assembling machine 1, speed modules) is made inside.

- **Size:** 21 × 10 = 210 tiles (selection envelope of every entity; the four outside belts and outside power excluded).
- **Entities:** 102: 8 machines, 54 belts, 25 inserters, 6 medium poles, 2 provider chests, 7 display panels.
- **Static audit:** 139 of 139 checks pass ([static-audit.json](static-audit.json)).
- **Native test:** **passed** the full protocol for this exact string ([native-report.json](native-report.json)).
- **Measured rate, normal use** (only the AM3 chest emptied): **0.37 assembling machines 3 per minute**; the limit is one advanced-circuit machine, 7.5 per minute, 20 per assembling machine 3.

Import [blueprint.txt](blueprint.txt). See also the [layout schematic](layout.svg), the [manifest](manifest.json), the [ports](ports.json) and the [footprint](footprint.json).

Blueprint SHA-256, over the string with surrounding whitespace removed:

```text
337857e55afd878a480982cc43153040a39484ca0210917968920b8ed41ff272
```

## Layout

Tile coordinates are blueprint-relative, x east and y south, the top-left tile of the envelope at (0, -4). Machine numbers: 1 copper-cable, 2 electronic-circuit, 3 advanced-circuit, 4 speed-module, 5 iron-gear-wheel, 6 assembling-machine-1, 7 assembling-machine-2, 8 assembling-machine-3. `C` = provider chest, `D` = display panel, `p` = medium pole; `n e s w` = an inserter and the side it drops on; `> < ^ v` = red belts.

```text
     012345678901234567890   x (west to east), y down
  -4 ....222.111.333.444..
  -3 >>>v222w111e333e444D.
  -2 >>Dv222.111.333.444p.
  -1 Ds.sn.spn...npn.n.s..
   0 v<<<<<<<<<<<<<<<<<<<.
   1 >>>>>>>>>>>>>>>>>>>^.
   2 Dnpns.n.sp..s.sp..s..
   3 >>.^666.555.777.D.888
   4 >>>^666w555e777eCe888
   5 D...666.555.777DCw888
```

Rows -4 to -2: north machines. Row -1: their arms. Rows 0 and 1: the ring (westbound on row 0, eastbound on row 1). Row 2: arms of the south machines. Rows 3 to 5: south machines and the gap that holds the two provider chests.

## What it costs: one assembling machine 3

Expanded from the recipes in `prototypes.json` (assembling machine 3 = 2 assembling machine 2 + 4 speed modules; the 2.1 recipe needs 4 modules):

| Material (entrance) | Per assembling machine 3 | At the measured rate, per minute |
| --- | ---: | ---: |
| `iron-plate` (IN-1) | 130 | 47.23 |
| `steel-plate` (IN-2) | 4 | 1.47 |
| `copper-plate` (IN-3) | 148 | 56.97 |
| `plastic-bar` (IN-4) | 40 | 14.93 |

An assembling machine 2 on its own (what the first chest stocks): 2 steel plate, 35 iron plate (9 for the machine 1, 20 for 10 gears, 6 for 6 circuits) and 9 copper plate. The AM2 chest feeds the AM3 machine, so assembling machine 2 surplus is about zero in normal use; stock builds up to 50 when nothing is taken from the AM3 chest.

## Inputs: four belts on the west edge

Each entrance is a short red belt stub that ends next to a capped feed arm, which lifts the plate onto the ring. Bring your own belt to the **external tile** (it must end facing east on that tile; the first stub tile is the next one). The belt can be any speed; the arm moves about 2.3 items a second. Each label is a display panel with the item icon and `IN: <material>`.

| Port | Material | External tile (end your belt here) | Stub tiles (x, y) | Feed arm | Label panel | Cap on ring |
| --- | --- | --- | --- | --- | --- | ---: |
| IN-1 | `iron-plate` | [-1, -3] | [0, -3] [1, -3] [2, -3] [3, -3] [3, -2] | [3, -1] | [2, -2] `IN: iron-plate` | 12 |
| IN-2 | `steel-plate` | [-1, -2] | [0, -2] [1, -2] | [1, -1] | [0, -1] `IN: steel-plate` | 4 |
| IN-3 | `copper-plate` | [-1, 3] | [0, 3] [1, 3] | [1, 2] | [0, 2] `IN: copper-plate` | 12 |
| IN-4 | `plastic-bar` | [-1, 4] | [0, 4] [1, 4] [2, 4] [3, 4] [3, 3] | [3, 2] | [0, 5] `IN: plastic-bar` | 8 |

Both north entrances reach the ring on its westbound row, both south entrances on its eastbound row. The tiles listed are centres rounded down to the tile; entity centres are in [ports.json](ports.json).

**Electricity:** one labelled connection. Any outside medium pole within reach of the entry pole at [19, -2] powers the mall (6 medium poles in all, all inside the rectangle). The panel `POWER: connect medium pole \| external electricity` is at [19, -3]. The native test connects an outside pole at (21.5, -1.5).

## Outputs: one provider chest each

| Product | Chest tile | Label panel | How it gets there |
| --- | --- | --- | --- |
| `assembling-machine-2` | [16, 4] | [16, 3] `OUT: assembling machine 2` | A filtered, always-on fast inserter at [15, 4] from the machine that makes it. Nothing else ever drops into this chest. |
| `assembling-machine-3` | [16, 5] | [15, 5] `OUT: assembling machine 3` | A filtered, always-on fast inserter at [17, 5] from the machine that makes it. Nothing else ever drops into this chest. |

Both chests are limited to one slot (bar 1), so each holds at most one stack of 50. They are on no belt and no circuit. The AM3 machine takes its assembling machines 2 from the AM2 chest with an always-on arm at [17, 4], so the AM2 chest both stocks up for you and feeds the AM3 machine. Assembling machine 2 and 3 never ride the ring.

## How it works

- **One ring.** 40 red belt tiles form a single counter-clockwise loop two rows tall, with no splitter, side-load or underground. Machines sit on both sides of it. The four entrance stubs are separate belts that end at an arm; none of them feeds the ring directly.
- **One reader.** One ring belt reads the whole ring in hold mode, at (11.5, 0.5). Every feed arm and every product arm that puts something on the ring is enabled only while its own item on the ring is below its cap.
- **Capped on the ring:** `iron-plate` 12, `steel-plate` 4, `copper-plate` 12, `plastic-bar` 8, `electronic-circuit` 20, `speed-module` 3, `assembling-machine-1` 3. The caps total 62.
- **Direct hand-offs,** always on, so these high-volume items stay off the ring: copper-cable → electronic-circuit; copper-cable → advanced-circuit; advanced-circuit → speed-module; iron-gear-wheel → assembling-machine-1; iron-gear-wheel → assembling-machine-2; and the AM2 chest → AM3 machine.
- **Arms.** All 25 arms are fast inserters with hand size one and whitelist filters. A machine's ring arms only take what its recipe still needs from the ring.
- **Lane room.** Everything rides the inner lane. Ring caps 62 + one item in hand for each of the 7 capped arms = 69 items at the very most, against 144 inner-lane places when the 4 turn tiles are not counted at all. The most the native run ever saw on the ring was 62 items. Raise caps only together with this check.
- Machines keep their ordinary ingredient and product buffers while idle; those are not stock.

### Why this arrangement

Both a one-row arrangement (all eight machines on one side of the ring) and a two-row arrangement (machines on both sides) were built from the same data and passed the same static audit:

| Arrangement | Size | Area | Entities |
| --- | --- | ---: | ---: |
| two-row (published) | 21 × 10 | 210 | 102 |
| one-row | 38 × 9 | 342 | 139 |

The one-row version was only checked statically; it was not run natively.

**A second advanced-circuit machine (estimate, not built):** one advanced-circuit machine limits the mall to 7.5 per minute, 0.375 assembling machines 3 a minute. A second one east of the speed-module machine would widen the rectangle by two columns (about 23 × 10 = 230 tiles, 10% more), but one copper-cable machine makes 180 cables a minute and each assembling machine 3 needs 296, so the second machine alone would lift the rate to about 0.6 a minute, not 0.75. A full doubling also needs a second cable machine.

## Native test

Protocol: supply only the four entrance belts (kept full by the test) and outside power. All phases are bounded; a fill phase ends when both chests hold 50.

1. Fill from empty to 50 + 50 (limit 4 game hours; a full stack of assembling machines 3 takes over two hours).
2. Collect everything, refill to 50 + 50.
3. Collect everything, a 5-minute outage of all four entrances (belts emptied), collect, recover to 50 + 50.
4. One hour at full stock, nothing collected; then collect and check production resumes (10 minutes).
5. Both chests emptied every second: 15 minutes warm-up, 30 minutes measured.
6. Only the AM3 chest emptied every second (the AM2 chest refilled first and left full): 15 minutes warm-up, 30 minutes measured.

The run also checks every route, recipe, filter, hand size, circuit condition and power connection of the imported blueprint, that both chests accept exactly one stack, that no chest ever holds a foreign item or more than 50, that the ring never exceeds the lane-room bound and that no ring item exceeds its cap by more than the one item in an arm's hand.

Result for `337857e5`: **passed**, 159 of 159 checks, 2247849 ticks (10.41 h of game time).

| Phase | AM2 chest at 50 after | AM3 chest at 50 after | Both |
| --- | --- | --- | --- |
| Fill from empty | 17.1 min | 152.2 min | 152.2 min (2.54 h) |
| Refill after collection | 13.0 min | 146.6 min | 146.6 min (2.44 h) |
| Recovery after the 5-minute outage | 13.7 min | 146.8 min | 146.8 min (2.45 h) |

- **Hold at full stock, one hour:** both chests stayed at exactly 50 and held only their own product. After the collection, production resumed: 39 AM2 and 4 AM3 in the chests 10 minutes later.
- **Ring:** at most 62 items on the ring at any one second (bound 69); per item: copper-plate 12, steel-plate 4, iron-plate 12, plastic-bar 8, electronic-circuit 20, assembling-machine-1 3, speed-module 3.
- **Provider chests:** peak 50 AM2 and 50 AM3; never a foreign item.

### Normal use: only the AM3 chest emptied (30 measured minutes)

- **Assembling machine 3 taken: 0.37 per minute** (11 in 30 minutes); assembling machine 2 taken by the user side: 0.00 per minute (the AM3 machine uses them all).
- Drawn from the entrances, per minute: iron-plate 47.23, steel-plate 1.47, copper-plate 56.97, plastic-bar 14.93.

| Machine | Crafts in the window | Per minute |
| --- | ---: | ---: |
| `copper-cable` | 1707 | 56.90 |
| `electronic-circuit` | 840 | 28.00 |
| `advanced-circuit` | 225 | 7.50 |
| `speed-module` | 45 | 1.50 |
| `iron-gear-wheel` | 194 | 6.47 |
| `assembling-machine-1` | 21 | 0.70 |
| `assembling-machine-2` | 22 | 0.73 |
| `assembling-machine-3` | 11 | 0.37 |

### Both chests emptied every second (30 measured minutes)

An artificial worst case: the AM2 chest never holds a machine for the AM3 machine to take, and the AM2 chain (which makes assembling machine 2 as fast as iron allows) uses the circuits first.

- Taken: **0.00 assembling machine 3 and 3.57 assembling machine 2 per minute**.
- Drawn from the entrances, per minute: iron-plate 126.73, steel-plate 7.17, copper-plate 32.90, plastic-bar 0.13.

| Machine | Crafts in the window | Per minute |
| --- | ---: | ---: |
| `copper-cable` | 988 | 32.93 |
| `electronic-circuit` | 655 | 21.83 |
| `advanced-circuit` | 2 | 0.07 |
| `speed-module` | 0 | 0.00 |
| `iron-gear-wheel` | 1085 | 36.17 |
| `assembling-machine-1` | 108 | 3.60 |
| `assembling-machine-2` | 107 | 3.57 |
| `assembling-machine-3` | 0 | 0.00 |

Crafts over the whole run: 28898 copper-cable, 14815 electronic-circuit, 3333 advanced-circuit, 666 speed-module, 7945 iron-gear-wheel, 798 assembling-machine-1, 790 assembling-machine-2, 166 assembling-machine-3. Times are read once a second of game time; they are measurements, not pass limits.

**Game version.** The pinned data in `prototypes.json` and the blueprint version are Factorio 2.1.24. The native run used the installed 2.1.25; before the run the harness dumped the installed game's prototypes and checked all 13 recipes, 6 entities, 17 items and 277 technologies this design reads against the pin: no difference.

## Technology

- **Assembling machine 3:** `automation-3` (needs `speed-module`, `production-science-pack`, `electric-engine`). Assembling machine 2: `automation-2`.
- **Circuits and gears:** `electronics`, `advanced-circuit`, `speed-module`; the plastic comes from `plastics`.
- **Building it:** `electric-energy-distribution-1` (medium pole), `fast-inserter`, `logistics-2` (red belts), `circuit-network`, and `construction-robotics` (or `logistic-robotics`) for the provider chests. The chests work as plain chests without robots.

The full prerequisite list, in research order, is `technologyClosure` in the manifest (34 technologies); the native test researches exactly that list.

## Reproduce

From the `factorio-command-center` folder:

```sh
node scripts/requested-malls/assembler-3-mall/generate.mjs     # rewrites this folder; byte-identical on a re-run
node scripts/requested-malls/assembler-3-mall/audit.mjs        # static audit
node scripts/requested-malls/assembler-3-mall/validate.mjs     # full native protocol, about fifteen to twenty minutes
node --test tests/assembler-3-mall.test.mjs
```

The generator and the tests need only the pinned `scripts/requested-malls/assembler-3-mall/prototypes.json` (written by `snapshot.mjs` from a native `--dump-data`). The validator needs the Steam install of Factorio with Space Age and runs it headless in a private profile under `.cache/assembler-3-mall/`; it never opens the player's saves. After a full run, run the generator again so this page states the new result.
