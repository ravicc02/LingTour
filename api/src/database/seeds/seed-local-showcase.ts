/**
 * Local-only demo seed.
 *
 * Goal: make every public content area render a full, client-ready set —
 * culture/cities, routes, interpreting and shop — without touching production.
 *
 * It reuses the canonical production copy from `showcase-content.ts` (already
 * English-only) and swaps the Wikimedia image URLs for local /uploads and
 * /editorial assets, so the demo never depends on the public internet.
 *
 * Safety: refuses to run against anything but a localhost database, and every
 * write is an idempotent upsert. Run `npx ts-node src/database/seeds/seed-local-showcase.ts`
 * for a dry run, then add `--apply`.
 */
import { AppDataSource } from '../data-source';
import regionsJson from '../../common/constants/route-regions.json';
import {
  SHOWCASE_CITIES,
  SHOWCASE_HOME_HIGHLIGHTS,
  SHOWCASE_ROUTES,
  type ShowcaseCity,
  type ShowcaseRoute,
} from './showcase-content';

const APPLY = process.argv.includes('--apply');
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const asJson = (value: unknown) => JSON.stringify(value);

// The TS re-export resolves to `undefined` under ts-node's CJS interop, so read
// the JSON module itself and unwrap a possible `default` namespace.
const ROUTE_REGIONS = ((regionsJson as unknown as { default?: unknown }).default ??
  regionsJson) as Array<{ key: string; title: string; note: string; adcodes: number[] }>;

type Query = (sql: string, params?: unknown[]) => Promise<Array<Record<string, unknown>>>;

/** Three of each, so every index page shows a populated grid. */
const CITY_SLUGS = ['guangzhou', 'chaozhou', 'zhanjiang'];
const ROUTE_SLUGS = [
  'guangzhou-river-arcade',
  'chaoshan-tea-culture',
  'southern-sea-table',
];

/**
 * Production copy references Wikimedia URLs. Map each one to a local asset so
 * the demo renders offline; unmatched remote URLs fall back to a coast photo.
 */
const LOCAL_IMAGE_RULES: Array<[string, string]> = [
  ['ShamianIsland', '/uploads/seed/guangzhou-qilou-1200.jpg'],
  ['Chen_Clan', '/uploads/seed/guangzhou-hero-1200.jpg'],
  ['Canton_Tower', '/uploads/seed/guangzhou-market-800.jpg'],
  ['Foshan_Ancestral', '/editorial/pottery-workshop.jpg'],
  ['nanfeng-kiln', '/editorial/pottery-painting.jpg'],
  ['Tongji', '/editorial/pottery-workshop.jpg'],
  ['Paifangjie', '/uploads/seed/chaozhou-hero-1200.jpg'],
  ['Guangji_Bridge', '/uploads/seed/chaozhou-tea-1200.jpg'],
  ['Gong_fu_cha', '/uploads/seed/chaozhou-tea-800.jpg'],
  ['Zhanjiang_Bay_Bridge', '/uploads/seed/zhanjiang-hero-1200.jpg'],
  ['HuGuangYan', '/uploads/preview/zhanjiang-huguangyan-lake.jpg'],
  ['Shaoguan', '/uploads/seed/volcanic-landscape-1200.jpg'],
  ['Danxiashan', '/uploads/seed/volcanic-landscape-1200.jpg'],
  ['Nanhua_Temple', '/uploads/seed/volcanic-landscape-1200.jpg'],
];

function localize(url: string | undefined | null): string {
  const value = (url ?? '').trim();
  if (!value) return '';
  if (!/^https?:/i.test(value)) return value;
  for (const [needle, replacement] of LOCAL_IMAGE_RULES) {
    if (value.includes(needle)) return replacement;
  }
  return '/editorial/guangdong-coast-rocky.jpg';
}

