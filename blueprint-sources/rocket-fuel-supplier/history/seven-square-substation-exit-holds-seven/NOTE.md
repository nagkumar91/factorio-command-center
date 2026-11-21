# seven-square-substation-exit-holds-seven (7 x 7 = 49 tiles, substation, rejected: the exit holds 7)

First 7 x 7 with a substation found in the design review of 11-21; generated with `--variant seven-square-substation`. Rejected because its exit tile holds 7 rocket fuel when blocked (4 + 3), not 8. Superseded the same day by the published `seven-square-buried` layout, which keeps these machines and pipes and brings the east machine's fuel to the exit from behind through an underground belt, so the exit holds 8.

```
CCCSS..     C chemical plant (faces south)        B east rocket-fuel machine (rows 2..4, faces west)
CCCSS..     S substation                          A south rocket-fuel machine (x 1..3, faces west)
CCCiBBB     i arms   = pipe   U pipe-to-ground    v > belts   E exit   p panel   # light-oil entrance
#UiUBBB
=AAABBB
=AAAivi
pAAA.>E
```

The south machine's arm (4,5) drops on a south-running column (5,5) that turns east at (5,6): north lane, 4 on the exit tile. The east machine's arm (6,5) drops straight onto the exit tile (6,6). An arm dropping on a blocked belt tile fills three of that lane's four places (the tile's back place can only be filled from behind), so the exit holds 4 + 3 = 7. The gate here is `rocket-fuel < 7`.

Full protocol passed at light oil 660/min with the cap declared as 7 (`native-report.json` here, SHA-256 `3911d2834f81f4f1aa64ed25bc4c1f4977c4c9f8a042bce5b5015c6913992f63`): steady 6.0, recovery 6.0, 90 + 90 rocket-fuel and 1,800 solid-fuel crafts in 30 minutes, exit 7 = 4 + 3 when blocked and never more, the rocket-fuel machines stopped on ingredient shortage after 68 s and 87 s with empty output slots (the east machine's output arm keeps one rocket fuel in its hand). Kept as the native evidence for the direct-drop mechanic: do not drop an arm on an exit tile that must hold 8.
