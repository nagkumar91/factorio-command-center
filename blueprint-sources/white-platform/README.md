# White-pack platform · 60/min in Nauvis orbit

**Status: qualified.** A full-protocol native run of this exact string (SHA-256 `0bed64aac34ad341799b26411c021e46b11f071656196ddeb1c53ae070713604`) passed every check in `native-report.json`, together with the white-pack receiver (`blueprint-sources/white-pack-receiver/`).

A space platform parked in Nauvis orbit. It makes 60 space science packs per minute from asteroid chunks and keeps them in the hub. Cargo pods carry them down to the white-pack receiver on Nauvis by themselves. It has no thrusters, no fuel and no defence. It builds itself on the platform that one space platform starter pack creates, from **four** full rockets of parts. Counting the starter pack, that is five launches in all.

## What it is

- **Target:** 60 space science packs per minute into the hub. Measured: 60.00 per minute collected at the receiver chest and 60.00 made over the 120-minute measurement.
- **Footprint:** 247 foundation tiles in a 17 x 16 rectangle (x -8..8, y -8..7, hub at 0,0); every entity, the collectors' overhanging rows included, is inside it. The starter square gives 100 tiles, and the kit supplies the other 147: 137 foundation plus the starter pack's 10 spare. Goal: 283 tiles or fewer. The version before this one used the same 247 tiles in 19 x 16.
- **Machines:**
  - 4 assembling machine 2 (space science pack)
  - 1 electric furnace (iron plate)
  - **1 crusher** whose recipe the circuit network sets: oxide, metallic and carbonic asteroid crushing in turn
  - 4 asteroid collectors, one per side
- **Power:** 6 solar panels (180 kW each in Nauvis orbit, 1,080 kW) and 4 accumulators (1,200 kW of output for the peaks). No poles: a platform has one electric network.
- **Control:** 16 fast inserters (hand 1), 1 constant combinator, 1 arithmetic combinator and 5 decider combinators. No belts, no chests.
- **Inputs:** none. After it is built, the platform uses only the asteroid chunks it collects. At 60 packs per minute it runs, per minute, 2.4 oxide, 1.2 metallic and 1.2 carbonic crushing crafts (12 ice, 24 iron ore, 12 carbon), 24 iron plates and 12 science crafts. The generator computes all of these from the game data.
- **Output:** the hub. Science stops at 2,000 packs in the hub and restarts by itself. The ceiling is 2,100, and the 2,060 measured include what the four machines already held.

```
 SSSAAACCCAAA  SSS      S solar panel      A science machine (assembling machine 2)
 SSSAAACCCAAABBSSS      C asteroid collector (its outer row hangs over open space)
 SSSAAACCCAAABBSSS      X crusher (2 wide) F electric furnace
 SSS.iikiaaii.AAA       B accumulator      H hub (8 x 8)
 SSS.HHHHHHHHiAAA       i fast inserter    k constant combinator
 SSS.HHHHHHHHiAAA       a arithmetic combinator
 CCC.HHHHHHHHiCCC       d decider combinator
 CCCiHHHHHHHHdCCC       . foundation, free
 CCC.HHHHHHHHdCCC
    .HHHHHHHHiXXBB
 SSSdHHHHHHHHiXXBB
 SSSdHHHHHHHHdXXBB
 SSS.ii.iddiidddBB
 SSSFFFCCCAAABBSSS
 SSSFFFCCCAAABBSSS
 SSSFFFCCCAAA  SSS
```

Every machine stands next to the hub. It takes its ingredients from the hub with one arm and puts its products back with another, and both arms stand on the starter square's ring around the hub. Each side of the hub has a collector in the middle:

- **North:** two science machines.
- **East:** one science machine and the crusher, turned so it is 2 wide.
- **South:** the furnace and one science machine.
- **West:** only its collector, between two solar panels.

The power stands in the rest of the 17 x 16 rectangle: a solar panel in each corner and two on the west side, two accumulators behind the crusher and one each in the two-tile gaps beside the north-east and south-east corner panels. The clock decider stands on the two tiles south of the crusher; every other combinator is on the starter ring. Nothing is built in the four rows in front of a collector.

## How the control works

- **Hub network (red).** The hub reads its contents onto a red wire. This is on by default, and the harness checks it after the paste.
  - The four science ingredient arms run while the hub holds fewer than 2,000 packs.
  - The furnace arm has an iron-ore filter, so it cannot feed plates back and make steel. It runs while the hub holds fewer than 100 iron plates.
