# unpaced (14 x 12 = 168 tiles, SHA `b10cbc28...`): qualified at the panels, replaced because the low-density line starved when circuits arrived above their panel

Replaced on 2026-11-21 by the same layout with two decider combinators that pace the processing-unit machines. This string passed the full protocol at the panel figures (`native-report.json`: 5.00 / 5.00 / 5.00 steady and recovery), but with circuits above their panel the processing-unit line took the plastic and copper of the low-density machines: low density structures fell to 3.1 per minute in recovery with circuits alone at 220, and to 3.0 per minute steady with circuits 220 and acid 50 (plastic at its panel; copper at 150 did not help). 11 of the 22 above-panel feeds failed a floor (`above-panels-wider.json`, full protocol lengths; `above-panels.json` is the earlier set of eight feeds).

Rebuild: `RS_OPTIONS='{"pacing":null}'`.
