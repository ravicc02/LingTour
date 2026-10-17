# Culvoy Site

公开站点：面向国际旅行者的广东文化旅行前台——城市文化、故事路线、陪同传译与预约、店铺与 PayPal 支付、社区与账户。品牌优先：编辑式 Field Journal / Living Field Atlas 视觉语言。

- 技术栈：Next.js 16 · React 19 · Tailwind CSS 4 · GSAP
- 本地启动：`npm run dev` → http://localhost:3000
- 验证：`npx tsc --noEmit --skipLibCheck` · `npm run lint` · `npm run test:ci` · `npm run build`（本端没有 `npm run type-check`，用显式 tsc 命令）
- 环境变量（`.env.local`）：`NEXT_PUBLIC_API_URL`、`INTERNAL_API_ORIGIN`；生产口径 `https://api.culvoy.com/api/v1`
- 代理契约：`/api/v1` 同源代理指向 API，改动属破坏性变更

设计语言、响应式与动画约束见根目录 `DESIGN.md`、`docs/reference/RESPONSIVE-SPEC.md`、`docs/reference/UI-OVERHAUL-2026.md`；操作硬约束见根 `AGENTS.md`。本目录的 `CLAUDE.md` / `AGENTS.md` 说明本端 Next.js 版本的差异与必读文档。
