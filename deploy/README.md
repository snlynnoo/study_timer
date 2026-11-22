# VPS deployment

The current workspace is deployed to `root@46.224.123.33` in `/srv/study-timer/app`.
Production URL: `https://studytimer.snlynnoo.dev`.
The root domain is reserved for the separate portfolio project.

## Layout

- `/srv/study-timer/app`: symlink to the active source release and app Compose project.
- `/srv/study-timer/releases/<commit>`: immutable source releases and revision-tagged Docker images.
- `/srv/study-timer/data`: persistent SQLite database, owned by container UID 1000.
- `/srv/web-proxy`: shared Caddy Compose project and Caddyfile.
- Docker network `web`: proxy-to-app communication. Each future app needs a unique network alias.
- The app's port 3001 is bound only to the server's loopback address.
- Public ports: SSH 22, HTTP 80, HTTPS 443 (TCP; UDP 443 for HTTP/3).

## DNS

In Cloudflare, create an A record named `studytimer` with value `46.224.123.33`.
Use DNS-only initially; do not add an AAAA record containing an IPv6 `/64` prefix.
Caddy obtains and renews the origin TLS certificate automatically once DNS resolves and ports 80/443 are reachable.
If Cloudflare proxying is later enabled, use SSL/TLS mode **Full (strict)**.

## Automatic deployments

Push to `main`. The `Validate for VPS deployment` GitHub Actions workflow runs tests,
TypeScript checks, the frontend build, a dependency audit, deployment-controller checks,
and a production Docker build on a GitHub-hosted runner. It has read-only repository permissions.
Vercel automatic deployment stays disabled.

The VPS `study-timer-deploy.timer` checks the public workflow result every two minutes.
Only a successful run for this repository's current `main` commit can deploy. Pull requests,
forks, failed runs, and older successful commits cannot deploy. The server downloads that exact
commit, builds it while the existing app stays up, backs up the live database, starts the new
container, and verifies health before updating the active release symlink. A failed container
startup restores the previous application image. Database snapshots are preserved; database
rollback is manual because automatically replacing data could lose user writes. Schema changes
must remain backward compatible with the previous application for image rollback to work.

This pull deployment uses public GitHub APIs and does not need an SSH key, GitHub token,
public deployment webhook, or self-hosted GitHub runner. Keep the repository public; making it
private requires adding appropriate read credentials to the server. GitHub outages or API rate
limits delay deployments; the existing app remains up. Failed deployments retry after 10 minutes.
GitHub Actions shows validation status; final deployment status is in the server journal and
`/srv/study-timer/DEPLOYED_REVISION`.

Check or pause automatic deployment:

```sh
systemctl status study-timer-deploy.timer
journalctl -u study-timer-deploy.service -n 100
cat /srv/study-timer/DEPLOYED_REVISION
systemctl stop study-timer-deploy.timer
# Resume with: systemctl start study-timer-deploy.timer
```

The controller is installed at `/usr/local/lib/study-timer/autodeploy.py`. Changes to the
controller or systemd units must be reviewed and installed separately; ordinary app updates
deploy automatically. Keep `/srv/study-timer/data` and `/srv/web-proxy` outside source releases.
Never upload local databases over production data. Monitor disk usage and retain any image
needed for rollback before pruning older releases and Docker build cache.

Optional production overrides live in `/srv/study-timer/production.env` (private, root-owned).
`REGISTRATION_ENABLED` defaults to `false`. Password recovery email delivery is not configured
in production; administrators can still reset passwords. This deployment does not activate
local-only password-reset mail files or change existing users' passwords.

## Backups and recovery

`study-timer-backup.timer` creates a transactionally consistent SQLite snapshot daily at
03:00 UTC plus up to 15 minutes of jitter. The latest 14 snapshots remain in
`/srv/study-timer/data/backups`. These are on-server recovery copies, not off-site backups.
Before restoring, stop the app, save the current database and its WAL/SHM files, restore the
chosen snapshot as `study-timer.sqlite`, remove the old WAL/SHM from the active data directory,
ensure ownership is UID/GID 1000, and start the app again.

Check backups with `systemctl status study-timer-backup.timer` and
`journalctl -u study-timer-backup.service`.
Copy snapshots to a separate trusted location regularly; they contain private user data.
Existing local browser sign-ins are not copied to the VPS; sign in again with your current account password.
