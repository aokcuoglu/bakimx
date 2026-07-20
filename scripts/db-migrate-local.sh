#!/usr/bin/env bash
# Author a new Prisma migration against a LOCAL throwaway Postgres (hybrid workflow).
#
# Day-to-day the app runs against the shared AWS dev DB (see scripts/aws-dev-tunnel.sh).
# `prisma migrate dev` is destructive (it can reset on drift), so it must NEVER run against
# that shared cloud DB. This script brings up the local OrbStack Postgres, applies existing
# migrations, and runs `migrate dev` there. After it succeeds, apply the new migration to
# AWS dev with:   bun run db:tunnel   (separate terminal)   then   bun run db:deploy
#
# Pass migrate args through, e.g.:  bun run db:migrate --name add_widget_table
set -euo pipefail
cd "$(dirname "$0")/.."

LOCAL_URL="postgresql://bakimx:bakimx@localhost:5432/bakimx"

echo "→ Ensuring local Postgres is up (OrbStack)…"
docker compose -f docker-compose.local.yml up -d db

echo "→ Waiting for local DB to accept connections…"
for _ in $(seq 1 30); do
  if docker exec bakimx-db-1 pg_isready -U bakimx >/dev/null 2>&1; then break; fi
  sleep 1
done

echo "→ prisma migrate dev against LOCAL ($LOCAL_URL)…"
DATABASE_URL="$LOCAL_URL" DIRECT_URL="$LOCAL_URL" bunx prisma migrate dev "$@"

cat <<'EOF'

✓ Migration authored & applied locally.
  Now apply it to AWS dev:
    1) open the tunnel:   bun run db:tunnel     (separate terminal, keep open)
    2) deploy:            bun run db:deploy
EOF
