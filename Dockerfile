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

# Prisma CLI for the one-shot `migrate` service (`prisma migrate deploy` at deploy
# time, before the app is recreated). The Next standalone build omits the CLI; the
# `prisma/` dir (schema + migrations) is already copied above. openssl + libc6-compat
# (installed in `base`) satisfy the Prisma engine on alpine. Pinned to the app's version.
RUN npm install --no-save --no-package-lock prisma@7.8.0

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]