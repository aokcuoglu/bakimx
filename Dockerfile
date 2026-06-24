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

# Prisma CLI + engine (WASM, bundled in `prisma`) + the `prisma.config.ts` that supplies
# the datasource URL in Prisma 7 (schema.prisma has no `url`), for the one-shot `migrate`
# service. Copied from `builder` (where `prisma generate` already ran) so the CLI,
# `prisma/config`, the engines, and the GENERATED @prisma/client all resolve consistently
# — without reconciling the standalone package.json. Run via:
#   node node_modules/prisma/build/index.js migrate deploy
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]