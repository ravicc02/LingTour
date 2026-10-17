# Changelog

本项目的所有重要变更都记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。项目使用 Semantic Versioning，发布版本以根仓库 `vX.Y.Z` Git tag 为准；未发布内容统一放在 `[Unreleased]`。每个发布分节记录根仓库 SHA、admin-frontend SHA、CI、发布、部署、迁移、备份、冒烟和回滚结果。流程规范见 `AGENTS.md`，详细发布 SOP 见 `docs/reference/release.md`。

## [Unreleased]

## [1.1.0] - 2026-10-17

> 源码发布（Not deployed）。本次发布不代表生产站点已更新。
> admin-frontend 对应 main：`015143fb3875a0e1cd1fdbeec66138cd5bca8b4d`，已通过 admin PR #1 合并。
> root 发布提交由 `v1.1.0^{commit}` 唯一确定；实际 GitHub CI run 和最终 root SHA 随 Release 说明记录。

### Release scope

- 保留既有光学对齐、页面文案精简和紧凑导航，发布已完成的美元口译套餐、服务端定价及订单金额校验。
- 文档按日期分类，AGENTS 专注流程，CHANGELOG 统一更新与发布记录；保留历史状态归档。
- 三份首页/Ticket、路线预约、日历方案仅为设计文档，不表示新功能已实现。
- CI 覆盖 API、site、admin、工作流静态检查、真实提交范围空白检查与 Git 可见文档；site 先生成 Next 类型，main 构建三端 Docker 镜像。
- 源码 Release 与生产部署分离；本次未执行生产部署、数据库迁移或真实付款，未宣称新的生产冒烟结果。

### Changed

- docs: 2026-10-17 将三类 UI 调研整理为三份详细 Markdown 方案：`homepage-ticket-hero-design-plan.md`、`route-booking-service-design-plan.md`、`calendar-services-design-plan.md`，保存到 `docs/2026-10-17/`，补齐 skills、交互与实现、测试、视觉验收、证据矩阵和分期回退，并更新文档索引。本次仅编写文档，功能与视觉验收均为待执行。本轮三份方案的章节、空白与本地链接检查通过；仓库可见的 88 份 Markdown 本地链接检查通过。

- site: remove redundant subtitles and decorative labels across public pages, standardize service headings and controls, and keep the original compact header and map actions.
- verification: site 22 files / 112 tests and API 28 suites / 201 tests passed; Docker site build passed; restored navigation, map actions and mobile menu verified in a browser at 390/901/1024/1354/1707px. No push, production deployment, migration or real payment.

- api/site: price interpretation packages in USD, validate package IDs on the server, snapshot totals separately from deposits, and retain historical order currencies.

- site: restore the legacy public navigation labels and map card actions (`Culture`, `Routes`, `Interpreting`, `Shop`, `BOOK`, `Story`, `Book`) after the copy refinement review.

- docs: 弃用 `docs/CURRENT-STATE.md` 作为状态源。当前更新、验证、发布、部署和回滚记录统一写入 `CHANGELOG.md`；原状态文档保存在 `docs/2026-10-17/current-state-archive.md`。
- docs: 将 `AGENTS.md` 收束为流程、规范和 SOP，补充版本号、CI、更新、发布和回滚规则。
- ci: 每次 push/PR 检查三端、actionlint、Prettier、文档链接和提交空白；main 在检查通过后构建 API、site、admin 镜像。新增文档检查器及 5 个干净检出回归用例。
- verification: git diff --check 通过；95 个 Markdown 文档的本地链接检查通过；三端 CI 等价验证结果见下方 `Flow validation`。

### Flow validation

- release verification (2026-10-17): root PR #8 CI run `39007342743`, head `12034d3653bb8413c926d39fbd28b5dac363b790`, passed API, site, admin and documentation checks in GitHub Actions. Docker was skipped by PR policy; publication additionally requires the final main CI with all three image builds. Admin PR #1 is merged at `015143fb3875a0e1cd1fdbeec66138cd5bca8b4d`; root/admin mirrored trees were verified equal except the intentional admin-only VS Code config.

