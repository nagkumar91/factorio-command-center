# Robot logistics workshop · 10/10/1/4/4/4 per minute

Open index.html locally with the parent site's styles.css, flight-plans.css, flight-plans.js and assets retained. No network or game install is required. layout.svg is fully self-contained. Download the .txt import, or Copy import selects the full string for Ctrl+C / Command+C under file://.

Regenerate both guides: node scripts/workshop-guides.mjs
API: buildWorkshopGuides({root?, rawPath?}). Missing manifests are skipped. Optional FACTORIO_RAW refreshes blueprint-sources/workshop-preview-model.json against the exact manifest prototype SHA. Normal builds use only the tracked snapshot and repository icons.

Current status: exact native production and recovery proof matched.

Manual offline check: disconnect network; open index.html with file:// on desktop and narrow mobile widths. Check layout, numbered materials/fluid legend, Fit/Tile detail, manual copy selection, full import download and standalone SVG. Inspect rates and caps, unlocks, and native evidence links.
