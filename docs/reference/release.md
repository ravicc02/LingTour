# 发布指南

发布流程、服务器与进程配置、数据库迁移与上线后验证。流程规范见 [`../../AGENTS.md`](../../AGENTS.md)；开发环境见 [`development.md`](development.md)。

## 0. 版本与发布记录

项目使用 Semantic Versioning，根仓库 Git tag 是版本号的唯一来源：

- `MAJOR`：不兼容的 API、数据、认证或部署契约变化。
- `MINOR`：向后兼容的新功能或产品能力。
- `PATCH`：向后兼容的修复、安全修复、依赖、文档或运维调整。
- 预发布版本使用 `-alpha.N`、`-beta.N` 或 `-rc.N`。
- 正式版本使用 `vX.Y.Z`，例如 `v1.1.0`。
- 所有未发布内容先写入根目录 `CHANGELOG.md` 的 `[Unreleased]`，发布时改为带日期的版本分节。

## 1. 发布通道

当前生产以 **Docker 栈**为准：宿主机 Nginx（TLS，宝塔面板）→ `127.0.0.1:8088` → `lingtour-nginx` Docker 网关，按 Host 路由到 `site` / `api` / `admin` 容器。服务器上的 PM2 进程已退役并保持停止状态，仅作历史参考。

1. **标准通道**：GitHub Actions `Deploy LingTour Docker Stack` 工作流（`workflow_dispatch`-only）→ SSH 到服务器执行 `tools/deploy-docker.sh`。
   - **push 根仓库 `main` 只触发 CI，永不触发部署**；部署必须显式 dispatch 该工作流，且必须获得明确授权。
   - 依赖仓库 Secrets：`SERVER_HOST`、`SERVER_USER`、`SERVER_SSH_KEY`、`SERVER_PORT`（可选，默认 22）。
2. **手动（授权后）**：在服务器上直接执行：

   ```bash
   ssh Ravi-server "cd /root/LingTour && bash tools/deploy-docker.sh"
   ```

   `tools/deploy-docker.sh` 是 Docker 部署的**唯一权威脚本**：备份服务器 Git 状态、`ff-only` 拉取、构建镜像、执行待迁移（`migration:run`）、重启容器并做健康检查；构建后在 `up -d` 之后重启 nginx 以重新解析 upstream（修复应用容器重建后的 502）。**其 Git 备份不是数据库备份。**

CI（`.github/workflows/ci.yml`）覆盖每次 push 和 pull request：api（tsc + test + build，含 PostgreSQL 16）、site（tsc + lint + test + build）、admin（type-check + build）和 Markdown 检查；push `main` 在这些检查通过后额外构建 Docker 镜像。部署仍只允许显式 dispatch `deploy.yml`。

> 已知部署风险：2 GB 内存主机上同时构建 site/admin 镜像可能触发内存耗尽（2026-09-11 曾致约 6 分钟主机冻结，靠 swap 吸收峰值）；构建缓存冷时 `deploy.yml` 曾在 ssh-action 10 分钟默认超时内失败（2026-09-14）。失败后先检查残留容器再重试，缓存温热时通常可成功。

## 2. 服务器与运行拓扑

- 服务器：SSH 别名 `Ravi-server`，仓库路径 `/root/LingTour`。
- 生产域名：`https://culvoy.com`（site）、`https://admin.culvoy.com`（admin）、`https://api.culvoy.com`（api），经 Cloudflare（Origin CA 证书，SAN 覆盖 `culvoy.com` + `*.culvoy.com`）→ 宿主机 Nginx（宝塔 vhost）→ `127.0.0.1:8088` → `lingtour-nginx` Docker 网关按 Host 分发；legacy `lingfengtranstour.cn` 域名族并行保留直至迁移关闭。
- 容器：`site` / `api` / `admin` / `redis` 由根目录 `docker-compose.prod.yml` 管理；**PostgreSQL 不在 Compose 内**——API 直连宿主机 PostgreSQL（`host.docker.internal:5432`），数据库备份须在宿主机执行 `pg_dump -Fc`。
- API 健康检查：`https://api.culvoy.com/health`。
- 已知健康检查误报：`lingtour-site-1` 常报 Docker `unhealthy` 而实际服务正常——healthcheck 以 5 秒超时执行 `node -e fetch(...)`，负载下 node 启动即超时；以站点实际 200 响应为准。
- 服务器上存在未跟踪产物（历史部署 `*.bundle`、`site/public/assets/` 等）：未经引用核查与授权不得删除，详见 `CHANGELOG.md` 对应的发布记录和服务器备份目录。
- 部署相关路径速查另见根目录 `BT-DEPLOY-PATHS.md`（宝塔口径）。

## 3. 发布前检查

