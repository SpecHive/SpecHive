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
# Production: serve compiled assets with a lightweight HTTP server
# ============================================================
FROM node:22-alpine AS production

ENV NODE_ENV=production

RUN addgroup -S assertly && adduser -S assertly -G assertly

# Use 'serve' to host the static dist folder
RUN npm install -g serve@14

WORKDIR /app

COPY --from=build /app/apps/dashboard/dist ./dist

RUN chown -R assertly:assertly /app

USER assertly

EXPOSE 5173

# serve on the same port Vite uses so no downstream config changes are needed
CMD ["serve", "-s", "dist", "-l", "5173"]
