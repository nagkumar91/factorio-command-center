# single-crusher-five-panels (rejected: rate)

This is the published design with one more panel traded for two accumulators: 5 panels (900 kW) and 6 accumulators. It weighs the same 4,000 kg and uses 246 tiles. The sixth accumulator sits at (9, 8), so the rectangle grows to 19 x 17. At (-7, -2) its two foundation tiles were never built by the hub in an exploration run, and the build timed out.

Full protocol on seed 12345: 56.08 packs per minute collected and 56.00 made, against a floor of 57. It failed `steadyCollected`, `steadyMade` and `recoveryRates`. It had 0 low-power ticks, but the lowest accumulator fell to 0.72 of 5 MJ.

At full rate the platform draws about 970 kW, more than five panels supply. The charge gate does its job: it holds the crusher back while the accumulators are below 30%, so nothing browns out, but production falls below the target. Six panels is the floor.
