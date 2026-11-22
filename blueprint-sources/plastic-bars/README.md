# Plastic bar suppliers · 240, 600 and 1,200 per minute

**All three sizes are qualified.** Each one was measured over a full native run of its exact published string, fed exactly the panel figures. Each made its full target, steady and in recovery.

These modules turn coal and petroleum gas into plastic bars and send them out east on one red belt. They supply the library blueprints that take plastic as an input (see "Which size for which blueprint").

## The three sizes

| | Small | Medium | Large |
| --- | ---: | ---: | ---: |
| File | `plastic-bars-small.txt` | `plastic-bars-medium.txt` | `plastic-bars-large.txt` |
| Chemical plants | 2 | 5 | 10 |
| Plastic bars out (target) | 240/min | 600/min | 1,200/min |
| Measured steady / recovery | 240.0 / 240.0 | 600.0 / 600.0 | 1,200.0 / 1,200.0 |
| Exit lanes (north / south) | 0 / 240 | 0 / 600 | 600 / 600 |
| Coal in (panel = measured) | 120/min | 300/min | 600/min |
| Petroleum gas in (panel = measured) | 2,400/min | 6,000/min | 12,000/min |
| Size | 8 x 7 = 56 tiles | 17 x 7 = 119 tiles | 17 x 12 = 204 tiles |
| Tiles per bar per minute | 0.233 | 0.198 | 0.170 |
| Entities | 25 | 63 | 97 |
| SHA-256 | `cedfbbb3625152248f7a9d5729c7e94fb9466e6b3d4c2ef3a2b7a5750663a282` | `13de60bc54744e51cbfd6016c15e41faecbc4e66cc3b368fa0bee1cbfe4b7fbd` | `3574850043cb897414af00399e1f18da975e20abd7e0e724da682c785c474717` |

The figures come from the 2.1.24 Space Age prototype dump. Recipe `plastic-bar`: 20 petroleum gas + 1 coal gives 2 plastic bars in 1 s. Chemical plant crafting speed: 1. So one plant makes 120 bars per minute and takes 60 coal and 1,200 gas per minute. The three sizes are the plant counts that cover the library's demand: 2 plants for every blueprint that takes 180 or less, 5 for 520, 375 and 320, and 10 for 1,040 (measured draw 1,190.8).

Parts: chemical plants, red belts, bulk arms (hand 2), long-handed arms (hand 1), fast arms (hand 1, large only), pipes, pipe-to-ground and one substation each. No modules, beacons, robots, splitters, circuit wires or chests.

## Ports (the same in all three sizes)

Tile (0,0) is the top-left corner of the rectangle; x grows east and y grows south.

| Port | Tile | Side | What to connect |
| --- | --- | --- | --- |
| Coal | (0,6) | west | One belt from the west; coal may be on either lane or both. Display panel at (0,5), just above it. |
| Petroleum gas | (0,0) | west | One pipe, the top-left corner tile. A liquids blueprint placed to the west joins it with a straight pipe along row 0. The pipe also connects north, so a straight pipe from the north works too. Display panel at (2,0). |
| Plastic bars | (16,5) large and medium, (7,5) small | east | One red belt exit, fed from behind. |
| Electricity | substation on (6..7, 2..3) | any | One substation covers the whole module. |

The coal entrance is on the same tile in every size, and so is the gas pipe. The exit is on row 5 in every size. A small can be swapped for a medium or large without moving the inputs.

Blocked exit: when nothing takes plastic, the exit tile holds 4 bars per lane in use (4 in small and medium, 8 in large), and every plant stops.

## Layouts

```
small 8 x 7                    medium 17 x 7
  0 = o D o = = . .              0 = o D o = = = = = = = = = = = . .
  1 P P P P P P . .              1 P P P P P P . . P P P P P P P P P
  2 P P P P P P S S              2 P P P P P P S S P P P P P P P P P
  3 P P P P P P S S              3 P P P P P P S S P P P P P P P P P
  4 l b . l b . . .              4 l b . l b . . . l b . l b . l b .
  5 D > > > > > > >  ->          5 D > > > > > > > > > > > > > > > >  ->
  6 > > > > . . . .              6 > > > > > > > > > > > > > > > . .

large 17 x 12
  0 = o D o = = = = = = = = = = = . .
  1 P P P P P P o . P P P P P P P P P
  2 P P P P P P S S P P P P P P P P P
  3 P P P P P P S S P P P P P P P P P
  4 l b . l b . . . l b . l b . l b .
  5 D > > > > > > > > > > > > > > > >  ->
  6 > > > > > > > > > > > > > > > . .
  7 f l l f l l . f l l f l l f l l .
  8 P P P P P P . P P P P P P P P P .
  9 P P P P P P . P P P P P P P P P .
 10 P P P P P P o P P P P P P P P P .
 11 . . = = = = = = = = = = = = . . .
```

