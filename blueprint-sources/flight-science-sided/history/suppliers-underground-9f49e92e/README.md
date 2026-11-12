# Qualified supplier underground revisions

The green-circuit supplier replaces one eight-tile surface run with a seven-tile
underground pair. Its entity count falls from 31 to 25, while red-belt construction
iron rises from 195.5 to 201 plates. The red-circuit supplier replaces one
seven-tile surface run with a six-tile pair: 262 to 257 entities and 1,868.5 to
1,885.5 construction iron plates. Both bounding rectangles remain unchanged.
The engine supplier has no safe eligible rewrite and retains its original proof
in [the preceding snapshot](../suppliers-before-underground/).

Both revisions passed the original supplier protocol: 15-minute warmup,
30-minute measurement, five-minute collection pause, two-minute settle and
three-minute recovery. Green circuits measured 60/min in both windows; red
circuits measured 89.8333/min and recovered at 92/min. Every crafting machine
produced. `native-report.json` and `qualification-control.lua` preserve the exact
qualification evidence. This is not an additional full-storage stress claim.

The separate native pairing report checks all six retained/new underground
endpoints against their expected mates and preserves the original read-all
belt components. Ports, circuit readers, controlled entities and wired IDs
remain protected. `manifest.json` records the exact blueprint hashes, pair
plans, before/after construction metrics and native evidence.

`optimizer.mjs` is the frozen, reviewed implementation with SHA-256
`9f49e92e6d0dc8b2cb1c39653b182b9510bc137207caed0a7efd38949f9b8313`.
The supplier generator verifies its bytes, reproduces the qualified baseline,
checks the native snapshot's baseline SHA, applies the rewrite, and verifies
the selected encoded blueprint against both matching native reports. The
original supplier controller SHA is
`9d06cd23ef0dcfde0fcdc11ed0b7884894acaa7ecbd1c37b9f264dea119d92b4`.

Root `native-report.json` explicitly merges these two build records with the
unchanged engine record from the original report, retaining source-report
hashes and dates. It does not represent a single combined native run.
