# Independent two-loop robot candidate

Owned sidecar only. Adapted from `scripts/flight-science/compact.mjs`; no parent generator, public catalogue, or parent native harness is modified.

- Circuit loop: four direct-insertion cable/green/cable groups, three belt-output cable assemblers, ten red-circuit assemblers.
- Mechanical loop: three internal battery plants, gears/pipes, six engines, six electric engines, ten frames, and final products.
- Circuit iron enters the opposite belt lane from copper/plastic.
- Single exterior inlet each for iron, copper, steel, plastic; raw iron/copper feeders continue internally into the second loop. One acid and one lubricant pipe.
- AM2, fast inserters, red belts, no modules. One shared chest capped at 200 construction robots, 200 logistic robots, 20 roboports.
- Continuous output with stock controls; a fast splitter distributes frames to the two robot assemblers through rear inserters. Front robot arms accept circuits only. Roboport red input preserves a 64-circuit reserve.
- Current footprint: 79×34, 2,686 tiles, versus parent 107×18, 1,926 tiles. Production evidence determines suitability; size alone favors the parent.

Run from the project root:

```sh
node scripts/flight-robots-alternative/generate.mjs
node scripts/flight-robots-alternative/validate.mjs
SCREEN=1 node scripts/flight-robots-alternative/native.mjs
RECOVERY=1 node scripts/flight-robots-alternative/native.mjs
```

`ROBOT_OUTPUT` chooses generator output. `ROBOT_SOURCE` chooses validator/runner input. Defaults are `.cache/flight-robots-alternative/candidate`. Native runs always write `.cache/flight-robots-alternative/native/<timestamp>/`.

The private runner/control are copies of the robot harness with imports, source defaults, control path, and run destination adapted to this sidecar. Test surface remains 128×128. Native evidence uses the same locally installed Factorio 2.1.24 profile as the parent; it does not establish catalogue-version 2.0.77 performance. Reports bind the encoded blueprint SHA-256; each run also saves the exact blueprint and manifest in its payload.

Use the exact native `report.json` result, including recovery where present, before calling a candidate passing. Earlier encoded versions are retained under `.cache/flight-robots-alternative/history/`.

## Verified result

Final encoded SHA-256: `2889f5e13e45822bacfeda1fbd4ce3379c7572673cfce07f5e91d9721762a2e8`.

Full native report: `.cache/flight-robots-alternative/native/1794461998914/report.json`.

After 15 minutes warmup, 30 minutes measurement produced 11.2 construction robots, 11.2 logistic robots, and 1.0667 roboports per minute. All machines productive, all four single exterior input routes verified, all fluid consumers connected, and shared chest caps verified during 45 minutes blocked output. See the exact report and `.cache/flight-robots-alternative/RESULT.json` for post-blockage recovery rates.

The 79×34 sidecar occupies 2,686 tiles, 760 more than the 107×18 parent (39.5% larger). Keep this as the verified fallback; choose the smaller parent only after its exact blueprint hash passes sustained production and recovery. No parent/public files were changed and no Git operations were performed.

Final limiting fixes: opposite-lane circuit iron; direct cable insertion with iron-only green belt arms; plastic stock 128; dedicated red-only roboport input with reserve 64; independent steel/gear roboport input; mechanical frame splitter with rear robot inputs; stock-controlled continuous final output without production clocks.
