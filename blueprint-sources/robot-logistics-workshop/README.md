# Robot logistics workshop

Simultaneous targets are 10 construction robots, 10 logistic robots, 1 roboport, 4 storage chests, 4 passive provider chests and 4 requester chests (entity `requester-chest`) per minute, with an output chest that stops each product at one full stack (50 / 50 / 10 / 50 / 50 / 50). The robot rates preserve the user's chosen profile; four of each chest per minute keeps circuit capacity available for robots. Use the manifest for the exact footprint, machine counts, clock settings and numbered connections.

**Status: qualified.** Native qualification passed on Factorio 2.1.25 Space Age (vanilla) for the exact string in `robot-logistics-workshop.txt` (SHA-256 `5c914e6afcd3a04b39ad38ad7a1580f6afa02c233469eb1b1ac71ad318dc8240`). The design occupies **52 x 21 = 1,092 tiles** with 53 AM2s and 3 chemical plants (56 machines). Measured steady delivery was 10.23 construction robots, 10.8 logistic robots, 1.17 roboports, 4.43 storage chests, 4.43 passive providers and 4.43 requester chests per minute; recovery was 10.3 / 10.8 / 1.2 / 4.5 / 4.5 / 4.5; the closed chest filled to exactly 50 / 50 / 10 / 50 / 50 / 50; all six independent stocking phases passed. The full run (15 + 30 minutes measured, closed hold, recovery and six selective phases, 225 game minutes) took 59 seconds of wall time. Qualification remains valid only when `native-report.json` reports `passed: true`, its blueprint SHA-256 matches the current import string and manifest, its prototype/harness/validator hashes match the tested sources, and the sidecar tests pass. Historical or partial runs do not qualify a new blueprint.

**Requester chests (26 November).** The requester chest is a sixth product, four a minute (the passive provider chest's rate), in the same single east output chest with its own cap of one full stack (50). It uses the recipe the other two chests use (a steel chest, 3 electronic circuits, 1 advanced circuit), so the extra machine is one more AM2 and the entrance figures went up: steel 181 (was 149), plastic 154 (146), copper 659 (621), iron 520 (500); electronic circuits 310 and advanced circuits 77 crafts a minute (290 and 73); acid and lubricant are unchanged.

Why the requester chest has its own inserter: the collector fills the chest through dynamic filters set by circuit signals, and every inserter in the prototype dump holds at most five filters (`filter_count` 5), so a sixth product cannot go through the collector. Its machine stands at the east end of the top row, three tiles from the chest, and an inserter on the chest's west side picks from the machine and drops into the chest. That inserter is metered by the same latched token as the other products and stops when the chest already holds 50 requester chests (a permission decider reading the chest's own red counts, not the ring). The five ring-borne products keep their five filter deciders and the collector at the ring's north-east corner. To make room the passive provider chest machine moved two columns west (it now sits against the storage chest machine) and one column was added east of the ring for the combinators that no longer fit (52 instead of 51 wide, same height); every entrance, the entrance order, the ring limits and the output chest tile are unchanged.

The earlier five-product string (SHA-256 `ee80fa8d…38de`, 51 x 21 = 1,071 tiles, 55 machines) is kept complete and qualified in `history/five-products-full-stack/`, and the twenty-robot string before it in `history/twenty-robot-caps/` (SHA-256 `77998031…15fc`, 1,071 tiles). All three are listed in `manifest.json` under `versions`, newest first: "Requester chests", "Full-stack caps", "Twenty-robot caps". The twenty-robot and five-product strings share one layout and differ only in the five filter deciders; the chest stack sizes are from the prototype dump (robots 50, roboport 10, chests 50). The chest is a passive provider chest with 48 slots; the six products at their caps fill 6 slots.

The previous version (106 x 24 = 2,544 tiles, 56 machines, SHA-256 `c1c984d3…c950`) is kept with its own qualified report in `history/two-row-rail-c1c984d3/`. This version keeps the same inputs, entrance order, products, rates and caps in 58% less area.

