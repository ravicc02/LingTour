# Culvoy 项目进度迁移交接

> **历史快照（2026-07-26）：** 本文保留当日交接背景，不再代表当前 Git、生产或待办状态。稳定工作规范见 [`../../../AGENTS.md`](../../../AGENTS.md)，实时状态与任务进度见 [`../../CURRENT-STATE.md`](../../CURRENT-STATE.md)。
>
> ⚠️ **历史失真标注（2026-09-16）**：文中的域名记载曾被 rebrand 提交 `9cb4eb0` 批量误替换——本文写作时（2026-07-26）尚未发生域名迁移，当时真实域名均为 `lingfengtranstour.cn` 族；文中出现的 `culvoy.com` 域名应按此理解。

> 更新时间：2026-07-26
> 工作区：`E:\workspace\LingTour`
> 线上基线：根仓库 `main@f38d60b`
> 交接原则：先保护现有工作区，再继续开发；前台视觉改造必须使用 Taste + GSAP 流程；所有后台功能必须以真实接口、真实持久化和真实前台结果验收。

---

## 0. 接手后先做什么

接手代理不要直接开始改页面。先按下面顺序执行：

1. 阅读本文件、根目录 `PRODUCT.md`、`DESIGN.md`，以及 `docs/reference/RESPONSIVE-SPEC.md`、`docs/reference/UI-OVERHAUL-2026.md`。
2. 分别检查根仓库和 `admin-frontend` 子仓库的 `git status`，确认并保护大量现有未提交改动。
3. 阅读本文件“必须使用的 Skills”，确认 Taste、GSAP 和浏览器测试能力可用。
4. 本地前台和后台连接线上 API，不重置本地数据库，不运行带 `reset`/`--apply` 的数据脚本。
5. 先复测线上基线和本地未提交版本，建立“已完成 / 未完成 / 回归问题”清单。
6. 每个逻辑改动单独提交；大改先在本地确认视觉，再推送、SSH 部署和线上复测。

严禁：

- `git reset --hard`
- `git checkout -- <path>`
- `git clean -fd`
- 在未审查差异时执行 `git add -A`
- 覆盖或删除不属于当前任务的未提交文件
- 为方便测试而重置线上或本地业务数据

---

## 1. 项目上下文

Culvoy 是一个面向广东文化旅行的全栈产品，不是单纯的旅游展示站。

产品同时包含：

- 城市文化档案与详情
- 故事路线、站点、地图和路线笔记
- 口译服务、口译员、FAQ 和预约
- 商品、收藏、购物车、订单和 Stripe 支付
- 社区 Field Notes、Brief、收藏与互动
- 用户登录、个人资料、收藏、路线和预约
- 内容、媒体、用户、订单、预约和运营管理后台

当前产品目标是：

- 前台保持岭南田园、纸张档案、旅行手账式的原创气质。
- 交互和动效丰富，但不能为了炫技牺牲可读性、性能和移动端体验。
- 页面之间在导航、反馈、动效、表单和响应式行为上保持一致。
- 后台是可真实操作的内容与业务工作台，而不是只做展示的 UI。
- 数据默认使用线上接口，本地主要负责前端视觉和交互确认。

### 1.1 技术结构

| 模块 | 路径 | 技术 | 本地地址 |
| --- | --- | --- | --- |
| 用户前台 | `site/` | Next.js 16、React 19、Tailwind CSS 4、GSAP、Framer Motion | `http://localhost:3000` |
| API | `api/` | NestJS 11、TypeORM、PostgreSQL、JWT、Redis、Stripe | `http://localhost:8000` |
| 管理后台 | `admin-frontend/` | Vue 3、Vite、Element Plus | `http://localhost:5173` |

生产地址：

- 前台：<https://culvoy.com>
- 后台：<https://admin.culvoy.com>
- API 健康检查：<https://api.culvoy.com/health>

### 1.2 仓库关系

根仓库：

- 目录：`E:\workspace\LingTour`
- 远程：`https://github.com/qiuy-collab/LingTour.git`
- 分支：`main`
- 当前线上基线：`f38d60b`

后台目录同时拥有独立 Git 仓库：

- 目录：`E:\workspace\LingTour\admin-frontend`
- 远程：`https://github.com/qiuy-collab/LingTour-admin-frontend.git`
- 分支：`main`
- 已提交基线：`787bd41`

