# side-loaded-exit (the spec reference, 21 x 13 = 273 tiles)

Variant `reference` of `scripts/green-circuits/generate.mjs`: the spec's section 5 layout exactly, with the long output runs buried.

What failed: only the blocked-stock check. The exit tile (19,6) is fed only by two side-loads, and a side-loaded end tile holds 3 circuits per lane, so with collection stopped it settled at 6 circuits, not the declared cap of 8.

What the diagnostics showed: everything else passed the full protocol (15 / 30 / 5 / 5 / 10 minutes). Steady 360.0/min and recovery 360.0/min; every one of the 10 machines made exactly 2,700 crafts in the 30-minute window; every machine stopped while blocked; bulk hands never above 2.

What changed next: the exit became a straight tile fed from behind by the side-load merge tile (`reference-straight-exit`, 22 x 13), and the compact layout put that merge under the last cable machine so it costs no extra column (`compact`, 19 x 13).
