#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────
# Mirror LOCAL DEV data → STAGING DB (schema is assumed already in sync via the
# `dev` push → `migrate deploy` pipeline). Runs from the Mac: dumps the local
# dev Postgres, sanitizes PG17→PG16 quirks, ships it to the VPS over SSH, then
# TRUNCATEs staging (schema + _prisma_migrations kept) and loads the data.
#
# NEVER touches prod. Staging only (/opt/bakimx-staging).
#
#   Usage:
#     ./scripts/sync-dev-to-staging.sh user@vps-host          # asks to confirm
#     ./scripts/sync-dev-to-staging.sh --yes user@vps-host    # no prompt
#     STAGING_SSH=user@vps-host ./scripts/sync-dev-to-staging.sh
#
#   The VPS target can also live (gitignored) in scripts/.staging-vps so you can
#   just run `./scripts/sync-dev-to-staging.sh` with no args.
#
# Tunables (env, with sane defaults):
#     DEV_CONTAINER=bakimx-db-1  DEV_USER=bakimx  DEV_DB=bakimx
#     STAGING_DIR=/opt/bakimx-staging
# ──────────────────────────────────────────────────────────────────────────

DEV_CONTAINER="${DEV_CONTAINER:-bakimx-db-1}"
DEV_USER="${DEV_USER:-bakimx}"
DEV_DB="${DEV_DB:-bakimx}"
STAGING_DIR="${STAGING_DIR:-/opt/bakimx-staging}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Resolve flags + VPS target ────────────────────────────────────────────
ASSUME_YES=0
TARGET=""
for arg in "$@"; do
  case "$arg" in
    --yes|-y) ASSUME_YES=1 ;;
    *) TARGET="$arg" ;;
  esac
done
TARGET="${TARGET:-${STAGING_SSH:-}}"
if [ -z "$TARGET" ] && [ -f "$SCRIPT_DIR/.staging-vps" ]; then
  TARGET="$(tr -d '[:space:]' < "$SCRIPT_DIR/.staging-vps")"
fi
if [ -z "$TARGET" ]; then
  echo "⛔ VPS hedefi yok. Kullanım: $0 user@vps-host   (veya STAGING_SSH env / scripts/.staging-vps)" >&2
  exit 1
fi

# ── Preflight: dev container up? ──────────────────────────────────────────
if ! docker exec "$DEV_CONTAINER" pg_isready -U "$DEV_USER" >/dev/null 2>&1; then
  echo "⛔ Dev DB '$DEV_CONTAINER' erişilemiyor. OrbStack açık mı? (docker ps)" >&2
  exit 1
fi

echo "▶ Hedef staging: $TARGET"
echo "▶ Kaynak dev DB: container=$DEV_CONTAINER db=$DEV_DB"
if [ "$ASSUME_YES" -ne 1 ]; then
  echo "⚠️  Bu, STAGING verisini SİLİP dev'in aynasıyla değiştirir (prod'a dokunmaz)."
  read -r -p "Devam için 'sync' yaz: " ans
  [ "$ans" = "sync" ] || { echo "İptal."; exit 1; }
fi

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
DUMP="$WORKDIR/dev-data-pg16.sql.gz"

# ── 1) Dump dev data-only + sanitize for PG16 ─────────────────────────────
# --data-only: COPY blocks only (schema stays staging's). --disable-triggers:
# avoids FK ordering issues (staging user is superuser). Exclude _prisma_migrations
# so staging keeps its own migration history. Strip PG17-only lines PG16 rejects:
#   \restrict / \unrestrict (psql meta-cmd) and `SET transaction_timeout`.
echo "▶ [1/4] Dev dump alınıyor + PG16 için temizleniyor…"
docker exec "$DEV_CONTAINER" pg_dump -U "$DEV_USER" -d "$DEV_DB" \
    --data-only --no-owner --no-privileges --disable-triggers \
    --exclude-table=_prisma_migrations \
  | grep -vE '^\\(restrict|unrestrict) ' \
  | grep -v '^SET transaction_timeout' \
  | gzip > "$DUMP"
