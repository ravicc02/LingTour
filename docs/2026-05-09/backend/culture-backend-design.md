# Culture 模块后端设计文档

> 版本: 1.0 | 日期: 2026-05-09 | 关联: Culvoy 整体后端设计 v1.0

---

## 目录

1. [数据模型](#1-数据模型)
2. [API 接口设计](#2-api-接口设计)
3. [管理后台工作流](#3-管理后台工作流)
4. [前端数据联动](#4-前端数据联动)
5. [实现计划](#5-实现计划)

---

## 1. 数据模型

### 1.1 核心实体关系

```
cities (文化城市)  ←──M:N──→  story_routes (故事路线)
       │                            │
       │ 1:N                        │ 1:N
       ▼                            ▼
city_culture_sections          route_chapters
(可变文章段落)                  (路线章节)
                                    │
                                    │ 1:N
                                    ▼
                               route_stops
                               (路线站点)
```

### 1.2 cities 表（增强版）

在现有设计基础上升级，加入封面 Hero 区字段、编辑导语区和美食区字段：

```sql
CREATE TABLE cities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            VARCHAR(100) NOT NULL UNIQUE,
    name            VARCHAR(200) NOT NULL,          -- 城市名，如 "Zhanjiang"
    adcode          VARCHAR(6),                     -- 行政区划代码，如 "440800"
    region_label    VARCHAR(200) NOT NULL,           -- 地区标签，如 "Southern coast"
    hero_image      VARCHAR(500) NOT NULL,           -- 封面大图
    hero_narrative  TEXT NOT NULL,                   -- 封面简介，如 "Zhanjiang opens the southern sea chapter..."
    tags            JSONB NOT NULL DEFAULT '[]',     -- ["Coast", "Seafood", "Volcanic landscape"]
    entry_cta       VARCHAR(200) DEFAULT 'Enter',    -- CTA 文字，默认 "Enter"

    -- 编辑导语区（B 区）
    editor_intro    TEXT NOT NULL,                   -- MD 富文本

    -- 画廊区（3 张拼贴图）
    gallery_images  JSONB NOT NULL DEFAULT '[]',     -- ["url1", "url2", "url3"]

    -- 美食区（D 区）
    food_title      VARCHAR(300) NOT NULL,           -- "Flavours of Zhanjiang"
    food_description TEXT NOT NULL,                  -- MD 富文本
    food_images     JSONB NOT NULL DEFAULT '[]',     -- ["url1", "url2", "url3", "url4"] — 4 张拼贴图

    -- 发布状态
    published       BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cities_slug ON cities(slug);
CREATE INDEX idx_cities_published ON cities(published);
```

### 1.3 city_culture_sections 表（可变数组）

```sql
CREATE TABLE city_culture_sections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id         UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    title           VARCHAR(300) NOT NULL,           -- Section 标题，如 "Southern coast"
    body            TEXT NOT NULL,                   -- MD 富文本文章
    image           VARCHAR(500) NOT NULL,           -- 文章插图
    stat_label      VARCHAR(200),                    -- 数据卡片标签，如 "海岸线长度"
    stat_value      VARCHAR(100),                    -- 数据卡片值，如 "1,243 km"
    breath_image    VARCHAR(500),                    -- 段间呼吸点大图（可空）
    breath_quote    TEXT,                            -- 段间呼吸点引语（可空）
    sort_order      INT NOT NULL DEFAULT 0,          -- 排序
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_city_sections ON city_culture_sections(city_id, sort_order);
```

### 1.4 story_routes 表（增强版，支持多城市）

```sql
CREATE TABLE story_routes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            VARCHAR(100) NOT NULL UNIQUE,
    title           VARCHAR(300) NOT NULL,
    cover_image     VARCHAR(500),
    culture_tag     VARCHAR(50) NOT NULL,
    city_ids        JSONB NOT NULL DEFAULT '[]',
        -- [{ "slug": "zhanjiang", "name": "Zhanjiang" }]
    duration        VARCHAR(20) NOT NULL,
    audience        VARCHAR(100) NOT NULL,
    summary         TEXT NOT NULL,
    story_narrative TEXT NOT NULL,
    published       BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 1.5 city_route_links 关联表

城市与路线多对多的桥梁：

```sql
CREATE TABLE city_route_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id         UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    route_id        UUID NOT NULL REFERENCES story_routes(id) ON DELETE CASCADE,
    sort_order      INT NOT NULL DEFAULT 0,
    UNIQUE(city_id, route_id)
);

CREATE INDEX idx_crl_city ON city_route_links(city_id);
CREATE INDEX idx_crl_route ON city_route_links(route_id);
```

---

## 2. API 接口设计

### 2.1 概览

| 用途 | 方法 | 路径 | 认证 |
|------|------|------|------|
| 城市列表（前台） | GET | `/api/v1/public/cities` | 无 |
| 城市详情（前台） | GET | `/api/v1/public/cities/:slug` | 无 |
| 城市列表（管理） | GET | `/api/v1/admin/cities` | JWT |
| 城市详情（管理） | GET | `/api/v1/admin/cities/:slug` | JWT |
| 创建城市 | POST | `/api/v1/admin/cities` | JWT |
| 更新城市 | PUT | `/api/v1/admin/cities/:id` | JWT |
| 发布城市 | PATCH | `/api/v1/admin/cities/:id/publish` | JWT |
| 删除城市 | DELETE | `/api/v1/admin/cities/:id` | JWT |
| 城市章节列表 | GET | `/api/v1/admin/cities/:id/sections` | JWT |
| 创建章节 | POST | `/api/v1/admin/cities/:id/sections` | JWT |
| 更新章节 | PUT | `/api/v1/admin/sections/:id` | JWT |
| 删除章节 | DELETE | `/api/v1/admin/sections/:id` | JWT |
| 更新章节排序 | PATCH | `/api/v1/admin/cities/:id/sections/reorder` | JWT |
| 绑定路线 | POST | `/api/v1/admin/cities/:id/routes` | JWT |
| 解绑路线 | DELETE | `/api/v1/admin/cities/:id/routes/:routeId` | JWT |
| 图片上传 | POST | `/api/v1/admin/upload` | JWT |

### 2.2 前台公共 API

#### GET /api/v1/public/cities

```json
{
  "data": [
    {
      "slug": "zhanjiang",
      "name": "Zhanjiang",
      "regionLabel": "Southern coast",
      "heroImage": "https://oss.lingtour.cn/cities/zhanjiang-hero.jpg",
      "heroNarrative": "Zhanjiang opens the southern sea chapter...",
      "tags": ["Coast", "Seafood", "Volcanic landscape"],
      "routeSlugs": ["southern-sea-table"]
    }
  ],
  "total": 1
}
```

#### GET /api/v1/public/cities/:slug

```json
{
  "data": {
    "slug": "zhanjiang",
    "name": "Zhanjiang",
    "regionLabel": "Southern coast",
    "heroImage": "https://oss.lingtour.cn/...",
    "heroNarrative": "Zhanjiang opens...",
    "tags": ["Coast", "Seafood"],
    "entryCta": "Enter Zhanjiang",
    "editorIntro": "Zhanjiang sits at the southernmost edge...",
    "galleryImages": ["https://...", "https://...", "https://..."],
    "sections": [
      {
        "id": "uuid-1",
        "title": "Southern coast",
        "body": "Zhanjiang sits at the southernmost edge...\n\nWhat makes...",
        "image": "https://oss.lingtour.cn/...",
        "statLabel": "海岸线长度",
        "statValue": "1,243 km",
        "breathImage": "https://oss.lingtour.cn/...",
        "breathQuote": "The coast is not a line on a map...",
        "sortOrder": 0
      }
    ],
    "food": {
      "title": "Flavours of Zhanjiang",
      "description": "From dawn seafood markets...",
      "images": ["https://...", "https://...", "https://...", "https://..."]
    },
    "routes": [
      {
        "slug": "southern-sea-table",
        "title": "A Southern Sea Table",
        "culture": "Coastal",
        "duration": "1 day",
        "audience": "Coastal explorers",
        "summary": "A coastal route...",
        "image": "https://oss.lingtour.cn/..."
      }
    ],
    "nav": {
      "prev": { "slug": null, "name": null },
      "next": { "slug": null, "name": null }
    }
  }
}
```

### 2.3 管理后台 API

#### POST /api/v1/admin/cities

创建新城市。

```json
// Request
{
  "slug": "guangzhou",
  "name": "Guangzhou",
  "regionLabel": "Bay Area core",
  "heroImage": "https://oss.lingtour.cn/upload/xxx.jpg",
  "heroNarrative": "Guangzhou, the starting point of the Maritime Silk Road...",
  "tags": ["Guangfu", "Cantonese", "Lingnan"],
  "editorIntro": "## Guangzhou: A River City\n\nGuangzhou sits at the heart of the Pearl River Delta...",
  "galleryImages": ["url1", "url2", "url3"],
  "foodTitle": "Flavours of Guangzhou",
  "foodDescription": "Dim sum, roast goose, white-cut chicken...",
  "foodImages": ["url1", "url2", "url3", "url4"],
  "routeSlugs": ["pearl-river-walk", "shamian-heritage"],
  "sections": [
    {
      "title": "Lingnan architecture",
      "body": "The qilou arcades of Guangzhou...",
      "image": "https://oss.lingtour.cn/upload/yyy.jpg",
      "statLabel": "历史街区数量",
      "statValue": "26",
      "sortOrder": 0
    }
  ]
}

// Response: 201
{
  "data": {
    "id": "uuid-abc",
    "slug": "guangzhou",
    "published": false
  }
}
```

#### PUT /api/v1/admin/cities/:id

全量更新城市（非 PATCH）。请求体同 POST。

#### PATCH /api/v1/admin/cities/:id/publish

发布城市，使其在前台可见。

```json
// Response
{ "data": { "id": "uuid-abc", "published": true } }
```

#### POST /api/v1/admin/cities/:id/sections

追加一个文化章节。

```json
// Request
{
  "title": "Cantonese opera",
  "body": "## Origins\n\nCantonese opera traces...",
  "image": "https://oss.lingtour.cn/upload/zzz.jpg",
  "statLabel": "粤剧剧目",
  "statValue": "13,000+",
  "breathImage": null,
  "breathQuote": null,
  "sortOrder": 1
}
```

#### PATCH /api/v1/admin/cities/:id/sections/reorder

```json
// Request
{ "order": ["uuid-3", "uuid-1", "uuid-2"] }
```

#### POST /api/v1/admin/cities/:id/routes

```json
// Request
{ "routeSlugs": ["southern-sea-table", "volcano-geology"] }
```

#### DELETE /api/v1/admin/cities/:id/routes/:routeId

解绑关联路线。

#### POST /api/v1/admin/upload

```json
// Request: multipart/form-data
// Field: file (图片文件，最大 10MB，支持 jpg/png/webp)

// Response
{ "data": { "url": "https://oss.lingtour.cn/upload/2026/05/abc.jpg" } }
```

### 2.4 错误码

| 状态码 | 说明 |
|--------|------|
| 400 | 参数校验失败 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 城市/章节不存在 |
| 409 | slug 重复 |
| 413 | 图片过大 |
| 422 | 业务逻辑错误（如：发布缺少必填字段） |

---

## 3. 管理后台工作流

### 3.1 新增城市文化页

```
操作流程：

1. 点击「新增城市」进入创建页
2. Hero 区：
   a. 输入 slug（自动从 name 生成，可手动修改）
   b. 输入 name（如 "Guangzhou"）
   c. 输入 regionLabel（如 "Bay Area core"）
   d. 点击 heroImage 占位区 → 上传封面图
   e. 输入 heroNarrative（封面简介文字）
   f. 勾选 tags（或自定义标签）
3. 编辑导语区：
   a. Tiptap 富文本编辑器输入 editorIntro
   b. 支持标题（H2/H3）、段落、加粗、斜体、blockquote
   c. 图片上传不允许（图通过 galleryImages 占位区上传）
4. 画廊区：
   a. 点击 3 个图片占位区 → 分别上传
   b. 预览拼贴效果（右侧实时预览）
5. Sections（可变数组）：
   a. 点击「+ 添加章节」新增一个 section 块
   b. 每个 section 输入：
      - title（章节标题）
      - 图片占位区 → 上传插图
      - Tiptap 编辑器 → 输入 body (MD)
      - statLabel / statValue（数据卡片，可选）
      - breathImage / breathQuote（呼吸点，可选）
   c. 可拖拽排序（react-beautiful-dnd 或 dnd-kit）
   d. 可删除章节
6. 美食区：
   a. 输入 foodTitle
   b. Tiptap 编辑器输入 foodDescription
   c. 点击 4 个图片占位区 → 分别上传
7. 关联路线：
   a. 多选下拉 → 搜索已有路线
   b. 已选路线显示为 tag（可点击 ✕ 移除）
   c. 可拖拽排序
8. 右上角「保存草稿」→ 保存但不发布
   或「发布」→ 保存 + 发布
```

### 3.2 编辑已有城市

同新增流程，但表单预填已有数据。编辑后：
- 保存草稿：更新数据，不改变 published 状态
- 发布：published → true

### 3.3 Tiptap 编辑器配置

```typescript
// 管理后台前端配置
const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },        // 只允许 H2、H3
    blockquote: {},                       // 用于前端渲染「首句引语」
    bold: {},
    italic: {},
    bulletList: {},
    orderedList: {},
    // 不允许: image, codeBlock, horizontalRule
  }),
  Placeholder.configure({
    placeholder: '输入正文...',
  }),
];

