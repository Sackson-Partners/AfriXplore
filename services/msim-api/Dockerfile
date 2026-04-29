# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/types/package.json ./packages/types/
COPY packages/validation/package.json ./packages/validation/
COPY packages/database/package.json ./packages/database/
COPY packages/auth/package.json ./packages/auth/
COPY packages/config/package.json ./packages/config/
COPY services/msim-api/package.json ./services/msim-api/
RUN pnpm install --frozen-lockfile --prod=false

# Build
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY services/msim-api/ ./services/msim-api/
RUN pnpm --filter "./packages/**" build && \
    pnpm --filter "@ain/msim-api" build

# Production image
FROM node:20-alpine AS runner
RUN addgroup --system --gid 1001 ain && \
    adduser --system --uid 1001 msim
WORKDIR /app

COPY --from=build --chown=msim:ain /app/packages/types/dist ./packages/types/dist
COPY --from=build --chown=msim:ain /app/packages/validation/dist ./packages/validation/dist
COPY --from=build --chown=msim:ain /app/packages/database/dist ./packages/database/dist
COPY --from=build --chown=msim:ain /app/packages/auth/dist ./packages/auth/dist
COPY --from=build --chown=msim:ain /app/packages/config/dist ./packages/config/dist
COPY --from=build --chown=msim:ain /app/services/msim-api/dist ./services/msim-api/dist
COPY --from=build --chown=msim:ain /app/services/msim-api/migrations ./services/msim-api/migrations
COPY --from=build --chown=msim:ain /app/node_modules ./node_modules

# Package.json files needed for module resolution
COPY --from=build --chown=msim:ain /app/packages/types/package.json ./packages/types/
COPY --from=build --chown=msim:ain /app/packages/validation/package.json ./packages/validation/
COPY --from=build --chown=msim:ain /app/packages/database/package.json ./packages/database/
COPY --from=build --chown=msim:ain /app/packages/auth/package.json ./packages/auth/
COPY --from=build --chown=msim:ain /app/packages/config/package.json ./packages/config/
COPY --from=build --chown=msim:ain /app/services/msim-api/package.json ./services/msim-api/

USER msim
EXPOSE 3002
ENV NODE_ENV=production

CMD ["node", "services/msim-api/dist/server.js"]
