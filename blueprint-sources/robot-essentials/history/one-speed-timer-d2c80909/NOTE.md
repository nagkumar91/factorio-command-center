# one-speed-timer (qualified, reviewed twice, superseded)

The 528-tile design published on 20 November: 33 x 16, 28 machines, a free-running token timer (periods 685 / 666 / 6,260 / 1,636 / 1,636 ticks, 5 to 15% above target at any supply) and the roboport east of the engine machines. Replaced because it starved when fed its own entrance panel figures: at exactly the panels it made 1.2 logistic robots per minute, and it needed about 1.10 to 1.15 times the panels to pass.

- Evidence: `native-report.json` here is the full-protocol report for this exact string (SHA-256 `d2c80909...0763`, `passed: true`, saturated entrances): steady 5.27 / 5.4 / 0.57 / 2.2 / 2.2, recovery 5.2 / 5.4 / 0.5 / 2.2 / 2.2, exact blocked caps, all five selective phases, ring peak 357 of 592.
- Why superseded: same footprint, machines and entrances, one more decider. The successor paces its tokens for the panel figures and boosts by one eighth only while the ring shows surplus, puts the roboport last on the route, and passes the same protocol both saturated (5.53 / 5.5 / 0.6 / 2.2 / 2.2) and fed at exactly the panels (4.9 / 4.9 / 0.5 / 2.0 / 2.0).
- Reproduce: `RE_OUT=<dir> RE_OPTIONS='{"supplyGate":false}' node scripts/robot-essentials/generate.mjs`
