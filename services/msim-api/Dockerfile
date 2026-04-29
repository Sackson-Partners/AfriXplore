# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Install all dependencies (including dev, needed for build)
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/types/package.json ./packages/types/
COPY packages/validation/package.json ./packages/validation/
COPY packages/database/package.json ./packages/database/
COPY packages/auth/package.json ./packages/auth/
COPY packages/config/package.json ./packages/config/
COPY services/msim-api/package.json ./services/msim-api/
RUN pnpm install --frozen-lockfile --prod=false

# Build all packages and the service
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY services/msim-api/ ./services/msim-api/
RUN pnpm --filter "./packages/**" build && \
    pnpm --filter "@ain/msim-api" build

# Use pnpm deploy to produce a self-contained production bundle
# (resolves workspace symlinks, prunes dev deps, copies migrations)
FROM build AS deploy
RUN pnpm --filter "@ain/msim-api" deploy --prod /deploy && \
    cp -r /app/services/msim-api/migrations /deploy/migrations

# Production image — lean, no pnpm needed
FROM node:20-alpine AS runner
RUN addgroup --system --gid 1001 ain && \
    adduser --system --uid 1001 msim
WORKDIR /app

COPY --from=deploy --chown=msim:ain /deploy ./

USER msim
EXPOSE 3002
ENV NODE_ENV=production

CMD ["node", "dist/server.js"]
