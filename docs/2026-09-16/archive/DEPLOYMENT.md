# Culvoy 部署与运维手册

> ⚠️ **历史文档失真标注（2026-09-16）**：本文中的域名记载曾被 rebrand 提交 `9cb4eb0` 批量误替换——文中出现的 `culvoy.com` / `api.culvoy.com` / `admin.culvoy.com` 及其证书路径，在本文写作时均为 `lingfengtranstour.cn` 族（如 `api.lingfengtranstour.cn`）。阅读时应按此理解，勿当作当时真实配置。

> 本文档覆盖 Culvoy 项目从零搭建到日常运维的完整流程。  
> 域名：`culvoy.com`（写作时为 `lingfengtranstour.cn`，见上方标注）
> 最后更新：2026-05-28

---

## 目录

1. [架构概览](#1-架构概览)
2. [环境变量](#2-环境变量)
3. [构建命令](#3-构建命令)
4. [部署步骤](#4-部署步骤)
5. [PM2 配置](#5-pm2-配置)
6. [Nginx 配置](#6-nginx-配置)
7. [Cloudflare 配置](#7-cloudflare-配置)
8. [缓存管理](#8-缓存管理)
9. [媒体文件管理](#9-媒体文件管理)
10. [数据库管理](#10-数据库管理)
11. [E2E 测试](#11-e2e-测试)
12. [故障排查](#12-故障排查)
13. [回滚流程](#13-回滚流程)
14. [安全检查清单](#14-安全检查清单)

---

## 1. 架构概览

### 1.1 三层架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Cloudflare CDN                          │
│                  (DNS / SSL / 缓存)                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      Nginx (80/443)                         │
│           反向代理 + 静态文件 + SSL 终止                      │
└─────┬──────────────────┬──────────────────┬─────────────────┘
      │                  │                  │
      ▼                  ▼                  ▼
┌───────────┐    ┌──────────────┐    ┌────────────────┐
│  API 层   │    │  Site 前台    │    │ Admin 后台     │
│  NestJS   │    │  Next.js 16  │    │ Vue 3 + Vite   │
│  :8000    │    │  :3000       │    │ :4173 (预览)    │
└─────┬─────┘    └──────────────┘    │ :5173 (开发)    │
      │                              └────────────────┘
      ▼
┌───────────┐
│ PostgreSQL │
│   :5432   │
└───────────┘
```

### 1.2 技术栈

| 层级 | 技术 | 端口 | 说明 |
|------|------|------|------|
| **API** | NestJS 11 + TypeORM + PostgreSQL | 8000 | 后端 API 服务 |
| **Site** | Next.js 16 (React 19) + Tailwind CSS | 3000 | 面向用户的前台网站 |
| **Admin** | Vue 3 + Element Plus + Vite | 4173/5173 | 管理后台 (SPA) |
| **数据库** | PostgreSQL 16 | 5432 | 主数据库 |
| **缓存** | Redis (可选) | 6379 | API 缓存层 |

### 1.3 域名规划

| 域名 | 指向 | 说明 |
|------|------|------|
| `culvoy.com` | Site (:3000) | 主站 |
| `www.culvoy.com` | → 301 到主域名 | 重定向 |
| `api.culvoy.com` | API (:8000) | API 服务 |
| `admin.culvoy.com` | Admin (:4173) | 管理后台 |

---

## 2. 环境变量

### 2.1 API 层 (`api/.env`)

```bash
# ─── 数据库 (必填) ───
DB_HOST=localhost          # 数据库主机
DB_PORT=5432               # 数据库端口
DB_USERNAME=lingtour       # 数据库用户名
DB_DATABASE=lingtour       # 数据库名
DB_PASSWORD=your_password  # 数据库密码

# ─── Redis (可选) ───
REDIS_HOST=localhost       # Redis 主机
REDIS_PORT=6379            # Redis 端口

# ─── JWT 认证 (必填) ───
JWT_SECRET=your-random-secret-string  # JWT 密钥 (至少 32 字符)
JWT_EXPIRATION=24h                     # Token 有效期

# ─── Stripe 支付 (可选) ───
STRIPE_SECRET_KEY=sk_live_xxx        # Stripe 密钥
STRIPE_PUBLISHABLE_KEY=pk_live_xxx   # Stripe 公钥
STRIPE_WEBHOOK_SECRET=whsec_xxx      # Stripe Webhook 密钥

# ─── 文件上传 (可选，有默认值) ───
UPLOAD_DIR=./uploads       # 上传目录
MAX_FILE_SIZE=10485760     # 最大文件大小 (10MB)

# ─── 应用配置 (可选，有默认值) ───
PORT=8000                  # API 监听端口
APP_URL=http://localhost:8000           # API 地址
FRONTEND_URL=http://localhost:3000      # 前台地址 (用于 CORS)
```

### 2.2 Site 前台 (`site/.env.local`)

```bash
# ─── 必填 ───
NEXT_PUBLIC_API_URL=/api/v1                    # API 路径 (相对路径用于 Nginx 代理)
# 或使用绝对路径: https://api.culvoy.com/api/v1

# ─── 可选 ───
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx # Stripe 公钥
NEXT_PUBLIC_BASE_PATH=                          # 子路径 (留空表示根路径)
NEXT_OUTPUT=standalone                         # 构建输出模式
```

### 2.3 Admin 后台 (`admin-frontend/.env`)

```bash
# ─── 可选 ───
VITE_API_ORIGIN=http://localhost:8000  # API 地址 (开发时使用)
# 生产环境通过 Nginx 反向代理，无需配置
```

### 2.4 E2E 测试 (`tools/.env`)

```bash
# ─── 必填 ───
LINGTOUR_API_BASE=http://localhost:3000/api/v1  # 测试目标 API 地址
LINGTOUR_ADMIN_EMAIL=admin@example.com          # 管理员邮箱
LINGTOUR_ADMIN_PASSWORD=your_password           # 管理员密码

# ─── 可选 ───
E2E_ALLOW_PROD=              # 设为 1 允许在生产环境运行 (默认拒绝)
```

### 2.5 Docker Compose (`.env`)

```bash
# ─── 必填 ───
DB_PASSWORD=your_db_password          # PostgreSQL 密码
JWT_SECRET=your-jwt-secret            # JWT 密钥

# ─── 可选 ───
STRIPE_SECRET_KEY=                    # Stripe 密钥
STRIPE_PUBLISHABLE_KEY=               # Stripe 公钥
STRIPE_WEBHOOK_SECRET=                # Stripe Webhook 密钥
```

---

## 3. 构建命令

### 3.1 API (NestJS)

```bash
cd api

# 安装依赖
npm ci

# 开发模式
npm run start:dev

# 生产构建
npm run build
# 输出: api/dist/

# 运行生产版本
npm run start:prod
# 等同于: node dist/main
```

### 3.2 Site (Next.js)

```bash
cd site

# 安装依赖
npm ci

# 开发模式
npm run dev

# 生产构建
NEXT_OUTPUT=standalone npm run build
# 输出: site/.next/standalone/ (独立模式)
# 输出: site/.next/static/ (静态资源)

# 运行生产版本
node .next/standalone/server.js
```

### 3.3 Admin (Vue + Vite)

```bash
cd admin-frontend

# 安装依赖
npm ci

# 开发模式
npm run dev
# 监听端口: 5173

# 生产构建
npm run build
# 输出: admin-frontend/dist/

# 预览生产版本
npm run preview
# 监听端口: 4173
```

---

## 4. 部署步骤

### 4.1 全新部署 (从零开始)

#### 4.1.1 系统要求

- Node.js >= 20 (推荐 20 LTS)
- PostgreSQL >= 16
- Nginx
- PM2 (`npm install -g pm2`)
- Git

#### 4.1.2 服务器初始化

```bash
# 1. 安装 Node.js 20 (使用 nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# 2. 安装 PM2
npm install -g pm2

# 3. 安装 PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql

# 4. 创建数据库和用户
sudo -u postgres psql
CREATE USER lingtour WITH PASSWORD 'your_secure_password';
CREATE DATABASE lingtour OWNER lingtour;
GRANT ALL PRIVILEGES ON DATABASE lingtour TO lingtour;
\q

# 5. 安装 Nginx
sudo apt install nginx
sudo systemctl enable nginx
```

#### 4.1.3 部署代码

```bash
# 1. 克隆仓库
cd /var/www
git clone <your-repo-url> lingtour
cd lingtour

# 2. 配置环境变量
cp api/.env.example api/.env
# 编辑 api/.env 填入实际值
nano api/.env

# 3. 安装依赖并构建 API
cd api
npm ci
npm run build
cd ..

# 4. 安装依赖并构建 Site
cd site
npm ci
NEXT_OUTPUT=standalone npm run build
cd ..

# 5. 安装依赖并构建 Admin
cd admin-frontend
npm ci
npm run build
cd ../../..

# 6. 运行数据库迁移
cd api
npx typeorm migration:run -d dist/database/data-source.js
cd ..

# 7. (可选) 导入初始数据
cd api
npm run seed:assets   # 下载种子资源
npm run seed:reset    # 导入种子数据
cd ..
```

#### 4.1.4 配置 PM2 并启动

```bash
# 使用 ecosystem 配置文件启动 (见第 5 节)
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # 设置开机自启
```

#### 4.1.5 配置 Nginx

```bash
# 复制 Nginx 配置 (见第 6 节)
sudo cp nginx.conf /etc/nginx/sites-available/lingtour
sudo ln -s /etc/nginx/sites-available/lingtour /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 4.1.6 配置 SSL (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d culvoy.com -d www.culvoy.com \
  -d api.culvoy.com -d admin.culvoy.com
```

### 4.2 更新部署 (仅代码变更)

```bash
cd /var/www/lingtour

# 1. 拉取最新代码
git pull origin main

# 2. 更新 API
cd api
npm ci
npm run build
# 运行新增的迁移
npx typeorm migration:run -d dist/database/data-source.js
cd ..
pm2 restart lingtour-api

# 3. 更新 Site
cd site
npm ci
NEXT_OUTPUT=standalone npm run build
cd ..
pm2 restart lingtour-site

# 4. 更新 Admin
cd admin-frontend
npm ci
npm run build
cd ../../..
# Admin 是静态文件，无需重启，刷新浏览器即可

# 5. 验证
curl -s http://localhost:8000/health
# 期望: {"status":"ok","database":"up","timestamp":"..."}
```

### 4.3 数据库迁移

```bash
cd /var/www/lingtour/api

# 查看迁移状态
npx typeorm migration:show -d dist/database/data-source.js

# 运行待执行的迁移
npx typeorm migration:run -d dist/database/data-source.js

# 回滚最近一次迁移
npx typeorm migration:revert -d dist/database/data-source.js
```

---

## 5. PM2 配置

### 5.1 ecosystem.config.js

在项目根目录创建 `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'lingtour-api',
      script: 'dist/main.js',
      cwd: '/var/www/lingtour/api',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 8000,
      },
      env_file: '/var/www/lingtour/api/.env',
      max_memory_restart: '512M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/www/lingtour/logs/api-error.log',
      out_file: '/var/www/lingtour/logs/api-out.log',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 5000,
    },
    {
      name: 'lingtour-site',
      script: 'server.js',
      cwd: '/var/www/lingtour/site/.next/standalone',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
      },
      max_memory_restart: '512M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/www/lingtour/logs/site-error.log',
      out_file: '/var/www/lingtour/logs/site-out.log',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
```

### 5.2 PM2 常用命令

```bash
# 启动所有服务
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs                    # 所有日志
pm2 logs lingtour-api       # 仅 API 日志
pm2 logs lingtour-site      # 仅 Site 日志
pm2 logs --lines 100        # 最近 100 行

# 重启服务
pm2 restart lingtour-api
pm2 restart lingtour-site
pm2 restart all

# 停止服务
pm2 stop lingtour-api
pm2 stop all

# 删除服务
pm2 delete lingtour-api
pm2 delete all

# 保存当前进程列表 (用于开机自启)
pm2 save

# 设置开机自启
pm2 startup
pm2 save

# 监控面板
pm2 monit

# 查看详细信息
pm2 show lingtour-api
```

### 5.3 日志目录

创建日志目录:

```bash
mkdir -p /var/www/lingtour/logs
```

---

## 6. Nginx 配置

### 6.1 生产环境配置

将以下内容保存为 `/etc/nginx/sites-available/lingtour`:

```nginx
# ─── 上游服务 ─────────────────────────────────────────────────────
upstream api_backend {
    server 127.0.0.1:8000;
    keepalive 32;
}

upstream site_frontend {
    server 127.0.0.1:3000;
    keepalive 32;
}

# ─── 限流配置 ─────────────────────────────────────────────────────
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=upload_limit:10m rate=5r/s;

# ─── 主站 (culvoy.com) ─────────────────────────────────
server {
    listen 80;
    server_name culvoy.com www.culvoy.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name culvoy.com www.culvoy.com;

    # SSL 证书 (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/culvoy.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/culvoy.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # 上传文件大小限制
    client_max_body_size 20M;

    # 静态上传文件 (直接由 Nginx 服务)
    location /uploads/ {
        alias /var/www/lingtour/api/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # API 请求转发
    location /api/ {
        limit_req zone=api_limit burst=50 nodelay;
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 10s;
        proxy_read_timeout 60s;
    }

    # Stripe Webhook (需要原始请求体)
    location /api/v1/orders/webhook/stripe {
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_request_buffering off;
    }

    # Next.js 前台
    location / {
        proxy_pass http://site_frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # www 重定向
    if ($host = www.culvoy.com) {
        return 301 https://culvoy.com$request_uri;
    }
}

# ─── API 域名 (api.culvoy.com) ─────────────────────────
server {
    listen 80;
    server_name api.culvoy.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.culvoy.com;

    ssl_certificate /etc/letsencrypt/live/culvoy.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/culvoy.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 20M;

    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        limit_req zone=api_limit burst=50 nodelay;
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        alias /var/www/lingtour/api/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
}

# ─── 管理后台 (admin.culvoy.com) ───────────────────────
server {
    listen 80;
    server_name admin.culvoy.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name admin.culvoy.com;

    ssl_certificate /etc/letsencrypt/live/culvoy.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/culvoy.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 20M;

    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Admin 静态文件
    root /var/www/lingtour/admin-frontend/dist;
    index index.html;

    # Admin API 代理
    location /api/admin/ {
        rewrite ^/api/admin/(.*)$ /api/v1/admin/$1 break;
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/admin/auth {
        rewrite ^/api/admin/auth(.*)$ /api/v1/auth$1 break;
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA 路由回退
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
}
```

### 6.2 启用配置

```bash
# 创建符号链接
sudo ln -sf /etc/nginx/sites-available/lingtour /etc/nginx/sites-enabled/

# 删除默认配置 (可选)
sudo rm -f /etc/nginx/sites-enabled/default

# 测试配置
sudo nginx -t

# 重载配置
sudo systemctl reload nginx
```

### 6.3 Docker Compose 模式下的 Nginx

使用项目自带的 `nginx.conf` (位于项目根目录):

```bash
docker-compose up -d
```

此模式下 Nginx 以容器方式运行，配置文件通过 volume 挂载。

---

## 7. Cloudflare 配置

### 7.1 DNS 记录

在 Cloudflare DNS 设置中添加以下记录:

| 类型 | 名称 | 内容 | 代理状态 |
|------|------|------|----------|
| A | `culvoy.com` | `<服务器 IP>` | 已代理 (橙色云朵) |
| A | `api` | `<服务器 IP>` | 已代理 (橙色云朵) |
| A | `admin` | `<服务器 IP>` | 已代理 (橙色云朵) |
| CNAME | `www` | `culvoy.com` | 已代理 (橙色云朵) |

### 7.2 SSL/TLS 配置

- **SSL 模式**: `Full (Strict)` — Cloudflare 与源站之间也使用 HTTPS
- **最低 TLS 版本**: TLS 1.2
- **HSTS**: 启用，`max-age=31536000; includeSubDomains`
- **自动 HTTPS 重写**: 启用

### 7.3 页面规则 (Page Rules)

| 规则 | URL 匹配 | 设置 |
|------|----------|------|
| 静态资源缓存 | `culvoy.com/uploads/*` | Cache Level: Cache Everything, Edge Cache TTL: 1 month |
| API 不缓存 | `api.culvoy.com/*` | Cache Level: Bypass |
| Admin 不缓存 | `admin.culvoy.com/*` | Cache Level: Bypass |
| 前台缓存 | `culvoy.com/*` | Cache Level: Standard, Browser Cache TTL: 4 hours |

### 7.4 缓存规则 (Cache Rules)

推荐在 Cloudflare Dashboard > Rules > Cache Rules 中配置:

```
规则 1: 绕过 API 请求
  表达式: (http.host eq "api.culvoy.com")
  操作: Bypass cache

规则 2: 绕过 Admin 请求
  表达式: (http.host eq "admin.culvoy.com")
  操作: Bypass cache

规则 3: 缓存静态上传文件
  表达式: (http.host eq "culvoy.com" and starts_with(http.request.uri.path, "/uploads/"))
  操作: Eligible for cache, Edge TTL: 1 month
```

---

## 8. 缓存管理

### 8.1 缓存层级

```
浏览器缓存
    │
    ▼
Cloudflare CDN 缓存
    │
    ▼
Nginx 缓存 (静态文件)
    │
    ▼
API 内存缓存 (@nestjs/cache-manager)
    │
    ▼
Redis 缓存 (可选)
```

### 8.2 何时需要清除缓存

| 场景 | 需要清除的缓存 |
|------|----------------|
| 更新了 API 代码 | 无需清除缓存 (重启 PM2 即可) |
| 更新了 Site 代码 | 清除 Cloudflare 缓存 + 浏览器缓存 |
| 更新了 Admin 代码 | 浏览器强制刷新 (Ctrl+Shift+R) |
| 修改了上传文件 | 清除 Cloudflare 缓存 |
| 数据库数据变更 | API 缓存会自动过期，或重启 API |
| 域名/SSL 变更 | 清除 Cloudflare 缓存 |

### 8.3 清除缓存的方法

#### Cloudflare 缓存

```bash
# 方法 1: 通过 Cloudflare Dashboard
# 进入 Dashboard > Caching > Configuration > Purge Cache

# 方法 2: 通过 API
CF_ZONE_ID="your_zone_id"
CF_API_TOKEN="your_api_token"

# 清除全部缓存
curl -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'

# 清除指定 URL
curl -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://culvoy.com/uploads/example.jpg"]}'
```

#### 浏览器缓存

- **Chrome**: `Ctrl+Shift+R` (Windows) / `Cmd+Shift+R` (Mac)
- **或**: 打开 DevTools > Network > 勾选 "Disable cache" > 刷新

#### API 缓存

```bash
# 重启 API 服务清除内存缓存
pm2 restart lingtour-api
```

### 8.4 强制页面刷新

在 Next.js 中，可以通过以下方式确保用户获取最新内容:

```typescript
// 在 API 请求中添加时间戳参数
const res = await fetch(`/api/v1/cities?t=${Date.now()}`);
```

---

## 9. 媒体文件管理

### 9.1 上传目录结构

```
api/uploads/
├── cities/          # 城市相关图片
├── routes/          # 路线相关图片
├── products/        # 商品图片
├── events/          # 活动图片
├── collections/     # 系列图片
├── interpreting/    # 口译服务图片
├── community/       # 社区帖子图片
├── home/            # 首页图片
└── general/         # 通用上传
```

### 9.2 备份策略

```bash
#!/bin/bash
# backup-media.sh - 媒体文件备份脚本

BACKUP_DIR="/var/backups/lingtour/media"
SOURCE_DIR="/var/www/lingtour/api/uploads"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# 增量备份 (使用 rsync)
rsync -avz --delete "$SOURCE_DIR/" "$BACKUP_DIR/latest/"

# 创建压缩包 (每周一次)
if [ "$(date +%u)" = "1" ]; then
    tar -czf "$BACKUP_DIR/media_$DATE.tar.gz" -C "$SOURCE_DIR" .
    # 保留最近 4 周的压缩包
    ls -t "$BACKUP_DIR"/media_*.tar.gz | tail -n +5 | xargs -r rm
fi

echo "[$(date)] Media backup completed"
```

添加到 crontab:

```bash
# 每天凌晨 3 点执行备份
0 3 * * * /var/www/lingtour/scripts/backup-media.sh >> /var/www/lingtour/logs/backup.log 2>&1
```

### 9.3 孤立文件清理

```bash
#!/bin/bash
# cleanup-orphan-media.sh - 清理未被数据库引用的媒体文件

# 此脚本需要根据实际数据库查询来实现
# 基本思路:
# 1. 从数据库中提取所有引用的文件名
# 2. 对比 uploads 目录中的实际文件
# 3. 删除未被引用的文件

# 示例 (需要连接数据库):
# psql -U lingtour -d lingtour -t -c "
#   SELECT DISTINCT unnest(
#     ARRAY[heroImage, coverImage, image] ||
#     galleryImages || foodImages
#   ) FROM cities WHERE deletedAt IS NULL
#   UNION
#   SELECT DISTINCT unnest(ARRAY[image, coverImage]) FROM routes WHERE deletedAt IS NULL
#   UNION
#   SELECT DISTINCT unnest(ARRAY[image]) FROM products WHERE deletedAt IS NULL;
# " > /tmp/referenced_files.txt

# 然后对比实际文件:
# find /var/www/lingtour/api/uploads -type f | while read file; do
#   filename=$(basename "$file")
#   if ! grep -q "$filename" /tmp/referenced_files.txt; then
#     echo "Orphan: $file"
#     # rm "$file"  # 取消注释以实际删除
#   fi
# done

echo "Orphan file cleanup - review and run manually"
```

---

## 10. 数据库管理

### 10.1 TypeORM 迁移命令

```bash
cd /var/www/lingtour/api

# 查看所有迁移状态
npx typeorm migration:show -d dist/database/data-source.js

# 运行所有待执行的迁移
npx typeorm migration:run -d dist/database/data-source.js

# 回滚最近一次迁移
npx typeorm migration:revert -d dist/database/data-source.js

# 生成新迁移 (开发环境)
npx typeorm migration:generate src/database/migrations/MigrationName -d src/database/data-source.ts
```

### 10.2 迁移文件列表

当前项目包含以下迁移 (按执行顺序):

| 迁移文件 | 说明 |
|----------|------|
| `1737000000000-InitialSchema` | 初始数据库结构 |
| `1737100000000-AddHomeSettingsCommunity` | 首页设置与社区功能 |
| `1737105000000-AddEvents` | 活动模块 |
| `1737110000000-AdminCmsFields` | Admin CMS 字段 |
| `1737200000000-AddRelatedCitySlugsToCities` | 城市关联 |
| `1737215000000-UserProfilesAndCommunityLinks` | 用户档案与社区链接 |
| `1737220000000-CommunityPostReactions` | 社区帖子互动 |
| `1737225000000-RouteRegionsAndAssignments` | 路线区域与分配 |
| `1740600000000-FixRouteRegionsEncoding` | 修复路线区域编码 |
| `1751100000000-AddAuditLogs` | 审计日志 |
| `1751200000000-AddImagesArrayToStops` | 站点图片数组 |
| `1751200000001-AddImagesArrayToCitySections` | 城市区块图片数组 |
| `1751300000000-EnhanceAuditLogs` | 增强审计日志 |
| `1751400000000-AddMediaLibrary` | 媒体库 |

### 10.3 数据库备份

```bash
#!/bin/bash
# backup-db.sh - 数据库备份脚本

BACKUP_DIR="/var/backups/lingtour/db"
mkdir -p "$BACKUP_DIR"
DATE=$(date +%Y%m%d_%H%M%S)

# 完整备份
pg_dump -U lingtour -h localhost lingtour \
  --format=custom \
  --compress=9 \
  --file="$BACKUP_DIR/lingtour_$DATE.dump"

# SQL 文本备份 (便于查看)
pg_dump -U lingtour -h localhost lingtour \
  --format=plain \
  --file="$BACKUP_DIR/lingtour_$DATE.sql"

# 压缩 SQL
gzip "$BACKUP_DIR/lingtour_$DATE.sql"

# 保留最近 30 天的备份
find "$BACKUP_DIR" -name "lingtour_*.dump" -mtime +30 -delete
find "$BACKUP_DIR" -name "lingtour_*.sql.gz" -mtime +30 -delete

echo "[$(date)] Database backup completed: lingtour_$DATE"
```

添加到 crontab:

```bash
# 每天凌晨 2 点执行数据库备份
0 2 * * * /var/www/lingtour/scripts/backup-db.sh >> /var/www/lingtour/logs/backup-db.log 2>&1
```

### 10.4 数据库恢复

```bash
# 从 .dump 文件恢复
pg_restore -U lingtour -h localhost -d lingtour --clean --if-exists \
  /var/backups/lingtour/db/lingtour_20260528_020000.dump

# 从 .sql 文件恢复
psql -U lingtour -h localhost -d lingtour \
  < /var/backups/lingtour/db/lingtour_20260528_020000.sql
```

### 10.5 种子数据

```bash
cd /var/www/lingtour/api

# 下载种子资源 (图片等)
npm run seed:assets

# 重置并导入种子数据
npm run seed:reset
```

> **注意**: `seed:reset` 会清除现有数据，请仅在开发/测试环境使用。

---

## 11. E2E 测试

### 11.1 运行 E2E 测试

```bash
cd /var/www/lingtour

# 1. 配置测试环境变量
cp tools/.env.example tools/.env
# 编辑 tools/.env 填入实际值
nano tools/.env

# 2. 运行测试
node tools/admin-api-e2e.mjs

# 3. 试运行 (不实际执行请求)
node tools/admin-api-e2e.mjs --dry-run
```

### 11.2 必需的环境变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `LINGTOUR_API_BASE` | API 基础地址 | `http://localhost:3000/api/v1` |
| `LINGTOUR_ADMIN_EMAIL` | 管理员邮箱 | `admin@example.com` |
| `LINGTOUR_ADMIN_PASSWORD` | 管理员密码 | `your_password` |

### 11.3 安全防护

脚本内置了以下安全机制:

1. **环境变量检查**: 缺少必需变量时立即退出
2. **生产环境保护**: 默认拒绝在非 localhost 环境运行
3. **生产环境白名单**: 需显式设置 `E2E_ALLOW_PROD=1` 才能在生产环境运行
4. **数据清理**: 测试创建的数据会在测试结束后自动删除

```bash
# 安全防护逻辑:
# - URL 包含 "culvoy.com" → 拒绝 (生产环境)
# - URL 不包含 "localhost" 且不包含 "127.0.0.1" → 拒绝
# - 设置 E2E_ALLOW_PROD=1 可覆盖
```

### 11.4 测试覆盖范围

E2E 测试覆盖以下模块的 CRUD 操作:

- 城市 (Cities)
- 路线 (Routes)
- 系列 (Collections)
- 商品 (Products)
- 活动 (Events)
- 服务模式 (Modes)
- 口译员档案 (Profiles)
- 常见问题 (FAQs)
- 社区帖子 (Community Posts)
- 社区任务 (Community Briefs)
- 用户管理 (Users)
- 首页配置 (Home)
- 系统设置 (Settings)
- 媒体上传 (Media)
- 预约 (Bookings)
- 订单 (Orders)

### 11.5 输出格式

测试结果以 JSON 格式输出:

```json
{
  "target": "http://localhost:3000/api/v1",
  "dryRun": false,
  "failedCount": 0,
  "results": [
    { "module": "cities", "action": "create", "ok": true, "detail": 123 },
    { "module": "cities", "action": "update", "ok": true, "detail": "..." },
    { "module": "cities", "action": "delete", "ok": true, "detail": "..." }
  ]
}
```

---

## 12. 故障排查

### 12.1 健康检查端点

| 端点 | 说明 | 期望响应 |
|------|------|----------|
| `GET /health` | API 健康检查 | `{"status":"ok","database":"up"}` |
| `GET /` | Site 首页 | 200 HTML |
| `GET /api/docs` | Swagger 文档 | 200 HTML |

### 12.2 常见问题

#### API 无法启动

```bash
# 检查日志
pm2 logs lingtour-api --lines 50

# 常见原因:
# 1. 数据库连接失败
#    → 检查 DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD
#    → 确认 PostgreSQL 服务正在运行

# 2. 端口被占用
#    → lsof -i :8000
#    → kill -9 <PID>

# 3. 环境变量缺失
#    → 检查 api/.env 文件是否存在且配置正确
```

#### Site 无法启动

```bash
# 检查日志
pm2 logs lingtour-site --lines 50

# 常见原因:
# 1. standalone 目录不存在
#    → 重新构建: cd site && NEXT_OUTPUT=standalone npm run build

# 2. 端口被占用
#    → lsof -i :3000
```

#### Nginx 502 Bad Gateway

```bash
# 检查上游服务是否运行
pm2 status

# 检查端口监听
ss -tlnp | grep -E '8000|3000'

# 检查 Nginx 错误日志
sudo tail -f /var/log/nginx/error.log

# 测试 Nginx 配置
sudo nginx -t
```

#### 数据库连接失败

```bash
# 测试数据库连接
psql -U lingtour -h localhost -d lingtour -c "SELECT 1;"

# 检查 PostgreSQL 状态
sudo systemctl status postgresql

# 检查 pg_hba.conf (认证配置)
sudo cat /etc/postgresql/*/main/pg_hba.conf
```

#### 上传文件失败

```bash
# 检查上传目录权限
ls -la /var/www/lingtour/api/uploads/

# 确保目录可写
chmod -R 755 /var/www/lingtour/api/uploads/
chown -R www-data:www-data /var/www/lingtour/api/uploads/

# 检查 Nginx 文件大小限制
grep client_max_body_size /etc/nginx/sites-available/lingtour
```

#### Cloudflare SSL 错误

```bash
# 确保 Cloudflare SSL 模式为 "Full (Strict)"
# 确保源站证书有效
sudo certbot certificates

# 手动续期证书
sudo certbot renew --dry-run
```

### 12.3 日志位置

| 服务 | 日志路径 |
|------|----------|
| API (PM2) | `/var/www/lingtour/logs/api-out.log` |
| API 错误 | `/var/www/lingtour/logs/api-error.log` |
| Site (PM2) | `/var/www/lingtour/logs/site-out.log` |
| Site 错误 | `/var/www/lingtour/logs/site-error.log` |
| Nginx 访问 | `/var/log/nginx/access.log` |
| Nginx 错误 | `/var/log/nginx/error.log` |
| PostgreSQL | `/var/log/postgresql/postgresql-*-main.log` |
| 数据库备份 | `/var/www/lingtour/logs/backup-db.log` |
| 媒体备份 | `/var/www/lingtour/logs/backup.log` |

### 12.4 调试技巧

```bash
# 实时查看 API 日志
pm2 logs lingtour-api --lines 100

# 实时查看 Nginx 访问日志
sudo tail -f /var/log/nginx/access.log

# 监控服务器资源
pm2 monit
htop

# 检查数据库慢查询
sudo -u postgres psql -d lingtour -c "
  SELECT query, calls, mean_exec_time, total_exec_time
  FROM pg_stat_statements
  ORDER BY mean_exec_time DESC
  LIMIT 10;
"

# 检查数据库连接数
sudo -u postgres psql -d lingtour -c "
  SELECT count(*) FROM pg_stat_activity WHERE datname = 'lingtour';
"
```

---

## 13. 回滚流程

### 13.1 代码回滚

```bash
cd /var/www/lingtour

# 1. 查看最近的提交
git log --oneline -10

# 2. 回滚到指定版本
git checkout <commit-hash>

# 3. 重新构建 API
cd api
npm ci
npm run build
cd ..
pm2 restart lingtour-api

# 4. 重新构建 Site
cd site
npm ci
NEXT_OUTPUT=standalone npm run build
cd ..
pm2 restart lingtour-site

# 5. 重新构建 Admin
cd admin-frontend
npm ci
npm run build
cd ../../..

# 6. 验证
curl -s http://localhost:8000/health
```

### 13.2 数据库回滚

```bash
cd /var/www/lingtour/api

# 方法 1: 使用 TypeORM 回滚迁移
npx typeorm migration:revert -d dist/database/data-source.js
# 可多次执行以回滚多个迁移

# 方法 2: 从备份恢复 (更安全)
# 停止 API 服务
pm2 stop lingtour-api

# 恢复数据库
pg_restore -U lingtour -h localhost -d lingtour --clean --if-exists \
  /var/backups/lingtour/db/lingtour_YYYYMMDD_HHMMSS.dump

# 重启 API 服务
pm2 start lingtour-api
```

### 13.3 完整回滚检查清单

- [ ] 代码已回滚到目标版本
- [ ] API 已重新构建并重启
- [ ] Site 已重新构建并重启
- [ ] Admin 已重新构建
- [ ] 数据库迁移已回滚 (如需要)
- [ ] 健康检查通过 (`/health`)
- [ ] 前台页面可访问
- [ ] 管理后台可访问
- [ ] API 文档可访问 (`/api/docs`)
- [ ] 上传文件功能正常
- [ ] Cloudflare 缓存已清除 (如需要)

---

## 14. 安全检查清单

### 14.1 JWT 密钥轮换

```bash
# 1. 生成新的 JWT 密钥
NEW_SECRET=$(openssl rand -base64 64)

# 2. 更新 api/.env
sed -i "s/JWT_SECRET=.*/JWT_SECRET=$NEW_SECRET/" /var/www/lingtour/api/.env

# 3. 重启 API (所有现有 token 将立即失效)
pm2 restart lingtour-api

# 4. 通知用户重新登录
```

### 14.2 CORS 配置

API 的 CORS 配置位于 NestJS 代码中，确保只允许以下来源:

```
- https://culvoy.com
- https://www.culvoy.com
- https://admin.culvoy.com
- http://localhost:5173 (仅开发环境)
- http://localhost:3000 (仅开发环境)
```

### 14.3 速率限制

Nginx 层面已配置:

```nginx
# API 请求限流: 每秒 30 个请求，允许突发 50 个
limit_req zone=api_limit burst=50 nodelay;

# 上传请求限流: 每秒 5 个请求
limit_req zone=upload_limit burst=10 nodelay;
```

API 层面使用 `@nestjs/throttler`，在代码中配置。

### 14.4 上传安全

| 安全措施 | 说明 |
|----------|------|
| 文件大小限制 | Nginx: `client_max_body_size 20M`，API: `MAX_FILE_SIZE=10485760` (10MB) |
| 文件类型检查 | API 代码中验证 MIME 类型 |
| 文件名处理 | 使用 UUID 重命名，防止路径遍历 |
| 存储隔离 | 按模块分目录存储 |
| 访问控制 | 上传接口需要 JWT 认证 |

### 14.5 安全头

Nginx 已配置以下安全头:

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### 14.6 定期安全检查

```bash
# 1. 检查 Node.js 安全漏洞
cd /var/www/lingtour/api && npm audit
cd /var/www/lingtour/site && npm audit

# 2. 检查 SSL 证书有效期
sudo certbot certificates

# 3. 检查数据库密码强度
# 确保密码至少 16 字符，包含大小写字母、数字和特殊字符

# 4. 检查服务器防火墙
sudo ufw status

# 5. 检查系统更新
sudo apt update && sudo apt list --upgradable
```

### 14.7 防火墙配置

```bash
# 启用防火墙
sudo ufw enable

# 允许必要端口
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# 如果使用 Docker，允许内部通信
sudo ufw allow from 172.16.0.0/12

# 查看状态
sudo ufw status verbose
```

---

## 附录 A: 快速参考

### 常用命令速查

```bash
# ─── 服务管理 ───
pm2 status                           # 查看所有服务状态
pm2 restart lingtour-api             # 重启 API
pm2 restart lingtour-site            # 重启 Site
pm2 logs --lines 50                  # 查看最近日志

# ─── 数据库 ───
npx typeorm migration:run -d dist/database/data-source.js    # 运行迁移
npx typeorm migration:show -d dist/database/data-source.js   # 查看迁移状态
pg_dump -U lingtour lingtour > backup.sql                     # 备份数据库

# ─── 构建 ───
cd api && npm run build              # 构建 API
cd site && NEXT_OUTPUT=standalone npm run build  # 构建 Site
cd admin-frontend && npm run build  # 构建 Admin

# ─── 健康检查 ───
curl -s http://localhost:8000/health  # API 健康检查
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000  # Site 状态

# ─── SSL ───
sudo certbot renew --dry-run         # 测试证书续期
sudo certbot renew                   # 续期证书
sudo nginx -t                        # 测试 Nginx 配置
sudo systemctl reload nginx          # 重载 Nginx
```

### Docker Compose 快速启动

```bash
# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 JWT_SECRET 和 DB_PASSWORD

# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止所有服务
docker-compose down

# 停止并删除数据卷 (危险!)
docker-compose down -v
```

---

## 附录 B: 联系与支持

- **代码仓库**: `<your-repo-url>`
- **域名注册**: Cloudflare
- **服务器**: `<your-server-provider>`
- **SSL 证书**: Let's Encrypt (自动续期)

---

> **文档维护**: 每次部署流程变更时请同步更新本文档。
