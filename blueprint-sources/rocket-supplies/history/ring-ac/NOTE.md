# ring-ac (28 x 8 = 224 tiles): qualified, superseded by a smaller layout

The inner-row layout with the two advanced-circuit to processing-unit gaps removed: advanced circuits ride the ring (limit 8) to the two processing-unit machines, which sit side by side and take acid from the north through a pipe-to-ground under the ring top. Cable still goes from its machine to both advanced-circuit machines by hand-off arms.

Full protocol passed for this string (`native-report.json`): steady and recovery 5.00 of each product per minute; chests exactly 400; ring peak 123 of 464.

Why it was replaced: `ring-all` removes the two cable gaps as well (26 x 8), and `two-rows-tight` is smaller again (14 x 12).

Rebuild: `RS_OPTIONS='{"variant":"ring-ac"}'`.
