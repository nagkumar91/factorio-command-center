# Compact local flying robot frames

`makeFrames(raw)` is a synchronous named export from
`scripts/rgby-science/frames.mjs`. It returns:

```js
{ entities, wires, ports, loopControl, machineCounts, footprint }
```

Coordinates are local, with tile centres at half-integers. Entity numbers are local;
remap entities, wire endpoints, `ports[].entity`, and the `reader`, `controlled`, and
`loop` IDs in `loopControl` during composition. Every entity carries
`tags.flight_science_entity === entity_number`; update that tag after renumbering.
The function does not mutate the supplied raw data or write files.

## Ports

Each port is `{kind, items, label, entity, x, y, externalSide?, direction?, perMinute?}`.
`entity` names the actual saved belt, pipe, chest, or pole, and `(x,y)` is its centre.
Belt direction uses Factorio 2.x directions (4 = east). Fluid ports accept their
named fluid directly through ordinary external pipes. `perMinute` is the recipe
requirement at the **10 frames/min target**, not a limiter or a measured input rate.

| Kind | Material | Centre | External side | Required/min |
| --- | --- | --- | --- | ---: |
| input | iron-plate | (-2.5, 0.5) | west | 60 |
| input | copper-plate | (-2.5, 1.5) | west | 20 |
| input | steel-plate | (-2.5, 2.5) | west | 20 |
| input | electronic-circuit | (-2.5, 3.5) | west | 50 |
| fluid | sulfuric-acid | (2.5, -5.5) | north | 400 |
| fluid | lubricant | (18.5, 9.5) | south | 150 |
| output | flying-robot-frame | (32.5, 3.5) | east | 10 |

A `kind: 'power'` port identifies the saved grid connection; read its coordinates
and entity number from the returned data. All ordinary poles and copper wires
(connector 5) may be stripped for the parent's power network. Preserve red wires
(connector 1), the loop reader and all controlled inserters. The included poles
allow exact native testing without adding hidden internal power fixtures.

## Layout and recipe boundary

36 × 16 tiles (576 tiles²), versus 77 × 17 (1,309 tiles²): 56.0% less area.
Two production rows surround one circulating red-belt loop with the previously
tested split-and-side-load lane balancer. Stock caps leave capacity for continued
circulation and prevent intermediate output from filling the entire belt.

15 production machines: five AM2 frame assemblers, three AM2 electric engines,
three AM2 engines, one AM2 pipe, one AM2 gear, and two battery chemical plants.
Green circuits are supplied centrally by the parent. No modules, barrel recipes,
or logistic delivery are used. Fast inserters have stack override 1. Chemical
plants face north for rear acid clearance; electric engine AM2s face south for
rear lubricant clearance. The east steel chest has no collection cap.

## Evidence

`frames-10.txt`, `frames-10.json`, and `manifest.json` describe the same exact
blueprint. `static-report.json` records deterministic API, geometry, identity,
material-port access, and wire checks. `native-report.json` binds measured native
results to the exact blueprint SHA-256 and supplied raw-data SHA-256. See that
report for the measured rate, per-machine crafts, fluid consumers, and input routes.
The native fixture writes only to declared exterior input belts and fluid pipes,
collects from the declared output chest, and powers the saved ordinary pole grid.
No machine inventory is seeded. Recipes are enabled without research bonuses.
All simulation saves, configuration, mod snapshots and logs remain private under
`.cache/rgby-frames`; no player save or installed configuration is changed.

The strengthened qualification uses 15 minutes warmup and 30 measured minutes,
three 10-minute output windows, native frame production statistics, every machine
crafting, productive routes for every solid inlet, matching acid/lubricant segments,
and all electric consumers on the saved grid. Its acceptance floor is 10/min in
each window. Boundary supply is unlimited; upstream production is outside scope.

## Provenance

New local layout for the 30/min RGBY science composition. Circulating stock controls
and lane-balancer geometry follow the project's `scripts/flight-robots/generate.mjs`;
fluid orientations were checked against the supplied Factorio 2.1.24 raw dump and
`scripts/flight-science-sided/full/components/frames` blueprint sources. Power and
bounds use `compact-shared-layout.mjs`; only a local shallow prototype view aliases
`logistic-container` into `container` for its steel-chest geometry lookup.

Reproduce from the project root (set `FACTORIO_PROFILE` to a private copy of the
same 2.1.24 profile when necessary):

```sh
node blueprint-sources/rgby-science/components/frames/evidence/prepare.mjs
node blueprint-sources/rgby-science/components/frames/evidence/check.mjs
node blueprint-sources/rgby-science/components/frames/evidence/native.mjs
```

The generator reads the exact supplied raw path; edit its local raw-path setting
for another machine. Evidence scripts are snapshots of the isolated test tools.

From the project root, the retained evidence scripts can reproduce the artifacts
and test using the supplied raw dump/profile:

```sh
node blueprint-sources/rgby-science/components/frames/evidence/prepare.mjs
node blueprint-sources/rgby-science/components/frames/evidence/check.mjs
node blueprint-sources/rgby-science/components/frames/evidence/native.mjs
```

Set `FACTORIO_APP` to another matching installation and `FACTORIO_PROFILE` to a
private profile containing `mods/` and `script-output/data-raw-dump.json` when
needed. `prepare.mjs` and `check.mjs` retain the task's exact raw dump path.
From the isolated repository root:

```sh
node blueprint-sources/rgby-science/components/frames/evidence/prepare.mjs
node blueprint-sources/rgby-science/components/frames/evidence/check.mjs
node blueprint-sources/rgby-science/components/frames/evidence/native.mjs
```

The harness source is retained as `evidence/control.lua`. Production statistics
use `get_input_count` (items entering the production economy); consumption uses
`get_output_count`. Saves and native logs are deliberately excluded here.
