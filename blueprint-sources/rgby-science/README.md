# Four-pack science from plates

Target: 30 automation, logistic, chemical and utility science packs per minute.
All circuits, engines, batteries, flying robot frames, processing units and low-density structures are manufactured inside. Normal AM2s and chemical plants; no modules. Red transport, fast inserters and selected bulk admissions (bulk-inserter unlock only; no later capacity upgrades).

Supply west: iron plates, copper plates (both labeled entrances), steel plates, plastic, sulfur, sulfuric acid, lubricant and electricity. Recipe demand is calculated from the installed prototype snapshot in `requirements.mjs`. Four finished pack buffers are passive providers at the east edge. Preserve stock-control wires and buffer limits.

Variants ending `labs-15` and `labs-30` connect all four outputs physically to research labs through two mixed-lane belts. They consume science instead of exporting it. Supported lab count depends on technology time and effective lab speed: `floor(SPM × seconds / (60 × speed))`. The native research probes use 15 labs at 2× speed and 30 labs at 1× speed for 60-second units. No science is injected into these probes.

## Current release: compacted layout (21 November 2026)

The same factory in a smaller rectangle, with its red-circuit ring now fully read. Machines, recipes, entity tiers, entrances (six belts and two pipes on the west edge, same order) and exits (four chests on the east edge, same order) are those of the version it replaces; every stock limit is unchanged except the red-circuit product cap (16 to 24, see change 3).

| Import | Tiles now | Tiles before | Change | Entities now / before |
| --- | --- | --- | --- | --- |
| `rgby-science-30` | 124 × 61 = 7,564 | 132 × 70 = 9,240 | −18.1% | 2,324 / 2,347 |
| `rgby-science-30-labs-15` | 130 × 73 = 9,490 | 137 × 82 = 11,234 | −15.5% | 2,651 / 2,677 |
| `rgby-science-30-labs-30` | 130 × 76 = 9,880 | 137 × 85 = 11,645 | −15.2% | 2,710 / 2,733 |

Three changes produce it:

1. The nine workshops are raised ten rows (`LAYOUT.lift` in `factory.mjs`). The entrance headers and the six supply spines only occupy the west strip, so the workshops now start level with the headers instead of below them. The routed factory goes from 132 × 70 to 132 × 61.
2. `compact.mjs` then squeezes the routed layout along x and along y. It keeps every interaction exactly (belt hand-offs and side loads, splitter cells, inserter pickups and drops, underground pairs, pipe joints, pole coverage, wire reach, entrances and exits on their edges) and only shortens plain pass-through belt runs, underground spans and the empty space between parts that do not touch. It refuses a result whose list of interactions differs from the routed one (3,006 interactions on the factory alone). The factory goes from 132 × 61 to 124 × 61.
3. The red-circuit workshop's balancer tail (14 belts) was wired straight to its ring reader, 20 to 21 tiles away. A native build probe (import, build, revive, then compare every saved wire with the built ones) showed that a blueprint build drops exactly those 14 red wires, in the replaced strings as well: they built 573 of 587 wires (584 of 598 and 599 of 613 in the lab imports). The ring therefore never counted the items on its tail and its caps were not exact. `makeAdvanced` in `components.mjs` now chains each tail belt to its neighbour; all 585 wires build (596 and 611 in the lab imports). Counting the tail made the product cap bind earlier, so it moves from 16 to 24 red circuits, about what the tail used to hold unseen; with the exact count and the old cap of 16 the 30-lab import measured 29.58.

Measured by the full native protocol (10-minute warm-up, 10-minute measurement, 5 minutes blocked, 5 settling, 5 measured again), same harness and gates as before:

| | Red | Green | Blue | Yellow |
| --- | --- | --- | --- | --- |
| Factory alone, measured / min | 36.0 | 30.0 | 30.1 | 31.8 |
| Factory alone, after the blocked interval | 35.8 | 29.8 | 30.0 | 31.2 |
| Replaced version, measured / min | 36.1 | 30.0 | 29.6 | 32.2 |
| Replaced version, after the blocked interval | 36.0 | 29.6 | 30.0 | 32.2 |

Connected labs: 30.00 research units/min with 15 labs at 2× speed (replaced version 30.00) and 29.65 with 30 labs at 1× speed (replaced version 29.67).

Red and yellow above 30 are warm-up stock, not capacity: four red machines make at most 36.0/min, and yellow is held to 30.0/min by ten low-density-structure machines, so readings above that drain belts and buffers that filled while the slower chains started. The compacted factory has shorter belts and therefore slightly less of that stock (yellow after the blocked interval reads 31.2 instead of 32.2). The 30-lab figure in the 10-minute window depends on that warm-up too: it moved between 29.58 and 29.67 with small changes of routing or wiring. Over 30 minutes of warm-up and 30 measured, every version measures the same:

| 60-minute probe (30 warm-up + 30 measured) | Red | Green | Blue | Yellow | 30 labs, units/min |
| --- | --- | --- | --- | --- | --- |
| This release | 36.0 | 30.0 | 30.03 | 30.23 | 30.000, every lab 100% busy |
| Compacted layout before the wiring fix | 36.0 | 30.0 | 29.97 | 30.0 | 30.000 |
| Replaced version (factory alone) | 36.0 | 30.0 | 29.97 | 30.43 | not run |

### Supply

