# 文档目录

`docs/` 按文档记录日期分区。每个日期使用一个独立文件夹，文件夹内部只保留原文档需要的子目录。

## 目录规则

- `YYYY-MM-DD/`：当天形成或整理的方案、交接、设计、发布和内容记录。
- `reference/`：长期使用的开发、发布、响应式和 UI 规范。流程总规范见根目录 `AGENTS.md`。
- `CURRENT-STATE.md`：已弃用的历史状态入口，不再追加内容。当前更新和发布记录统一写入根目录 `CHANGELOG.md`。
- `assets/`：文档使用的图片资源。

## 日期分区

| 日期 | 内容 |
| --- | --- |
| `2026-05-09/` | 文化模块后端设计 |
| `2026-05-11/` | 整体、路线、口译和店铺后端设计 |
| `2026-07-26/` | 交接与移动端、数据层进度记录 |
| `2026-09-07/` | 历史编辑器提示词和路线设计 |
| `2026-09-16/` | 历史部署与旧方案文档 |
| `2026-09-18/` | Motion Web 优化方案 |
| `2026-09-19/` | 城市、路线、商品、Q&A 内容和评审系统文档 |
| `2026-10-08/` | 原始反馈记录 |
| `2026-10-14/` | Optical Alignment 记录 |
| `2026-10-17/` | 首页、路线预约和日历三类功能修改方案 |
| `2026-10-21/` | [首页标题字体修订](2026-10-21/homepage-hero-typography.md)、[六项页面批注修订](2026-10-21/browser-feedback-six-fixes.md)、[Culture 详情页排版修订](2026-10-21/culture-detail-editorial-layout.md)、[口译服务与价目表恢复](2026-10-21/interpreting-support-rates-restoration.md)、[前台组件与排版打磨](2026-10-21/finesse-site-component-polish.md) |
| `2026-10-22/` | [口译价格、商品链接与编辑器预览修订](2026-10-22/pricing-product-preview-fixes.md)、[纸纹边界、视频与商品对齐修订](2026-10-22/borders-video-product-alignment.md)、[首页参考图字体与排版修订](2026-10-22/homepage-reference-typography.md) |
| `2026-10-23/` | [v1.2.0 源码发布与旧线上版本保留](2026-10-23/release-v1.2.0-plan.md) |

## 本期详细方案（2026-10-17）

业务总纲：[三类功能修改方案](2026-10-17/feedback-modification-plan-2026-10-08.md)。下列文档细化 skills、代码差距、交互设计、前后台实现、测试与结果视觉验收；目前均为待实施方案。

| 方案 | 内容 |
| --- | --- |
| [首页 Hero 与城市 Ticket](2026-10-17/homepage-ticket-hero-design-plan.md) | 品牌中心、城市选择、票券实时排版、匿名 PNG 导出 |
| [固定路线免费预约与定制收费](2026-10-17/route-booking-service-design-plan.md) | 免费提交、定制委托、规划员、对话、报价与付款 |
| [公共日历与私人 Calendar](2026-10-17/calendar-services-design-plan.md) | Today、多媒体、发布快照、历史回看、私人记事与权限 |

长期规范请从仓库根目录的 `AGENTS.md` 和 `README.md` 进入；当前更新与发布记录请查看根目录的 `CHANGELOG.md`。
