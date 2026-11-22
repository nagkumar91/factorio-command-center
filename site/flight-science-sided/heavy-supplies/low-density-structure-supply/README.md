# Low-density structure supply · 60/min

Supply factory for the low-density structure entrance (60/min) on the south end of the compact six-pack tier (`../../compact/`). It targets the installed Factorio 2.1.24 flight-save recipes, like the rest of `flight-science-sided`.

| | |
|---|---|
| Inputs (west, top to bottom) | steel plates 120/min · plastic bars 300/min · copper plates 1,200/min (one belt, both lanes) |
| Output (east) | one steel chest (2 slots), filled by two filtered fast inserters |
| Footprint | 34 × 13 (442 tiles), 224 entities |
| Machines | 20 assembling machine 2, recipe low-density structure, no modules |
| Other entities | 62 fast inserters, 114 red belts, 1 red splitter, 1 pair of red underground belts, 1 big + 19 medium electric poles, 4 display panels |
| Circuit control | none (no loop, no wires besides power) |

Recipe arithmetic (from the flight-save prototype dump): 15 s for 2 steel + 20 copper + 5 plastic → 1 structure; an assembling machine 2 (speed 0.75) makes 3/min, so 60/min needs exactly 20 machines and 1,200 copper, 120 steel and 300 plastic per minute. A red belt lane carries 900/min, so copper uses both lanes of its inlet belt.

## Layout

```
.>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>v    top belt: copper (south lane), structures (north lane)
PP^ii.iipiipii.iipiipii.iipiipii.v
PPuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAv    ten assemblers
...AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAv
Dp.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAv
>>vi..ip.i..i.pip.i..i.pip.i..ip.f    steel inlet
..>>>>>>>>>>>>>>>>>>>>>>>>>>>>>.DC    middle belt: steel (north lane), plastic (south lane); collection chest
>>^i..i..i..i..i..i..i..i..i..i..f    plastic inlet
D.UAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA^
.S^AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA^    ten assemblers
>SvAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA^    copper inlet into the splitter
D.viipiipii.iipii.iipii.iipiipii.^
.>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>^    bottom belt: copper (north lane), structures (south lane)
```

`A` assembler, `i` fast inserter, `f` filtered fast inserter, `S` splitter, `U`/`u` underground entrance/exit, `C` chest, `D` display panel, `P`/`p` big/medium pole.

Each assembler has three fast inserters: copper in and structure out on its outer belt, steel and plastic in from the middle belt. The copper splitter sends half of the copper up a tunnel under the steel/plastic junction to the top belt and half to the bottom belt; each half side-loads onto the lane next to its row, so each row's copper (600/min) fits one lane and the far lane carries only finished structures. Both outer belts end at the east column, where a filtered inserter on each puts structures into the one chest; the copper lane simply stops at the belt end. Steel and plastic side-load onto opposite lanes of the middle belt, as in the red-circuit supply.

## Native qualification

`native-report.json` (exact SHA-256 `f3a75a55…`, family prototype dump `33912441…`, run with a private copy of the family's flight-21 mod profile whose `--dump-data` reproduces that dump byte for byte) uses the family's supply protocol: 15 min warm-up, 30 min measured, output blocked 5 min, 2 min settling, 3 min recovery measured. Unlike the family harness (which feeds on demand), every inlet is fed a metered amount, exactly its panel figure, onto both lanes of its inlet belt; at most one second of feed may wait for room and anything more is refused and counted (none was).

| Feed | Steady /min | Recovery /min | Inlets drawn /min (steel, plastic, copper) | Assemblers crafting |
|---|---:|---:|---|---:|
| 100% | 60.00 | 60.00 | 120, 300, 1,200 | 20 of 20 (recovery 20) |
| 80% | 48.00 | 48.00 | 96, 240, 960 | 17 of 20 (the last ones starve; no jam) |

Only structures reached the chest, and a once-a-second lane audit of the three belts beside the assemblers found nothing but the declared item on each lane. The belts hold about five minutes of output, so in the five-minute block the assemblers mostly kept working and only reached "output full" near its end.

## Arrangements screened

| Arrangement | Size | Tiles | Steady / recovery at 100% | At 80% | Notes |
|---|---:|---:|---|---|---|
| **Twin rows** (selected) | 34 × 13 | 442 | 60.00 / 60.00 | 48.00 / 48.00 | copper tunnel runs under the steel/plastic junction column |
| Twin rows, wide | 35 × 13 | 455 | 60.00 / 60.00 | 48.00 / 48.00 | same, with a separate copper column |
| Stacked rows (four rows of five) | 27 × 26 | 702 | 60.00 / 60.00 | 48.00 / 48.00 | a splitter per material; two outlet chests (departs from the single chest) |

All three were full-protocol native runs of their exact strings (generator `--variant twin-rows-wide|stacked-rows --out <dir>`); only the selected string is kept here.

## Reproduce

- `node scripts/flight-science-sided/heavy-supplies/low-density-structure-supply/generate.mjs`
- `node scripts/flight-science-sided/heavy-supplies/low-density-structure-supply/validate.mjs` (writes `native-report.json`; `SHORT=1` screens without writing it)
- `node --test tests/heavy-supply-low-density-structure.test.mjs`

Generator and validator need the family's flight-save profile (`.cache/flight-21` with `mods/` and `script-output/data-raw-dump.json`, or `FLIGHT_PROFILE`); the tests that need it skip without it. The validator runs the game headless with a private `--config` and `--mod-directory` under `.cache/heavy-supplies/`.
