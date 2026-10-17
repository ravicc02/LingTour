# 开发指南

本地开发、分支、代码规范、提交规范与协作流程。操作硬约束（工作区保护、数据规则、禁止命令）见 [`../../AGENTS.md`](../../AGENTS.md)；发布与服务器见 [`release.md`](release.md)。

## 1. 环境搭建

### 基础依赖

- Node.js **20**（CI 按 Node 20 运行）
- PostgreSQL **16**
- npm（三端各自独立安装依赖）

### 安装

```bash
cd site && npm ci --legacy-peer-deps
cd api && npm ci
cd admin-frontend && npm ci
```

> 根目录 `package.json` 仅有少量工具依赖，通常无需安装；需要根级工具时再单独 `npm ci`。

### 环境变量

文档只列变量名；取值放在本地 env 文件，**绝不写入文档、提交或日志**。

| 端 | 文件 | 变量 |
| --- | --- | --- |
| site | `site/.env.local` | `NEXT_PUBLIC_API_URL`、`INTERNAL_API_ORIGIN`（独立部署另需 `NEXT_OUTPUT`） |
| admin | `admin-frontend/.env.local` | `VITE_API_ORIGIN`、`VITE_SITE_ORIGIN` 或 `VITE_SITE_PREVIEW_ORIGIN`、`VITE_MEDIA_ORIGIN` |
| api | `api/.env` | 数据库 `DB_*`、`JWT_SECRET`、PayPal 与媒体存储等；完整清单见仓库根目录 `.env.production.example` |

本地默认口径：site 经同源代理 `/api/v1` → `http://127.0.0.1:8000`；admin 经 Vite/Nginx 把 `/api/admin` 重写为 `/api/v1/admin`。**改动该代理契约属于破坏性变更。**

### 启动

**默认方式：本地 Docker 三端**（2026-09-17 起）。前提：Docker Desktop 在运行、本地 PostgreSQL（宿主机 5432）可用且 `api/.env` 指向它。

```bash
docker compose up -d --build      # site http://localhost:3000 / admin http://localhost:5173 / api http://localhost:8000
docker compose ps                 # 三容器应均为 healthy
docker compose logs -f api        # 排查单个服务
docker compose down               # 停止（加 -v 会连卷删除，谨慎）
```

要点：

- api 容器经 `host.docker.internal:5432` 复用宿主机本地 PostgreSQL 与迁移状态（配置来自 `api/.env`，compose 只覆盖 `DB_HOST`）；上传目录 bind mount 到 `api/uploads`。
- site 浏览器端请求 `http://localhost:8000/api/v1`（构建期注入），SSR 端走容器网络 `http://api:8000/api/v1`；admin 的 `/api/admin` 由其 `server.cjs` 代理到 api 容器。
- **容器跑的是构建产物，不是热更新 dev server**：改代码后需要 `docker compose up -d --build site`（或 admin/api）重建对应镜像；`--build` 会把工作区当前文件（含未提交改动）打进镜像，重建前先确认工作区状态。
- **只跑 Docker，不在宿主机启动 dev server**（2026-09-18 硬性决定，此前"高频迭代可退回 npm dev"的口径作废）：宿主机 `npm run dev` / `npm run start:dev` 占用 3000/5173/8000，会把映射同名端口的容器挤死（2026-09-18 admin 容器 `Exited(137)` 即此原因）。确需热更新迭代时，先 `docker compose stop <服务>` 腾出端口，用一次性临时端口起 dev server，用完即停，不得长期占用默认端口。
- **admin 的域名来源以容器为准**：`VITE_API_ORIGIN`（`http://api:8000` 代理）与 `VITE_MEDIA_ORIGIN`（`http://localhost:8000`，浏览器端图片 URL）由 compose 构建参数固定；宿主机 `admin-frontend/.env.local` 只影响手动起的 Vite dev server，不影响容器。勿再因 `.env.local` 指向生产域名而误判本地数据问题。

本地只做 API 相关工作时才启动本地 API；不要为了给 UI 取数据而启动或重置它。PM2 与 `ecosystem.config.js` 已于 2026-09-17 移除，不再是本地启动方式。

## 2. 分支规范