COPYCOUNT="$(gunzip -c "$DUMP" | grep -c '^COPY ' || true)"
echo "   dump hazır ($(du -h "$DUMP" | cut -f1), $COPYCOUNT tablo)"

# ── 2) Ship to VPS ────────────────────────────────────────────────────────
echo "▶ [2/4] VPS'e kopyalanıyor…"
scp -q "$DUMP" "$TARGET:$STAGING_DIR/dev-data-pg16.sql.gz"

# ── 3) Remote: truncate staging + load + verify + cleanup ─────────────────
echo "▶ [3/4] Staging boşaltılıp yükleniyor…"
ssh "$TARGET" "STAGING_DIR='$STAGING_DIR' bash -s" <<'REMOTE'
set -euo pipefail
cd "$STAGING_DIR"
DB=$(docker compose --env-file .env.staging -f docker-compose.staging.yml ps -q db)
[ -n "$DB" ] || { echo "⛔ staging db container yok"; exit 1; }
PGUSER=$(grep -E '^POSTGRES_USER=' .env.staging | cut -d= -f2- | tr -d '"'); PGUSER="${PGUSER:-bakimx_staging}"
PGDB=$(grep -E '^POSTGRES_DB=' .env.staging | cut -d= -f2- | tr -d '"'); PGDB="${PGDB:-bakimx_staging}"

# Truncate everything except migration history
docker exec -i "$DB" psql -U "$PGUSER" -d "$PGDB" -q -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE stmt text;
BEGIN
  SELECT 'TRUNCATE TABLE ' || string_agg(format('%I.%I', schemaname, tablename), ', ')
       || ' RESTART IDENTITY CASCADE'
  INTO stmt FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations';
  EXECUTE stmt;
END $$;
SQL

# Load atomically
gunzip -c dev-data-pg16.sql.gz \
  | docker exec -i "$DB" psql -U "$PGUSER" -d "$PGDB" -q -v ON_ERROR_STOP=1 --single-transaction

# Wipe the dump (contains password hashes)
rm -f dev-data-pg16.sql.gz

# Report counts
echo "--- staging satır sayıları ---"
docker exec -i "$DB" psql -U "$PGUSER" -d "$PGDB" -t -A -F' = ' -c "
SELECT 'Workshop', count(*) FROM \"Workshop\"
UNION ALL SELECT 'User', count(*) FROM \"User\"
UNION ALL SELECT 'ServiceOrder', count(*) FROM \"ServiceOrder\"
UNION ALL SELECT 'VehicleIntakeForm', count(*) FROM \"VehicleIntakeForm\"
UNION ALL SELECT 'vehicle_brands', count(*) FROM vehicle_brands
UNION ALL SELECT 'vehicle_types', count(*) FROM vehicle_types;"
REMOTE

# ── 4) Show dev side for comparison ───────────────────────────────────────
echo "▶ [4/4] Karşılaştırma — dev satır sayıları:"
docker exec -i "$DEV_CONTAINER" psql -U "$DEV_USER" -d "$DEV_DB" -t -A -F' = ' -c "
SELECT 'Workshop', count(*) FROM \"Workshop\"
UNION ALL SELECT 'User', count(*) FROM \"User\"
UNION ALL SELECT 'ServiceOrder', count(*) FROM \"ServiceOrder\"
UNION ALL SELECT 'VehicleIntakeForm', count(*) FROM \"VehicleIntakeForm\"
UNION ALL SELECT 'vehicle_brands', count(*) FROM vehicle_brands
UNION ALL SELECT 'vehicle_types', count(*) FROM vehicle_types;"

echo "✅ Sync tamamlandı. (Foto dosyaları kopyalanmaz — VehiclePhoto linkleri staging'de 404 verebilir.)"
