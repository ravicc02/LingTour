# Culvoy 公开站优化方案（motion-web 审查）

> **日期**：2026-09-18
> **基准**：根仓库 `main` @ `1c90bf8`，生产 `b9db5ea`；公开站 `site/`（Next.js 16 + React 19 + Tailwind 4 + GSAP）
> **方法**：按 `motion-web` skill 的判据（design-slop / page-design / motion-tokens / handfeel / timeline-orchestration / build-mode / production-polish / affordance / components）对公开站做三路只读审查，再人工复核关键结论
> **状态**：**本文档为方案，未改动任何业务代码**。所有行号指向 `1c90bf8` 的工作树。

---

## 0. 摘要

这个站不是「AI 模板站」，也不是「动效 demo」。首页的版面主张（8 段各自不同形状、全幅照片 hero、非对称错位网格）是真实的；`RouteMap` 的三态披露、`MediaFrame` 的媒体降级、`SiteHeader` 移动抽屉的焦点陷阱达到教科书水平；全站零 `pin`、零编造数据、reduced-motion 分支回退干净。

**它的问题不在动效做得少，而在三件事：**

1. **一批"确定性缺陷"**——可以直接判定对错、修复成本极低、但正在真实损害可访问性、SEO 和渲染正确性（未定义 CSS 变量、不达标的对比度、缺失的错误边界、被 `role="img"` 屏蔽的交互子树）。
2. **设计系统的纪律已经松散**——token 层存在但被绕过（22 个 class 零引用）、卡片层混装了两套互斥的组件方言（约 90 处阴影 / 7 档圆角）、266 处小于 12px 的微字。
3. **动效系统停在一个"看起来在动、但没有任何主张"的状态**——19 个互不相干的时长、单一缓动向下的 `power3.out`、移动端完全没有入场动效、装了 rung 4 的两套库却没有任何一处用到 rung 4 的能力。

按 `AGENTS.md` 声明的设计拨盘（`MOTION_INTENSITY=7`），当前动效实现大致停在 **4**。

**建议的推进顺序**：先清 P0 缺陷（一批小改动，风险低）→ 再定组件方言与 token 层（一次决策 + 批量收敛）→ 然后才动动效编排（这时候动效有地方落）。

**owner 决策已确认（2026-09-18）**：D1 卡片方言 = **creative**；D2 五个零引用组件 = **判定废弃、清理**（判据：城市详情页已改为纯 Markdown 渲染）；D3 framer-motion = **保留，独立批次处理**。详见 §5，路线图见 §6。

---

## 1. P0·确定性缺陷

> 这一批的特点：**不需要设计判断，只有对错**。每条都有明确证据，修改范围局部，建议优先做。

| # | 问题 | 证据 | 修复 |
|---|---|---|---|
| **P0-1** | **未定义的 CSS 变量导致装饰不渲染**。`var(--field)` 全站**仅此 1 处引用、0 处定义**，该 `background-color` 在计算值阶段失效 → 社区页 hero 右侧墨团装饰实际是透明的。motion-web 明确把「引用了但未定义的 custom property」列为应直接判 fail 的项 | `site/src/app/community/page.tsx:507`（已人工复核：全仓 grep `--field` 只此一处） | 改为 `bg-[var(--jade)]/[0.13]`（语义上"田野"用玉色）或删除该装饰。**1 行** |
| **P0-2** | **无错误边界**。全站没有 `app/error.tsx`、没有 `app/global-error.tsx`（Glob 确认），任何 5xx / 运行时错误落到框架默认页 | `site/src/app/` 下无对应文件 | 补 `error.tsx` + `global-error.tsx`：一句话 + 一个「重试 / 回首页」动作，沿用档案纸语气（`not-found.tsx` 已是正确范例） |
| **P0-3** | **无 skip link**。键盘用户每页要穿过约 10 个导航链接才能到达内容 | 全站 grep `skip` 无命中；`layout.tsx:57` 的 `<main>` 无 `id` | `SiteHeader.tsx:129` 前加 `<a class="skip" href="#main">`，`<main>` 加 `id="main"` |
| **P0-4** | **无 `rel=canonical`**。`culvoy.com` 与遗留 `lingfengtranstour.cn` 家族并行服务（`AGENTS.md` §2 明确这是进行中状态），两套域名同内容且无 canonical → 搜索引擎判重复内容的真实风险 | 全站 grep `alternates`/`canonical` 0 命中 | `layout.tsx` metadata 加 `alternates: { canonical: "./" }`，详情页覆写为自身路径 |
| **P0-5** | **交互子树被 `role="img"` 屏蔽**。外层 `<svg role="img">` 会让辅助技术忽略其全部子节点，内部的 `role="button" tabIndex={0}` 城市按钮**对读屏与键盘实际不可达** | `site/src/components/home/GuangdongMapSection.tsx:380` vs `:449-460` | 外层改 `role="group"` + `aria-label`（或把 label 下移到 `<g>`）。注意：`RouteMapCanvas.tsx` 的 `role="img"` 是**正确**的——它确实是静态示意图，不要一起改 |
| **P0-6** | **`<main>` landmark 嵌套**。layout 提供 `<main>`，多个页面又各自渲染 `<main>` → 双 landmark，屏幕阅读器的"跳到主内容"行为不确定 | `layout.tsx:57` vs `not-found.tsx:18`、`LoginPanel.tsx:232`、`checkout/success/page.tsx:128`、`ProfilePageClient.tsx:403`、`CultureDetailClient.tsx:76`、`ProductDetailClient.tsx:57` | 子页面根元素 `<main>` → `<div>`，landmark 只由 layout 提供 |
| **P0-7** | **未声明 `color-scheme`**。暗色系统下原生控件（滚动条、checkbox、date picker、光标）渲染成浅色件 | 全站 grep `color-scheme` 0 命中 | `:root { color-scheme: light; }`。本站是单一浅色 ground，不做暗色是合法选择，**但必须声明**，否则等于把原生控件的配色交给浏览器猜 |
| **P0-8** | **正文主色不达 WCAG AA**。`--muted #66717d` 在页面底色 `--paper-deep #ece9e2` 上实测 **4.10:1**（需 4.5:1），而它是全站 **221 处**引用的正文色；`DESIGN.md:121` 声称"≥4.5:1"**不成立** | `styles/base.css:9`；`DESIGN.md:121` | 压到 `#5b6874`（≈4.66:1）或 `#556069`（≈5.05:1），**同步修正 DESIGN.md 的声明**（文档与实现不一致本身是缺陷） |
| **P0-9** | **深底金色不可读**。`--gold #9a6d2e` on `--river-deep` = **2.90:1**、on `--night` = **3.88:1**。系统里已经有专用的 `--gold-light #d9b36a`（6.68 / 8.93:1，且 `base.css:17-20` 的注释写明了用途），footer 与首页收尾 CTA 却没用它 | `SiteFooter.tsx:40,46`；`HomeClient.tsx:320`；对照正确用法 `CulturePageClient.tsx:244` | 深底上一律 `text-[var(--gold-light)]`；把 `--gold` 限定为浅底专用，在 DESIGN.md 写明禁用条件 |
| **P0-10** | **1024px 存在字号悬崖**。hero 在 1023px 顶到 68px，1024px 切到另一条 clamp 得 88.1px——**单像素跳 +30%**。列表页同理 +28%。这是一次 resize 就能看见的跳变 | `HomeAtlasHero.tsx:100`；`CulturePageClient.tsx:84`、`RoutesPageClient.tsx:88`、`InterpretingPageClient.tsx:305` 的 `max-lg:` 覆盖 | 删掉 `max-lg:` 覆盖，改成单一 `clamp(2.8rem, 9vw, 8.4rem)`；或让两段 clamp 在 1024px 处连续 |

