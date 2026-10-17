# 进度记录 — 移动端 / PC 布局与接口数据层

> **历史快照（2026-07-26）：** 本文保留该批次的测量与验证证据；其中“未推送/未部署”和遗留项已被后续工作部分取代。稳定工作规范见 [`../../../AGENTS.md`](../../../AGENTS.md)，实时状态与任务进度见 [`../../CURRENT-STATE.md`](../../CURRENT-STATE.md)。

> 记录时间：2026-07-26
> 起点：根仓库 `c0682f2`（交接文档提交），后台子仓库 `787bd41`
> 本轮范围：`docs/2026-07-26/archive/LINGTOUR-HANDOFF-2026-07-26.md` 的 P0 保护、P1 前台移动端、P1 后台笔记本宽度，以及前后台数据层
> 状态：**已本地提交，尚未推送、尚未部署**

---

## 1. 本轮完成的内容

### 1.1 仓库保护（交接文档 P0-1）

- `tmp/` 下有两份明文 SSH 私钥（`deploy_key`、`server-key`），未被跟踪但也未被忽略，任何一次 `git add -A` 都会连同约 500MB 临时产物一起提交。已补 `.gitignore`。
- 工作区原有 57 个未提交文件。逐字节核对后确认其中 51 个只有空白、尾逗号与引号风格差异（含 8 个历史 migration，类名、`name` 字段与 SQL 文本均未变，生产已执行记录不受影响），单独作为格式化基线提交，与功能改动分开，使后者可审查。

### 1.2 前台移动端与 PC 布局

| 问题 | 实测证据 | 处理 |
| --- | --- | --- |
| 触控目标不足 44px | 首页单页 49 个 | 按模式全站修复，非逐页 |
| 广东地图按桌面比例硬缩放 | 375px 下缩放 0.27、填充率 37%、城市名 4.3px、标记 2.2px、市界 0.27px | viewBox 按断点重建，填充率 92%、城市名 12.2px、标记 6.5px、描边恒定 |
| 地图标记不可点 | 湛江标记被信息卡吞掉，5 个里 1 个点击命中面板 | 省份顶部对齐 + 透明命中圈，5/5 可点 |
| 移动端 sticky header 完全失效 | 滚动 700px 后 header top 为 -700px | 移除多余的 `body{overflow-x:hidden}` |
| 平板表单聚焦缩放 | iOS 防缩放规则被关在 `max-width:767px` 内 | 改用 `@media (pointer: coarse)` |
| Culture / Routes 首屏挤成双窄列 | 375px 下 188px 文字列 + 139px 图片列 | 窄屏单列，sm 以上维持原编辑式构图 |
| 商品列表无限单列 | 18 件约 8000px，且随上架增长 | 最小断点起两列 |
| 社区信息流一次性渲染 | 约 65 项、28000px+ | 每页 12 条 + load more + 计数 |
| 社区 toast 宽度被锁死 | 320px 下 160px 宽、文案折 5 行 | 两端锚定，288px 宽、2 行 |
| 首屏微标签不可读 | 7px + 0.16em 字距且被截断 | 10-11px 并允许换行 |

按钮样式另有一处结构性问题：`components.css` 未包在 `@layer` 内，而 Tailwind v4 的 utilities 在层内，未分层规则无条件胜出，因此元素上写的 `px-*` 被静默丢弃（已实测 `.btn-primary px-2 py-1` 仍解析为 40px）。窄屏收缩因此只能写在样式表里，已在文件内注明该陷阱。

### 1.3 前后台数据层

- **移除 i18n（决策项 1）**：运行时早已是英文单语（`getLocale()` 恒返回 en、`setLocale()` 忽略入参、`isZh()` 恒 false、服务端 `resolveLanguage` 硬编码 en），剩下的是约 1000 行不可达中文与一条贯穿所有 fetcher 的死参数。已删除，净减 1445 行。数据库 jsonb 的 `{en,zh}` 列未动，仍按 `en` 读取。
- **收藏跨设备丢失**：此前只写 localStorage、单向推送、失败吞掉、从不读回，登录用户清缓存或换设备即丢。改为登录 / 注册 / Google 登录时与账号合流（并集，本地独有的推上去），补 5 个单元测试。
- **后台保存会抹掉中文**：`toI18n()` 返回 `{ zh: '', en }`，而 API 用 `Object.assign` 整体替换 jsonb 列，每保存一次就销毁一份线上中文。改为原样带回已有 `zh`，编辑器仍是单语。
- **口译员破图**：公共页返回全部 profile，未完成记录会显示破损头像。改为只返回 active 且有头像的；已核对生产数据，两条现有记录均满足，线上展示不变。

### 1.4 后台笔记本宽度（交接文档 P1）

