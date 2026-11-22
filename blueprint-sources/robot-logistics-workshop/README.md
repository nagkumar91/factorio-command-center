# Robot logistics workshop

Simultaneous targets are 10 construction robots, 10 logistic robots, 1 roboport, 4 storage chests and 4 passive provider chests per minute, with an output chest that stops each product at one full stack (50 / 50 / 10 / 50 / 50). The robot rates preserve the user’s chosen profile; four of each chest per minute keeps circuit capacity available for robots. Use the manifest for the exact footprint, machine counts, clock settings and numbered connections.

**Status: qualified.** Native qualification passed on official Factorio 2.1.24 Space Age for the exact string in `robot-logistics-workshop.txt` (SHA-256 `ee80fa8d4c6cb047bfb7b84725209fb3b56bb36904b547c633b702dc2c3038de`). The design occupies **51 x 21 = 1,071 tiles** with 52 AM2s and 3 chemical plants (55 machines). Measured steady delivery was 10.23 construction robots, 10.7 logistic robots, 1.2 roboports, 4.43 storage chests and 4.47 passive providers per minute; recovery was 10.4 / 10.4 / 1.2 / 4.5 / 4.5; the closed chest filled to exactly 50 / 50 / 10 / 50 / 50; all five independent stocking phases passed. Qualification remains valid only when `native-report.json` reports `passed: true`, its blueprint SHA-256 matches the current import string and manifest, its prototype/harness/validator hashes match the tested sources, and the sidecar tests pass. Historical or partial runs do not qualify a new blueprint.

**Full-stack caps (22 November).** The chest used to stop each product at 20 construction robots, 20 logistic robots, 2 roboports, 10 storage chests and 10 passive provider chests; that string (SHA-256 `77998031…15fc`, 1,071 tiles, same layout, machines, rates and ring limits, only the five filter deciders differ) is kept complete and qualified in `history/twenty-robot-caps/`. Both are listed in `manifest.json` under `versions`, "Full-stack caps" first and "Twenty-robot caps" second. Cap stack sizes are from the prototype dump (robots 50, roboport 10, chests 50). The chest is a passive provider chest with 48 slots; the five products at their caps fill 5 slots.

The previous version (106 x 24 = 2,544 tiles, 56 machines, SHA-256 `c1c984d3…c950`) is kept with its own qualified report in `history/two-row-rail-c1c984d3/`. This version keeps the same inputs, entrance order, products, rates and caps in 58% less area.

## Layout

```
     210123456789012345678901234567890123456789012345678
  -4   pppEEEEEEEEEEEEEEEFFFFFFFFF111  222  444 @555@@@
  -3   pppEEEEEEEEEEEEEEEFFFFFFFFF111  222  444 @555@@@
  -2   pppEEEEEEEEEEEEEEEFFFFFFFFF111  222@@444  555@@@C
  -1   bbi!!i!!i!!i!!i!!i!!i!!i!!i!i@@@@!i@@!i@@@@!i@@@!
   0 D >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>v
   1 u ^ !u=  !     !       !     @@ ii!ii!ii!ii!ii!ii!v
   2 >b^BBB=BBBccc GGG ccc GGG ccccccRRRRRRRRRRRRRRRRRRv
   3 D@^BBB=BBBcccbGGGjccclGGGbccccccRRRRRRRRRRRRRRRRRRv
   4 D@^BBB=BBBccc GGG ccc GGG ccccccRRRRRRRRRRRRRRRRRRv
   5 e@^Ev!u! ## !  !   !   ! ## ! !b!@@!@@!@@! ## !!@@v
   6 D@^ >>>>e##E>>>>>>>>>>>>e##E>>^>>>>>>>>>>>e##E>>> v
   7 el^E^iubb   i  i   i   i    i ibi@@i@@i@@i@@@@ii@@v
   8 D ^BBB=gggccc GGG ccc GGG ccccccRRRRRRRRRRRRRRRRRRv
   9 >b^BBB=gggcccbGGGjccclGGGbccccccRRRRRRRRRRRRRRRRRRv
  10  @^BBB=gggccc GGG ccc GGG ccccccRRRRRRRRRRRRRRRRRRv
  11  @^i   i       i       i        i!!i!!i!!i!!i!!i!!v
  12 D ^<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  13 u !bb!iu=u!i!iu=u!i!iu=! b!ii!ii!ii!ii!ii!ii!ii
  14   333MMM=MMMMMM=MMMMMM=SSSFFFFFFFFFFFFFFFFFFFFF
  15   333MMM=MMMMMM=MMMMMM=SSSFFFFFFFFFFFFFFFFFFFFF
  16   333MMM MMMMMM MMMMMM SSSFFFFFFFFFFFFFFFFFFFFF
```

