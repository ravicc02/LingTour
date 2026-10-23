# v1.2.0 源码发布计划

> 日期：2026-10-23（Asia/Shanghai）
> 工作分支：codex/browser-feedback-2026-10-21
> 发布性质：源码发布，Not deployed。

## 版本与范围

最新已发布版本为 v1.1.0。本次新增 Culture 章节导航、自动图文排版与原图查看，并完成公开站点编辑式布局和交互完善，按向后兼容的新产品能力发布为 v1.2.0。

发布内容覆盖本工作分支现有 site 修改、Bodoni Moda 字体及许可、设计规范和 2026-10-21、2026-10-22 的修订记录。API 与独立后台源码无变更；后台 SHA 为 `015143fb3875a0e1cd1fdbeec66138cd5bca8b4d`，与根仓库镜像仅存在既有 `.vscode/extensions.json` 差异。

原首页 Ticket/Hero 实验仍在 stash 中；城市筛选两种方案仍为交互稿。本次不把这些未实施内容写成已完成功能。

## 旧线上版本保留

只读核对线上仓库 HEAD 为 `76f155224424efe3a6839c13d2819ea5c09a7d47`，提交日期为 2026-09-22，已存在于 GitHub 历史中。为它新增独立基线标签 `archive/production-before-v1.2.0`；不移动现有 v1.1.0 及 deploy-* 标签。

同时保存运行容器镜像 ID 作为独立运行证据：

| 应用 | 运行镜像 ID |
| --- | --- |
| site | `sha256:4be60382b5a792016e78866b8de01af8aa6bf7cf3d5b60e29d9feb167f98fb66` |
| api | `sha256:c6bd687f1c4a401c7b14c97697be39c51c82f4cdbcfd450bea8aedcb43056fa5` |
| admin | `sha256:05079262b3d1358b26c9e560b2b587a6991f0aaea26fc982a71a36ebfe4b0b45` |

容器镜像未提供 Git revision 标签，不能仅凭线上仓库 HEAD 证明构建内容逐字一致。记录分别表明线上检出的源码基线和实际运行镜像。现有生产容器、镜像、数据库及未跟踪媒体/历史 bundle 均保持。

## 提交与发布顺序

1. 审查全部待发布文件，排除备份、运行产物、环境值和原型；使用精确路径暂存。
2. 执行 API、site、admin 的本地验证，以及文档和工作流检查。
3. 按 site 实现、设计及修订文档、版本记录整理 Conventional Commits。
4. 推送当前分支并创建 PR；等待 PR 的 API、site、admin、docs 检查全部成功。
5. 将已验证的同一 PR head 合并到 main，等待 main 的完整 CI，包括三端 Docker 镜像构建。
6. 在已验证的 main 创建不可移动的 v1.2.0 标签；发布 GitHub Release，记录 root/admin SHA、PR 和 main CI、已完成内容及未实施方案。
7. Release 明确标注 Not deployed；数据库迁移、备份和生产冒烟均未执行。

## 本地验证记录

- API：TypeScript、28 套件 / 201 个测试、Nest 构建通过；测试环境显式使用本地测试数据库配置。
- Site：类型生成、TypeScript、25 个文件 / 135 个测试通过；完整 ESLint 为 0 errors、1078 个既有 warnings。
- Admin：vue-tsc 与 Vite 构建通过；保留既有大 chunk 体积提示。
- Site 当前源码的本地 Docker 完整构建通过。
- actionlint 通过；Prettier 对 Git 保存的 LF 工作流原文检查通过。Windows 工作区 ci.yml 为 CRLF，规范化后与 Git 原文一致，未修改工作流。
- 文档检查器 5 个测试、98 份 Markdown 链接与空白检查通过；远程门禁只在实际完成后记为通过。

## 证据与回退

本地日志及初始修改清单保存在忽略目录 `.local-backups/release-v1.2.0-2026-10-23/`。Git 历史、两个原有 stash 和线上基线标签保留。版本标签不移动；若发布后发现缺陷，使用后续版本修复或另行授权部署回退。
