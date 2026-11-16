# Advanced ring: standalone qualification

The final `makeAdvanced(raw)` implementation is in
`scripts/rgby-science/components.mjs`. Only that function was changed.

The original 85.7/min result was concentrated in the last top assembler:
3.5 circuits/min while most peers reached 7.5. Its inventory lacked cable.
The cable assemblers completed only 88.1 and 83.8 crafts/min against the
required combined 180. Larger buffers, extra pickup arms, a third mixed-loop
cable assembler, and relocation within the mixed ring did not meet 90/min.

The final layout keeps the balanced splitter/side-load perimeter and output
provider. Copper plates use a dedicated rear belt with an underground crossing
to the inner cable machine. Copper no longer circulates on the stock loop.
One cable AM2 becomes an AM3, and the spare bottom slot holds one additional
advanced-circuit AM2. There are 13 advanced-circuit AM2s, one cable AM2 and one
cable AM3, with no modules and only fast inserters and red belts.

The footprint is **25 × 17**, formerly 25 × 15; only the rear feed adds height.
Local bounds are `[-3,22) × [-6,11)`. Copper now enters at `(-2.5,-5.5)`,
green circuits at `(-2.5,1.5)`, and plastic at `(-2.5,3.5)`. The output remains
at `(17.5,10.5)`. The parent must regenerate its aggregate manifest and use
these new port coordinates; its generator, validator, control and aggregate
qualification manifest were not edited by this task.

## Exact blueprint proof

SHA-256 of trimmed `advanced.txt`:

`5759a3ce159efad53ab70faa436aaa683744a6b9d1b6264a38efbc272755e089`

`native-report.json` binds that exact hash and the supplied 2.1.24 prototype
hash. The final snapshot was tested twice with identical results:

- Ten-minute warmup, then 937 collected circuits in ten minutes: **93.7/min**.
- All thirteen advanced assemblers completed native crafts during measurement.
- Five minutes blocked output, five minutes settling, then 462 collected
  circuits in five minutes: **92.4/min**.
- Saved recipes, entity import geometry, power, external approaches and
  productive paths from every input passed the native harness.
- The independent `qualification-summary.json` requires actual steady and
  recovery rates at least 90/min, without relying on the runner's 0.5 tolerance.

The fixture supplies only declared exterior belts and external electricity;
solid supply is unlimited, as in the parent harness. Port `perMinute:180`
values describe the input budget for the 90/min target, not fixture rate caps.
At the observed above-target rate, native consumption was 189.1 copper,
187.8 green circuits and 187.8 plastic per minute. The parent factory's actual
65/min demand needs 130/min of each material, before buffer replenishment.

## Reproduce

Run from the project root:

```sh
node blueprint-sources/rgby-science/components/solid-qualification/advanced/qualify.mjs
```

This script snapshots only advanced and invokes the existing validator with
`RGBY_SOURCE` pointing here and `RGBY_IDS=advanced`. It guards the empty
research-probe prototype list in memory because Factorio rejects
`data:extend({})`; no parent source file is changed. The report records both
source and effective validator hashes and the qualification-script hash.
Private game profiles remain under the runner's `.cache/rgby-science/` paths.
`FACTORIO_RAW` can override the supplied prototype-dump path.
