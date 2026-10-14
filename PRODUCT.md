# Product

## Register

brand

_Site frontend: brand. Admin backend: product (functional tool, design serves the workflow)._

## Users

- **国际游客 / C 端消费者** — 浏览广东文化旅游内容、预订路线、购买文创商品、预约口译服务。使用场景：旅行规划阶段，在桌面或移动端查阅。
- **旅行社与 B 端合作方** — 通过管理后台维护路线、商品、活动日历、社区内容。使用场景：日常运营，桌面端为主。

## Product Purpose

Culvoy Guangdong 连接广东在地文化、故事驱动路线、口译服务和岭南文创零售，为国际游客提供一站式深度旅行体验。产品目标：
1. 用叙事驱动的方式展示广东，而非传统 OTA 列表式陈列
2. 降低境外游客的语言与文化门槛
3. 构建可运营的内容+电商+服务三合一平台

## Brand Personality

**专业、信任、温暖**

- 像一本精心编辑的田野日志（field journal），而非冰冷的功能面板
- 像一位博学的本地向导，而非机械的信息聚合器
- 质感优先：纸张肌理、档案式排版、手工感细节传递温度

## Anti-references

- ❌ 冷冰冰的企业 SaaS 风格（白底灰字、无表情的表格和仪表盘）
- ❌ 过度促销的电商模板（弹窗、倒计时、闪烁折扣标签）
- ❌ 千篇一律的 AI 生成式 landing page（渐变文字、玻璃卡片、英雄指标模板）

## Design Principles

1. **Field Journal First** — 每个页面都应像田野日志中的一页：有质感、有层次、有手工痕迹。Scrapbook 美学贯穿始终。
2. **Story Before List** — 用叙事结构组织内容，而非纯列表/网格。每条路线、每件商品、每个城市都应有一段故事。
3. **Warmth Through Texture** — 温度来自材质（纸张底色、墨迹、胶带、阴影）而非仅靠暖色调。避免默认暖色调底色的 AI 套路。
4. **Controlled Contrast** — 朱砂红（cinnabar）和金色（gold）作为点缀色，严格控制在 ≤10% 的视觉面积。深河色（river-deep）承载主要信息层级。
5. **Editorial Authority** — 排版应有杂志/出版物的权威感，Georgia 衬线标题 + Trebuchet MS 正文，拉开层次而非堆砌粗体。

## Feedback Development Scope (2026-10-14)

The confirmed 2026-10-08 feedback adds business functionality beyond the earlier
visual-only overhaul. Cultural Information, Route Planning and Interpretation
are the three primary discovery paths, retaining their existing URLs.

- Fixed-route booking has no route fee or mandatory deposit. Interpretation is
  an optional, separately priced service; third-party travel costs are not
  represented as included.
- Custom-route planning is paid and begins with a structured request and a quote.
  Interpretation packages use fixed USD prices: 4/5/7 hours at 305/375/525 for
  fixed routes and 400/500/700 for custom routes. Historical orders retain their
  original currency and amount. Deposit, payment timing, refund and planning-fee
  policy must be confirmed before enabling new paid checkout.
- The public calendar defaults to today in Asia/Shanghai, supports multiple
  published media items and preserves publication versions. Private calendar
  notes belong only to the authenticated traveler in Profile.
- Community filtering uses stable city, route and interpreter associations.
  Request conversations are private to the owner and authorized assigned staff.
- Anonymous visitors may generate a city souvenir PNG ticket in the former home
  interpretation section. Tickets do not certify attendance or provide admission.
  The homepage shop remains available.

Implementation and categorized verification are recorded in
[`docs/feedback-development-report-2026-10-14.md`](docs/feedback-development-report-2026-10-14.md).
Local development authorization does not authorize production migrations,
content writes, pushing or deployment.

## Accessibility & Inclusion

- 目标 WCAG 2.1 AA 级别
- 已实现 `prefers-reduced-motion` 完全禁用动画
- 移动端已做触摸友好处理（hover 重置、iOS 输入防缩放）
- 需关注：gold 色文字/按钮在浅色背景上的对比度可能不足，后续审计中重点检查
