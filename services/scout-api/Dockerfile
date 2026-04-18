FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
COPY packages/ ./packages/

RUN pnpm install --frozen-lockfile --prod=false

COPY services/scout-api/ ./services/scout-api/

RUN pnpm --filter @afrixplore/scout-api build

# ─── Production Stage ───────────────────────────────────────────────────────
FROM node:20-alpine AS production

RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

WORKDIR /app

RUN addgroup -S nodejs && adduser -S nodejs -G nodejs

COPY --from=builder /app/services/scout-api/dist ./dist
COPY --from=builder /app/services/scout-api/package.json ./package.json

RUN pnpm install --prod --frozen-lockfile 2>/dev/null || pnpm install --prod

USER nodejs

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
