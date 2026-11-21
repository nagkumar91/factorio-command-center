# single-aisle-even-lanes (20 x 9 = 180 tiles, passed, not published)

Variant `single-aisle-even-lanes` of `scripts/green-circuits/generate.mjs`: the published single aisle, one column wider, with both lanes of the exit equal.

```
  0 C C C . E E E . C C C . E E E . C C C .
  1 C C C b E E E f C C C f E E E b C C C .
  2 C C C . E E E . C C C . E E E . C C C .
  3 > v f D f f . S S f . . f f > U f u v .
  4 . > > > U > v S S u > > U > ^ u ^ . > >  ->  exit at (19,4)
  5 > ^ f D f f > > U f u U f f . . f u ^ .
  6 C C C . E E E . C C C . E E E . C C C .
  7 C C C b E E E f C C C f E E E b C C C .
  8 C C C . E E E . C C C . E E E . C C C .
```

The west pair's circuits stay on row 5 and the east pair's go to row 3. Each dives under the last copper arm and turns onto the merge tile (18,4) from its own side, so each pair has its own lane. A merge tile that is side-loaded from both sides holds only 6 when blocked, so the exit needs one more straight tile east of it: column 19.

Result: passed the full protocol (15 / 30 / 5 / 5 / 10 minutes) on the current harness. Steady 360.0/min, recovery 360.0/min, 5,400 circuits on each lane in the 30-minute window (180 per minute per lane), all 10 machines made 2,700 crafts and were working at every one-second sample, the exit held exactly 8 while blocked, every machine stopped, bulk hands never above 2. The report in this folder is that run.

Why it is not published: it is 9 tiles larger than `single-aisle` (180 against 171), and its exit is on tile (19,4), not on (18,5) where the previous version had it. Choose it instead if even exit lanes matter more than those 9 tiles: `node scripts/green-circuits/generate.mjs --variant single-aisle-even-lanes` writes this string. It is still 5.3% smaller than the 190-tile version.
