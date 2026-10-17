# Routes 模块后端设计文档

> 版本: 2.0 | 日期: 2026-05-11 | 关联: Culvoy 整体后端设计 v1.0 / Culture 模块 v1.0

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

> 存储策略对齐 Culture 模块：所有文本字段为 `TEXT`，存储 Markdown 字符串，前端用 `react-markdown` 渲染。图片字段存 OSS URL。

### 1.1 核心实体关系

```
story_routes (路线主表)
      │
      │ 1:N
      ▼
route_stops (行程站点 — 可变数组)
      │
      │ M:N  (通过 route_city_links)
      ▼
cities (文化城市 — 复用 Culture 模块)
```

### 1.2 story_routes 表

```sql
CREATE TABLE story_routes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            VARCHAR(100) NOT NULL UNIQUE,       -- URL 标识，如 "southern-sea-table"
    title           VARCHAR(200) NOT NULL,               -- 路线标题
    culture         VARCHAR(40) NOT NULL,                -- 文化标签：Coastal/Guangfu/Chaoshan/Hakka/Bay Area/Mountain
    city_name       VARCHAR(100) NOT NULL,               -- 主要关联城市名
    duration        VARCHAR(40) NOT NULL,                -- 行程时长，如 "1 day"
    audience        VARCHAR(100) NOT NULL DEFAULT '',    -- 适合人群
    summary         TEXT NOT NULL,                       -- 封面简介（MD）
    story           TEXT NOT NULL,                       -- 路线叙事引言（MD）
    cover_image     VARCHAR(500) NOT NULL,               -- 封面大图 OSS URL
    published       BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_story_routes_slug ON story_routes(slug);
CREATE INDEX idx_story_routes_published ON story_routes(published);
```

**字段 → 前端对照**：

| 字段 | 前端组件 | 渲染 |
|------|---------|------|
| `cover_image` | `IntroHero` 背景图 | `<img>` |
| `title` | `IntroHero` 大标题 | serif 大字号 |
| `summary` | `IntroHero` 副标题 | MD 渲染 |
| `culture` + `duration` + `audience` | 封面标签行 | mono 金色标签 |
| `story` | Route Narrative 区 | MD 渲染，居中 italic |
| `city_name` | 封面城市标注 / 列表页 | 标签 |

### 1.3 route_stops 表（可变数组）

```sql
CREATE TABLE route_stops (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id        UUID NOT NULL REFERENCES story_routes(id) ON DELETE CASCADE,
    sort_order      INT NOT NULL,                       -- 排序序号 0, 1, 2, 3...
    time            VARCHAR(10) NOT NULL,               -- 到达时间，如 "08:00"
    stop_name       VARCHAR(200) NOT NULL,               -- 站点名称
    story           TEXT NOT NULL,                       -- 一句话描述（MD）
    cultural_story  TEXT NOT NULL,                       -- 深度文化故事（MD 长文）
    details         JSONB NOT NULL DEFAULT '[]',         -- 要点数组 ["要点1", "要点2", ...]
    image           VARCHAR(500) NOT NULL,               -- 该站封面图 OSS URL
    lat             DOUBLE PRECISION,                    -- 纬度
    lng             DOUBLE PRECISION,                    -- 经度
    meal            VARCHAR(200),                        -- 餐饮
    hotel           VARCHAR(200),                        -- 住宿
    transit         VARCHAR(200),                        -- 交通
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(route_id, sort_order)
);

CREATE INDEX idx_route_stops_route_id ON route_stops(route_id);
```

**字段 → 前端对照**：

| 字段 | StopCard | ImmersiveModal |
|------|---------|----------------|
| `image` | ✅ 大图（hover 微缩放） | ✅ Hero 大图 |
| `stop_name` | ✅ Georgia 大标题 | ✅ 侧栏标题 |
| `story` | ✅ 斜体引语 | ❌ |
| `details[]` | ✅ 红点列表 | ✅ 侧栏标签 pills |
| `cultural_story` | ❌ | ✅ 正文（首字母放大） |
| `time` | 进度条 | ✅ 侧栏 mono 金色 |
| `meal` | ❌ | ✅ 底部卡片（条件渲染） |
| `hotel` | ❌ | ✅ 底部卡片 |
| `transit` | ❌ | ✅ 底部卡片 |
| `lat` / `lng` | ❌ | ❌（未来地图用） |