### 1.1 P0 批次的验证方式

```bash
# 未定义变量与死 class（应输出 0）
node -e "const fs=require('fs');const s=fs.readFileSync('site/src/app/community/page.tsx','utf8');console.log(/--field/.test(s))"

# 元信息
cd site && npx tsc --noEmit --skipLibCheck && npm run build
# 构建后检查 .next 产出的 <head>：canonical / theme-color / color-scheme
```

浏览器侧（按 `AGENTS.md` §9 的九档宽度）：
- **对比度**：DevTools 取 `--muted` 正文与 footer 金色标签的实际计算色，跑 contrast 检查；**不要只看 token 值**，要取最忙的那一帧的背景采样。
- **skip link**：Tab 一次即应出现，Enter 后焦点落到主内容。
- **地图可达性**：关掉 CSS 视觉、只用读屏（或 `Accessibility` 面板的 full-page tree）确认城市按钮出现在可访问树里。
- **字号悬崖**：1023 / 1024 / 1025 三档实测 `h1` 的 computed `font-size`，确认无极值跳变。

---

## 2. 设计静帧（关掉动效看那一帧）

> motion-web 的核心规则：**动效是优势，不是借口**。一个「关掉动效就撑不住」的页面，调再好的 spring 也救不回来。以下条目都是"静帧"层面的问题。

### 2.1 尺度：两处真实塌方 + 一处层级失衡

| 问题 | 证据 | 现状 → 目标 |
|---|---|---|
| **商品详情页尺度不足**：H1 仅 48px、全页最大 60px，对 16–18px 正文 = **2.7× / 3.75×**，低于 4× 底线 | `ProductDetailHero.tsx:220`（`lg:text-5xl`）；`shop/products/[slug]/ProductDetailClient.tsx:98`（`md:text-6xl`） | H1 → `text-[clamp(3.5rem,7vw,6rem)]`（56→96px），收尾 H2 → `md:text-7xl` |
| **城市详情页尺度擦线**：H1 72px 对 20px 摘要 = **3.6×** | `culture/[slug]/CultureDetailClient.tsx:93,102` | H1 → `xl:text-8xl`（96px），或摘要压到 `sm:text-lg`（18px → 4×） |
| **微字泛滥**：全站 **266 处 <12px**（`text-[10px]`×132、`text-[9px]`×83、`text-[11px]`×28、`text-[8px]`×22、`text-[7px]`×1），共 37 个不同字号。层级变成"巨人 + 尘埃" | `RoutesPageClient.tsx:158`（7px 印章）；`StoreProductCard.tsx:73`（8px 按钮字） | 立一条下限：**可见文字 ≥12px**。10px→12px、9px/8px→11px；`tracking` 从 0.2em 降到 0.14em 补回宽度 |

**首页与列表页的尺度是达标的**（首页 hero 123.8px / 16px = **7.7×**，1920px 下 8.4×；列表页 5.33×），并且用的是真 `clamp()` 流式而非断点级联——这两点要保留，不要因为修 P0-10 的悬崖而退回固定断点。

### 2.2 组件方言混装（本次最需要"一次决策"的项）

对照 `components.md §1` 的实测基线，两套方言是**可测量地不同**的系统：

| 指标 | Creative 中位 | Product 中位 | 本站现状 |
|---|---|---|---|
| 不同圆角档位 | 1 | 8 | **7**（`rounded-full`×64、`var(--radius-sm)`×11、`rounded-sm`×10、`md`×5、`lg`×4、`xl`×3、`rounded-lg`×1，另加 `[2rem]`/`[1.5rem]`/`[1.4rem]` 三个本该是 token 的字面值） |
| 带阴影元素数 | 0 | ~17.5 | **≈90**（28 个不同的任意 `shadow-[...]` 值 + 5 档 Tailwind 尺度阴影 + 47 处规范范式） |

