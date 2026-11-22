# Processing-unit supply · 40/min

**Qualified.** Full native run of the exact string (SHA-256 `cf842c990d71c25fa7d799a7bf365e3d7c4724e9de83fc81d87e99198da9ecca`) on the family's Factorio 2.1.24 flight-save profile, every inlet fed exactly its panel figure: **40.00 processing units per minute steady and 40.00 in recovery** (target 40, pass bar 38).

This supply factory feeds the processing-unit entrance on the south end of the Compact six-pack tier (`../../compact/`, 40/min). Like the family's other supply factories it has one inlet per material on the left, a display panel for each, and one collection chest on the right. It holds only the nine processing-unit machines: electronic circuits and advanced circuits come from their own supply factories, sulfuric acid by pipe.

## Size and machines

- **36 x 7 = 252 tiles.**
- 9 assembling machine 2 making processing units, no modules. 28 fast inserters (hand size 1), 71 red belts, 19 pipes, 8 pipes-to-ground, 1 steel chest (2 slots), 1 big and 6 medium electric poles, 4 display panels. 147 entities. No underground belts, no robots, no circuit wires, no inserter capacity research.

## Figures (from the prototype dump)

Processing unit: 10 s, 20 electronic circuits + 2 advanced circuits + 5 sulfuric acid -> 1. An assembling machine 2 (speed 0.75) makes 4.5 per minute, so 40 per minute needs 8.89 machines: **9 machines** (40.5 per minute at most). At 40 per minute:

| Inlet (west) | Tile | Per minute | Panel |
| --- | --- | ---: | --- |
| `advanced-circuit` (red belt) | (0,1) | 80 | (0,0) |
| `electronic-circuit` (red belt) | (0,3) | 800 | (0,2) |
| `sulfuric-acid` (pipe) | (0,6) | 200 | (2,5) |

| Outlet (east) | Tile | Per minute | Panel |
| --- | --- | ---: | --- |
| `processing-unit`, filtered fast inserter into a steel chest | (35,6) | 40 | (35,5) |

Tiles count from the top-left corner of the 36 x 7 rectangle. Electricity: the big pole at (0..1, 4..5) is the power port. Each belt inlet may carry its item on either lane.

## How it works

```
  0 D>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>.   input belt: circuits on the south lane, advanced circuits on the north lane
  1 >^^.i.ii.i.i.ii.i.i.ii.i.i.ii.i.i.i.   two feed arms per machine
  2 D^^oWWWEEEoWWWEEEoWWWEEEoWWWEEEoWWW.
  3 >>^=WWWEEE=WWWEEE=WWWEEE=WWWEEE=WWW.   machines face west (W) and east (E) in pairs; acid in the gap columns
  4 BB.=WWWEEE=WWWEEE=WWWEEE=WWWEEE=WWW.
  5 BBD=pi..ip=pi..ip=pi..ip=pi..ip=oi.D   output arms and the acid header (pipe-to-ground hops)
  6 ====.>>>>>>>>>>>>>>>>>>>>>>>>>>>>>FC   acid inlet; processing-unit belt to the chest
```

`W`/`E` assembling machine 2 facing west/east, `i` fast inserter, `F` filtered fast inserter, arrows red belts, `=` pipe, `p` pipe-to-ground, `C` steel chest, `D` display panel, `o` medium pole, `B` big pole.

- **One row, both sides used.** Each machine needs three things on belts (circuits, advanced circuits in; processing units out). One belt has two lanes and a fast inserter reaches one belt, so the inputs run on the north side and the output on the south side. Sharing a lane between two items would let leftovers of one block the other at the belt's end.
- **Lanes.** The input belt starts in the west strip with a right-hand curve fed from column 1. Advanced circuits side-load that column's west lane, and the curve turns it into the belt's north lane. Circuits come up column 2 and side-load the south lane. 800 circuits per minute is 89% of one lane (a red-belt lane carries 900 per minute).
- **Acid.** With this recipe an assembling machine 2 has one acid input, in the middle of the side it faces. The machines face west and east in pairs, so each pair's inputs meet in a one-tile gap column (pipes at rows 3..5). The gap columns are joined along the output-arm row by pipe-to-ground pairs 5 tiles apart, which use one arm tile at the edge of the machines on either side. The inlet runs along row 6 into the westmost gap column. The harness confirms that all nine machines are on the inlet's fluid segment.
- **Output.** Each machine drops its processing units on the south lane of the bottom belt with one fast inserter; the belt ends at the filtered fast inserter that fills the chest. Nothing else is on that belt.
- No ring and no stock control: every lane carries one item, so there is nothing to limit (`loopControl: []`). The green-circuit supply factory works the same way.

What to keep: the machines' facing, the pipe-to-ground pairs, the curve and the two side-loads at the start of the input belt, and the chest filter.

## Native evidence