## Layout

```
     2101234567890123456789012345678901234567890123456789
  -4   pppEEEEEEEEEEEEEEEFFFFFFFFF111  222@@444555@666@ @
  -3   pppEEEEEEEEEEEEEEEFFFFFFFFF111  222@@444555@666@ @
  -2   pppEEEEEEEEEEEEEEEFFFFFFFFF111  222@@444555@666iC
  -1   bbiiiiiiiiiiiiiiiiiiiiiiiiiii@@@@ii@@ii@@ii@i@@ i@
   0 D >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>v@
   1 u ^ iu=  i     i       i  @@ @@ iiiiiiiiiiiiiiiiiiv@
   2 >b^BBB=BBBccc GGG ccc GGG ccccccRRRRRRRRRRRRRRRRRRv@
   3 D@^BBB=BBBcccbGGGiccciGGGbccccccRRRRRRRRRRRRRRRRRRv
   4 D@^BBB=BBBccc GGG ccc GGG ccccccRRRRRRRRRRRRRRRRRRv
   5 e@^eviui ## i  i   i   i ## i ibi@@i@@i@@i ## ii@@v
   6 D@^ >>>>e##e>>>>>>>>>>>>e##e>>^>>>>>>>>>>>e##e>>> v
   7 ei^e^iubb   i  i   i   i    i ibi@@i@@i@@i@@@@ii@@v
   8 D ^BBB=gggccc GGG ccc GGG ccccccRRRRRRRRRRRRRRRRRRv
   9 >b^BBB=gggcccbGGGiccciGGGbccccccRRRRRRRRRRRRRRRRRRv
  10  @^BBB=gggccc GGG ccc GGG ccccccRRRRRRRRRRRRRRRRRRv
  11  @^i   i       i       i     @@ iiiiiiiiiiiiiiiiiiv
  12 D ^<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  13 u ibbiiu=uiiiiu=uiiiiu=i biiiiiiiiiiiiiiiiiiiii@@
  14   333MMM=MMMMMM=MMMMMM=SSSFFFFFFFFFFFFFFFFFFFFF
  15   333MMM=MMMMMM=MMMMMM=SSSFFFFFFFFFFFFFFFFFFFFF
  16   333MMM MMMMMM MMMMMM SSSFFFFFFFFFFFFFFFFFFFFF
```

`p` pipe, `E` engine, `F` flying robot frame, `1` construction robot, `2` logistic robot, `4` storage chest, `5` passive provider chest, `6` requester chest, `3` roboport, `B` battery (chemical plant), `g` gear, `c` copper cable, `G` electronic circuit, `R` advanced circuit, `M` electric engine, `S` steel chest, `C` output chest, `D` entrance panel, `#` substation, `@` combinator, `=` pipe, `u` pipe-to-ground, `e` underground belt, `i` fast arm, `b` bulk arm, `> < ^ v` red belts. The inserter between `6` and `C` is the requester chest's own.

- One closed ring (top belt east at y=0, east column south, bottom belt west at y=12, west column north) with per-tile hold readers on a red wire.
- Four machine rows: outer top (pipe, five engines, three frames and the five small product machines, the requester chest machine last, beside the output chest), outer bottom (roboport, five electric engines, steel chest, seven frames), and two inner rows back to back across a middle aisle.
- The aisle (y=6) carries the high-volume items that never touch the ring: plate belt A (copper north lane, iron south lane) feeds the three battery plants, the gear machine and the circuit block; a cable belt carries copper cable to the twelve advanced-circuit machines. The circuit block follows `green-circuits`: cable is handed machine to machine.
- Plastic and steel wait on one-tile entrance belts on the west edge; gated bulk arms put them on the ring. Iron for the pipe machine enters the ring through an arm that works only while the ring is short of pipes (the iron decider).
- Three substations in aisle holes power everything; two of them also relay the green token wire.

