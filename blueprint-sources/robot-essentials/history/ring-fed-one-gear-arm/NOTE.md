# ring-fed-one-gear-arm (rejected screen)

First try of the ring-fed layout (35 x 17 = 595): plastic enters through a fifth gated ring entrance, the cable machine drops cable on the ring with a bulk arm, the rear belt rows are gone. Ring limits were lowered to fit the extra items under 60% (iron 40 -> 36, circuits 64 -> 56, plastic 28, cable 52).

- Screen: 10 min warm-up, 10 min measured (`explore-report.json`, `short: true`).
- Failed: logistic robots 4.6/min (floor 4.75).
- Diagnostics: the same chain as `fast-gear-arm`. With 36 iron on the ring the gear machine's single bulk arm was short of iron 53% of the time; engines, then the westmost electric-engine machine (short of engines 32%), then the last frame machine (short of electric engines 17%) followed. Frames 10.8/min; the construction robot machine is upstream and takes its share first.
- Next: one change, a second bulk iron arm in the gear machine's free front tile (`gearArms: 2`). That passed (`ring-fed-acid-row`).
- Reproduce: `RE_OPTIONS='{"supplyGate":false,"cornerChest":false,"oldPowerWording":true,"acid":"row","gearArms":1,"limits":{"electronic-circuit":56,"plastic-bar":28}}'`
