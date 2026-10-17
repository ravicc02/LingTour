# Culvoy UI Overhaul 2026

## Scope

This is a visual and interaction overhaul, not an information-architecture rewrite.
Existing routes, slugs, navigation labels, content ownership, authentication flows,
SEO entry points, and public API paths remain stable unless a migration below says
otherwise.

Non-negotiable requirements:

- Public site and admin both support image and video media.
- Products, city/culture attractions, route covers, and route stops can opt into video.
- Existing image-only records continue to render without editorial migration.
- Public and admin clients use the production API while visual work is validated locally.
- Every implementation batch is tested and committed independently.
- Major stable batches are pushed, pulled on the server, rebuilt, restarted, and smoke-tested.

## Current-state audit

The July 19 visual audit used production API data through the local Next.js and Vite
frontends.

- The public visual identity is recognizable, but routes, culture, shop, and interpreting
  reuse nearly the same headline-plus-framed-image composition. The pages look related
  while behaving like separate prototypes.
- No audited public page rendered a video element. Home has an optional video URL in its
  config, but the shared media library and domain models are image-only.
- At a 390 x 844 mobile viewport, core landing pages become long single columns (about
  3,655 to 9,243 CSS pixels). They avoid horizontal scrolling but lose hierarchy,
  cross-module comparison, and action continuity.
- Decorative paper grain, tape, rotation, uppercase micro-labels, and oversized editorial
  titles are used too often. Their repetition weakens the premium effect.
- Product and city detail pages expose many controls and sections without a consistent
  mobile information architecture. Route detail can remain in its loading state and is a
  regression target for the data pass.
- Admin already has useful shared list/editor components and Element Plus tokens, but its
  responsive rules mostly collapse tools vertically or hide previews. Media management is
  image-specific in copy, filtering, previews, limits, and upload validation.

## Design read

### Public site

- Audience: international travellers looking for cultural context, routes, objects, and
  language support.
- Goal: move from discovery to a confident route, service, or purchase decision.
- Emotional tone: cinematic, literate, calm, tactile, and contemporary.
- Creative north star: **The Living Field Atlas**. Archival evidence remains, but media,
  maps, time, and motion make the archive feel alive.
- Page architecture: each product family gets a distinct narrative rhythm while sharing
  the same navigation, media, action, state, and spacing grammar.
- Typography: editorial display type for moments of voice; a highly legible humanist sans
  for actions and long-form reading. Large type is reserved for one focal statement per
  viewport.
- Surfaces: mineral paper, deep river ink, white editorial sheets, and occasional dark
  cinematic stages. Cinnabar and brass stay rare action/highlight colors.
- Media: real production content in deliberate aspect-ratio frames. Video always has a
  poster and a usable non-autoplay fallback.

Taste dials:

- `DESIGN_VARIANCE = 7`
- `MOTION_INTENSITY = 7`
- `VISUAL_DENSITY = 4`

### Admin

- Audience: content editors, operators, and administrators.
- Goal: understand status, make a change, preview its public result, and publish safely.
- Emotional tone: focused, trustworthy, quick, and quietly branded.
- Architecture: preserve Element Plus and existing CRUD routes; improve hierarchy,
  navigation memory, progressive disclosure, and responsive workflows.
- Motion: state confirmation and spatial continuity only. No decorative dashboard motion.

Product dials:

- `DESIGN_VARIANCE = 4`
- `MOTION_INTENSITY = 4`
- `VISUAL_DENSITY = 6`

## Visual system changes

- Keep river, cinnabar, brass, jade, ink, and neutral paper roles; reduce the number of
  near-duplicate parchment variables.
- Keep the field-journal motif as an accent. Limit tape, rotation, stamps, and heavy grain
  to authored moments rather than applying all of them to every card.
- Replace repeated equal-card grids with editorial sequences: index rails, filmstrips,
  split narratives, map-linked chapters, compact comparison bands, and horizontal mobile
  carousels where comparison matters.
- Use one radius system per surface family. Public editorial sheets are mostly square;
  product controls use a small radius; admin follows the Element Plus token scale.
- Use one primary action and at most one secondary action in each decision area. Action
  labels describe the destination or state change.