/** Compose the long-form article the city detail page renders. */
function cityMarkdown(city: ShowcaseCity): string {
  const blocks: string[] = [city.heroNarrative];
  for (const section of city.sections) {
    const image = localize(section.image);
    blocks.push(`## ${section.title}\n\n${section.body}`);
    if (image) blocks.push(`![${section.title}](${image})`);
    if (section.breathQuote) blocks.push(`> ${section.breathQuote}`);
    if (section.statLabel && section.statValue) {
      blocks.push(`**${section.statLabel}** — ${section.statValue}`);
    }
  }
  const foodImage = localize(city.foodImages[0]);
  if (city.foodTitle) {
    blocks.push(
      `## ${city.foodTitle}\n\n${city.foodDescription}` +
        (foodImage ? `\n\n![${city.foodTitle}](${foodImage})` : ''),
    );
  }
  return blocks.join('\n\n');
}

async function upsertCity(q: Query, city: ShowcaseCity): Promise<string | null> {
  if (!APPLY) {
    const existing = await q(
      `SELECT id FROM cities WHERE slug = $1 LIMIT 1`,
      [city.slug],
    );
    return (existing[0]?.id as string | undefined) ?? null;
  }
  const rows = await q(
    `INSERT INTO cities (slug, name, region_label, hero_image, hero_narrative, tags,
        editor_intro, content_markdown, gallery_images, food_title, food_description,
        food_images, related_city_slugs, adcode, published, published_at, deleted_at)
     VALUES ($1, $2::jsonb, $3::jsonb, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9::jsonb,
        $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14, true, now(), NULL)
     ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name, region_label = EXCLUDED.region_label,
        hero_image = EXCLUDED.hero_image, hero_narrative = EXCLUDED.hero_narrative,
        tags = EXCLUDED.tags, editor_intro = EXCLUDED.editor_intro,
        content_markdown = EXCLUDED.content_markdown, gallery_images = EXCLUDED.gallery_images,
        food_title = EXCLUDED.food_title, food_description = EXCLUDED.food_description,
        food_images = EXCLUDED.food_images, related_city_slugs = EXCLUDED.related_city_slugs,
        adcode = EXCLUDED.adcode, published = true, published_at = now(),
        deleted_at = NULL, updated_at = now()
     RETURNING id`,
    [
      city.slug,
      asJson(city.name),
      asJson(city.regionLabel),
      localize(city.heroImage),
      asJson(city.heroNarrative),
      asJson(city.tags),
      asJson(city.editorIntro),
      cityMarkdown(city),
      asJson(city.galleryImages.map(localize)),
      asJson(city.foodTitle),
      asJson(city.foodDescription),
      asJson(city.foodImages.map(localize)),
      asJson(city.relatedCitySlugs),
      city.adcode,
    ],
  );
  const cityId = rows[0].id as string;
  await q(`DELETE FROM city_culture_sections WHERE city_id = $1`, [cityId]);
  for (const section of city.sections) {
    await q(
      `INSERT INTO city_culture_sections (city_id, title, body, image, images,
          stat_label, stat_value, breath_image, breath_quote, sort_order)
       VALUES ($1, $2::jsonb, $3::jsonb, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9::jsonb, $10)`,
      [
        cityId,
        asJson(section.title),
        asJson(section.body),
        localize(section.image),
        asJson((section.images ?? []).map(localize)),
        asJson(section.statLabel ?? null),
        asJson(section.statValue ?? null),
        localize(section.breathImage ?? section.image),
        asJson(section.breathQuote ?? null),
        section.sortOrder,
      ],
    );
  }
  return cityId;
}

