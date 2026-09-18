# Robot Expansion Mall — Raw Inputs

[Import blueprint](robot_expansion_mall.txt) · [Factory close-up](robot_expansion_mall.png) · [Extension overview](robot_expansion_mall.overview.png)

A new robot-fed mall that makes **roboports, construction robots, logistic robots,
and big electric poles** from raw resources. There are **no belts, splitters or
loaders**. Logistic robots carry every solid intermediate between configured
requester and passive-provider chests. Inserters load and unload the machines;
pipes carry fluids.

The factory has **66 machines and 13 substations** in a **98 × 45 tile** area.
It fits two adjacent cells of your existing 50-tile robot grid. The import
includes your complete 5×5 extension: all **25 roboports and 85 big poles** retain
their exact positions, existing copper connections and original snapping grid.
The overall blueprint footprint, including that extension, is **252 × 252 tiles**.

## Start the mall

1. Import the string into Factorio 2.0 with Space Age. Place it in an empty
   matching extension bay, keeping the original orientation and aligning the
   roboports. Existing extension entities are reused.
2. Build the factory and connect electricity to its pole network. Research the
   relevant recipes, logistic system, electric furnaces and advanced oil processing.
3. Put **200 starter logistic robots** into the two roboports beside the factory,
   about 100 in each. These robots are needed before the mall can make more robots.
4. Supply the five marked provider chests: **two for iron ore, two for copper ore,
   and one for coal**. Keep the supplies coming. The duplicate ore chests provide
   storage and access capacity for each ore.
5. Connect **water and crude oil** to the two labeled pipe terminals on the right.
   Use normal-quality solid ingredients to match the requester filters.

Electricity, the placed factory equipment and starter robots are external
requirements. The operating material inputs are only **iron ore, copper ore,
coal, water and crude oil**. Mining, pumping at the resource patches and power
generation are outside this blueprint.

The stack inserters are Space Age construction equipment. The mall does not
need holmium, tungsten, imported circuits, plates, batteries or engines to operate.
All construction equipment is normal quality.

## What it makes internally

| Production stage | Made inside |
| --- | --- |
| Smelting | Iron plates, copper plates, steel |
| Basic parts | Copper cable, iron gears, iron sticks, pipes |
| Electronics | Electronic circuits, advanced circuits |
| Oil and chemistry | Heavy oil, light oil, petroleum gas, lubricant, plastic, sulfur, sulfuric acid, batteries |
| Robot components | Engine units, electric engine units, flying robot frames |

The smelters comprise 16 iron furnaces, 8 copper furnaces and 8 steel furnaces.
Furnaces select their smelting recipe from the material delivered by their
requester chest. Every other crafting machine has its recipe configured.

Heavy oil supplies lubricant. A wired pump sends surplus heavy oil to cracking
when its tank exceeds 2,000 units, preserving oil for the engines. Lubricant
production pauses when its tank reaches 1,500 units. Light oil is cracked into
petroleum gas, which supplies plastic and sulfur. No oil byproduct needs an
external disposal line. Full internal buffers and finished stocks pause
production normally.

## Finished output chests

| Product | Stock target |
| --- | ---: |
| Roboport | 20 |
| Construction robot | 200 |
| Logistic robot | 200 |
| Big electric pole | 100 |

The four output assemblers and their adjacent provider chests are grouped in
the fourth dry-production row. Their recipes identify them on the close-up.
Collect from those chests by hand or through the logistics network. Produced
robots stay in their chests until you put them into roboports; production does
not automatically increase the working fleet.

The two robot assemblers compare their finished stocks and favor the less-stocked
robot type. Ingredient and intermediate inserters transfer four items at a time.
Each requester asks for at least 16 of each ingredient so it can support those
batches. Finished-product inserters transfer one item at a time and use local
red-wire stock controls.

To change a final target, edit the output inserter's circuit threshold and the
chest's available slots. Keep the local stock-control wires and configured
request filters intact. All raw, intermediate, requester and output chests have
coverage from the same connected roboport network.

## Native validation

The test imports the exact blueprint string into an isolated copy of the
installed Factorio 2.0.77 game with Space Age. It first places the supplied
extension, then overlays the mall. Only raw resources, electricity and the
specified starter robots are supplied. No intermediate materials are injected.

A control phase checks that item production has not started before the robots
are added. The simulation then checks placement, power, coverage of every chest,
all intermediate recipes, oil cracking, fluid separation, finished stock targets
and replenishment after collecting the outputs.

**Passed a 90-minute native production and replenishment test.** The test
placed all 521 new factory entities over the 110 unchanged extension entities.
All 127 chests shared one powered logistics network. At minute 75, all four
stock targets had been reached; every final chest was then emptied.

| Product | Collected at minute 75 | Replenished by minute 90 |
| --- | ---: | ---: |
| Roboport | 20 | 20 |
| Construction robot | 200 | 172 |
| Logistic robot | 200 | 174 |
| Big electric pole | 100 | 100 |

These are test results under the supplied conditions, not a guaranteed rate.
The [validation report](robot_expansion_mall.validation.json) records the checks,
recipe craft counts, and SHA-256 hashes of the exact tested blueprint and the
original extension.

The test uses 200 normal logistic robots with a 100% speed bonus and a cargo
bonus of two items. Research, robot count, input supply and other work in a shared
network affect the rate in your save.

```sh
npm run generate:robot-mall
npm run test:robot-mall
node scripts/render-robot-expansion-mall.mjs
```
