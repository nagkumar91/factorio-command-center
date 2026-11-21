# bands-seven-panels (superseded, qualified)

The design published before the fix round: 3 crushers with fixed recipes (oxide, metallic, carbonic), 1 electric furnace, 4 science machines and 4 collectors, with 20 fast inserters, 4 decider combinators, 7 solar panels and 7 accumulators. It uses 280 foundation tiles in a 19 x 18 rectangle and requests exactly 5,000 kg, which is five cargo rockets after the starter pack.

It passed the full protocol on seed 12345: 59.99 packs per minute collected and 60.00 made, 0 low-power ticks, lowest accumulator 4.89 of 5 MJ. The rocket check gave six launches of exactly 1,000 kg. The reviewer reproduced it on seven seeds.

`single-crusher-six-panels` replaced it. That design uses one crusher whose recipe is set by the circuit clock, requests 4,000 kg (one rocket fewer) and uses 247 tiles. This report came from the harness before the fix round, which did not yet read back the combinator values, the set-recipe flag or the charge reader. Its hashes therefore do not match the current `control.lua` and `validate.mjs`.
