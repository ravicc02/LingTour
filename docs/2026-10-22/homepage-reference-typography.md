# 首页参考图排版与标题字体修订

> 日期：2026-10-22（Asia/Shanghai）
> 分支：codex/browser-feedback-2026-10-21

## 视觉依据与范围

以用户本轮提供的 2048 × 1152 参考图为依据：Culture / Voyage / to China 三行左对齐，高对比衬线字，中间 Voyage 为金色原生斜体，按钮并排放在标题下方。说明中同时列出无衬线方向，本轮优先匹配设计图可见的衬线字形；这是对上一轮无衬线标题方案的定点修订。

保留现有文案、背景照片、两个服务入口，以及已确认的视频、地图和下方内容。主导航、品牌标志和其他页面不更换字体。

后续视频批注优先：用户希望视频两侧重新留白，本轮恢复 site-container 水平边距，保留已确认的下移间距和无黑色边框效果。

## 实现方案

- 使用 Bodoni Moda 正体与原生斜体、400 字重，仅用于首页 H1。采用 Google Fonts 官方分发的 Latin WOFF2 文件，随源码本地托管，保留官方 OFL.txt；不增加运行时 Google 字体请求，也不依赖构建时下载字体。
- 通过 next/font/local 定义局部字体变量和回退字形，标题 CSS Module 控制字距、行距与响应式字号。
- 宽屏取消首页文案容器的居中限宽，采用约 5.5vw 左边距。以屏幕宽高共同约束大标题字号，使 2048 × 1152 下的比例贴近参考图，同时适配 1114、1440 等常用宽度。
- Culture 和 to China 使用深河色正体，Voyage 使用金色原生斜体。为下降部及斜体字保留空间，保持单个 H1 与连续文本顺序。
- 按钮对齐标题左边缘，桌面并排，手机纵向排列；保留原链接、焦点状态、减少动态效果及触摸尺寸。
- 手机继续保留图片在上、文字居下的首屏关系；矮屏单独收紧字号和留白，避免标题与入口被裁切。

## 字体来源

- 官方字体目录：`https://github.com/google/fonts/tree/main/ofl/bodonimoda`。
- 官方许可：`https://raw.githubusercontent.com/google/fonts/main/ofl/bodonimoda/OFL.txt`。
- 原字体二进制来源、大小和 SHA-256 保存在忽略目录的 `font-sources.json`；源码保留原始 WOFF2 与 OFL.txt。

## 影响文件

- `site/src/components/home/HomeAtlasHero.tsx`、`HomeVideoChapter.tsx`。
- `site/src/components/home/home-hero-typography.module.css`。
- `site/src/components/home/fonts/BodoniModa-Regular.woff2`、`BodoniModa-Italic.woff2`、`OFL.txt`。
- 本计划、文档索引与 CHANGELOG.md。

## 验证与回退

执行类型检查、目标 lint、既有测试和完整本地 Docker 构建。浏览器检查参考图尺寸、常见宽屏、平板、手机、矮屏、无 JavaScript 与字体请求失败回退；确认三行标题完整、按钮可见、文字无裁切、无页面横向溢出、字体从本地加载，两个入口可正常跳转。

源码备份、字体来源和截图放在 `.local-backups/home-hero-reference-2026-10-22/`；回退仅撤销本轮首页字体和排版改动。本轮不提交、推送、发布或部署生产。

## 验证结果

- Site 类型检查、两个修改组件的目标 ESLint、25 个测试文件 / 135 个测试通过。最终本地 Docker 构建完整通过编译、TypeScript、静态生成与镜像打包，3000 预览已更新。
- 沿用忽略目录内 Debian Node 20 构建覆盖，仅给构建的 TypeScript 子进程加 `--jitless`；没有跳过类型检查，也未修改仓库 Dockerfile、Next 配置或 CI。
- 参考图 2048 × 1152 下，标题字号为 180 px，左边距为 112 px。正体、Voyage 原生斜体、三行关系、下降部间距及两个入口已对照实际截图。仅局部字体及排版改变，背景照片与导航字体保留。
- 18 组视口检查通过：320 × 480、320 × 568、375 × 667、390 × 640、390 × 844、430 × 932、640 × 960、768 × 1024、834 × 1112、1024 × 600、1024 × 768、1114 × 944、1280 × 720、1366 × 768、1440 × 900、1920 × 1080、2048 × 1152、2560 × 1440。标题保持三行，入口均在首屏可见，无横向溢出。
- 正常动画、减少动态效果、无 JavaScript 和主动阻断 WOFF2 请求后的回退均通过。字体正常加载时正体、斜体两个 font-face 均为 loaded；实际只有两个本地 `/_next/static/` 字体请求，没有浏览器 Google Fonts 请求。两个原服务入口跳转正常，口译和路线页标题不继承首页字体。
- 原 WOFF2 两个文件共 56,332 字节，保留原始字体与 OFL.txt；仅加载 Latin 子集，其他字符由字体栈回退。
- 后续视频宽度反馈已落实：1114 px 下两侧各 40 px，手机两侧各 16 px，768 px 下各 24 px。七种宽度均确认对称留白、0 px 外框、无黑色底板及外阴影，无页面溢出；桌面 64 px、手机 48 px 的上方间距保留，手动播放/暂停正常。
- 浏览器运行异常和业务写请求均为 0。97 个 Markdown 文件链接及 Git 空白检查通过，独立 admin-frontend 仓库保持干净；没有提交、推送、发布、部署生产或触发远程 CI。

## 本地证据

`.local-backups/home-hero-reference-2026-10-22/` 保存以下证据：

- `before-source/`、`before-layout.json`、`before-*.png`：修改前源码和画面。
- `font-upstream.css`、`OFL-upstream.txt`、`font-sources.json`：官方分发与文件校验记录。
- `build-final-video.log`：含最终视频留白修订的完整构建日志。
- `verification.json`、`verify.cjs`：18 组首屏及字体、入口、降级行为验证。
- `final-2048x1152.png`、`final-1440x900.png`、`final-1114x944.png`、`final-390x844.png`、`final-390x640.png`、`final-320x568.png`：最终标题排版。
- `final-normal-motion.png`、`final-no-javascript.png`、`final-font-fallback.png`：动画与降级状态。
- `video-gutters-verification.json`、`video-gutters-1114.png`、`video-gutters-390.png`：后续视频留白及播放检查。
