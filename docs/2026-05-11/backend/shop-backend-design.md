# Shop 模块后端设计文档

> 版本: 1.0 | 日期: 2026-05-11 | 关联: Culvoy 整体后端设计 v1.0

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
store_collections (合集表)
      │
      │ 1:N
      ▼
store_products (商品表)
      │
      │ 引用（软关联，非外键）
      ▼
frontend_featured (精选管理表 — 统一管理首页精选内容)
```

### 1.2 store_products 表

```sql
CREATE TABLE store_products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            VARCHAR(120) NOT NULL UNIQUE,       -- URL 标识，如 "volcanic-soil-bowl"
    name            VARCHAR(200) NOT NULL,               -- 商品名称
    collection_id   UUID REFERENCES store_collections(id) ON DELETE SET NULL,
    price           NUMERIC(10, 2) NOT NULL,             -- 价格（SGD）
    currency        VARCHAR(3) NOT NULL DEFAULT 'SGD',   -- 币种
    tag             VARCHAR(60) NOT NULL,                -- 标签，如 "Handcrafted"
    image           VARCHAR(500) NOT NULL,               -- 主图 OSS URL
    story           TEXT NOT NULL,                       -- 商品描述（MD）
    material        VARCHAR(200) DEFAULT '',             -- 材质
    dimensions      VARCHAR(200) DEFAULT '',             -- 尺寸
    origin          VARCHAR(200) DEFAULT '',             -- 产地
    care            VARCHAR(200) DEFAULT '',             -- 保养说明
    gallery         JSONB DEFAULT '[]',                  -- 附加图片数组 ["url1","url2","url3"]
    published       BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_store_products_slug ON store_products(slug);
CREATE INDEX idx_store_products_collection ON store_products(collection_id);
CREATE INDEX idx_store_products_published ON store_products(published);
```

**字段 → 前端对照**：

| 字段 | 前端组件 | 渲染位置 |
|------|---------|---------|
| `image` + `gallery[]` | `ProductDetailHero` 左侧画廊 | 主图 4:5 + 缩略图切换 |
| `name` | `ProductDetailHero` 右侧标题 | serif 大字号 |
| `price` + `currency` | `ProductDetailHero` 右侧价格 | `formatStorePrice()` |
| `tag` | `StoreProductCard` 标签 | 卡片左上角 mono 标签 |
| `story` | `ProductDetailHero` 右侧 "The Story" | 正文段落 |
| `material` / `dimensions` / `origin` / `care` | `ProductDetailHero` 右侧 4 宫格 | `grid-cols-2` 标签-值对 |
| `collection_id` | `ProductDetailHero` 底部合集引用 | "Part of the X collection" |
| `slug` | 路由 | `/shop/products/:slug` |

### 1.3 store_collections 表

```sql
CREATE TABLE store_collections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            VARCHAR(100) NOT NULL UNIQUE,       -- "coastal-life-kit"
    title           VARCHAR(200) NOT NULL,               -- "Coastal Life Kit"
    route_name      VARCHAR(200) NOT NULL,               -- 关联路线名 "A Southern Sea Table"
    route_slug      VARCHAR(100) DEFAULT '',             -- 关联路线 slug（用于链接）
    image           VARCHAR(500) NOT NULL,               -- 合集封面图 OSS URL
    body            TEXT NOT NULL,                       -- 合集描述（MD）
    sort_order      INT NOT NULL DEFAULT 0,
    published       BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_store_collections_slug ON store_collections(slug);