根仓库也追踪 `admin-frontend` 内的文件。因此，修改后台时必须：

1. 在后台子仓库中按精确文件提交并推送。
2. 回到根仓库，再提交同一批后台文件，使部署仓库同步。
3. 两边都不得使用无差别的 `git add -A`。
4. 两个提交信息应体现同一项改动，方便以后比对。

### 1.3 当前工作区状态

截至交接时，根仓库和后台子仓库都有大量未提交改动，涉及：

- 前后台 UI 与响应式布局
- 城市、路线、商品、社区编辑工作台
- API 认证、审计、订单、口译、媒体、设置等模块
- 数据库迁移和种子脚本
- 前台图片、导航和收藏组件
- 新增后台运营、员工、媒体和动效相关文件

这些改动不应被视为垃圾文件，也不应自动回退。接手后需要按功能逐批审阅、构建、测试和提交。

尤其注意：多个历史 migration 文件处于修改状态。生产数据库迁移通常应新增迁移，不应随意改写已经执行过的迁移。必须先确认这些差异的来源和生产状态。

---

## 2. 必须使用的 Skills

### 2.1 前台 UI/UX 的强制组合

所有前台视觉、布局、交互和动效任务必须先读取并使用：

1. `design-taste-frontend`
   - 本机来源：`C:\Users\ASUS\.codex\skills\taste-skill\SKILL.md`
   - 用于设计判断、视觉层级、版式、交互质量和避免模板化 AI 风格。
2. `gsap-core`
   - 本机来源：`C:\Users\ASUS\.codex\skills\gsap-core\SKILL.md`
3. `gsap-react`
   - 本机来源：`C:\Users\ASUS\.codex\skills\gsap-react\SKILL.md`
4. `gsap-scrolltrigger`
   - 本机来源：`C:\Users\ASUS\.codex\skills\gsap-scrolltrigger\SKILL.md`
5. `gsap-performance`
   - 本机来源：`C:\Users\ASUS\.codex\skills\gsap-performance\SKILL.md`
6. `frontend-ui-engineering`
   - 用于组件、响应式、可访问性和前端工程约束。

使用顺序：

1. 先用 Taste 分析页面问题和原有产品语言。
2. 保留原风格和核心卡片结构，先解决层级、留白、栅格和移动端。
3. 再用 GSAP 设计有目的的进入、滚动、切换和反馈动效。
4. 最后按性能、可访问性和 `prefers-reduced-motion` 规则审查。

不能只“引入 GSAP”就算使用了 skill。必须能说明动效服务了什么信息层级或交互反馈。

### 2.2 其他必要 Skills

按任务使用：

- 浏览器验证：Codex 使用 `browser:control-in-app-browser`；Claude 使用 `agent-browser`、`playwright` 或 `webapp-testing`。
- 响应式与组件：`frontend-ui-engineering`
- API 契约：`api-and-interface-design`
- 故障定位：`debugging-and-error-recovery`
- Git：`git-workflow-and-versioning`
- 可访问性：`fixing-accessibility`
- 动效性能：`fixing-motion-performance`
- 测试与回归：`browser-testing-with-devtools`、`test-driven-development`

项目中已有 `.claude/skills/impeccable`，可以辅助审美检查，但不能替代 Taste 和 GSAP。

### 2.3 Codex Skill 迁移到 Claude

规则：

1. 先查 Claude 内置或全局 skills，已有则直接使用，不重复复制。
2. 内置找不到时，到 `C:\Users\ASUS\.codex\skills` 查找。
3. 迁移时复制整个 skill 目录，保留 `SKILL.md`、`references/`、`scripts/` 和 `assets/`，不能只复制一个文件。
4. 目标放入项目的 `E:\workspace\LingTour\.claude\skills\<skill-name>`。
5. 每次执行任务前完整阅读对应 `SKILL.md`。
6. Codex 插件专属的浏览器 skill 不应生搬硬套；Claude 使用自己的 Playwright/浏览器 skills。

PowerShell 示例：

```powershell
Set-Location E:\workspace\LingTour

if (-not (Test-Path .claude\skills\taste-skill)) {
  Copy-Item -Recurse "$env:USERPROFILE\.codex\skills\taste-skill" .claude\skills\taste-skill
}

@("gsap-core", "gsap-react", "gsap-scrolltrigger", "gsap-performance") | ForEach-Object {
  if (-not (Test-Path ".claude\skills\$_")) {
    Copy-Item -Recurse "$env:USERPROFILE\.codex\skills\$_" ".claude\skills\$_"
  }
}
```

