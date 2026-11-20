# ring-fed-acid-row (exploration pass, superseded)

35 x 17 = 595 tiles. Ring-fed plastic and cable, two bulk iron arms on the gear machine, acid header row above the north-facing battery plants.

- Exploration run at the full protocol lengths (`ESSENTIALS_EXPLORE=1`, 15/30/8/5/10 plus five selective phases; `explore-report.json`, `short: true`) passed every check: steady 5.27 / 5.4 / 0.57 / 2.2 / 2.2, recovery 5.2 / 5.4 / 0.5 / 2.2 / 2.2, ring peak 357 of 592. Not a published qualification.
- Superseded by the 560-tile design, which removes the acid row by feeding two west-facing battery plants from the ring's west column.
- Reproduce: `RE_OPTIONS='{"cornerChest":false,"oldPowerWording":true,"acid":"row","limits":{"electronic-circuit":56,"plastic-bar":28}}'`