**结论：画布层是 creative（大写按钮、1 个导航 CTA、3 列 footer），卡片层是 product。** 这正是 `components.md` 点名的"用产品站组件搭创意页"，也是"看起来像 AI 做的"这类抱怨最常见的真实来源。

**决策已定（2026-09-18，owner）：卡片方言定为 creative**（与画布一致）。以下为随之执行的收敛：
1. **定义卡片方言为 creative**（与画布一致）。
2. 阴影收敛到 3 档 token：`--shadow-rest` / `--shadow-lift` / `--shadow-panel`，把 28 个任意值逐一映射进去；`StoreProductCard.tsx:23` 的 `shadow-2xl` 直接删。
3. 圆角收敛：删掉与 token 等价的字面值（`[1.4rem]` → `var(--radius-lg)`），把纯 Tailwind 的 `rounded-sm/lg` 归到 token。
4. 卡片**表面 / 边框 / 阴影三选一**，不要三个都上（`ShopPageClient.tsx:171`、`HomeClient.tsx:219`、`CultureGallery.tsx:69`、`ShopPageClient.tsx:145,208` 都是三个都上）。
5. 抬升量定两档：控件 `-2px`、卡片 `-6px`。现在是四套并存（`-2px` / `-8px` / `-7.2px` / **`-16px`**），而 `DESIGN.md §4` 只授权了 `translateY(-2px)`。

### 2.3 模板感与编排

| 问题 | 证据 | 建议 |
|---|---|---|
| **三个列表页共用同一套段序**（① 12 栏 7:5 左文右图 hero ② 筛选条 + 网格 ③ 深底居中 H2 + 单金色按钮），三页结构完全一致 | `CulturePageClient.tsx:76/113/235`、`RoutesPageClient.tsx:80/173/302`、`ShopPageClient.tsx:86/137/227` | 至少给一页换段序：shop 把 CTA 段提到精选之前，或 routes 的 hero 改成全幅 ticket 卡横铺 |
| **三张等宽卡一行重复 4 次** | `CulturePageClient.tsx:180`、`ShopPageClient.tsx:154,217`、`InterpretingPageClient.tsx:357`、`AllProductsClient.tsx:146` | 首页 `HomeClient.tsx:206-216` 已经有正确答案（双列 + `md:pt-20 lg:pt-28` 错位 + 只显示 2 件），移植到 culture 列表页 |
| **社区 hero 是完整默认英雄**：居中标题 + 居中副标题 + 居中统计行 + 两个 `blur-2xl` 有机色团 | `community/page.tsx:509,511-521,503,507` | 改成左对齐"投递栏"式版式（左侧标题 + 右侧最新 1 条 note 预览），删掉两个色团——社区内容本身就是最好的版面素材 |
| **装饰性旋转常规化**：`rotate-1`×19、`rotate-2`×13、`rotate-3`×3、`rotate-[0.7deg]`×4 等共 36 处 | `CultureGallery.tsx:103`、`RoutesPageClient.tsx:260`、`CityArchivalBook.tsx:205`、`GuangdongEventCalendar.tsx:244,295` | Field Journal 语言**允许**小角度旋转（`AGENTS.md` §7 明确认可），但"每张卡都歪 1–2°"会长成新模板。规则：**同一屏内最多 1 个旋转元素**，只用在需要"手贴"语义处 |

### 2.4 配色与间距的体系问题

| 问题 | 证据 | 建议 |
|---|---|---|
| **两套并行配色**：`route.css` 另立 `--route-bg #eeebe5` / `--route-text #1A2A3A` / `--route-gold #C5A039`，与 `--paper-deep #ece9e2` / `--ink #17202a` / `--gold #9a6d2e` 是三组近似但不同的值；`#C5A039` 另有 6 处硬编码 | `styles/route.css:5-9`；`BookingFlowLine.tsx:79-80`、`InterpretingFlowLine.tsx:70,116-117`、`CityArchivalBook.tsx:32` | 删掉 `--route-*` 四行，全部指向 `--paper-deep / --ink / --gold`；6 处硬编码换 `var(--gold)` |
| **间距不靠体系，靠硬编码硬撑**：`--space-section: clamp(4rem,8vw,8.5rem)`（`base.css:31`）与 `.lt-section`（`base.css:129`）**0 处引用**；实际是 `py-16 sm:py-20 lg:py-28` 三档无差别套在每个 section 上 | `base.css:31,129`；`HomeClient.tsx:181,239`、`ProductDetailClient.tsx:62` | 要么启用 `.lt-section`，要么立 3 档语义 token（`--space-tight` / `--space-beat` / `--space-land`），让"紧贴的两段"（如筛选条紧跟其网格）用 tight 而不是 80px |
| **22 个设计系统自己的 class 是死代码**：`.lt-display / .lt-title / .lt-copy / .lt-section / .lt-surface / .lt-kicker / .lux-card / .drop-cap / .journal-paper` 等**全仓引用计数为 0** | 定义处 `base.css:129-181,242`、`components.css:44-71`、`route.css:19-53`、`journal.css:2-15,32`、`interpreting.css:3-26` | **这是一个判定信号：DESIGN.md 描述的是另一套站点。** 要么启用，要么删除并同步删掉 DESIGN.md 的对应章节（尤其 `.lt-surface` 的"玻璃面板"条款）。悬空一半比两者都差 |
| **avatar 色盘 8 色含紫/蓝/森林绿**，超出"两色相 + 中性" | `Avatar.tsx:39-46` | 压到 4 色，全部取自品牌：`river-deep / cinnabar / gold / jade` |
| **footer 版权行 2.56:1**（`text-white/30` on `--river-deep`） | `SiteFooter.tsx:59` | → `text-white/60`（≈6:1） |

### 2.5 对 `bg-grain` 与噪点的判断（**需要与设计基线对齐，不要直接照改**）