复制 skill 本身也是项目修改，需要审查后单独提交，不能与业务代码混在一个大提交中。

---

## 3. 产品与视觉规范

### 3.1 前台风格

前台核心气质是“岭南文化旅行档案 + 田园手账”，不是现代 SaaS 落地页。

必须保留：

- 纸张、颗粒、档案和旅行笔记质感
- 深河蓝、朱砂、金色的克制点缀
- 编辑式大标题和错落但有秩序的版式
- 拍立得、纸框、胶带等签名式图片语言
- 原有田园风卡片，尤其是商品页
- Home 首屏已经获得较正面的用户反馈，可作为其他页面的质量标杆

禁止默认套用：

- 普通等宽卡片网格
- 到处圆角的 SaaS 卡片
- 玻璃拟态、渐变标题、发光边框
- 大量胶囊按钮
- 每个移动端区块都简单上下堆叠
- 只靠放大标题制造“高级感”
- 页面各自使用完全不同的动效语言

组件角度：

- 主卡片和主按钮以直角或极小圆角为主。
- Pill 仅用于筛选、标签、状态和小型切换。
- 强调色总面积保持克制。
- 实际 CSS token 是当前实现的第一事实来源；如与 `DESIGN.md` 不一致，先审计再统一，不能直接全局替换。

### 3.2 动效规范

- 动效必须有信息目的：揭示层级、说明方向、确认操作或连接前后状态。
- 页面标题、筛选、卡片进入、媒体切换和导航反馈应形成一致系统。
- 优先动画 `transform` 和 `opacity`。
- 避免频繁动画布局尺寸、阴影和模糊。
- 滚动触发必须清理实例，React 中使用 GSAP context/hook。
- 支持 `prefers-reduced-motion`。
- 移动端减少幅度和并行动画，不是完全删除反馈。
- 任何动效都不能引起文字重叠、横向溢出或明显布局偏移。

### 3.3 内容语言

当前最终要求：

- 管理后台的标题、字段名、帮助文字用中文，方便管理人员理解。
- 业务正文只维护一份英文内容。
- 后台放什么正文，前台就展示什么，不做自定义“假预览”或另外翻译。
- 不再恢复并排的中文正文 / 英文正文编辑器。
- 如数据库暂时仍保留旧双语字段，先做兼容读取和迁移方案，不能直接丢弃线上内容。

### 3.4 真实预览

编辑页预览必须：

- 使用真实前台页面或真实前台预览路由。
- 默认放在编辑器右侧，桌面端可 sticky。
- 不能在后台自己拼一个近似组件冒充前台。
- 草稿内容通过安全的预览参数、临时状态或草稿接口传入。
- 移动端或窄屏可切换“编辑 / 预览”，但不能压成极窄双栏。

---

## 4. 当前项目进度

### 4.1 已上线并确认的基线

线上当前运行根仓库提交 `f38d60b`，于 2026-07-26 再次通过 SSH 核实：

- `lingtour-site`：online
- `lingtour-api`：online
- `lingtour-admin`：online

最近的关键提交包括：

- `f38d60b`：前台路线和账户编辑优化
- `5b0ca78`：编辑器使用真实前台页面预览
- `18983e7`：媒体文件名和上传分类
- `959c654`：后台响应式内容工作流修复
- `d76ca5a`：前台展示口译 FAQ
- `ec1389e`：后台移除本地 mock 数据

### 4.2 前台已完成或已有实现

- Home 首屏已重构并保留，整体方向得到认可。
- Home 首屏与地图之间加入视频入口，视频具备暂停能力。
- 产品、景点等媒体方向已开始支持视频，不再只允许图片。
- Home 商品卡片保留原有田园式表达，避免普通卡片化。
- Home 商品“进入”按钮对比度、口译卡片圆角、Header CTA 文案等已调整。
- Culture 详情加载过程不再显示 `Opening the city file...` 文案。
- Route 详情媒体切换由长文字改为简洁符号。
- Route 结尾区块、Field Note 弹窗滚动、Checkout 版式已做过一轮重构。
- 未登录访问 Profile 会跳到 Login，避免多余的未登录 Traveler Passport 中间页。
- 登录页已去掉小人元素，并改掉不符合品牌的纯黑背景。
- 已登录 Profile 具备退出登录，并开始支持头像、姓名、邮箱等资料编辑。
- Interpreting 前台已补 FAQ。
- 前台默认使用线上 API 数据。

