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
