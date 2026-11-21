# Blue-tier on-demand mall

**Factorio 2.1.24 Space Age.** Seven assembling machines 2, fast inserters, red transport belts, one passive-provider output chest, no modules or beacons. It keeps a small stock of the three express belt items and the four inserters, and makes more only when stock is taken.

- **Size:** 24 × 9 = 216 tiles (selection envelope of every entity; external supply excluded).
- **Entities:** 136: 7 machines, 52 belts, 31 inserters, 23 pipes, 5 medium poles, 7 input chests, 1 provider chest, 10 labels.
- **Static audit:** 132 of 132 checks pass ([static-audit.json](static-audit.json)).
- **Native test:** **passed** the full protocol for this exact string ([native-report.json](native-report.json)).
- No items-per-minute figure is claimed. The measured times to full stock are below.

Import [blueprint.txt](blueprint.txt). See also the [layout schematic](layout.svg), the [manifest](manifest.json), the [ports](ports.json) and the [footprint](footprint.json).

Blueprint SHA-256, over the string with surrounding whitespace removed:

```text
f537f1f1d2502cccba4da53eaeb11802bd5e23042b7270e6cb56e43f5e434bc5
```

## What changed from the first version

The first version (`6762edae`, kept under [history/four-row-ring-6762edae](history/four-row-ring-6762edae/)) put the ring around a two-row empty middle and used two rows for lubricant. This version has the same seven products, the same stock caps, the same seven input chests in the same order on the north edge, lubricant from the west and the one provider chest at the east end.

| | First version | This version |
| --- | --- | --- |
| Size | 33 × 13 = 429 tiles | 24 × 9 = 216 tiles (49.7% fewer) |
| Machines | 7 | 7 |
| Belts / inserters / pipes / poles | 66 / 33 / 16 / 9 | 52 / 31 / 23 / 5 |
| Entities | 149 | 136 |
| Full stock from empty | 9.1 min | 7.8 min |
| Full stock after a complete collection | 6.4 min | 5.6 min |
| Full stock after the input outage | 8.7 min | 7.9 min |

Both columns of times were measured with the same harness (the first version was run again on 21 November 2026; that report is in the history folder).

How the area came down: the ring is two rows tall instead of four; the lubricant runs in one row instead of two; the three express machines touch; the labels moved off the north edge row, where their selection boxes used to add a whole row; the lubricant inlet no longer sticks out two tiles on the west.

Why it also fills faster: the ring now runs counter-clockwise, so the input chests sit just upstream of the machines instead of almost a full lap away. The gear feed arm is the bottleneck of both versions. It can move about 149 gears a minute; in the first version the long trip kept the ring at its gear cap and held the arm to about 134 a minute for most of a fill, and now it runs at about 149 until the last product is full. The machines are served in the same order as before: the four inserters first, then splitters, undergrounds and belts.

The lubricant pipe is longer (23 pipes instead of 16) because the express machines moved to the east end of the row; the feed caps on the ring are lower (58 items in total instead of 100) because the trip from chest to machine is shorter.

## Products and recipes

"Blue inserter" means `fast-inserter`. There is no stack inserter in scope. Each product has its own machine.

| Product | Ingredients per craft | Result per craft | Recipe seconds | Stock cap |
| --- | --- | --- | --- | --- |
| `express-transport-belt` | 10 iron-gear-wheel + 1 fast-transport-belt + 20 lubricant | 1 | 0.5 | 30 |
| `express-underground-belt` | 80 iron-gear-wheel + 2 fast-underground-belt + 40 lubricant | 2 | 2 | 10 |
| `express-splitter` | 1 fast-splitter + 10 iron-gear-wheel + 10 advanced-circuit + 80 lubricant | 1 | 2 | 5 |
| `inserter` | 1 electronic-circuit + 1 iron-gear-wheel + 1 iron-plate | 1 | 0.5 | 5 |
| `long-handed-inserter` | 1 iron-gear-wheel + 1 iron-plate + 1 inserter | 1 | 0.5 | 5 |
| `fast-inserter` | 2 electronic-circuit + 2 iron-plate + 1 inserter | 1 | 0.5 | 5 |
| `bulk-inserter` | 15 iron-gear-wheel + 15 electronic-circuit + 1 advanced-circuit + 1 fast-inserter | 1 | 0.5 | 5 |

