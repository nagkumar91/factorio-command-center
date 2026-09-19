# Tested layout revisions

Older tested blueprints remain available in the website's version selector. The default is the latest accepted revision. Each version retains its exact string, construction inventory, preview and native reports.

## Military v2

Military v2 occupies 34 × 30 tiles, compared with v1's 19 × 77: 30.3% less area. It uses 392 entities instead of 731, and 286 ordinary belts instead of 617. A recipe-specific iron splitter order supplies grenades before steel and firearm magazines. This maintains the measured output of 4.6667 military science packs per minute without adding a machine.

The source SHA-256 is `c46f80bc0f1bd30096530c001fbfcbdf00d9ce14d4db25d528c31a74702de01c`. The 45-minute functional test delivered science from an empty start and resumed after collection. Its separate sustained test used 15 minutes of warmup and 30 minutes of collection. See the matching entries in `validation.json` and `throughput.json`.

## Ordinary-belt search, 2026-09-19

The first video-inspired experiment used wave function collapse to join directed belt tiles and a genetic algorithm to vary tile preferences. It held machines, recipes, inserter contacts, power, fluids, underground endpoints and external ports fixed. Every candidate also had to retain or reduce the full footprint. This is a limited corridor search, not a claim of a globally optimal factory.

The search compared its results with a deterministic shortest-path control. Both methods found the same best belt counts for the accepted corridors; this experiment does **not** show that genetic search outperforms the simpler control.

| Module revision | Entities before → after | Ordinary belts saved | Output before → after, per minute |
| --- | ---: | ---: | ---: |
| Grenade v2 | 70 → 68 | 2 | 5.6333 → 5.6333 |
| Crude oil barrel v2 | 95 → 93 | 2 | 7.5 → 7.5 |
| Water barrel v2 | 94 → 92 | 2 | 7.5 → 7.5 |
| Rail signal v2 | 134 → 132 | 2 | 6.2333 → 6.2667 |
| Rail chain signal v2 | 134 → 132 | 2 | 6.2333 → 6.2667 |

These are modest construction savings with unchanged footprints. Two yellow belts cost three iron plates in the standard recipe chain. The one-item difference in each signal's 30-minute collection window is not treated as a higher sustained capacity.

All five revised strings passed the 45-minute native functional test and the 15-minute-warmup/30-minute benchmark in Factorio 2.0.77, seed 12345. Only declared raw inputs and external power were supplied. Every recipe ran, the output was collected, production restarted, and every electric consumer connected to P. The generator replay was checked byte-for-byte against the five tested strings.

No shorter eligible corridor was found for the current Military design. A stone-brick shortcut expanded its footprint and was rejected; a search constrained to the existing footprint found no saving. Those defaults remain unchanged.

## Reproduction and evidence

The accepted edits are pinned by decoded-layout hashes in `corridor-optimizations.json`. `scripts/prepare-early-game.mjs` replays them only on the exact expected arrangement, and restores the tested blueprint's display text. The website's native gates continue to verify hashes of the exact downloadable strings.

The experiment implementation is in `experiments/blueprint-evolution/`. Its generated search state and raw simulation files stay in the private local cache. Published `validation.json` and `throughput.json` contain the matching proof for the saved layouts. Input rates are actual consumption during that window; temporary buffer filling can affect them.
