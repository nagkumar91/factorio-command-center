# Substation Turbo Mall — 5×5 Robot Extension

Import [the blueprint string](compact_turbo_tesla_mall.txt) into Factorio 2.0
with Space Age. [Factory close-up](compact_turbo_tesla_mall.png) ·
[Full extension overview](compact_turbo_tesla_mall.overview.png).

The factory occupies **95 × 80 tiles**, including input belts, oil equipment and
**22 substations**. It fits within a 100 × 100 bay: four cells of your supplied
50-tile robot grid. All **25 roboports and 85 big electric poles** from the
[original extension](robot_extension_5x5.txt) retain their exact positions and
existing copper connections. The complete import includes that entire extension,
so its overall footprint remains **252 × 252 tiles**.

Turbo belts and filtered stack inserters move ingredients on a continuous,
circuit-controlled loop. Three pairs of turbo underground belts pass beneath
the existing roboports and poles. Electromagnetic plants make circuits and
Tesla components. Production requires no logistic robots; the extension serves
construction, repairs and collection of finished products.

## Place it over your extension

1. Import the new string and keep the same orientation as your original extension.
2. Match its roboport ghosts to your existing roboports. The original absolute
   50 × 50 snapping grid and grid offset are preserved.
3. Place it with the highlighted four-cell bay clear for the factory. Existing
   roboports and big poles are reused; the factory and substations are added.
4. Connect your power supply to the big-pole grid, then connect the inputs below.

On an empty site, the same blueprint builds both the mall and the whole extension.
It is a replacement layout for the earlier standalone mall: its machines have
been repositioned to fit the robot grid.

All 16 output chests are inside the same logistics network. Put logistic robots
in the roboports for collection and construction robots for building and repairs.
The repair-pack output chest supplies construction robots automatically while
they operate in the network.

## Connect these supplies

The five labeled belts on the left take these materials, from top to bottom:

1. Iron ore
2. Copper ore
3. Coal
4. Holmium ore
5. Stone

Connect **water and crude oil** at the two labeled pipe connections on the
right, and connect power to the extension's big-pole grid. Supply normal-quality
ingredients. The filters match normal quality.

Holmium ore and stone support the added Tesla production. Iron sticks, plates,
steel, circuits, batteries, robot frames, holmium plates, superconductors,
supercapacitors, electrolyte and Tesla guns are all made inside the mall.

Build it on Nauvis with the relevant Space Age technologies unlocked. Turbo
belts, stack inserters and electromagnetic plants must be supplied as
construction materials. Its finished transport products are the blue belts and
bulk inserters from the reference mall.

## Output chests

| Product | Stock target |
| --- | ---: |
| Express transport belt | 400 |
| Express underground belt | 100 |
| Express splitter | 50 |
| Bulk inserter | 100 |
| Long-handed inserter | 100 |
| Medium electric pole | 100 |
| Big electric pole | 50 |
| Substation | 50 |
| Pipe to ground | 100 |
| Storage tank | 20 |
| Lamp | 100 |
| Logistic robot | 100 |
| Construction robot | 100 |
| Roboport | 10 |
| Repair pack | 200 |
| Tesla turret | 10 |

Products enter the adjacent passive-provider chests directly by inserter. You
can collect them by hand or have robots collect them through your extension.
Adjust a product's stock target on its chest-connected output inserter, and
increase the chest's available slots if needed.

The two robot assemblers share their chest counts and favor the less-stocked
robot type, so neither consumes all available frames during startup.

## Oil and belt controls

Light oil feeds superconductors. Above a 500-unit tank reserve, the light-oil
pump enables cracking into petroleum gas for plastic and sulfur. Heavy oil
supplies electrolyte and lubricant; above a 1,000-unit reserve, excess heavy oil
can crack to light oil. Lubricant production stops when its tank reaches 1,500.
These thresholds leave material available for the Tesla chain.

Keep the continuous belt and its green circuit wires intact. One belt sensor
counts the entire loop. Raw feeds and intermediate output inserters stop at
their individual stock limits, leaving space for other ingredients. Red wires
control the finished-product chests and oil pumps locally.

Stack inserters handling mixed ingredients use a one-item hand so they do not
wait indefinitely for a full hand of one scarce ingredient. Ore inputs and
selected intermediate outputs move four at a time. This is a replenishing mall;
its empty belts and many internal buffers take time to fill after initial setup.

## Validation and reproduction

The native test first imports your original extension into an isolated Factorio
2.0.77 + Space Age save, then overlays the actual new blueprint string. It adds
1,568 entities while preserving all 110 original entities in place. The combined
build has 1,678 entities. Every machine, inserter, pump and roboport is powered;
all 25 roboports and 16 output chests share one logistics network.

Only the five material belts, water, crude oil and power are externally supplied
during production. Checks cover recipes, power, exact belt inventory including
underground sections, fluid separation and production with zero robots.

**Passed a 90-minute simulated production and replenishment test.** All 16
output types reached their chests. Every output chest was emptied at minute 75;
all 16 types had replenished by minute 90. This means each product was available
again, not that every chest reached its full stock target. Supplies were
continuous and all required technologies were researched.

| Added product | Collected at minute 75 | Replenished in the next 15 minutes |
| --- | ---: | ---: |
| Roboport | 10 | 1 |
| Repair pack | 200 | 200 |
| Tesla turret | 10 | 5 |

Light-oil cracking completed 620 crafts during the production test. Heavy oil
was fully consumed by the mall, so its overflow branch was tested separately
after production: a temporary tank fill triggered nine cracking crafts, and
draining the tank closed the pump below its reserve. That diagnostic fluid was
added only after the 90-minute production measurements.

Finally, ten logistic robots were added for a separate collection test. They
delivered a manufactured repair pack from the mall to a requester chest in the
far northwest cell of the original extension. No intermediate items were moved
by robots during the 90-minute production test.

The [validation report](compact_turbo_tesla_mall.validation.json) records these
checks and SHA-256 hashes of both the tested blueprint and original extension.

[Factorio Blueprint Editor](https://fbe.teoxoy.com/) was also tried. Its current
importer rejects this build's Space Age entities as unsupported. It cannot
validate this blueprint; the Factorio simulation is the production check.
The editor's actual response is recorded in
[the editor report](compact_turbo_tesla_mall.fbe-check.json). Its first rejected
entry is the Space Age Tesla-turret icon. The editor test was repeated for this
updated blueprint; its hash matches the native validation report.

```sh
npm run generate:belt-mall
npm run test:belt-mall
node scripts/render-belt-mall.mjs
node scripts/check-belt-mall-editor.mjs
```

Game data comes from the installed Factorio prototypes. Relevant mechanics:
[turbo belts](https://wiki.factorio.com/Turbo_transport_belt),
[stack inserters](https://wiki.factorio.com/Stack_inserter),
[Tesla turrets](https://wiki.factorio.com/Tesla_turret), and
[repair packs](https://wiki.factorio.com/Repair_pack).
