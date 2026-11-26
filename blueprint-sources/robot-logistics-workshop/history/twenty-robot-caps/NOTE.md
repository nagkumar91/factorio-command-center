# twenty-robot-caps (qualified, superseded by the full-stack caps)

The string with the output chest stopping each product at 20 construction robots, 20 logistic robots, 2 roboports, 10 storage chests and 10 passive provider chests. Same footprint (51 x 21 = 1,071 tiles), 55 machines, entrances, ring limits, reserves and production tokens as the current string; the only difference is the five filter decider constants next to the output chest (and the blueprint description that names them).

- Evidence: `native-report.json` is the full-protocol report for this exact string (SHA-256 `77998031...15fc`, `passed: true`): steady 10.23 / 10.7 / 1.2 / 4.43 / 4.47, recovery 10 / 10.7 / 1.2 / 4.5 / 4.4, exact blocked caps 20 / 20 / 2 / 10 / 10, all five selective phases. It was run with a 5 minute closed hold and 5 minute selective settles and the harness as it was then; the current `control.lua` and `validate.mjs` take the phase lengths from the manifest and record when each cap was reached, so the harness and validator hashes inside this report do not match the scripts as they are now.
- Why superseded: twenty robots in the chest is too little to take a few at a time. The current string stops each product at one full stack (50 / 50 / 10 / 50 / 50). Both versions stay selectable (`versions` in the family manifest).
- Reproduce: the string is kept as a file; the current generator builds the six-product string only. The generator as of the commit before the requester chest change (`git log -- scripts/robot-logistics-workshop/generate.mjs`) rebuilds it with `RLW_OPTIONS` (caps overrides).

- Later: the full-stack five-product string was itself superseded by the requester chest string; see `../five-products-full-stack/NOTE.md`.