审查报告把"`bg-grain` 铺满全站"列为 `design-slop.md` A5"用纹理填补空白"。**我对此持保留意见**：`AGENTS.md` §2 把公开站定义为"evolved Field Journal / Living Field Atlas——editorial, tactile, cinematic"，纸感纹理是这个世界观的构成要素，不是填充物。

**建议不做批量删除**，只做一次一致性检查：确认噪点在浅底段与深底段的密度是否被有意识地控制（`HomeClient.tsx:304` 的深底段无 `bg-grain`，`CulturePageClient.tsx:237` 有——这种不一致值得看一眼，但不构成缺陷）。

---

## 3. 动效系统

### 3.1 诊断：装了 rung 4 的库，做着 rung 1 的事

按 `build-mode.md` 的 Tech Stack Decision Ladder，rung 4（GSAP + ScrollTrigger）有**四条准入理由**。本站实测：

| rung 4 准入条件 | 实测 |
|---|---|
| `pin:` 钉住 | **0 次** |
| `snap` 吸附 | 0 次 |
| 可寻址时间轴（外部 seek） | 0 个 |
| 跨非兄弟元素编排 | 0 个 |

**四条一条都不成立。** 同时装载了 GSAP + ScrollTrigger + `@gsap/react` **和** framer-motion 12 两套库。

**建议：不要急着拆库。** 先做两件有明确收益的事：
1. 把 `Reveal` / `ScrollProgress` / 4 条 parallax 降到 **rung 1.5**（原生 CSS `animation-timeline` / `scroll()` / `@starting-style`），Firefox 拿静态终态。这能让断点变化不再重建任何 JS 状态（见 §3.3 #3）。
2. 保留 GSAP 只用于真正需要时间轴的 5 处链式 intro：`PastoralPageMotion.tsx:49-59`、`CommunityJournalMotion.tsx:36-53`、`ProductDetailHero.tsx:74-108`、`RouteBrief.tsx:30-36`、`CultureDetailClient.tsx:42-47`。
3. **framer-motion 保留在依赖树中（owner 决策已定，按方案建议执行）**。5 处用法（`RoutesPageClient`、`CulturePageClient`、`RoutesMegaMenu`、`RelatedRouteHub`、`RelatedCitiesHub`）均可用 CSS transition / WAAPI 替代，但改依赖树属架构级改动，**不与视觉改动混在同一次发布**——留作独立的技术债批次（见 §6 批次 E）。

### 3.2 Token 层：这是所有动效问题的根

`site/src/lib/motion.ts:9-13` 全文只有 3 个 easing 常量：

```ts
export const motionEase = { enter: "power3.out", exit: "power2.in", emphasized: "expo.out" } as const;
```

其中 `exit` **零引用**（死代码）。**没有 duration scale、没有 spring、没有 stagger、没有断点常量。**

后果是实测出来的 **19 个互不相干的活动画时长**：`0.24 / 0.38 / 0.42 / 0.45 / 0.5 / 0.55 / 0.58 / 0.62 / 0.7 / 0.75 / 0.76 / 0.78 / 0.8 / 0.82 / 0.9 / 1.05 / 1.1 s`，加 5 个不同 scrub（`0.2 / 0.6 / 0.7 / 0.8 / 0.9`）、3 个 framer 时长；且**单位混用**——`Reveal.tsx:14` 收 `duration=750`（ms）再 `÷1000`，`StatsCounter.tsx:12` 收 `1800`（ms），其余全是 seconds。

**建议落地一支 duration scale（对照 `motion-tokens.md`）：**

| token | 值 | 用途 |
|---|---|---|
| `fast` | 0.2s | 状态反馈、hover、切帧 |
| `standard` | 0.32s | 页面转场、小元素入场 |
| `medium` | 0.45s | 常规入场 |
| `slow` | 0.7s | 强调入场 |
| `cinematic` | 1.1s | 全幅媒体、首屏 |

并统一 `--scroll-scrub: 0.45`（同页多层用不同 scrub 会让 parallax 层之间相对漂移——`ScrollProgress` 的 0.2 与 `CommunityJournalMotion` 的 0.9 相差 4.5 倍，同页共存）。

`Reveal` 与 `StatsCounter` 的 prop 改为秒，消除单位歧义。

### 3.3 手感：为什么读起来"四平八稳"

`handfeel.md` 的诊断表把"顺但是没劲"归因到三个可测特征，本站**全部命中**：

**(1) 缓动单向退化。** 全站活动缓动只有 `power3.out` / `expo.out` / `none`。**零 overshoot、零 spring、零 secondary motion、零 velocity coupling。**

尤其值得指出：所有带旋转的入场都用 `expo.out`（`PastoralPageMotion.tsx:57` 的 stamp `rotation -16`、`CommunityJournalMotion.tsx:51`、`ProductDetailHero.tsx:94-101`）。`expo.out` 是"起始段最快、末端最长爬行"的曲线，用在"盖章/落下"语义上恰恰是**最差的一条**——盖章需要的是快落 + 一次轻微回弹。

> **建议**：新增 `motionEase.stamp = "back.out(1.6)"`，用于一切"落下 / 盖章 / 归位"的旋转入场。这一条改动小、感知强。

**(2) 移动端零入场动效。** `Reveal` 是站级唯一入场原语（静态计数约 45–60 个实例，`StoreProductCard.tsx:20`、`FieldKit.tsx:244` 还会按数据条目倍增），却被 `Reveal.tsx:25` 的 `(min-width: 768px)` 门控——**`<768px` 直接 `clearProps` 返回**。也就是说：**手机上全站没有任何入场动效。** 而同文件里更贵的 scrub parallax 反而保留在桌面。

