# 纸纹边界、首页视频与商品对齐修订

> 日期：2026-10-22（Asia/Shanghai）
> 分支：codex/browser-feedback-2026-10-21

## 范围与决策

1. 首页视频下移：增加上方间距，移除 site-container 水平限宽、边框、黑色底板及外阴影。视频铺满页面可用宽度，保留 object-cover、静音循环、手动播放、减少动态效果及节省流量行为。
2. 提升纸纹背景上的边界辨识：结构分隔线统一加深，输入框和浅色操作使用更清晰的控件边线。保留照片白色相框、当前纹理、字号与内容层级。
3. 广东地图：加深区域边界和地图外框，调整整体透明度，使城市标签与点位可辨。保持真实行政区几何、已有城市数据与 Story / Book 交互。
4. Culture 详情标题区：恢复宽屏信息面板边框与内边距，继续使用原 Hero 及紧凑正文排版；正文、图片、目录和后台草稿预览的数据契约保持。
5. 商品故事区：两栏等高拉伸，修正混合 px/rem 断点导致手机负外边距在宽屏继续生效的问题，宽屏照片取消倾斜，左右主要框体上下对齐；手机端继续保持照片与正文顺序，并修正文字卡片层级，避免标题被照片压住。
6. 商品列表标题改为 The Culvoy Collection，增加具体品类说明 Tea ware, tableware and objects for everyday use.。只在本页显示说明，不恢复其他页面已精简的描述。
7. 本轮修正浏览器批注和同类弱边框；城市筛选方案保留为交互稿，不在此批实施。

## 影响文件

- `DESIGN.md` 与 `site/src/app/styles/base.css`、`components.css`、`refinement.css`：边线层级及共享控件。
- `site/src/components/home/HomeVideoChapter.tsx`、`GuangdongMapSection.tsx`：视频及地图。
- `site/src/app/culture/[slug]/CultureDetailClient.tsx`：标题信息边界。
- `site/src/components/store/ProductNarrative.tsx`、`ProductDetailHero.tsx`、`ProductActions.tsx`：故事对齐及规格、购买操作边界。
- `site/src/app/shop/products/page.tsx`：列表文案。

## 验证与回退

- 修改前源码、截图和布局数据保存在忽略目录 `.local-backups/borders-video-alignment-2026-10-22/`；回退只撤销本轮定点修订。
- 核对 1114 px 视口下视频左右边界、上方间距、零边框和商品两栏框体上下坐标；检查手机、平板及宽屏无溢出。
- 复核地图切换、城市入口、视频播放控制、Culture 目录和图片查看、商品规格及购买按钮；不创建真实订单或发送业务写请求。
- 执行 site 类型检查、目标 lint、既有测试、本地 Docker 完整构建，以及文档链接和空白检查。
- 验证结果完成后补录；本轮不提交、推送、发布或操作生产。

## 验证结果

- Site 类型检查、目标文件 ESLint、25 个测试文件 / 135 个测试通过。最终本地 Docker 完整编译、TypeScript 检查、静态生成及镜像打包通过，3000 预览已更新。
- 构建沿用忽略目录内的 Debian Node 20 覆盖，仅对构建时的 TypeScript 子进程使用 `--jitless`；没有跳过类型检查，仓库 Dockerfile、Next 配置和 CI 均未改变。
- 1114 px 视口下，视频上方留白从 32 px 增至 64 px；画面左边界从 40 px 变为 0 px，宽度从 1019 px 变为页面内容宽度 1099 px。原有 1 px 边框变为 0 px，无外阴影及黑色底板；视频按 object-cover 填充。减少动态效果时不自动加载，手动播放、暂停均通过实测。
- 地图在桌面端整体不透明度从 60% 提高到 90%，宽屏外框保留 1 px，分区边线使用强边线色；城市悬停与 Story 跳转正常。城市卡片仍在地图左上外侧。
- Culture 标题信息面板具有 1 px 边框，并继续复用主纸纹；潮州四章正文、目录定位与图片查看正常。
- 三个现有商品的故事文字框与照片框在 1114 px 下上下坐标完全一致。Gongfu Serving Tray 两栏高度均为 534.72 px；620、768、1114、1440 px 的上下差值均为 0 px。商品规格、版本选择及购买按钮保留。
- 10 个页面 × 6 种宽度（320、390、620、768、1114、1440 px）共 60 组响应式检查通过；修正手机文字卡片层级后，对三个商品 × 六种宽度补做 18 组检查，标题无遮挡，宽屏框体对齐，无页面溢出。浏览器运行异常及业务写请求均为 0。
- 商品列表实际显示 The Culvoy Collection 和品类说明，原地名串联标题已移除；商品搜索仍可用。
- 文档检查覆盖 96 个 Markdown 文件，失效链接与仅本地引用均为 0；`git diff --check` 通过。独立 admin-frontend 仓库干净；未提交、推送、发布或部署生产，未触发远程 CI。

## 本地证据

证据保存在 `.local-backups/borders-video-alignment-2026-10-22/`：

- `before-source/`、`before-layout.json` 与 `before-*.png`：本轮开始时的精确源码、坐标及截图。
- `build-final-mobile.log`：最终完整本地构建日志。
- `verification.json`、`verify.cjs`：交互与 60 组响应式结果。
- `final-product-checks.json`：最终三个商品的 18 组标题遮挡、对齐及溢出检查。
- `after-video.png`、`after-video-mobile.png`、`after-map.png`、`after-culture.png`、`after-product.png`、`after-product-mobile-final.png`、`after-products.png`：修订后视觉证据。

## 后续视频宽度调整

2026-10-22，用户在实际预览后要求视频重新保留左右留白。该后续决定替代本记录的满幅宽度，保留下移间距和无黑边效果；实施及最终验证统一记录在 [首页参考图字体与排版修订](homepage-reference-typography.md)。上文满幅坐标和截图保留为当次验收证据。