- toolchain: `actionlint` v1.7.12 and Prettier 3.9.10 installed and passed for both GitHub Actions workflows.
- dependencies: API, site, and admin `npm ci` completed; npm reported existing dependency audit findings (API 21, site 20, admin 11) and no automatic audit fixes were applied.
- api: TypeScript check, 28 Jest suites / 201 tests, and production build passed. Test output contained the existing mailer connection-refused log while the suites remained green.
- site: TypeScript check, lint (0 errors, 1081 warnings), 22 Vitest files / 112 tests, and production build passed.
- admin: `vue-tsc` + Vite build passed for 4,660 modules; the existing large-chunk warning remains.
- docker: working-tree API and site image builds passed; temporary validation images were removed after verification.

## 2026-09-22 — 认证防御修复与自动化收尾部署（root `1a25fa5`）

### Changed

- api: 社区帖 restore 端点补显式 `@Roles('admin','editor')`，与同文件 delete 端点对齐（此前仅靠 `/admin/` 路径 fallback 要求 admin，editor 无法恢复软删帖）。
- api: 邮箱验证码消费改为条件 UPDATE（`consumedAt IS NULL` 守卫）——两个并发正确提交只有第一个能铸会话/重置，第二个收到「验证码无效」。
- api: `refreshToken` 拒绝无 `exp` 声明的已签名 token——此前 1 小时宽限窗口检查会被静默跳过，此类 token 可无限续期。
- docs: `release.md` §6 点名两个**有意不可回滚**的数据迁移（`1762300000000-EnglishOnlyContent`、`1740600000000-FixRouteRegionsEncoding`），涉及相关表的部署前必须 `pg_dump -Fc` 备份。

以上 api 修复均为防御性收紧，对正常客户端行为无变化。admin-frontend 本批无新代码；后台路线站点地图打点编辑器为 admin `02f8805`（root `aa8adfe`），随本次部署首次上线。

部署：上一部署 run `35480814536`（root `9aa37b4`）之后至本批无新迁移文件，`migration:run` 为空操作，未触发数据库备份前置条件。`Deploy LingTour Docker Stack` run `35693892146` 一次成功（约 3 分半）；服务器 root HEAD `3c5fc1d`；api/site/admin/nginx 四容器 healthy。生产冒烟：API health `database: up`；`culvoy.com`、`admin.culvoy.com` 均 200；生产 `RouteEdit-CF2b3nnv.js` chunk 检索到地图打点组件文案，确认新编辑器已上线。

## 2026-09-18 — 首页旧版区块清理上线（root `791cff0`）

### Removed

- site: 首页删除三处旧版遗留——Hero 下的统计信号条（`heroStats`）、Interpreting 区块的引言卡（`testimonials`）、旧首页并入的 ENTRY CARDS 三卡片区（`HomeEntryFilmstrip`，2026-07-10 改版时由旧版网格包装成轮播带入）；Events 日历左右箭头从月份行移至「Events」标题右侧并补 `aria-label`。`HomeEventCarousel` 与 `FeaturedRoutesCarousel` 两个全站零引用的旧组件文件一并删除。`heroStats`/`testimonials`/`entryCards` 的 API 字段与 admin 字段管理保留，仅首页不再渲染。

部署：前置生产数据库备份 `/root/backups/lingtour-db-pre-homeclean-20260918.dump`（132,037 bytes，`pg_restore` 可读）；只读核验 32 个迁移全部已应用、本次 0 迁移。`Deploy LingTour Docker Stack` run `35249588688` 一次成功（2m35s）；服务器 root HEAD `791cff0`；api/site/admin/nginx 容器 healthy。

验证：site tsc + lint 0 errors + 103 测试 + build；`git diff --check` 干净。生产冒烟：首页 200 且 `home-signal-strip`/`home-entry-track`/testimonial 文案均无残留、Events 标题与箭头在位；culture/routes/shop/interpreting/community/login/admin 全 200；API health `database: up`；同源代理 `/api/v1/auth/me` 401 基线正常。

## 2026-09-17 — review/09-17-B 安全与一致性修复上线（root `bb5d18b`）

### Changed

