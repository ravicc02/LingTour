# Culvoy 后端设计文档 (Unified v2.0)

> 版本: 2.0 | 日期: 2026-05-11 | 状态: 最终评审稿
> 变更说明: 整合了各子模块细化设计，修复了数据模型冲突，增加了 i18n、支付网关及游客结账逻辑。

---

## 1. 整体架构

### 1.1 系统边界
采用 **Headless CMS + 独立 API + 多端适配** 架构。

- **Admin (管理后台)**: `admin.lingtour.cn` (React 19 + AntD 5)
- **API (核心服务)**: `api.lingtour.cn` (NestJS 11 + TypeORM)
- **Site (前台网站)**: `lingtour.cn` (Next.js 15, SSR/ISR)
- **Storage**: 阿里云 OSS (静态资源) + PostgreSQL 16 (结构化数据) + Redis 7 (缓存/Session)

### 1.2 核心设计原则
1. **i18n 第一公民**: 所有面向用户的文本字段均支持中英双语 JSONB 存储。
2. **读写解耦**: 前台 API 严格只读（除订单/预约外），管理后台拥有完整权限。
3. **软删除保证**: 核心业务数据（商品、路线、城市）采用软删除，保护交易历史。

---

## 2. 数据库设计 (ER 对齐版)

### 2.1 核心实体表

#### 2.1.1 城市文化 (Cities)
```sql
CREATE TABLE cities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            VARCHAR(100) NOT NULL UNIQUE,
    name            JSONB NOT NULL,                 -- { "en": "Guangzhou", "zh": "广州" }
    region_label    JSONB NOT NULL,                 -- { "en": "Bay Area Core", "zh": "大湾区核心" }
    hero_image      VARCHAR(500) NOT NULL,
    hero_narrative  JSONB NOT NULL,                 -- 封面简介 (MD)
    tags            JSONB NOT NULL DEFAULT '[]',    -- [{ "en": "Coast", "zh": "滨海" }]
    editor_intro    JSONB NOT NULL,                 -- 编辑导语 (MD)
    gallery_images  JSONB NOT NULL DEFAULT '[]',    -- ["url1", "url2", "url3"]
    food_title      JSONB NOT NULL,
    food_description JSONB NOT NULL,
    food_images     JSONB NOT NULL DEFAULT '[]',    -- 4张拼贴图
    published       BOOLEAN NOT NULL DEFAULT false,
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 城市文化板块 (多图文段落)
CREATE TABLE city_culture_sections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id         UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    title           JSONB NOT NULL,
    body            JSONB NOT NULL,                 -- (MD)
    image           VARCHAR(500) NOT NULL,
    stat_label      JSONB,                          -- 数据卡片标签
    stat_value      JSONB,                          -- 数据卡片值
    breath_image    VARCHAR(500),                   -- 段间大图
    breath_quote    JSONB,                          -- 段间引语
    sort_order      INT NOT NULL DEFAULT 0
);
```

#### 2.1.2 故事路线 (Routes)
```sql
CREATE TABLE story_routes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            VARCHAR(100) NOT NULL UNIQUE,
    title           JSONB NOT NULL,
    culture_tag     VARCHAR(50) NOT NULL,           -- Coastal/Guangfu...
    city_name       JSONB NOT NULL,                 -- 展示用的主要城市名
    duration        JSONB NOT NULL,                 -- "1 day" / "2 days"
    audience        JSONB NOT NULL,                 -- "First-time" / "Family"
    summary         JSONB NOT NULL,                 -- 封面摘要 (MD)
    story           JSONB NOT NULL,                 -- 路线引言 (MD)
    cover_image     VARCHAR(500) NOT NULL,
    published       BOOLEAN NOT NULL DEFAULT false,
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 行程站点 (Stops)
CREATE TABLE route_stops (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id        UUID NOT NULL REFERENCES story_routes(id) ON DELETE CASCADE,
    sort_order      INT NOT NULL,
    time            VARCHAR(20) NOT NULL,
    stop_name       JSONB NOT NULL,
    story           JSONB NOT NULL,                 -- 短引语
    cultural_story  JSONB NOT NULL,                 -- 深度长文 (MD)
    details         JSONB NOT NULL DEFAULT '[]',    -- [ { "en": "...", "zh": "..." } ]
    image           VARCHAR(500) NOT NULL,
    meal            JSONB,
    hotel           JSONB,
    transit         JSONB,
    lat             DOUBLE PRECISION,
    lng             DOUBLE PRECISION
);

-- 城市-路线多对多关联
CREATE TABLE route_city_links (
    route_id    UUID REFERENCES story_routes(id) ON DELETE CASCADE,
    city_id     UUID REFERENCES cities(id) ON DELETE CASCADE,
    sort_order  INT DEFAULT 0,
    PRIMARY KEY (route_id, city_id)
);
```

