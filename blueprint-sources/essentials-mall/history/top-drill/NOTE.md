# top-drill

18 machines: three gear machines on the rear belt and one advanced-circuit machine. The drill sits in the top row and fast inserters in the bottom row. An eight-window gear clock (7.5 s each) gives every gear-hungry final its own window, ordered so that each window follows one further downstream on the gear path. Fast belts and fast undergrounds get two windows each.

The full protocol was run in exploration mode (`explore-report.json`, `short: true`). Every steady, recovery and hold rate passed, and every fill and refill passed. It failed one check: in the fast-inserter hold, the fast-inserter machine made 10 crafts in the last 5 minutes while the bulk-inserter machine made 9.

What the diagnostics showed:

- Fast inserters are pulled by the bulk-inserter machine through the ring, so each bulk craft triggers one fast-inserter craft a few seconds later. In a 5-minute window the two counts can differ by one, depending on where the window edges fall. Moving the bulk machine's fast-inserter pickup into its gear window made it pass once but fail on another run (9 vs 8).
- With one advanced-circuit machine, the furnaces held at 1.2/min and bulk inserters at 1.1 to 1.4/min. Both were within about 20% of their floors.

Next (`corner-gear`, published): a fourth gear position at the ring's south-east corner frees a slot for a second advanced-circuit machine. The fast-inserter feed arm stops while the fast-inserter chest is full, and a decider keeps 14 fast inserters on the ring for the bulk-inserter machine, so the fast-inserter machine makes no crafts at all during its hold.