- api: booking 状态机服务端白名单流转校验、`deposit_paid → confirmed` 指派分支（P1-6）；退款改接 PayPal captures/refund 网关、网关成功才落 refunded（P1-3）；过期未付订单定时取消并释放预留库存、迟到付款在 markPaid 恢复（P1-4，新增 `@nestjs/schedule`）；手续费 handlingCents 配置化（P2-7）；押金按 CMS serviceModeId 显式定价、保留文本回退（P2-8，迁移 `1762500100000`）；公开 settings 端点字段投影 + 写入侧允许列表（P2-D）；shop featured 过滤 published（P2-E）；共享分页夹取工具应用到公开与管理端列表（P2-F）；公开 booking 与社区上传专用限流（P2-9/C）；PayPal 网关调用移出库存事务（P2-5）；Stripe 列移除迁移 `1762400000000`；favorites 外键迁移 `1762500000000`（清孤儿 + CASCADE）。
- api: 10 处 admin DELETE 补显式 `@Roles('admin','editor')`、`isAdminPath` 大小写不敏感（P1-7）；用户状态端点 admin-only + UpdateUserStatusDto + 管理员连续性校验（P1-8）；dev 验证码生产门控、发送失败 503（P1-1）；验证码原子尝试计数 + 每邮箱冷却（P1-2）；登录不再邮箱枚举（P2-2）；改邮箱双地址确认（P2-3）；未使用的 refresh 端点删除（P2-4）；JwtAuthGuard 走 JwtStrategy 恢复每请求查库（P2-A）；验证码定时清理（P2-N）；helmet 安全头（P2-O）；slug 格式约束、admin 分页夹取、audit Invalid Date 防护、home GET 只读、crypto 订单号、23505 处理等 P3 批次。
- site: SSG `generateStaticParams` 改服务端 fetcher（P2-K）；`/api/auth/session` POST/DELETE 增加 Origin/Sec-Fetch-Site 同站校验（P2-L）；preview 源限定 `https://admin.culvoy.com` 并补正负测试（P2-M）。
- admin: 登出调用 `/auth/logout` 吊销服务端 refresh 宽限（P2-I）；媒体删除按实际结果反馈（P2-J）；JWT base64url 归一解码（P3-8）；CSV 导出公式注入防护（P3-9）；列表请求竞态取消（P3-10）；401 不再误报「登录已过期」（P3-15）；editor 不请求 admin-only settings（P3-11）。
- infra: 四个 server 的 `client_max_body_size` 对齐 105M（P2-H，匹配 100MB 视频上限 + multipart 余量）；server 级基线安全头，uploads 位置补 CORP。

部署：前置生产数据库备份 `/root/backups/lingtour-db-pre-0917b-20260917-235220.dump`（131,965 bytes，`pg_restore -l` 可读）；只读核验 29 个已应用迁移后确认部署将执行 3 个迁移（`1762400000000`/`1762500000000`/`1762500100000`，全部幂等）。`Deploy LingTour Docker Stack` run `35243331878` 一次成功（4m35s）；服务器 root HEAD `bb5d18b`；3 个迁移全部落地；api/site/admin/nginx 容器 healthy，redis 未动。

验证：api tsc + 22 套件/114 测试 + build；site tsc + lint 0 errors + 103 测试 + build；admin build；双仓 `git diff --check` 干净；push CI run `35240318583` 三 job 全绿。生产冒烟：API health `database: up`；首页/文化详情/路线详情/解读/商店/社区/登录/admin 全 200（308 为尾斜杠归一化既有行为）；site 与 API 响应携带 `x-frame-options: DENY`、`nosniff`、HSTS（P2-O 在位）；`GET /public/settings` 仅返回 `seoTitle`/`seoDescription` 投影（P2-D）；无凭据 `PATCH /admin/users/:id/status` 与 `DELETE /admin/events/:id` 均 401（P1-7/8）；`/public/shop/featured` 200（P2-E）；带跨站 Origin 的 session 请求 403 拒绝、正确 payload 的登录请求穿通 site handler 到 API `/auth/login` DTO 校验层（P2-L 与登录链路回归）。admin 登录后的 CRUD、真实退款与下单写流程无凭据未验证，留运营侧执行。

## 2026-09-17 — 09-17 评审一致性修复上线（root `a522c77`）

### Changed

