# 城市详情页 · 章节卡排版实施方案

> **状态**：只读调查产物，**不含任何代码改动**。未跟踪文件，未入库。
> **决策前提**（已由 owner 确认）：**不动 admin 编辑面**（见 §6 的代价说明）。
> **开放项**：设计图内容需重传后校准像素细节（见 §8）。

---

## 1. 目标

把城市详情页（`/culture/[slug]`）的正文区，从当前的**单一 markdown 长文**，改造为设计图所示的**图文交替章节卡**编辑式排版：左侧大图 / 右侧文字，带章节编号（01、02）、章节标题、「status」一行要点、以及段落间的引文块。

---

## 2. 设计图要素 → 数据字段（生产实测对照）

设计图上每一个元素，都对应一个**已经存在、且生产已有数据**的数据库字段。表：`city_culture_sections`。

| 设计图元素 | 数据库字段 | 生产实测（Chaozhou） |
| --- | --- | --- |
| "Guangji Bridge" 大标题 | `title` | ✅ `"Guangji Bridge"` |
| 左侧大图 | `image` | 字段就位 |
| "Bridge status: …" 一行要点 | `stat_label` + `stat_value` | 字段就位 |
| 段落间引文 | `breath_image` + `breath_quote` | 字段就位 |
| 01 / 02 章节编号 | `sort_order` | ✅ 共 3 条 |

**证据链（API → 前端数据层）全部已通**：

- API 返回契约完整：`relations: ['sections']`，生产 `/api/v1/public/cities/chaozhou` 实测返回 `sections: 3`
- 前端数据层已映射：`site/src/lib/api-data.ts:351`、`site/src/lib/server-data.ts:439` 都在解析 `sections`（含 `statLabel` / `breathQuote`）
- 前端类型已定义：`site/src/data/culture.ts:12` `CityCultureSection`

> **结论：需要的数据一层不缺。缺的只是「渲染」。**

---

## 3. 现状：断点在三处

| # | 断在哪 | 精确位置 | 证据 |
| --- | --- | --- | --- |
| 1 | **渲染层不读 sections** | `site/src/app/culture/[slug]/CultureDetailClient.tsx:120-124` | `id="section-chapters"` 区块内只有 `<MarkdownRenderer content={activeCity.contentMarkdown ?? ""} />`；`sections` 数组一次都没被读 |
| 2 | **admin 不发送 sections** | `admin-frontend/src/views/CityEdit.vue` | 注释明写 `// Explicit allowlist: never send publication state or legacy sections/food.` |
| 3 | **布局两层收窄** | `site/src/app/styles/base.css:31` + `MarkdownRenderer.module.css:3` | 外层 `--site-max-width: 82rem`(1312px) 居中；内层 `.prose { max-width: 65ch; margin-inline: auto }` 再居中一次 |

第 3 条的量化账（1920px 视口）：

- 外层居中 → 两侧各留 **304px**
- 内层 `.prose`（约 550–620px）在 1312px 容器里再居中 → 两侧各再留约 **370px**
- **合计：屏幕边到正文文字约 650px 空白** —— 这就是你看到的"左右空余很大"

---

## 4. 必须先决策的核心矛盾

**`sections`（章节卡）与 `contentMarkdown`（长文）是两套并存的内容体系。**

现在页面渲染的是 `contentMarkdown`（Chaozhou 生产实测 **2040 字符**）。如果直接把 `sections` 也渲染上去，会出现**内容重复**（同一批内容两种形态）。三条路：

| 方案 | 做法 | 代价 |
| --- | --- | --- |
| **A. sections 替换长文** | 正文区只渲染 sections 卡 | `contentMarkdown` 字段废弃，2040 字符现有内容需迁移或弃用 |
| **B. sections 在前 + 长文在后** | 章节卡作为导览，长文作为正文 | 页面变长，需处理视觉节奏与 SEO 重复 |
| **C. 双轨按需** | 有 sections 用卡、无则回落长文 | 实现最稳，但两套渲染路径都要维护 |

> 我倾向 **C**：它不破坏现有内容，且能逐步迁移。但这需要你的判断 —— 设计图是想要 A 的效果还是 B 的效果，**我看不到图，无法替你定**。

---