> **建议**：`Reveal` 的 `y:18` 是最便宜的 transform（只动 `y`、不动 opacity，因此天然避开 reduced-motion 下"内容被留在隐藏态"的陷阱）。**取消桌面门控**，只保留 `prefers-reduced-motion` 门控；真要省性能，把 `y` 从 18 降到 12，而不是整段砍掉。
> 顺带统一断点写法：现在有 `768px`（`PastoralPageMotion.tsx:28`）、`768px + pointer:fine`（`CommunityJournalMotion.tsx:110`）、`1024px`（`HomeAtlasHero.tsx:38`）、`1024px + pointer:fine`（`ProductDetailHero.tsx:68`）四种，应导出为 `motion.ts` 里的常量。

**(3) 跨断点重放全部入场动画。** `gsap.matchMedia()` 是每组件实例一个，条件变化时 revert 旧 context 再重跑回调 → `once: true` 的 ScrollTrigger 被重建，元素已越过触发线便**立即重放**。手机 390 → 844 横屏、平板跨 1024 会整页重放。首页单页就有约 12 个独立 matchMedia 实例。

> **建议**：收成"每页一个共享实例"（一个 `MotionProvider` 里的 `gsap.matchMedia()`），并用持久标记（`data-revealed`）阻止重放；或直接改用 rung 1.5 让断点变化不再重建 JS 状态。

### 3.4 结构性问题（逐条）

| # | 问题 | 证据 | 建议 |
|---|---|---|---|
| 3-1 | **hero 永远在放大 + 与滚动同向漂移**。三条 hero parallax 参数互不相同，且 `scale` **单调递增、下限 1.06** → 图像永久放大 6%、永久被裁、永久重采样发软；`yPercent` 是**正值**意味着滚轮向下时图层**也向下**，读作"画面在飘"而非视差 | `PastoralPageMotion.tsx:82-96`（1.06→1.1, yPercent −2→5）；`HomeVideoChapter.tsx:113-127`（1.08→1.14, −2→2，区间是 **2 屏**）；`HomeAtlasHero.tsx:56-69`（1.04→1.1, xPercent 0→2） | 定 token：scale `1.02→1.06`、shift `−3%→0`、`--scroll-scrub: 0.4`。scale 起点降到 1.02（保留重采样余量），**yPercent 改为负向**（图层比滚动慢 → 正确纵深），三条 hero 统一。区间统一为 `top top → bottom top`（一屏），避免 2 屏区间里一半运动发生在画面外 |
| 3-2 | **`data-pastoral-title` 是死脚手架**。5 个页面的 hero 标题都带这个属性，其中 3 个还套了 `overflow-hidden` 遮罩（明显是为"逐行 clip 上升"准备的），但 `PastoralPageMotion` 只查询 kicker/subtitle/stamp，**标题永不参与动画** | `PastoralPageMotion.tsx:34-37,44-46`；`CulturePageClient.tsx:85-86`、`InterpretingPageClient.tsx:306-307`、`ShopPageClient.tsx:92-93`、`RoutesPageClient.tsx:90,93` | 二选一：① 补 `[data-pastoral-title]` 的 `yPercent: 105→0` 逐行遮罩入场（用现成的 `overflow-hidden` 父层，duration 0.7 / stagger 0.09 / `power4.out`）；② 删掉属性与多余遮罩。**悬空一半比两者都差** |
| 3-3 | **`ScrollProgress` 在 reduced-motion 下整条消失**，把"读到哪了"的信息一并删掉——进度指示不是前庭风险项 | `ScrollProgress.tsx:32-34` | 改为保留可见：reduce 时用纯 CSS `animation-timeline: scroll()`（rung 1.5，合成器线程）或至少保留一条静态基线 |
| 3-4 | **SVG / 布局属性被当成动画属性**。对 22 条省份 path 用 `transition-all duration-500`（会连 `stroke-width` 一起过渡 → 每次 hover 触发整片重绘）；`group-hover:w-16` 动的是 `width` | `GuangdongMapSection.tsx:415,447,499`；`HomeClient.tsx:201` | `transition-all` → `transition-[fill]`；`w-16` → `scaleX(1.6)` + `transform-origin:left` |
| 3-5 | **hover 会重放入场动画**。移动面板的 `fromTo` 挂在 `resolvedActiveCode` 上且 `revertOnUpdate: true`，而该值由 `onMouseEnter` 驱动 → 在地图上划过多个城市会连续重放 0.5s 的入场 | `GuangdongMapSection.tsx:264-285,426-428` | 面板入场与"选中城市"解耦：只在首次进入视口播一次，城市切换只做内容交叉淡化（0.2s opacity） |
| 3-6 | **全屏 clip-path 入场**。对整个全宽 section 做 `clipPath: inset(12% 0)` | `HomeVideoChapter.tsx:95-109` | 改为对内部 `[data-home-film]` 容器做 clip，保持 section 本体不被裁剪 |
| 3-7 | **全局 reduce 规则过宽**。`*` 上 `transition-duration: 0.01ms !important` 把 hover 底色、焦点环等**非动效反馈**也一起瞬时化，reduce 用户同时失去状态过渡提示 | `base.css:316-325` | 收窄到需要抑制的动效选择器，或给交互态白名单 120ms |
| 3-8 | **`will-change` 清除存在竞态**：`pointerleave` 里用 `gsap.set(..., delay:0.55)` 排零时长 tween，但它不会因随后 `pointerenter` 而被 kill → 用户 0.55s 内回到卡片，图层提示会在动画进行中被移除且不补回 | `CommunityJournalMotion.tsx:130,135`；`ProductDetailHero.tsx:124,129` | 改用 `gsap.delayedCall()` 并存句柄，`pointerenter` 时 `kill()` |

### 3.5 死代码：5 个组件 + 一批 CSS 动画

> **重要修正**：审查初稿列出 6 个零引用组件，经人工复核，**`InterpreterShowcase` 实际在用**（`InterpretingPageClient.tsx:15,423`），仍在线上运行。以下 **5 个**才是确认零引用：

`CityArchivalBook.tsx`（整册翻页 + bloom scrub）、`InterpreterFlipCard.tsx`、`StatsCounter.tsx`、`InterpretingFlowLine.tsx`、`BookingFlowLine.tsx`。

