# five-products-full-stack (qualified, superseded by the requester chest string)

The 22 November string with five products (construction robots, logistic robots, roboports, storage chests, passive provider chests) and one full stack of each in the output chest (50 / 50 / 10 / 50 / 50). 51 x 21 = 1,071 tiles, 55 machines, SHA-256 `ee80fa8d...38de`.

- Evidence: `native-report.json` is the full-protocol report for this exact string (`passed: true`): steady 10.23 / 10.7 / 1.2 / 4.43 / 4.47, recovery 10.4 / 10.4 / 1.2 / 4.5 / 4.5, closed chest exactly 50 / 50 / 10 / 50 / 50, all five selective phases. It ran on Factorio 2.1.24 with the prototype dump named in `manifest.json`; the current harness, validator and prototype dump are the 2.1.25 ones, so those hashes inside this report do not match the scripts as they are now.
- Why superseded: the user asked for the requester chest as a sixth product (built 26 November 2026). The current string adds it and keeps every entrance, the entrance order and the output chest tile; it is one column wider (52 x 21 = 1,092 tiles, one more machine). Both versions stay selectable (`versions` in the family manifest).
- Reproduce: the five-product string was written by the generator as it stood before the requester chest change (git history of `scripts/robot-logistics-workshop/generate.mjs`, no option rebuilds it).
