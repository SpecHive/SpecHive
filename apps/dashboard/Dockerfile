# ============================================================
# Base: shared node + pnpm setup
# ============================================================
FROM node:22-alpine AS base

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# ============================================================
# Dependencies: install all workspace dependencies
# ============================================================
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/dashboard/package.json ./apps/dashboard/
COPY packages/typescript-config/package.json ./packages/typescript-config/

RUN pnpm install --frozen-lockfile

# ============================================================
# Development: Vite dev server with hot module replacement
# The dev compose override mounts sources and runs this target.
# ============================================================
FROM deps AS development

COPY . .

EXPOSE 5173

CMD ["node_modules/.bin/vite", "--host", "0.0.0.0", "--port", "5173"]

# ============================================================
# Build: compile static assets
# ============================================================
FROM deps AS build

COPY . .

# VITE_API_URL is a build-time arg — Vite inlines it during compilation, not available at runtime
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=${VITE_API_URL}

RUN pnpm --filter @assertly/dashboard run build

# ============================================================
# Production: serve compiled assets with nginx
# ============================================================
FROM nginx:1.27-alpine AS production

COPY --from=build /app/apps/dashboard/dist /usr/share/nginx/html
COPY apps/dashboard/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