`p` pipe, `E` engine, `F` flying robot frame, `1` construction robot, `2` logistic robot, `4` storage chest, `5` passive provider chest, `3` roboport, `B` battery (chemical plant), `g` gear, `c` copper cable, `G` electronic circuit, `R` advanced circuit, `M` electric engine, `S` steel chest, `C` output chest, `D` entrance panel, `#` substation, `@` combinator, `=` pipe, `u` pipe-to-ground, `e`/`E` underground belt, `i ! j l` fast arms, `b` bulk arm, `> < ^ v` red belts.

- One closed ring (top belt east at y=0, east column south, bottom belt west at y=12, west column north) with per-tile hold readers on a red wire.
- Four machine rows: outer top (pipe, five engines, three frames and the four small product machines), outer bottom (roboport, five electric engines, steel chest, seven frames), and two inner rows back to back across a middle aisle.
- The aisle (y=6) carries the high-volume items that never touch the ring: plate belt A (copper north lane, iron south lane) feeds the three battery plants, the gear machine and the circuit block; a cable belt carries copper cable to the twelve advanced-circuit machines. The circuit block follows `green-circuits`: cable is handed machine to machine.
- Plastic and steel wait on one-tile entrance belts on the west edge; gated bulk arms put them on the ring. Iron for the pipe machine enters the ring through an arm that works only while the ring is short of pipes (the iron decider).
- Three substations in aisle holes power everything; two of them also relay the green token wire.

## Connections and operation

Supply these six marked WEST entrances, north to south: sulfuric acid (pipe), plastic bars, copper plates, iron plates, steel plates (belts), lubricant (pipe). Each material has one exterior entrance. Electricity: connect any of the three substations; they are wired together (the manifest names the east one as the power port).

| Input | Panel (recipe total) per min | Measured draw per min |
| --- | ---: | ---: |
| Sulfuric acid | 800 | 850 |
| Plastic bars | 146 | 166 |
| Copper plates | 621 | 691 |
| Iron plates | 500 | 559 |
| Steel plates | 149 | 168 |
| Lubricant | 300 | 332 |

**Plan supply for the measured draw, not the panels.** The panels are recipe totals at exactly the targets; the production tokens run every product a little above target (headroom 1.02 to 1.18), so the workshop draws about 6% more acid and 11 to 14% more of everything else. Exploration runs with each entrance fed at a fixed multiple of its panel figure (`scripts/robot-logistics-workshop/explore.mjs`, a patched copy of the harness, not the qualification protocol) gave: 1.00 x and 1.05 x fail (roboports 0.83 and 0.93 per minute), 1.10 x, 1.15 x and 1.20 x pass every check. The previous version had the same threshold (failed at 1.05 x, passed at 1.10 x). Feed at least 1.1 x the panel figures, or simply the measured draw above.

All circuits, cable, gears, pipes, engines, electric engines, batteries, flying robot frames and steel chests are made internally. No finished intermediates or starter robots are required. The recipe audit uses 290 electronic circuits, 73 advanced circuits and 581 copper-cable crafts (1,162 cable items) per minute.

The design uses AM2s and chemical plants, normal quality, no installed modules, red belts and undergrounds, fast and bulk inserters, and substations. Native qualification uses the unlock baseline of two items per bulk-inserter hand, with no later capacity upgrades; ordinary fast inserters use the unupgraded baseline.

All five finished products enter ONE passive provider chest on the EAST, above the ring's north-east corner; the collector picks from the corner curve. Leave its slot bar unrestricted. `manifest.outputCaps` and each `outputs[].cap` describe the same independent per-product stock settings: 50 construction robots, 50 logistic robots, 10 roboports, 50 storage chests and 50 passive provider chests (one full stack each). Each product has its own filter decider (chest plus collector hand below the cap). A stocked product stops entering the chest while the other products stay collectable.

Ring limits (`manifest.loopControl[0].limits`) cap every item on the ring; they sum to 522 of the ring's 960 item capacity, and the measured ring peak was 541. Reserve gates keep circuits, steel, gears and advanced circuits for downstream consumers. Product export uses latched production tokens: a timer feeds one modulo per product, the latch holds a token from each period start until the product's output arm holds the product, and the permission decider also needs ring stock below the limit. Periods and entity numbers are in `manifest.productionClock`. Preserve the red ring wires, the green chest and token wires, filters and caps.

