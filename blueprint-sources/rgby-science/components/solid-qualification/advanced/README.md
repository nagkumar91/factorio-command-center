# Advanced ring — frozen all-AM2 source

`makeAdvanced(raw)` in `scripts/rgby-science/components.mjs` is ready for parent
factory regeneration. All 15 assemblers are AM2s: 13 advanced-circuit machines
and two cable machines. There are no modules. The balanced ring, dedicated
copper feed, ports, entity IDs, positions, wires and 25 × 17 footprint match the
geometry already used by the successful parent routing. Only the temporary
cable AM3 was reverted to AM2.

## Qualification and target provenance

The user clarified that the combined factory needs 65 advanced circuits/min;
90/min was desired headroom, and an all-AM2 standalone floor of 75/min is
acceptable. Accordingly, this standalone manifest and reproduction script now
use a 75/min target. The former AM3 evidence is explicitly superseded and is
retained only under `history-am3-superseded/`; it is not evidence for this module.
The parent aggregate manifest and generator were not edited.

The current all-AM2 blueprint SHA-256 is:

`b23bf3cb7e0fe409fc1abb02589277e0afbe54d771f84f9bd70fb2eb2c436f43`

The matching native report passes and physically collects **90/min steady and
90/min after blocked-output recovery**. The test uses ten minutes warmup and
ten minutes measurement, then five minutes blocked output, five minutes
settling and five minutes recovery measurement. Every saved machine completes
native crafts; input routes, saved recipes, power and exterior approaches pass.
`qualification-summary.json` independently checks actual rates against 75/min
without using the validator's rate tolerance. `static-report.json` proves all
AM2s and exact compatibility with the frozen routing geometry.

## Reproduce only advanced

Run from the project root:

```sh
node blueprint-sources/rgby-science/components/solid-qualification/advanced/qualify.mjs
```

This snapshots only advanced and uses `RGBY_SOURCE` pointing here and
`RGBY_IDS=advanced`. The script guards an empty research-probe prototype list
in memory if needed; it never edits the parent validator or control. Native
profiles remain in the runner's `.cache/rgby-science/` directories. The report
records source/effective validator hashes and the qualification-script hash.
`FACTORIO_RAW` may override the supplied 2.1.24 prototype dump.

The existing harness supplies only declared boundary belts and external power.
Its solid supply is unlimited; port planning rates of 180/min are not fixture
rate caps. The combined 65/min demand requires 130/min of each input before
buffer replenishment. Input ports remain copper `(-2.5,-5.5)`, green circuits
`(-2.5,1.5)`, and plastic `(-2.5,3.5)`; output remains `(17.5,10.5)`.
