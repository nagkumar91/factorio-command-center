# Preserved qualified compact baseline · 17fc28fa

This archive preserves the preceding exact blueprint, manifest, original qualification and 30-minute full-storage proof. It is historical evidence; current files are two levels above. `qualification-control.lua` and `qualification-runner.mjs` retain the original canonical bytes; `storage-control.lua` and `storage-runner-source.txt` retain the original private stress harness. The generator source is preserved for inspection; run the current generator to reproduce the reviewed successor.

- [Original blueprint](compact-six-pack-sided-60.txt)
- [Original qualification](native-report.json)
- [Original full-storage proof](storage-30-report.json)
- [Native belt snapshot](native-belt-snapshot.json)

# Compact six science packs

Original local design for the flight-save recipe set in Factorio **2.1.24**. This is separate from the public catalogue's vanilla 2.0.77 baseline.

The exact import string is [compact-six-pack-sided-60.txt](compact-six-pack-sided-60.txt). Its SHA-256 is `17fc28fa24029214b1aed34c100fbb8baabc4eb0821bd864d9ceb294bfc97d49`. The decoded blueprint, [manifest](manifest.json), and [native production report](native-report.json) accompany it.

**100 × 54 tiles (5,400 tiles²), 81 normal assembling machine 2s.** Fast inserters, red belts, external electricity, no installed modules, no bots, no quality bonuses. All material entrances are on the left at x = −6.5; all six collection chests are on the right at x = 91.5. Their approaches are open, checked both statically and inside Factorio. Preserve the circuit wires, filters and stock limits.

| Science | Sustained packs/min | Recovery packs/min |
| --- | ---: | ---: |
| Red | 62.13 | 64.00 |
| Green | 61.90 | 69.33 |
| Black | 62.83 | 68.00 |
| Blue | 63.77 | 62.00 |
| Purple | 64.43 | 63.00 |
| Yellow | 64.30 | 64.00 |

The native run starts empty, warms up for 15 simulated minutes, then collects all six science types simultaneously for 30 minutes. Recovery pauses collection for five minutes, allows two minutes settling, and measures three minutes. Every machine produces during the sustained window, every declared input has a native productive route, and all machines and inserters share the declared power network. The report binds the exact blueprint, manifest, prototype dump, runner, Lua harness and configuration hashes.

Only the lanes of the declared exterior input belts receive fixture ingredients. No internal machine or belt receives test-only injection. Exterior belts are supplied on demand, rather than capped to recipe arithmetic. The rates below describe the recipe demand for exactly 60/min of each science; startup and the higher measured output need extra supply. Measured consumption and feed acceptance are separate fields in the report.

| External material | Items/min at 60/min per science |
| --- | ---: |
| Iron plates | 810 (660 upper entrance, 150 lower entrance) |
| Copper plates | 90 |
| Steel plates | 315 (15 upper entrance, 300 rail entrance) |
| Sulfur | 30 |
| Coal | 300 |
| Stone walls | 60 |
| Stone | 300 |
| Electronic circuits | 60 |
| Advanced circuits | 90 |
| Engine units | 60 |
| Processing units | 40 |
| Low-density structures | 60 |
| Flying robot frames | 20 |
| Electric furnaces | 20 |
| Productivity module 1s | 20 |

The last five materials and finished circuits/engines come from upstream factories; their production footprint is excluded. Productivity modules are purple-science ingredients, not machine upgrades. Rails, sticks, gears, ammunition, grenades, belts and inserters are made inside this blueprint. No fluids cross this tier's boundary.

The upper four-pack block derives from the project's original sided generator. A dedicated coal belt feeds the grenade end, and a second iron pickup supplies the inserter assembler. The lower purple/yellow block has a separate rail output belt. A third short loop makes rails, with stone on its outer lane and steel/sticks on the inner lane to avoid overloading one lane. Sulfur stock 40 covers the long four-pack circulation route and prevents the observed recovery shortage. No global optimality claim is made.

The first six-pack steady candidate is preserved in [history/v1-steady](history/v1-steady/README.md). Its exact blueprint passed sustained output but failed blue recovery at 58.67/min. Its native recovery diagnostics show missing sulfur in the downstream blue assemblers. The final version retains the same footprint and 81 machines, correcting sulfur coverage. The hybrid tier separately retains its own exact tested snapshot; do not substitute this string into another tier without native retesting.

Reproduce from the project root:

```sh
node scripts/flight-science-sided/compact/generate.mjs
RECOVERY=1 node tests/flight-science-sided-compact-native.mjs
node --test tests/flight-science-sided-compact.test.mjs
node scripts/flight-science-sided/compact/preview.mjs
node tests/flight-science-sided-compact-browser.mjs
```

The native runner uses a private configuration, copied mod directory and test save under the generator's ignored `.native/` folder. It does not change the live game. Generation alone is not native proof. The assignment did not authorize Git mutations or publishing; those remain with the parent task.
