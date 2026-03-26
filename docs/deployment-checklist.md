# Deployment Checklist

## Prerequisites

- Docker & Docker Compose v2
- A server with at least 2 GB RAM
- A domain name with DNS access
- TLS termination (platform-provided, or Caddy/nginx if self-hosting)

## 1. Generate Secrets

```bash
# PostgreSQL passwords
openssl rand -base64 32   # → POSTGRES_PASSWORD
openssl rand -base64 32   # → SPECHIVE_APP_PASSWORD
openssl rand -base64 32   # → OUTBOXY_PASSWORD

# Application secrets
openssl rand -base64 48   # → TOKEN_HASH_KEY (min 32 chars)
openssl rand -base64 48   # → WEBHOOK_SECRET (min 32 chars)
openssl rand -base64 96   # → JWT_SECRET (min 64 chars)

# MinIO credentials
openssl rand -hex 16      # → MINIO_ROOT_USER
openssl rand -base64 32   # → MINIO_ROOT_PASSWORD
openssl rand -hex 16      # → MINIO_APP_ACCESS_KEY
openssl rand -hex 32      # → MINIO_APP_SECRET_KEY
```

## 2. Configure DNS

Point these subdomains to your server:

| Subdomain               | Service                        |
| ----------------------- | ------------------------------ |
| `app.example.com`       | Dashboard                      |
| `api.example.com`       | Gateway (routes to all APIs)   |
| `artifacts.example.com` | MinIO (presigned URL endpoint) |

## 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and replace all placeholder values. For Docker Compose deployments, update hostnames from `localhost` to Docker service names (e.g., `postgres`, `redis`, `minio`) — see inline comments in `.env.example`. Pay attention to:

- `DATABASE_URL` password must match `SPECHIVE_APP_PASSWORD`
- `CORS_ORIGIN` must match the dashboard URL (e.g., `https://app.example.com`)
- `VITE_API_URL` must match the public gateway URL (e.g., `https://api.example.com`) — inlined at build time
- `MINIO_PUBLIC_ENDPOINT` must be reachable from end users' browsers

## 4. Start Services

```bash
docker compose up -d
```

The production `docker-compose.yml` handles migrations, MinIO bucket creation, and role restrictions automatically on first start.

## 5. Verify Health

```bash
# Wait ~30 seconds for startup, then check each service:
curl -f http://localhost:3000/health/ready   # gateway (public entry point)
curl -f http://localhost:8080/               # dashboard
```

All endpoints should return HTTP 200.

## 6. Create First Admin User

Open the dashboard in your browser and complete the registration flow. The first user becomes the organization owner.

## 7. Network Topology

| Service       | Port | Exposure          | Notes                                                             |
| ------------- | ---- | ----------------- | ----------------------------------------------------------------- |
| Gateway       | 3000 | **Public**        | Single API entry point — handles JWT auth, rate limiting, routing |
| Dashboard     | 8080 | **Public**        | Static SPA (or deploy to Cloudflare Pages / Vercel)               |
| ingestion-api | 3001 | **Internal only** | Receives events from reporters via gateway                        |
| worker        | 3002 | **Internal only** | Processes outbox events                                           |
| query-api     | 3003 | **Internal only** | Serves dashboard data via gateway                                 |
| PostgreSQL    | 5432 | **Internal only** |                                                                   |
| Redis         | 6379 | **Internal only** |                                                                   |
| MinIO         | 9000 | **Public**        | Presigned URL endpoint for artifact downloads                     |

**Security**: ingestion-api, query-api, and worker trust identity headers (`x-user-id`, `x-organization-id`) injected by the gateway. If these services are publicly accessible, anyone can forge these headers and bypass authentication. Use private networking (Docker internal network, Railway private network, VPC, etc.).

## 8. Backup Strategy

### PostgreSQL

```bash
# Daily backup via cron
0 2 * * * docker compose exec -T postgres pg_dump -U spechive spechive | gzip > /backups/spechive-$(date +\%Y\%m\%d).sql.gz
```

### MinIO

Use MinIO Client (`mc`) for bucket replication or backup:

```bash
mc alias set local http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD
mc mirror local/spechive-artifacts /backups/artifacts/
```

### Environment

Back up your `.env` file securely — it contains all secrets. Do not store it in version control.
