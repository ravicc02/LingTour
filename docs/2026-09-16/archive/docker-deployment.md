# Docker deployment notes

> ⚠️ **Historical distortion notice (2026-09-16):** Domain references in this document were mass-mis-replaced by rebrand commit `9cb4eb0` — at the time of writing, all `culvoy.com`-family domains were `lingfengtranstour.cn`-family domains (e.g. `api.lingfengtranstour.cn`). Read them accordingly; they are not the actual configuration of that period.

Culvoy currently runs in production via PM2. The Docker deployment files are prepared for the next migration/update path without interrupting the existing PM2 services.

## Files

- `docker-compose.prod.yml` — production Docker Compose stack for Postgres, API, site, admin, and nginx.
- `nginx.docker.conf` — container nginx config for public, admin, and API hostnames.
- `admin-frontend/Dockerfile` — admin frontend container image.
- `.env.production.example` — template for server-side `.env`; never commit real secrets.
- `tools/deploy-docker.sh` — safe Docker deploy script.
- `tools/deploy-pm2.sh` — current production PM2 deploy script until Docker is fully cut over.

## First-time server setup

```bash
ssh lingtour-server
cd /root/LingTour
cp .env.production.example .env
nano .env
```

Fill at least:

```bash
DB_PASSWORD=...
JWT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## Safe Docker trial

`docker-compose.prod.yml` binds nginx to host port `8088`, not `80/443`, so it can run beside the existing PM2/host nginx deployment.

```bash
cd /root/LingTour
bash tools/deploy-docker.sh
```

Smoke checks:

```bash
curl -H 'Host: culvoy.com' http://127.0.0.1:8088/
curl -H 'Host: admin.culvoy.com' http://127.0.0.1:8088/
curl -H 'Host: api.culvoy.com' http://127.0.0.1:8088/health
```

## Cutover options

Recommended cutover: keep the host-level HTTPS/Cloudflare setup, and point the host nginx upstreams to Docker nginx on `127.0.0.1:8088`. This avoids moving certificates into containers.

After cutover is verified, stop PM2 Culvoy apps:

```bash
pm2 stop lingtour-api lingtour-site lingtour-admin
pm2 save
```

Rollback:

```bash
pm2 start lingtour-api lingtour-site lingtour-admin
pm2 save
```

## Routine Docker updates after cutover

```bash
ssh lingtour-server 'cd /root/LingTour && bash tools/deploy-docker.sh'
```
