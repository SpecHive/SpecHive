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

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/database/package.json ./packages/database/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/reporter-core-protocol/package.json ./packages/reporter-core-protocol/
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
WORKDIR /app/apps/worker

EXPOSE 3001

CMD ["sh", "-c", "node_modules/.bin/nest start --watch"]

# ============================================================
# Build: compile worker and its workspace dependencies
# ============================================================
FROM deps AS build

COPY . .

RUN pnpm --filter @spechive/shared-types run build
RUN pnpm --filter @spechive/reporter-core-protocol run build
RUN pnpm --filter @spechive/database run build
RUN pnpm --filter @spechive/nestjs-common run build
RUN pnpm --filter @spechive/worker run build

# ============================================================
# Production: minimal final image
# ============================================================
FROM base AS production

ENV NODE_ENV=production

RUN addgroup -S spechive && adduser -S spechive -G spechive

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/database/package.json ./packages/database/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/reporter-core-protocol/package.json ./packages/reporter-core-protocol/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/nestjs-common/package.json ./packages/nestjs-common/

# --ignore-scripts avoids the root prepare hook calling husky
RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN=$(cat /run/secrets/npm_token) \
    pnpm install --frozen-lockfile --prod --ignore-scripts

COPY --from=build /app/apps/worker/dist ./apps/worker/dist
COPY --from=build /app/packages/database/dist ./packages/database/dist
COPY --from=build /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=build /app/packages/reporter-core-protocol/dist ./packages/reporter-core-protocol/dist
COPY --from=build /app/packages/nestjs-common/dist ./packages/nestjs-common/dist

COPY apps/worker/nest-cli.json ./apps/worker/

RUN chown -R spechive:spechive /app

USER spechive

EXPOSE 3001

WORKDIR /app/apps/worker

CMD ["node", "dist/main"]
