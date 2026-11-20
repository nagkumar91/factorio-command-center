# rear-belt (qualified, superseded)

The first qualified design: 35 x 18 = 630 tiles, 28 machines. Plastic (south lane, side-loaded behind a straight tile) and copper cable (north lane, from the cable machine's bulk arm) ride a dead-end rear belt behind the six advanced-circuit machines; the two battery plants face north under an acid header on the top row; gear and pipe machines sit in the bottom row.

- Evidence: `native-report.json` here is the full-protocol report for this exact string (`passed: true`): steady 5.27 / 5.4 / 0.57 / 2.2 / 2.2, recovery 5.2 / 5.4 / 0.5 / 2.2 / 2.2, exact blocked caps, all five selective phases, ring peak 319 of 592.
- Why superseded: the rear belt costs two full rows. Putting plastic and cable on the ring (`ring-fed-acid-row`, 595) and then feeding acid from the west column (560, `collector-east-column`; now 528 with a corner collector) passed the same protocol.
- Reproduce: `RE_OUT=<dir> RE_OPTIONS='{"cornerChest":false,"oldPowerWording":true,"rear":true,"acid":"row","gearArms":1}' node scripts/robot-essentials/generate.mjs`