Assembling machine 2 crafting speed is 0.75. The stock cap counts the product in the provider chest plus any of it still on the ring.

## Inputs

Use normal-quality items. One steel chest (limited to one slot) per solid material on the north edge, filled by hand or by your own inserter from the north. Lubricant enters the pipe at the west edge. Coordinates are entity centres in the blueprint; north is negative y.

| Port | Material | Chest or pipe | Clear tile for your feeder | Flow | Label text | Stock kept on the ring |
| --- | --- | --- | --- | --- | --- | --- |
| IN-1 | `iron-gear-wheel` | (1.5, -1.5) | (1.5, -2.5) | North → south | `IN 1: iron-gear-wheel \| N -> S` | 20 |
| IN-2 | `iron-plate` | (3.5, -1.5) | (3.5, -2.5) | North → south | `IN 2: iron-plate \| N -> S` | 8 |
| IN-3 | `electronic-circuit` | (5.5, -1.5) | (5.5, -2.5) | North → south | `IN 3: electronic-circuit \| N -> S` | 14 |
| IN-4 | `advanced-circuit` | (7.5, -1.5) | (7.5, -2.5) | North → south | `IN 4: advanced-circuit \| N -> S` | 8 |
| IN-5 | `fast-transport-belt` | (9.5, -1.5) | (9.5, -2.5) | North → south | `IN 5: fast-transport-belt \| N -> S` | 4 |
| IN-6 | `fast-underground-belt` | (11.5, -1.5) | (11.5, -2.5) | North → south | `IN 6: fast-underground-belt \| N -> S` | 2 |
| IN-7 | `fast-splitter` | (13.5, -1.5) | (13.5, -2.5) | North → south | `IN 7: fast-splitter \| N -> S` | 2 |
| IN-8 | `lubricant` | (0.5, 6.5) | (-0.5, 6.5) | West → east | `IN 8: lubricant \| W -> E` | pipe |

The label of each chest is the display panel one tile east of its feed arm. The lubricant label is at the east end of the pipe, at (23.5, 6.5). Gears, circuits, the red-tier belt items and lubricant come from outside: this is an upgrade mall, not an ore-to-product factory.

**Electricity:** any outside pole within reach of one of the 5 medium poles powers the mall. The native test connects a pole at (-1.5, -3.5) to the pole at (3.5, 2.5); the pole inside the collector bend at (22.5, -0.5) is the nearest to the north edge. The label `POWER: connect medium pole \| external electricity` is at (0.5, -0.5).

**Output:** the one passive provider chest is at (21.5, 0.5), inside the bend at the east end, labelled `OUT: 3 express belts + 4 inserters \| one provider`. Take items by hand or cover it with a logistics network.

## How it works

- **One ring.** 52 red belt tiles form a single counter-clockwise loop two rows tall, with no splitter, side-load or underground. The westbound row passes under the seven chest feed arms; the eastbound row passes the machine arms. At the east end the loop bends north around the provider so that two collector arms reach the one chest (one arm has five filter slots, there are seven products).
- **One reader.** One belt reads the whole ring; the provider adds its contents to the same green wire.
- **Feed caps.** Each chest feed arm runs only while its material on the ring is below its cap (the last column above). The caps total 58.
- **Product caps.** Each machine's product arm runs only while ring plus provider hold less than the stock cap. Taking items from the provider reopens it. A product can overshoot its cap by one item in an arm's hand.
- **Three direct hand-offs,** always on, so a full stock of one inserter never starves the next recipe: yellow inserter → long-handed machine at (11.5, 4.5), yellow inserter → fast machine at (7.5, 4.5), fast inserter → bulk machine at (3.5, 4.5).
- **Arms.** All 31 arms are fast inserters with hand size one and whitelist filters. The splitter and underground machines have one ingredient arm each, the other five machines have two.
- **Lane room.** Everything rides the inner lane. Feed caps 58 + product caps 65 + one item in hand for each of the 14 capped arms = 137 items at the very most, against 184 inner-lane places when the 6 turn tiles are not counted at all. The most the native run ever saw on the ring was 63 items. Raise caps only together with this check.
- Machines keep their ordinary ingredient and product buffers while idle; those are not the advertised stock.