async function upsertRoute(
  q: Query,
  route: ShowcaseRoute,
  cityIdBySlug: Map<string, string>,
) {
  if (!APPLY) return;
  const rows = await q(
    `INSERT INTO story_routes (slug, title, culture_tag, city_name, duration, audience,
        summary, story, cover_image, route_region_key, published, deleted_at)
     VALUES ($1, $2::jsonb, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb,
        $9, $10, true, NULL)
     ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title, culture_tag = EXCLUDED.culture_tag,
        city_name = EXCLUDED.city_name, duration = EXCLUDED.duration,
        audience = EXCLUDED.audience, summary = EXCLUDED.summary, story = EXCLUDED.story,
        cover_image = EXCLUDED.cover_image, route_region_key = EXCLUDED.route_region_key,
        published = true, deleted_at = NULL, updated_at = now()
     RETURNING id`,
    [
      route.slug,
      asJson(route.title),
      route.cultureTag,
      asJson(route.cityName),
      asJson(route.duration),
      asJson(route.audience),
      asJson(route.summary),
      asJson(route.story),
      localize(route.coverImage),
      route.routeRegionKey,
    ],
  );
  const routeId = rows[0].id as string;
  await q(`DELETE FROM route_stops WHERE route_id = $1`, [routeId]);
  await q(`DELETE FROM route_city_links WHERE route_id = $1`, [routeId]);
  for (const [index, slug] of route.citySlugs.entries()) {
    const cityId = cityIdBySlug.get(slug);
    if (!cityId) continue;
    await q(
      `INSERT INTO route_city_links (route_id, city_id, sort_order) VALUES ($1, $2, $3)
       ON CONFLICT (route_id, city_id) DO UPDATE SET sort_order = EXCLUDED.sort_order`,
      [routeId, cityId, index],
    );
  }
  for (const [index, stop] of route.stops.entries()) {
    await q(
      `INSERT INTO route_stops (route_id, sort_order, time, stop_name, story, cultural_story,
          details, image, images, lat, lng, meal, hotel, transit, plan, is_featured)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9::jsonb, $10, $11,
          $12::jsonb, $13::jsonb, $14::jsonb, $15, $16)`,
      [
        routeId,
        index,
        stop.time,
        asJson(stop.stopName),
        asJson(stop.story),
        asJson(stop.culturalStory),
        asJson(stop.details),
        localize(stop.image),
        asJson((stop.images ?? []).map(localize)),
        stop.lat,
        stop.lng,
        asJson(stop.meal ?? null),
        asJson(stop.hotel ?? null),
        asJson(stop.transit ?? null),
        stop.plan ?? null,
        index === 0,
      ],
    );
  }
}

const COLLECTIONS = [
  {
    slug: 'coastal-life-kit',
    title: 'Coastal Life Kit',
    routeName: 'A Southern Sea Table',
    routeSlug: 'southern-sea-table',
    image: '/uploads/seed/southern-coast-1200.jpg',
    body: 'Objects chosen for the textures of Guangdong’s southern coast: mineral clay, working-harbour weight, and a table built for sharing.',
    sortOrder: 0,
  },
  {
    slug: 'tea-culture-set',
    title: 'Chaoshan Tea Set',
    routeName: 'Bridge, Tea, Old City',
    routeSlug: 'chaoshan-tea-culture',
    image: '/uploads/seed/chaozhou-tea-1200.jpg',
    body: 'A small collection around gongfu tea: reduction, patience, and the heat held in unglazed clay.',
    sortOrder: 1,
  },
];