- **Collection network (green).** The constant combinator holds 6 for each chunk type. The arithmetic combinator writes minus the hub contents onto the same green wire. Every collector filters by circuit, so it sees 6 minus the hub's count and collects a chunk type only while the hub holds fewer than 6 of it. Surplus chunks are never collected, so nothing has to be thrown overboard and the hub cannot fill with chunks.
- **Crusher clock and recipe network.** A decider counts `signal-T` from 1 to 900 ticks on green.
  - **Recipe deciders.** There is one per crushing recipe. Each reads the clock on green and the hub on red. It sends its recipe signal (value 1) on a separate red "recipe network" for its whole window, but only while its product is below the cap:
    - oxide: T 1..225 and 451..675, while ice is under 60
    - metallic: T 226..450, while iron ore is under 60
    - carbonic: T 676..900, while carbon is under 60

    The crusher has "set recipe" on and reads only this network. It has no green wire, so hub item signals cannot pick its recipe.
  - **Feed decider.** It sends `signal-G` to the crusher's ingredient arm for the first 19 ticks of each window. That is shorter than one arm swing, so each window takes at most one chunk, which is crushed in 2 seconds, well before the window ends.
  - **Recipe changes.** When the recipe changes, whatever is left in the crusher goes to its dump inventory, and the product arm returns it to the hub. A native probe showed this before the design used it.
  - **Charge gate.** One accumulator reads its charge (`signal-A`, percent) onto the green network. The feed decider opens the arm only while the charge is at least 30%, so the crusher waits while the accumulators recharge.
- **Power.** The crusher (540 kW) is the largest load, and there is only one, so crushing never doubles up. At full rate the platform averages about 1,000 kW against 1,080 kW of panels, and the four accumulators cover the short spikes.

What to preserve when you change it:

- the hub entity in the blueprint, with "request missing construction materials" on;
- the red wires from the hub to the four science arms, the furnace arm, the arithmetic combinator and the three recipe deciders;
- the recipe network, which links the recipe deciders' and the feed decider's outputs, the feed arm and the crusher, and nothing else;
- the green wires joining the constant combinator, the negating combinator's output, the four collectors, the clock and the green inputs of the four clock deciders, with the charge-reading accumulator on them;
- the furnace arm's iron-ore filter;
- the hand size of 1 on every arm;
- a bill that is a whole number of rockets.

## Bill of materials and rockets

| Item | In the blueprint | From the starter pack | Requested (`platformRequest`) | kg each | kg |
| --- | ---: | ---: | ---: | ---: | ---: |
| space-platform-foundation | 247 tiles | 110 | 137 | 20 | 2,740 |
| asteroid-collector | 4 | | 4 | 100 | 400 |
| crusher | 1 | | 1 | 100 | 100 |
| assembling-machine-2 | 4 | | 4 | 20 | 80 |
| electric-furnace | 1 | | 1 | 20 | 20 |
| fast-inserter | 16 | | 16 | 20 | 320 |
| solar-panel | 6 | | 6 | 20 | 120 |
| accumulator | 4 | | 4 | 20 | 80 |
| constant-combinator | 1 | | 1 | 20 | 20 |
| arithmetic-combinator | 1 | | 1 | 20 | 20 |
| decider-combinator | 5 | | 5 | 20 | 100 |
| **requested total** | | | | | **4,000** |

The starter pack's 100 placed tiles and 10 spare foundation cover 110 tiles. The platform asks for exactly 4,000 kg: four full cargo rockets after the starter-pack rocket, five launches in all.

Rockets launched by the game in the native rocket-delivery check (`rocketDelivery` in the report; each cargo rocket is exactly 1,000 kg):

1. the space platform starter pack
2. 50 foundation
3. 50 foundation
4. 37 foundation, 1 crusher, 1 assembling machine 2, 1 electric furnace, 4 accumulators, 1 arithmetic and 1 constant combinator
5. 16 fast inserters, 6 solar panels, 3 assembling machine 2, 5 decider combinators, 4 asteroid collectors

The platform finished building 13.5 minutes after an empty start, with the silo's automatic requests on and its rocket parts kept stocked. Five launches use 250 processing units, 250 low density structures and 250 rocket fuel (50 rocket parts each). Nothing flies after that: packs come down in cargo pods.

## Setup notes for players

1. Paste the blueprint anywhere on the platform. It contains the hub, so it snaps to the real hub. Do not use grid snapping.
2. Keep the hub's "request missing construction materials" setting on. The blueprint sets it. Without it, the platform never asks for parts and no rocket launches.
3. Rockets leave only when they are full (1,000 kg). That is why the bill is exactly four rockets. A change to the blueprint must keep the requested weight a whole multiple of 1,000 kg, or the last partial rocket never leaves.
4. Tick "automatic requests from space platforms" on the rocket silo once. It is off by default, and the harness's rocket check makes only this setting.
5. Build the white-pack receiver on Nauvis. Packs then arrive in its chest with no further click.

