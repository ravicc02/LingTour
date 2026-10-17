# Culvoy Admin

运营后台：聚焦工作流的 CMS——内容编辑与真实预览、订单/预约、媒体、社区、审计与系统管理。设计服务运营清晰度，保留 Element Plus 体系。

- 技术栈：Vue 3 · Vite · Element Plus · GSAP（`<script setup>` SFC）
- 本地启动：`npm run dev` → http://localhost:5173
- 验证：`npm run build`（即 `vue-tsc -b && vite build`）
- 环境变量（`.env.local`，勿用未忽略的裸 `.env`）：`VITE_API_ORIGIN`、`VITE_SITE_ORIGIN` 或 `VITE_SITE_PREVIEW_ORIGIN`、`VITE_MEDIA_ORIGIN`
- 代理契约：客户端请求 `/api/admin`，由 Vite/Nginx 重写为 `/api/v1/admin`——保持该契约
- 双仓库：本目录同时是独立 Git 仓库；提交时先在本仓库以精确路径提交，再在根仓库提交对应 `admin-frontend/...` 路径（见根 `docs/reference/development.md` §5）
- 文案约定：后台界面文案为中文；业务正文一次英文撰写、前台原样展示

动画使用 `gsap.context()` 并在卸载时 `ctx.revert()`；移动端断点与既有 `styles/responsive.css` 口径保持一致。
