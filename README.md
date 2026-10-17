<p align="center">
  <img src="docs/assets/culvoy-logo.png" alt="Culvoy logo" width="160" />
</p>

# Culvoy · 岭风传译之旅

面向国际旅行者的广东文化旅行产品：城市文化、故事路线、陪同传译与预约、店铺与 PayPal 支付、社区，以及真实的运营/CMS 后台。

## 仓库结构

| 目录 | 应用 | 技术栈 | 说明 |
| --- | --- | --- | --- |
| `site/` | 公开站点 | Next.js 16 · React 19 · Tailwind CSS 4 · GSAP | 品牌优先的编辑式前台（Field Journal / Living Field Atlas） |
| `api/` | API | NestJS 11 · TypeORM · PostgreSQL · JWT · PayPal | 内容、预约、支付与运营接口 |
| `admin-frontend/` | 运营后台 | Vue 3 · Vite · Element Plus · GSAP | 聚焦工作流的 CMS 后台 |
| `docs/` | 文档 | — | 当前状态、设计基线、开发与发布规范 |
| `tools/` | 运维工具 | — | 部署与巡检脚本 |

> `admin-frontend/` 同时是**独立 Git 仓库**（根仓库也跟踪其文件，非 submodule）。提交时先提交独立仓库、再提交根仓库对应路径并保持逐字节一致，详见 [`docs/reference/development.md`](docs/reference/development.md)。

## 环境地址

| 环境 | 公开站点 | 运营后台 | API |
| --- | --- | --- | --- |
| 本地开发 | http://localhost:3000 | http://localhost:5173 | http://localhost:8000 |
| 生产 | https://culvoy.com | https://admin.culvoy.com | https://api.culvoy.com |

API 健康检查：生产 `https://api.culvoy.com/health`，本地 `http://localhost:8000/health`。

## 快速开始

```bash
# 1. 依赖（Node 20+，PostgreSQL 16）
cd site && npm ci --legacy-peer-deps
cd api && npm ci
cd admin-frontend && npm ci

# 2. 配置：按各端 example/env 文件准备本地环境变量（变量清单见 docs/reference/development.md）

# 3. 启动（三个终端）
cd site && npm run dev            # http://localhost:3000
cd admin-frontend && npm run dev  # http://localhost:5173
cd api && npm run start:dev       # http://localhost:8000
```

## 文档索引

| 文档 | 用途 |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | AI/开发者操作规范（必读）：工作流、硬约束、验证要求 |
| [`CHANGELOG.md`](CHANGELOG.md) | 当前更新、验证、发布、部署和回滚记录 |
| [`docs/reference/development.md`](docs/reference/development.md) | 环境搭建、分支规范、代码与提交规范、协作流程 |
| [`docs/reference/release.md`](docs/reference/release.md) | 发布流程、服务器与 PM2 配置、迁移与上线冒烟 |
| [`docs/CURRENT-STATE.md`](docs/CURRENT-STATE.md) | 已弃用的历史状态入口，仅指向归档和新记录规则 |
| [`PRODUCT.md`](PRODUCT.md) / [`DESIGN.md`](DESIGN.md) | 产品定位与设计语言 |
| [`docs/reference/RESPONSIVE-SPEC.md`](docs/reference/RESPONSIVE-SPEC.md) / [`docs/reference/UI-OVERHAUL-2026.md`](docs/reference/UI-OVERHAUL-2026.md) | 响应式与视觉改版基线 |
| [`docs/README.md`](docs/README.md) | 按日期整理的文档目录；每个日期独立一个文件夹 |
| `docs/2026-05-09/backend/`、`docs/2026-05-11/backend/` | 各业务域后端设计（文化 / 路线 / 传译 / 店铺） |
| `docs/YYYY-MM-DD/` | 历史 handoff、旧部署手册与过程文档（**非当前状态**） |

## 变更与发布

- 提交信息遵循 Conventional Commits，规范见 [`docs/reference/development.md`](docs/reference/development.md)。
- 版本与变更记录见 [`CHANGELOG.md`](CHANGELOG.md)；发布流程见 [`docs/reference/release.md`](docs/reference/release.md)。
- 未经明确授权，不执行 commit / push / 数据库迁移 / 部署 / 生产数据变更。
