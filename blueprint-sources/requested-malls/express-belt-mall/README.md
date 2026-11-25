# Express belt mall

**Factorio 2.1.25 Space Age.** 15 assembling machines 2, fast inserters, red belts, no modules or beacons. Iron, copper and plastic arrive on three belts and lubricant in one pipe; the mall makes **express transport belts, express underground belts and express splitters**, each product into **its own passive provider chest limited to one stack** (100, 50 and 50). Gears, copper cable, green and red circuits and the whole yellow and red belt tier are made inside and are not exported.

- **Size:** 33 × 12 = 396 tiles (selection envelope of every entity; external supply excluded).
- **Entities:** 192: 15 machines, 97 red belts and 2 red underground pieces, 48 fast inserters, 8 pipes, 11 medium poles, 3 provider chests, 8 labels.
- **Static audit:** 206 of 206 checks pass ([static-audit.json](static-audit.json)).
- **Native test:** **passed** the full protocol for this exact string ([native-report.json](native-report.json)).
- **Measured rates** (all three chests emptied every second, 30 minutes counted after a 15 minute warm-up): 7.23 express transport belts a minute, 2.27 express underground belts a minute, 0.73 express splitters a minute.
- **Measured draw** (what the machines consumed in the same window): 590 iron plate a minute, 55 copper plate a minute, 15 plastic bar a minute, 250 lubricant a minute.

Import [blueprint.txt](blueprint.txt). See also the [layout schematic](layout.svg), the [manifest](manifest.json), the [ports](ports.json) and the [footprint](footprint.json).

Blueprint SHA-256, over the string with surrounding whitespace removed:

```text
de3e615d694a8c34f097944a8f8f68e81c3b4e84c4b0988c08fba89424268351
```

## Layout

Tile map from the entities (north up; x from -2, y from -4). Machines: E green circuit, C copper cable, A red circuit, t yellow belt, u yellow underground, s yellow splitter, f fast splitter (north band, y -4 to -2); U fast underground, G gear (three), X express underground, S express splitter, T express belt, F fast belt (south band, y 3 to 5). Arrows are belts, n s e w are arms by the side they drop on, = pipe, [ ] underground belt, + pole, " label, # provider chest.

```text
    890123456789012345678901234567890
 -4 ...EEEwCCC.AAAtttuuusssfff.......
 -3 ...EEEwCCCeAAAtttuuusssfff."""...
 -2 ...EEE.CCC.AAAtttuuusssfff.###...
 -1 "+"n.s.+n..n.sn+sn.sn+sn.s.nnn...
  0 >e>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>v
  1 >e^<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  2 ".ns.n..+..snss+ns.n..+..s.n+.n..
  3 >>vUUU+GGG.XXXSSSTTT+GGG.FFF+GGG.
  4 ".vUUUwGGGeXXXSSSTTTwGGGeFFFwGGG.
  5 ..vUUU.GGG.XXXSSSTTT.GGG.FFF.GGG.
  6 ..v....nnn..=======".nnn.....nnn.
  7 ..>>>>>>>>>>>>[=]>>>>>>>>>>>>>>>.
```

Rows: machines, arms (y -1), the two ring rows (y 0 and 1), arms (y 2), machines, iron arms and the lubricant pipe (y 6), the iron belt with its underground hop and the inlet pipe (y 7). West entrances: copper y 0, plastic y 1, iron y 3.

## Products and recipes

| Product | Ingredients per craft | Result per craft | Recipe seconds |
| --- | --- | --- | --- |
| `express-transport-belt` | 10 iron-gear-wheel + 1 fast-transport-belt + 20 lubricant | 1 | 0.5 |
| `express-underground-belt` | 80 iron-gear-wheel + 2 fast-underground-belt + 40 lubricant | 2 | 2 |
| `express-splitter` | 1 fast-splitter + 10 iron-gear-wheel + 10 advanced-circuit + 80 lubricant | 1 | 2 |
| `fast-transport-belt` | 5 iron-gear-wheel + 1 transport-belt | 1 | 0.5 |
| `fast-underground-belt` | 40 iron-gear-wheel + 2 underground-belt | 2 | 2 |
| `fast-splitter` | 1 splitter + 10 iron-gear-wheel + 10 electronic-circuit | 1 | 2 |
| `transport-belt` | 1 iron-plate + 1 iron-gear-wheel | 2 | 0.5 |
| `underground-belt` | 10 iron-plate + 5 transport-belt | 2 | 1 |
| `splitter` | 5 electronic-circuit + 5 iron-plate + 4 transport-belt | 1 | 1 |
| `advanced-circuit` | 2 electronic-circuit + 2 plastic-bar + 4 copper-cable | 1 | 6 |
| `electronic-circuit` | 1 iron-plate + 3 copper-cable | 1 | 0.5 |
| `copper-cable` | 1 copper-plate | 2 | 0.5 |
| `iron-gear-wheel` | 2 iron-plate | 1 | 0.5 |

