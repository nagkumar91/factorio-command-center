# Verified Luna pilot results — 2026-11-11

Both full targets passed native Factorio 2.1.24 testing with the installed mod snapshot: 360 green circuits/min in 364 tiles and 90 red science/min in 299 tiles. Input display panels and all saved power/logistics infrastructure are included in the bounding rectangles.

Luna (`gpt-6-luna`, high reasoning) generated and revised the layouts. The supervisor supplied the constraints, deterministic checks, game evaluator, bottleneck diagnoses, topology guidance, and the final red iron-feed coordinates. This was supervised optimization, not an autonomous model benchmark or fine-tuning run. Model cost/token usage was not measured.

| Layout | Footprint | Measured items/min | Tiles per item/min |
| --- | ---: | ---: | ---: |
| baseline-item-electronic-circuit-intermediary | 50×74 = 3700 | 9.9667 | 371.2375 |
| luna-circuits-r6 | 13×14 = 182 | 180.0000 | 1.0111 |
| luna-circuits-r7-360 | 26×14 = 364 | 360.0000 | 1.0111 |
| baseline-item-automation-science-pack-intermediary | 50×74 = 3700 | 9.0000 | 411.1111 |
| luna-red-r4 | 23×13 = 299 | 90.0000 | 3.3222 |

Compared with the original intermediary cells, area per output improves about 367× for circuits and 124× for red science. These input boundaries differ: the originals import cable/gears; the new candidates make those intermediates from plates. The new candidates perform more processing, while mining, smelting and electricity generation remain outside both comparisons.

The supplied [Nilaus circuit module](https://factorio.menzies.io/prints/-LI0gc-a-2_VLWR-tx1d?page=14) is published as 26×14 tiles and 360/min nameplate capacity. The final circuit pair matches those published dimensions and sustains 360/min natively. Nilaus' print was not rerun in this test. Our design uses red cable belts and bulk inserters and has 170 entities versus the mirror's reported 160; this is a footprint/rate match, not a cheapest-construction or global-optimality claim. The source's red/green science module has multiple products, so its full area is not used as a red-only comparator.

## Production evidence

Each test starts empty, warms up for 15 simulated minutes, and measures 30 minutes in three ten-minute windows. Only declared boundary inputs and external electricity are supplied. Physical collected output is backed by independent production statistics. No modules, quality, or researched capacity/productivity bonuses are granted. Every output window was exactly 360 circuits/min or 90 science/min respectively.

Circuit consumption: 540 copper plates/min and 360 iron plates/min. Science consumption: 90 copper plates/min and 180 iron plates/min. All ten circuit/cable assemblers and all eleven science/gear assemblers were sampled working throughout the 1,800 measured seconds. Each final blueprint has zero geometry/grid/power audit failures and passed exact native import and connectivity checks.

Prototype SHA-256: `33912441b13d155b13734523406bbc9aa81fc0f2992344b56106b3aa5c52d19f`.

- **luna-circuits-r6**: blueprint `35dd72044fc798b55af35a426d0b81d4856e86e893144ae998f293bc4a826399`; native report `750781158180f9878dd111c82318fa5a453b859eea1afa81d1c1547c7309a15b`; configuration `c4e7b25b6c39c2499663c296438a950a4d5a92853f869a0cd141793eb82d3295`.
- **luna-circuits-r7-360**: blueprint `bf4d6a63d8a27fa3f3c0ea32d63701eff92c93195c4b216b2c2dbcbddc3ae7ba`; native report `91a6d414b8fc06219bdfda1bd300bd64122371de98d6930a1f81dc99ebe170da`; configuration `10653c67b49c1f943589519caa9355e2e672706ace10936aaf45d4b331955ef9`.
- **luna-red-r4**: blueprint `1231f0aea478ea1cb743e16978d8288631161f7821218e65ef321e4055721f85`; native report `62e4e362b4a23197878fcc63aae914c4563e4a3d45ce50775b9d2c8745f3b5f5`; configuration `bed4dbb4e9a0cd9e696780ce6a167b7c9f29812be9580c1af41739dbb8c3cf5d`.

## Iterations and validation

Circuits: r1 failed import/geometry; r2 delivered 90/min with unpowered arms; r3 delivered 170/min; compact r4 and bulk-pickup r5 delivered 157.5/min. The successful r6 collects all cable before distributing it on a return belt, giving 180/min in 182 tiles. The paired r7 then passed at 360/min in 364 tiles.

Science: the initial draft failed static checks; r2 passed at 45/min in 350 tiles; packed r3 delivered 78.2667/min in 299 tiles because the gear assembler lacked iron. R4 added a second actual iron pickup and passed at 90/min without increasing area.

The four geometry/power/grid regression tests passed. The project suite passed 158 tests with five optional/cache-dependent skips and zero failures; `npm run build` passed. The local report was checked in headless Chromium for broken images and horizontal overflow. Full native reports, immutable revision snapshots, import strings, diagrams and the reusable prompt are in the offline review bundle; generated game saves, logs, dependencies and prototype dumps remain outside Git. The published catalogue and player save were not changed.
