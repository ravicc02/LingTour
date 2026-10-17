# Culvoy API

内容、预约、支付与运营接口：城市文化、路线、传译、店铺与 PayPal 支付、社区、账户与后台管理。

- 技术栈：NestJS 11 · TypeORM · PostgreSQL 16 · JWT · PayPal
- 本地启动：`npm run start:dev` → http://localhost:8000（健康检查 `/health`，OpenAPI `/api/docs-json`）
- 验证：`npx tsc --noEmit --skipLibCheck` · `npm test -- --runInBand` · `npm run build`
- 注意：`npm run lint` 带 `--fix`、`npm run format` 会写文件，二者不是只读校验命令
- 数据库：`data-source.ts` 保持 `synchronize: false`；迁移只新增、不重写，任何迁移执行前必须备份数据库并确认目标（见根 `docs/reference/release.md`）
- 种子/导入命令多带 `--apply`：未确认目标与备份不得运行；`npm run seed:reset` 永不运行
- 环境变量：`DB_*`、`JWT_SECRET`、PayPal 与媒体存储等；完整清单见 `.env.production.example`（值不入库、不入文档）

接口分层：公共内容 `/api/v1/public/*`；后台经 `/api/admin`（由代理重写为 `/api/v1/admin`），保持该代理契约。全局 `I18nInterceptor` 会把响应中的 `{en,zh}` 扁平化为字符串，管理端读取原始 i18n 需带 `?rawI18n=true`。
