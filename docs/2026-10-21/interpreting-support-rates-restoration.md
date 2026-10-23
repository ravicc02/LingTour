# 口译服务卡片与 Rates 恢复

> 日期：2026-10-21（Asia/Shanghai）
> 分支：codex/browser-feedback-2026-10-21
> 范围：恢复用户截图中的 Choose support 和 Rates，保留当前 Hero、时长套餐与预约流程。

## 依据与数据

旧版 `d7b79f3` 包含服务卡片和等级参考价表，后续 `69c9551` 使用按时长套餐替代。当前公开接口仍返回 `service_modes`，但页面没有渲染这些数据。

公开接口当前有三项服务说明，价格为 CMS 编写的 SGD 文本。恢复时原样使用标题、价格、适用人群、正文和包含项目，不修改后台配置或换算金额。

Rates 按截图及历史代码恢复为 City、Route、Group 三行和 Junior、Mid-level、Senior 三档。原参考价为 CNY，页面明确标示币种和参考性质。它不替代当前 USD 套餐，也不参与服务端订单计价。

| 服务 | Junior | Mid-level | Senior |
| --- | --- | --- | --- |
| City | CNY 680 | CNY 980 | CNY 1480 |
| Route | CNY 980 | CNY 1280 | CNY 1880 |
| Group | — | CNY 1680 | CNY 2680+ |

## 实现

- 独立服务卡片组件接收既有 `effectiveInterpretingData.serviceModes`，保留后台预览合并能力。恢复白色卡片、价格、服务介绍、包含项目和 Request support 入口。
- 卡片在桌面并排，在手机横滑。完整保留 CMS 正文，内容为空时显示可理解的状态，不注入演示服务。
- Request support 跳到预约区，并将所选服务标题填入需求；套餐选择和结算逻辑继续使用现有表单。
- 独立 Rates 组件恢复原参考金额，使用带行列表头的原生表格；手机在表格内横滑，不撑宽整个页面。
- 保留现有 `#service-types` 套餐锚点；`#interpreting-pricing` 恢复指向 Rates，手机 Packages 入口修正为 `#service-types`。
- 页面顺序为 Hero、现有套餐、Choose support、Interpreters、Rates、预约与 FAQs。

## 验证与回退

检查公开接口三项服务、字段及价格原样呈现；检查九个参考金额位置、空档、币种与等级表头。验证服务选择填入需求、两个价格区域锚点、原 USD 套餐选择、手机横滑、减少动态效果、空服务列表和正常后台预览数据来源。

运行类型检查、目标 lint、既有测试、本地 Docker 构建、文档链接和空白检查，查看桌面与手机截图。证据保存在忽略目录 `.local-backups/interpreting-support-rates-2026-10-21/`。

回退只撤回本次两个展示组件及页面接入，保留之前的 UI 修订。本轮不修改 API、数据库、后台、支付或生产环境。


## 验证结果

- 类型检查、4 个修改文件的目标 lint、23 个文件 / 119 个测试通过。现有套餐及定金逻辑测试继续通过。
- 本地 Docker 完整编译与 TypeScript 检查通过，3000 预览已更新。沿用忽略目录内 Node 24 builder 覆盖，运行仍为 Node 20；仓库 CI 和 Dockerfile 保持原样。
- 浏览器 7 项场景通过。三个 CMS 服务的标题、价格数值与币种、适用人群、完整正文、包含项目均已比对；仅去掉价格前重复的 From 显示前缀。
- Rates 的三行、三档、8 个金额与 Group 的 Junior 空档均与原参考表一致，CNY 参考说明可见；`#interpreting-pricing` 锚点唯一，直接访问定位正常。
- 点击 Request support 进入预约后，选择日期并继续，可见需求已填入所选服务标题；原有 5 小时定制套餐仍显示 USD 500.00。未点击提交或创建订单。
- 320、375、390、414、768、1024、1309、1440、1920 px 共 9 个宽度均无页面横向溢出。四个手机宽度实测服务卡片与价目表触摸横滑，第三项服务和 Senior 列可达。Packages 仍指向现有 USD 套餐。
- 正常动态与减少动态效果下两个区块可见。已人工查看桌面及手机截图，页面异常与业务写请求均为 0。
- 空服务列表占位及后台预览数据合并为源码审查，本轮未登录后台编辑或发布数据。
- 93 份 Markdown 本地链接、Git 空白检查和新文件行末空白检查通过。改动未提交、推送或触发远程 CI。

最终证据以 `browser-report.json`、`browser.log`、`tests.log`、`build.log` 为准。桌面与手机截图为 `support-*.png`、`rates-*.png`，预约预填截图为 `booking-prefill.png`。早期浏览器辅助脚本的断言错误留作诊断，已修正预填标签匹配和同页锚点导航检查。