1. 三端验证全绿（命令见 `development.md` §3），两仓库 `git diff --check` 通过。
2. 核对两仓库状态与未推送提交，记录 root 与 admin 的 SHA。
3. 确定 Semantic Versioning 版本，并把 `[Unreleased]` 改为 `## [X.Y.Z] - YYYY-MM-DD`；记录 root HEAD SHA 和 admin-frontend SHA。部署信息（workflow run、迁移、备份文件）在部署后补到同一分节。
4. 审查每个待上库的 TypeORM 迁移：**只新增、不重写已执行迁移**；`api/src/database/data-source.ts` 保持 `synchronize: false`。
5. 源码发布审查迁移源码；只有生产部署另获授权时，才备份目标数据库并检查其迁移状态。
6. 确认 `CHANGELOG.md` 的 `vX.Y.Z` 分节已覆盖本次变更，且没有未处理的验证、迁移或回滚说明。

## 4. 发布步骤（授权后）

GitHub Release 与生产部署分别执行。用户仅要求发布版本时，执行源码发布，并标注 Not deployed；不得因此操作生产服务器。

### 4.1 源码发布

1. 先在独立 admin 仓库完成合并，再在根仓库完成对应合并；记录两边 main SHA。
2. 等待目标 root main 的完整 CI 通过，包括 API、site、admin、文档和 Docker。
3. 在已验证的 root HEAD 创建不可移动的 vX.Y.Z Git tag。
4. 创建 GitHub Release。标题和说明对应 CHANGELOG 的版本分节，记录 root/admin SHA、CI、实际完成内容与仅规划内容。
5. 源码发布尚未部署时，明确写 Not deployed；迁移、数据库备份与生产冒烟写“未执行”。

### 4.2 生产部署（单独授权）

1. 核对目标版本、main SHA 与 CI。现有脚本部署配置分支的最新代码，不直接按 Release tag 部署，必须核实没有混入其他提交。
2. 审查迁移、确认目标数据库、备份并验证备份可读。
3. dispatch Deploy LingTour Docker Stack 并跟踪结果。
4. 确认服务器 root SHA、容器、API 和公开页面状态，执行第 5 节冒烟。
5. 将实际部署、备份、迁移和冒烟结果追加到 CHANGELOG。源码 Release 不自动等于上线成功。

## 5. 发布后冒烟

- API `/health` 返回 200 且数据库 `up`。
- 公开站点：首页、文化列表/详情、路线列表/详情、传译与预约、店铺与 Checkout、登录/个人资料、社区。
- 运营后台：本次变更涉及的创建/编辑/保存/预览/状态流转，并经刷新与重登验证持久化；后台预览必须走真实公开页面/预览路由。
- 涉及迁移时，确认迁移已应用且相关接口读写正常。

## 6. 回滚

- 代码回滚：在服务器上把仓库切回上一个已验证 SHA 后重新执行 `tools/deploy-docker.sh`。执行前确认服务器工作区已备份（含未跟踪产物），由运维执行，不在本地仓库演示危险命令。
- 数据回滚：迁移不提供 down；以发布前数据库备份（宿主机 `pg_dump -Fc` 产物）恢复，且必须先停写。注意两个**有意不可回滚**的数据迁移：`1762300000000-EnglishOnlyContent`（中文值已折叠为英文，down 为空、无法重建）与 `1740600000000-FixRouteRegionsEncoding`（原始乱码字节有意丢弃）；涉及相关表的部署前必须先做 `pg_dump -Fc` 备份。
- 任何回滚都在 `CHANGELOG.md` 对应版本分节追加原因、版本或 SHA、备份、验证和结果。

## 7. 生产环境变量

只在服务器/Secrets 中管理；文档与提交中只出现变量名，绝不写值。

- site：`NEXT_PUBLIC_API_URL`（生产为同源相对路径 `/api/v1`，浏览器请求经 nginx 同源代理携带登录 cookie；改成跨域绝对地址会让 traveler 端登录态调用整体 401）、`INTERNAL_API_ORIGIN`、`PORT`、`HOST`、`NEXT_OUTPUT`。
- admin：`VITE_API_ORIGIN`、`VITE_SITE_ORIGIN` 或 `VITE_SITE_PREVIEW_ORIGIN`、`VITE_MEDIA_ORIGIN`、`PORT`、`HOST`。
- api：数据库 `DB_*`、`JWT_SECRET`、PayPal 凭据、媒体/上传相关配置；完整清单见仓库根目录 `.env.production.example`。
- Actions：仓库 Secrets `SERVER_HOST` / `SERVER_USER` / `SERVER_SSH_KEY` / `SERVER_PORT`。

> 端口口径：本地开发 site 3000 / admin 5173 / api 8000；生产容器端口 site 3000 / admin 4173 / api 8000，由 `lingtour-nginx` 网关（宿主机 `127.0.0.1:8088`）按 Host 分发，再经宿主机 Nginx（宝塔 vhost，443/TLS）对外。PM2 已退役，不再存在 PM2 端口。
