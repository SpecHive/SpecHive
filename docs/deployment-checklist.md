# Deployment Checklist

## Prerequisites

- Docker & Docker Compose v2
- A server with at least 2 GB RAM
- A domain name with DNS access
- A reverse proxy (nginx, Caddy, or Traefik) for TLS termination

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
| `api.example.com`       | Query API + Ingestion API      |
| `artifacts.example.com` | MinIO (presigned URL endpoint) |

## 3. Configure Environment

```bash
cp .env.production .env
```

Replace all `CHANGE_ME` values. Pay attention to:

- `DATABASE_URL` password must match `SPECHIVE_APP_PASSWORD`
- `CORS_ORIGIN` must match the dashboard URL (e.g., `https://app.example.com`)
- `VITE_API_URL` must match the public query-api URL (e.g., `https://api.example.com`)
- `MINIO_PUBLIC_ENDPOINT` must be reachable from end users' browsers
- `DASHBOARD_URL` is used for invite emails and links

## 4. Start Services

```bash
docker compose up -d
```

The production `docker-compose.yml` handles migrations, MinIO bucket creation, and role restrictions automatically on first start.

## 5. Verify Health

```bash
# Wait ~30 seconds for startup, then check each service:
curl -f http://localhost:3000/health/ready   # ingestion-api
curl -f http://localhost:3001/health/ready   # worker
curl -f http://localhost:3002/health/ready   # query-api
curl -f http://localhost:8080/               # dashboard
```

All endpoints should return HTTP 200.

## 6. Create First Admin User

Open the dashboard in your browser and complete the registration flow. The first user becomes the organization owner.

## 7. Configure Reverse Proxy

### Caddy (recommended)

```
app.example.com {
    reverse_proxy localhost:8080
}

api.example.com {
    handle /health/* {
        reverse_proxy localhost:3000
    }
    handle /api/v1/ingest/* {
        request_body {
            max_size 50MB
        }
        reverse_proxy localhost:3000
    }
    handle {
        reverse_proxy localhost:3002
    }
}

artifacts.example.com {
    reverse_proxy localhost:9000
}
```

### nginx

```nginx
server {
    listen 443 ssl;
    server_name app.example.com;

    ssl_certificate /etc/letsencrypt/live/app.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl;
    server_name api.example.com;

    ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    location /health/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/v1/ingest/ {
        proxy_pass http://localhost:3000;
        client_max_body_size 50m;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://localhost:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl;
    server_name artifacts.example.com;

    ssl_certificate /etc/letsencrypt/live/artifacts.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/artifacts.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:9000;
        proxy_set_header Host $host;
    }
}
```

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
