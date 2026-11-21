# inner-row (30 x 8 = 240 tiles): qualified, superseded by a smaller layout

The layout the spec describes: one ring around one row of seven machines, processing unit, advanced circuit, cable, advanced circuit, processing unit, then the two low-density machines, with direct hand-off arms in the four gaps (cable and advanced circuits never touch a belt). Each processing-unit machine faces its acid input into the gap next to it; the acid header runs on row 1 with a jog to row 0 and a pipe-to-ground under the ring top. Rocket fuel is buried along row 0.

Full protocol passed for this string (`native-report.json`, same harness as the published design): steady 5.03 processing units, 5.00 low density structures, 5.00 rocket fuel per minute; recovery 4.90 / 5.00 / 5.00; chests exactly 400 each at the end of the blocked phase; ring peak 115 of 496.

Why it was replaced: the four gaps cost four columns and the acid jogs need two rows above the ring. `ring-all` (26 x 8) and then `two-rows-tight` (14 x 12) pass the same protocol in less area. Keep this one if you prefer the hand-offs: it is the only qualified layout where cable and advanced circuits stay off the ring.

Rebuild: `RS_OUT=<folder> RS_OPTIONS='{"variant":"inner-row"}' node scripts/rocket-supplies/generate.mjs` gives this exact string.
