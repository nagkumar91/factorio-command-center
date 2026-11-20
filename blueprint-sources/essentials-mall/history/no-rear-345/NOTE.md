# no-rear-345

The review's second size idea: drop the rear iron band. 23 × 15 = 345 tiles, 18 machines (one advanced-circuit machine; the south-east corner slot stays empty). Variant `no-rear-drill-inside` in `scripts/essentials-mall/variants.mjs`.

Layout: iron enters on a gated belt at row 1 that side-loads onto the ring's outer lane (the other small inputs side-load upstream of it, at rows 2 to 5); circuits enter on the inner lane through one bulk arm at the north-west corner. The three gear machines take the first three top-row slots, each with one bulk iron arm. The drill takes the first inside slot, where iron arrives first.

`native-report.json` here is its own full-protocol report and says `passed: false` for this exact string. It failed one check: AM2 1.90 per minute (floor 2) during the electric-furnace hold. Steady / recovery per minute: AM2 2.15/2.10, fast belt 8.65/10.00, fast underground 2.10/2.00, fast splitter 2.35/2.00, fast inserter 11.15/11.60, bulk inserter 2.00/2.10, furnace 1.10/1.10, drill 3.50/3.40.

Why it stops here: one gated side-load delivers about 530 iron per minute; the published layout takes 722. AM2 is short because AM1 is short of iron at the end of the bottom belt. Two fixes screened with the full protocol each moved the shortfall elsewhere:

- `no-rear-am1-inside` (AM1 to the inside row): AM2 4.90, but fast inserters 5.90 in recovery (floor 6) and fast undergrounds 1.40 during the furnace hold.
- `no-rear-am1-bulk` (bulk iron arm for AM1): fast undergrounds 1.00 steady (floor 1.5), fast belts 7.00 during the AM2 hold, and one fast-underground craft in the last 5 minutes of its own hold.

Earlier screens (steady only): `no-rear` (iron at row 2 blocked plastic from merging, the fast-belt surplus arm took about 65% of the gears) and `no-rear-late-iron` with three limit/arm tweaks (drill 1.3 to 1.5 per minute against 3). Two more steady screens of this drill-inside layout (7.5-second gear windows; or a single fast-belt gear arm) gave AM2 1.95 per minute steady and were not taken further.
