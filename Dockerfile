FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

FROM base AS deps
# Install with bun, not npm. `bun.lock` is the only committed lockfile and npm cannot
# read it — and `--frozen-lockfile` is not an npm flag, so the previous
# `npm install --frozen-lockfile` silently re-resolved every `^` range against the live
# registry on each build. That made the image non-deterministic: an unchanged repo built
# green at 16:49 and then failed at 17:02 on 2026-07-25 with an ERESOLVE peer conflict
# (`@hookform/resolvers` floated 5.4.0 -> 5.4.3, which wants `valibot@^1.0.0`).
# package.json also uses bun-only fields — `patchedDependencies` (the Next dev-crash
# patch) and `trustedDependencies` — which npm ignores outright.
#
# Pin the bun image so the toolchain is versioned like everything else; copying just the
# binary keeps the node:22-alpine base (Next standalone + the /migrate Prisma tree both
# run on node at runtime).
COPY --from=oven/bun:1.3.13-alpine /usr/local/bin/bun /usr/local/bin/bun
# Copy the Prisma schema alongside the manifest: package.json's `postinstall` runs
# `prisma generate`, which needs prisma/schema.prisma present at install time. Without
# this the install aborts with "Could not find Prisma Schema" and the build fails.
# `patches/` is required too — bun resolves `patchedDependencies` during install.
COPY package.json bun.lock ./
COPY patches ./patches
COPY prisma ./prisma
RUN bun install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
ARG SESSION_SECRET=build_time_placeholder_at_least_32_chars_long__
# Per-image cookie scope, inlined into the Edge middleware bundle at build time (Edge
# inlines process.env.* directly). Empty default → prod values via the `||` fallback in
# lib/session.ts; the staging workflow passes staging values as build-args.
ARG SESSION_COOKIE_NAME=
ARG SESSION_COOKIE_DOMAIN=
ENV SESSION_COOKIE_NAME=$SESSION_COOKIE_NAME
ENV SESSION_COOKIE_DOMAIN=$SESSION_COOKIE_DOMAIN
# Public analytics configuration is compiled into the browser bundle by Next.js.
# Deployment workflows pass environment-specific repository variables as build args;
# defaults keep local/unspecified builds safely disabled.
ARG NEXT_PUBLIC_ANALYTICS_ENABLED=false
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID=
ENV NEXT_PUBLIC_ANALYTICS_ENABLED=$NEXT_PUBLIC_ANALYTICS_ENABLED
ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID
RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Bayat-chunk kurtarması (Katman 2): build'in static asset'lerini `.next/static` yerine
# pristine bir snapshot olarak sakla. Entrypoint bunları çalışma anında kalıcı volume'a
# (biriktirerek) kopyalar; böylece eski deploy'ların chunk'ları diskte kalır. Ayrıca
# nextjs-sahipli boş bir `.next/static` bırak ki named volume ilk mount'ta bu sahipliği
# devralsın (aksi halde root olur ve entrypoint yazamaz). Bkz. docker-entrypoint.sh.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./static-dist
RUN mkdir -p /app/.next/static && chown nextjs:nodejs /app/.next/static
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Migration tooling for the one-shot `migrate` service. The Prisma 7 CLI's runtime
# closure (CLI bundle + @prisma/* + top-level-hoisted effect/c12/jiti/typescript/iconv-lite/…)
# is large and absent from the slim Next standalone trace, so stage the FULL builder
# node_modules + the .ts config + schema under /migrate, used ONLY by `migrate`
# (compose sets working_dir: /migrate). The app keeps running on its untouched slim
# standalone tree. Verified locally: this tree loads prisma.config.ts + schema and reaches
# the DB (engine is WASM, platform-independent). Run via:
#   node node_modules/prisma/build/index.js migrate deploy
COPY --from=builder --chown=nextjs:nodejs /app/node_modules /migrate/node_modules
COPY --from=builder --chown=nextjs:nodejs /app/prisma /migrate/prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts /migrate/prisma.config.ts
# Vehicle-catalog seed, run as a second one-shot task after `migrate deploy` so a fresh
# DB self-heals its global reference tables (vehicle_brands/models/types/type_details)
# from the committed gz fixtures under /migrate/prisma/data/vehicle-catalog. Idempotent
# (createMany skipDuplicates). tsx is present in the full builder node_modules. Run via:
#   node node_modules/tsx/dist/cli.mjs scripts/migrate-vehicle-catalog.ts --from-file
# The script needs exactly three src/ files: row-mappers.ts (row shaping), ndjson-stream.ts
# (batched streaming reader — buffering whole fixtures OOM-killed the 512 MB task) and
# pg-connection.ts (the DB_SSL_NO_VERIFY / RDS TLS workaround — without it the task dies with
# "self-signed certificate in certificate chain"). Keep these in sync with the imports.
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate-vehicle-catalog.ts /migrate/scripts/migrate-vehicle-catalog.ts
COPY --from=builder --chown=nextjs:nodejs /app/scripts/activate-stage2a-pilot.ts /migrate/scripts/activate-stage2a-pilot.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/catalog/row-mappers.ts /migrate/src/lib/catalog/row-mappers.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/catalog/ndjson-stream.ts /migrate/src/lib/catalog/ndjson-stream.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/pg-connection.ts /migrate/src/lib/pg-connection.ts

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Entrypoint, server başlamadan önce static asset'leri kalıcı volume'da biriktirir
# (bkz. docker-entrypoint.sh) ve sonra `exec "$@"` ile CMD'i çalıştırır. `migrate`
# job'ı kendi command'ını geçtiği için biriktirme adımı orada atlanır.
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
