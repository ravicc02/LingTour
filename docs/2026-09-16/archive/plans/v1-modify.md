# Culvoy V1 技术执行与详细规格方案 (Agent 专用版)

> ⚠️ **历史文档失真标注（2026-09-16）**：本文中的域名记载曾被 rebrand 提交 `9cb4eb0` 批量误替换——文中出现的 `culvoy.com` 族域名，在本文写作时均为 `lingfengtranstour.cn` 族（如 `api.lingfengtranstour.cn`）。阅读时应按此理解。

本方案旨在为 Agent 提供清晰、可执行的路径，用于实现 Culvoy 的系统性升级。

---

## 1. 全局交互与导航 (Global UX & Navigation)

### 1.1 全局悬浮抽屉 (Global Drawer)
*   **目标文件**：`src/components/layout/GlobalDrawer.tsx`, `src/components/layout/SiteHeader.tsx`
*   **技术细节**：
    *   使用 `framer-motion` 实现从右侧滑出的 `AnimatePresence` 抽屉。
    *   **状态管理**：创建一个轻量级 `useGlobalStore` (推荐 Zustand) 或 `UIContext` 来控制 `isDrawerOpen`。
    *   **内容规格**：
        1. **Favorites Segment**：读取 `localStorage` 中的 `culvoy-favorites`，以卡片流形式展示。
        2. **Cart Segment**：读取 `culvoy-cart`，展示已选文创产品及“去结算”按钮。
        3. **Recent Routes**：展示用户最近查看过的 3 条路线。
*   **审美要求**：背景使用 `backdrop-blur-xl` 和 `rgba(242, 238, 230, 0.95)`。

### 1.2 页面平滑转场 (Smooth Page Transitions)
*   **目标文件**：`src/app/layout.tsx`
*   **技术细节**：
    *   在 `RootLayout` 中包裹 `AnimatePresence`。
    *   定义全局 `PageTransition` 组件，使用 `opacity` 和 `y: 10` 的淡入效果。
    *   **进阶逻辑**：根据路由名称动态调整背景色过渡（如 `/culture` -> `/routes` 时，背景色从 `#F2EEE6` 平滑过渡到深色系）。

---

## 2. 文化与路线的深度耦合 (Deep Linking)

### 2.1 城市页面的“路线枢纽”组件
*   **目标文件**：`src/app/culture/[slug]/page.tsx`, `src/components/culture/RelatedRouteHub.tsx`
*   **实现逻辑**：
    1. 在 `CityCulturePage` 中，根据 `city.routeSlugs` 过滤 `storyRoutes`。
    2. 开发 `RelatedRouteHub` 组件：
        *   **UI**：左侧展示路线摘要，右侧展示微缩版 `GuangdongMap`（仅高亮显示该路线经过的 adcodes）。
        *   **交互**：点击地图上的点，悬浮显示该站点的“故事缩略图”。

### 2.2 动态 MegaMenu 地图交互
*   **目标文件**：`src/components/layout/RoutesMegaMenu.tsx`
*   **优化动作**：
    1. 为地图 `path` 增加 `onMouseEnter` 事件。
    2. 当悬停在某个区域（如“Chaoshan Coast”）时，MegaMenu 右侧的内容区通过 `AnimatePresence` 切换展示该区域的精华路线预览。

---

## 3. 翻译预订流 (Interpreting Flow)

### 3.1 信任建立板块 (Trust Layer)
*   **目标文件**：`src/app/interpreting/page.tsx`, `src/components/interpreting/InterpreterShowcase.tsx`
*   **组件规格**：
    *   创建一个 `InterpreterShowcase` 组件，展示 3 张卡片。
    *   **视觉细节**：使用黑白滤镜照片，悬停时变为彩色。卡片标注：专业（如：History & Heritage）、语言（English / Cantonese）、服务次数。
    *   **关联逻辑**：点击卡片底部的 "Select this guide"，自动跳转到预订表单并锚定到“需求描述”框，预填“I prefer a guide with heritage expertise...”。

### 3.2 表单逻辑增强
*   **目标文件**：`src/components/interpreting/MultiStepForm.tsx`
*   **修改动作**：
    1. 第一步增加 **"Fast Track"** 模式切换开关。
    2. 如果开启 Fast Track，表单仅保留：姓名、Email/WhatsApp、预订城市。
    3. 增加一个“日历组件”，以更直观的方式选择服务日期。

---

## 4. 文创商店详情页 (Shop Detail)

### 4.1 叙事性内容增强
*   **目标文件**：`src/components/store/ProductNarrative.tsx`
*   **规格**：
    *   增加 **"Origin Trace"** 模块。
    *   **内容**：一段关于产品原材料与产地的深度描述（例如：雷州半岛的火山泥如何被转化为茶具）。
    *   **交互**：底部增加一个“回到故事起源地 (Back to the City Story)”按钮，链接回 `/culture/zhanjiang`。

---

## 5. 页面完整性与兜底 (Completeness & Edge Cases)

### 5.1 统一的“内容策展中”组件
*   **目标文件**：`src/components/ui/CuratingPlaceholder.tsx`
*   **技术细节**：
    *   用于 `getCityCulture` 返回为空或未定义详情的城市。
    *   **视觉设计**：一个缓缓旋转的 Culvoy Logo，配合文字：“Our editors are currently walking the streets of [City Name] to curate its story. Join the waitlist to be notified.”
    *   **功能**：集成一个极简的 Email 订阅框。

### 5.2 移动端“单手模式”
*   **目标文件**：`src/components/layout/MobileStickyActions.tsx` (新组件)
*   *逻辑*：在 `/routes/[slug]` 和 `/interpreting` 页面，当屏幕宽度 < 768px 时，底部显示半透明磨砂质感的浮动操作条，包含“立即预订”或“联系咨询”。

---

## 6. 审美标准 (Aesthetic Checklist for Agent)

*   **Spacing**：严格遵守 `site/tailwind.config.ts` 中的间隔规范，避免出现非标准的 `mt-[17px]`。
*   **Typography**：所有标题必须使用 `font-[family:var(--font-display)]`。
*   **Color**：背景色统一使用 `var(--paper-deep)` (#F8F4EC) 或 `var(--night)` (#111923)。
*   **Shadows**：使用 `var(--shadow-soft)` 营造漂浮感，避免硬轮廓阴影。
