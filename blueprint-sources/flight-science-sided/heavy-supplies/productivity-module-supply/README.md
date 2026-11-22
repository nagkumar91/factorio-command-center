# Productivity module supply · 20/min

Supply factory for the south entrances of the Compact six-pack tier (`../../compact/`), in the style of the family's three validated supplies (`../../README.md`, "Validated supply factories"). Targets the installed Factorio 2.1.24 flight-save recipes (prototype SHA-256 `33912441b13d155b13734523406bbc9aa81fc0f2992344b56106b3aa5c52d19f`).

- Blueprint: `productivity-module-supply.txt`, SHA-256 `c8dbf2751a2788807ebbcd379c999d0cd038e355ee6fe5a20b380b53474e7da3`
- Status: **native-verified** (exact-hash `native-report.json`)
- Footprint: 25 × 7 (175 tiles), 7 assembling machine 2, 89 entities
- Recipe: 15 s at crafting speed 0.75 = 3/min per machine; 20/min needs 6.67, rounded up to 7
- Normal assembling machine 2, fast inserters (hand size 1), red belts; no modules, robots, circuit controls or inserter-capacity research

## Inlets (west) and outlet (east)

| Inlet | Tile | Panel figure /min | Measured draw at 100% /min | at 80% /min |
|---|---|---:|---:|---:|
| advanced-circuit | (-3.5, 1.5) | 100 | 100.00 | 80.00 |
| electronic-circuit | (-3.5, 4.5) | 100 | 100.00 | 80.00 |

Outlet: filter fast inserter into a steel chest (bar 2) at (20.5, 3.5), east edge, 20 productivity modules (tier 1)/min. Circuits are supplied: electronic circuits from `green-circuit-supply`, advanced circuits from `advanced-circuit-supply` (or the user's circuit suppliers).

## Layout

Seven assemblers in one row. North belt: advanced circuits on the north lane, electronic circuits on the south lane (a three-tile riser at the west edge takes red circuits from its west side and green circuits from its east side, then turns east). One fast inserter per assembler picks both circuits; one drops modules on the south belt, which turns north at the east edge where a filter fast inserter lifts modules into the steel chest. The big electric pole (power port) is in the south-west corner.

```
  0 D>>>>>>>>>>>>>>>>>>>>>>>.    D display panel, > ^ < red belts, n s fast inserters
  1 >^..n.PnP.n..n.Pn..n.Pn..    B big electric pole (power port), P medium pole
  2 .^<AAAAAAAAAAAAAAAAAAAAAD    A assembling machine 2 (productivity module)
  3 D^^AAAAAAAAAAAAAAAAAAAAAC    C steel chest (outlet)
  4 >>^AAAAAAAAAAAAAAAAAAAAAs
  5 BB..n.PnP.n..n.Pn..n.Pn.^
  6 BB..>>>>>>>>>>>>>>>>>>>>^
```

## Native evidence

Headless Factorio 2.1.24 on a private copy of the flight-save mod profile; never the live game. Every inlet belt is fed exactly its panel figure (and, in a second copy, 80% of it) at the back of the belt, unaccepted items queued; the chest is emptied every second. Protocol: 15 min warm-up, 30 min measured, 5 min output blocked, 2 min settling, 3 min recovery measured.

| Feed | Steady /min | Recovery /min | Crafts per assembler (30 min) |
|---|---:|---:|---|
| 100% | 20.00 | 20.00 | 90, 90, 90, 90, 90, 90, 60 |
| 80% | 16.00 | 16.00 | 90, 90, 90, 90, 90, 25, 5 |

Both runs: only the product reached the chest, every inlet accepted at least 99% of what was offered with an empty queue at the end (no jam), every assembler crafted at full feed.

## Reproduce

- `node scripts/flight-science-sided/heavy-supplies/productivity-module-supply/generate.mjs` (needs the flight-save `data-raw-dump.json`: `FLIGHT_PROFILE=<dir>` or `.cache/flight-21` or `.cache/heavy-supplies/flight-21`; byte-identical on re-run)
- `node scripts/flight-science-sided/heavy-supplies/productivity-module-supply/validate.mjs` (needs the profile's `mods/` too)
- `node --test tests/heavy-supply-productivity-module.test.mjs`
