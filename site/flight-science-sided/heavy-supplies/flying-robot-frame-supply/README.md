# Flying-robot-frame supply · 20/min

A supply factory for the Compact six-pack tier's flying-robot-frame entrance (south group, 20/min). Factorio 2.1.24 flight-save recipes (prototype dump SHA-256 `33912441…d19f`, the same dump as the family's other three supplies).

It makes its own engines (with one gear and one pipe assembler), electric engines and batteries. Electronic circuits are a supplied input: feed them from a green-circuit supply.

| | |
|---|---|
| Footprint | 31 × 15 (465 tiles) |
| Machines | 21 assembling machine 2 (9 flying robot frame, 5 electric engine, 5 engine, 1 gear, 1 pipe) and 3 chemical plants (battery) |
| Inlets, west side, top to bottom | iron plates 120/min (belt), lubricant 300/min (pipe), copper plates 40/min (belt), steel plates 40/min (belt), sulfuric acid 800/min (pipe), electronic circuits 100/min (belt) |
| Outlet, east side | flying robot frames into a steel chest limited to two slots |
| Power | the big electric pole at the north-west corner |

Every inlet and the outlet has a display panel with its figure. Normal AM2s and chemical plants, fast inserters, red belts, pipes and underground pipes; no modules, no robots, no inserter-capacity research.

## Recipe arithmetic

From the prototype dump (`layout.mjs` → `arithmetic`): AM2 speed 0.75, chemical plant 1.

| Recipe | Crafts/min | Machine | Exact | Built |
|---|---:|---|---:|---:|
| Flying robot frame (20 s) | 20 | AM2 | 8.89 | 9 |
| Electric engine (10 s, 15 lubricant) | 20 | AM2 (crafting with fluid) | 4.44 | 5 |
| Engine (10 s) | 20 | AM2 (advanced crafting) | 4.44 | 5 |
| Battery (4 s, 20 sulfuric acid) | 40 | chemical plant (chemistry) | 2.67 | 3 |
| Gear (0.5 s) | 20 | AM2 | 0.22 | 1 |
| Pipe (0.5 s) | 40 | AM2 | 0.44 | 1 |

Inlets: iron 40 (gears) + 40 (pipes) + 40 (batteries) = 120; copper 40; steel 20 (engines) + 20 (frames) = 40; circuits 40 (electric engines) + 60 (frames) = 100; lubricant 300; sulfuric acid 800.

## Layout

One circulating ring belt with an entire-belt reader and stock limits on every arm that puts items onto it (the family's loop control, as in the engine supply). Three rows of eight machines: frames north of the ring; electric engines and battery plants inside it; pipe, gear, five engines and one frame south of it. Lubricant runs along the inner row's north arm row and enters under the ring by underground pipe; sulfuric acid enters the same way on the inner row's south arm row and hops under the electric-engine arms to the battery plants. No pipe rows outside the machines.

## Native evidence

`native-report.json`: the exact SHA-256 above, headless 2.1.24 with a private copy of the family's flight-21 mod profile. Family supply protocol: 15 minutes warm-up, 30 minutes measured, 5 minutes collection blocked, 2 minutes settling, 3 minutes recovery. Feed is metered: every inlet gets exactly its panel figure per minute (fluids at the inlet pipe), and a second copy gets 80% of it.

| Feed | Steady | Recovery | Draw per minute | Notes |
|---|---:|---:|---|---|
| 100% | 20.03 | 20.67 | iron 120, copper 40, steel 40, circuits 100.1, lubricant 300, acid 800 | all 24 machines craft; ring peak 215 of 496 |
| 80% | 15.97 | 15.00 | iron 96, copper 32, steel 32, circuits 80.1, lubricant 240, acid 640 | no jam; one frame assembler idle (7.1 needed) |

Only flying robot frames reached the outlet in both runs.

## Candidates screened

| Variant | Size | 100% steady / recovery | Result |
|---|---|---|---|
| inner-fluids (published) | 31 × 15 | 20.03 / 20.67 | passed |
| narrow-west: one lifting arm per belt inlet, two-column west strip | 30 × 15 | 19.33 / 19.67 | failed: one fast arm lifts about 116 iron/min, so pipe and engines starve and every inlet queue grows |
| outer-fluids: electric engines and battery plants in the outer rows with a pipe row outside each | 31 × 17 | 19.50 / 19.00 | failed: inlet queues grow (one frame assembler short of ingredients 30% of the time) |

## Reproduce

- `node scripts/flight-science-sided/heavy-supplies/flying-robot-frame-supply/generate.mjs` (needs `.cache/flight-21/script-output/data-raw-dump.json` with the pinned SHA-256; `--variant`, `--out` for candidates)
- `node scripts/flight-science-sided/heavy-supplies/flying-robot-frame-supply/validate.mjs --write`
- `node --test tests/heavy-supply-flying-robot-frame.test.mjs`