## Native qualification and reproduction

Run from the repository root:

```sh
node scripts/robot-logistics-workshop/generate.mjs
node scripts/robot-logistics-workshop/validate.mjs
node --test tests/robot-logistics-workshop.test.mjs
```

The generator uses the official Factorio 2.1.24 raw dump below; set `FACTORIO_RAW` to relocate the same snapshot:

```text
/Users/nagkumar/worktrees/factorio-blueprint-port-redesign/factorio-command-center/.cache/solar-native-audit/run-20261112T233408405Z/script-output/data-raw-dump.json
```

Its SHA-256 is `ce40aee67d984865f22ed8e65ba6b93fefb014fc35e45b747b64aca3ed5682a3`. The installed Steam Factorio binary imports the encoded blueprint in a private native harness. Saves, mods, configuration, logs and working reports belong only under ignored `.cache/robot-logistics-workshop/`.

The protocol warms up for 15 minutes, measures steady collection for 30 minutes, closes collection for **15 minutes** while the factory naturally fills its output stocks, allows 5 minutes to settle after reopening, and measures recovery for 10 minutes. Five further phases hold one product at its cap while collecting the other four; each phase settles for **15 minutes** and measures for 10 minutes. The twenty-robot string ran 5 minutes closed and 5 minutes settle per phase. The chest is empty when a hold starts, so the hold must outlast the time one product needs to reach its cap: 50 storage or passive provider chests at about 4.4 per minute is 11.4 minutes, 10 roboports at 1.2 is 8.3, 50 robots at 10 is 5. The phase lengths now come from `protocol` in the manifest, and the harness records the minute each cap was reached; the run fails unless every cap was reached inside the closed hold and inside each selective settle. Measured: closed hold 4.8 (construction robots), 4.8 (logistic robots), 7.8 (roboports), 11.1 (storage chests) and 11.1 (passive provider chests) minutes; selective phases 4.9, 4.6, 8.3, 11.2 and 11.1 minutes (15 allowed). Lowest other-product rates while one was held at its cap: construction robots 10.1, logistic robots 10.7, roboports 1.2, chests 4.4. Ring peak 542 of 960.

Fixtures supply only declared exterior raw-material belt lanes, declared fluid entrances and electricity. Blocking tests only pause collection: they insert no finished products. Intermediate inventories are never injected.

A pass requires imported geometry/recipes/wiring/power, no installed modules, every machine crafting during measurement, every solid entrance feeding a productive route, both connected fluid networks accepting fluid, all five steady and recovery rates at least 95% of their declared targets, exact closed-chest caps, and all five individual-product blocking tests with the other four products at their 95% floors. The roboport floor is **0.95/min**.

Regenerating: `node scripts/robot-logistics-workshop/generate.mjs` keeps the committed string when it decodes to the same blueprint. `RLW_OPTIONS='{"caps":{"construction-robot":20,"logistic-robot":20,"roboport":2,"storage-chest":10,"passive-provider-chest":10}}'` rebuilds the twenty-robot string.

Exploration tools (never write `blueprint-sources`): `scripts/robot-logistics-workshop/screen.sh <name>` generates into `.cache/robot-logistics-workshop/<name>` and runs the full protocol there (`RLW_OPTIONS` overrides limits, reserves and headroom); `explore.mjs` adds the fixed-multiple supply (`RLW_SUPPLY`) and longer closed holds (`RLW_PAUSE_MINUTES`); `summary.mjs` prints a compact report.

## Provenance

This is an original generated workshop. The first version (`history/two-row-rail-c1c984d3/`) reused circulation and cable-transfer patterns from `scripts/flight-robots/generate.mjs` and `scripts/rgby-science/frames.mjs`. The compact version (review round of 11-21) follows `scripts/robot-essentials` for the ring, stock limits and latched tokens, and `scripts/green-circuits` for the cable hand-off block. The native runner and control were copied from `scripts/five-science/validate.mjs` and `control.lua`, then adapted locally for these five products, the shared chest, strict target fractions and independent cap tests; they are unchanged in this version apart from the phase lengths (taken from the manifest `protocol`) and the cap-reached timing.

Old flight-robot reports used a different recipe profile and are not production evidence for this blueprint. Only matching official-raw, exact-blueprint native evidence applies. Website publication and integration are handled separately.
