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
COPY apps/dashboard/package.json ./apps/dashboard/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/api-types/package.json ./packages/api-types/

RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN=$(cat /run/secrets/npm_token) \
    pnpm install --frozen-lockfile

# ============================================================
# Development: Vite dev server with hot module replacement
# The dev compose override mounts sources and runs this target.
# ============================================================
FROM deps AS development

COPY . .
WORKDIR /app/apps/dashboard

EXPOSE 8080

CMD ["node_modules/.bin/vite", "--host", "0.0.0.0", "--port", "8080"]

# ============================================================
# Build: compile static assets
# ============================================================
FROM deps AS build

COPY . .

# VITE_API_URL is inlined by Vite at build time; also used at runtime by nginx for CSP headers
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN test -n "$VITE_API_URL" || { echo "ERROR: VITE_API_URL build arg is required"; exit 1; }

RUN pnpm --filter @spechive/shared-types run build
RUN pnpm --filter @spechive/api-types run build
RUN pnpm --filter @spechive/dashboard run build

# ============================================================
# Production: serve compiled assets with nginx
# ============================================================
FROM nginxinc/nginx-unprivileged:1.27-alpine AS production

COPY --from=build /app/apps/dashboard/dist /usr/share/nginx/html
# Place config as a template — nginx-unprivileged auto-runs envsubst on /etc/nginx/templates/*.template at startup
COPY apps/dashboard/nginx.conf /etc/nginx/templates/default.conf.template

# Runtime value — nginx envsubst resolves this for CSP connect-src header
ENV VITE_API_URL=

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