### 1.4 route_city_links 表（多对多）

```sql
CREATE TABLE route_city_links (
    route_id    UUID NOT NULL REFERENCES story_routes(id) ON DELETE CASCADE,
    city_id     UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    sort_order  INT DEFAULT 0,
    UNIQUE(route_id, city_id)
);

CREATE INDEX idx_route_city_links_route_id ON route_city_links(route_id);
CREATE INDEX idx_route_city_links_city_id ON route_city_links(city_id);
```

> `cities` 表复用 Culture 模块，无需新建。

---

## 2. 前端页面结构 & 数据字段对照

### 2.1 路线列表页 `/routes`

```
┌──────────────────────────────────────────────────────┐
│  STORY ROUTES                                        │
│  Routes are written as stories, not checklists.       │
├──────────────────────────────────────────────────────┤
│ ┌────────────┐  ┌────────────────────────────────┐   │
│ │ cover_image│  │ culture · duration · audience  │   │
│ │            │  │ title                           │   │
│ │            │  │ summary (摘要)                   │   │
│ │            │  │ FilmStrip 旅程预览               │   │
│ │            │  │ View full journey →             │   │
│ └────────────┘  └────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### 2.2 路线详情页 `/routes/:slug`（完整结构）

```
① IntroHero
     cover_image 全屏背景 | title | summary | 标签行
     入场动画：y:20→0 淡入 | 视差滑动 | 渐隐

② ProgressHeader (sticky)
     0{activeIdx+1}/0{stops.length} · stop_name · ████░░ 进度条

③ Route Narrative
     story（MD 渲染）→ 居中 italic + 金线装饰

④ ScrollStoryRoute
     层 0 (z-0): GoldenThread 蜿蜒金线，随滚动绘制
     层 1 (z-10): StopCard × N，白色实底浮在线上
         偶数卡：图左文右（大卡，82% 宽）
         奇数卡：文左图右（小卡，68% 宽）
         点击 "Enter the story" → ImmersiveModal

⑤ ImmersiveModal (全屏覆层)
     左侧 sticky 38%:
         "Memories of this place" | ClockIcon | 序号
         stop_name 标题 | time | details pills
         ← Prev / Next →
     右侧滚动 62%:
         image 大图 | cultural_story 首字母放大
         meal / hotel / transit 卡片
         Discovery Route 时间轴

⑥ Cities along the way
     route_city_links → cities 卡
     label / name / tags / gallery[0]
     点击 → /culture/:slug

⑦ CTA 暗色底
     Book an interpreter → /interpreting
     Browse more routes → /routes
