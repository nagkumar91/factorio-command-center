# Factorio Command Center

This workspace contains the static website, original Factorio sources, community collection imports, and reproducible indexing and validation scripts.

- Serve only `site/` or the generated `dist/` directory. Keep caches, dependencies, game saves, credentials, and machine-local configuration out of Git and public hosting.
- Run `npm test` and `npm run build` for changes. Use the relevant browser suite for interface changes.
- Preserve blueprint source attribution. Coverage must mean an actual recipe product, not an entity used to construct a layout.
- Keep the distinction between recipe-reviewed imports and native production tests. Native reports must match the exact blueprint SHA-256.
- The public catalogue uses vanilla Factorio 2.0.77 with Space Age. Refresh with `node scripts/sync-game.mjs --vanilla`, then `npm run index:production` and `npm run index:atlas`.
- Read `deploy/README.md` before hosting changes. The Pi website has its own service on port 18090. Preserve existing OpenClaw services and Tailscale routes.
- This folder is backed up as ordinary files in the parent Clawd workspace monorepo. The public GitHub repository is a separate publishing checkout; do not add a nested Git repository here.