### 4.3 后台已完成或已有实现

- 后台已从本地 mock 数据切换到真实 API。
- 媒体上传文件名乱码已修复，并加入上传分类选择。
- 城市、路线、商品等编辑器已开始使用真实前台页面预览。
- 预览布局已向右侧工作区调整。
- 城市和路线章节工作台做过响应式修复。
- Dashboard 头部冗余宣传文案、图表文字重叠做过处理。
- 口译 FAQ 后台已有管理能力，前台已有展示入口。
- 通知、员工账号、审计、媒体、社区 Brief 等运营功能已有实现或未提交实现。
- `OperationsGuide.vue` / `OnboardingTour` 方向已有代码基础。

### 4.4 不能直接视为完成、必须复测的项目

以下项目曾被修改，但当前本地仍有未提交差异，且缺少完整端到端验收：

- Profile 姓名、邮箱、头像修改是否真正写入 API，并在重新登录后保持。
- 口译员编辑页头像加载失败和点击保存报错是否彻底解决。
- 后台是否仍有中英文正文并排编辑残留。
- 所有编辑器的预览是否都是真实前台页面且位于右侧。
- 后台侧栏选中态是否精确命中图标和菜单项。
- Dashboard 图表在不同宽度下是否仍重叠。
- 新手引导是否真正实现 Next / Back / Skip 的交互式遮罩流程，而不只是说明栏。
- 媒体上传分类是否真实写入接口，刷新后是否保留。
- 视频媒体在产品、景点、路线中的上传、选择、前台播放和暂停全链路。
- Checkout、订单、预约和支付是否是真实业务流程。
- 全站移动端布局是否系统修复，而不是只修复三个截图位置。

---

## 5. 本地数据、环境变量和运行方式

### 5.1 数据规则

- 做前台和后台视觉时，优先连接线上 API。
- 不为页面截图创建一套本地假数据。
- 不执行 `seed:reset`。
- 任何带 `--apply` 的导入、同步、迁移脚本都必须先确认目标环境。
- 需要修改线上数据时，必须先说明影响范围并通过真实后台操作验证。

只在本地配置环境变量，不把值写入文档或提交：

- 前台：`NEXT_PUBLIC_API_URL`、`INTERNAL_API_ORIGIN`
- 后台：`VITE_API_ORIGIN`、`VITE_SITE_ORIGIN` / `VITE_SITE_PREVIEW_ORIGIN`、`VITE_MEDIA_ORIGIN`
- API：数据库、JWT、Redis、Stripe、`FRONTEND_URL` 等

线上 API 基址：

```text
https://api.culvoy.com
```

### 5.2 本地启动

前台：

```powershell
Set-Location E:\workspace\LingTour\site
npm install
npm run dev
```

后台：

```powershell
Set-Location E:\workspace\LingTour\admin-frontend
npm install
npm run dev
```

API 仅在确有接口开发需要时启动：

```powershell
Set-Location E:\workspace\LingTour\api
npm install
npm run start:dev
```

不要为了使用线上数据而启动并重置本地 API；前台与后台可直接配置线上 API。

---

## 6. 修改与提交规范

### 6.1 每次修改

1. 先查看两个仓库的状态。
2. 只打开和修改当前任务相关文件。
3. 完成后检查差异和格式。
4. 运行与风险相匹配的构建、测试和浏览器回归。
5. 精确暂存文件。
6. 每个逻辑改动单独 commit。
7. 推送后再部署。

推荐检查：

```powershell
git status --short
git diff --check
git diff -- <本次文件>
```

提交时使用：

```powershell
git add -- <本次文件1> <本次文件2>
git commit -m "fix(site): ..."
```

后台改动还要在 `admin-frontend` 子仓库独立执行同样流程。

### 6.2 构建与测试

前台：

```powershell
Set-Location E:\workspace\LingTour\site
npm run lint
npm run test:ci
npm run build
```

后台：

```powershell
Set-Location E:\workspace\LingTour\admin-frontend
npm run build
```

API：

```powershell
Set-Location E:\workspace\LingTour\api
npm run build
npm test -- --runInBand
```

不要为了让任务“绿”而顺手修复或格式化整仓库。只处理本次变更引入的问题，并单独记录既有失败。