```

### 2.3 前端组件 ↔ 数据库字段完整映射

#### StopCard（站点卡片）

| 展示 | 字段 | 格式 |
|------|------|------|
| 大图 | `image` | OSS URL → `<img>` + 兜底 SVG |
| "Route Stop 01" | `sort_order + 1` | mono 金色标签 |
| 大标题 | `stop_name` | Georgia serif, 2.1-4.8rem |
| 斜体引语 | `story` | MD → italic, 17px |
| 红点列表 | `details[]` | JSONB → 红点 + 文字 |
| "Enter the story" | — | 硬编码 CTA 按钮 |

#### ImmersiveModal（详情覆层）

| 展示 | 字段 | 格式 |
|------|------|------|
| 侧栏标题 | `stop_name` | serif 3-4xl |
| 侧栏时间 | `time` | mono 金色 |
| 侧栏标签 | `details` 前 3 个 | 截断 28 字符 pill |
| 正文大图 | `image` | 圆角 1.5rem + 阴影 |
| 文化故事 | `cultural_story` | MD → 首字母放大（drop-cap） |
| 餐饮卡片 | `meal` | 条件：非空才渲染 |
| 住宿卡片 | `hotel` | 条件：非空才渲染 |
| 交通卡片 | `transit` | 条件：非空才渲染 |

---

## 3. API 接口设计

### 3.1 前台公共 API（只读，无需认证）

#### `GET /public/routes`

路线列表，不含 stops 详情。

**查询参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `city_slug` | string | 可选，按城市过滤 |

**响应**：

```json
{
  "routes": [
    {
      "slug": "southern-sea-table",
      "title": "A Southern Sea Table",
      "culture": "Coastal",
      "city_name": "Zhanjiang",
      "duration": "1 day",
      "audience": "Curious travellers",
      "summary": "From a pre-dawn seafood auction...",
      "cover_image": "https://oss.lingtour.cn/routes/southern-sea-table/cover.jpg",
      "stop_count": 4
    }
  ]
}
```

#### `GET /public/routes/:slug`

单条路线完整详情。

**响应**：

```json
{
  "slug": "southern-sea-table",
  "title": "A Southern Sea Table",
  "culture": "Coastal",
  "city_name": "Zhanjiang",
  "duration": "1 day",
  "audience": "Curious travellers",
  "summary": "From a pre-dawn seafood auction...",
  "story": "Most people meet Guangdong through its cities...",
  "cover_image": "https://oss.lingtour.cn/routes/southern-sea-table/cover.jpg",
  "stops": [
    {
      "sort_order": 0,
      "time": "08:00",
      "stop_name": "Huguangyan Maar Lake",
      "story": "Begin where the land remembers fire...",
      "details": ["要点1", "要点2", "要点3", "要点4"],
      "cultural_story": "Huguangyan formed roughly 160,000 years ago...\n\nThe circular lake spans 1.8 km across...",
      "image": "https://oss.lingtour.cn/routes/southern-sea-table/stop-0.jpg",
      "lat": 21.147,
      "lng": 110.277,
      "meal": null,
      "hotel": null,
      "transit": null
    }
  ],
  "cities": [
    {
      "slug": "zhanjiang",
      "name": "Zhanjiang",
      "label": "Southern Coast",
      "tags": ["Coast", "Seafood", "Volcanic landscape"],
      "gallery": ["https://oss.lingtour.cn/cities/zhanjiang/1.jpg"]
    }
  ]
}
```

### 3.2 管理后台 API（需认证）

#### `GET /admin/routes`

路由列表（分页 + 搜索）。

**查询参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | int | 1 | 页码 |
| `size` | int | 20 | 每页条数 |
| `q` | string | — | 搜索标题/城市名 |
| `culture` | string | — | 按文化标签过滤 |
| `published` | bool | — | 按发布状态过滤 |

**响应**：

```json
{
  "items": [
    {
      "id": "uuid-xxxx",
      "slug": "southern-sea-table",
      "title": "A Southern Sea Table",
      "culture": "Coastal",
      "city_name": "Zhanjiang",
      "duration": "1 day",
      "stop_count": 4,
      "published": true,
      "updated_at": "2026-05-10T12:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "size": 20
}
```

#### `POST /admin/routes`

一次性创建路线。后端事务写入 story_routes + route_stops + route_city_links 三张表。

**请求体**：

```json
{
  "slug": "southern-sea-table",
  "title": "A Southern Sea Table",
  "culture": "Coastal",
  "city_name": "Zhanjiang",
  "duration": "1 day",
  "audience": "Curious travellers",
  "summary": "From a pre-dawn seafood auction...",
  "story": "Most people meet Guangdong through its cities...",
  "cover_image": "https://oss.lingtour.cn/.../cover.jpg",
  "published": false,
  "city_slugs": ["zhanjiang"],
  "stops": [
    {
      "sort_order": 0,
      "time": "08:00",
      "stop_name": "Huguangyan Maar Lake",
      "story": "Begin where the land remembers fire...",
      "details": ["要点1", "要点2", "要点3", "要点4"],
      "cultural_story": "Huguangyan formed roughly 160,000 years ago...",
      "image": "https://oss.lingtour.cn/.../stop-0.jpg",
      "lat": 21.147,
      "lng": 110.277,
      "meal": null,
      "hotel": null,
      "transit": null
    }
  ]
}
```

**后端事务**：

```
BEGIN
  1. INSERT INTO story_routes (...) VALUES (...) RETURNING id
  2. INSERT INTO route_stops (route_id, ...) VALUES ($id, ...) × N 条
  3. DELETE FROM route_city_links WHERE route_id = $id
  4. INSERT INTO route_city_links (...) 
       SELECT $id, c.id, row_number() OVER ()
       FROM cities c WHERE c.slug = ANY($city_slugs)
COMMIT
```

#### `GET /admin/routes/:id`

获取单条路线完整数据（用于编辑回填）。

**响应**：与 `POST` 请求体结构完全一致，额外包含 `id`、`created_at`、`updated_at`。

#### `PUT /admin/routes/:id`

一次性更新。全量替换 stops 和 city links。

**请求体**：与 `POST` 完全相同。

**后端事务**：

```
BEGIN
  1. UPDATE story_routes SET ... WHERE id = $id
  2. DELETE FROM route_stops WHERE route_id = $id
  3. INSERT INTO route_stops (...) × N 条
  4. DELETE FROM route_city_links WHERE route_id = $id
  5. INSERT INTO route_city_links (...)
COMMIT
```

#### `DELETE /admin/routes/:id`

删除路线。`ON DELETE CASCADE` 自动清除 stops 和 links。

**响应**：`204 No Content`

#### `POST /admin/upload`

图片上传（通用接口，Route + Culture 共用）。

**请求**：`multipart/form-data`，字段 `file`

**校验**：类型 jpg/png/webp | 大小 ≤ 10MB

**响应**：

```json
{
  "url": "https://oss.lingtour.cn/routes/southern-sea-table/cover.jpg",
  "width": 1600,
  "height": 900
}
```

### 3.3 错误格式

```json
{
  "statusCode": 400,
  "message": "title is required",
  "error": "Bad Request"
}
```

| 状态码 | 场景 |
|--------|------|
| 400 | 参数校验失败 |
| 404 | slug 不存在 |
| 409 | slug 重复 |
| 413 | 图片过大 |
| 415 | 图片格式不支持 |

---

## 4. 管理后台设计

### 4.1 整体布局

```
┌─────────────────────────────────────────────────────────┐
│  Culvoy Admin                        [账号] [退出]     │
├────────────┬────────────────────────────────────────────┤
│  导航       │                                            │
│            │  新增路线                         [保存]    │
│  Culture   │                                            │
│  Routes ◀  ├────────────────────────────────────────────┤
│  Shop      │                                            │
│  ...       │  [模块 1: 封面]  [模块 2: 站点]  [模块 3: 详情] │
│            │                                            │
│            │  ┌── 左侧预览 ──────┐ ┌── 右侧编辑器 ──────┐ │
│            │  │ 实时预览         │ │ Tiptap MD 编辑器   │ │
│            │  │ 所见即所得       │ │ 图片上传占位区     │ │
│            │  └──────────────────┘ └────────────────────┘ │
└────────────┴────────────────────────────────────────────┘
```

三个模块按顺序 Tab 切换。右上角 [保存草稿] / [发布] 全局按钮。

### 4.2 模块 1：封面编辑

#### 左侧预览

模拟 `IntroHero` 组件：

```
┌─────────────────────────────┐
│                             │
│    [cover_image 全屏]       │
│                             │
│  Coastal · 1 day            │
│                             │
│  A Southern Sea Table       │
│                             │
│  From a pre-dawn seafood    │
│  auction to a volcanic      │
│  crater lake...             │
│                             │
│  ↓ Let the story unfold     │
└─────────────────────────────┘
```

#### 右侧表单

| 字段 | 控件 | 说明 |
|------|------|------|
| `cover_image` | 图片上传区 | 点击 → 选择文件 → `POST /admin/upload` → 回填 URL |
| `slug` | 文本框 | `title` 输入时自动 kebab-case 生成，下方显示 `lingtour.cn/routes/{slug}` |
| `title` | 文本框 | 输入时 slug 联动 |
| `culture` | 下拉 | Coastal / Guangfu / Chaoshan / Hakka / Bay Area / Mountain |
| `city_name` | 文本框 | 主要城市名 |
| `duration` | 文本框 | "1 day" / "2 days" |
| `audience` | 文本框 | "Curious travellers" |
| `summary` | Tiptap MD 编辑器 | 封面简介，实时渲染到左侧 |
| `story` | Tiptap MD 编辑器 | 路线叙事引言 |
| 关联城市 | 多选面板 | 搜索已有城市 → 勾选 → 拖拽排序 |

### 4.3 模块 2：站点 + 站点封面

#### 左侧预览

StopCard 缩略图列表（模拟 ScrollStoryRoute 排列）：

```
┌──────────────────────────────────┐
│  ┌────────────────────────────┐  │
│  │ [封面图]  08:00            │  │
│  │           Huguangyan       │  │
│  │           (story 引语)      │  │
│  │           • 要点1          │  │
│  │           [Enter story]    │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ 11:00     [封面图]         │  │
│  │           Dongfeng Market  │  │
│  └────────────────────────────┘  │
│  ...                             │
│  [+ 新增站点]                     │
└──────────────────────────────────┘
```

#### 右侧面板

站点列表（可拖拽排序）：

```
站点列表                        [+ 新增站点]

▸ 站点 1: Huguangyan Maar Lake  [08:00]
  ┌─────────────────────────────────────────┐
  │ time        [08:00                    ]  │
  │ stop_name   [Huguangyan Maar Lake     ]  │
  │ 封面图      [点击上传]                   │
  │ lat / lng   [21.147  ] [110.277 ]       │
  │             [地图选点]                    │
  │ [× 删除]              [编辑详情 →]      │
  └─────────────────────────────────────────┘

▸ 站点 2: Dongfeng Seafood Market  [11:00]
▸ 站点 3: Xiashan French Heritage  [14:00]
▸ 站点 4: Jinsha Bay & Seafood Dinner  [17:30]
```

| 操作 | 效果 |
|------|------|
| 拖拽面板 | 改变 `sort_order`，左侧预览同步 |
| 上传图片 | `POST /admin/upload` → 回填 URL |
| 「编辑详情 →」 | 跳到模块 3，选中该站 |
| 「× 删除」 | 确认后删除，sort_order 重排 |
| 「+ 新增站点」 | 末尾追加空白站点 |

### 4.4 模块 3：站点详情编辑

#### 左侧预览

模拟 `ImmersiveModal`：

```
┌──────────────────────────────────┐
│  [站点封面大图]                   │
│                                  │
│  Memories of this place          │
│  [时钟图标]                      │
│  01 / 04                        │
│  Huguangyan Maar Lake            │
│  08:00                          │
│  [要点1] [要点2] [要点3]         │
│  ← Prev    Next →               │
├──────────────────────────────────┤
│  cultural_story MD 渲染正文...   │
│                                  │
│  ┌─ Meal ─┐ ┌─ Stay ──┐        │
│  │ (内容) │ │ (内容)  │        │
│  └────────┘ └─────────┘        │
│                                  │
│  Discovery Route                 │
│  08:00 — Huguangyan              │
│  11:00 — Dongfeng Market         │
│  14:00 — Xiashan French          │
│  17:30 — Jinsha Bay              │
└──────────────────────────────────┘
```

#### 右侧编辑器

```
当前编辑：站点 1 — Huguangyan Maar Lake  [切换 ▾]

story (一句话描述)
┌─────────────────────────────────────────┐
│ Begin where the land remembers fire...  │
└─────────────────────────────────────────┘

details (要点列表)
  1. [Start the day at the UNESCO Global Geopark...]
  2. [Walk the 2.3 km rim trail...                ]
  3. [Visit the volcanic geology museum...        ]
  4. [Observe the lake's strange properties...    ]
  [+ 添加要点]

────────────────────────────────────────────

行程服务
  meal     [                          ]
  hotel    [                          ]
  transit  [                          ]

────────────────────────────────────────────

cultural_story (深度文化故事) — 全功能 MD 编辑器
┌─────────────────────────────────────────┐
│ Huguangyan formed roughly 160,000       │
│ years ago when rising magma met         │
│ groundwater and exploded...             │
│                                         │
│ The circular lake spans 1.8 km          │
│ across, ringed by a 2.3 km walking      │
│ trail...                                │
└─────────────────────────────────────────┘
```

**「切换」下拉**：列出所有站点，选中后左侧预览 + 右侧编辑器同步切换。

### 4.5 Tiptap MD 编辑器配置

#### 短文本（summary / story / stop.story）

| 功能 | 状态 |
|------|------|
| 加粗 / 斜体 | ✅ |
| 链接 | ✅ |
| 段落 | ✅ |
| 图片插入 | ❌（图片独立上传） |
| 标题 | ❌ |

#### 长文（cultural_story）

| 功能 | 状态 |
|------|------|
| 加粗 / 斜体 | ✅ |
| 链接 | ✅ |
| 段落 | ✅ |
| Blockquote | ✅（前端映射为 serif 引语） |
| 图片插入 | ❌ |
| H2 / H3 | 可选 |

### 4.6 保存 & 校验

右上角两个按钮：

| 按钮 | 行为 |
|------|------|
| **[保存草稿]** | `published: false`，保存后 toast"已保存草稿" |
| **[发布]** | `published: true`，保存后 toast"已发布"，跳转列表 |

**校验规则**（保存前）：

| 字段 | 规则 |
|------|------|
| `title` | 必填，≤ 200 |
| `slug` | 必填，`^[a-z0-9-]+$`，数据库唯一 |
| `cover_image` | 必填 |
| `summary` | 必填 |
| `culture` | 必填，枚举 |
| `stops` | ≥ 1 个 |
| 每个 `stop.stop_name` | 必填 |
| 每个 `stop.time` | 必填 |
| 每个 `stop.image` | 必填 |

---

## 5. 前端数据联动

### 5.1 Route 详情页数据流

```
Server Component (page.tsx)
  │
  ├─ 当前: getStoryRoute(slug) → data/routes.ts 硬编码
  │  未来: fetch(`${API}/public/routes/${slug}`)
  │
  ├─ 当前: route.citySlugs → getCityCulture(cs)
  │  未来: 直接从 API 响应的 cities[] 取
  │
  └─ 数据分发:
        IntroHero ← title, summary, cover_image
        ScrollStoryRoute ← stops[], routeTitle, routeStory
        Cities section ← cities[]
```

### 5.2 Culture 页取路线列表

```
GET /public/routes?city_slug=zhanjiang
→ 返回该城市关联的全部路线卡片数据
→ Culture 详情页底部 Render
```

### 5.3 前端 TypeScript 类型

```typescript
// 与后端 API 响应结构一一对应
type StoryRoute = {
  slug: string;
  title: string;
  culture: string;
  city_name: string;
  duration: string;
  audience: string;
  summary: string;
  story: string;
  cover_image: string;
  stops: RouteStop[];
  cities: LinkedCity[];
};

type RouteStop = {
  sort_order: number;
  time: string;
  stop_name: string;
  story: string;
  details: string[];
  cultural_story: string;
  image: string;
  lat: number;
  lng: number;
  meal?: string;
  hotel?: string;
  transit?: string;
};

type LinkedCity = {
  slug: string;
  name: string;
  label: string;
  tags: string[];
  gallery: string[];
};
```

---

## 6. 实现计划

### Phase 1：数据库

- [ ] Migration: `story_routes` + `route_stops` + `route_city_links`
- [ ] 索引 + 外键约束验证

### Phase 2：Service 层（NestJS）

- [ ] `RoutesService`: CRUD + 事务写入
- [ ] 图片上传 Service (OSS SDK)
- [ ] 单元测试

### Phase 3：Controller 层

- [ ] `PublicRoutesController`: 2 个 GET
- [ ] `AdminRoutesController`: 6 个管理接口
- [ ] DTO 校验 (class-validator)
- [ ] Swagger 文档

### Phase 4：管理后台（React + Ant Design）

- [ ] 路线列表页
- [ ] 封面编辑器（模块 1）
- [ ] 站点管理器（模块 2 — 拖拽 + 上传）
- [ ] 站点详情编辑器（模块 3 — Tiptap）
- [ ] 图片上传组件
- [ ] 保存/发布逻辑

### Phase 5：前端 API 对接

- [ ] `data/routes.ts` 替换为 `fetch`
- [ ] ISR `revalidate = 3600`
- [ ] 加载骨架屏 + 错误处理
