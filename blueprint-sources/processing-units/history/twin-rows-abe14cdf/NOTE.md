# twin-rows (31 x 29 = 899 tiles, passed, replaced on 2026-11-22)

Replaced for size, and for its exit, by `shared-channel` (31 x 28 = 868 tiles). This version has SHA-256 `abe14cdfcda0bf7a336bdc53ea1c535f444c809ddf38fa04f0834fff4023b512` and variant `twin-rows`. It passed the full protocol at the panel figures with 26.57 per minute steady and 26.50 in recovery, and has no known defect.

What changed: its channel between the two processing-unit rows has five rows: a processing-unit belt for each row, with the supply belt between them. The replacement has four: one processing-unit belt carrying both rows' output (one per lane), then the supply belt. Here every processing unit reaches the exit on its south lane, so the exit holds 4 when blocked; the replacement's exit carries both lanes and holds 8. The entrances are on the same tiles. The exit is on the same tile, (30,16).

The three files here are the published files of that version, byte for byte. `node scripts/processing-units/generate.mjs --variant twin-rows --out <dir>` regenerates the same string.
