# Electric furnace supply · 20/min

Supply factory for the south entrances of the Compact six-pack tier (`../../compact/`), in the style of the family's three validated supplies (`../../README.md`, "Validated supply factories"). Targets the installed Factorio 2.1.24 flight-save recipes (prototype SHA-256 `33912441b13d155b13734523406bbc9aa81fc0f2992344b56106b3aa5c52d19f`).

- Blueprint: `electric-furnace-supply.txt`, SHA-256 `e55fd9e14df1c3b944b801e064f08a4e80f232d9e0697cfe76c5bba35866f56e`
- Status: **native-verified** (exact-hash `native-report.json`)
- Footprint: 15 × 7 (105 tiles), 3 assembling machine 2, 66 entities
- Recipe: 5 s at crafting speed 0.75 = 9/min per machine; 20/min needs 2.22, rounded up to 3
- Normal assembling machine 2, fast inserters (hand size 1), red belts; no modules, robots, circuit controls or inserter-capacity research

## Inlets (west) and outlet (east)

| Inlet | Tile | Panel figure /min | Measured draw at 100% /min | at 80% /min |
|---|---|---:|---:|---:|
| steel-plate | (-3.5, 1.5) | 200 | 200.00 | 160.00 |
| stone-brick | (-3.5, 4.5) | 200 | 200.00 | 160.00 |
| advanced-circuit | (-3.5, 5.5) | 100 | 100.00 | 80.00 |

Outlet: filter fast inserter into a steel chest (bar 2) at (10.5, 3.5), east edge, 20 electric furnaces/min. Circuits are supplied: electronic circuits from `green-circuit-supply`, advanced circuits from `advanced-circuit-supply` (or the user's circuit suppliers).

## Layout

Three assemblers in one row. North belt: steel plates on the north lane, stone bricks on the south lane (a three-tile riser at the west edge takes steel from its west side and brick from its east side, then turns east, so each material keeps its own lane). Two fast inserters per assembler pick from it. South belt: advanced circuits side-load its north lane; one inserter per assembler picks them, another drops furnaces on the south lane. At the east edge the south belt turns north and a filter fast inserter lifts furnaces into the steel chest. The big electric pole (power port) sits in the two free columns between the inlets and the first assembler; connect it by wire to your network.

```
  0 D>>>>>>>>>>>>>.      D display panel, > ^ v < red belts, n s fast inserters
  1 >^.BBnn.nnPnn..      B big electric pole (power port), P medium pole
  2 .^<BBAAAAAAAAAD      A assembling machine 2 (electric furnace)
  3 D^^.PAAAAAAAAAC      C steel chest (outlet)
  4 >>^..AAAAAAAAAs
  5 >>v..s.nsPnsPn^
  6 D>>>>>>>>>>>>>^
```

## Native evidence

Headless Factorio 2.1.24 on a private copy of the flight-save mod profile; never the live game. Every inlet belt is fed exactly its panel figure (and, in a second copy, 80% of it) at the back of the belt, unaccepted items queued; the chest is emptied every second. Protocol: 15 min warm-up, 30 min measured, 5 min output blocked, 2 min settling, 3 min recovery measured.

| Feed | Steady /min | Recovery /min | Crafts per assembler (30 min) |
|---|---:|---:|---|
| 100% | 20.00 | 20.00 | 270, 270, 60 |
| 80% | 16.00 | 16.00 | 270, 180, 30 |

Both runs: only the product reached the chest, every inlet accepted at least 99% of what was offered with an empty queue at the end (no jam), every assembler crafted at full feed. The power port sits inside the body, so the harness wires an external big pole to it (as a player would).

## Reproduce

- `node scripts/flight-science-sided/heavy-supplies/electric-furnace-supply/generate.mjs` (needs the flight-save `data-raw-dump.json`: `FLIGHT_PROFILE=<dir>` or `.cache/flight-21` or `.cache/heavy-supplies/flight-21`; byte-identical on re-run)
- `node scripts/flight-science-sided/heavy-supplies/electric-furnace-supply/validate.mjs` (needs the profile's `mods/` too)
- `node --test tests/heavy-supply-electric-furnace.test.mjs`
