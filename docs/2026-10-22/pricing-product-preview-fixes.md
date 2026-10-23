# 口译去重、美元符号与编辑器预览核验

> 日期：2026-10-22（Asia/Shanghai）
> 分支：codex/browser-feedback-2026-10-21

## 本轮范围

1. 删除口译页顶部重复的 Interpretation Packages 展示卡片，保留下方 Choose support 与 Rates。预约表单继续使用服务端返回的套餐，订单计价契约保持。
2. 口译价格统一按美元显示为 `$`，保留现有数值，不换算汇率。服务说明的旧币种前缀只在展示层规范化；Rates 改为美元参考标示；结构化 USD 套餐和定金通过格式函数显示 `$`。商品的 SGD、CNY 标价不因此修改。
3. 商品详情删除购买面板底部的两个路线/社区链接，并清理空分隔装饰；保留 Add to bag、Buy now、规格、版本和媒体切换。
4. 核查 Culture Markdown 编辑器、真实前台预览和新文章排版。只修复本地明确的 `127.0.0.1:5173` 预览来源缺失，保留来源白名单、父窗口/弹出窗口身份及随机会话键校验。

## 后台适配边界

CityEdit 使用 MarkdownEditor，预览槽为 FrontendPagePreview。该组件将 `contentMarkdown` 放入草稿消息，发送到 `/preview/city/`；前台预览和正式城市页面共用 CultureDetailClient 与 `layout="city"` 的 Markdown 渲染器。

因此编辑数据结构无需新增字段：一、二级标题形成章节，独立图片作为相应章节的辅助图。后台保持 Markdown 编辑方式；真实预览展示目录、图文并排与原图查看。编辑器组件核验使用隔离的本地测试宿主，不执行真实保存、上传或发布。

## 实现与验证

- 保留旧 `#service-types` 锚点作为 Choose support 的非可视别名，Hero 操作改为 View support，手机操作指向 Rates。
- 为美元显示、原数值保留和非口译货币显示增加回归检查；保持预约 payload 仅传 packageId 的既有验证。
- 为新增本地预览来源增加允许/拒绝测试；复核非法域名、端口和发送窗口仍被拒绝。
- 在浏览器核对口译区块唯一性、金额符号、预约总额、商品按钮和面板高度；用实际 MarkdownEditor 与 FrontendPagePreview 组件核验未保存正文实时同步及新排版。
- 运行 site 类型、目标 lint、完整既有测试、本地 Docker 构建、文档链接与空白检查。若 admin 源码无需修改，保留独立仓库干净状态。

## 回退与证据

本轮修改前文件与验证记录放在忽略目录 `.local-backups/pricing-product-preview-2026-10-22/`。回退仅撤销本轮命名文件中的定点改动，保留此前全站美化和其他工作区修改。本轮不操作生产、数据库或真实订单。

## 验证结果

- Site 类型检查、目标文件 ESLint 均通过；25 个测试文件、135 个测试通过。新增金额显示与预览来源回归覆盖，预约请求仍只提交套餐 ID，金额由服务端决定。
- 本地 Docker 完整编译、TypeScript 检查、静态页面生成与镜像打包通过，3000 端口预览已更新，容器健康。沿用上一轮忽略目录内的 Debian Node 20 构建覆盖，只给构建中的 TypeScript 子进程加 `--jitless`；仓库 Dockerfile、Next 配置和 CI 未修改，也未跳过类型检查。
- 浏览器确认只保留一组 Choose support 卡片，服务价分别为 `$160 / half day`、`$280 / day`、`$240 / day`；Rates、六个预约套餐及选中后的套餐总额均显示 `$`。服务需求预填和旧锚点可用。
- 商品购买面板两个链接和空装饰已移除。在 1079 × 944 视口，面板高度从 781 px 降至 587 px；规格、版本、Add to bag、Buy now 和 S$32.00 商品标价保留。
- 口译、商品详情和潮州详情在 320、390、768、1079、1354 px 五种宽度下共 15 组检查通过，无页面横向溢出；业务页没有运行异常，也未发出业务写请求。
- 隔离宿主挂载实际 MarkdownEditor 与 FrontendPagePreview，使用 `127.0.0.1:5173` 来源验证初始草稿、编辑器文档事务后的实时正文及目录更新、弹窗预览、图片放大、手机排版，以及编辑/分屏/仅预览切换。测试代理仅在独立浏览器进程允许本地网络访问；未放宽应用来源校验。Vite 开发宿主记录了 ResizeObserver 循环提示，前台渲染和交互断言通过。
- 后台源码无需另行调整，独立 admin-frontend 仓库保持干净。此次验证覆盖组件和预览链路，没有登录真实后台执行保存、上传或发布。
- 文档检查覆盖 95 个 Markdown 文件，0 个失效链接，0 个仅本地引用；`git diff --check` 通过。远程 CI 未触发，未提交、推送或部署生产。

## 本地证据

证据保存在忽略目录 `.local-backups/pricing-product-preview-2026-10-22/`：

- `build.log`：完整本地镜像构建日志。
- `page-report.json`、`page-check.cjs`：页面行为、金额、15 组响应式检查和请求监测。
- `editor-preview-report.json`、`editor-preview-check.mjs`：实际编辑器及预览组件的只读集成检查。
- `interpreting-after.png`、`interpreting-mobile-rates.png`、`product-before.png`、`product-after.png`：页面修订视觉证据。
- `editor-split-preview.png`、`editor-front-desktop.png`、`editor-front-mobile.png`：后台分屏与真实前台预览证据。
