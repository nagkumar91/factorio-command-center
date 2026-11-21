# single-crusher (rejected: low power on two of seven seeds)

This is the reviewer's "one fewer rocket" idea with 7 solar panels and 2 accumulators. It has one crusher whose recipe is set by the circuit clock, on the south side next to the furnace, and the west side keeps only its collector. It uses 248 tiles in a 19 x 16 rectangle and requests exactly 4,000 kg, which is four cargo rockets.

Full protocol with the rocket check, current harness, seven seeds:

- **Seeds 12345, 4242, 31337, 20261121 and 555** passed every check: 60.00 packs per minute made, 0 low-power ticks, five launches.
- **Seed 1** failed only `noLowPower`, with 36 machine-ticks. They came at the restart after the blocked phase (minute 286) and again at minute 302. This report is that run.
- **Seed 987654** failed only `noLowPower`, with 18 machine-ticks in minutes 5 and 6 after the build.

The accumulators stayed charged (lowest 4.65 of 5 MJ), so these were short demand spikes above 1,260 kW of panels plus 600 kW of accumulator output. Swapping one panel for two accumulators at the same weight raises the spike limit to 2,280 kW, which is `single-crusher-six-panels` (published).
