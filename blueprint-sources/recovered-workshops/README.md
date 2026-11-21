# Recovered workshops

Six compact builds recovered on 16 November 2026: three Luna compact production cells and three robot-ready forest versions. The library registers every row of [manifest.json](manifest.json).

## Luna compact production (regenerated 21 November 2026)

| Design | String | Footprint | Machines | Measured output | Inputs consumed |
| --- | --- | ---: | ---: | ---: | --- |
| Circuits 180/min | `luna-circuits-180.txt` | 9 x 11 = 99 | 3 cable + 2 circuit | 180/min in each of three 10-minute windows | 270 copper, 180 iron per minute |
| Circuits 360/min | `luna-circuits-360.txt` | 18 x 11 = 198 | 6 cable + 4 circuit | 360/min in each window | 540 copper, 360 iron per minute |
| Red science 90/min | `luna-red-science-90.txt` | 21 x 13 = 273 | 1 gear + 10 science | 90/min in each window | 90 copper, 180 iron per minute |

Every machine was working for all 1,800 measured seconds. Footprints count every entity, including the input panels and poles. Assembling machine 2, yellow belts, fast and bulk inserters, medium poles; no modules or beacons.

- **Circuits, direct hand-off.** Copper enters along the top row from the west and three cable machines take it with one arm each. Six cable arms (hand size pinned to one) pass cable straight into the two circuit machines below, three arms per circuit machine. Iron enters along the bottom row from the west, dives under the first output chest and feeds each circuit machine with one arm. Circuits go into two iron chests on the bottom row, west chest first. The 360 version is two cells side by side with their own copper and iron entrances, in the order copper, iron, copper, iron.
- **Red science, shared lane.** Copper enters from the north and gears come up from the gear machine. They side-load opposite lanes of one eastbound belt between two rows of five science machines. Science leaves on two eastbound belts at the top and bottom east corners. Iron enters from the west into the corner belt on the second row from the bottom, and two bulk arms feed the gear machine.

Generate with `node scripts/recovered-workshops/generate.mjs`. It needs no prototype dump and re-runs byte-identically. Qualify with `FACTORIO_RAW=<official 2.1.24 Space Age dump> node scripts/recovered-workshops/qualify.mjs`. The protocol is the one that qualified the original trials: an empty start, 15 simulated minutes of warm-up, then 30 measured minutes in three windows. Items enter only at the declared entrance belts, output is collected only at the declared outputs and electricity comes in at one saved pole. Inserter capacity research is not granted. It runs the flight native runner with the Factorio 2.1 solid-recipe adapter (`scripts/recovered-workshops/luna-native.mjs`), with private config and mods under `.cache/<id>/`. Each `<id>-native.json` is the report for that exact SHA-256.

The entrance panels state 270/180 per minute per circuit cell and 90/180 per minute for red science. At exactly 270 copper and 180 iron per minute, both the old and new 180/min cells deliver 180/min. The harness can only feed a belt in pairs of items, so a short screen (5 minutes of warm-up, 10 measured) fed 276.9 copper and 180 iron per minute. A request for 4.5 copper per second becomes 266.7 per minute, and both versions then make 177.8/min.

### Previous versions

| Replaced string | Kept in | Why replaced |
| --- | --- | --- |
| Circuits r6 `35dd7204`, 13 x 14 = 182 | `history/return-belt-35dd7204/` | The new cell has the same machines, rate and entrances in 46% fewer tiles, with 36 entities instead of 85 and no red belts or bulk inserters |
| Circuits r7 pair `bf4d6a63`, 26 x 14 = 364 | `history/return-belt-pair-bf4d6a63/` | Same as above, with 72 entities instead of 170 |
| Red science r4 `1231f0ae`, 23 x 13 = 299 | `history/edge-columns-1231f0ae/` | The east column held only one pole and the west column only the first iron belt and its panel. Both were removed, giving 9% fewer tiles |

`scripts/rgby-science/greens.mjs` reads the replaced 360 string from `history/return-belt-pair-bf4d6a63/luna-circuits-r7-360.txt` (unchanged bytes) as the geometry for the rgby-science and five-science greens blocks. It is not a library record. [LUNA-RESULTS.md](LUNA-RESULTS.md) is the original trial write-up for the replaced versions.

## Robot-ready forests

`robot-standing-grove`, `robot-robot-serviced-forest` and `robot-autonomous-forest` are the flight-forest designs with a roboport and logistic chests. Their reports come from a forest robot harness (control script SHA-256 `36e66c5c...`) that is not in this repository, so their strings are unchanged. Robot seed delivery and construction-robot building were measured only for the robot-serviced forest. The other two reports record roboport coverage with no robots supplied.
