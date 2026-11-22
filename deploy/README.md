# VPS deployment

The current workspace is deployed to `root@46.224.123.33` in `/srv/study-timer/app`.
Production URL: `https://studytimer.snlynnoo.dev`.
The root domain is reserved for the separate portfolio project.

## Layout

- `/srv/study-timer/app`: source, Dockerfile and app Compose project.
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

## Update an existing deployment

Push the intended source changes to GitHub first. On the server, back up the live database,
update the source, then rebuild and check the container:

```sh
cd /srv/study-timer/app
docker compose exec -T app node server/backup.mjs
# Update the source from the reviewed GitHub revision or upload a clean source archive.
# Never upload .env files, .data, node_modules, or local database files over production data.
docker compose up -d --build --wait
curl --fail http://127.0.0.1:3001/api/health
docker compose logs --tail=50
```

The initial deployment uses an archive of the tested local workspace, including changes that
were not previously in GitHub. It is not a Git checkout on the server. Subsequent source uploads
must exclude `deploy/` changes from the live proxy unless those changes are intentional.

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