// 前端渲染映射（Next.js 前台）：
// - H2 → 段落标题
// - H3 → 子标题
// - blockquote → 首句引语（serif 大字）
// - p → 普通段落
```

---

## 4. 前端数据联动

### 4.1 数据流动

```
[管理后台]
  admin.lingtour.cn
  Tiptap 编辑器 + 图片上传
         │
         ▼ REST API
  [PostgreSQL]
    cities / city_culture_sections / city_route_links / story_routes
         │
         ▼ 前台只读 API
  [Next.js 前台]
    lingtour.cn
    getStaticProps / fetch
         │
         ▼
  TypeScript 类型 → 组件渲染
```

### 4.2 前端类型映射

```typescript
// 后台 API 返回 → 前台 CityCulture 类型
interface CityCultureResponse {
  slug: string;
  name: string;
  regionLabel: string;        // → label
  heroImage: string;          // → image
  heroNarrative: string;      // → narrative
  tags: string[];
  editorIntro: string;        // → summary (MD → 渲染)
  galleryImages: string[];    // → gallery
  sections: SectionResponse[];
  food: FoodResponse;
  routes: RouteSummaryResponse[];
  nav: { prev: CityNav | null; next: CityNav | null };
}
```

### 4.3 现有前端代码适配

| 组件 | 数据来源（旧） | 数据来源（新） |
|------|-------------|-------------|
| `culture/[slug]/page.tsx` | `cityCultures` 静态数组 | API `GET /public/cities/:slug` |
| `culture/page.tsx` | `cityCultures` 静态数组 | API `GET /public/cities` |
| `routes/[slug]/page.tsx` | `storyRoutes` 静态数组 | API `GET /public/routes/:slug` |
| `routes/page.tsx` | `storyRoutes` 静态数组 | API `GET /public/routes` |
| `GuangdongMapSection.tsx` | `regionShowcase` | API `GET /public/cities` 中的 adcode/routeSlugs |
| `FeaturedRoutesCarousel.tsx` | `featuredRoutes` | API `GET /public/routes` 切片 |
| `CultureGallery.tsx` | `cultureHighlights` | API `GET /public/cities` 切片 |

---

## 5. 实现计划

### Phase 1: 数据库迁移

1. 扩写 `migrations/001_cities.sql`：
   - 加入 `region_label`, `hero_image`, `hero_narrative`, `editor_intro`, `gallery_images`, `food_title`, `food_description`, `food_images`, `entry_cta`
2. 升级 `city_culture_sections`：
   - 加入 `stat_label`, `stat_value`, `breath_image`, `breath_quote`
3. 创建 `city_route_links` 表

### Phase 2: NestJS API 模块

```
src/
├── cities/
│   ├── cities.module.ts
│   ├── cities.controller.ts        (public + admin)
│   ├── cities.service.ts
│   ├── dto/
│   │   ├── create-city.dto.ts
│   │   ├── update-city.dto.ts
│   │   └── create-section.dto.ts
│   └── entities/
│       ├── city.entity.ts
│       └── city-section.entity.ts
├── routes/
│   ├── routes.module.ts
│   ├── routes.controller.ts
│   └── ...
└── upload/
    ├── upload.module.ts
    └── upload.controller.ts
```

### Phase 3: 管理后台页面

```
admin/src/
├── pages/
│   ├── cities/
│   │   ├── index.tsx              (列表)
│   │   ├── create.tsx             (新增)
│   │   └── [id]/
│   │       └── edit.tsx           (编辑)
│   └── routes/
│       ├── index.tsx
│       └── [id]/edit.tsx
├── components/
│   ├── culture/
│   │   ├── CultureForm.tsx         (城市表单)
│   │   ├── SectionEditor.tsx       (章节编辑器)
│   │   ├── SectionList.tsx         (章节拖拽排序)
│   │   ├── RouteSelector.tsx       (路线多选组件)
│   │   └── ImageUploader.tsx       (图片上传组件)
│   └── editor/
│       └── TiptapEditor.tsx        (富文本编辑器)
```

### Phase 4: 前台数据接入

1. 替换 `data/culture.ts` 中的硬编码数据为 API 调用
2. 使用 Next.js ISR (`revalidate: 3600`) 实现内容缓存
3. 添加 loading.tsx / error.tsx 边界处理
4. 添加 Redis 缓存层（前台 API 读取缓存）

---

> **下一步**: 开始 Phase 1 数据库迁移脚本编写。