const PRODUCTS = [
  {
    slug: 'volcanic-soil-bowl',
    name: 'Volcanic Soil Bowl',
    collection: 'coastal-life-kit',
    price: 32.0,
    tag: 'Small-batch tableware',
    image: '/uploads/seed/volcanic-soil-bowl-900.jpg',
    story:
      'Thrown as a daily bowl rather than a souvenir, this piece carries a dark, mineral surface that recalls the volcanic ground beneath the Leizhou Peninsula.',
    material: 'High-fired stoneware with mineral-rich clay',
    dimensions: '12 cm diameter × 6 cm high',
    origin: 'Made for the Culvoy coastal collection in Guangdong',
    care: 'Hand wash recommended; avoid sudden temperature changes.',
    trace: { route: 'southern-sea-table', place: 'Zhanjiang', note: 'A functional object chosen to continue the route’s material story at home.' },
    gallery: ['/uploads/seed/volcanic-soil-bowl-900.jpg', '/uploads/seed/volcanic-soil-bowl-1200.jpg'],
    stock: 12,
  },
  {
    slug: 'zhuni-teapot',
    name: 'Chaozhou Zhuni Teapot',
    collection: 'tea-culture-set',
    price: 88.0,
    tag: 'Hand-thrown teaware',
    image: '/uploads/seed/chaozhou-tea-800.jpg',
    story:
      'A small zhuni pot for gongfu tea, made to round the edges of a tea’s bitterness and hold warmth across many short infusions.',
    material: 'Unglazed Chaozhou zhuni clay',
    dimensions: '9 cm wide × 6 cm high, 120 ml',
    origin: 'Made in Chaozhou, Guangdong',
    care: 'Rinse with hot water only; never use soap or detergent.',
    trace: { route: 'chaoshan-tea-culture', place: 'Chaozhou', note: 'Chosen for the tea ritual at the centre of the Chaoshan route.' },
    gallery: ['/uploads/seed/chaozhou-tea-800.jpg', '/uploads/seed/chaozhou-tea-1200.jpg'],
    stock: 6,
  },
  {
    slug: 'gongfu-serving-tray',
    name: 'Gongfu Serving Tray',
    collection: 'tea-culture-set',
    price: 54.0,
    tag: 'Ritual essentials',
    image: '/uploads/seed/chaozhou-tea-1200.jpg',
    story:
      'A shallow tray that catches the overflow of a gongfu session, keeping the table dry so attention stays on the pour, the aroma, and the company.',
    material: 'Bamboo frame with a glazed ceramic deck',
    dimensions: '24 cm × 15 cm × 3 cm',
    origin: 'Assembled in Guangdong for the Culvoy tea collection',
    care: 'Wipe the deck after each session; air-dry the bamboo frame.',
    trace: { route: 'chaoshan-tea-culture', place: 'Chaozhou', note: 'The practical half of the tea ritual, made to be used rather than displayed.' },
    gallery: ['/uploads/seed/chaozhou-tea-1200.jpg', '/uploads/seed/chaozhou-tea-800.jpg'],
    stock: 9,
  },
];

const SERVICE_MODES = [
  {
    sortOrder: 0,
    title: 'Half-day route interpreter',
    price: 'From SGD 160 / half day',
    bestFor: 'A single market, neighbourhood, or workshop where context changes the visit',
    body:
      'A bilingual local joins for up to four hours, turning a market run, a craft visit, or an old-quarter walk into a conversation rather than a transaction.',
    includes: ['Pre-trip call', 'Up to 4 hours on the ground', 'Menu and market support', 'Contextual cultural interpretation'],
    accent: 'light',
    featured: false,
  },
  {
    sortOrder: 1,
    title: 'Full-day cultural interpreter',
    price: 'From SGD 280 / day',
    bestFor: 'Independent travelers who want both practical support and cultural context',
    body:
      'A bilingual local accompanies the day, helping you navigate places where translation alone is not enough: markets, family-run restaurants, craft workshops, and changing plans.',
    includes: ['Pre-trip call', 'Up to 8 hours on the ground', 'Transport and meal coordination', 'Contextual cultural interpretation'],
    accent: 'dark',
    featured: true,
  },
  {
    sortOrder: 2,
    title: 'Multi-day journey support',
    price: 'From SGD 240 / day',
    bestFor: 'Families and small groups travelling across two or more cities',
    body:
      'The same interpreter stays with your group for the length of a route, so context accumulates across cities instead of resetting every morning.',
    includes: ['Route planning review', 'Daily on-the-ground support', 'Group and family pacing', 'Handover notes for free days'],
    accent: 'light',
    featured: false,
  },
];