The workshop page lists the recipe demand at exactly 30/min of each pack (iron 1,025, copper 1,795, steel 110, plastic 320, sulfur 15, sulfuric acid 500, lubricant 150). The factory draws more: red runs at 36/min and the internal buffers fill for the first hour or more. Measured draw with every entrance kept full is iron about 1,115 to 1,130, copper 1,918, steel 112 to 116, plastic 330, sulfur 15, sulfuric acid about 560 and lubricant about 168 per minute over 60 minutes (192 in the 10-minute qualifying run while pipes fill), the same for the replaced version. A stated-supply probe (`RGBY_FEED_PER_MINUTE`, 30 minutes warm-up, 20 measured) fed the 30-lab import exactly the recipe figures: this release 26.27 research units/min, the replaced version 25.65. Plan supply for the measured draw; the page now lists both columns.

### Known limits (unchanged by this release)

- Blue science (8 machines), green science (4 machines) and low-density structures (10 machines) have exactly 30.0/min of machine time. The factory runs at about 30/min, not a guaranteed 30; the gate is 29.5/min.
- Red circuits are held near 90/min by the two cable machines of their workshop. Blue science needs 45/min of them and shares the splitter with processing units. While yellow runs on warm-up stock, processing units take their full half and blue has nothing spare: the blue ring showed 1 to 2 red circuits against a limit of 24 at the end of every measurement.
- With 30 labs the last labs of each row wait for yellow packs during the measured window (three labs worked 81%, 91% and 95% of it); that is where 29.65 comes from.

### Tried and not released

- A placement five rows shorter (workshops raised twelve rows, second circuit workshop one row higher: 125 × 56, −24%). Its factory failed the blocked-output recovery on blue (28.8/min) and its 30-lab variant measured 29.50.
- Serving blue science first at the red-circuit splitter (output priority). It fixes the blue recovery (30.4/min, 23 red circuits on the blue ring) but delays the first yellow packs; five 30-lab layouts with it measured 29.06 to 29.49 units/min, under the gate.
- Swapping the three east workshops between rows to shorten the widest row: the router found no path.
- The wiring fix alone, product cap left at 16: passed (factory 36.0 / 30.0 / 29.8 / 31.6, labs 30.00 and 29.58), 30-lab 60-minute probe 30.000; replaced by the same fix with cap 24, which measured closer to the replaced version.

## Reproduce

Use the Factorio 2.1.24 Space Age prototype dump via `FACTORIO_RAW` and the installed macOS Factorio binary for native tests. Test saves and mods stay under ignored `.cache/rgby-science/`.

```
node scripts/rgby-science/generate.mjs
node scripts/rgby-science/qualify.mjs
node scripts/rgby-science/build-page.mjs
npm test
npm run build
```

`generate.mjs` routes the factory once (`assemble.mjs`), then builds all three imports from that assembly (`factory.mjs`): compaction, then burial of long plain belt runs. A second run leaves this folder byte-identical, and a build keeps `native-qualified` only while `native-report.json` holds a pass for the exact SHA-256 generated. `connect-labs.mjs` is kept as an alias of `generate.mjs`. `qualify.mjs` runs the full protocol (`validate.mjs`, `control.lua`) as two games, the factory alone and the two lab imports, and writes the combined report.

`native-report.json` must match each exact import SHA-256. Separate component proofs do not qualify the assembled factory. The standard factory test supplies only exterior inputs and electricity, checks every productive machine and fluid consumer, collects finished packs, fills the final science chests for a blocked-output interval, then measures recovery. Lab variants perform research using only the factory's actual science production.

`RGBY_FEED_PER_MINUTE` turns a `validate.mjs` run into a stated-supply probe (entrances metered at given rates instead of kept full). It is a probe, never a qualification, and refuses to write into this folder.

Any change to the placement or the router reroutes the factory and needs all three imports qualified again; with three chains at exactly 30.0/min a new routing can land under the gate.

Green circuit geometry derives from the preserved, supervised Luna compact circuit trial at `../recovered-workshops/history/return-belt-pair-bf4d6a63/luna-circuits-r7-360.txt` (the 26 x 14 return-belt pair, since replaced in the library by a smaller version; this copy is unchanged). Other workshops and connectors are generated in `scripts/rgby-science/`. Component evidence is retained below `components/`; only completed exact-hash native improvements are promoted in the main catalogue.

## History

`history/routed-before-compaction-<first 8 of SHA-256>/` keeps the three strings this release replaced, each with a one-line note.

`history/routed-before-compaction-b8568d00/` also keeps that version's manifest entry (`manifest.json`, copied unchanged from the 16 November release). Five-science (`scripts/five-science/generate.mjs`) is built on that factory, not on this release: its three qualified strings reproduce byte for byte only from the pinned copy.

## Review notes

- 21 November 2026, independent verification: the README first said the replaced strings built 571 of 585 wires. That was the compacted string before the wiring fix; the replaced strings built 573 of 587 (584 of 598, 599 of 613). Corrected above.
- Five-science read this folder's `manifest.json` and current `rgby-science-30.txt` as its base, so after this release a five-science re-run would produce different, unqualified strings. The old manifest entry is now pinned in history. Pointing `scripts/five-science/generate.mjs`, the `baseline.file` of `blueprint-sources/five-science/manifest.json` and the frozen four-pack test in `tests/five-substations.test.mjs` at the pinned folder is outside this family's files and is left to the release stage. A trial copy with those three edits regenerated five-science's strings byte for byte (386ecb95, a71852bb, 4ff74162), and the four-pack test kept its 80 medium poles.
