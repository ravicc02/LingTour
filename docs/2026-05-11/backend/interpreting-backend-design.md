# Interpreting 模块后端设计文档

> 版本: 1.0 | 日期: 2026-05-11 | 关联: Culvoy 整体后端设计 v1.0 / Culture 模块 v1.0

---

## 目录

1. [数据模型](#1-数据模型)
2. [前端页面结构 & 数据字段对照](#2-前端页面结构--数据字段对照)
3. [API 接口设计](#3-api-接口设计)
4. [管理后台设计](#4-管理后台设计)
5. [前端数据联动](#5-前端数据联动)
6. [实现计划](#6-实现计划)

---

## 1. 数据模型

> 存储策略对齐 Culture / Routes 模块：所有文本字段为 `TEXT`，存储 Markdown 字符串，前端用 `react-markdown` 渲染。图片字段存 OSS URL。

### 1.1 核心实体关系

```
interpreting_service_modes (服务模式)     ← 独立平表，sort_order 排序
interpreter_profiles (解释员档案)         ← 独立平表，sort_order 排序
interpreting_faqs (常见问题)              ← 独立平表，sort_order 排序

booking_submissions (预订提交)            ← 用户表单数据，后台只读查看

                              ┌──────────┐
                              │  cities  │ ← 复用 Culture 模块
                              └──────────┘
```

**设计原则**：interpreting 页没有"嵌套父表"，所有可编辑内容都是顶层平表。三张配置表各自独立，按 `sort_order` 排序，前端按顺序渲染。

### 1.2 interpreting_service_modes 表（服务模式）

> 对应页面「Service modes」区域的 3 张卡片，可变数组，后台可增删改。

```sql
CREATE TABLE interpreting_service_modes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sort_order      INT NOT NULL,                       -- 排序 0, 1, 2...
    title           VARCHAR(200) NOT NULL,               -- "City companion interpreting"
    price           VARCHAR(100) NOT NULL,               -- "From RMB 680 / half day"
    best_for        VARCHAR(200) NOT NULL DEFAULT '',    -- "Best for independent visitors"
    body            TEXT NOT NULL,                       -- 卡片描述（MD） 
    includes        JSONB NOT NULL DEFAULT '[]',         -- ["English city support", "Restaurant and transit help", ...]
    accent          VARCHAR(10) NOT NULL DEFAULT 'light',-- "light" | "dark"
    featured        BOOLEAN NOT NULL DEFAULT false,      -- 是否添加 "Recommended" 标签
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(sort_order)
);

CREATE INDEX idx_interpreting_service_modes_sort ON interpreting_service_modes(sort_order);
```

**字段 → 前端对照**：


| 字段           | 卡片渲染                             |
| ------------ | -------------------------------- |
| `title`      | H3 标题（Georgia serif, 3xl）        |
| `price`      | 金色/红色 label 小字（含货币单位）            |
| `best_for`   | mono 大写标签                        |
| `body`       | MD 渲染，灰/白正文                      |
| `includes[]` | 标签 pills（border + uppercase）     |
| `accent`     | `"dark"` → 暗底金字；`"light"` → 白底红字 |
| `featured`   | `true` → 右上角「Recommended」金色角标    |


### 1.3 interpreter_profiles 表（解释员档案）

> 对应页面右侧「Interpreter profiles」区域的 3 张翻转卡，可变数组。

```sql
CREATE TABLE interpreter_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sort_order      INT NOT NULL,                       -- 排序 0, 1, 2...
    name            VARCHAR(200) NOT NULL,               -- "Culture Route Lead"
    language        VARCHAR(200) NOT NULL,               -- "English / Mandarin / Cantonese support"
    focus           TEXT NOT NULL,                       -- 档案背面描述（MD）
    helps           JSONB NOT NULL DEFAULT '[]',         -- ["Museum visits", "Historic streets", ...]
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(sort_order)
);

CREATE INDEX idx_interpreter_profiles_sort ON interpreter_profiles(sort_order);
```

**字段 → 前端对照**：


| 字段           | FlipCard 正面       | FlipCard 背面 |
| ------------ | ----------------- | ----------- |
| `name`       | ✅ 角色名             | ❌           |
| `language`   | ✅ 语言              | ❌           |
| `focus`      | ❌                 | ✅ 描述正文（MD）  |
| `helps[]`    | ❌                 | ✅ 标签 pills  |
| `sort_order` | ✅ "Profile 01" 编号 | ❌           |


### 1.4 interpreting_faqs 表（常见问题）

> 对应页面底部 FAQ 手风琴，可变数组。

```sql
CREATE TABLE interpreting_faqs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sort_order      INT NOT NULL,
    question        VARCHAR(500) NOT NULL,               -- 问题标题
    answer          TEXT NOT NULL,                       -- 答案正文（MD，支持链接）
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(sort_order)
);

CREATE INDEX idx_interpreting_faqs_sort ON interpreting_faqs(sort_order);
```

### 1.5 booking_submissions 表（预订提交）

> 用户通过前台表单提交的预订请求，后台只读查看。

```sql
CREATE TABLE booking_submissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,               -- 联系人姓名
    contact         VARCHAR(300) NOT NULL,               -- Email / WhatsApp
    city            VARCHAR(200) NOT NULL,               -- 选择的目标城市
    service_date    DATE NOT NULL,                       -- 预订服务日期
    support_mode    VARCHAR(200) NOT NULL,               -- 选中的服务模式
    group_size      VARCHAR(100) NOT NULL,               -- 小组规模
    route_or_need   TEXT NOT NULL,                       -- 路线/需求描述（MD 文本区）
    status          VARCHAR(20) NOT NULL DEFAULT 'new',  -- "new" | "read" | "contacted" | "confirmed" | "cancelled"

    -- 自动记录
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_submissions_status ON booking_submissions(status);
CREATE INDEX idx_booking_submissions_created ON booking_submissions(created_at DESC);
```

**状态流转**：

```
new → read → contacted → confirmed
                 ↘ cancelled
```

### 1.6 与 Culture 模块的引用

Interpreting 页使用 `cities` 表（Culture 模块已有）作为城市下拉选项和城市卡片的数据源，无需新建表。


| 使用位置                      | 目的     | 查询方式                                                                   |
| ------------------------- | ------ | ---------------------------------------------------------------------- |
| Hero 指标「N cities」         | 计数动画   | `SELECT COUNT(*) FROM cities WHERE published = true`                   |
| Booking 表单「City」下拉        | 城市选择器  | `SELECT name FROM cities ORDER BY name`                                |
| 右侧「City starting point」卡片 | 城市列表展示 | `SELECT slug, name, label, tags, gallery[0] FROM cities ORDER BY name` |


---

## 2. 前端页面结构 & 数据字段对照

### 2.1 页面完整结构

```
┌─────────────────────────────────────────────────────────┐
│  ① Hero (interpreting-hero)                             │
│     背景: 暗色夜底 + cinematic zoom + radial gradient     │
│     标签: "Interpreting service"                         │
│     大标题: "Travel with someone who can explain..."     │
│     简介: "Culvoy interpreting combines..."            │
│     CTA: [Start a booking request] [Browse story routes] │
│     指标: StatsCounter × 4                               │
│       └─ city_count (动态)                               │
│       └─ 3 modes (静态基文案)                            │
│       └─ 4 languages (静态文案)                          │
│       └─ route_count (动态)                              │
│     右侧面板: 封面图 / 路线 / What we handle / Response  │
│     Scroll 指示箭头                                       │
│                                                          │
│  ② Service modes (interpreting-modes)                   │
│     EditorialIntro + 3 张卡片 ← service_modes[]          │
│                                                          │
│  ③ Service matching (interpreting-match)                 │
│     左侧: matchingScenarios[] (静态营销文案 × 4)         │
│     右侧: Route fit 卡片 + City 面板 + How this helps    │
│                                                          │
│  ④ Process (interpreting-process)                        │
│     左侧: bookingSteps[] (静态流程 × 4) + BookingFlowLine│
│     右侧: InterpreterFlipCard × N ← profiles[]           │
│                                                          │
│  ⑤ Booking (interpreting-booking)                        │
│     左侧: 表单说明 + 填写指引                             │
│     右侧: <form> → POST /public/bookings                 │
│           提交后→ booking_submissions 表                  │
│                                                          │
│  ⑥ FAQ (interpreting-faq)                               │
│     EditorialIntro + Accordion ← faqs[]                  │
│                                                          │
│  ⑦ CTA                                                  │
│     暗色底 + [Start your brief] [Browse routes first]    │
└─────────────────────────────────────────────────────────┘
```

### 2.2 前端组件 ↔ 数据库字段完整映射

#### Service Mode Card（服务卡片）


| 展示               | 字段来源         | 格式                                 |
| ---------------- | ------------ | ---------------------------------- |
| 金色/红色价格标签        | `price`      | mono 12px uppercase                |
| 标题               | `title`      | Georgia serif 3xl                  |
| "Best for ..."   | `best_for`   | mono 14px uppercase                |
| 描述正文             | `body`       | MD → 15px text                     |
| 标签 pills         | `includes[]` | JSONB → map → border pills         |
| 暗底/白底            | `accent`     | `"dark"` → 夜底金字 / `"light"` → 白底红字 |
| "Recommended" 角标 | `featured`   | 条件渲染                               |


#### InterpreterFlipCard（翻转卡）


| 展示             | 字段来源             | 格式                   |
| -------------- | ---------------- | -------------------- |
| "Profile 01" 标 | `sort_order + 1` | mono 金色              |
| 正面角色名          | `name`           | Georgia serif 2xl    |
| 正面语言           | `language`       | 14px white/50        |
| 背面描述           | `focus`          | MD → 15px leading-7  |
| 背面标签           | `helps[]`        | JSONB → border pills |


#### FAQ Accordion（手风琴）


| 展示  | 字段来源                 |
| --- | -------------------- |
| 问题  | `question`           |
| 答案  | `answer`（MD 渲染，支持链接） |


#### Booking Form → 提交


| 表单项                   | 类型                    | → `booking_submissions` 字段 |
| --------------------- | --------------------- | -------------------------- |
| Name                  | `<input>`             | `name`                     |
| Email / WhatsApp      | `<input>`             | `contact`                  |
| City                  | `<select>`            | `city`                     |
| Service date          | `<input type="date">` | `service_date`             |
| Support mode          | `<select>`            | `support_mode`             |
| Group size            | `<input>`             | `group_size`               |
| Route or support need | `<textarea>`          | `route_or_need`            |


---

## 3. API 接口设计

### 3.1 前台公共 API（只读，无需认证）

> Interpreting 页是纯展示页面 + 表单提交，前台只需要 4 个 GET + 1 个 POST。

#### `GET /public/interpreting`

返回 interpreting 页全部内容——服务模式 + 解释员档案 + FAQ，**一次请求到位**，前端无需拼凑。

**响应**：

```json
{
  "service_modes": [
    {
      "id": "uuid-xxx",
      "sort_order": 0,
      "title": "City companion interpreting",
      "price": "From RMB 680 / half day",
      "best_for": "Best for independent visitors",
      "body": "For travelers who want English support on the ground...",
      "includes": ["English city support", "Restaurant and transit help", "Local etiquette notes"],
      "accent": "light",
      "featured": false
    }
  ],
  "profiles": [
    {
      "id": "uuid-yyy",
      "sort_order": 0,
      "name": "Culture Route Lead",
      "language": "English / Mandarin / Cantonese support",
      "focus": "Guangdong city history, neighborhood reading...",
      "helps": ["Museum visits", "Historic streets", "Narrative pacing"]
    }
  ],
  "faqs": [
    {
      "id": "uuid-zzz",
      "sort_order": 0,
      "question": "Is this a tour guide service or an interpreting service?",
      "answer": "It is designed as cultural interpreting plus travel support..."
    }
  ]
}
```

#### `GET /public/cities`

复用 Culture 模块的接口，返回城市列表用于表单下拉和城市卡片。

**查询参数**：`fields=slug,name,label,tags,gallery`

**响应**：

```json
{
  "cities": [
    {
      "slug": "zhanjiang",
      "name": "Zhanjiang",
      "label": "Southern coast",
      "tags": ["Coast", "Seafood", "Volcanic landscape"],
      "gallery": ["https://oss.lingtour.cn/cities/zhanjiang/1.jpg"]
    }
  ]
}
```

#### `GET /public/routes`

复用 Routes 模块的接口，用于获取路线列表（Hero 右侧面板 + Route fit 卡片）。

**查询参数**：`fields=slug,title,summary,cover_image,city_name,culture,duration`

#### `GET /public/routes/stats`

轻量接口，返回路线总数（用于 Hero 计数动画）。

**响应**：

```json
{
  "route_count": 1
}
```

#### `POST /public/bookings`

提交预订表单。

**请求体**：

```json
{
  "name": "John Smith",
  "contact": "john@example.com",
  "city": "Zhanjiang",
  "service_date": "2026-06-15",
  "support_mode": "Story route guided support",
  "group_size": "1-2",
  "route_or_need": "Interested in the seafood route... any recommendations for timing?"
}
```

**校验规则**：


| 字段              | 规则                  |
| --------------- | ------------------- |
| `name`          | 必填，≤ 200            |
| `contact`       | 必填，≤ 300            |
| `city`          | 必填，必须在 cities 表中有对应 |
| `service_date`  | 必填，合法日期             |
| `support_mode`  | 必填，≤ 200            |
| `group_size`    | 非必填                 |
| `route_or_need` | 非必填                 |


**响应**（201 Created）：

```json
{
  "id": "uuid-aaaa",
  "message": "Booking request received. We will contact you within 24 hours.",
  "created_at": "2026-05-11T10:30:00Z"
}
```

### 3.2 管理后台 API（需认证）


| 方法     | 路径                                  | 说明                                      |
| ------ | ----------------------------------- | --------------------------------------- |
| `GET`  | `/admin/interpreting`               | 获取全部内容（含 service_modes, profiles, faqs） |
| `PUT`  | `/admin/interpreting/service-modes` | **全量替换**服务模式数组                          |
| `PUT`  | `/admin/interpreting/profiles`      | **全量替换**解释员档案数组                         |
| `PUT`  | `/admin/interpreting/faqs`          | **全量替换**FAQ 数组                          |
| `POST` | `/admin/upload`                     | 图片上传（通用，复用 Routes/Culture 接口）           |
| `GET`  | `/admin/bookings`                   | 预订列表（分页 + 状态筛选）                         |
| `GET`  | `/admin/bookings/:id`               | 单条预订详情                                  |
| `PUT`  | `/admin/bookings/:id/status`        | 更新预订状态                                  |


> **全量替换策略**：interpreting 的三张配置表数据量极小（各 ≤ 10 条），后台「保存」时可直接 DELETE ALL + INSERT ALL，无需精细化逐条 CRUD。与 Routes 模块的 stops 全量替换策略一致。

#### `GET /admin/interpreting`

获取全部可编辑内容，用于管理后台回填。

**响应**：

```json
{
  "service_modes": [...],
  "profiles": [...],
  "faqs": [...]
}
```

#### `PUT /admin/interpreting/service-modes`

**请求体**：

```json
{
  "service_modes": [
    {
      "sort_order": 0,
      "title": "City companion interpreting",
      "price": "From RMB 680 / half day",
      "best_for": "Best for independent visitors",
      "body": "For travelers who want English support on the ground...",
      "includes": ["English city support", "Restaurant and transit help", "Local etiquette notes"],
      "accent": "light",
      "featured": false
    }
  ]
}
```

**后端事务**：

```
BEGIN
  1. DELETE FROM interpreting_service_modes
  2. INSERT INTO interpreting_service_modes (...) VALUES × N 条
COMMIT
```

`PUT /admin/interpreting/profiles` 和 `PUT /admin/interpreting/faqs` 结构完全相同，只是操作各自的表。

#### `GET /admin/bookings`

预订提交列表。

**查询参数**：


| 参数       | 类型     | 默认值 | 说明                                      |
| -------- | ------ | --- | --------------------------------------- |
| `page`   | int    | 1   | 页码                                      |
| `size`   | int    | 20  | 每页条数                                    |
| `status` | string | —   | `"new"` / `"read"` / `"contacted"` / 全部 |
| `q`      | string | —   | 搜索 name / contact / city                |


**响应**：

```json
{
  "items": [
    {
      "id": "uuid-aaaa",
      "name": "John Smith",
      "contact": "john@example.com",
      "city": "Zhanjiang",
      "service_date": "2026-06-15",
      "support_mode": "Story route guided support",
      "group_size": "1-2",
      "status": "new",
      "created_at": "2026-05-11T10:30:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "size": 20
}
```

#### `PUT /admin/bookings/:id/status`

**请求体**：

```json
{
  "status": "contacted"
}
```

**响应**：`200 OK`，返回更新后的 booking 对象。

### 3.3 错误格式

```json
{
  "statusCode": 400,
  "message": "name is required",
  "error": "Bad Request"
}
```


| 状态码 | 场景      |
| --- | ------- |
| 400 | 参数校验失败  |
| 404 | 资源不存在   |
| 409 | 数据冲突    |
| 413 | 图片过大    |
| 415 | 图片格式不支持 |


---

## 4. 管理后台设计

### 4.1 整体布局

```
┌──────────────────────────────────────────────────────────┐
│  Culvoy Admin                         [账号] [退出]     │
├──────────────┬───────────────────────────────────────────┤
│  导航         │                                           │
│              │  Interpreting 设置                   [保存]│
│  Culture     │                                           │
│  Routes      ├───────────────────────────────────────────┤
│  Interpreting│  [Tab: 服务模式] [Tab: 解释员] [Tab: FAQ]  │
│  ◀           │                                           │
│  Shop        │  ┌── 左侧预览 ────┐ ┌── 右侧编辑器 ──────┐│
│  Bookings    │  │ 实时所见即所得  │ │ 表单/编辑器        ││
│              │  └────────────────┘ └────────────────────┘│
├──────────────┴───────────────────────────────────────────┤
│  Bookings 菜单 → 预订列表（新后台页面）                    │
└──────────────────────────────────────────────────────────┘
```

三个 Tab 各自独立编辑，右上角 **一个「保存」按钮**统一提交全部 Tab 数据。
右侧 Bookings 菜单进入独立的预订管理页面。

### 4.2 Tab 1：服务模式编辑

#### 左侧预览

模拟页面 `Service modes` 区域的三卡布局：

```
┌──────────────────────────────────────────────┐
│  Service modes                               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│  │ City    │  │ Story   │  │ Group   │     │
│  │ Companion│  │ Route   │  │ & Study │     │
│  │ Interpr.│  │ Guided  │  │ Visit   │     │
│  │ RMB 680 │  │ RMB1280 │  │ Custom  │     │
│  │         │  │ ★Recomm │  │         │     │
│  └─────────┘  └─────────┘  └─────────┘     │
│         ↑ 拖拽排序                          │
│         [+ 新增模式]                        │
└──────────────────────────────────────────────┘
```

#### 右侧表单

每张卡片编辑面板：

```
服务模式列表                        [+ 新增]

▸ 卡片 1: City companion interpreting
  ┌─────────────────────────────────────────┐
  │ title     [City companion interpreting] │
  │ price     [From RMB 680 / half day   ]  │
  │ best_for  [Best for independent visitors│
  │           ]                              │
  │ body (MD)                               │
  │ [Tiptap 编辑器 — 仅段落/加粗/斜体/链接] │
  │ includes                                 │
  │   1. [English city support            ]  │
  │   2. [Restaurant and transit help     ]  │
  │   3. [Local etiquette notes           ]  │
  │   [+ 添加]                               │
  │ accent    [light ▾]                      │
  │ featured  [☐ Recommended badge]          │
  │ [× 删除此卡片]                           │
  └─────────────────────────────────────────┘

▸ 卡片 2: Story route guided support
▸ 卡片 3: Group and study visit
```

### 4.3 Tab 2：解释员档案编辑

#### 左侧预览

模拟右侧面板的翻转卡列表：

```
┌──────────────────────────────┐
│  Interpreter profiles        │
│                              │
│  ┌────────────────────────┐  │
│  │  Culture Route Lead    │  │
│  │  English/Mandarin/Can  │  │
│  │  Guangdong city hist.. │  │
│  │  [Museums][Streets]    │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │  Food & Local Life     │  │
│  │  ...                   │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │  Study Visit Coord.    │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

#### 右侧表单

```
解释员列表                        [+ 新增]

▸ 档案 1: Culture Route Lead
  ┌─────────────────────────────────────────┐
  │ name     [Culture Route Lead          ] │
  │ language [English / Mandarin /          │
  │           Cantonese support           ]  │
  │ focus (MD)                              │
  │ [Tiptap 编辑器 — 描述正文]              │
  │ helps                                   │
  │   1. [Museum visits                  ]  │
  │   2. [Historic streets               ]  │
  │   3. [Narrative pacing               ]  │
  │   [+ 添加]                              │
  │ [× 删除此档案]                          │
  └─────────────────────────────────────────┘
```

### 4.4 Tab 3：FAQ 编辑

#### 左侧预览

模拟 FAQ Accordion 列表：

```
┌─────────────────────────────┐
│  Questions                  │
│                             │
│  ▸ Is this a tour guide or  │  ← 展开状态
│    interpreting service?    │
│    ┌─────────────────────┐  │
│    │ It is designed as   │  │
│    │ cultural interpret. │  │
│    └─────────────────────┘  │
│                             │
│  ▸ Can I book only          │  ← 折叠状态
│    restaurant support?      │
│                             │
│  ▸ Do I need to follow      │
│    a Culvoy route?        │
└─────────────────────────────┘
```

#### 右侧表单

```
FAQ 列表                          [+ 新增]

▸ Q1: Is this a tour guide or interpreting service?
  ┌─────────────────────────────────────────┐
  │ question [Is this a tour guide service  │
  │          or an interpreting service?  ] │
  │ answer (MD)                             │
  │ [Tiptap 编辑器 — 全文+链接]             │
  │ [× 删除此条目]                          │
  └─────────────────────────────────────────┘
```

### 4.5 Tiptap MD 编辑器配置

#### 短文本（service_modes.body / profiles.focus / faqs.answer）


| 功能      | 状态           |
| ------- | ------------ |
| 加粗 / 斜体 | ✅            |
| 链接      | ✅            |
| 段落      | ✅            |
| 图片插入    | ❌（本模块无需内嵌图片） |
| 标题      | ❌            |


#### faqs.answer 可额外支持


| 功能         | 状态  | 原因    |
| ---------- | --- | ----- |
| Blockquote | ✅   | 引用性回答 |
| 无序列表       | ✅   | 分点说明  |


### 4.6 保存 & 校验

右上角统一 **[保存]** 按钮，一次性提交三个 Tab 的全部数据。

**后端行为**：

```
1. PUT /admin/interpreting/service-modes  ← 全量替换
2. PUT /admin/interpreting/profiles       ← 全量替换
3. PUT /admin/interpreting/faqs           ← 全量替换
```

**校验规则**（保存前）：


| 表             | 字段         | 规则                      |
| ------------- | ---------- | ----------------------- |
| service_modes | `title`    | 必填，≤ 200                |
| &nbsp;        | `price`    | 必填，≤ 100                |
| &nbsp;        | `body`     | 必填                      |
| &nbsp;        | `includes` | ≥ 1 项                   |
| &nbsp;        | `accent`   | 仅限 `"light"` / `"dark"` |
| profiles      | `name`     | 必填，≤ 200                |
| &nbsp;        | `language` | 必填，≤ 200                |
| &nbsp;        | `focus`    | 必填                      |
| &nbsp;        | `helps`    | ≥ 1 项                   |
| faqs          | `question` | 必填，≤ 500                |
| &nbsp;        | `answer`   | 必填                      |


### 4.7 Bookings 管理页面（独立页面）

进入方式：左侧导航「Bookings」

#### 页面布局

```
┌─────────────────────────────────────────────────────┐
│  Bookings                               [导出 CSV]  │
│                                                     │
│  筛选: [状态 ▾] [搜索...]                            │
│                                                     │
│  ┌───┬──────────┬──────────┬───────┬────────┬─────┐ │
│  │ # │  Name    │  Contact  │ City  │  Date  │Status│ │
│  ├───┼──────────┼──────────┼───────┼────────┼─────┤ │
│  │ 1 │ J.Smith  │ j@e.com  │ ZJ    │ 6/15   │新   │ │
│  │   │          │          │       │        │     │ │
│  │ 2 │ ...      │ ...      │ ...   │ ...    │...  │ │
│  └───┴──────────┴──────────┴───────┴────────┴─────┘ │
│                                                     │
│  点击行 → 展开详情弹窗                                │
└─────────────────────────────────────────────────────┘
```

#### 详情弹窗

```
┌──────────────────────────────────────────┐
│  Booking Detail                    [×]   │
│                                          │
│  Name:         John Smith                │
│  Contact:      john@example.com          │
│  City:         Zhanjiang                 │
│  Service Date: 2026-06-15                │
│  Support Mode: Story route guided        │
│  Group Size:   1-2                       │
│  Route/Need:   Interested in...          │
│                                          │
│  Status:       [new ▾]  [更新]           │
│               new / read / contacted     │
│               / confirmed / cancelled    │
│                                          │
│  Submitted:    2026-05-11 10:30 UTC      │
└──────────────────────────────────────────┘
```

---

## 5. 前端数据联动

### 5.1 Interpreting 页数据流

```
Server Component (page.tsx)
  │
  ├─ 当前: page.tsx 硬编码全部数据
  │
  ├─ 未来:
  │   ├─ fetch(`${API}/public/interpreting`)     → service_modes, profiles, faqs
  │   ├─ fetch(`${API}/public/cities?fields=...`) → 城市下拉 + 城市卡片
  │   ├─ fetch(`${API}/public/routes/stats`)     → 路线计数
  │   └─ POST(`${API}/public/bookings`)          → 提交表单
  │
  └─ 数据分发:
        Hero metrics ← city_count + route_count (数字)
        Service modes ← service_modes[]
        Interpreter profiles ← profiles[]
        FAQ ← faqs[]
        Booking form ← cities[] (下拉选项)
        Route fit panel ← routes[0] (第一条路线)
```

### 5.2 硬编码保留数据

以下数据**不经过后端**，继续写死在 `page.tsx` 中：


| 数据块                    | 原因                                                |
| ---------------------- | ------------------------------------------------- |
| Hero 标题文案              | 产品定位语，不改                                          |
| Hero 简介                | 品牌核心理念说明                                          |
| Hero 指标标签文本            | "live service template", "from half-day..." 为静态文案 |
| What we handle 标签      | 服务能力定义固定                                          |
| Response style 面板      | 品牌调性文案                                            |
| matchingScenarios[]    | 四种营销场景描述                                          |
| bookingSteps[]         | 产品流程定义固定                                          |
| requestChecklist       | 表单填写指引                                            |
| "How this helps" 面板    | 产品利益说明                                            |
| "What happens next" 面板 | 流程说明                                              |
| "Good fit" 面板          | 营销文案                                              |
| CTA 区域                 | 底部号召文案                                            |
| progressSections       | 章节导航配置                                            |
| 所有 CSS/布局/动画           | 前端代码架构                                            |


### 5.3 前端 TypeScript 类型

```typescript
// 与后端 API 响应结构一一对应

interface InterpretingPageData {
  service_modes: ServiceMode[];
  profiles: InterpreterProfile[];
  faqs: FAQItem[];
}

interface ServiceMode {
  id: string;
  sort_order: number;
  title: string;
  price: string;
  best_for: string;
  body: string;
  includes: string[];
  accent: "light" | "dark";
  featured: boolean;
}

interface InterpreterProfile {
  id: string;
  sort_order: number;
  name: string;
  language: string;
  focus: string;
  helps: string[];
}

interface FAQItem {
  id: string;
  sort_order: number;
  question: string;
  answer: string;
}

interface BookingSubmission {
  name: string;
  contact: string;
  city: string;
  service_date: string;
  support_mode: string;
  group_size?: string;
  route_or_need?: string;
}

interface CityOption {
  slug: string;
  name: string;
  label: string;
  tags: string[];
  gallery: string[];
}
```

### 5.4 迁移路径


| 步骤  | 内容                                                      | 优先级 |
| --- | ------------------------------------------------------- | --- |
| 1   | 后端建表 + Migration                                        | P0  |
| 2   | 后端 `GET /public/interpreting` + `POST /public/bookings` | P0  |
| 3   | 前端 page.tsx 改为 fetch 调用                                 | P1  |
| 4   | 管理后台 3 个 Tab 编辑器                                        | P1  |
| 5   | Bookings 管理页面（详情+状态更新）                                  | P2  |


---

## 6. 实现计划

### Phase 1：数据库

- [ ] Migration: `interpreting_service_modes`
- [ ] Migration: `interpreter_profiles`
- [ ] Migration: `interpreting_faqs`
- [ ] Migration: `booking_submissions`
- [ ] 索引 + 外键约束验证

### Phase 2：Service 层（NestJS）

- [ ] `InterpretingService`: CRUD + 全量替换事务
- [ ] `BookingsService`: 提交 + 查询 + 状态更新
- [ ] 与 `CitiesService` 的联动查询

### Phase 3：Controller 层

- [ ] `PublicInterpretingController`: `GET /public/interpreting`
- [ ] `PublicBookingsController`: `POST /public/bookings`
- [ ] `AdminInterpretingController`: GET + 3 个 PUT
- [ ] `AdminBookingsController`: 列表 + 详情 + 状态更新
- [ ] DTO 校验 (class-validator)
- [ ] Swagger 文档

### Phase 4：管理后台（React + Ant Design）

- [ ] Interpreting 设置页（3 Tab 编辑器）
- [ ] 服务模式编辑器（拖拽排序 + 表单）
- [ ] 解释员编辑器（拖拽排序 + 表单）
- [ ] FAQ 编辑器（拖拽排序 + 表单）
- [ ] Bookings 列表页（筛选 + 分页）
- [ ] Booking 详情弹窗 + 状态更新
- [ ] 保存/全量替换逻辑

### Phase 5：前端 API 对接

- [ ] `page.tsx` 中 `fetch(API/public/interpreting)` 替换硬编码
- [ ] 表单提交 `POST /api/public/bookings`
- [ ] 城市下拉动态拉取
- [ ] 加载骨架屏 + 错误处理
- [ ] 表单提交成功/失败 toast

&nbsp;