## Native qualification (`native-report.json`)

Harness: `scripts/white-platform/validate.mjs` and `control.lua`, run headless on Factorio 2.1.24 Space Age with a private config and mods, map seed 12345. One end-to-end run qualifies both this platform and the receiver, and a second run checks rocket delivery.

**Run one, end to end.** The harness:

- creates a real platform from a starter pack in Nauvis orbit (100 tiles, 10 foundation in the hub);
- inserts exactly `platformRequest` into the hub, which is the only inventory write and stands for the four rockets;
- pastes the string as ghosts (43 entity ghosts, 147 tile ghosts) and lets the hub build it, which took 10 s;
- builds the receiver on Nauvis.

After the build, the harness reads every entity back and checks its position, direction, recipe, arm filter and condition, and its networks. It also checks:

- **decider combinators:** condition count, every condition constant and the output signals;
- **constant combinator:** its signals and values;
- **arithmetic combinator:** its operation;
- **crusher:** set recipe is on, and its red network is neither the hub's nor green;
- **charge reader:** the accumulator that reads its charge is on the collection network.

Chunks arrive naturally. Packs leave only by the game's own cargo pods and are collected at the receiver chest once per second, never during the blocked phase.

Phases from the build tick: 60 min warm-up, 120 min measured, 105 min blocked (receiver chest not emptied; the last 15 min are the hold), then 60 min recovery, of which the last 45 min are measured.

| Check | Measured |
| --- | --- |
| Steady, collected at the receiver chest / made (production statistics) | 60.00 / 60.00 per minute (floor 57) |
| Recovery, last 45 min, collected / made | 96.3 / 60.00 per minute (collection includes the backlog draining) |
| Crafts in 120 min | 360 per science machine (full speed); furnace 2,880; crusher 576 (from production: 288 oxide, 144 metallic, 144 carbonic; 12 ice, 24 iron ore, 12 carbon per minute) |
| Collectors | all four delivered chunks during measurement |
| Blocked phase end | receiver chest 2,000 (never above), pad 1,000, hub 2,060 packs, no craft at all in the last 15 min |
| Highest stocks in the hub (ceiling) | packs 2,060 (2,100), iron ore 77 (100), carbon 68 (100), ice 64 (100), iron plate 103 (130), chunks 12 / 10 / 10 (16) |
| Lowest free hub slots | 16 of 59 (limit 5) |
| Power | 0 low-power ticks; average demand 943 kW over the whole run (about 995 kW over the measurement, accumulator charging included), peak one-second demand 1,626 kW; lowest accumulator charge after the first 10 min 4.66 of 5 MJ |
| Damage | 44 entities at every phase mark, none damaged, no damaged tile, no asteroid entity ever |
| First cargo pod | 67 s after the build |

**Run two, rocket delivery.** A rocket silo with automatic requests on, 50 logistic robots, and chests holding exactly one starter pack and `platformRequest`. The game launched five rockets: the starter pack first, then four cargo rockets of exactly 1,000 kg. The platform finished building in 13.5 minutes, and the kit chests and hub were left empty.

**Seven more map seeds.** Each ran the full protocol plus the rocket check, on the same string, harness and validator as the published report, with source copies under `.cache/`. All passed every check:

| Seed | Steady collected / made | Recovery made | Low-power ticks | Avg / peak kW | Lowest accumulator | Lowest free slots | Launches |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 12345 (published) | 60.00 / 60 | 60 | 0 | 943 / 1,626 | 4.656 MJ | 16 | 5 |
| 4242 | 59.99 / 60 | 60 | 0 | 937 / 1,580 | 4.663 MJ | 19 | 5 |
| 1 | 60.00 / 60 | 60 | 0 | 942 / 1,549 | 4.681 MJ | 21 | 5 |
| 31337 | 60.00 / 60 | 60 | 0 | 944 / 1,626 | 4.656 MJ | 17 | 5 |
| 987654 | 60.00 / 60 | 60 | 0 | 939 / 1,567 | 4.666 MJ | 17 | 5 |
| 20261121 | 60.01 / 60 | 60 | 0 | 941 / 1,626 | 4.659 MJ | 15 | 5 |
| 555 | 60.00 / 60 | 60 | 0 | 943 / 1,616 | 4.656 MJ | 16 | 5 |
| 777 | 60.00 / 60 | 60 | 0 | 941 / 1,587 | 4.683 MJ | 14 | 5 |

