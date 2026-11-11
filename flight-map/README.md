# Flight Forest

A local Factorio 2.0.77 Space Age save for the installed Everything on Nauvis + EV mod profile. This is an accelerated game, with normal enemies and normal research progression to robots. No additional mod is required.

## Play offline

Load the delivered **Flight Forest - Max Resources - Ready** save (the exact installed filename is in `native-report.json`) from Factorio's Load game menu. Use the **Ready** version; earlier generated versions are superseded. The build command installs a new save without replacing any existing save. The website's **Flight factories · modded** link opens the separate mod-aware catalogue; keep the supplied offline website folder together so icons, previews and downloads work without internet.

- **Power:** 480 connected solar panels and 420 accumulators, precharged. Connect your factory to the substations north of spawn. Nominal peak solar power is 28.8 MW; the standard Nauvis cycle averages about 20 MW. Expand solar and storage as demand grows.
- **Start:** chests south of spawn contain miners, furnaces, assemblers, belts, inserters, laboratories, construction materials and basic defenses. No robots or science packs are granted. Manual crafting and laboratory research operate at twice normal speed; research still consumes its normal science ingredients.
- **Resources:** every resource tile/entity starts at the maximum uint32 amount, **4,294,967,295**, including newly generated chunks. Mining still depletes resources normally. Guaranteed iron, copper, coal, stone, uranium, calcite, tungsten, holmium and scrap patches. Six maximum-amount wells per fluid supply crude oil, sulfuric acid, lithium brine and fluorine. Water, lava and ammonia lakes plus yumako and jellynut groves are nearby. The map continues beyond the designed starting area with abundant natural resources.
- **Enemies:** normal aggression, evolution, pollution and expansion settings. The initial 640-tile square clearance has no enemy entities or demolisher territory. This is not a permanent protective barrier: pollution and future expansion still matter.
- **Forests:** 3,616 guaranteed trees in a green belt around the clear core, with more naturally generated trees outside. Cardinal exits remain open. Wood processing is enabled immediately; 200 tree seeds let you plant on suitable soil. Later, agricultural towers automate planting. Solar power and efficiency modules reduce pollution at its source.

The installed mod rewrites planet unlocks: heating towers follow concrete, recycling follows processing units and production science, and carbon is unlocked by tungsten-carbide research. Foundries require crafting tungsten carbide. The progression audit documents every supported trigger and any explicit scenario exceptions.

## First steps and local unlocks

1. Take miners, furnaces, coal, belts, inserters and poles from the starter chests. Mine iron and copper, connect to the solar grid, and smelt fresh plates. The normal early crafting triggers still apply: inventory grants do not count as crafting.
2. Craft a laboratory after electronics unlocks, then build red/green science. The supplied machines and twofold research speed shorten the early phase without granting science or robot technology.
3. Use the early wood-processing recipe and tree seeds to extend the forest on suitable soil. Keep the center and the marked specimen pads clear.
4. Hand-mine the volcanic rocks near **240,136** for at least 160 tungsten ore and 160 calcite. This covers the first foundry and big mining drill before productivity bonuses; later drills mine the large tungsten deposit.
5. After their prerequisites, mine the marked **iron stromatolite** for agriculture and **copper stromatolite** for the heating tower. A lithium iceberg supports later lithium research. If you mined a specimen too early, its clear pad replenishes when the prerequisite gate is ready.
6. Recycling remains normal science research after processing units and production science. The ground exchange at **240,100** offers paid, research-gated recovery supplies and space-only chunks. It does not auto-research robotics, foundries, heating towers or recycling.

Only two space-action triggers are substituted: after you earn rocket-silo research, the scenario completes the platform-creation and collector-placement triggers so crushers/white science can progress without a trip to space. Asteroid chunks then cost terrestrial materials at the market. Eggs purchased later retain their normal spoil/hatch behavior. A dormant capture target appears only after captivity research; you still perform the capture yourself. Space-travel victory itself is not a ground-only endpoint.

For the first robot production line, start with an **intermediate-input** variant and supply its prepared parts. Hand-craft the initial logistic robots needed to bootstrap that network. Switch to mixed or raw variants as your supply network grows; large raw factories can need substantially more robots, charging capacity and construction materials.

The factory catalogue targets construction **after** you have earned its listed research. Robot-served layouts need logistic robots and requester chests, not merely personal construction robots. Read each input boundary: raw resources are delivered to the marked ports; the factory does not include the external mining or pumping installation.

## Reproduce

From this project, with the same Factorio installation and enabled mods:

```sh
python3 scripts/prepare-flight-map.py --dump --install
python3 scripts/verify-flight-future-resources.py
```

The script snapshots installed mods/settings into an ignored cache on the first run. It never changes the installed mod list or startup settings. Subsequent runs reuse that snapshot for reproducibility. The full map settings and scenario Lua are tracked here; saves, mods, prototype dumps and logs stay under `.cache/flight-game/`. To use a different installed mod profile, use a new isolated cache rather than silently changing this profile.

`native-report.json` records actual resource totals, tree and power counts, exact save/prototype/scenario hashes and mod versions. Native scenario assertions verify starter resources, collision-free power placement, a connected power grid, enemy clearance and locked robot research. The builder also starts an isolated local server from a copy of the save and verifies the loaded resource amounts, all 13 resource types, power grid, trees, early tree recipe, disabled automatic starter grant, and locked robot research before installation. `native-loaded-save-report.json` records those runtime checks; it does not simulate a player connection. `native-max-resources-report.json` separately verifies newly generated terrain. The website overview is explicitly a schematic, not a screenshot of terrain.

The source mod emits an existing warning about differing Gleba spawner collision masks and potential expansion behavior; the flight scenario does not patch that mod behavior. Ordinary enemies remain enabled.

## Publication boundaries

Game saves and installed mods are local-only and must never enter Git or public hosting. Only recipe plans, source generators, blueprint strings, small verification reports and website assets belong in the public catalogue. A calculated production balance is not a native throughput result; a native result must match the exact blueprint and installed prototype hashes.
