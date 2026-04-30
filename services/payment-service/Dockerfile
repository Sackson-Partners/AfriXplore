FROM node:20-alpine AS base
RUN corepack enable

# ── Builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY services/payment-service/ ./services/payment-service/

RUN pnpm install --frozen-lockfile

RUN pnpm --filter "@afrixplore/telemetry" \
         --filter "@afrixplore/types" \
         --filter "@afrixplore/validation" \
         --filter "@afrixplore/config" \
         --filter "@afrixplore/auth" \
         --filter "@afrixplore/health" \
         run build

RUN pnpm --filter "@afrixplore/payment-service" run build

RUN pnpm --filter "@afrixplore/payment-service" deploy --prod /app

# ── Production image ──────────────────────────────────────────────────────────
FROM base AS production
WORKDIR /app

COPY --from=builder /app ./
COPY --from=builder /repo/services/payment-service/dist ./dist

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3003
CMD ["node", "dist/index.js"]
