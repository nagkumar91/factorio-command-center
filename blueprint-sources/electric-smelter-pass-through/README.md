# Electric smelter · ore through east, plates south

**Qualified.** One headless native run of the exact published string (SHA-256 `9c60d876232d36dee71889e40b4e39bd77f3a74eabe1bd6113e2b6ebc5bd705e`, Factorio 2.1.24 Space Age) passed 6 of 6 scenarios: **900 iron plates and 900 copper plates per minute** (target 900, 100%), every furnace crafting the same share. This main string has **no modules**; the versions with efficiency, productivity and speed modules are listed below with their own measured inputs and outputs.

A 24-furnace electric smelting station for iron or copper ore. Ore comes in on the west side and the station takes 900 ore per minute first; whatever it does not use carries straight on and leaves on the east side on the same row, so a second copy placed directly east receives it with no extra belts. Plates leave on the south side on one yellow belt (900 per minute is one full yellow belt, 450 per lane).

Derived from **"In-Out Electric Smelter"** in the Autosaved collection (id `autosaved-f3d991e31c13c301`, https://autosaved.org/factorio/blueprints). The pasted original is kept unchanged in `original/in-out-electric-smelter.txt` (SHA-256 of the trimmed string `3c702aa640dfad3ba28b3d1b80446c8a0a3879ac18fb516a3ad14c39f8310624`). The furnace block, its woven ore lanes, the substations and the roboports are the original's (the original requested 2 efficiency modules per furnace; that is the "Efficiency modules" version here).

## Versions: modules, inputs and outputs

Same 30 x 20 layout and ports for every version; only the module requests differ (and, for speed modules, belt and inserter tier). Figures are per copy, per minute, measured from each version's own native report (iron ore; copper measured the same figures). "Forwarded" is what leaves east when a full red belt (1,800 ore/min) comes in. Power is the electric network input of one working copy (furnaces, inserters, roboports), measured. Computed: from the 2.1.24 prototype numbers. Speed versions put plates out on a red belt; one red belt of ore feeds the copies shown, the last one partly.

| Version | Modules | Ore in | Plates out | Forwarded from a full red belt | Copies per red belt | Power (measured) | Computed ore in / plates out | Offered |
| --- | --- | ---: | ---: | ---: | --- | ---: | --- | --- |
| No modules | none | 900 | 900 | 900 | 2 | 4,834.9 kW | 900 / 900 | yes |
| Efficiency modules | 48 × efficiency module | 900 | 900 | 900 | 2 | 2,242.9 kW | 900 / 900 | yes |
| Productivity modules, tier one | 48 × productivity module | 809.9 | 874.9 | 990.1 | 2 + 180 ore/min | 8,274.9 kW | 810 / 874.8 | yes |
| Productivity modules, tier two | 48 × productivity module 2 | 720 | 806.4 | 1,080 | 2 + 360 ore/min | 9,980.4 kW | 720 / 806.4 | yes |
| Productivity modules, tier three | 48 × productivity module 3 | 630 | 755.5 | 1,170 | 2 + 540 ore/min | 11,688 kW | 630 / 756 | yes |
| Speed modules, tier one | 48 × speed module | 1,260 | 1,260 | 540 | 1 + 540 ore/min | 9,351.3 kW | 1,260 / 1,260 | yes |
| Speed modules, tier two | 48 × speed module 2 | 1,440 | 1,440 | 360 | 1 + 360 ore/min | 10,278.8 kW | 1,440 / 1,440 | yes |
| Speed modules, tier three | 48 × speed module 3 | 1,800 | 1,800 | 0 | 1 | 11,250.5 kW | 1,800 / 1,800 | yes |

Efficiency modules 2 and 3 are not separate versions: they give the same rates as no modules and lower power. Computed from the prototype numbers, the 24 furnaces' working power is 864 kW with efficiency module 2 and 864 kW with efficiency module 3 (consumption cannot fall below 20%, so tier 3 is no better than tier 2), against 1,728 kW with efficiency modules and 4,320 kW with none; the furnaces' idle drain (measured 144 kW for 24 furnaces in every version, unchanged by modules) comes on top. Measured in the main run with the modules swapped in by script: 1,378.9 kW and 1,378.9 kW for the whole copy, at 900 and 900 plates per minute. Quality modules are not offered.

Each version's string, manifest and native report: the main one in this folder, the others in `versions/<name>/`.

Ports of the main (no-module) string; the versions differ only in the rates and, for speed modules, a red plate belt.

| Port | Side | Tile (x, y) | Belt | What |
| --- | --- | --- | --- | --- |
| Ore in | west | (0, 1) | red belt | One red belt into the west face of the splitter on row 1. The station takes 900 ore per minute first; everything else continues east. |
| Ore out (forwarded) | east | (29, 1) | red belt | The same row as the entrance; 900 ore per minute from a full red belt. A copy placed 30 tiles east takes it with no extra belts; on the last copy it may stay unconnected. |
| Plates out | south | (29, 19) | yellow belt | One yellow belt leaving the south edge in the last column, 900 plates per minute. |

Tiles count from the top-left tile (0, 0) of the 30 x 20 rectangle. Row 1 is the second row from the top. Electricity: any of the four substations.

## Chaining stations

- Pitch: **30 tiles east**, touching: the west column of the next copy is the column right after the east column of this one. The forwarded ore of one copy runs straight into the entrance splitter of the next.
- Copies side by side share **one electric network**: the substations of neighbouring copies are 14 tiles apart and connect by themselves when the blueprint is built (measured with both copies built from the blueprint as ghosts and revived: one copper wire between the two copies, the second copy powered only through it). The roboports of neighbouring copies are 30 tiles apart and do not collide.
- **Red belt (1,800 ore/min): two copies at full rate.** Measured: 900 and 900 plates per minute, nothing left over at the east end.
- **Yellow belt (900 ore/min): one copy.** The first copy fills first and the second gets what is left (measured: 900 and 0 per minute).
- **Blue belt (2,700 ore/min): three copies' worth of ore, but the ore line inside each copy is red** (its entrance splitter, the row-1 belts and its one underground pair), so it passes at most 1,800 per minute: as built, a blue belt still feeds only two copies. Upgrade those parts of every copy to blue (express) to feed three. This is belt-speed arithmetic; the blue case was not run.

## Measured

Protocol per scenario: 10 min warm-up, then 10 min measured, 10 min "blocked" phase (only scenario 4 blocks anything), 3 min settle, 10 min recovery. Ore is fed saturated on an external belt of the scenario's tier; exits run onto short belts emptied every tick. Pass bar: 882 plates per minute (98% of 900) and every furnace within 2% of the mean crafts of its copy. The modules the string requests (two per furnace, or none) inserted into every furnace by script; item-request proxies removed; module inventories read back at the end of the measured window. No research: inserter hand size 1 (force inserter_stack_size_bonus 0). One electric energy interface north of copy 1 only. Power drawn is the electric network input statistics over the measured window of a single copy (furnaces, inserters and roboports).

| # | Scenario | Result | Measured (per minute) |
| --- | --- | --- | --- |
| 1 | One copy, red belt of iron ore | pass | 900 iron plates south (100%); 375 to 375 crafts per furnace; 900 ore forwarded east; no ore on the plate belt, no plates on the ore exit |
| 2 | Two copies at the pitch, red belt | pass | 900 and 900; one electric network (1 copper wire between copies), copy 2 powered only through it |
| 3 | Two copies, yellow belt | pass | belt accepted 900; copy 1 900, copy 2 0; still 900 for copy 1 in the last 10 minutes |
| 4 | Copy 1's plate exit blocked | pass | before: 900 / 900; blocked: copy 1 made 0 plates in the last minute, copy 2 900 with 515.7 ore passing on east; after unblocking: copy 1 900, copy 2 900 |
| 5 | East end unconnected | pass | 900 plates, 900 in the last 10 minutes; 375 to 375 crafts per furnace |
| 6 | One copy, copper ore | pass | 900 copper plates (100%); 375 to 375 crafts per furnace; 900 ore forwarded |
| 7 | One copy, stone (not a pass condition) | measured only | 746.7 stone bricks (83% of 900); 262 to 375 crafts per furnace; 306.2 stone forwarded |

Stone works at a reduced rate: a brick takes 2 stone, so each furnace needs 1.25 stone per second at full speed, twice what iron or copper needs, and the slowest furnaces did not get it (fewest crafts above). Expect about 746.7 bricks per minute from a saturated red belt.

Report: `native-report.json` (created 2026-11-22T02:54:48.808Z, run folder `.cache/electric-smelter-pass-through/native-no-modules-1795316043337`, git-ignored).

## Size, before and after

| | Original | This station |
| --- | ---: | ---: |
| Footprint | 28 x 20 = 560 tiles | 30 x 20 = 600 tiles |
| Entities | 162 | 212 |
| electric-furnace | 24 | 24 |
| fast-inserter | 10 | 10 |
| fast-splitter | 0 | 2 |
| fast-transport-belt | 0 | 33 |
| fast-underground-belt | 22 | 26 |
| inserter | 38 | 38 |
| roboport | 2 | 2 |
| splitter | 3 | 3 |
| substation | 4 | 4 |
| transport-belt | 51 | 64 |
| underground-belt | 8 | 6 |

## What changed from the original

- Original ports: Ore in and plates out both on the west side; no ore leaves the station, so copies cannot share one ore line without extra belts.
- Ore now runs through: a red belt along row 1 from the west edge to the east edge, starting with a red splitter whose priority output feeds the station.
- Plates leave on the south edge (last column) instead of the west edge: the two plate lanes now flow east and merge in a splitter on the east side.
- The first splitter of the ore split became a red splitter fed from above by a red belt; the other two splitters and all four ore lanes are unchanged.
- Same 24 furnaces, same 38 inserters and 10 fast inserters, same 4 substations and 2 roboports on the same tiles. 30 x 20 instead of 28 x 20: two columns more on the east side for the plate exit; the west side keeps its width (the entrance splitter stands where the old input belt was, the west plate merge is gone).
- Module requests: the original asked for 2 efficiency modules in each furnace. The main string now has none; efficiency, productivity and speed versions are kept beside it.
- Tiers (no-module, efficiency and productivity versions) are unchanged except for two red (fast) splitters, the tier of the red belts and underground belts the original already used: the entrance splitter has to pass a red belt, and the first split splitter takes the full 900 ore per minute. No beacons, no bulk or stack inserters, no circuit wires, no higher-tier machines. The speed versions use the same tiles with every belt, underground belt and splitter red and every inserter fast.

## Layout

```
  0 ..............RRRR............
  1 Q}}}}}}}}}}}}URRRRO}}}}}}}}}}}
  2 QV.>>>>>>>>>>uRRRRo>>>>>>.....
  3 .V.^...ii..SSiRRRRiSS..ii.....
  4 .V>^.FFFFFFSSFFFFFFSSFFFFFF...
  5 .V^>UFFFFFFOUFFFFFFOUFFFFFFO..
  6 .VPPfFFFFFFffFFFFFFffFFFFFFi..
  7 .V.oFFFiiFFFFFFiiFFFFFFiiFFF..
  8 .V..FFF>UFFFFFFOUFFFFFFOUFFFOv
  9 .V..FFFiiFFFFFFiiFFFFFFiiFFF.v
 10 .V..iFFFFFFiiFFFFFFiiFFFFFFi.v
 11 .V..UFFFFFFOUFFFFFFOUFFFFFFOvv
 12 .QQuiFFFFFFiiFFFFFFiiFFFFFFivv
 13 .v>^FFFffFFFFFFffFFFFFFfiFFFvv
 14 .>PUFFFOUFFFFFFOUFFFFFFO>FFFvv
 15 ..PvFFFSSFFFFFF..FFFFFFSSFFFvv
 16 ...vi..SS..ii.RRRR.ii..SSi..vv
 17 ...>>>>>>>>>>uRRRRo>>>>>>>..vv
 18 ..............RRRR..........PP
 19 ..............RRRR...........v
```

`F` electric furnace, `S` substation, `R` roboport, `i` inserter, `f` fast inserter, `> v < ^` yellow belts, `} V { A` red belts, `U`/`O` red underground entry/exit, `u`/`o` yellow underground entry/exit, `Q` red splitter, `P` yellow splitter. Ore enters at (0,1), leaves at (29,1); plates leave at (29,19).

The original, for comparison (ore in at the west on row 13, plates out at the west on row 9):

```
  0 ..............RRRR..........
  1 ..............RRRR..........
  2 ...>>>>>>>>>>uRRRRo>>>>>>...
  3 ...^...ii..SSiRRRRiSS..ii...
  4 ..>^.FFFFFFSSFFFFFFSSFFFFFF.
  5 ..^>UFFFFFFOUFFFFFFOUFFFFFFO
  6 ..PPfFFFFFFffFFFFFFffFFFFFFi
  7 ...oFFFiiFFFFFFiiFFFFFFiiFFF
  8 ..voFFFuOFFFFFFUOFFFFFFU<FFF
  9 .<<.FFFiiFFFFFFiiFFFFFFiiFFF
 10 ..^<iFFFFFFiiFFFFFFiiFFFFFFi
 11 ...^OFFFFFFUOFFFFFFUOFFFFFFU
 12 ...uiFFFFFFiiFFFFFFiiFFFFFFi
 13 >P>^FFFffFFFFFFffFFFFFFfiFFF
 14 .PPUFFFOUFFFFFFOUFFFFFFO>FFF
 15 ..PvFFFSSFFFFFF..FFFFFFSSFFF
 16 ...vi..SS..ii.RRRR.ii..SSi..
 17 ...>>>>>>>>>>uRRRRo>>>>>>>..
 18 ..............RRRR..........
 19 ..............RRRR..........
```

## Reproduce

From `factorio-command-center/`:

```
node scripts/electric-smelter-pass-through/generate.mjs     # writes electric-smelter-pass-through.txt, manifest.json and this README
node --test tests/electric-smelter-pass-through.test.mjs
FACTORIO_RAW=<2.1.24 Space Age data-raw-dump.json> node scripts/electric-smelter-pass-through/validate.mjs   # headless, private profile under .cache/electric-smelter-pass-through/
node scripts/electric-smelter-pass-through/generate.mjs     # again, to take the measured figures into the manifest and README
```