**决策已定（2026-09-18，owner）：判定为废弃代码，清理。** 判据：城市详情页已改为纯 Markdown 渲染（`culture/[slug]/CultureDetailClient.tsx` + `MarkdownRenderer`，react-markdown + remark-gfm），`CityArchivalBook` 的整册翻页**已不在任何渲染路径上**，"待启用资产"的前提不成立。清理前的记录——这些 bug 会随"有人复用"一起回来：

- `InterpretingFlowLine.tsx:110` 的 `className="interpreting-dot-pulse"` **在全部 CSS 中未定义** → 脉冲环永不脉冲。
- `BookingFlowLine.tsx:48,71-74` 的 `pathLen = 600` 是硬编码常量而非实测长度（真实长度≈100 用户单位）→ 描线在 `p≈0.83` 处从"完全不可见"突跳到"完全画出"，**中间 83% 的滚动毫无变化**。对照正确写法是 `InterpretingFlowLine.tsx:15` 的 `getTotalLength()`。同文件还叠了 `vectorEffect="non-scaling-stroke"`（与 dasharray 同用是有害组合）。
- `InterpretingFlowLine.tsx:92-94` / `BookingFlowLine.tsx:72-74`：`stroke-dashoffset` 既被 rAF 每帧写值、又有 CSS `transition` → transition 永远追不上每帧写入，产生持续滞后。**保留 JS 写值就删掉 inline transition，反之亦然。**
- 未使用的 CSS 动画：`components.css:265-277` slow-float、`route.css:63-91` waypoint-pulse / blink-arrow / discovery-item、`interpreting.css:3-26` heroZoom / driftBg、`journal.css:27-30` `@keyframes tape-stick`（无选择器绑定）。

---

## 4. 成品度（从"能跑"到"成品"）

`production-polish.md` 把这些列为"要么有要么是缺陷，没有判断余地"。

### 4.1 元信息层（缺失最集中）

| 项 | 现状 | 建议 |
|---|---|---|
| `<title>` | `layout.tsx:12` 只有 **16 字符**（`"Culvoy Guangdong"`），且全站只此一处 → 搜索结果的唯一一行被浪费 | 改为 40–60 字符的长标题；各页用 `export const metadata` 覆写 |
| `rel=canonical` | **0 命中** | 见 P0-4 |
| `theme-color` | viewport 导出无 `themeColor`（仅 `manifest.ts:12` 有 `theme_color`） | viewport 加 `themeColor: [{ media: "(prefers-color-scheme: light)", color: "#ece9e2" }]` |
| `color-scheme` | **0 命中** | 见 P0-7 |
| `twitter-image` | 只有 `opengraph-image.png`（1200×630 ✅）→ X 卡片可能无图 | 加 `twitter-image.png` 或 metadata 里 `twitter.images` |
| `manifest` icons | 只有 `favicon.ico`（无 192/512 PNG），`display: "browser"` | 补 192/512 PNG |
| `icon.svg` | 不存在（`.ico` + `apple-icon.png` 180×180 ✅） | 视需要补 |
| JSON-LD | **0 命中** | 首页加 `Organization`，路线/商品详情加对应 schema |
| sitemap | ⚠️ `lastModified: new Date()` 每次构建都变 → 搜索引擎视为天天改版；只列 6 条顶层路由（代码注释说明详情页**有意**不收录） | `lastModified` 改为真实内容更新时间或构建常量。**详情页不收录是有意决策，不要动** |
| robots.txt | ✅ 已 disallow `/api/ /preview/ /account/ /profile/ /checkout/` | — |

### 4.2 触屏与媒体

| # | 问题 | 证据 | 建议 |
|---|---|---|---|
| 4-1 | **hover 规则未包 `@media (hover: hover)`** → 触摸端 hover 态粘住不消失 | `components.css:117,150,168,186,202,219,234`；`base.css:202,211,221,230`；兜底只有 `base.css:306-314`（仅覆盖 `.lux-card`/`.scrapbook-shadow`） | 把这些 hover 规则包进 `@media (hover: hover) and (pointer: fine)`。（Tailwind 的 `hover:` 在 v4 已自动带 media，不受影响） |
| 4-2 | **22 个 `<img>` 只有 1 个写了 `width/height`，0 处 `srcset`/`sizes`** | `MarkdownRenderer.tsx:41` 是唯一带尺寸的；`srcset` 0 命中 | 至少给非 `aspect-ratio` 容器的图片补尺寸；`srcset` 是带宽与 LCP 的直接收益 |
| 4-3 | **缺 `scrollbar-gutter: stable`** → 每次开移动抽屉 / `FieldKit` 弹窗锁 `body` 滚动时页面横向跳动 | `base.css:63-76`；`SiteHeader.tsx:63-64`、`FieldKit.tsx:93-94` 都设了 `body.style.overflow = "hidden"` | `html { scrollbar-gutter: stable; }` **一行** |
| 4-4 | 4 处装饰性 `animate-pulse` 圆点未 `aria-hidden` | `BookingSection.tsx:135`、`StickyComposeBar.tsx:233`、`InterpreterShowcase.tsx:108`、`GuangdongEventCalendar.tsx:240` | 加 `aria-hidden="true"` |
| 4-5 | 无全局 `accent-color` / `caret-color` | 仅 `MarkdownRenderer.module.css:85` 局部有 | `:root { accent-color: var(--cinnabar); }` |
| 4-6 | 页脚年份硬编码、用 `(c)` 而非 `©`、邮箱是纯文本不是 `mailto:`、无隐私/条款入口（站点收集账号 + 支付数据） | `translations/common.ts:6`；`SiteFooter.tsx:56` | 年份用 `new Date().getFullYear()`；`©`；包 `mailto:`；补隐私/条款 |

### 4.3 可发现性：两处"透明热区"