- docs: DESIGN.md 圆角/玻璃拟态词汇按线上现状裁决改写（radius 六档 `none/sm/md/lg/xl/pill`、`action-pill` 组件族、受控玻璃拟态五形态）；RESPONSIVE-SPEC 对齐实现现实（16px 实证背书、Tailwind 4 语法、S3 下拉面板与 S2 横滑轨道条款、九档视口表）；rebrand `9cb4eb0` 文档污染批次修复（AGENTS.md/release.md/CHANGELOG 域名还原、backend 设计文档 17 处 `oss.lingtour.cn` 还原、5 个 archive 文件失真标注）；development.md 部署口径改 workflow_dispatch-only；AGENTS.md 撤销 zh 保留规则、`INTERNAL_API_ORIGIN` 示例补 `/api/v1`、§10 部署块改写为 Docker workflow 通道、SSH 别名修正为 `Ravi-server`；CURRENT-STATE 基线同步。
- admin: index.html `lang="zh-CN"`、中文启动文案与中文字体栈；AdminLayout 后备标题与「线上数据」标签。

### Fixed

- admin: MediaPickerDialog 全组件中文化；coarse-pointer 表单控件 16px（预防 iOS 聚焦自动缩放）；`useTheme` matchMedia 监听器卸载清理。
- site: PostDetailDialog 焦点陷阱/移入/还原并新增回归测试；首页轮播指示点 44px 触控承载层；路线详情 StickyComposeBar 底部 safe-area 留白。

部署：`Deploy LingTour Docker Stack` run `35120749831` 在服务器镜像构建阶段撞 ssh-action 10 分钟超时失败（与 2026-09-16 首次 `594d183` 部署同型）；ssh 断开导致服务器侧 compose 构建成孤儿进程，将 2GB 主机压入约 7 分钟冻结（公网全端不可达后自愈，同 2026-09-11 事件型态）；清场后按脚本等价步骤以**串行构建**（api → admin → site）完成部署，规避并行构建 OOM 风险。无新增迁移（部署前只读核验生产 29 个迁移全部已应用）。部署前数据库备份 `/root/backups/lingtour-db-pre-0917-fixes-20260917-001031.dump`（131,965 bytes）。服务器 root `a522c77`；admin-frontend 对应三提交 `1e1a233`/`cac7634`/`56afcf4`。

验证：push CI run `35120439660` 三 job 全绿（Docker Build 自 `d60ede4` 修复后首次随常规 push 通过）；site tsc / test:ci（含新增 PostDetailDialog 用例）/ lint 0 errors（1081 既有 warnings）/ build；admin build；双仓 `git diff --check` 干净、admin 文件双仓 blob 逐字节一致。生产冒烟：API health `database: up`；首页/路线列表/社区/登录/路线详情（`/routes/southern-sea-table`）200；admin HTML `lang="zh-CN"` 与中文启动文案在位；生产 CSS `index-DIRMW8Vi.css` 含 coarse-pointer 16px 规则全链；详情页 SSR HTML 含 `pb-[env(safe-area-inset-bottom)]`。首页轮播（活动数据空窗未渲染）与社区对话框（0 帖子）运行时不可达，由新增单测与 CI 构建覆盖；admin 登录后页面无凭据未验证。

## 2026-09-16 — 文化详情页 masthead 与移动端体验修复（root `594d183`）

### Changed

- site: 文化详情页 masthead 重构为路线页 brief 同款双栏布局（桌面左图右文、620px/768px/lg 三档响应式，移动端保持上图下文卡片）；新增 `useGSAP` + `matchMedia` 入场动画（含 reduced-motion 守卫与清理）；h1 字号阶梯对齐 RouteBrief 样板；移除装饰性旋转与 "All cities" 返回链接（产品决策删除）。

### Fixed

- site: 移动端菜单抽屉删除与顶栏重复的 Login 入口和 "Routes — Choose a region" 折叠区（连同 state/import/翻译键一并清理）。
- site: `/routes` 列表页移动端从横向 snap 滑动轨道（下一张卡片被视口边缘切成半张）改为纵向单列堆叠，md+ 双列网格不变。
- site: 路线 stop 的 `culturalStory`/`story` 在两处数据清洗点归一化——此前任一 CMS stop 保存 null 字段会导致整条路线详情页浏览器崩溃白屏。
- site: `base.css` 的 `a`/`button` 元素 reset 移入 `@layer base`——unlayered 规则此前优先于所有 Tailwind utilities，静默压掉 Header Book 按钮与抽屉激活项的 `text-white`，造成深底深字看不清。

部署：`Deploy LingTour Docker Stack` run `35088747834` 服务器构建超时失败后，run `35089749795` 成功；服务器 root `594d183`；无新增迁移。本节同时归档上一批首页海岸 Hero 改版（root `bd209fe`，run `35075106931` 部署）。

