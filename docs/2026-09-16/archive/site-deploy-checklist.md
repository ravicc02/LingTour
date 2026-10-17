# Culvoy Site Deployment Checklist

> ⚠️ **历史文档失真标注（2026-09-16）**：本文中的域名记载曾被 rebrand 提交 `9cb4eb0` 批量误替换——文中出现的 `culvoy.com` 族域名及其证书路径，在本文写作时均为 `lingfengtranstour.cn` 族。阅读时应按此理解，勿当作当时真实配置。

## Pre-deployment Checklist

### Build Verification
- [ ] `npm run build` succeeds with zero errors
- [ ] `npm run type-check` passes
- [ ] All static pages generated (check build output for count)
- [ ] No hydration warnings in build output

### Environment Variables
- [ ] `NEXT_PUBLIC_API_URL` points to production API (`https://api.culvoy.com/api/v1`)
- [ ] `NEXT_PUBLIC_SITE_URL` set to production domain
- [ ] All image URLs use production OSS/CDN paths
- [ ] `NEXT_PUBLIC_BASE_PATH` set correctly (empty string for root deployment)
- [ ] `NEXT_OUTPUT` not set unless standalone mode is required

### Build Modes (next.config.ts)
The site supports three output modes via environment variables:

| Variable | Value | Mode |
|---|---|---|
| `NEXT_OUTPUT=standalone` | `"standalone"` | Standalone Node server (Docker / PM2) |
| `NEXT_PHASE=phase-production-build` or `NEXT_BUILD=1` | `"export"` | Static HTML export (Cloudflare Pages / CDN) |
| _(neither set)_ | `undefined` | Standard Next.js build (SSR + ISR) |

Choose the correct mode for your deployment target before running the build.

### API Proxy (Rewrites)
The site proxies API calls via Next.js rewrites in `next.config.ts`:
- `/api/*` → `https://api.culvoy.com/api/*`
- `/uploads/*` → `https://api.culvoy.com/uploads/*`

Ensure the API origin is reachable from the deployment environment.

### Cache Strategy
- [ ] API responses: `Cache-Control: public, max-age=300, stale-while-revalidate=600`
- [ ] Static assets: Next.js handles with content-hash filenames
- [ ] Images: `unoptimized: true` in next.config (no Next.js image optimization)
- [ ] Cloudflare: Page rules for `/_next/static/*` with long cache TTL (1 year)

### Mobile-Specific Verification
- [ ] Hero title doesn't overflow at 375px
- [ ] Map section doesn't dominate viewport on mobile
- [ ] Carousel cards fit within viewport
- [ ] Shop collection descriptions visible without hover
- [ ] All touch targets ≥ 44px
- [ ] No horizontal overflow at any tested viewport (320px–428px)
- [ ] Navigation menu opens/closes correctly
- [ ] Language toggle accessible in mobile menu
- [ ] Interpretation pricing table doesn't overflow on mobile

### Post-deployment Smoke Test
1. Open production URL on phone
2. Check homepage loads in < 3s
3. Verify hero title, map, carousel all render
4. Navigate to /culture → /routes → /shop
5. Toggle language EN ↔ ZH
6. Open mobile menu, navigate to each section
7. Check /interpreting page pricing table doesn't overflow
8. Verify `/uploads/*` images load correctly (proxied through site)

### Data Sync Verification
Run the three-tier sync verification script:
```bash
node tools/three-tier-verify.mjs \
  --admin-url https://admin.culvoy.com \
  --site-url https://culvoy.com \
  --auth-token <admin-jwt-token>
```
This checks that data flows correctly from Admin → API → Site.

### Rollback Procedure
1. If using PM2: `pm2 restart site`
2. If using Docker: `docker-compose up -d --force-recreate site`
3. If using static export / CDN: redeploy previous artifact and purge cache
4. If using Cloudflare Pages: roll back to previous deployment in dashboard
5. Verify rollback with smoke test