## Connections and operation

Supply these six marked WEST entrances, north to south: sulfuric acid (pipe), plastic bars, copper plates, iron plates, steel plates (belts), lubricant (pipe). Each material has one exterior entrance. Electricity: connect any of the three substations; they are wired together (the manifest names the east one as the power port).

| Input | Panel (recipe total) per min | Measured draw per min |
| --- | ---: | ---: |
| Sulfuric acid | 800 | 850 |
| Plastic bars | 154 | 180 |
| Copper plates | 659 | 744 |
| Iron plates | 520 | 583 |
| Steel plates | 181 | 205 |
| Lubricant | 300 | 332 |

**Plan supply for the measured draw, not the panels.** The panels are recipe totals at exactly the targets; the production tokens run every product a little above target (headroom 1.02 to 1.18), so the workshop draws about 6% more acid and 12 to 17% more of everything else (180 plastic against a panel of 154, for example). Exploration runs with each entrance fed at a fixed multiple of its panel figure (`scripts/robot-logistics-workshop/explore.mjs`, a patched copy of the harness, not the qualification protocol) gave, for the five-product string: 1.00 x and 1.05 x fail (roboports 0.83 and 0.93 per minute), 1.10 x, 1.15 x and 1.20 x pass every check. That sweep was not repeated for the six-product string (the requester chest takes more of the same steel, circuits and plastic), so the 1.1 x threshold is the five-product string's. Feed the measured draw above, which is what the qualifying run took.

All circuits, cable, gears, pipes, engines, electric engines, batteries, flying robot frames and steel chests are made internally. No finished intermediates or starter robots are required. The recipe audit uses 310 electronic circuits, 77 advanced circuits and 619 copper-cable crafts (1,238 cable items) per minute. The advanced-circuit machines are the closest to their limit: the twelve make 89.8 of the 90 advanced circuits a minute they can, the four electronic-circuit machines 347 of 360.

The design uses AM2s and chemical plants, normal quality, no installed modules, red belts and undergrounds, fast and bulk inserters, and substations. Native qualification uses the unlock baseline of two items per bulk-inserter hand, with no later capacity upgrades; ordinary fast inserters use the unupgraded baseline.

All six finished products enter ONE passive provider chest on the EAST, above the ring's north-east corner. Leave its slot bar unrestricted. `manifest.outputCaps` and each `outputs[].cap` describe the same independent per-product stock settings: 50 construction robots, 50 logistic robots, 10 roboports, 50 storage chests, 50 passive provider chests and 50 requester chests (one full stack each). The five ring-borne products reach the chest through the collector, which picks from the corner curve; each has its own filter decider (chest plus collector hand below the cap) and a stocked product stops entering the chest while the others stay collectable. The requester chests come straight from their machine through the inserter on the chest's west side, which stops at 50 (`manifest.stockControl.directProducts`). The chest's east approach (three tiles) stays clear.

