# Frozen red-belt purple finishing block

`makePurple(raw)` is exported from `scripts/five-science/purple.mjs`.
It returns entities, wires, ports, footprint, machineCounts and loopControl;
parent integration supplies power. `purple.txt` is the independently powered
snapshot made by the existing RGBY snapshot helper.

- Footprint: 30 × 20 tiles, before and after snapshot power placement.
- 14 assembling-machine-2: 5 science, 4 productivity modules, 2 electric
  furnaces, 2 rails, 1 iron sticks. No installed modules.
- Red transport belts, red underground belts and red splitter only.
  Bulk inserters use only the shared native harness's unlock-equivalent
  capacity baseline. Four ordinary long-handed inserters feed rail steel;
  no later inserter capacity bonuses are used.
- Seven west belt ports supply six commodities. Steel has two direct rear
  feeds: 150/min for rails and 100/min for furnaces at 30 science/min.
  Other nominal rates: iron plates 75, stone 150, stone bricks 100,
  electronic circuits 50 and advanced circuits 100/min. Scale supplies above
  these target rates when running above 30/min.
- East passive-provider science chest. All intermediates are made internally.
- Rails use a dedicated rear output belt routed north on x=21.5 and west
  above the science assemblers. Five north inserters feed rails directly.
  This belt buffers and backs up naturally; rails do not circulate and have
  no stock gate. Its northbound tunnels are separate from the southbound
  loop-balancer tunnel on x=25.5.
- Iron plates are admitted from inside the ring: the iron port's belt turns
  north at x=1.5, tunnels under the bottom loop belt and ends below an
  admission arm that drops on the top belt's north lane. Stone, bricks and
  both circuits keep the west column's other lane to themselves.
- The west rail assembler has a third pickup arm (stone and iron sticks) on
  the bottom loop belt, on the tile its removed loop output arm left free.
- Two stone admissions share one west port. Steel does not circulate.
  The mixed loop has 536 item slots and stock limits summing to 290:
  stone 64, bricks 64, advanced circuits 40, green circuits 24, iron plates
  40, sticks 40, furnaces 6, modules 6, science 6.

## Exact native evidence

The final `native-report.json` passed on installed Factorio **2.1.24 + Space
Age**, using the exact installed raw dump requested for this task. This is
not a claim of native qualification on the public catalogue's 2.0.77.

After 30 minutes of warmup, the 30-minute measurement delivered
**32.23 production science/min**. The shared five-minute blocked,
five-minute settling, five-minute recovery test delivered **33.0/min** in its
recovery measurement window. Both rates strictly exceed 30/min, independently
of the shared validator's 0.5/min tolerance. The harness filled only the final
science chest for the blocked test. No machine or intermediate inventory was
seeded. All 14 machines crafted during measurement; all seven input ports
accepted items and had productive routes. Power, exact recipes and exterior
approaches passed. The blueprint SHA-256 is:

```
8da75f7d4b4f88bd59961ef0b8dfb1071cbee3c520c341c2f6b2f3a53bc8db20
```

`provenance.json` binds the report, raw prototypes, generator and reusable
helpers. The blueprint hash covers the trimmed encoded blueprint string,
matching the shared validator. Private runs, saves, configs, mods and logs
remain under ignored `.cache/five-science/purple/` only. Earlier cached runs
are superseded; only the source-folder final report qualifies this layout.

The block was revised on 2026-11-21 (iron admitted inside the ring, third
west rail pickup arm). The first frozen version (SHA-256 06605236..., 31.2 and
30.2/min) and its report are kept in `history/iron-on-outer-lane-06605236/`.
In the same 30 + 30 minute run the old block's west rail assembler was short
of an ingredient for 984 of 4,501 samples and the stick assembler for 527;
the revised block's are 231 and 76.

## Reproduce

From the repository root, set `FACTORIO_RAW` to the requested installed
`data-raw-dump.json`, then run:

```sh
RGBY_WARMUP=30 RGBY_MEASURE=30 node blueprint-sources/five-science/components/purple/reproduce.mjs
```

The script uses the existing snapshot and native validator. Its in-memory
validator adaptation changes only the private run directory and resolves the
blueprint helper import. It rejects express/turbo entities, installed modules,
and any steady or recovery rate below a strict 30/min. Add `--generate-only`
to regenerate the powered snapshot and manifest without running Factorio.

Verification of the revised block (2026-11-21): `reproduce.mjs --generate-only`
regenerates exactly the SHA-256 above; `npm test` 428 tests, 0 failed, with and
without the prototype dump (after re-indexing the site); the family test
`tests/five-science-compact.test.mjs` checks this report against the snapshot.
The first version's verification notes are in its history folder.