const INTERPRETERS = [
  {
    sortOrder: 0,
    name: 'Lin Yao',
    language: 'English, Mandarin, Cantonese',
    focus: 'Coastal food systems and everyday city life',
    helps: ['Market conversations', 'Family-run restaurants', 'Route pacing', 'Cultural questions'],
    avatar: '/editorial/interpreter-female.jpg',
    bio: 'Lin grew up between Zhanjiang’s old quarter and the waterfront. Her work focuses on making small, ordinary encounters legible without turning them into spectacle.',
    city: 'Zhanjiang',
  },
  {
    sortOrder: 1,
    name: 'Chen Ruo',
    language: 'English, Mandarin, Teochew',
    focus: 'Tea ritual, old-city architecture, and craft workshops',
    helps: ['Gongfu tea sessions', 'Temple and bridge history', 'Workshop visits', 'Family table etiquette'],
    avatar: '/uploads/interpreters/food-host.jpg',
    bio: 'Ruo works with Chaozhou’s tea houses and craft studios, and prefers to let a slow pour explain the culture before any historical summary does.',
    city: 'Chaozhou',
  },
  {
    sortOrder: 2,
    name: 'Wen Jia',
    language: 'English, Mandarin, Cantonese',
    focus: 'Pearl River history, arcade streets, and morning food culture',
    helps: ['Dim sum ordering', 'Arcade-street walks', 'Museum context', 'Public transport navigation'],
    avatar: '/editorial/interpreter-male.jpg',
    bio: 'Jia grew up near the Pearl River and still reads Guangzhou through its breakfast tables and arcade shade, moving from food to history without a script.',
    city: 'Guangzhou',
  },
];

const FAQS = [
  {
    sortOrder: 0,
    question: 'Is this a guide service or interpreting?',
    answer:
      'It combines cultural interpretation with practical travel support. Your interpreter can help with logistics, but the main value is making local context, etiquette, and conversation easier to enter.',
    category: 'interpreting',
  },
  {
    sortOrder: 1,
    question: 'Can I book only restaurant or transport help?',
    answer:
      'Yes. Half-day bookings are usually built around one market, meal, or workshop. Tell us the single situation where language is getting in the way and we will match an interpreter to it.',
    category: 'interpreting',
  },
  {
    sortOrder: 2,
    question: 'Must I follow a route exactly?',
    answer:
      'No. The published routes are a well-sequenced default, not a schedule. Your interpreter can reorder stops for weather, opening hours, or simply how much time you want to spend at a table.',
    category: 'interpreting',
  },
];