`P` chemical plant, `S` substation, `b` bulk arm, `l` long-handed arm, `f` fast arm, `=` pipe, `o` pipe-to-ground, `D` display panel, arrows are belts. Row 5 is the plastic belt, row 6 the coal belt.

## How it works

- **Two belts, never mixed.** Row 5 carries only plastic to the exit. Row 6 carries only coal and ends a few tiles short of the east edge, so coal can never reach the exit.
- **Top row of plants (all sizes), facing north.** Each plant has a bulk arm on row 4 that takes its plastic and drops it on row 5, on the south lane. It also has a long-handed arm on row 4 that reaches over row 5 and takes coal from row 6.
- **Bottom row of plants (large only), facing south.** Each plant has a fast arm on row 7 that takes coal from row 6. Two long-handed arms reach over row 6 and drop plastic on row 5, on its north lane. So the large exit carries 600 per lane.
- **Gas.** Plants facing north take gas through their north side, so the top row draws from the pipe row 0. With the plastic recipe both north inputs of a plant feed one fluid box (native probe), so one pipe on either input is enough. In row 0, a pipe-to-ground pair (1,0) to (3,0) leaves (2,0) free for the gas panel. In the large, a second pipe-to-ground pair runs from (6,1) down to (6,10) and joins row 0 to the bottom pipe row 11.
- **Power.** One substation stands in a two-column gap of the top plant row, columns 6 and 7. Its supply area covers columns -2 to 16. In the large, the bottom row has its own one-column gap at column 6 (under the pipe riser) and ends at column 15, so every arm stands in columns 0 to 15. The small has its substation at the east end; the gap is not needed there.
- **Arm capacity, checked natively.** One long-handed arm on a full coal belt kept a plant at 60 crafts per minute, its full speed. Two long-handed arms kept up with a plant's output, and its output slot stayed empty. Bulk arms hold at most 2 (they never went above 2 in the runs).

What to keep: the two belts on separate rows, the hand-size overrides (bulk 2, others 1), the pipe-to-ground pairs, and the empty tiles at the east end of the coal belt.

## Which size for which blueprint

From the read-only demand survey of the library, 2026-11-22: `.claude/tmp-factorio-fluids/demand-survey.md`, outside this repository. "Panel" is the blueprint's own published figure; "measured" is its native draw where one is published. One red belt carries 1,800 per minute, so outputs of several suppliers can share a belt.

| Blueprint | Plastic per minute (panel) | Measured draw | Supplier |
| --- | ---: | ---: | --- |
| flight-science-sided / six-pack-integrated-60 | 1,040 | 1,190.8 | 1 large (1,200). Covers the measured on-demand draw with 9.2 to spare; add 1 small (1,440 total) for headroom. |
| five-science-30 (also labs-15, labs-30) | 520 | 566.2 to 569.6 | 1 medium (600) |
| six-science | 520 | 518.8 | 1 medium |
| advanced-circuits | 375 | 375 | 1 medium |
| rgby-science-30 (also labs-15, labs-30) | 320 | 329.8 to 330.2 | 1 medium |
| flight-science / rgb-60, rgb-military-60 | 180 | 193.5 | 1 small (240) |
| flight-science-sided / advanced-circuit-supply | 180 | 180 | 1 small |
| flight-science-sided / hybrid-six-pack-sided-60 | 180 | 180 | 1 small |
| robot-logistics-workshop | 146 | 165.9 | 1 small |
| flight-robots / robots-10-roboport-1 | 130 | 134.67 (its README advises 149.5) | 1 small |
| processing-units | 108 | 106.3 | 1 small |
| robot-essentials | 73 | 83.9 (saturated) | 1 small |
| rocket-supplies | 45 | 45 | 1 small |
| launch-kit | 29 | 24.8 (kit average) | 1 small |
| compact-expansion-workshop | no panel | 14.97 | 1 small |
| essentials-mall | 12 | 30 (saturated run) | 1 small |
| inserter-workshop | 7 | 5.2 | 1 small |

One small can serve several small consumers together, up to 240 in total, for example robot-essentials + rocket-supplies + launch-kit + essentials-mall + inserter-workshop at their panels (166). The intermittent malls and workshops draw only while their chests refill.

## Native evidence

