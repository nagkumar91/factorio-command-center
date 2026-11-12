# Luna underground robot candidate

Public manifest ID and filename remain `robots-10-roboport-1` / `robots-10-roboport-1.txt`. Exact paired native report build ID: `robots-underground-candidate`; run: `1794494305670`. Match evidence to selected blueprint SHA-256 `30edbea366140a650cf0aedaaef9ef6e35f8d52c9d72161b3c935173b2374386` and prototype SHA-256 `33912441b13d155b13734523406bbc9aa81fc0f2992344b56106b3aa5c52d19f`.

This history directory preserves the selected candidate blueprint, exact unchanged paired-run report, native neighbor-pair proof, baseline read-all snapshot, structural audit, and reproduction generator. The original selected baseline is preserved separately under `history/luna-underground-baseline-1b76c532/`.

## Reproduce

Run `node scripts/flight-robots/underground-optimize.mjs` from the project root. It verifies the prototype and reviewed optimizer hashes and writes only to `.cache/luna-underground-robots/reproduced/`.
