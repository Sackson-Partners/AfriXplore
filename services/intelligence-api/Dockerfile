FROM node:20-alpine AS base
RUN corepack enable

# ── Builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /repo

# Workspace manifests (needed for pnpm to resolve workspace: deps)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY services/intelligence-api/ ./services/intelligence-api/

RUN pnpm install --frozen-lockfile

# Build shared packages then the service
RUN pnpm --filter "@afrixplore/telemetry" \
         --filter "@afrixplore/types" \
         --filter "@afrixplore/validation" \
         --filter "@afrixplore/config" \
         --filter "@afrixplore/auth" \
         --filter "@afrixplore/health" \
         run build

RUN pnpm --filter "@afrixplore/intelligence-api" run build

# pnpm deploy creates a self-contained bundle (resolves workspace: → real files)
RUN pnpm --filter "@afrixplore/intelligence-api" deploy --prod /app

# ── Production image ──────────────────────────────────────────────────────────
FROM base AS production
WORKDIR /app

COPY --from=builder /app ./
COPY --from=builder /repo/services/intelligence-api/dist ./dist

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3001
CMD ["node", "dist/index.js"]
