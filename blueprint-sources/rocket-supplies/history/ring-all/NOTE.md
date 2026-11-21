# ring-all (26 x 8 = 208 tiles): qualified, superseded by a smaller layout

The smallest single-row layout: no gaps at all; cable (limit 16) and advanced circuits (limit 8) ride the ring. One row of seven machines inside a ring six rows tall, with rocket fuel and the acid header on the two rows above it.

Full protocol passed for this string (`native-report.json`): steady 5.00 / 5.03 / 5.00 (processing units, low density structures, rocket fuel), recovery 5.00 each; chests exactly 400; ring peak 142 of 432.

Why it was replaced: the two rows above the ring (rocket fuel, acid) are almost empty in a 26-wide layout. `two-rows-tight` puts four machines on the outside of the ring top, directly under the acid header, and three inside: 14 x 12 = 168 tiles.

Rebuild: `RS_OPTIONS='{"variant":"ring-all"}'`.