## Interaction and motion grammar

GSAP is reserved for motion with narrative or state value:

- hero/media sequencing, chapter transitions, pinned desktop story sections, controlled
  horizontal filmstrips, map-to-content coordination, and meaningful route progress;
- scoped React animations use `useGSAP()` and a component root ref;
- scoped Vue animations use `gsap.context()` in `onMounted()` and `ctx.revert()` in
  `onUnmounted()`;
- responsive variants use `gsap.matchMedia()`;
- ScrollTrigger uses `scrub` or `toggleActions`, never both on one trigger;
- transforms and opacity are animated instead of layout properties;
- media load and dynamic content changes trigger a debounced `ScrollTrigger.refresh()`;
- `prefers-reduced-motion` renders all content immediately and removes pin/scrub effects.

CSS remains the right tool for focus, hover, pressed, selection, loading, and short control
transitions. Motion must never be required to understand content or complete an action.

## Responsive strategy

The redesign is component-responsive, not desktop stacking.

- Container gutters: 16 px mobile, 24 px tablet, 40 px desktop, with safe-area support.
- Layout primitives use grid and `minmax(0, 1fr)` to prevent module compression.
- Mobile hero content fits a useful first viewport: identity, value, one primary action,
  and a media cue. Secondary context follows below.
- Related cards and media galleries become touch-scroll rails with snap points when users
  need comparison; long prose remains vertical.
- Dense city/product/route details use a compact summary rail and progressive disclosure
  instead of rendering every chapter as a full-width block.
- Admin list pages use a purpose-built mobile row/card representation when a table would
  require destructive column compression. Editors use a sticky save/status bar and an
  explicit preview mode instead of silently hiding preview.
- Required verification widths: 375, 390, 430, 768, 834, 1280, and 1920 CSS pixels.

## Backward-compatible media contract

```ts
type MediaAsset = {
  type: 'image' | 'video'
  url: string
  poster?: string
  alt?: { en: string; zh: string }
}
```

New optional fields are additive:

- product: `primaryMedia`, `galleryMedia`
- city: `heroMedia`, `galleryMedia`
- city culture section: `primaryMedia`, `media`
- story route: `coverMedia`
- route stop: `primaryMedia`, `media`

Compatibility rules:

1. If a new primary media field is absent, construct an image asset from the existing
   `image`, `heroImage`, or `coverImage` value.
2. If a new gallery media field is absent, construct image assets from the existing image
   array.
3. When editors choose an image as primary media, keep the legacy primary image field in
   sync. When they choose a video, store its poster in the legacy image field so old clients
   still render a useful image.
4. Video assets require an MP4, WebM, or QuickTime URL and a poster before publish. Public
   cards use posters by default; detail and authored hero placements can expose playback.
5. Ambient playback is muted, looped, inline, and disabled for reduced-motion or data-save
   users. Product/detail playback provides controls and never steals audio focus.

The existing image upload endpoint keeps its 10 MB image policy. A separate video upload
endpoint accepts only the approved video MIME types with a higher configurable limit. Both
write to the same media library and ownership metadata.

## Delivery slices

1. Media schema, migration, upload validation, API DTOs, compatibility mapping, and tests.
2. Admin mixed-media library, picker, preview, publish validation, and product/attraction
   editor entry points.
3. Public media renderer and compatibility adapters.
4. Public tokens, layout primitives, motion runtime, and shared shell.
5. Home, routes, culture, shop, interpreting, community, account, and checkout page families.
6. Admin shell, lists, editors, and mobile workflow refinement.
7. Accessibility, reduced-motion, browser/viewport, data, performance, and production
   deployment regression.

## Definition of done

- Image-only production records render unchanged.
- At least one product and one attraction placement can be authored and rendered as video
  end to end, including poster fallback.
- No horizontal page overflow at required widths; no overlapping modules or clipped actions.
- Keyboard focus, 44 px touch targets, loading/error/empty states, contrast, and media
  controls pass review.
- All GSAP contexts and ScrollTriggers clean up on route/component teardown.
- Public and admin production builds pass using the production API configuration.
- Server pull/build/restart succeeds; public, admin, API health, representative detail
  pages, and uploaded media range requests pass smoke tests.