```

**字段 → 前端对照**：

| 字段 | 前端组件 | 渲染 |
|------|---------|------|
| `image` | 合集卡片背景图 | 3:4 aspect，hover scale-110 |
| `title` | 合集卡片标题 | serif 大字号 |
| `route_name` | 合集卡片顶部标签 | mono 小标签 |
| `body` | 合集卡片 hover 描述 | opacity 0→100 过渡 |
| `route_slug` | 合集卡片 Link href | 指向 `/routes/:slug` |
| `slug` | Shop 页筛选 | 前端按合集 slug 过滤商品 |

### 1.4 frontend_featured 表（精选管理 — 统一表）

> 此表统一管理首页「精选路线」「精选文创」等可切换的精选内容，避免为每个模块建一张独立表。

```sql
CREATE TABLE frontend_featured (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section         VARCHAR(60) NOT NULL,                -- 区域标识: "routes" | "shop"
    ref_type        VARCHAR(40) NOT NULL,                -- 引用类型: "route" | "product" | "collection"
    ref_id          UUID NOT NULL,                       -- 引用的实体 ID
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_featured_uniq ON frontend_featured(section, ref_type, ref_id);
CREATE INDEX idx_featured_section ON frontend_featured(section);
```

**说明**：
- `section = "shop"` + `ref_type = "product"` → 首页 "Featured Starter Objects" 区展示的商品
- `section = "routes"` + `ref_type = "route"` → 首页 "Featured Routes" 区展示的路线
- 运营人员可在后台切换精选内容，保存后刷新首页

### 1.5 TypeScript 类型定义

```typescript
// ── 商品 ──
interface StoreProduct {
  id: string;
  slug: string;
  name: string;
  collection: {
    id: string;
    title: string;
    routeSlug: string;
  } | null;
  price: number;
  currency: "SGD";
  tag: string;
  image: string;
  story: string;          // MD
  details: {
    material: string;
    dimensions: string;
    origin: string;
    care: string;
  } | null;
  gallery: string[];
  published: boolean;
}

// ── 合集 ──
interface StoreCollection {
  id: string;
  slug: string;
  title: string;
  routeName: string;
  routeSlug: string;
  image: string;
  body: string;           // MD
  sortOrder: number;
}

// ── 前台 API 响应 ──
interface ShopPageData {
  collections: StoreCollection[];
  featuredProducts: StoreProduct[];
}

interface ProductDetailData {
  product: StoreProduct;
  relatedProducts: StoreProduct[];
  collection: StoreCollection | null;
}
```

---

## 2. 前端页面结构 & 数据字段对照

### 2.1 Shop 首页（/shop）

```
┌──────────────────────────────────────────────────┐
│ ① ShopHero                                       │
│    背景大图 + 标题 "The Lingnan Shelf"            │
│    静态文案（保留前端）                             │
├──────────────────────────────────────────────────┤
│ ② Collections                                    │
│                                                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│  │ 合集卡片 │ │ 合集卡片 │ │ 合集卡片 │            │
│  │ image   │ │ image   │ │ image   │            │
│  │ title   │ │ title   │ │ title   │            │
│  │ route   │ │ route   │ │ route   │            │
│  │ body    │ │ body    │ │ body    │            │
│  └─────────┘ └─────────┘ └─────────┘            │
│                                                  │
│  数据源: store_collections 表                     │
├──────────────────────────────────────────────────┤
│ ③ Featured Starter Objects                       │
│                                                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│  │ 商品卡片 │ │ 商品卡片 │ │ 商品卡片 │            │
│  │ image   │ │ image   │ │ image   │            │
│  │ name    │ │ name    │ │ name    │            │
│  │ tag     │ │ tag     │ │ tag     │            │
│  │ price   │ │ price   │ │ price   │            │
│  └─────────┘ └─────────┘ └─────────┘            │
│                                                  │
│  数据源: frontend_featured (section="shop")       │
│  → 如果没有精选数据，回退到 store_products LIMIT 3 │
├──────────────────────────────────────────────────┤
│ ④ Philosophy（静态保留前端）                       │
└──────────────────────────────────────────────────┘
```

### 2.2 全部商品页（/shop/products）

```
┌──────────────────────────────────────────────────┐
│ ① EditorialIntro（保留前端）                       │
│    标题 "Search the full Lingnan store shelf."    │
├──────────────────────────────────────────────────┤
│ ② AllProductsClient                              │
│    └─ 筛选栏: 按合集 + 按标签                       │
│    └─ 商品卡片网格                                 │
│    数据源: store_products (published=true)         │
└──────────────────────────────────────────────────┘
```

### 2.3 商品详情页（/shop/products/[slug]）

```
┌──────────────────────────────────────────────────┐
│ ① ProductDetailHero                               │
│                                                  │
│  ┌────────────────────┬──────────────────────┐   │
│  │  左侧: 图片画廊      │  右侧: 信息面板       │   │
│  │                    │                      │   │
│  │  ┌──────────────┐  │  collection (标签)   │   │
│  │  │              │  │  name (大标题)        │   │
│  │  │   主图 4:5   │  │  price               │   │
│  │  │              │  │  ─ 分隔线 ─           │   │
│  │  └──────────────┘  │  "The Story" 标签     │   │
│  │  ┌──┬──┬──┬──┐   │  story (MD 渲染)      │   │
│  │  │1 │2 │3 │4 │   │  ─ 分隔线 ─           │   │
│  │  └──┴──┴──┴──┘   │  material (材质)      │   │
│  │  缩略图切换        │  dimensions (尺寸)     │   │
│  │                    │  origin (产地)        │   │
│  │                    │  care (保养)          │   │
│  │                    │  ─ 分隔线 ─           │   │
│  │                    │  [Add to bag][Buy now]│   │
│  │                    │  "Part of X collection"│  │
│  └────────────────────┴──────────────────────┘   │
│                                                  │
│  数据源: store_products 单条 + gallery[]+details  │
├──────────────────────────────────────────────────┤
│ ② ProductNarrative（静态保留前端）                 │
│    模板文案（含 product.name / collection 替换）   │
├──────────────────────────────────────────────────┤
│ ③ Related items                                  │
│    同合集的其他商品（最多 3 个）                     │
│    数据源: store_products (collection_id 相同)     │
└──────────────────────────────────────────────────┘
```

### 2.4 组件 → 字段映射速查表

| 组件 | 数据字段 |
|------|---------|
| `ShopHero` | 静态文案（保留前端） |
| Collection Card | `store_collections.image, .title, .routeName, .body, .routeSlug` |
| `StoreProductCard` | `store_products.image, .name, .tag, .price, .currency, .slug` |
| `AllProductsClient` | `store_products` 全列表 + `collections` + `tags` 可筛选 |
| `ProductDetailHero` | `store_products.*` — image, gallery, name, price, tag, story, details, collection |
| `ProductNarrative` | 模板文案 + `product.name` + `product.collection` 变量替换 |
| `ProductActions` | `store_products.slug, .name, .price, .currency, .image` — cart 操作 |

---

## 3. API 接口设计

### 3.1 接口分层

```
前台 Public（只读，不鉴权）
  GET  /public/shop/collections      合集列表
  GET  /public/shop/products         商品列表（支持筛选/分页）
  GET  /public/shop/products/:slug   商品详情（含同合集推荐）
  GET  /public/shop/featured         首页精选商品

管理 Admin（JWT 鉴权）
  GET    /admin/shop/products        商品管理列表
  POST   /admin/shop/products        创建商品
  GET    /admin/shop/products/:id    获取商品编辑数据
  PUT    /admin/shop/products/:id    更新商品
  DELETE /admin/shop/products/:id    删除商品
  POST   /admin/shop/collections     创建合集
  PUT    /admin/shop/collections/:id 更新合集
  DELETE /admin/shop/collections/:id 删除合集
  PUT    /admin/shop/featured        设置精选商品
  POST   /admin/upload               图片上传 → 返回 OSS URL
```

### 3.2 前台公共接口

#### `GET /public/shop/collections`

**响应**：
```json
{
  "collections": [
    {
      "id": "uuid",
      "slug": "coastal-life-kit",
      "title": "Coastal Life Kit",
      "routeName": "A Southern Sea Table",
      "routeSlug": "southern-sea-table",
      "image": "https://oss.lingtour.com/shop/coastal-cover.jpg",
      "body": "Curated objects from the Zhanjiang coast...",
      "productCount": 5
    }
  ]
}
```

#### `GET /public/shop/products`

**查询参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `collection` | string | 按合集 slug 筛选 |
| `tag` | string | 按标签筛选 |
| `page` | number | 页码（默认 1） |
| `limit` | number | 每页数量（默认 12） |

**响应**：
```json
{
  "products": [
    {
      "id": "uuid",
      "slug": "volcanic-soil-bowl",
      "name": "Volcanic Soil Tea Bowl",
      "collection": {
        "id": "uuid",
        "title": "Coastal Life Kit",
        "slug": "coastal-life-kit",
        "routeSlug": "southern-sea-table"
      },
      "price": 32.00,
      "currency": "SGD",
      "tag": "Handcrafted",
      "image": "https://oss.lingtour.com/shop/volcanic-bowl.jpg",
      "story": "A bowl fired using clay from the Leizhou Peninsula...",
      "details": {
        "material": "Natural volcanic clay, lead-free matte glaze",
        "dimensions": "9cm diameter, 5cm height",
        "origin": "Leizhou Peninsula, Zhanjiang",
        "care": "Hand wash only."
      },
      "gallery": [
        "https://oss.lingtour.com/shop/volcanic-bowl-2.jpg",
        "https://oss.lingtour.com/shop/volcanic-bowl-3.jpg",
        "https://oss.lingtour.com/shop/volcanic-bowl-4.jpg"
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 12,
    "total": 1
  },
  "filters": {
    "collections": ["coastal-life-kit"],
    "tags": ["Handcrafted"]
  }
}
```

#### `GET /public/shop/products/:slug`

**响应**（结构同上 `products[0]`），额外附加：

```json
{
  "product": { /* ...同上... */ },
  "relatedProducts": [ /* 同合集其他商品，最多 3 个 */ ],
  "collection": { /* 合集详情 */ }
}
```

#### `GET /public/shop/featured`

**响应**：
```json
{
  "section": "shop",
  "products": [
    { /* StoreProduct 对象 */ }
  ]
}
```

> 从 `frontend_featured` 表查 `section="shop"` + `ref_type="product"`，按 `sort_order` 排序，JOIN `store_products` 取完整数据。

### 3.3 管理后台接口

#### `POST /admin/shop/products`

**请求体**（创建商品 — 一次提交全部字段）：

```json
{
  "slug": "volcanic-soil-bowl",
  "name": "Volcanic Soil Tea Bowl",
  "collectionId": "uuid-of-coastal-life-kit",
  "price": 32.00,
  "currency": "SGD",
  "tag": "Handcrafted",
  "image": "https://oss.lingtour.com/shop/volcanic-bowl.jpg",
  "story": "A bowl fired using clay from the Leizhou Peninsula volcanic fields, carrying the dark, rich texture of the southern coast.",
  "material": "Natural volcanic clay, lead-free matte glaze",
  "dimensions": "9cm diameter, 5cm height",
  "origin": "Leizhou Peninsula, Zhanjiang",
  "care": "Hand wash only. Not recommended for microwave use.",
  "gallery": [
    "https://oss.lingtour.com/shop/volcanic-bowl-2.jpg",
    "https://oss.lingtour.com/shop/volcanic-bowl-3.jpg",
    "https://oss.lingtour.com/shop/volcanic-bowl-4.jpg"
  ],
  "published": true
}
```

**校验规则**：

| 字段 | 规则 |
|------|------|
| `slug` | 必填，唯一，仅小写字母/数字/连字符，3-120 字符 |
| `name` | 必填，1-200 字符 |
| `price` | 必填，正数 |
| `image` | 必填，有效 URL |
| `story` | 必填 |
| `tag` | 必填 |
| `collectionId` | 可选（无合集时 null） |
| `gallery` | 数组，0-6 张 |

**Service 层伪代码**：

```typescript
async createProduct(dto: CreateProductDto) {
  // 校验 slug 唯一
  const existing = await this.productRepo.findOne({ where: { slug: dto.slug } });
  if (existing) throw new ConflictException(`Product slug "${dto.slug}" already exists`);

  return this.productRepo.save({
    ...dto,
    gallery: dto.gallery || [],
  });
}
```

#### `PUT /admin/shop/products/:id`

**请求体**：同 `POST`，全部字段可更新。

```typescript
async updateProduct(id: string, dto: UpdateProductDto) {
  const product = await this.productRepo.findOne({ where: { id } });
  if (!product) throw new NotFoundException();

  // 校验 slug 唯一（排除自身）
  if (dto.slug && dto.slug !== product.slug) {
    const dup = await this.productRepo.findOne({ where: { slug: dto.slug } });
    if (dup) throw new ConflictException(`Product slug "${dto.slug}" already exists`);
  }

  Object.assign(product, dto);
  return this.productRepo.save(product);
}
```

#### `DELETE /admin/shop/products/:id`

**响应**：
```json
{ "deleted": true }
```

> 数据库建议**软删除**：加 `deleted_at` 字段，DELETE 请求只设 `deleted_at = now()`，不回真正删除。这样已有的订单/收藏记录不会断裂。

#### `PUT /admin/shop/featured`

**请求体**：
```json
{
  "productIds": ["uuid-1", "uuid-2", "uuid-3"]
}
```

**后端处理**：事务中 DELETE 旧的 `section="shop"` 记录 → INSERT 新记录。

#### 图片上传

```
POST /admin/upload
Content-Type: multipart/form-data

参数:
  file: 图片文件
  module: "shop"（固定值）

响应:
{
  "url": "https://oss.lingtour.com/shop/volcanic-bowl-20260511.jpg",
  "filename": "volcanic-bowl-20260511.jpg"
}
```

---

## 4. 管理后台设计

### 4.1 整体布局

```
┌──────────────────────────────────────────────────┐
│  Store 管理                                       │
├──────────────────┬───────────────────────────────┤
│ 左侧菜单          │                               │
│                  │  [合集管理] [商品列表] [+新增]   │
│  ├─ Routes       │                               │
│  ├─ Culture      │  ┌─────────────────────────┐  │
│  ├─ Store  ◀     │  │                         │  │
│  ├─ Interpreting │  │   商品列表 / 编辑面板     │  │
│  └─ Featured     │  │                         │  │
│                  │  └─────────────────────────┘  │
│                  │                               │
└──────────────────┴───────────────────────────────┘
```

### 4.2 Tab 1: 合集管理

```
┌──────────────────────────────────────────────────┐
│  Collections                        [+ New Collection]
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌── Coastal Life Kit ──────────────────────┐   │
│  │  路线: A Southern Sea Table               │   │
│  │  封面: [缩略图]                           │   │
│  │  商品数: 5                                │   │
│  │  [编辑] [删除]                            │   │
│  └───────────────────────────────────────────┘   │
│                                                  │
│  ┌── Chaoshan Tea Table ────────────────────┐   │
│  │  ...                                      │   │
│  └───────────────────────────────────────────┘   │
│                                                  │
└──────────────────────────────────────────────────┘
```

#### 新建 / 编辑合集弹窗

```
┌──────────────────────────────────────┐
│  New Collection                 [×]  │
│                                      │
│  Title        [_______________]      │
│  Route Name   [_______________]      │
│  Route Slug   [_______________]      │
│  封面图       [点击上传] [缩略图]     │
│  Description  [MD 输入框]           │
│              [_______________]      │
│              [_______________]      │
│                                      │
│  Sort Order   [___]                  │
│                                      │
│  [Cancel]  [Save]                    │
└──────────────────────────────────────┘
```

### 4.3 Tab 2: 商品管理（核心）

#### 商品列表视图

```
┌──────────────────────────────────────────────────┐
│  Products                          [+ New Product]
│  Filter: [All Collections ▼] [All Tags ▼] [Search]
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌── Volcanic Soil Tea Bowl ─────────────────┐  │
│  │  [缩略图]  Coastal Life Kit · SGD $32.00  │  │
│  │  Tag: Handcrafted  Status: ✓ Published    │  │
│  │  [编辑] [删除] [切换发布状态]               │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌── Gongfu Tea Starter Cloth ───────────────┐  │
│  │  [缩略图]  Chaoshan Tea Table · SGD $28.00│  │
│  │  Tag: Tea Culture  Status: ✓ Published    │  │
│  │  [编辑] [删除] [切换发布状态]               │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  Showing 1-2 of 2 items                         │
└──────────────────────────────────────────────────┘
```

#### 新建 / 编辑商品面板

> 同一个表单，创建时空白，编辑时回填数据。

```
┌──────────────────────────────────────────────────┐
│  Edit Product: Volcanic Soil Tea Bowl       [×]  │
├────────────────────┬─────────────────────────────┤
│ 左侧: 实时预览      │ 右侧: 表单编辑               │
│                    │                             │
│ ┌────────────────┐ │ Slug       [volcanic-soil..]│
│ │                │ │ Name       [Volcanic Soil..]│
│ │   商品主图预览  │ │ Collection [Coastal Life ▼] │
│ │   (4:5)        │ │ Price      [32.00]          │
│ │                │ │ Currency   [SGD ▼]          │
│ │                │ │ Tag        [Handcrafted]     │
│ └────────────────┘ │                             │
│ ┌──┬──┬──┬──┐    │ ──────────────────────       │
│ │1 │2 │3 │4 │    │ **Story (MD)**                │
│ └──┴──┴──┴──┘    │ ┌─────────────────────────┐  │
│  缩略图预览       │ │ A bowl fired using clay  │  │
│                    │ │ from the Leizhou...     │  │
│ 右侧信息面板预览:   │ │                         │  │
│  > Volcanic Soil.. │ └─────────────────────────┘  │
│  > $32.00          │                             │
│  > 材质/尺寸/产地   │ **现货**                     │
│                    │ Material   [Natural volc..]  │
│                    │ Dimensions [9cm diameter..]  │
│                    │ Origin     [Leizhou Penin..] │
│                    │ Care       [Hand wash only]  │
│                    │                             │
│                    │ **商品图库**                  │
│                    │ 主图 [点击上传]               │
│                    │ 图1 [点击上传]  [×]           │
│                    │ 图2 [点击上传]  [×]           │
│                    │ 图3 [点击上传]  [×]           │
│                    │ [+ 添加图片]                  │
│                    │                             │
│                    │  Published  [✓]               │
│                    │                             │
│                    │  [Cancel]  [Save Draft] [Publish]│
└────────────────────┴─────────────────────────────┘
```

**关键设计决策**：

| 项目 | 决策 | 原因 |
|------|------|------|
| 排版 | **只做图文替换，不动排版** | 商品详情页布局固定（4:5 主图 + 右侧信息面板），后台只需换图/换文字 |
| 编辑器 | description(=`story`) 用 **简易 Markdown 输入框** | 不是长文，不需要 Tiptap 全功能编辑器，一个 textarea + 预览 Toggle 足够 |
| 预览 | **左预览右表单** | 对齐 Routes/Culture 管理后台风格 |
| 图片 | gallery 最多 6 张 | 前端缩略图网格是 4 列，6 张够用 |

### 4.4 Tab 3: 精选切换（左侧菜单独立入口 "Featured"）

```
┌──────────────────────────────────────────────────┐
│  Featured Content Management                      │
├──────────────────────────────────────────────────┤
│                                                  │
│  [精选路线]  Tab          [精选文创]  Tab          │
│                                                  │
│  ────────────── 精选文创 ──────────────           │
│                                                  │
│  当前精选（首页 "Featured Starter Objects" 区）    │
│                                                  │
│  拖拽排序:                                        │
│  ┌── 1 ──────────────────────────────────┐      │
│  │  [≡]  Volcanic Soil Tea Bowl  SGD $32 │      │
│  │       Coastal Life Kit                │      │
│  └────────────────────────────────────────┘      │
│  ┌── 2 ──────────────────────────────────┐      │
│  │  [≡]  Gongfu Tea Starter Cloth SGD $28│      │
│  │       Chaoshan Tea Table              │      │
│  └────────────────────────────────────────┘      │
│                                                  │
│  ─────────────────────────────────────           │
│  [搜索并添加商品...]  ← 下拉搜索框               │
│                                                  │
│  [Save Featured Order]                           │
└──────────────────────────────────────────────────┘
```

**操作流**：
1. 下拉搜索已有商品 → 点击添加到精选
2. 拖拽调整顺序
3. 点击「Save Featured Order」→ `PUT /admin/shop/featured` → 刷新首页

---

## 5. 前端数据联动

### 5.1 当前数据流 vs 后端对接后

```
当前（纯前端）                           后端对接后
─────────────                          ──────────
data/store.ts                           GET /public/shop/collections
  storeCollections[]  ──硬编码──       → store_collections 表
  storeProducts[]     ──硬编码──       → store_products 表

home.ts                                 GET /public/shop/featured
  storeHighlights[]   ──硬编码──       → frontend_featured 表
```

### 5.2 保留在前端的（不用后端管理）

| # | 位置 | 内容 | 原因 |
|---|------|------|------|
| 1 | `ShopHero` | 标题 + 副标题文案 | 品牌定位语，不常改 |
| 2 | `shop/page.tsx` | `bundlePhilosophy[]` | 营销文案，代码层面配置 |
| 3 | `ProductNarrative` | 模板文案 | 产品哲学表达，和具体商品解耦 |
| 4 | `shop/products/page.tsx` | `EditorialIntro` 文案 | 页面结构说明文案 |
| 5 | `StoreProductCard` | 卡片样式 / hover 效果 | 样式代码 |
| 6 | `ProductDetailHero` | 左右分栏布局 | 固定排版 |
| 7 | `ProductActions` | 购物车 localStorage 逻辑 | 前端交互逻辑 |

### 5.3 分步迁移路径（Phase 4）

```
Step 1: 在 data/store.ts 中新建一个异步加载函数
  export async function fetchStoreProducts(): Promise<StoreProduct[]> {
    // 开发环境: 从硬编码返回
    // 生产环境: fetch('/public/shop/products')
  }

Step 2: 把 page.tsx 中的 `import { storeProducts } from "@/data/store"`
  改为 `import { fetchStoreProducts } from "@/data/store"`

Step 3: 完成后端 API → 改 fetchStoreProducts 实现为真实 API 调用

Step 4: 同样处理 storeCollections → fetchStoreCollections()
```

### 5.4 首页联动

```
首页 "Featured Starter Objects" 区
  当前: storeProducts.slice(0, 3)
  改后: GET /public/shop/featured → 返回精选商品列表
  如未设置精选: GET /public/shop/products?limit=3 作为回退
```

---

## 6. 实现计划

### Phase 1: 数据库

- [ ] 创建 `store_products` 表 Migration
- [ ] 创建 `store_collections` 表 Migration
- [ ] 创建 `frontend_featured` 表 Migration
- [ ] 编写 Seed: 插入示例商品和合集数据

### Phase 2: API（NestJS shop module）

- [ ] 创建 `shop.module.ts` + `shop.controller.ts` + `shop.service.ts`
- [ ] 实现前台 4 个 GET 接口
- [ ] 实现管理 7 个 CRUD 接口 + 1 个精选设置接口
- [ ] 实现图片上传接口（复用 Shared module 的 OSS uploader）
- [ ] 完成 Swagger 文档

### Phase 3: 管理后台（React admin panel）

- [ ] 合集管理页（CRUD 弹窗）
- [ ] 商品列表页（分页 + 筛选 + 搜索）
- [ ] 商品新建/编辑面板（左预览 + 右表单）
- [ ] 精选管理页（拖拽排序 + 保存）
- [ ] 图片上传组件（复用 Shared upload component）

### Phase 4: 前端对接

- [ ] 将 `data/store.ts` 从硬编码改为 fetch 调用
- [ ] 首页精选商品从 `frontend_featured` 拉取
- [ ] ISR revalidate 配置（商品页按需增量重建）

---

## 附录 A: 与 Routes/Culture 模块的对比

| 维度 | Culture | Routes | Shop |
|------|---------|--------|------|
| 主表 | cities + city_sections | story_routes + route_stops | store_products + store_collections |
| 变数组 | city_sections (可变) | route_stops (可变) | gallery[] (JSONB) |
| 文本存储 | TEXT (MD) | TEXT (MD) | TEXT (MD) |
| 图片 | 独立上传区 | 独立上传区 | 独立上传区 |
| 管理后台 | 左预览右编辑器 | 3 模块 Tab | 合集 + 商品 + 精选 3 区 |
| 跨模块引用 | 关联 route_city_links | 关联 cities 表 | 关联 routes 表（合集卡片链接） |
| 精选管理 | 无 | 无 | frontend_featured 统一表 |

## 附录 B: 错误码

| 错误码 | HTTP | 说明 |
|--------|------|------|
| `PRODUCT_SLUG_DUPLICATE` | 409 | 商品 slug 已存在 |
| `PRODUCT_NOT_FOUND` | 404 | 商品不存在 |
| `COLLECTION_NOT_FOUND` | 404 | 合集不存在 |
| `COLLECTION_HAS_PRODUCTS` | 409 | 合集下有商品时不可删除（需先移走商品） |
| `FEATURED_MAX_EXCEEDED` | 400 | 精选商品超过上限（建议 12 个） |