验证：site tsc 0 错误、lint 0 错误（1080 条既有警告不变）、101/101 测试、build 通过；375/430px 浏览器验证 10/10（列表纵列堆叠、详情无溢出、抽屉两项清理、Book/激活项白字计算样式实测）。生产冒烟：API health `database: up`；`/culture/chaozhou/` 200 且 "All cities" 已删、双栏网格与 h1 阶梯在位；两条路线详情 200；`/login` 旧段落保持删除；生产 CSS 产物中 `a{color:inherit}` 位于 `@layer base` 块内、layers 之后无 unlayered 重复；site/api/admin/redis 容器 healthy。

已知问题（与本批无关，待独立处理）：push 触发的 CI 中 Docker Build job 自 `d52162b` 起持续失败（build context 异常为空、找不到 `site/`、`shared/`；API/Site 检查 job 均通过）；部署走 workflow_dispatch 不受影响。

## 2026-09-16 — English-only content contract (root `d52162b`)

### Changed

- platform: 下线业务内容多语言兼容，新增 `EnglishOnlyContent1762300000000` 迁移，将现有 JSONB 内容递归收敛为 English 值并移除 `zh/ZH`。
- api/site/admin: 内容 DTO、实体、预览、缓存键和编辑表单统一为英文单值；后台不再发送 `rawI18n` 或保留旧中文字段。独立 admin 仓库对应提交为 `38475be`。

部署：`Deploy LingTour Docker Stack` run `35063493183`（功能部署）及 `35064138513`（最终文档同步）；服务器 root `002708a`；生产迁移总数 29。
部署前数据库备份：`/root/backups/lingtour-db-pre-english-only-20260916.dump`（144856 bytes）。

验证：API/site/admin 容器健康；公网 site、admin、API health 返回 200；公开城市、路线、商品、系列、口译字段均为字符串；业务 JSON `zh` 键抽查为 0；390px 浏览器无横向溢出。

## 2026-09-16 — Review 缺陷修复上线（root `6216454`）

### Fixed

- api: 按生产代理跳数配置 `trust proxy`，避免所有访客共享全局限流桶；refresh 和 JWT 校验重新检查账号状态；事件状态收紧为 `draft/upcoming/ongoing/past`。
- api: 上传文件增加 magic-byte 校验并为静态上传响应增加 `nosniff`；修复 API 测试 mock 类型漂移。
- platform: 商城下单在事务内锁定并预留库存，支付失败或取消时释放；预约/定金提交支持 `Idempotency-Key`。
- site: SSR 失败不再伪装成稳定空数据；空 initial list 会重新请求；公开 server fetch 移除独立 Next Data Cache；兼容 collection 历史多语言字段；后台登录页不再请求未授权 settings。

部署：`Deploy LingTour Docker Stack` run `35015977643` 成功（6m09s）；服务器 root `6216454`，admin-frontend `228b55c`；新增迁移 `AddStockReservationsAndBookingIdempotency1762200000000` 已应用。部署前数据库备份：`/root/backups/lingtour-db-pre-review-fixes-20260916.dump`（144303 bytes）。

验证：API tsc、24 suites/161 tests/build；site tsc、18 suites/102 tests/build；admin build；site lint 0 errors/1084 warnings；前台和后台 1280/390px 浏览器回归通过；公网 API/页面 200，数据库 health `up`。

## 2026-09-16 — 品牌更名 Culvoy 与界面反馈修复（root `9cb4eb0`）

### Changed

- api/site/admin: 品牌全面更名为 Culvoy——API 面、邮件、cookie 与 localStorage 键（`lingtour_session` → `culvoy_session` 等）、预览通道、站点文案与全部指南文档；网关 `server_name` 收敛到 culvoy.com 家族，旧域名在宿主 TLS 层保持兼容。破坏性提示：访客需重新登录一次，本地购物车/收藏因键名变更而重置。
- admin: 独立仓库 `be74c41` 同步更名（预览通道、存储键、允许主机、vite 配置）。

### Fixed

