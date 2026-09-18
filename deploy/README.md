# Hosting

GitHub Pages publishes `dist/` using `.github/workflows/pages.yml` after the unit and coverage checks pass. Enable Pages with **Source: GitHub Actions** in the repository settings. All application URLs are relative, so the site supports a repository subpath and opening `site/index.html` directly offline.

On the OpenClaw Pi, the site is a separate user service. It serves only the `site/` folder on port 18090 and does not change the OpenClaw gateway, credentials, or existing Tailscale routes.

Release structure:

```
~/clawd/workspaces/factorio-command-center/
  releases/<release>/site/
  releases/<release>/scripts/serve.mjs
  current -> releases/<release>
```

Copy a validated `site/` folder and `scripts/serve.mjs` into a new release. Point `current` at it, install `factorio-command-center.service` into `~/.config/systemd/user/`, then run:

```
systemctl --user daemon-reload
systemctl --user enable --now factorio-command-center.service
systemctl --user restart factorio-command-center.service
curl -I http://127.0.0.1:18090/
```

The Pi's LAN address with port 18090 reaches the website. Its Tailscale address works on the same port. To roll back, point `current` to the previous release and restart only this service. User lingering must be enabled to run the service after logout and reboot.

For local preview: `npm run serve`. Do not place secrets or private workspace files inside `site/`.

## Visitor analytics

The public website remains on GitHub Pages and the Pi. A separate Node.js 24+ service collects a small set of usage events and serves a private dashboard:

- Public collector: `https://openclaw-pi5.tailacf455.ts.net/factorio-metrics/collect` (POST only).
- Dashboard: `http://100.71.219.83:18091/`, accessible while connected to the Pi's Tailscale network. It is not hosted on GitHub Pages or exposed through Funnel.
- Collector listener: `127.0.0.1:18092`. An added `/factorio-metrics` handler on the existing port 443 Funnel proxies to this listener. Preserve the existing `/`, `/gmail-pubsub`, and other port handlers.
- Database: `~/.local/share/factorio-command-center/analytics.sqlite`, outside the website and release folders. The adjacent `.salt` file must stay with the database. Both are private runtime state and must never be committed or publicly served.

Include `analytics/` in each Pi release alongside `site/` and `scripts/serve.mjs`. Install `deploy/factorio-analytics.service` into `~/.config/systemd/user/` and run:

```sh
systemctl --user daemon-reload
systemctl --user enable --now factorio-analytics.service
systemctl --user restart factorio-analytics.service
curl http://127.0.0.1:18092/healthz
```

When initially adding the public collector, use a path-specific Tailscale handler, never `serve reset`. Inspect `tailscale serve status --json` before and after to confirm that existing OpenClaw routes and Funnel settings remain unchanged. The dashboard binds only to the configured Tailscale address, rejects unexpected Host headers, and has no public collector route for reading reports. Tailnet access controls determine who can reach it.

For a different host, update `site/analytics-config.js` and the server's `ANALYTICS_ORIGINS`, `ANALYTICS_ADMIN_HOST`, and `ANALYTICS_ADMIN_NAMES` settings together. Optional variables include `ANALYTICS_DB`, `ANALYTICS_COLLECTOR_PORT`, `ANALYTICS_ADMIN_PORT`, and `SITE_DIR`. The dashboard defaults to loopback for local development. Use `npm run serve:analytics`; local website analytics remain disabled unless explicitly configured for a test.

Reports include browser counts, sessions, views by page, action counts, blueprint opens/copies/construction crates, daily traffic, referring domains, broad screen-size categories, and recent actions. Choose 7, 30, or 90 days and export a JSON report. No historical data is inferred; counting starts after deployment. "Seen in last 5 min" means a browser sent an event recently, not a continuous presence check.

The client uses a random ID in localStorage that expires after 30 days and a sessionStorage ID that expires after 30 minutes of inactivity. The server hashes these IDs with its private salt. No cookies, account names, search text, crate contents, command strings, full URLs, or stored IP addresses are used. IP addresses are used transiently for request rate limits only. Event records expire after 90 days, with pruning on ingestion and dashboard reads. Visitors can opt out in the website footer; Do Not Track and Global Privacy Control also disable collection. Local files, localhost previews, and unknown hostnames do not send analytics. Visitor counts are approximate: separate browsers, site origins, and 30-day ID rotations can count a person more than once; blocking, opt-outs, offline use, or downtime can miss visits. Public events are not authenticated and should not be treated as an audit log.

The SQLite database persists across release changes. For a consistent backup, use SQLite's backup API or stop **only** `factorio-analytics.service` before copying its data directory. Website and OpenClaw services can stay running. Removing analytics requires disabling the client config, stopping its service, and removing only its path-specific Tailscale handler; retain unrelated routes.

Validation: `npm test`, `npm run test:analytics-browser`, the existing browser suites, and `npm run build`. Browser analytics tests use an in-memory database; they do not send traffic to the live collector.

## Hourly checks and Codex repair

The OpenClaw agent `factorio-site-repair` uses the Pi's signed-in Codex CLI. Its workspace is `~/clawd/workspaces/factorio-site-repair`, with a dedicated GitHub checkout in `source/`. The source's `ops/REPAIR_AGENT.md` and workspace `AGENTS.md` describe the owner's standing authorization to fix, test, and republish this site.

`factorio-healthcheck.timer` runs hourly on the Pi. Each run selects one random application route and makes one browser visit to it on GitHub Pages and the Pi’s Tailscale address. It checks HTTP status, JavaScript, assets, the expected heading, and rendered content. Asset requests are part of the visit. A privacy signal and analytics opt-out exclude this artificial traffic from visitor counts. Results persist in `healthchecks.jsonl` for 90 days, separately from analytics. Failures invoke Codex with a workspace-write sandbox, network access for tests, and unattended approvals; healthy checks consume no model calls.

The trusted `ops/watchdog.py` publisher validates the repair's changed paths, runs unit tests, build and browser suites, commits and pushes through a dedicated repository-only SSH deploy key, and creates a new Pi release. It restarts only the Factorio website and analytics services, verifies the new release, and restores the previous Pi release if verification fails. GitHub's push workflow republishes Pages. Dirty checkouts, failed tests, authentication failures, or unrelated edits stop publication with recorded evidence. The repair agent cannot change repository visibility or other Pi services. To pause automatic checks and repairs: `systemctl --user disable --now factorio-healthcheck.timer`.

Install the service and timer from `deploy/` after cloning the source, running `npm ci`, installing the agent instructions from `ops/agent/`, and confirming the repository deploy key works. Set `BROWSER_EXECUTABLE=/usr/bin/chromium` for the installed Pi browser. Run `npm run test:watchdog` and a readiness check before enabling the timer. The `GIT_SSH_COMMAND` in the service selects the dedicated key; never commit that private key. Inspect `systemctl --user status factorio-healthcheck.timer` and the private `watchdog.log` / `repair-last.json` for results.

The observability daily brief includes real visitor totals, top actions and blueprints, synthetic check outcomes, last repair status, and a direct Tailscale dashboard link. Its latest published HTML is available privately at `http://100.71.219.83:18091/observability`. The existing report sender also saves this local copy; generating a preview does not send email. Live website statistics are labeled separately from the report's completed-day metrics.

Chrome may suppress public-site analytics when Tailscale resolves the collector hostname to a private address and local-network permission is denied. Public internet visitors reach the public Funnel address. These browser-blocked visits are not counted; the site remains usable.
