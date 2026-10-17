# 工作区整理与 v1.1.0 源码发布方案

> 日期：2026-10-17（Asia/Shanghai）
> 范围：整理根仓库与 admin 独立仓库的未提交内容，分类提交、验证 CI、合并 main 并发布 GitHub Release。生产部署不在本次范围内。

## 1. 内容清点

- 业务改动已在当前分支提交，包含光学对齐、页面文案整理、美元口译套餐与相关回归测试。
- 待整理内容包含文档按日期迁移、AGENT.md 改为 AGENTS.md、CURRENT-STATE 弃用、三份详细设计方案和 CI 补充。
- 检查无文本差异的换行文件，以精确路径重新暂存，不删除文件或重置工作区。
- ignored 的环境、上传、备份、node_modules、构建产物和其他 worktree 不纳入提交。

## 2. 提交与双仓库

1. 先提交 admin 的 README 路径更新。
2. 根仓库提交文档迁移、流程规范与索引；保留原历史证据。
3. 单独提交可复现的 CI 校验与发布前检查修复。
4. 发布准备提交将 Unreleased 的已完成内容归入 1.1.0；三份 UI 方案明确标记未实施。
5. admin 先通过 PR 合并，根仓库再通过 PR 合并；保留已有分支历史，不强推。

## 3. CI 检查

- 工作流使用 actionlint v1.7.12 与 Prettier 3.9.10。
- 文档校验仅枚举 Git 可见 Markdown，忽略代码样例链接；未随 Git 发布的本地参考资料单独报告。
- checkout 拉取足够历史，空白检查针对真实提交范围，不使用空的工作区 diff 冒充检查。
- site 在 tsc 之前生成 Next.js 路由类型；运行 API/site/admin 的类型、测试和构建。
- main 最终提交必须通过 API、site、admin、文档和 Docker 构建。
- 不因失败而删除测试、放宽错误规则或执行依赖自动升级。

## 4. Release 与回退

- 确认远端无 v1.1.0 后，在最终通过 CI 的 main SHA 创建不可移动 tag。
- GitHub Release 说明包含 root/admin SHA、CI 结果、已完成内容和未实施方案。
- 本次标记为 Source released / Not deployed；无生产迁移、付款或生产冒烟结果。
- 如 CI 或合并失败，修复后重跑，保留失败记录；发布前不创建正式 tag。
- 本次只有源码发布，不需要或执行数据库回退。

## 5. 验收

两仓库工作区干净、远端 main 与发布记录可追踪、tag 指向通过完整 CI 的提交、文档迁移无丢失、发布说明与 CHANGELOG 一致。实际结果写入 CHANGELOG，不追加到 AGENTS。