按 `affordance.md §1` 的三问（①怎么知道能交互 ②有没有可见邀请 ③邀请会不会过期）——**"能点 ≠ 看得出能点"**。

| 元素 | 文件:行 | 未通过 | 最小邀请设计 |
|---|---|---|---|
| **归档书左右翻页热区**：完全透明、无任何可见标记的 56px 条，只靠 `cursor-pointer` 区分（**光标不是邀请**） | `CityArchivalBook.tsx:653-674` | **Q2** | 书口左右缘常驻一个折角/页签箭头图形（复用已有的 `BOOKMARK_COLORS` 语言），hover 加深；`aria-disabled` 也要落到真 `disabled` 上。（**注意此组件当前零引用**，改动前先定归属） |
| **移动端横向滑动区共 5 处**：滚动条被 `scrollbar-hide` 隐藏，首屏看不到还能往右滑 | `HomeClient.tsx:206`、`CultureGallery.tsx:86`、`GuangdongMapSection.tsx:565`、`community/page.tsx:527,557` | **Q2** | 右缘 24px 渐隐遮罩 + 让第 2 张卡露出 12–16%（peek）。比任何文案都便宜且不会过期 |
| 首页 SVG 地图（有内容的城市） | `GuangdongMapSection.tsx:437-513` | **Q1+Q2** | ① 见 P0-5；② 至少给"有内容"的城市常驻一个可见点标，不要等到激活才画（`:502` 非激活标签 `opacity-0`，触摸端只有 tap 后才出现） |
| 翻转卡 | `InterpreterFlipCard.tsx:46-48` | Q2 勉强通过（用整句文案） | 依 affordance §8「字只做叙事」：把整句换成卡角一个 ↻ 图形印章。（**此组件当前零引用**） |
| 路线地图标记点 | `RouteMapCanvas.tsx:100-107` | **判定为非交互**（`interactive={false}`、`cursor-default`） | **无需处理**——它本来就是示意图，`role="img"` + `aria-label` 是对的 |

### 4.4 状态矩阵

> 说明：`base.css:89-92` 有全局 `:focus-visible { outline: 2px solid var(--cinnabar) }` 且**未分层**，会覆盖 Tailwind 分层里的 `outline-none`——所以焦点环全站是有的。下表只标"是否缺状态"。

| 组件 | 缺哪个 |
|---|---|
| `store/ProductActions.tsx` | disabled, loading, error |
| `ui/FavoriteButton.tsx` | active, loading, error（`pushFavorite` fire-and-forget，失败静默） |
| `store/StoreProductCard.tsx` | active |
| `ui/LoginPanel.tsx` | 字段级错误（只有表单级，无 `aria-describedby`） |
| `interpreting/BookingSection.tsx` | active, error |
| `interpreting/MultiStepForm.tsx` | active, `aria-busy`，字段级错误；按钮标签在 "Continue"/"Opening deposit…" 间切换会**改变宽度** |
| `community/FieldKit.tsx` | 错误框 `:497` 无 `role="alert"`/`aria-live` |
| `layout/SiteHeader.tsx` | active |
| `layout/MobileStickyActions.tsx` | hover, active, disabled, loading |
| `home/GuangdongEventCalendar.tsx` | active, disabled, loading |
| `ui/ArchiveFilterBar.tsx` | active, disabled |
| `interpreting/InterpreterFlipCard.tsx` | hover, active, 空格键（只有 Enter）（**零引用**） |
| `routes/RouteMap.tsx` | **无缺失**（范本） |

**本站在这一项上明显强于同类站点**——列表页三态齐全、空状态有文案也有出路、`MediaFrame` 处理了 poster 回退与失败降级。上面的缺口集中在"提交类"组件的 loading/error 细腻度。

---

## 5. owner 决策（2026-09-18 已确认）

| # | 决策项 | 结论 | 对方案的改动 |
|---|---|---|---|
| D1 | 组件方言 creative / product | **creative**（与 `AGENTS.md` §2 的 Field Journal 定位一致） | 批次 B 解锁：卡片层按 creative 收敛——阴影 3 档 token、圆角归 token、表面/边框/阴影三选一、抬升两档。**同时需在 `DESIGN.md` 侧记录该决定**，否则下次仍会出现方言漂移 |
| D2 | 5 个零引用组件的归属 | **判定废弃、清理** | 判据：城市详情页已改为纯 Markdown 渲染（`culture/[slug]/CultureDetailClient.tsx` + `MarkdownRenderer`），`CityArchivalBook` 的整册翻页已不在渲染路径上，"待启用资产"前提不成立。删除作为独立清理提交，清单见 §3.5 |
| D3 | 是否移除 framer-motion | **保留，独立批次处理**（按方案建议） | 批次 C 不动依赖树；新增批次 E 专门做依赖瘦身，触发条件为批次 C 完成 |

> **D1 落地前需补一步**：§7 第 1 条已声明，"7 档圆角 / ≈90 处阴影"是 **class 出现次数统计**，不是 `components.md §1` 那种 computed-style 探针读数。收敛目标需要基线，建议先跑一次探针（1440×900 / 390×844），把 90 拆成"待映射"与"已合规"两堆，再定映射表。

---

## 6. 执行路线图

分四批，每批都可独立验证、独立发布。**同一批内不要混入下一批的内容**——`AGENTS.md` §11 要求一次逻辑改动对应一次精确提交。

### 批次 A — 确定性缺陷（风险最低，建议先做）

P0-1 … P0-10 + 4-3（`scrollbar-gutter`，1 行）
- 涉及：`community/page.tsx`、新增 `error.tsx`/`global-error.tsx`、`SiteHeader.tsx`、`layout.tsx`、`GuangdongMapSection.tsx`、6 个页面的 `<main>`→`<div>`、`base.css`、`SiteFooter.tsx`、`HomeClient.tsx`、4 处 clamp
- 预期 diff：小、局部、无设计判断
- 验证：`npx tsc --noEmit --skipLibCheck`、`npm run lint`、`npm run test:ci`、`npm run build` + §1.1 的浏览器检查

