# two-row-rail (qualified, superseded)

Replaced because it was 106 x 24 = 2,544 tiles with 56 machines; the compact four-row ring design (51 x 21 = 1,071 tiles, 55 machines) passes the same full native protocol with the same inputs, entrance order and products.

- Evidence: `native-report.json` here is the full-protocol report for this exact string (SHA-256 `c1c984d3…c950`, `passed: true`): steady 10 / 10.23 / 1.17 / 4.43 / 4.37 per minute (construction, logistic, roboport, storage, passive provider), recovery 10 / 10.5 / 1.2 / 4.4 / 4.4, exact closed caps 20/20/2/10/10, all five selective phases.
- Layout: a two-row rail of 53 AM2s and 3 chemical plants along a long ring with splitter lane balancers, 51 long-handed arms and 14 substations.
- Reproduce: run `node scripts/robot-logistics-workshop/generate.mjs` from commit `c386ea90f` (the generator was rewritten for the compact design).
