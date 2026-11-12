# Integrated six-pack science factory

Selected SHA: `fc03b90653e0edab692a0395a08e8d267c34e76d54924936737c9c712877b4a2`.
169 × 352 = 59,488 bounding tiles; 9,462 placed entities; 325 crafting machines.
Targets nominal60/min each of red, green, military, blue, purple and yellow. Normal AM2, fast inserters, red transport, no modules or robots. Material inputs left; science chests right. External power required. Preserve circuit wires and stock limits.

Compared with previous published664: 2,366 fewer bounding tiles (3.83%) and2,692 fewer entities (22.15%). Red surface/underground construction iron rises from144,052 to149,536 (+5,484); this is not total factory construction cost. The underground pass alone starts from header baseline7e0 and removes2,561 entities; it must not be confused with the overall664 comparison.

[Selected blueprint](six-pack-integrated-60.txt) and [original qualification](native-report.json) match exactly. Original15-minute warmup +30-minute measurement +5-minute collection pause +2-minute settle +3-minute recovery passed with every crafting machine productive. Separate60-minute full-storage evidence is in ../evidence/fully-integrated-storage-60/. All10chests remained full and science crafting stopped during final2pause minutes; fresh recovery of every pack exceeded60/min and independent statistics agreed. Collection can include backlog; the measured test is not a claim of indefinite above-target production.

[Lower-entity alternative](history/underground-pure-0ba2b4d5/six-pack-integrated-60.txt):169×366,9,405entities, with matching original and60-minute storage reports in that folder. The default uses57more entities to save2,366tiles. Both are tested tradeoffs, not global optima. The previous664 baseline and older designs remain in history.

## Reproduction

Run `node scripts/flight-science-sided/full/generate.mjs` from the project root with the pinned2.1.24 prototype cache. Blue component inputs are pinned to components/blue-manifest.json and its frozen supplier strings; later supplier releases cannot change the composition. The header generator must reproduce7e0 exactly; apply-underground.mjs then verifies the native topology snapshot, optimizer9f49 SHA, declared-only rewrite and finalfc03 SHA. Selection/protection/pairing provenance is under underground-provenance/. Native pairing checks cover all1,874 endpoints, including retained pairs, and read-all components remain protected.

`node scripts/flight-science-sided/full/preview.mjs` renders exact saved entities and dashed new underground links. Source/runtime caches and decoded blueprintJSON are not publication artifacts. The flight profile is separate from the public vanilla catalogue.
