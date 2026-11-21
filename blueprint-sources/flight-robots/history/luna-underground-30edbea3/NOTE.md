# Earlier version: 106 × 18, slightly faster

This folder holds the earlier published robot workshop, kept complete so it can still be downloaded:

- `robots-10-roboport-1.txt`: its import string, blueprint SHA-256 `30edbea366140a650cf0aedaaef9ef6e35f8d52c9d72161b3c935173b2374386`.
- `selected-manifest.json`: its manifest, byte-identical to the family `manifest.json` it was published with.
- `native-report.json`: its passing full native report (build `robots-underground-candidate`), byte-identical to the one it was published with.

It is 106 × 18 (1,908 tiles) with 46 assembling machines 2 and 3 chemical plants. Measured over 30 minutes after 15 minutes of warm-up: 10.133 construction robots, 10.133 logistic robots and 1.067 roboports per minute (304 / 304 / 32 crafts). After 45 minutes of blocked output, 2 minutes settling and 3 minutes measured: 11.333 / 15 / 1 per minute.

## Why two versions are offered

On 2026-11-21 the user chose to publish a smaller version with one assembling machine fewer, accepting that it measures up to three crafts lower in a window, and asked to keep access to both. The current version (pair-swapped, 96 × 18, 48 machines, 9.4% fewer tiles) measured 10.1 / 10.133 / 1.0 per minute (303 / 304 / 30 crafts) and recovered at 13.667 / 17.333 / 1. Both meet every target (10 + 10 robots and 1 roboport per minute) in the full native protocol for their exact strings.

Choose this earlier version if you have the room and want its extra crafts; otherwise use the current one. The manifest's `versions` list holds both versions' exact figures.
