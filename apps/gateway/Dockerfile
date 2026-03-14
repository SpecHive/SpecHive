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
COPY apps/gateway/package.json ./apps/gateway/
COPY packages/database/package.json ./packages/database/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/nestjs-common/package.json ./packages/nestjs-common/

RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN=$(cat /run/secrets/npm_token) \
    pnpm install --frozen-lockfile

# ============================================================
# Development: full source for hot-reload (dev override target)
# ============================================================
FROM deps AS development

COPY . .
WORKDIR /app/apps/gateway

EXPOSE 3003

CMD ["sh", "-c", "node_modules/.bin/nest start --watch"]

# ============================================================
# Build: compile gateway and its workspace dependencies
# ============================================================
FROM deps AS build

COPY . .

# Build workspace deps first (database package must be compiled before the app)
RUN pnpm --filter @spechive/shared-types run build
RUN pnpm --filter @spechive/database run build
RUN pnpm --filter @spechive/nestjs-common run build
RUN pnpm --filter @spechive/gateway run build

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
COPY apps/gateway/package.json ./apps/gateway/
COPY packages/database/package.json ./packages/database/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/nestjs-common/package.json ./packages/nestjs-common/

# Install production-only dependencies (--ignore-scripts avoids the root prepare hook calling husky)
RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN=$(cat /run/secrets/npm_token) \
    pnpm install --frozen-lockfile --prod --ignore-scripts && \
    pnpm rebuild argon2

# Copy compiled output from build stage
COPY --from=build /app/apps/gateway/dist ./apps/gateway/dist
COPY --from=build /app/packages/database/dist ./packages/database/dist
COPY --from=build /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=build /app/packages/nestjs-common/dist ./packages/nestjs-common/dist

RUN chown -R spechive:spechive /app

USER spechive

EXPOSE 3003

WORKDIR /app/apps/gateway

CMD ["node", "dist/main"]
