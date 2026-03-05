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

# VITE_API_URL is a build-time arg — Vite inlines it during compilation, not available at runtime
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=${VITE_API_URL}

RUN pnpm --filter @assertly/shared-types run build
RUN pnpm --filter @assertly/api-types run build
RUN pnpm --filter @assertly/dashboard run build

# ============================================================
# Production: serve compiled assets with nginx
# ============================================================
FROM nginxinc/nginx-unprivileged:1.27-alpine AS production

COPY --from=build /app/apps/dashboard/dist /usr/share/nginx/html
# Place config as a template — nginx-unprivileged auto-runs envsubst on /etc/nginx/templates/*.template at startup
COPY apps/dashboard/nginx.conf /etc/nginx/templates/default.conf.template

# Default value; override at runtime with -e VITE_API_URL=https://api.example.com
ENV VITE_API_URL=http://localhost:3000

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