### 6.3 浏览器验收

每个前台大改至少检查：

- 320、375、390、430 px 手机宽度
- 768 px 平板
- 1280、1440、桌面宽屏
- 键盘导航、焦点态、Modal 滚动
- 减少动态效果设置
- 慢网下图片/视频加载
- 无横向滚动、重叠、竖排中文和不可点击区域

不能只缩窄浏览器看截图；还要实际点击导航、筛选、轮播、收藏、表单、登录和弹窗。

---

## 7. SSH、部署与线上回归

### 7.1 本机 SSH

本机 SSH 配置文件：

```text
C:\Users\ASUS\.ssh\config
```

连接别名：

```powershell
ssh lingtour-server
```

服务器项目目录：

```text
/root/LingTour
```

不要把 SSH 私钥、数据库密码或 `.env` 内容提交到仓库。

### 7.2 标准发布

视觉效果先在本地确认，构建通过并推送 `main` 后：

```powershell
ssh lingtour-server "cd /root/LingTour && git pull --ff-only origin main && bash tools/deploy-pm2.sh"
```

部署脚本会：

- 备份服务器当前 Git 差异
- Fast-forward 到 `origin/main`
- 构建 API 和 Site
- 重启 `lingtour-api`、`lingtour-site`、`lingtour-admin`
- 保存 PM2 状态
- 检查前台、后台和 API 健康状态

注意：脚本会在服务器发现工作区改动时重置服务器工作树。不要把未推送代码只放在服务器。

### 7.3 发布后必须检查

```powershell
ssh lingtour-server "cd /root/LingTour && git rev-parse --short HEAD && pm2 status"
```

随后用浏览器真实检查：

- 首页
- 本次修改页面
- 一条 Culture 详情
- 一条 Route 详情
- Interpreting 和预约入口
- Shop、购物车和 Checkout
- Login、Profile
- Community 和 Field Note
- 后台本次修改的列表、创建、编辑、保存和预览

文档类改动不需要重启服务；业务代码、样式、配置或接口改动必须按上述流程部署。

---

## 8. 后续执行清单

### P0：先保护和验证系统

#### P0-1 盘点未提交改动

任务：

- 根仓库和后台子仓库分别生成按模块分类的差异清单。
- 判断每个差异属于用户已有工作、已完成待提交、实验代码还是残缺实现。
- 不删除任何无法确认归属的改动。
- 将可独立验证的改动拆成小提交。

验收：

- 两个仓库状态可解释。
- 每个新提交只包含一个逻辑任务。
- 根仓库和后台子仓库没有版本漂移。

#### P0-2 后台真实操作审计

逐模块执行创建、编辑、保存、刷新、查询、上下架/发布、删除或状态更新：

- Home
- Cities 与 Sections
- Routes、Stops 与地区
- Events
- Products、Collections、Orders
- Media 与分类
- Interpreting Profiles、Modes、FAQs、Bookings
- Community Posts 与 Briefs
- Users、Staff、Settings、Audit、Notifications

验收：

- 请求调用真实 API。
- 刷新页面后数据仍存在。
- 前台内容同步变化。
- 失败时显示准确错误，不出现“看似成功”。
- 权限、审计记录和状态流正确。

#### P0-3 修复高风险回归

优先复测并修复：

- 口译员头像加载失败与保存报错
- Profile 姓名、邮箱、头像持久化
- 媒体文件名编码和上传分类持久化
- 编辑器双语正文残留
- 真实前台预览和草稿传递
- 支付、订单与预约的真实状态变化

### P1：前台全量移动端适配

不是只修用户截图中的三处，而是逐页审计：

- Home
- Culture 列表与详情
- Routes 列表与详情
- Interpreting 与 Booking
- Shop、商品详情、购物车、Checkout
- Community 与 Field Note
- Login、Profile 各 Tab
- 全局 Header、Drawer、Footer、Toast、Modal

重点：

- Home 地图在手机上不能以桌面比例硬缩放。
- 商品较多时使用横向可探索布局、snap、分组或适合品牌的紧凑网格，不能无限单列下排。
- Culture 等 Hero 不能机械地标题—正文—大图上下堆叠。
- 模块使用 `min-width: 0`，避免内容把栅格撑破。
- 需要保留表格语义的后台内容可横向滚动，不能把中文压成一字一行。
- 图片和视频比例、焦点与文字区域需针对手机重新构图。
- 保持可点击区域至少约 44 px。