Nauvis orbit never damages a stationary platform. The planner's eleven two-hour probes showed this, and every run here showed no asteroid entity, no damaged tile and no damaged entity. So the platform has no defence.

## What was tried

The goal order is fewest rockets first, then fewest foundation tiles.

| Candidate | Request | Tiles | Rectangle | Power | Result |
| --- | ---: | ---: | --- | --- | --- |
| `hub-ring` (the planner's prototype layout) | 5,000 kg | 283 | 22 x 22 | 10 panels, 1 accumulator | qualified, superseded; `history/hub-ring/` |
| `bands-eight-panels` | 5,000 kg | 281 | 19 x 18 | 8 panels, 5 accumulators | passed the full protocol, superseded |
| `bands-seven-panels` | 5,000 kg | 280 | 19 x 18 | 7 panels, 7 accumulators | qualified (published before this round), superseded; `history/bands-seven-panels/` |
| `bands-six-panels` | 5,000 kg | 279 | 19 x 18 | 6 panels, 9 accumulators | failed: 11,131 low-power machine-ticks at start-up; `history/bands-six-panels/` |
| `single-crusher` | 4,000 kg | 248 | 19 x 16 | 7 panels, 2 accumulators | failed on 2 of 7 seeds: 36 and 18 low-power machine-ticks from short spikes above 1,860 kW; `history/single-crusher/` |
| `single-crusher-six-panels` | 4,000 kg | 247 | 19 x 16 | 6 panels, 4 accumulators, charge gate | qualified (published before this round), 8 of 8 seeds passed; superseded by the smaller rectangle; `history/nineteen-wide-f4cc0325/` |
| **`seventeen-wide`** (published) | **4,000 kg** | **247** | **17 x 16** | 6 panels, 4 accumulators, charge gate | qualified; 8 of 8 seeds pass |
| `single-crusher-six-panels-no-gate` | 4,000 kg | 247 | 19 x 16 | the same without the charge gate | passed the full protocol on seeds 12345, 4242, 1 and 987654 (comparison run) |
| `single-crusher-five-panels` | 4,000 kg | 246 | 19 x 17 | 5 panels, 6 accumulators, charge gate | failed: 56.0 per minute (900 kW of panels is below the platform's draw); `history/single-crusher-five-panels/` |

Going from three fixed-recipe crushers to one crusher with a circuit-set recipe drops two crushers (200 kg), twelve tiles (240 kg) and four arms (80 kg), and adds one decider (20 kg). That makes one cargo rocket fewer.

With the weight pinned at 4,000 kg, a panel and its 9 tiles (200 kg) trade for two accumulators and their 8 tiles (200 kg):

- Seven panels with two accumulators did not cover the spikes on every seed.
- Six panels with four accumulators did, on all eight seeds.
- Five panels cannot supply the average draw.

The charge gate was not needed in the four comparison seeds. It is kept because it costs no weight and lets the platform recover by itself whenever the accumulators run low (the start-up minutes average about 1,150 kW). The five-panel run shows it working: no brown-out even with a power deficit.

## Design review of 2026-11-21 (the 17 x 16 layout)

The review kept every item and every wire role of the 19 x 16 version and changed only where things stand. The request is the same, item for item, so the rockets and the launch kit's counts do not change.

- **Rectangle: 304 to 272 tiles (10.5% fewer), same 247 foundation tiles.** The 19 x 16 version kept two solar panels and three accumulators in a band east of the 16 x 16 core while the west side's two machine slots stood empty. Now those two panels stand in the west slots. The crusher moved from the south side to the east side and is turned 2 wide, which leaves a 2 x 4 strip behind it for two accumulators. The north-east and south-east corner panels moved one column east, and the two-tile gaps this opens hold the other two accumulators. A 16 x 16 rectangle cannot hold the design: the entities and the collectors' overhanging rows cover 259 tiles, more than 256.
- **Fewer collectors: measured, not possible.** Exploration runs of this layout on seed 12345 (20 minutes warm-up, 120 measured; `seventeen-wide-south`, `seventeen-wide-north-south` and `seventeen-wide-three-collectors`):

  | Collectors | Packs per minute | Ice made per minute (12 needed) | Minute samples with no oxide chunk in the hub |
  | --- | ---: | ---: | ---: |
  | 1 (south) | 31.7 | 6.4 | 102 of 120 |
  | 2 (north, south) | 58.2 | 11.2 | 64 of 120 |
  | 3 (north, east, south) | 60.0 | 11.9 | 20 of 120 |
  | 4 (published; full protocol, minutes 21 to 180) | 60.0 | 12.0 | 0 of 160 |

  Oxide chunks are the scarce ones. Three collectors made slightly less ice than the machines used (the hub's ice fell to 27 within the two hours), so the platform keeps four.
- **Fewer rockets: not possible with these machines.** With four collectors, the machines, arms, combinators and their tiles weigh 2,360 kg before any power. Three cargo rockets would leave 640 kg for power, which is three solar panels with their tiles (540 kW) against a draw of about 1,000 kW. A steel furnace burning carbon cannot be built on a platform (it needs a surface pressure of at least 10).
- **Fewer tiles at 4,000 kg: only by padding.** With the weight pinned, six panels and four accumulators leave exactly 40 kg, which are the two tiles under the clock decider. Moving the decider onto the ring saves those two tiles only if 40 kg of unused items take their place. Not done.

Seed-by-seed comparison with the 19 x 16 version (full protocol): seed 1 lowest hub ice in minutes 21 to 180 was 57 before and 50 now; seed 31337 45 before and 41 now; seed 12345 51 before and 57 now. The chunk supply did not change in any way that shows.

## Review notes

The review of the 5,000 kg design (`bands-seven-panels`) accepted it with no must-fix. This round applied the reviewer's size ideas in order:

1. **One fewer rocket (single crusher with a circuit-set recipe).** Applied. Two probes came first:
   - The game writes `control_behavior: {set_recipe: true}` on the crusher and `{type: "recipe"}` signals.
   - Leftovers after a recipe change go to the dump inventory, and the product arm empties it.

   The reviewer's exact proposal (7 panels, 2 accumulators) failed `noLowPower` on 2 of 7 seeds, so the published version uses 6 panels and 4 accumulators at the same 4,000 kg, plus the free charge gate.
2. **Tiles at the pinned weight.** Tried at the new weight. The only real swap (5 panels, 6 accumulators, 1 tile fewer) failed on rate. The other remaining tile cut is moving the clock decider onto the ring (2 tiles), but that would need 40 kg of idle items to keep the weight a whole number of rockets, which is padding. No further saving.

The harness also adopted two non-blocking notes from the review:

- the build check now reads back decider constants and outputs, the constant and arithmetic combinator values, the crusher's set-recipe flag and its network, and the charge reader. Tampered expectations for the decider, constant and arithmetic values were each caught.
- the report no longer crashes when a short run sees no cargo pod.

**For the kit lane and the rocket plan:** the platform bill changed. The new counts are:

| Item | Count |
| --- | ---: |
| foundation | 137 |
| asteroid collector | 4 |
| crusher | 1 |
| assembling machine 2 | 4 |
| electric furnace | 1 |
| fast inserter | 16 |
| solar panel | 6 |
| accumulator | 4 |
| constant combinator | 1 |
| arithmetic combinator | 1 |
| decider combinator | 5 |

The campaign is now five launches (250 processing units, 250 low density structures and 250 rocket fuel), not six. Every count is inside the kit ranges, and every kit item type is still used.

## Reproduce

```
npm ci
node scripts/white-platform/generate.mjs            # string + manifest (variant seventeen-wide)
node scripts/white-pack-receiver/generate.mjs
node scripts/white-platform/validate.mjs            # full protocol, about 30 s; writes both native reports
node scripts/white-platform/generate.mjs && node scripts/white-pack-receiver/generate.mjs   # status from the report
WP_SEED=4242 WP_SOURCE=<copy> WR_SOURCE=<copy> node scripts/white-platform/validate.mjs   # another seed on copies
SPACE_EXPLORE=1 WP_SEED=4242 node scripts/white-platform/validate.mjs   # short exploration (warm 10, measure 20)
node --test tests/white-platform.test.mjs tests/white-pack-receiver.test.mjs
```

The generator needs the 2.1.24 prototype dump (`FACTORIO_RAW`). Other variants are selected with `--variant <name> --out <dir>`:

- `single-crusher-six-panels` (the 19 x 16 version), `single-crusher`, `single-crusher-six-panels-no-gate`, `single-crusher-five-panels`
- `seventeen-wide-south`, `seventeen-wide-north-south`, `seventeen-wide-three-collectors` (exploration only: fewer collectors, not a whole number of rockets)
- `bands-seven-panels`, `bands-eight-panels`, `bands-six-panels`
- `hub-ring`, `hub-ring-four-chunks`