- site: 文化列表卡片移除交错布局函数，统一 3 列网格，排版结构不再被打乱。
- site: Interpreting 页 hero 标题对齐其他页面样板——移除 `max-w-[18ch]` 窄约束并补桌面放大档位，左侧文字不再被挤压。
- site: 产品详情标题移除 `max-w-[12ch]` / `[14ch]` 窄栏约束，"Canton Porcelain Tea Cup" 等长标题恢复正常横排。
- site: 登录页左侧品牌分割线水平居中（`self-center`）。
- site: 验证码按钮文案精简为 "Email a code instead"。
- site: 删除登录页 "Sign in to return to your saved routes, field notes, and bookings." 描述段落。
- site: Header 登录入口改为 river-deep 描边按钮、Book 改为同色实底按钮，替代原先突兀的朱红双实底。

部署：`Deploy LingTour Docker Stack` run `34998367122`；服务器 HEAD `9cb4eb0`（admin `be74c41`）；无新增迁移。本批界面修复在部署前被并行会话卷入 rebrand 提交 `b51ca6e` 一并入库上线，部署后已在生产逐条实证 7/7（登录页 DOM 按钮/分割线/无旧段落、首页 Header 按钮类名、Interpreting hero、产品详情 h1、Culture 网格）。

## 2026-09-15 — Profile 一致性与注册验证码（root `b3df634`）

### Fixed

- site: Profile 页面 header 和 tab 栏改用统一的矿物纸底色；archive action 保持可点击范围并避免移动端拉伸。
- site: 已登录头像入口在用户有头像时显示真实头像，无头像时退回姓名缩写。

### Added

- site: 注册流程支持邮箱验证码注册，发送/验证的 `purpose` 区分登录与注册，并传递新用户姓名。
- site: 注册表单的国家和旅行偏好改用受控 listbox，保留键盘打开、方向键移动和 Escape 关闭。

部署：`Deploy LingTour Docker Stack` run `34937099768` 完成 build、迁移、容器重建与 nginx 重启后，在 health 等待阶段触发 ssh-action 10 分钟命令超时；人工确认服务器 HEAD `b3df634`，api/admin/nginx/redis 健康，站点 200。无新增迁移。

## 2026-09-15 — 站点审阅与 Profile 页面重构（root `008dbbf`）

### Fixed

- site: 账户入口改为独立圆形头像触点，不再使用方形容器包裹圆形头像。
- site: Culture / Route 详情移动端叠层统一使用页面矿物纸底色，Culture 的「All cities」链接移出内容卡片并缩小叠层容器。
- site: Culture 详情桌面首屏改用稳定的 `minmax(0, …)` 网格，避免标题与摘要列被媒体列挤压。
- site: Profile 统一页面底色与内容表面，移除空状态整屏撑高、白色大卡片和设置区割裂容器，补齐移动端字段与内容的宽度约束。

部署：`Deploy LingTour Docker Stack` run `34875955514` 成功（8m14s）；无迁移。部署前数据库备份 `/root/backups/lingtour-db-pre-profile-20260915-013724.dump`。

## 2026-09-14 — 公共站点移动端与档案状态修复（root `0303a42`）

### Fixed

- site: 登录入口改为高对比实心按钮，去掉窄屏局促的装饰菱形。
- site: Culture 移动端 hero 图文顶部对齐，标题不再被挤压截断；城市/路线卡片统一高度并保持底部 action 对齐。
- site: Interpreting 移动端标题不再三行挤压；“Choose support” 与 “Meet the interpreters” 保持横排。
- site: Profile 空状态底色与页面一致，去除割裂白块；不可读的深色 action 改为可读 outline 按钮。

部署：`Deploy LingTour Docker Stack` run `34829863128` 成功（4m19s）；无迁移。

## 2026-09-14 — 后台列表筛选与壳层打磨（root `e9f9914`）

### Fixed

- admin: 商品列表「在售/下架」筛选正确映射为 `published=true/false`，搜索关键词映射到后端 `q`。
- admin: 活动列表日期区间（`startDate`/`endDate`）由 API 实际读取并过滤；预约列表改用独立 `date=YYYY-MM-DD` 参数、按 `booking.serviceDate` 精确过滤，不再误用关键词搜索。
- api: `events` / `interpreting` / `shop` 列表接口落实上述筛选参数。
- admin: 统一响应式壳层断点（移动端 `max-width: 768px`、平板/桌面 `min-width: 769px`），消除 768px 设备上两套规则争抢；清理无效死选择器与重复遮罩规则。
- admin: 页面骨架屏改用 `--lt-*` 主题变量，暗色模式不再显示浅色骨架。

