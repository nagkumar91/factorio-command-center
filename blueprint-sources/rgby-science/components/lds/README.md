# Compact LDS component

`makeLDS(raw)` from `scripts/rgby-science/lds.mjs` returns
`{entities, wires, ports, loopControl, machineCounts, footprint}` in local coordinates.
The caller translates entities and ports and remaps entity IDs, wires, tags and
loop-control references when composing the parent factory.

Ten normal assembling-machine-2s in two rows of five provide exactly 30 LDS/min
at full utilization, without modules or researched inserter bonuses. The complete
powered footprint is 28 × 16 tiles: `[-2,26) × [-6,10)`.

| Boundary | Position | Rate/min |
| --- | --- | ---: |
| West copper plates | (-1.5, -5.5) | 600 |
| West steel plates | (-1.5, 0.5) | 60 |
| West plastic bars | (-1.5, 1.5) | 150 |
| East LDS passive provider | (25.5, 3.5) | 30 |
| North external power pole | (-1, -4) | external electricity |

Copper uses a dedicated red splitter and two rear feeds, with undergrounds
crossing the stock-loop rows. Each assembler has its own rear fast inserter.
The short stock loop carries only steel, plastic and LDS. Two independent fast
inserters admit plastic from the single west entrance. Circuit limits are 32
steel, 64 plastic and 12 LDS; all controlled arms use the connected loop reader.
The output provider has `bar: 1` (one usable slot).

`lds-30.json` and `lds-30.txt` encode the same local module. `manifest.json`
records exact blueprint and prototype SHA-256 identities, ports and loop metadata.
`static-report.json` records focused geometry and material-balance checks.
Native evidence, when present, is in `native-report.json` and binds the exact
blueprint hash; it applies to the supplied Factorio 2.1.24 prototype profile.

From the task checkout, focused reproduction uses:

```sh
node .cache/rgby-lds/prepare.mjs
node .cache/rgby-lds/check.mjs
RECOVERY=1 node .cache/rgby-lds/native.mjs
```

The native runner creates its own profile under `.cache/rgby-lds/native/`, starts
with empty machines, caps material delivery at the declared rates, and supplies
power only at the declared pole. It measures physical collection and native
production, tests every saved input route, and checks saved power/circuit wiring.
The long run uses 15 minutes warmup, 30 minutes measurement, 45 minutes blocked
output, 15 minutes settling and 30 minutes recovery measurement. The inactive
output chest must stop at its one-slot capacity before collection resumes.

Final native result: 900 LDS in the 30-minute steady measurement, with three
consecutive ten-minute windows of 300 each; native production independently
counted 900 crafts. Consumption was exactly 600 copper, 60 steel and 150 plastic
per minute. After a 45-minute blockage, the provider held exactly 50 LDS (one
slot); following 15 minutes settling, recovery collected 899 LDS in 30 minutes
(29.9667/min). Recovery passes the explicitly recorded 0.05/min tolerance;
this is not an assertion of exact 30/min recovery collection. The earlier
2-minute-settling trial collected 298 in ten minutes and is retained in the
private cache, not selected as passing evidence.
