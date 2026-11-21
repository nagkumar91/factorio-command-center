# seven-square-medium-pole (7 x 7 = 49 tiles, waiting for a user decision)

Proposed in the review of `926ac81b7`; generated here with `--variant seven-square`. No pipe row: light oil enters at (0,3) on the arm row and feeds the chemical plant (facing south) directly, passes under the south hand-off arm by a pipe-to-ground pair (1,3) to (3,3), then feeds the north rocket-fuel machine at (5,3) and the south one at (3,5). The north machine's arm (6,3) drops on a three-belt stub (6,4) west, (5,4) south, (5,5) south that side-loads the exit row; the south machine's arm (3,6) drops on the exit row. Same exit gate as the published layout.

```
CCC.FFF     C chemical plant (faces south)   F north rocket-fuel machine (faces south)
CCCiFFF     i arms                           R south rocket-fuel machine (faces east)
CCCpFFF     p panel                          = pipe   U pipe-to-ground   m medium pole
=UiU==i
RRRm=v<
RRR==v.
RRRi>>E
```

Full protocol passed at light oil 660/min (`native-report.json` here, SHA-256 `af139f3a2e08fd6cb32bddc9e2b41d56f19bc217e5f60e8b3ecc6e1a85ae9395`): steady 6.0, recovery 6.0, 90 + 90 rocket-fuel and 1,800 solid-fuel crafts in 30 minutes, exit 8 = 4 + 4 when blocked, every machine stopped.

Not published: no 2 x 2 hole is left, so it is powered by one medium electric pole and has no substation. The contract ("substation first; medium pole only as a fill-in") and the user's rule ("substations for power") do not allow that as written. It saves 7 tiles (56 to 49, 12.5%). If the user grants the exception, make `seven-square` the default variant in `scripts/rocket-fuel-supplier/generate.mjs`, re-run generate, validate, generate, and update the README (exit row from top becomes 6) and tests.