验收：

- 320–430 px 无横向溢出或模块重叠。
- 商品数量增加后页面长度仍合理且易浏览。
- 地图可读、可操作，不遮挡主内容。
- 手机端不是桌面布局的简单缩小或全部纵向堆叠。

### P1：前台 UI/UX 与动效系统

任务：

- 用 Home 的完成度作为质量标杆，统一其他页面的标题进入、导航反馈、卡片揭示、媒体切换和滚动节奏。
- 保留 Culture、Routes、Interpreting、Shop、Community 的原有品牌卡片与详情版式，不重新套普通模板。
- 建立共享 motion tokens 和可复用 hooks。
- 视频完善 poster、加载、播放/暂停、键盘和 reduced-motion 行为。
- 修复颜色覆盖、焦点态、对比度和交互反馈。

验收：

- 动效在不同页面一致但不机械复制。
- 页面仍像同一个产品，同时各模块有自己的内容气质。
- 不出现布局抖动、滚动卡顿和进入动画遮挡内容。
- 弱性能手机和 reduced-motion 下可正常使用。

### P1：后台 UI/UX

任务：

- 修复章节工作台、路线工作台、编辑页和列表在窄屏/笔记本上的挤压。
- 实时预览固定在右侧；窄屏使用明确的编辑/预览切换。
- 修复侧栏选中态与收起状态命中区域。
- Dashboard 图表文字不重叠，移除无实际用途的宣传文案。
- 为列表补齐加载、空状态、错误、筛选、批量操作和危险操作确认。
- 媒体库让文件名、分类、标签、预览和引用关系清晰可查。

验收：

- 1280 px 笔记本宽度下无竖排挤压。
- 编辑区和预览区都可独立使用。
- 所有按钮执行真实操作。
- 保存成功后可刷新验证。

### P1：交互式新手引导

用户要求的是类似游戏的新手引导，不是静态说明横条。

必须具备：

- 遮罩聚焦当前操作区域
- 一步一步的 Next / Back
- Skip
- 当前步骤与总步骤
- 路由切换或页面滚动时能继续
- 完成状态持久化
- 可从帮助入口重新打开
- 不阻塞已有用户

验收：

- 新账号首次进入可以从媒体、编辑、预览到发布走完一条真实流程。
- 跳过和完成后不会每次刷新重复弹出。
- 小屏和侧栏收起状态仍能准确定位目标。

### P2：业务闭环与质量

- Stripe Checkout、订单创建、支付回调、状态与异常恢复
- 口译预约、定金、后台确认和用户 Profile 回显
- Community Note 发布、图片、收藏、喜欢和 Brief
- 收藏路线、商品收藏、购物车和个人集合
- SEO、Open Graph、结构化数据和错误页
- API 权限、限流、审计和输入验证
- 图片/视频大小、懒加载、缓存和 Core Web Vitals
- 可访问性、键盘、读屏和颜色对比
- 线上错误监控、慢请求和关键业务日志

---

## 9. 完成定义

一个任务只有同时满足以下条件才算完成：

1. 使用了要求的 skill 流程，并保持 Culvoy 原有设计语言。
2. 代码只包含当前任务相关改动。
3. 构建和必要测试通过。
4. 桌面与移动端真实操作通过。
5. 后台操作写入真实 API，刷新后仍存在。
6. 前台展示与后台输入一致。
7. 每个逻辑改动已有独立 commit。
8. 已推送正确远程；后台改动同步了两个仓库。
9. 大改已通过 SSH 部署。
10. 线上页面、PM2 和 API 健康检查通过。
11. 将已完成内容、遗留问题和线上提交 SHA 记录到后续交接或提交说明。

---

## 10. 给下一位代理的最终提醒

- 不要把当前未提交改动回退掉。
- 不要只修截图位置，要找出同类布局模式并全量修复。
- 不要把移动端理解为所有模块改成单列。
- 不要用普通圆角卡片取代原有田园手账风。
- 不要做后台假预览。
- 不要保留两套正文编辑；后台中文标签，正文英文，前台原样展示。
- 不要只验证按钮能点击，要验证接口、数据库、刷新和前台结果。
- 不要在未提交和未推送的情况下直接改服务器。
- 每次修改都要 commit；大改必须本地确认、推送、SSH 拉取部署、再做线上回归。