部署：`Deploy LingTour Docker Stack` run `34823168215` 成功（5m22s）；无迁移（生产 27/27 已应用，`migration:run` 为空操作）；部署前数据库备份 `/root/backups/lingtour-db-pre-adminfilters-20260914-163015.dump`。

## 2026-09-14 — 移动端布局修复（root `b1eadd7`）

### Fixed

- site: Culture / Routes / Interpreting 首屏在移动端保持并排布局；Interpreting 信息层级、Shop 详情 hero / story / related-products、Field Journal 登录按钮不再在窄屏被挤压或破坏（7 个未推送提交以 squash 方式合为单提交上线，内容零变化）。

部署：run `34813335316` 成功（8m24s）；无迁移。

## 2026-09-11 — culvoy.com 域名切换与积压批次上线（root `4e21907`）

### Changed

- 全仓：产品更名为 Culvoy（`5bec3bf`）；生产域名从 `lingfengtranstour.cn` 切换为 `culvoy.com` / `admin.culvoy.com` / `api.culvoy.com`（`4e21907`），nginx、部署与冒烟脚本、构建期域名同步更新；legacy 域名并行保留直至迁移关闭。
- site/api/admin: 2026-09-06 ~ 09-10 积压的已提交工作随本次部署首次上线（均核实为 `4e21907` 祖先）：culture Markdown 持久化与发布生命周期、admin 城市 Markdown 编辑、路线行程编辑强调与路线地图、staff onboarding 流程、移动端详情抽屉、Field Journal 编辑版式（Culture / Routes 列表与详情、登录入口）。
- site: 首页广东地图装饰路线改用真实城市质心与统一投影，修复硬编码坐标越界导致的裁切（`73aedc5`）。
- site: 移除虚构的 serviceCount 表达（`0ab3405`）；首页见证在 CMS 列表为空时回退为默认两条（`08a4e0c`）；全站文案替换 AI 残留表达（`8f6bdcd`）。
- ops: 2026-09-12 安装 Cloudflare Origin CA 证书（SAN `culvoy.com` + `*.culvoy.com`，有效期至 2041-09），三个 culvoy vhost 引用；legacy 域名 vhost 证书不变。

### Fixed

- admin: `I18nInput` / `I18nMarkdownEditor` 保存时保留既有 `zh` 字段（此前被清空，违反 legacy `zh` 兼容约束）；`CommunityBriefs` 载荷同步保留（`feb13b4`）。
- admin: EventsList 七列日历移动端规则——窄屏保留七列日期、隐藏格内活动条，活动信息经列表视图完整可达（`1b36ba5`）。
- site: 登录页移动端输入缩放修复（`f85281d`）。
- ops: 部署脚本 `tools/deploy-docker.sh` 在 `up -d` 后重启 nginx 重新解析 upstream，修复应用容器重建后的 502。

部署：服务器直接执行 `tools/deploy-docker.sh`，HEAD `4e21907`；部署前数据库备份 `/root/backups/lingtour-db-pre-domain-20260911-225953.dump`。

## [1.0.0] - 2026-09-05

首次公开基线：生产环境运行 Culvoy 完整产品（公开站点、运营后台、API）。

### Added

- 城市文化、故事路线、陪同传译与预约、店铺与 Stripe 支付、社区等业务域（设计详见 `docs/2026-05-11/backend/`）。
- 运营后台 CMS：内容编辑、审计、订单/预约、媒体与状态流转。
- 城市/路线/商品独立 SEO 标题与元数据。

### Security

- 支付链路改为服务端定价、Stripe webhook 原始体验签、订金与预订绑定（`SecureInterpretingDeposits` 迁移；代码已合入，是否已应用生产以服务器迁移状态为准）。

### Performance

- 公共内容与导航数据缓存（`perf(platform): cache public content and navigation data`）。
- 首页非关键加载延后（`perf(site): defer noncritical home loading`）。

### Fixed

- 全局 i18n 管道清空数组字段、Home 配置 PUT 清空自身 sections 等数据回归。
- 预览未保存草稿跨窗口握手、讲解员头像失败回退、预订完成与混合上传反馈。
- 首页视频手动播放恢复。

## 历史里程碑（2026-05 ~ 2026-07）

初始开发期的变更未按版本记录。关键节点查阅 Git 提交历史与 `docs/YYYY-MM-DD/` 内的 dated 文档（handoff、进度与旧部署手册）。
