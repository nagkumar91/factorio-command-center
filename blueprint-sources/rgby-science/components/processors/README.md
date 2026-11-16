# Processor component

`makeProcessors(raw)` is exported from `scripts/rgby-science/processors.mjs`. Pass the exact installed 2.1.24 `data.raw` dump. The function is deterministic and does not write files.

Return fields:

- `entities`: ordinary blueprint entities with consecutive local `entity_number` IDs. Every entity has `tags.flight_science_entity` equal to its local ID. No modules or test supply fixtures.
- `wires`: Factorio 2.x wire tuples `[entityID, connectorID, entityID, connectorID]`; red circuit connectors are 1, pole copper connectors are 5.
- `ports`: `{kind, item, items:[item], entity, x, y, position:{x,y}, externalSide, perMinute}`. Solid inputs also have `direction:4`.
- `loopControl`: one stock-control descriptor with `reader`, `controlled`, `loop`, `limits`, total belt `capacity`, `maximumStock`, loop `width`/`height`, and `admission` details. All entity references are local IDs and must be remapped on integration.
- `machineCounts`: `{'processing-unit':5}`.
- `footprint`: `{left:-4,top:-5,right:20,bottom:4,width:24,height:9}`; right and bottom are exclusive tile edges. Area: 216 tiles.
- `capacityPerMinute`: 22.5 nominal processors/min, derived from the supplied recipe and AM2 speed.
- `powerPoleIds`: five connected medium poles. Main integration may remove and re-power them; preserve circuit wires independently.

`component.json` is the full return value. `processors.txt` is an importable blueprint, and `manifest.json` includes its exact SHA-256, construction counts, geometry and native result.

## Exact local geometry

Coordinates below are actual entity centers; 0=north, 4=east, 8=south, 12=west.

| Port | Center | Side | Demand/capacity per minute |
|---|---|---|---:|
| electronic-circuit | (-3.5, 2.5) | west | 450 |
| advanced-circuit | (-3.5, 3.5) | west | 45 |
| sulfuric-acid | (-3.5, -4.5) | west | 112.5 |
| processing-unit | (19.5, 1.5) | east | 22.5 |

At 20 processors/min, consumption is 400 green circuits, 40 red circuits and 100 acid/min. Listed port rates cover the full five-machine capacity; supply extra during startup inventory filling.

Five adjacent, north-facing AM2 centers: `(3.5,-2.5)`, `(6.5,-2.5)`, `(9.5,-2.5)`, `(12.5,-2.5)`, `(15.5,-2.5)`. Each is 3×3. Rear manifold: 20 pipes at every integer step in x from -3.5 to 15.5, y=-4.5. These directly touch the five north acid inlets.

The 40 red belts form a closed rectangle with centerline corners `(0.5,0.5)`, `(17.5,0.5)`, `(17.5,3.5)`, `(0.5,3.5)`. Travel is east along the top, south at the east edge, west along the bottom and north at the west edge. At each AM2 center x=c, two fast input arms sit at `(c-1,-0.5)` and `(c,-0.5)`, facing south (pickup from the loop, delivery north). The fast output arm sits at `(c+1,-0.5)`, facing north (pickup north, delivery south), filtered to processors and controlled by loop stock.

Green ingress belt centers: `(-3.5,2.5)` east, `(-2.5,2.5)` east, `(-1.5,2.5)` north, `(-1.5,1.5)` north. Two filtered bulk arms at `(-0.5,1.5)` and `(-0.5,2.5)` face west, picking up from those belts and dropping onto the loop. Red ingress: three east-facing belts at x=-3.5,-2.5,-1.5, y=3.5, then a west-facing filtered fast arm at `(-0.5,3.5)` dropping onto the west return corner.

The east-facing product transfer is a west-facing filtered fast inserter at `(18.5,1.5)` picking up from the east loop edge. Its passive provider chest is `(19.5,1.5)`, `bar:1` (one usable inventory slot).

Medium pole centers: x=1.5,5.5,9.5,13.5,16.5, all y=1.5. The complete standalone native test checks that every arm and machine is connected to electricity.

Stock limits: green=96, red=16, processors=8. The reader at `(0.5,0.5)` holds the entire connected belt contents; all 40 loop segments share one red network. It controls both green admission arms, red admission, and all five machine output arms. Total nominal belt capacity is 320 items; limit sum is 120, leaving room even if stock predominantly occupies one lane. Limits count the loop, not machine inventories or arm hands.

## Base admission capacity and evidence

Installed 2.1.24 grants `bulk-inserter-capacity-bonus:+1` in the **bulk-inserter unlock technology itself**. Therefore the ordinary unlocked bulk arm carries **2 items per hand**, with no later inserter-capacity upgrades. Simply enabling all recipes on an otherwise unresearched force leaves it at one item and is insufficient for these two admissions. `loopControl[0].admission` records the prerequisite and base capacity explicitly.

The standalone native test imported and revived the exact saved blueprint, fed only the declared west input belts and west acid pipe, and removed product from the declared east chest. It used Factorio 2.1.24, bulk-inserter unlock only, no later capacity upgrades, no modules, five minutes warmup and fifteen minutes measurement. All 4,500 machine status samples were working; every machine produced; both bulk arms demonstrably held two items. Maximum observed loop stock was 85/320.

Measured production was **22.4/min** and chest collection **22.5333/min**. These are finite-window measurements: stock moving across the measurement boundary accounts for the difference, and nominal capacity remains **22.5/min**. The result proves standalone production above 20/min with saturated declared inputs. Main-factory integration and paced 400/min green input remain integration checks.

`native-report.json` binds the result to the exact blueprint SHA-256 `6eead5e8da4c470efcaa324a3595ce113bdf0ed6cee4508ee2ddebfc0442fcd2` and prototype dump SHA-256 `ce40aee67d984865f22ed8e65ba6b93fefb014fc35e45b747b64aca3ed5682a3`.

Task-local reproducibility: `node .cache/rgby-processors/audit.mjs` regenerates these artifacts and runs the private native profile under `.cache/rgby-processors/native`. `node .cache/rgby-processors/validate.mjs` checks the current API, geometry, power, wires, saved artifacts and report without launching the game. No global profile or source outside this component is needed.
