# ============================================================
# Base: shared node + pnpm setup
# ============================================================
FROM node:22-alpine AS base

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

# ============================================================
# Dependencies: install all workspace dependencies
# ============================================================
FROM base AS deps

# Copy workspace manifests so pnpm can resolve the full graph
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/query-api/package.json ./apps/query-api/
COPY packages/database/package.json ./packages/database/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/nestjs-common/package.json ./packages/nestjs-common/
COPY packages/api-types/package.json ./packages/api-types/

RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN=$(cat /run/secrets/npm_token) \
    pnpm install --frozen-lockfile

# ============================================================
# Development: full source for hot-reload (dev override target)
# ============================================================
FROM deps AS development

COPY . .
WORKDIR /app/apps/query-api

EXPOSE 3003

CMD ["sh", "-c", "node_modules/.bin/nest start --watch"]

# ============================================================
# Build: compile query-api and its workspace dependencies
# ============================================================
FROM deps AS build

COPY . .

# Build workspace deps first (database package must be compiled before the app)
RUN pnpm --filter @spechive/shared-types run build
RUN pnpm --filter @spechive/api-types run build
RUN pnpm --filter @spechive/database run build
RUN pnpm --filter @spechive/nestjs-common run build
RUN pnpm --filter @spechive/query-api run build

# ============================================================
# Production: minimal final image
# ============================================================
FROM base AS production

ENV NODE_ENV=production

# Create non-root user
RUN addgroup -S spechive && adduser -S spechive -G spechive

WORKDIR /app

# Copy workspace manifests for production install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/query-api/package.json ./apps/query-api/
COPY packages/database/package.json ./packages/database/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/nestjs-common/package.json ./packages/nestjs-common/
COPY packages/api-types/package.json ./packages/api-types/

RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN=$(cat /run/secrets/npm_token) \
    HUSKY=0 pnpm install --frozen-lockfile --prod

# Copy compiled output from build stage
COPY --from=build /app/apps/query-api/dist ./apps/query-api/dist
COPY --from=build /app/packages/database/dist ./packages/database/dist
COPY --from=build /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=build /app/packages/nestjs-common/dist ./packages/nestjs-common/dist
COPY --from=build /app/packages/api-types/dist ./packages/api-types/dist

# Copy NestJS cli config needed by nest start
COPY apps/query-api/nest-cli.json ./apps/query-api/

RUN chown -R spechive:spechive /app

USER spechive

EXPOSE 3003

WORKDIR /app/apps/query-api

CMD ["node", "dist/main"]