- `main`：主集成分支。每次 push 和 pull request 都触发完整 CI；**push 不会触发部署**——`deploy.yml` 仅限 `workflow_dispatch` 手动运行。
- 其他功能、修复和文档分支同样触发 CI；CI 通过是合并的必要条件。
- 发布、部署和回滚遵循 `release.md` 与根目录 `AGENTS.md`。
- 功能/修复分支建议：`feature/<topic>`、`fix/<topic>`、`chore/<topic>`，从最新 `main` 切出，完成后 PR 或快进合并。
- 长期未合并的分支/worktree 会腐化：合并或删除前先核对 `git status`、`CHANGELOG.md` 和当前任务上下文，确认没有受保护工作。

## 3. 代码规范

- TypeScript 严格类型；ESLint + Prettier；admin 使用 `<script setup>` SFC。
- 文案：后台界面文案为**中文**；业务正文一次英文撰写、前台原样展示。
- 视觉：公共站点遵循 `DESIGN.md`、`docs/reference/UI-OVERHAUL-2026.md`、`docs/reference/RESPONSIVE-SPEC.md`，使用现有 CSS 变量/token，不得模板化；GSAP 遵守 `useGSAP()`（React）/ `gsap.context()`（Vue）清理与 reduced-motion 要求。
- 文字排版一律横向；移动端触控目标 ≥ 44px、表单控件 ≥ 16px。

### 验证命令（改动的每一端都必须通过）

```bash
# site
cd site && npx tsc --noEmit --skipLibCheck && npm run lint && npm run test:ci && npm run build

# api
cd api && npx tsc --noEmit --skipLibCheck && npm test -- --runInBand && npm run build

# admin
cd admin-frontend && npm run build
```

注意：`api` 的 `lint`/`format` 会**写文件**（`--fix`/`--write`），不是只读校验；`site` 没有 `npm run type-check`，使用上面的显式 tsc 命令。

## 4. 提交规范（Conventional Commits）

格式：`type(scope): subject`

| type | 用途 |
| --- | --- |
| `feat` | 新功能 |
| `fix` | 缺陷修复 |
| `perf` | 性能优化 |
| `refactor` | 重构（不改行为） |
| `docs` | 文档 |
| `chore` | 构建/依赖/工具杂项 |
| `test` | 测试 |
| `deploy` | 部署配置 |

scope 取值：`site` / `api` / `admin` / `platform`（跨端）/ `payments` / `preview` / `deploy`；无明确归属可省略。

规则：

- subject 用英文小写祈使句、不以句号结尾、单行 ≤ 72 字符。
- 一个提交只做一件逻辑事；禁止 `git add -A` / `git add .` 等宽泛暂存，一律精确路径。
- 不提交密钥、`.env` 值、数据库凭据、上传文件。
- 修复不得以删除/跳过失败测试的方式“变绿”。

真实历史示例：

```text
fix(site): restore manual home video playback
perf(platform): cache public content and navigation data
fix(api): stop the global pipe from emptying every i18n array field
chore: add impeccable design tooling and shared workspace config
```

## 5. 协作流程（双仓库）

`admin-frontend/` 是**独立 Git 仓库**，根仓库同时以普通文件跟踪其内容（非 submodule）：

1. 动手前后核对两仓库状态：

   ```bash
   git -C E:/workspace/LingTour status --short --branch
   git -C E:/workspace/LingTour/admin-frontend status --short --branch
   ```

2. admin 改动验证通过后，先在独立仓库以精确路径提交，再在根仓库提交对应 `admin-frontend/...` 路径；保持逻辑与字节等价，并汇报两个 SHA。
3. 唯一已知受控差异：`admin-frontend/.vscode/extensions.json` 仅由独立仓库跟踪。
4. 每次有意义的代码、文档、配置、验证、发布或回滚变化时，更新 `CHANGELOG.md` 的 `[Unreleased]` 或对应版本分节。

## 6. 数据与种子（警告）

- 永不运行 `npm run seed:reset`。
- 任何带 `--apply` 的 seed/import/sync 命令，未确认目标与备份前不得执行。
- 迁移**只新增、不重写**；对任何数据库执行迁移前必须确认目标库、备份、既有迁移状态与迁移计划（见 `release.md`）。
- 不得引入假数据/占位数据/仅截图数据；本地 UI 工作默认读取真实 API。