### 批次 B — 设计系统纪律（方言已定 creative）

- 阴影收敛到 3 档 token；圆角收敛；卡片"表面/边框/阴影三选一"；抬升量定两档
- 字号阶梯修复（商品详情 / 城市详情 / 266 处微字）
- `--route-*` 并入主 token；间距 3 档语义 token
- design-slop 相关：社区 hero 改造、三列表页段序差异化、三卡网格错位化
- 验证：**关掉动效截图**（`prefers-reduced-motion` 或临时注掉动效），以静帧单独验收 —— 这是 motion-web 明确要求的第一道闸门

### 批次 C — 动效系统（依赖 B 的 token 落位）

- `motion.ts` duration scale + `--scroll-scrub` 统一 + 断点常量导出
- `motionEase.stamp = "back.out(1.6)"` 用于旋转入场
- `Reveal` 取消桌面门控（移动端恢复入场）
- matchMedia 收成每页一个共享实例 + `data-revealed` 防重放
- hero parallax 三参数统一（scale 起点 1.02、yPercent 转负、区间一屏）
- `data-pastoral-title` 二选一落地
- 降级到 rung 1.5：`Reveal` / `ScrollProgress` / 4 条 parallax
- 3-4 / 3-5 / 3-6 / 3-7 / 3-8 逐条修
- **不做**：移除 framer-motion（已决策保留，见 §6 批次 E）
- 验证：九档宽度浏览器实测 + reduced-motion 逐页确认无元素卡在 `from` 关键帧 + 移动端首次获得入场动效后复测滚动性能

### 批次 D — 成品度与可发现性

- 元信息：title、theme-color、twitter-image、manifest icons、JSON-LD、sitemap `lastModified`
- 触屏：`@media (hover: hover)` 包裹、图片尺寸、`accent-color`
- 可发现性：5 处横向滑动区渐隐+peek、地图城市常驻点标
- 状态矩阵缺口：提交类组件的 loading/error/`aria-busy`/宽度锁定
- 验证：`production-polish.md §9` 的十项人工检查 + 真机触屏确认 hover 不粘

### 批次 E — 依赖瘦身（独立发布，不与 A–D 混合；触发条件：批次 C 完成）

- 移除 framer-motion；此时 GSAP 使用面已按 §3.1 收窄到 5 处链式 intro，一并评估是否值得保留 ScrollTrigger
- 同步更新 `site/package.json` 与 lockfile，跑完整 site 验证四件套 + 九档浏览器实测
- **不与批次 C 同批发布**：C 改的是动效行为、E 改的是依赖树，混在一起会让回归定位困难

---

## 7. 这份方案的边界（批判性说明）

**以下事项本次审查无法判定，方案中不应对其下结论；如需推进，先补测量：**

1. **组件方言的精确读数**。本报告的"7 档圆角、≈90 处阴影"是 **class 出现次数统计**，不是 `components.md §1` 那种 computed-style 探针计数。要拿到可比数字，需要在 1440×900 / 390×844 跑 `scripts/measure_structure.py` 那套探测。
2. **对比度修复值需实测确认**。`#5b6874` / `#556069` 是按公式推算的建议值；正文压在照片上的**最坏帧**（`HomeAtlasHero` 的渐变遮罩在 `<1024px` 会切换成底部遮罩，正文落点随之改变）必须在 375 / 768 / 1440 实拍采样，不能用幸运截图。
3. **CLS / LCP 的量化影响**。4-2（22 个 `<img>` 只有 1 个有尺寸）的实际得分影响必须实测；绝对定位拉伸的图片（`HomeClient.tsx:277-283`、`GuangdongMapSection.tsx:320-326`）无法从源码判断。
4. **`Reveal` 断点重放的真实频率**。取决于 `gsap.matchMedia` 在 conditions 变化时是否重建 ScrollTrigger 并立刻补播——需在 390px 加载后转横屏实测计数。
5. **hero parallax"飘"的观感**。`yPercent -2→5` 与 `scale 1.06→1.1` 叠加后的实际位移比例需录屏逐帧量；数值上 y 位移（7% 图高）已大于 scale 增量（4%），倾向"飘"，但最终判据要在 1440px 实机滚动下看。
6. **`.lt-*` 等 22 个死 class 是否被跨仓引用**。只在 `site/src` 内做了引用计数；`site` 是独立构建，理论上不受 admin 影响，但未排除动态拼串。
7. **`<title>` 的页面级覆盖情况**。只确认源码里只有 `layout.tsx` 一处 `title`；是否有页面用 `generateMetadata` 动态注入需跑起站点逐页取 `<head>`。

**另外，有一项我明确不采纳子代理的建议**：§2.5 的 `bg-grain` 批量删除。纸感纹理是 Field Journal 世界观的构成要素（`AGENTS.md` §2），不是"用纹理填补空白"。只建议做一致性检查，不建议删除。

---

## 8. 一句话交给团队

> 这个站的**静帧在首页和列表页站得住**，塌方在**商品/城市详情页的字号**、**`--muted` 与深底金色的对比度**、**卡片层那 90 处阴影和 7 档圆角**；
> **动效的问题不是"做得少"，而是没有 token、缓动单向、移动端为零、装了 rung 4 的库却做着 rung 1 的事**——所以它读起来"平滑但没有主张"。
>
> 前两类是数值修复（改几个 token + 几处 clamp），第三类需要**先决定"卡片到底是 creative 还是 product"**，再按 `components.md §1` 的方言表一次性收敛，而不是逐页调。
>
> **决策已落（2026-09-18）**：creative · 五个零引用组件判废弃清理 · framer-motion 保留至独立批次。推进顺序 A → B → C → E，D 可与 C 并行。