## 5. 实施方案（不含代码）

### 步骤 1 · 渲染层（核心）

新建 `site/src/components/culture/CityChapters.tsx`，在 `CultureDetailClient.tsx:120-124` 的 `article` 内渲染。

- 章节卡结构：`<figure>`（左侧图）+ 文字列（编号 / `title` / `stat_label`+`stat_value` / `breath_quote`）
- 图片复用现有 `MediaFrame`（`asset` / `alt` / `mode` / `eager` props 已具备），**不新建媒体组件**
- 沿用现有采样：`site-container`、`py-beat`（`base.css:80` `--spacing-beat`）、`var(--line)` 描边、`scrapbook-shadow` 触觉阴影 —— 保持 Field Journal 语言，不引入新视觉方言
- 移动端降级：单列堆叠（图在上、文字在下），桌面端交替

### 步骤 2 · 布局层（解开收窄）

- `base.css:31` `--site-max-width: 82rem` → 评估放宽至 **90–96rem**（需实测九档宽度无横向溢出）
- **只对城市详情页**放开 `.prose` 的 `65ch`（用作用域 class 覆盖，不改全局 `MarkdownRenderer.module.css`，避免波及所有 markdown 页面）
- 图片出血：让章节卡大图可突破文字列，进入左右留白区

> ⚠️ 这两条会改变**全站页面节奏**的观感，必须做九档宽度回归，不能只看单页。

### 步骤 3 · 动效（遵循 AGENTS.md §7）

- 需要动效时用 `useGSAP()` + scoped root，代码内已引入 `@/lib/motion`
- 只动 `transform` / `opacity`，配 `gsap.matchMedia()` 做响应式与 `prefers-reduced-motion` 降级
- 低动效用户必须立即看到内容，无 pin / scrub

---

## 6. 明确不做（以及代价）

| 不做 | 原因 | **代价（必须知情）** |
| --- | --- | --- |
| admin 恢复 sections 编辑面 | 你的决策 | **sections 只能靠直接改数据库维护**。生产目前仅 **3 条**、本地也 **3 条**。改文案、加章节、换图都需手工进库，且有误写生产数据风险 |
| 全站放宽 `--site-max-width` | 影响面过大 | 本次只改城市详情页作用域 |

> 第 2 条不是 bug —— `CityEdit.vue` 里那句 `never send ... legacy sections/food` 是**有人特意写的**。当前方案等于「前端单独复活 sections 渲染」，而后台仍把它当 legacy。**这会长期处于半通状态**：页面能显示，但没人能通过正常流程维护它。建议在实施前明确：这是过渡方案，还是长期形态。

---

## 7. 验证清单（实施后必做）

- [ ] `site`：`npx tsc --noEmit --skipLibCheck` · `npm run lint`（0 error 基线） · `npm run test:ci`（105/105 基线） · `npm run build`
- [ ] 九档宽度（320/375/390/430/768/834/1280/1440/1920）**零横向溢出**、无重叠、无裁切
- [ ] 移动端触摸目标 ≥44px、表单控件 ≥16px
- [ ] 键盘导航、可见焦点、reduced-motion 降级
- [ ] 图像加载失败 / 慢载 / 空章节的回退
- [ ] **用真实 slug 验证**（生产 `chaozhou`、本地 `zhanjiang`），不用假数据
- [ ] 真实浏览器（Playwright）console **零错误**
- [ ] 站点容器重建后验证（本地默认读 `api:8000`，勿留临时 override）

---

## 8. 开放项（阻塞精确实施）

1. **设计图内容已丢失**（上下文重建导致）。本方案所有结论来自**数据库与代码证据**，非看图得来 —— `Guangji Bridge` 是从生产 API 查出的独立印证。但**栏宽、栅格比例、图片出血量**无法凭记忆给准，**请重传设计图**。
2. **§4 的 A/B/C 决策**未定。
3. 本地 sections 表仅 3 条，若方案选 A（替换长文），本地几乎无内容可测。

---

## 附：本次调查的边界

- 两个仓库工作区**干净**，`git diff` 为空；**零代码改动**
- 未跑迁移、未 seed、未写生产数据
- 根仓库 `main` ahead 1（`535d23d` 状态文档提交未推送）