- Reports: `native-report-small.json`, `native-report-medium.json` and `native-report-large.json`. Each says `passed: true` for the exact `blueprintSha256` in `manifest.json`, with `feedScale: 1`. Factorio 2.1.24 Space Age, headless, with a private config and mod directory; the user's game data is not touched. Prototype SHA-256 `ce40aee67d984865f22ed8e65ba6b93fefb014fc35e45b747b64aca3ed5682a3`.
- Protocol: 15 min warm-up, 30 min steady, 5 min blocked (collection stopped), 5 min settle, 10 min recovery.
- Feeding: the coal belt gets panel/3,600 items of credit per tick, inserted one at a time on alternating lanes. The gas pipe gets panel/3,600 per tick plus whatever it refused before. Nothing else is written. Collection: the exit tile every 4 ticks, except while blocked.
- Measured at exactly the panel figures, in every size:
  - Steady and recovery output both equal the target.
  - Coal and gas drawn equal the panel figures (table above).
  - Every plant made 1,800 crafts in the 30-minute window, its full rate.
  - Nothing but plastic was seen on the exit tile (`wrongItemsAtExit` empty).
  - The exit held exactly its cap when blocked, and no plant crafted in the last blocked minute.
  - All 13 checks passed.
- Fed at 80% (exploration runs with the full phase lengths, not stored here; `PB_EXPLORE=1 PB_FEED_SCALE=0.8`): small 192.0, medium 480.0, large 960.0 per minute steady and in recovery, exactly 80%. Nothing jammed; the exit cap and the stop while blocked still held. In the medium and large, the plants at the east end of the coal belt slow or stop first, because the western plants take their coal first; with full feed every plant runs.

## Candidates tried for the large

| Candidate | Size | Result |
| --- | --- | --- |
| Shared aisle, bottom row aligned with the top (plants at the same columns, last bottom plant mirrored) | 17 x 12 = 204 | Did not import. Its last bottom fast arm stood in column 16, outside the substation's reach, and the harness stopped at the power check. Nothing was measured. |
| **Shared aisle, bottom row offset (published)** | **17 x 12 = 204** | Short screen 1,200 / 1,200 per minute, lanes 600 / 600. Full protocol passed (above). |
| Filter splitter: the bottom plants drop plastic on the coal belt's free lane with bulk arms, and a filtered fast splitter at the east end sends plastic to the exit while holding the coal lane | 18 x 12 = 216 | Short screen (3 + 5 + 2 + 1 + 2 minutes) 1,200 / 1,200 per minute, lanes 600 / 600, no coal at the exit, exit held 8. Not published: 12 tiles larger. `node scripts/plastic-bars/generate.mjs --size large --variant large-filter-splitter --out <dir>` rebuilds it. |

Native probes on 2026-11-22 established the facts this design rests on:
- A chemical plant set to plastic has one fluid box, filtered to petroleum gas. Both north inputs connect to it, and the inputs rotate with the plant as the dump says.
- A pipe-to-ground's direction is its above-ground side.
- One long-handed arm on a full belt, or two on a plant's output, keep a plant at full speed.
- A filtered fast splitter lets plastic pass while the coal lane behind it stays stuck.

Why the sizes are not smaller:
- One plant row with both belts needs 7 rows: pipes, plants, arms, plastic belt, coal belt.
- One plastic lane carries at most 900 per minute, so the large needs plants on both sides of the plastic belt.
- The substation needs a 2 x 2 hole in a plant row, which costs two columns. In the medium and large it must stand in the middle to reach both ends.
- A medium built as two rows (3 + 2 plants) would be 11 x 12 = 132 tiles, more than the 119 of the one-row medium.

## Reproduce

From `factorio-command-center/`:

```
node scripts/plastic-bars/generate.mjs                      # writes the three strings and manifest.json
node scripts/plastic-bars/validate.mjs --size small         # full protocol, writes native-report-small.json (also medium, large)
node scripts/plastic-bars/generate.mjs                      # same strings; status from the matching reports
node scripts/plastic-bars/ascii.mjs                         # tile maps
node --test tests/plastic-bars.test.mjs
```

The generator reads no game data: the recipe figures are constants, checked against the prototype dump when the dump is readable. A re-run leaves this folder byte-identical. A committed string is kept whenever a regeneration decodes to the same blueprint, because another zlib build may compress it differently. `PB_EXPLORE=1` with `PB_WARMUP`, `PB_MEASURE`, `PB_BLOCKED`, `PB_SETTLE` and `PB_RECOVERY` (minutes) runs a short screen into `.cache/plastic-bars/explore-<size>.json`. `PB_FEED_SCALE` (exploration only) feeds a fraction of the panel figures, and `PB_SOURCE=<dir>` validates a candidate in another folder. The harness `scripts/plastic-bars/control.lua` is a copy of the processing-unit supplier's throttled harness. Only its error prefix and surface names differ.
