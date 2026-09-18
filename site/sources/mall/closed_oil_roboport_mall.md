# Roboport mall with oil cracking

Import [the blueprint string](closed_oil_roboport_mall.txt) into Factorio using **Import string**. The [JSON](closed_oil_roboport_mall.json) contains the same layout. In the local Command Center, search for **Closed-oil Roboport Mall** and select **Copy blueprint**.

This is an original robot-fed layout based on the products in the reference screenshot. It makes the pictured solid outputs, adds roboports, makes iron sticks internally, and routes light oil through cracking into the petroleum gas used by plastic and sulfur production. It uses normal-quality equipment and standard Nauvis recipes, with no foundries, beacons, or modules.

## Start it

1. Place the complete blueprint on a clear, dry area approximately **172 × 128 tiles**. Build its power grid and all 12 roboports.
2. Connect your electricity supply to any included substation. Leave capacity for robot charging as well as production; the 12 roboports add a substantial charging load.
3. Put **300 logistic robots** into the included roboports, preferably spread among them. Construction robots can build the layout, but logistic robots carry its ingredients. The blueprint requires the logistic-system technology and all machine/product recipes unlocked.
4. Supply **iron ore, copper ore, and coal** to the three labeled passive-provider chests on the west side. You can also feed those items into any provider chest in the same network. Keep supplying them as the mall operates.
5. Connect **water** and **crude oil** to the two labeled pipe ends at the northwest edge. Water is the top pipe; crude oil is four tiles below it.
6. Collect finished products from their passive-provider chests. Produced logistic/construction robots are stocked as items; move them into roboports yourself when expanding the working fleet.

The mall starts from empty inventories. Its smelting, circuits, engines, and upgrade chains need time to fill, so the expensive blue belts and roboports arrive after the basic products. It is intended to replenish building supplies, not sustain a full output belt of every product simultaneously.

## Oil routing

- Advanced oil processing supplies all three oil products.
- Heavy oil feeds lubricant. Its feed pump stops when the lubricant tank contains 5,000 fluid, preventing lubricant storage from taking all subsequent heavy oil.
- A second wired pump sends heavy oil to cracking only when the heavy-oil tank contains more than 2,000 fluid.
- Light oil from the refinery and heavy-oil cracking goes to light-oil cracking. The resulting petroleum gas supplies plastic and sulfur.
- Sulfur feeds sulfuric acid and batteries; lubricant feeds blue transport equipment and electric engines.

No external light-oil consumer is needed. As with a mall using finite storage, refining/cracking can pause when petroleum consumers and buffers are full. The design does not destroy surplus fluid or claim unlimited consumption with no product demand.

The [Factorio light-oil reference](https://wiki.factorio.com/Light_oil) describes the cracking route. A [roboport](https://wiki.factorio.com/Roboport) uses 45 steel plates, 45 iron gear wheels, and 45 advanced circuits; all three are made inside this layout.

## Finished stock targets

| Product | Target in its output chest |
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
| **Roboport** | **10** |

Red wires connect each output chest to its output inserter. Change the inserter's threshold and the chest's slot limit together to adjust a target. An inserter may already be holding a small batch when a threshold is reached. Intermediate chests are also available to the logistic network.

The placed roboports support the mall's logistics. A separate assembler near the south edge manufactures additional roboports into its provider chest.

## Reproduce and verify

From the project directory:

```sh
npm run generate:mall
npm run test:mall
```

The generator checks entity footprints and fluid labels. The native test imports the actual string into Factorio 2.0.77 with Space Age, revives every blueprint entity, and runs a disposable map for 90 simulated minutes. It supplies only ores, coal, water, crude oil, power, and 300 starter logistic robots. It checks all requested products, both cracking recipes, electrical coverage, one connected logistics network, and fluid separation. Logs and the detailed report are under `.cache/roboport-mall/game/`.

The local explainer uses explicit furnace-feed annotations to include ore smelting in the material flow. In the game, furnaces select recipes automatically from their supplied ingredient.
