# reference-layout

The spec's 25 x 17 reference: 17 machines, two gear machines on the rear iron belt, one advanced-circuit machine, a bay with the substation and a four-phase gear clock (10 s windows).

Short native screen only (5 min warm-up, 10 min measured, no cap phases; `explore-report.json`, `short: true`): fast transport belts 0.4/min (floor 8) and bulk inserters 0.3/min (floor 1). Everything else was above its floor.

What the diagnostics showed:

- The transport-belt and inserter machines took gears only in phase 3, shared with the bulk-inserter and fast-splitter machines. Transport belts ran short, so the fast-belt machine sat with gears and no belts.
- With those intermediates unclocked (they are bounded by their own ring limits), gears ran at 180/min and the eight products together wanted more than that. Fast undergrounds, drills and AM2 overproduced while fast belts and bulk inserters starved. Two gear machines leave about 20% slack over the floors, and time windows could not share that fairly.
- The single advanced-circuit machine (7.5/min) feeds both furnaces (5 per craft) and bulk inserters, so those two were always within about 20% of their floors.

Next: a third gear machine and one final product per gear window (`three-gears`, then `top-drill`).
