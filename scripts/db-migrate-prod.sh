#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────
# Safe production migration: BACK UP first, THEN apply pending migrations.
# Run from /opt/bakimx (where docker-compose.yml + .env.production live).
# See DB.md for the full workflow and the one-time `migrate resolve --applied 0_init`.
# ──────────────────────────────────────────────────────────────────────────

[ -f docker-compose.yml ] && [ -f .env.production ] || {
  echo "Run from /opt/bakimx (needs docker-compose.yml + .env.production)." >&2; exit 1; }

echo "==> 1/3 Backing up before migrating..."
if [ -x /opt/bakimx/backup.sh ]; then
  /opt/bakimx/backup.sh
else
  echo "WARN: /opt/bakimx/backup.sh not found — proceeding WITHOUT a fresh backup."
fi

echo "==> 2/3 Applying pending migrations (migrate deploy)..."
docker compose run --rm app sh -lc 'npx --yes prisma@7.8.0 migrate deploy'

echo "==> 3/3 Status:"
docker compose run --rm app sh -lc 'npx --yes prisma@7.8.0 migrate status'
echo "✅ Done."
