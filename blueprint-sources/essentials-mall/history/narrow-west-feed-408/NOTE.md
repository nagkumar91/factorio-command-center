# narrow-west-feed-408

The review fix applied to the earlier published layout (`narrow-west-outer`, commit 7f363c43e): 24 × 17 = 408 tiles, 19 machines, with the fast-inserter feed decider at (15..16, 5).

`native-report.json` here is its own full-protocol report and says `passed: true` for this exact string. Steady / recovery per minute were identical to `narrow-west-outer`: AM2 3.10/2.80, fast belt 18.05/18.30, fast underground 2.35/2.40, fast splitter 2.55/2.40, fast inserter 16.15/16.50, bulk inserter 1.35/1.40, furnace 2.45/2.50, drill 3.70/3.80. In the standard fast-inserter hold the fast-inserter machine made 2 crafts in the last 5 minutes against 7 bulk-inserter crafts.

A 40-minute fast-inserter hold (exploration, `../long-hold/narrow-west-feed-fast-inserter-hold-40min.json`) kept bulk inserters at 1.375 per minute with the chest at exactly 50 at all 2400 samples; fast-inserter and bulk-inserter crafts in the last 20 minutes were 28 and 28.

It was replaced by the smaller `one-column-west` (23 × 17 = 391), which passed the full protocol itself.

`narrow-west-outer` itself is not kept here: with its fast-inserter machine stopped while the fast-inserter chest was full, the mall made 19 more bulk inserters and then none (review, 20- and 40-minute holds).