Ring limits (`manifest.loopControl[0].limits`) cap every item on the ring; they sum to 522 of the ring's 960 item capacity, and the measured ring peak was 545. Reserve gates keep circuits, steel, gears and advanced circuits for downstream consumers. Product export uses latched production tokens: a timer feeds one modulo per product, the latch holds a token from each period start until the product's output arm holds the product, and the permission decider also needs ring stock below the limit (for the requester chests: the chest's own count below 50). Periods and entity numbers are in `manifest.productionClock`. Preserve the red ring wires, the green and red chest wires, the token wires, filters and caps.

## Native qualification and reproduction

Run from the repository root:

```sh
node scripts/robot-logistics-workshop/generate.mjs
node scripts/robot-logistics-workshop/validate.mjs
node --test tests/robot-logistics-workshop.test.mjs
```

The generator uses the official Factorio 2.1.25 raw dump below (`factorio --dump-data` of the installed game, run with an isolated config and mod directory, no save loaded); set `FACTORIO_RAW` to relocate the same snapshot:

```text
/Users/nagkumar/clawd/workspaces/.claude/tmp-robot-requester-product/dump/write/script-output/data-raw-dump.json
```

Its SHA-256 is `289d0de81102a710f16fc989a5df399facdef91c100901da87e5e69b4d911495` (it differs from the 2.1.24 dump the earlier strings were made on only in graphics fields). The installed Steam Factorio binary imports the encoded blueprint in a private native harness. Saves, mods, configuration, logs and working reports belong only under ignored `.cache/robot-logistics-workshop/`.

The protocol warms up for 15 minutes, measures steady collection for 30 minutes, closes collection for **15 minutes** while the factory naturally fills its output stocks, allows 5 minutes to settle after reopening, and measures recovery for 10 minutes. Six further phases hold one product at its cap while collecting the other five; each phase settles for **15 minutes** and measures for 10 minutes. The twenty-robot string ran 5 minutes closed and 5 minutes settle per phase. The chest is empty when a hold starts, so the hold must outlast the time one product needs to reach its cap: 50 storage, passive provider or requester chests at about 4.4 per minute is 11.4 minutes, 10 roboports at 1.2 is 8.3, 50 robots at 10 is 5. The phase lengths come from `protocol` in the manifest, and the harness records the minute each cap was reached; the run fails unless every cap was reached inside the closed hold and inside each selective settle. Measured: closed hold 5.0 (construction robots), 4.8 (logistic robots), 7.8 (roboports), 11.1 (storage chests), 10.9 (passive provider chests) and 11.0 (requester chests) minutes; selective phases 4.8, 4.6, 8.3, 11.4, 11.1 and 11.1 minutes (15 allowed). Lowest other-product rates while one was held at its cap: construction robots 10.0, logistic robots 10.2, roboports 1.2, chests 4.4. Ring peak 545 of 960.

Fixtures supply only declared exterior raw-material belt lanes, declared fluid entrances and electricity. Blocking tests only pause collection: they insert no finished products. Intermediate inventories are never injected.

A pass requires imported geometry/recipes/wiring/power, no installed modules, every machine crafting during measurement, every solid entrance feeding a productive route, both connected fluid networks accepting fluid, all six steady and recovery rates at least 95% of their declared targets, exact closed-chest caps, and all six individual-product blocking tests with the other five products at their 95% floors. The roboport floor is **0.95/min**.

Regenerating: `node scripts/robot-logistics-workshop/generate.mjs` keeps the committed string when it decodes to the same blueprint. The generator builds the six-product string only; the five-product and twenty-robot strings are kept as files in `history/` (the generator as of the commit before the requester chest rebuilds them).

Exploration tools (never write `blueprint-sources`): `scripts/robot-logistics-workshop/screen.sh <name>` generates into `.cache/robot-logistics-workshop/<name>` and runs the full protocol there (`RLW_OPTIONS` overrides limits, reserves and headroom); `explore.mjs` adds the fixed-multiple supply (`RLW_SUPPLY`) and longer closed holds (`RLW_PAUSE_MINUTES`); `summary.mjs` prints a compact report.

## Provenance

This is an original generated workshop. The first version (`history/two-row-rail-c1c984d3/`) reused circulation and cable-transfer patterns from `scripts/flight-robots/generate.mjs` and `scripts/rgby-science/frames.mjs`. The compact version (review round of 11-21) follows `scripts/robot-essentials` for the ring, stock limits and latched tokens, and `scripts/green-circuits` for the cable hand-off block. The native runner and control were copied from `scripts/five-science/validate.mjs` and `control.lua`, then adapted locally for these five products, the shared chest, strict target fractions and independent cap tests; they are unchanged in this version apart from the phase lengths (taken from the manifest `protocol`) and the cap-reached timing.

Old flight-robot reports used a different recipe profile and are not production evidence for this blueprint. Only matching official-raw, exact-blueprint native evidence applies. Website publication and integration are handled separately.
