#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────
# Restore a BakimX Postgres backup into the running prod db container.
# Run from /opt/bakimx (where docker-compose.yml + .env.production live).
#
#   Usage:  ./restore-db.sh /opt/bakimx/backups/bakimx_YYYYMMDD_HHMMSS.sql.gz
#
# Backups are produced by /opt/bakimx/backup.sh (pg_dump --clean --if-exists),
# so this restore drops + recreates objects in place.
# ──────────────────────────────────────────────────────────────────────────

BACKUP="${1:?Usage: restore-db.sh <backup.sql.gz>}"
[ -f "$BACKUP" ] || { echo "Backup not found: $BACKUP" >&2; exit 1; }

DB_CONTAINER=$(docker compose --env-file .env.production ps -q db)
[ -n "$DB_CONTAINER" ] || { echo "db container not running" >&2; exit 1; }

PGUSER=$(grep -E '^POSTGRES_USER=' .env.production | cut -d= -f2- | tr -d '"'); PGUSER="${PGUSER:-bakimx}"
PGDB=$(grep -E '^POSTGRES_DB=' .env.production | cut -d= -f2- | tr -d '"'); PGDB="${PGDB:-bakimx}"

echo "⚠️  This OVERWRITES the '$PGDB' database with:"
echo "    $BACKUP"
read -r -p "Type 'restore' to continue: " ans
[ "$ans" = "restore" ] || { echo "Aborted."; exit 1; }

gunzip -c "$BACKUP" | docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$PGUSER" -d "$PGDB"
echo "✅ Restore complete."
