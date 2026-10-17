probe

---

## 三、多维表格规格（已实测核验）

### 基本信息
| 项目 | 值 |
|---|---|
| 名称 | 项目待办管理 |
| base_token | PWLpbO2Y0aqDrhsdcjicBoDIn9m |
| 打开地址 | https://mcnolxrqwlqo.feishu.cn/base/PWLpbO2Y0aqDrhsdcjicBoDIn9m |
| 时区 | Asia/Shanghai |
| 高级权限 | 未开启（is_advanced = false） |
| 表数量 | 2 |

### 表 1：项目（table_id tblVHHfoMJBfQFQ5，当前 3 条记录）

| 字段名 | 类型 | 选项 / 说明 |
|---|---|---|
| 项目名称 | text（主键字段） | - |
| 项目状态 | select（单选） | 未开始 / 进行中 / 已暂停 / 已完成 / 已取消 |
| 项目描述 | text | - |
| 开始日期 | datetime | 格式 yyyy/MM/dd |
| 截止日期 | datetime | 格式 yyyy/MM/dd |
| 相关待办 | link（自动反向汇总） | 指向「待办事项」表的双向关联 |

### 表 2：待办事项（table_id tbl21w4yWuCJ9wEs，当前 6 条记录）

| 字段名 | 字段 ID | 类型 | 选项 / 说明 |
|---|---|---|---|
| 待办事项 | fldi80oJpo | text（主键字段） | - |
| 所属项目 | fldVG5QM2o | link | 关联 tblVHHfoMJBfQFQ5，bidirectional，反向字段「相关待办」(fldO73rOZf) |
| 状态 | fldQEHZYKR | select（单选） | 待处理 / 进行中 / 已完成 / 已取消 |
| 优先级 | fldzo0XOpN | select（单选） | P0 紧急 / P1 高 / P2 中 / P3 低 |
| 截止日期 | fldfS8O5x1 | datetime | 格式 yyyy/MM/dd |
| 负责人 | fldQVsLlum | user | 目前示例数据均为空 |
| 备注 | fldqllCLK7 | text | - |

### 视图（待办事项表）
| 名称 | view_id | 类型 | 配置 |
|---|---|---|---|
| 表格 | vewiODnqdM | grid | 默认视图 |
| 按状态看板 | vewNQtFWZe | kanban | 分组字段 = 状态 (fldQEHZYKR)，已配置 |

### 现有示例数据
- 项目（3 条）：官网改版 / App 2.0 版本 / Q3 市场活动
- 待办（6 条）记录 ID：
  recvvuY4y5SY0E 首页视觉稿终审（进行中 / P1 高）
  recvvuY4y537q6 首页 Banner 文案改写（待处理 / P2 中）
  recvvuY4y5aKXS 产品页信息架构梳理（已完成 / P2 中）
  recvvuY4y5qUId 2.0 需求评审会（待处理 / P0 紧急）
  recvvuY4y5EOee 竞品分析报告（进行中 / P1 高）
  recvvuY4y5QJGD 活动复盘报告归档（已完成 / P3 低）

---

## 四、常用命令模板（可直接复用）

    BT=PWLpbO2Y0aqDrhsdcjicBoDIn9m      # base_token
    T_PROJ=tblVHHfoMJBfQFQ5             # 项目表
    T_TODO=tbl21w4yWuCJ9wEs             # 待办事项表

    # 读
    lark-cli base +table-list  --as user --base-token "$BT"
    lark-cli base +field-list  --as user --base-token "$BT" --table-id "$T_TODO"
    lark-cli base +view-list   --as user --base-token "$BT" --table-id "$T_TODO"
    lark-cli base +record-list --as user --base-token "$BT" --table-id "$T_TODO"
    lark-cli base +data-query  --as user --base-token "$BT" --table-id "$T_TODO"   # 复杂筛选/聚合

    # 新增待办：link 写法 [{"id":"<record_id>"}]，日期 "YYYY-MM-DD HH:mm:ss"
    lark-cli base +record-batch-create --as user --base-token "$BT" --table-id "$T_TODO" \
      --json '{"fields":["待办事项","所属项目","状态","优先级","截止日期","备注"],"rows":[
        ["新待办示例",[{"id":"recvvuXyazgq5W"}],"待处理","P2 中","2026-10-10 00:00:00",null]
      ]}'

    # 删除（高风险写，需 --yes；多记录重复传 --record-id，不能传数组）
    lark-cli base +record-delete --as user --base-token "$BT" --table-id "$T_TODO" \
      --record-id "rec_xxx" --record-id "rec_yyy" --yes

    # 看板分组
    lark-cli base +view-set-group --as user --base-token "$BT" --table-id "$T_TODO" \
      --view-id "vewNQtFWZe" --json '{"group_config":[{"field":"状态","desc":false}]}'

---

## 五、踩坑与注意事项

1. 单元格取值规范特殊：link 写 [{"id":"recv_xxx"}]；select 直接写选项文本；datetime 写 "YYYY-MM-DD HH:mm:ss"。
   规范：lark-cli skills read lark-base references/lark-base-cell-value.md
   字段 JSON：lark-cli skills read lark-base references/lark-base-field-json.md
2. +record-delete 参数形式：多记录要 --record-id A --record-id B 多次传，传 JSON 数组无效；高风险写必须加 --yes（且应先获用户确认）。
3. 不要用管道（| jq / | head）的退出码判断成败：曾因管道过滤报错误判首次写入失败、重试造成重复记录。建议看命令自带 "ok": true，或把输出重定向到文件再读。
4. 风险等级：读=read；写=write；删除/权限类=high-risk-write，需 --yes。
5. user 身份建议显式 --as user。
6. CLI 版本偏旧（1.0.65 vs 1.0.96），可考虑 lark-cli update，升级前先确认参数未变。
7. 本机 Bash 处于沙箱写保护：写工作区文件需显式关闭沙箱，否则写入不落盘。

---

## 六、待办 / 可选项

- [ ] 待办表「负责人」字段目前为空，可按需回填。
- [ ] 可选加：按截止日期的甘特视图、状态流转自动化（如状态改为「已完成」时通知）。
- [ ] 注意 refresh token 在 2026-09-25 前后重新登录。

---

## 七、核验结论（本次只读检查）

- base 存在且名称、URL、时区一致
- 项目表 3 条、待办表 6 条记录，双向关联正确
- 看板视图分组字段确为「状态」
- user 身份当前 needs_refresh（可用），授权时间为 9/18 01:02
