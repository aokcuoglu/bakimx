#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────
# LOCAL-ONLY destructive reset.
# Wipes the local dev Postgres + MinIO volumes, then re-applies schema + seed.
#
# This exists so nobody types `docker compose down -v` from muscle memory and
# wipes PRODUCTION's pgdata. It ONLY ever touches docker-compose.local.yml.
#   Usage:  ./scripts/local-reset.sh           (asks for confirmation)
#           ./scripts/local-reset.sh --yes      (no prompt)
# ──────────────────────────────────────────────────────────────────────────

COMPOSE_FILE="docker-compose.local.yml"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "⛔ $COMPOSE_FILE not found — run this from the repo root. Aborting." >&2
  exit 1
fi

if [ "${1:-}" != "--yes" ]; then
  echo "⚠️  This DELETES ALL local dev data (Postgres + MinIO volumes)."
  echo "    Production is never touched — this only uses $COMPOSE_FILE."
  read -r -p "Type 'reset' to continue: " ans
  [ "$ans" = "reset" ] || { echo "Aborted."; exit 1; }
fi

docker compose -f "$COMPOSE_FILE" down -v
docker compose -f "$COMPOSE_FILE" up -d

echo "Waiting for Postgres to become ready..."
until docker compose -f "$COMPOSE_FILE" exec -T db pg_isready -U bakimx >/dev/null 2>&1; do
  sleep 1
done

bun run db:deploy
bun run db:seed
echo "✅ Local reset complete."