- 社区引导列表六列固定栅格合计 976px 且父容器 `overflow:hidden`，1024px 下"编辑/删除"列被裁掉且无法滚动。改为横向滚动并显式声明最小宽度，保留表格语义。
- 首页配置页漏写 `label-position="top"`，19 个表单项退回不可压缩的左侧内联标签。已补顶部标签布局。
- `ImageUpload` 的 120px 方块无法收缩，放进窄列直接溢出。改为 `clamp(88px, 100%, 120px)`。

---

## 2. 验证方式与结果

- 三端构建全绿：site（tsc / eslint 0 error / 20 测试 / production build）、api（nest build）、admin（vue-tsc / vite build）。
- 自建 Playwright 验收脚本，每组检测页面级横向溢出、越界元素、44px 触控、16px 输入字号、sticky 是否吸顶、缺失文案标记、中文残留。过程中跑过 7 宽度 × 13 页共 91 组的全量版本，收尾用 4 宽度 × 6 页的精简版复核。
- 关键改动均以修改前后的实测数值对照，而非目视截图。

收尾复核（320 / 375 / 768 / 1280 × 首页、Culture、Routes、Shop、Community、Checkout）：

| 指标 | 结果 |
| --- | --- |
| 页面级横向溢出 | 0 |
| sticky header 失效 | 0 |
| 触控目标 < 44px | 0（四个宽度全部） |
| 缺失文案标记 | 0 |
| 中文残留 | 0 |
| 页面加载错误 | 0 |

唯一剩余项是 1280px 下的 `input < 16px`，这是预期行为：iOS 防缩放规则已改挂 `@media (pointer: coarse)`，鼠标环境本就不需要，768px 触屏检测为 0 即证明规则生效。

375px 页面高度：首页 6478、Culture 2659、Routes 2749、Shop 2177、Community 3725、Checkout 3076。Community 由分页前的约 28000px 降到 3725px。

---

## 3. 遗留问题

**需要产品决策：**

1. `site/public/editorial/guangdong-coast-boat.jpg` 未提交，且由 200KB 膨胀到 2403KB（2400×4267 竖版）。它是 Culture 与 Interpreting 的 hero 种子图，而 `next.config.ts` 设了 `images.unoptimized`，浏览器原样下载，单页请求 5 次。属他人未提交改动，未擅自覆盖。另三张同批图片一并留在工作区。
2. `GlobalDrawer.tsx` 仍是无人挂载的孤儿组件，内含硬编码的假预订数据（Foshan / Shantou 2026）。当前不影响用户，但一旦被挂载会直接展示假数据。
3. api 装了 `redis` / `cache-manager` / `@nestjs/cache-manager` 三个包，代码零引用，`CacheModule` 工厂只返回内存配置。

**未能验证：**

4. 交接文档 P0-2 要求的后台逐模块真实操作审计（创建 / 保存 / 刷新 / 发布 / 删除）没有做——没有后台登录凭据，只能验证到登录页。后台三处改动是可静态证明的布局缺陷（固定栅格宽度超出容器、缺失标签模式、固定尺寸溢出），已通过 vue-tsc 与构建，但未经登录态实操。
5. 慢网下的图片 / 视频加载未测。

**已知既有失败（非本轮引入，未顺手修）：**

6. api 的 `*.spec.ts` 有 mock 类型错误（`auth.service.spec.ts`、`cities.service.spec.ts`），`nest build` 不含测试文件因此不受影响。
7. site eslint 5 个 warning，全部在 `server-data.ts` 与 `GlobalDrawer.tsx`，`HEAD` 版本即已存在。

**审计剩余：** 代码层响应式审计共 147 条（42 条 high），其中 30 条 high 落在本轮已修改的文件内。未触及的集中在 `CityArchivalBook`（移动端章节导航与无条件全量渲染）、`map.css`（leaflet popup 固定宽度，疑似死代码——地图实为自绘 SVG）、以及后台 `ProductEdit` / `Dashboard` / `responsive.css`。

---

## 4. 下一步

本轮 22 个提交（后台子仓库另有 3 个，与根仓库一一对应）**均未推送**。按交接文档 §7，推送与 SSH 部署会影响生产环境，需人工确认后执行：

```bash
git push origin main
```

```bash
ssh lingtour-server "cd /root/LingTour && git pull --ff-only origin main && bash tools/deploy-pm2.sh"
```

部署后按交接文档 §7.3 复测首页、Culture 详情、Route 详情、Interpreting 预约、Shop / Checkout、Login / Profile、Community，以及后台本轮改动的三个页面（社区引导列表、首页配置、任一含图片上传的编辑页）。

后台子仓库需单独推送：

```bash
cd admin-frontend && git push origin main
```