async function main() {
  const host = String((AppDataSource.options as { host?: string }).host ?? 'localhost');
  if (!LOCAL_HOSTS.has(host) || process.env.NODE_ENV === 'production') {
    throw new Error('Local showcase data can only be written to a localhost database.');
  }

  const cities = CITY_SLUGS.map(
    (slug) => SHOWCASE_CITIES.find((city) => city.slug === slug)!,
  ).filter(Boolean);
  const routes = ROUTE_SLUGS.map(
    (slug) => SHOWCASE_ROUTES.find((route) => route.slug === slug)!,
  ).filter(Boolean);

  if (cities.length !== 3 || routes.length !== 3) {
    throw new Error('Expected exactly 3 showcase cities and 3 showcase routes.');
  }
  const highlights = SHOWCASE_HOME_HIGHLIGHTS.filter((item) =>
    CITY_SLUGS.includes(item.slug),
  );
  if (!APPLY) {
    console.log(
      JSON.stringify(
        {
          mode: 'dry-run',
          cities: cities.map((c) => c.slug),
          routes: routes.map((r) => `${r.slug} (${r.stops.length} stops)`),
          collections: COLLECTIONS.map((c) => c.slug),
          products: PRODUCTS.map((p) => p.slug),
          serviceModes: SERVICE_MODES.length,
          interpreters: INTERPRETERS.map((i) => i.name),
          faqs: FAQS.length,
          homeHighlights: highlights.map((h) => h.slug),
        },
        null,
        2,
      ),
    );
    console.log('Dry run only. Re-run with --apply to write to the local database.');
    return;
  }

  await AppDataSource.initialize();
  const runner = AppDataSource.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  const q: Query = (sql, params) =>
    runner.query(sql, params) as Promise<Array<Record<string, unknown>>>;
  try {
    const cityIdBySlug = new Map<string, string>();
    for (const city of cities) {
      const id = await upsertCity(q, city);
      if (id) cityIdBySlug.set(city.slug, id);
    }
    for (const route of routes) {
      await upsertRoute(q, route, cityIdBySlug);
    }

    const collectionIdBySlug = new Map<string, string>();
    for (const collection of COLLECTIONS) {
      const rows = await q(
        `INSERT INTO store_collections (slug, title, route_name, route_slug, image, body, sort_order, published)
         VALUES ($1, $2::jsonb, $3, $4, $5, $6::jsonb, $7, true)
         ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, route_name = EXCLUDED.route_name,
           route_slug = EXCLUDED.route_slug, image = EXCLUDED.image, body = EXCLUDED.body,
           sort_order = EXCLUDED.sort_order, published = true, updated_at = now()
         RETURNING id`,
        [
          collection.slug,
          asJson(collection.title),
          collection.routeName,
          collection.routeSlug,
          localize(collection.image),
          asJson(collection.body),
          collection.sortOrder,
        ],
      );
      collectionIdBySlug.set(collection.slug, rows[0].id as string);
    }

    const productIdBySlug = new Map<string, string>();
    for (const product of PRODUCTS) {
      const rows = await q(
        `INSERT INTO store_products (slug, name, collection_id, price, currency, tag, image,
            story, material, dimensions, origin, care, origin_trace, gallery, stock, published, deleted_at)
         VALUES ($1, $2::jsonb, $3, $4, 'SGD', $5::jsonb, $6, $7::jsonb, $8::jsonb, $9::jsonb,
            $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14, true, NULL)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, collection_id = EXCLUDED.collection_id,
           price = EXCLUDED.price, tag = EXCLUDED.tag, image = EXCLUDED.image, story = EXCLUDED.story,
           material = EXCLUDED.material, dimensions = EXCLUDED.dimensions, origin = EXCLUDED.origin,
           care = EXCLUDED.care, origin_trace = EXCLUDED.origin_trace, gallery = EXCLUDED.gallery,
           stock = EXCLUDED.stock, published = true, deleted_at = NULL, updated_at = now()
         RETURNING id`,
        [
          product.slug,
          asJson(product.name),
          collectionIdBySlug.get(product.collection) ?? null,
          product.price,
          asJson(product.tag),
          localize(product.image),
          asJson(product.story),
          asJson(product.material),
          asJson(product.dimensions),
          asJson(product.origin),
          asJson(product.care),
          asJson(product.trace),
          asJson(product.gallery.map(localize)),
          product.stock,
        ],
      );
      productIdBySlug.set(product.slug, rows[0].id as string);
    }

    for (const mode of SERVICE_MODES) {
      await q(
        `INSERT INTO interpreting_service_modes (sort_order, title, price, best_for, body, includes, accent, featured)
         VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8)
         ON CONFLICT (sort_order) DO UPDATE SET title = EXCLUDED.title, price = EXCLUDED.price,
           best_for = EXCLUDED.best_for, body = EXCLUDED.body, includes = EXCLUDED.includes,
           accent = EXCLUDED.accent, featured = EXCLUDED.featured, updated_at = now()`,
        [
          mode.sortOrder,
          asJson(mode.title),
          asJson(mode.price),
          asJson(mode.bestFor),
          asJson(mode.body),
          asJson(mode.includes),
          mode.accent,
          mode.featured,
        ],
      );
    }
    for (const person of INTERPRETERS) {
      await q(
        `INSERT INTO interpreter_profiles (sort_order, name, language, focus, helps, avatar, bio, status, city)
         VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7::jsonb, 'active', $8)
         ON CONFLICT (sort_order) DO UPDATE SET name = EXCLUDED.name, language = EXCLUDED.language,
           focus = EXCLUDED.focus, helps = EXCLUDED.helps, avatar = EXCLUDED.avatar, bio = EXCLUDED.bio,
           status = 'active', city = EXCLUDED.city, updated_at = now()`,
        [
          person.sortOrder,
          asJson(person.name),
          asJson(person.language),
          asJson(person.focus),
          asJson(person.helps),
          localize(person.avatar),
          asJson(person.bio),
          person.city,
        ],
      );
    }
    for (const faq of FAQS) {
      await q(
        `INSERT INTO interpreting_faqs (sort_order, question, answer, category)
         VALUES ($1, $2::jsonb, $3::jsonb, $4)
         ON CONFLICT (sort_order) DO UPDATE SET question = EXCLUDED.question,
           answer = EXCLUDED.answer, category = EXCLUDED.category, updated_at = now()`,
        [faq.sortOrder, asJson(faq.question), asJson(faq.answer), faq.category],
      );
    }

    // The home page reads the oldest config row; update only the collections
    // that drive the atlas, keeping hero (and its film) untouched.
    const [home] = await q(
      `SELECT id FROM home_configs ORDER BY created_at ASC LIMIT 1`,
    );
    if (!home) throw new Error('No home_configs row found.');
    await q(
      `UPDATE home_configs SET culture_highlights = $1::jsonb, featured_route_slugs = $2::jsonb,
         featured_product_slugs = $3::jsonb, featured_city_slugs = $4::jsonb,
         route_regions = $5::jsonb, updated_at = now()
       WHERE id = $6`,
      [
        asJson(highlights),
        asJson(ROUTE_SLUGS),
        asJson(PRODUCTS.map((p) => p.slug)),
        asJson(CITY_SLUGS),
        asJson(ROUTE_REGIONS),
        home.id,
      ],
    );

    await q(`DELETE FROM frontend_featured WHERE section = 'home'`);
    let order = 0;
    for (const slug of CITY_SLUGS) {
      const id = cityIdBySlug.get(slug);
      if (id) {
        await q(
          `INSERT INTO frontend_featured (section, ref_type, ref_id, sort_order) VALUES ('home', 'city', $1, $2)`,
          [id, order++],
        );
      }
    }
    for (const slug of ROUTE_SLUGS) {
      const row = await q(`SELECT id FROM story_routes WHERE slug = $1`, [slug]);
      if (row[0]?.id) {
        await q(
          `INSERT INTO frontend_featured (section, ref_type, ref_id, sort_order) VALUES ('home', 'route', $1, $2)`,
          [row[0].id, order++],
        );
      }
    }
    for (const slug of PRODUCTS.map((p) => p.slug)) {
      const id = productIdBySlug.get(slug);
      if (id) {
        await q(
          `INSERT INTO frontend_featured (section, ref_type, ref_id, sort_order) VALUES ('home', 'product', $1, $2)`,
          [id, order++],
        );
      }
    }

    await runner.commitTransaction();

    console.log(
      JSON.stringify(
        {
          mode: 'apply',
          cities: CITY_SLUGS,
          routes: ROUTE_SLUGS,
          collections: COLLECTIONS.length,
          products: PRODUCTS.length,
          serviceModes: SERVICE_MODES.length,
          interpreters: INTERPRETERS.length,
          faqs: FAQS.length,
          homeHighlights: highlights.map((h) => h.slug),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
    if (AppDataSource.isInitialized) await AppDataSource.destroy();
  }
}

void main().catch((error) => {
  console.error('Local showcase seed failed:', error);
  process.exitCode = 1;
});
