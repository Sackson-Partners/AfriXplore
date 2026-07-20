# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/types/package.json ./packages/types/
COPY packages/validation/package.json ./packages/validation/
COPY packages/database/package.json ./packages/database/
COPY packages/auth/package.json ./packages/auth/
COPY packages/config/package.json ./packages/config/
COPY packages/cache/package.json ./packages/cache/
COPY packages/security/package.json ./packages/security/
COPY packages/monitoring/package.json ./packages/monitoring/
COPY services/geoswarm-api/package.json ./services/geoswarm-api/
RUN pnpm install --frozen-lockfile --prod=false

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY services/geoswarm-api/ ./services/geoswarm-api/
RUN pnpm --filter "./packages/**" build && \
    pnpm --filter "@ain/geoswarm-api" build

FROM build AS deploy
RUN pnpm --filter "@ain/geoswarm-api" deploy --prod /deploy

FROM node:20-alpine AS runner
RUN addgroup --system --gid 1001 ain && \
    adduser --system --uid 1001 geoswarm
WORKDIR /app

COPY --from=deploy --chown=geoswarm:ain /deploy ./

USER geoswarm
EXPOSE 3003
ENV NODE_ENV=production

CMD ["node", "dist/server.js"]