## Native test

Protocol (unchanged from the first version): supply only the seven chests, the outside pipe and outside power; 15 minutes to fill all stocks from empty; collect everything; 15 minutes to refill; collect; 5 minutes with the input chests emptied; collect; 15 minutes to recover. All seven products must sit at their caps at the end of each fill phase, never more than one over, and the provider may hold nothing else. The run also checks every route, recipe, circuit and power connection of the imported blueprint.

Result for `f537f1f1`: **passed**, 97 of 97 checks, 180000 ticks.

| Phase | All seven at cap after | Each product at cap after (minutes; belt / underground / splitter / inserter / long / fast / bulk) |
| --- | --- | --- |
| Fill from empty | 7.8 min | 7.8 / 4.8 / 1.9 / 0.9 / 0.9 / 1.3 / 1.3 |
| Refill after collection | 5.6 min | 5.6 / 2.8 / 0.8 / 0.8 / 0.3 / 0.9 / 0.4 |
| Recovery after outage | 7.9 min | 7.9 / 5.4 / 2.0 / 1.0 / 0.9 / 1.1 / 1.1 |

Crafts in the run: 96 express-transport-belt, 19 express-underground-belt, 19 express-splitter, 91 inserter, 23 long-handed-inserter, 48 fast-inserter, 26 bulk-inserter. Times are read once a second of game time; they are measurements, not pass limits.

Checked beyond the protocol, on this exact string (exploration runs; their reports are not kept in the repository):

- One-hour hold at full stock (`--explore --ticks stockFillTicks=216000`): the provider stayed at 30 / 10 / 5 / 5 / 5 / 5 / 6 (never more than cap + 1), at most 68 items rode the ring, and the later refill and recovery phases still passed.
- No advanced circuits (`--explore --withhold advanced-circuit`): the five products that do not need them still reached their caps in every phase; only express splitters and bulk inserters stayed at zero.
- No lubricant (`--explore --withhold lubricant`): the four inserter products still reached their caps in every phase; the three express products stayed at zero.

## Technology

- **Express products:** `logistics-3`, which needs production science and lubricant.
- **Inserters:** `electronics`, `automation`, `fast-inserter` and `bulk-inserter`. No Gleba research is needed.
- **Building it:** `automation-2`, `electric-energy-distribution-1`, `circuit-network`, and `construction-robotics` (or `logistic-robotics`) for the provider chest. The chest works as a plain chest without robots.

The full prerequisite list, in research order, is `technologyClosure` in the manifest (34 technologies); the native test researches exactly that list.

## Provenance

The design principle (one capped circulating belt read by one belt reader) and the seven recipe nodes come from `mall/compact_turbo_tesla_mall.txt` and `scripts/generate-belt-tesla-mall.mjs` in this repository; the manifest records their hashes under `reference`. Geometry, machines (assembling machine 2 instead of 3) and handling (fast inserters, red belts) are new. No performance comparison with that much larger mall is claimed.

## Reproduce

From the `factorio-command-center` folder:

```sh
node scripts/requested-malls/blue-tier-mall/generate.mjs     # rewrites this folder; byte-identical on a re-run
node scripts/requested-malls/blue-tier-mall/audit.mjs        # static audit
node scripts/requested-malls/blue-tier-mall/validate.mjs     # full native protocol, about one minute
node --test tests/requested-malls.test.mjs
```

The generator and the tests need only the pinned `scripts/requested-malls/blue-tier-mall/prototypes.json` (taken from the installed 2.1.24 game). The validator needs the Steam install of Factorio 2.1.24 with Space Age and runs it headless in a private profile under `.cache/blue-tier-mall/`; it never opens the player's saves. After a full run, run the generator again so this page states the new result.