#### 2.1.3 商城与精选 (Shop & Featured)
```sql
CREATE TABLE store_products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            VARCHAR(120) NOT NULL UNIQUE,
    name            JSONB NOT NULL,
    collection_id   UUID REFERENCES store_collections(id) ON DELETE SET NULL,
    price           NUMERIC(10, 2) NOT NULL,         -- 基础货币: SGD
    currency        VARCHAR(10) NOT NULL DEFAULT 'SGD',
    tag             JSONB NOT NULL,                 -- "Handcrafted"
    image           VARCHAR(500) NOT NULL,
    story           JSONB NOT NULL,                 -- (MD)
    material        JSONB,
    dimensions      JSONB,
    origin          JSONB,
    care            JSONB,
    gallery         JSONB NOT NULL DEFAULT '[]',
    stock           INT NOT NULL DEFAULT 0,
    published       BOOLEAN NOT NULL DEFAULT false,
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 精选管理 (首页/分类页动态精选)
CREATE TABLE frontend_featured (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section         VARCHAR(60) NOT NULL,           -- "shop" | "routes" | "home_hero"
    ref_type        VARCHAR(40) NOT NULL,           -- "product" | "route" | "city"
    ref_id          UUID NOT NULL,
    sort_order      INT NOT NULL DEFAULT 0,
    UNIQUE(section, ref_type, ref_id)
);
```

### 2.2 交易与互动表 (Transaction)

#### 2.2.1 订单与支付 (Orders & Payment)
```sql
CREATE TABLE orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_no        VARCHAR(32) NOT NULL UNIQUE,
    user_id         UUID REFERENCES users(id),       -- NULLABLE (支持游客结账)
    guest_email     VARCHAR(255),                    -- 游客结账必填
    status          VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending/paid/shipped/cancelled
    total_amount    NUMERIC(10,2) NOT NULL,
    payment_method  VARCHAR(20),                     -- stripe / wechat / alipay
    payment_id      VARCHAR(100),                    -- 外部交易 ID
    shipping_addr   JSONB NOT NULL,                  -- 详细地址快照
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE booking_submissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    contact         VARCHAR(300) NOT NULL,
    city            VARCHAR(200) NOT NULL,
    service_date    DATE NOT NULL,
    support_mode    VARCHAR(200) NOT NULL,
    route_need      TEXT,                            -- 需求说明 (MD)
    status          VARCHAR(20) DEFAULT 'new'        -- new/contacted/confirmed
);
```

---

## 3. API 与 国际化 (i18n) 策略

### 3.1 请求拦截与自动语言分发
- **请求头**: `Accept-Language: en` 或 `?lang=zh`
- **NestJS 实现**: 使用全局 `I18nInterceptor`。
  - **写入**: 当管理后台 POST 时，必须同时传 `en` 和 `zh` 字段。
  - **读取**: 当请求 `GET /public/routes/123` 时，拦截器检查语言偏好，将 JSONB 字段中的对应语言扁平化返回给前端。
  - **示例响应**: `{ "title": "A Southern Sea Table" }` (而非整个 JSON 对象)，减少前端负担。

---

## 4. 支付与电商流程

### 4.1 Stripe 支付闭环
1. 前端调用 `POST /v1/orders/checkout` -> 后端创建 `pending` 订单 -> 返回 `stripe_client_secret`。
2. 前端调起 Stripe Element 支付。
3. Stripe 支付成功 -> **Webhook** 通知后端。
4. 后端校验 Webhook 签名 -> 更新订单状态为 `paid` -> 扣减库存 -> 发送确认邮件。

---

## 5. 管理后台 CMS 功能
1. **TipTap 集成**: 所有 MD 字段均提供所见即所得编辑器。
2. **预览模式**: 提供“前台同步预览”组件，后台编辑时实时渲染前台视觉效果。
3. **文件管理**: 上传图片到 OSS，记录引用关系，避免资源冗余。

---

## 6. 开发优先级 (Phase 2.0)
1. **P0 (Infrastructure)**: PostgreSQL 建表、NestJS 项目脚手架、OSS/Redis 集成、i18n 拦截器。
2. **P1 (CMS Core)**: 城市、路线、商品的全量 CRUD，含拖拽排序。
3. **P2 (Business)**: Stripe 支付集成、游客结账逻辑、Booking 提交系统。
4. **P3 (Dashboard)**: 数据概览看板、订单处理系统。