- `native-report.json`, `passed: true`, `short: false`, for the exact `blueprintSha256` in `manifest.json`. Prototype dump SHA-256 `33912441b13d155b13734523406bbc9aa81fc0f2992344b56106b3aa5c52d19f` (the family's flight-save dump; `catalog-manifest.json` `currentPrototypeSha256`).
- Profile: the family's validator (`tests/flight-science-sided-native.mjs`) uses the copied mod profile `.cache/flight-21` (base, elevated-rails, quality, recycler, space-age, Better-Power-Armor-Grid, EON-FulgoraDiscovered, ev-assets, ev-machines, ev-mining-drills, visible-planets enabled; mod list in the report). This run used a private copy of the same profile (`.cache/heavy-supplies/flight-21`) whose `--dump-data` reproduces that SHA-256 exactly. Headless `--benchmark` with a private `--config` and mod directory; the live game data was not used.
- Protocol: the family's supply protocol, 15 min warm-up, 30 min measured, collection paused 5 min, 2 min settling, 3 min recovery. Harness `scripts/flight-science-sided/heavy-supplies/processing-unit-supply/control.lua` (the family harness's import, geometry, power and route checks, with metered feeding): each belt inlet gets its panel figure / 3600 items of credit per tick, one item at a time on alternating lanes; the acid inlet gets 200 / 3600 per tick plus what it refused before. Nothing else is written. The chest is emptied of processing units every second and read for any other item.
- Measured (per minute, 30-minute window):
  - Output 40.00 steady, 40.00 in recovery. Made 40.00.
  - Inlets accepted circuits 800.0, advanced circuits 80.0, acid 200.0 (recovery window: 800.7, 80.0, 200.0). Machines used circuits 800.0 and advanced circuits 80.0.
  - Every machine crafted: eight at 4.5 (135 crafts), the eastmost at 4.0 (120): the feed is 40, the machines can do 40.5.
  - Only processing units ever in the chest (`wrongItemsAtOutlet: {}`). The chest held 200 at the end of the 5-minute pause (2 slots hold 200 each).
  - All nine machines on the acid inlet's fluid segment.
- **80% feed** (`feed-80-report.json`, same string and protocol, every inlet at 80%: 640, 64, 160): 32.00 steady and 32.33 in recovery; every inlet accepted exactly 80% (no backing up), only processing units in the chest. The western machines take the whole feed, the eastmost one idles; the report's pass flags are against the 40 target, so it reads `passed: false` by design.

## Candidates

All candidates use the same 9 machines, the same paired facing with acid gap columns, and the same inlets. Screens: 5 min warm-up, 10 min measured, 2 min paused, 1 min settling, 3 min recovery, panel-figure feed.

| Candidate | Size | Result |
| --- | --- | --- |
| `two-row`, first build: 5 over 4 machines facing one shared input belt, each row's output on its own outer belt, the top one turning down the east side | 25 x 13 = 325 | 18.0 per minute. The input belt's last tile pointed into the turn column and side-loaded circuits onto the processing-unit belt; the top row backed up. Not kept. |
| `two-row` (input belt one tile shorter) | 25 x 13 = 325 | Screen 40.00 steady, 40.00 recovery, all checks passed. |
| `one-row-wide`: one row, west strip 4 columns, acid by a pipe-to-ground pair | 37 x 7 = 259 | Screen 40.00 steady, 40.00 recovery, all checks passed. |
| `one-row` (published): west strip 3 columns, acid by plain pipes along the bottom row, big pole in the strip | 36 x 7 = 252 | Full protocol 40.00 / 40.00, passed; 80% feed 32.00 / 32.33. |

The two-row layout that shares one belt pair between both rows needs either long-handed inserters or mixed lanes (three items per row on two lanes), so it was not built; the shared single input belt is the two-row form that keeps one item per lane.

## Reproduce

From `factorio-command-center/`:

```
node scripts/flight-science-sided/heavy-supplies/processing-unit-supply/generate.mjs           # writes the string and manifest.json (status from native-report.json)
node scripts/flight-science-sided/heavy-supplies/processing-unit-supply/validate.mjs           # full protocol, writes native-report.json
PUS_EXPLORE=1 PUS_FEED_SCALE=0.8 PUS_REPORT=<file> node scripts/flight-science-sided/heavy-supplies/processing-unit-supply/validate.mjs
node scripts/flight-science-sided/heavy-supplies/processing-unit-supply/ascii.mjs
node --test tests/heavy-supply-processing-unit.test.mjs
```

`--variant one-row-wide|two-row --out <dir>` regenerates a screened candidate; `PUS_SOURCE=<dir>` validates it. The generator needs the family prototype dump (`.cache/heavy-supplies/flight-21/...`, `.cache/flight-21/...` or `FLIGHT_RAW`); it keeps the committed string when a regeneration decodes to the same blueprint. The validator needs the profile's mods (`FACTORIO_PROFILE`, default `.cache/heavy-supplies/flight-21`).