Assembling machine 2 crafting speed is 0.75. Every recipe above has its own machine; the gear recipe has three. There is no steel, stack or higher-tier recipe. **Plastic bars are not smelted** (they come out of a chemical plant), but the express splitter's advanced circuits need them, so plastic is the third solid input. **Lubricant is a fluid** and cannot be avoided for the express tier, so it enters by one pipe.

## The arithmetic: gears decide

What one of each express product costs, walked down the recipes of the pinned prototypes (the belt workshop's table, extended to the express tier):

| One of | Gears | Plates direct (not through a gear) | Green circuits | Red circuits | Lubricant | Raw plates in all |
| --- | --- | --- | --- | --- | --- | --- |
| `express-transport-belt` | 15.50 | 0.50 | 0.0 | 0.0 | 20 | 31.5 iron |
| `express-underground-belt` | 61.25 | 6.25 | 0.0 | 0.0 | 20 | 128.8 iron |
| `express-splitter` | 22.00 | 42.00 | 35.0 | 10.0 | 80 | 86.0 iron, 72.5 copper, 20 plastic |

An assembling machine 2 makes 90 gears a minute, so one express belt costs 15.5 gears, one express underground 61.25 gears and one express splitter 22 gears and 10 advanced circuits. The three gear machines make 270 gears a minute together, which decides the express belt and underground rates. One advanced circuit machine makes 7.5 advanced circuits a minute, which caps the express splitter at 0.75 a minute however many gears there are.

## Inputs

Use normal-quality items. Each solid material has **one belt entrance on the west edge**, a red belt tile facing east, with a display panel (item icon and `IN: <material>` text); end your own belt at the clear tile west of it. Lubricant enters at the south edge. Coordinates are entity centres in the blueprint; north is negative y.

| Port | Material | Entrance tile (belt facing east) | Clear tile for your belt or pipe | Panel tile | Label text |
| --- | --- | --- | --- | --- | --- |
| IN-1 | `iron-plate` | (-1.5, 3.5) | (-2.5, 3.5) | (-1.5, 4.5) | `IN: iron-plate` |
| IN-2 | `copper-plate` | (-1.5, 0.5) | (-2.5, 0.5) | (-1.5, -0.5) | `IN: copper-plate` |
| IN-3 | `plastic-bar` | (-1.5, 1.5) | (-2.5, 1.5) | (-1.5, 2.5) | `IN: plastic-bar` |
| IN-4 | `lubricant` | (13.5, 7.5) | (13.5, 8.5) | (17.5, 6.5) | `IN: lubricant` |

- **Iron** runs down the west edge and east along the south edge. The three gear machines take plates from it directly (three arms each); one arm at (0.5, 2.5) lifts iron onto the ring for the few machines that need a plate (green circuit, yellow belt, underground and splitter). It dives under the lubricant inlet at (12.5, 7.5).
- **Copper** and **plastic** end at one arm each, which lifts the material onto the ring while the ring holds less than its cap.
- **Lubricant** is a fluid: connect a pipe to the open end of the inlet pipe at (13.5, 7.5), from (13.5, 8.5).
- **Electricity:** any outside pole within reach of the entry pole at (-0.5, -0.5) powers the mall (11 medium poles, one network). The native test connects an outside pole at (-3.5, -0.5). The label `POWER: connect medium pole` is at (0.5, -0.5).

## Outputs

Three passive provider chests at the east end of the north band, each **limited to one slot** (bar 1) and fed by one collector arm that takes only its own product off the ring. Nothing else can enter a chest: every other arm drops on the ring or into a machine, and each collector has one filter.

| Chest tile | Product | Holds at most | Label text |
| --- | --- | --- | --- |
| (25.5, -1.5) | `express-transport-belt` | 100 (one stack) | `OUT: express-transport-belt` |
| (26.5, -1.5) | `express-underground-belt` | 50 (one stack) | `OUT: express-underground-belt` |
| (27.5, -1.5) | `express-splitter` | 50 (one stack) | `OUT: express-splitter` |

Take items by hand or cover the chests with a logistics network; each refills to its stack while the mall has supplies. The yellow and red tier items are intermediates only and have no chest.

## Measured rates and draw

Native, with all three chests emptied every second (`native-report.json`): a 15 minute warm-up, then 30 minutes counted.

| Product | Per minute | Made in each five minutes |
| --- | --- | --- |
| `express-transport-belt` | 7.23 | 36 / 36 / 36 / 37 / 36 / 36 |
| `express-underground-belt` | 2.27 | 12 / 10 / 12 / 12 / 12 / 10 |
| `express-splitter` | 0.73 | 3 / 4 / 4 / 4 / 3 / 4 |

Draw over the same window, what the machines consumed (production statistics), which is what each entrance has to deliver at least:

| Entrance | Per minute | Taken in by the entrance |
| --- | --- | --- |
| `iron-plate` | 590 | 590 |
| `copper-plate` | 55 | 55 |
| `plastic-bar` | 15 | 15 |
| `lubricant` | 250 | 250 |

These are measured figures, not recipe arithmetic. They are the draw with every chest being emptied at once; with mostly full chests the draw is lower and only sets how fast a chest refills. The iron figure is mostly the three gear machines.

Per machine over the measured window:

| Machine | Products made | Status share |
| --- | --- | --- |
| `fast-underground-belt` | 34 | item ingredient shortage 95%, working 5% |
| `express-underground-belt` | 34 | item ingredient shortage 95%, working 5% |
| `express-splitter` | 22 | item ingredient shortage 98%, working 2% |
| `express-transport-belt` | 217 | item ingredient shortage 93%, working 7% |
| `fast-transport-belt` | 217 | full output 60%, item ingredient shortage 32%, working 8% |
| `iron-gear-wheel` B | 2700 | working 100% |
| `iron-gear-wheel` A | 2700 | working 100% |
| `iron-gear-wheel` C | 2700 | working 100% |
| `electronic-circuit` | 796 | full output 41%, item ingredient shortage 30%, working 29% |
| `copper-cable` | 1647 | working 61%, item ingredient shortage 26%, full output 13% |
| `advanced-circuit` | 225 | working 100% |
| `transport-belt` | 240 | full output 76%, item ingredient shortage 16%, working 9% |
| `underground-belt` | 34 | full output 79%, item ingredient shortage 19%, working 2% |
| `splitter` | 23 | full output 89%, item ingredient shortage 9%, working 2% |
| `fast-splitter` | 23 | full output 70%, item ingredient shortage 27%, working 3% |

The gear machines and the red circuit machine never wait, which is the intended bottleneck; everything else waits for them or for its own stock cap.

## How it works

- **One ring.** 62 red belt tiles form one clockwise loop two rows tall (row 0 eastbound, row 1 westbound), with no splitter, side-load or underground. The north band's machines work from row 0, the south band's from row 1; every item passes every machine.
- **One reader.** One belt reads the whole ring in hold mode onto a green wire.
- **Caps.** Every arm that adds an item to the ring (the iron, copper and plastic entrance arms, the third gear machine's gear arm, each recipe's output arm) works only while the ring holds less than that item's cap (manifest `ringCaps`): iron-plate 16, copper-plate 8, plastic-bar 8, iron-gear-wheel 24, electronic-circuit 16, advanced-circuit 10, transport-belt 12, underground-belt 6, splitter 3, fast-transport-belt 3, fast-underground-belt 2, fast-splitter 2, express-transport-belt 3, express-underground-belt 3, express-splitter 3. The caps are small because the stock lives in the chests, not on the ring.
- **Express products.** An express maker puts at most 3 of its product on the ring; its collector arm takes them into the chest. A full chest stops its collector, the ring keeps its few items, the maker stops: the one-slot limit is the product cap, and no ring cap has to count the chest.
- **Direct hand-offs, always on,** keep the big flows off the ring: the three gear machines hand gears straight to their neighbours (5 arms: the fast underground maker and the express underground maker from the first, the express belt maker and the fast belt maker from the second, the fast belt maker also from the third), and the cable machine hands copper cable to the green circuit machine (two arms) and the red circuit machine. Gears and cable are the high-volume items; nothing else is handed over directly.
- **Gears.** The third gear machine also puts gears on the ring for the small users (yellow belt, fast splitter, express splitter). The express underground maker takes ring gears too, but only while the ring holds more than 12 of them, so the small users are served first and it takes what is left. This is the only arm that takes under a circuit condition.
- **No clock.** The belt workshop shared scarce ingredients with a 30 second clock. Here each line has its own gear machine or gets a rule, and the native runs showed no product starving without one.
- **Arms.** All 48 arms are fast inserters with hand size one and whitelist filters.
- **Lane room.** Everything rides one lane. Ring caps 119 + one item in hand for each of the 15 capped arms = 134 items at the very most, against 232 one-lane places when the 4 turn tiles are not counted at all (bound 174, 75%). The most the native run ever saw on the ring was 119 items. Raise caps only together with this check.
- Machines keep their ordinary ingredient and product buffers while idle; those are not stock.

## Native test

Protocol: supply only the three entrance belts (both lanes full), the outside lubricant pipe and outside power. Fill from empty with a bound of 90 minutes until all three chests hold a full stack; collect everything; refill (same bound); collect; 5 minutes with every input stopped; collect; recover (same bound); then the rate phase described above. At the end of each fill phase every chest must hold exactly its stack and nothing else. The ring must hold only declared items, never more than the lane-room bound and each item never more than its cap plus one hand per arm that adds it. Every machine must craft in the measured window and each product must be made in every five-minute slice of it. The run also checks every route, recipe, filter, hand size, circuit connection, fluid connection and power connection of the imported blueprint, with no repair of any kind.

Result for `de3e615d`: **passed**, 193 of 193 checks, 1152000 ticks.

| Phase | All three at one stack after | Each product (belt / underground / splitter) |
| --- | --- | --- |
| Fill from empty | 67.2 min | 15.1 min / 22.5 min / 67.2 min |
| Refill after a complete collection | 58.9 min | 13.2 min / 16.8 min / 58.9 min |
| Recovery after the five-minute outage | 66.1 min | 14.1 min / 20.7 min / 66.1 min |

Times are read once a second of game time; they are measurements, not pass limits. Products made in the whole run: 137 fast-underground-belt, 136 express-underground-belt, 195 express-splitter, 641 express-transport-belt, 649 fast-transport-belt, 10574 iron-gear-wheel B, 8031 iron-gear-wheel A, 12671 iron-gear-wheel C, 7000 electronic-circuit, 14425 copper-cable, 1958 advanced-circuit, 1114 transport-belt, 144 underground-belt, 207 splitter, 201 fast-splitter. Largest ring load seen: 119 items.

Exploration runs for exactly this string (their reports are kept beside the blueprint, each the unedited output of `validate.mjs --explore`):

- **One-hour hold at full stock** ([exploration-hold-report.json](exploration-hold-report.json)): all three chests were full after 67.2 min and stayed untouched for 63 minutes; they held 100 / 50 / 50 (belt / underground / splitter) at the end, never more than a stack; in the last minute before the collection the machines finished 0 crafts in all; the ring peaked at 119 items (bound 174); the refill after the collection and the recovery after the outage passed (every check of the run passed).
- **Lubricant withheld for one hour** ([exploration-no-lubricant-report.json](exploration-no-lubricant-report.json)): lubricant left unsupplied for the first 60 minutes of the fill (no express product can be made, the yellow and red tier fills to its caps and stops). At that point the chests held 0 / 0 / 0 (belt / underground / splitter); the ring peaked at 119 items (bound 174) over the whole run; after supply returned all three chests reached their stacks, and every check of the run passed.
- **Plastic withheld for one hour** ([exploration-no-plastic-report.json](exploration-no-plastic-report.json)): plastic-bar left unsupplied for the first 60 minutes of the fill (the express splitter has no advanced circuits and stays at zero while the belt and the underground reach their stacks). At that point the chests held 100 / 50 / 0 (belt / underground / splitter); the ring peaked at 119 items (bound 174) over the whole run; after supply returned all three chests reached their stacks, and every check of the run passed.

## Technology

- **Express products:** `logistics-3`, which needs production science and lubricant.
- **Everything else made inside:** `logistics`, `fast-inserter`, `advanced-circuit`, `plastics` need the usual chain. The full prerequisite list, in research order, is `technologyClosure` in the manifest (26 technologies); the native test researches exactly that list.
- **Building it:** assembling machine 2, fast inserters, medium poles, `logistic-robotics` or `construction-robotics` for the provider chest (it works as a plain chest without robots).

## Provenance

The design principle (one capped circulating belt read by one belt reader, passive provider chests limited to one stack, belt entrances from the west, display-panel labels) comes from the belt workshop and the blue-tier mall in this repository. The layout, the hand-off arrangement of the gear machines, the collector chests and the express tier are new. No comparison with other designs is claimed.

## Reproduce

From the `factorio-command-center` folder:

```sh
node scripts/requested-malls/express-belt-mall/generate.mjs     # rewrites this folder; byte-identical on a re-run
node scripts/requested-malls/express-belt-mall/audit.mjs        # static audit
node scripts/requested-malls/express-belt-mall/validate.mjs     # full native protocol (about 15 minutes of real time)
node --test tests/express-belt-mall.test.mjs
```

The generator and the tests need only the pinned `scripts/requested-malls/express-belt-mall/prototypes.json` (taken from the installed 2.1.25 game by `pin-prototypes.mjs`). The validator needs the Steam install of Factorio 2.1.25 with Space Age and runs it headless in a private profile under `.cache/express-belt-mall/`; it never opens the player's saves. After a full run, run the generator again so this page states the new result.
