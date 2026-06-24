FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN \
  if [ -f bun.lock ]; then \
    npm install --frozen-lockfile; \
  else \
    npm install; \
  fi

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
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

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

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]