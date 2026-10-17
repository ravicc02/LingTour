# Route copy, rewritten for international travellers — 2026-09-19

Staging copy for the Feishu todo 「产品文案优化（路线）— 面向国际用户」
(`recvvE7CLiJiHW`). The owner’s decision was recorded on 2026-09-19 as *same terms
as the city batch: all five routes, rich imagery, publish straight to production,
no review*. This folder is the five routes’ rewritten English copy, ready to be
written into the CMS. It has **not** been written yet — see *Blocker* below.

Routes: [A Southern Sea Table](southern-sea-table.md) ·
[Guangzhou River Arcade Walk](guangzhou-river-arcade.md) ·
[Bridge, Tea, Old City](chaoshan-tea-culture.md) ·
[Kiln Fire and Temple Frontage](foshan-kiln-and-zumiao.md) ·
[Red Cliffs, Chan Quiet](danxia-and-nanhua.md)

## Blocker — this is staged, not published

Identical to the city batch, and unresolved by the owner’s *publish directly*
decision: writing these values means **writing production business data** (the
route and route-stop rows in the production CMS). Production business data writes
are excluded from the standing authorization of this run (`AGENTS.md` §6 and the
run’s own authorization statement), and no administrator credential exists in this
environment (`LINGTOUR_ADMIN_EMAIL`, `LINGTOUR_ADMIN_PASSWORD`,
`LINGTOUR_ADMIN_TOKEN` are all unset — verified again this run). The run therefore
stops here rather than writing quietly.

To finish, either

1. extend the run’s authorization to production CMS writes **and** supply an admin
   credential, or
2. paste the values yourself in 内容 → 路线 for the five slugs.

## What is replaced, and what is not

Per route, only the **route-level `story`** and each **stop-level `story`** are
rewritten, plus **two stop-level `culturalStory` lines** that carried the same
defect (listed explicitly below rather than changed silently).

Everything else stays byte-identical to the production payload fetched read-only on
2026-09-19:

| Route | slug | stops | `summary` | `culturalStory` | stop `details` | stop `image` |
| --- | --- | --- | --- | --- | --- | --- |
| A Southern Sea Table | `southern-sea-table` | 3 | kept | 1 of 3 rewritten | kept | kept |
| Guangzhou River Arcade Walk | `guangzhou-river-arcade` | 3 | kept | kept | kept | kept |
| Bridge, Tea, Old City | `chaoshan-tea-culture` | 3 | kept | 1 of 3 rewritten | kept | kept |
| Kiln Fire and Temple Frontage | `foshan-kiln-and-zumiao` | 3 | kept | kept | kept | kept |
| Red Cliffs, Chan Quiet | `danxia-and-nanhua` | 3 | kept | kept | kept | kept |

Slug, `title`, `cultureTag`, `cityName`, `duration`, `audience`, `coverImage`,
`routeRegionKey`, stop `time`/`stopName`/`lat`/`lng`/`isFeatured`, and publish state
are untouched. No new fact is introduced: every place name, dynasty, world-heritage
line and geographic claim in the replacement text already exists in the currently
published copy for that route.

## What actually changed, and why

The published route copy is **already specific and restrained** — "Volcanic lake at
dawn, market logic by noon" is not machine filler. Two narrow, verifiable defects
were found, and only those are fixed.

1. **Itinerary self-narration.** The copy repeatedly narrates the itinerary
   instead of the place: *"the route keeps that line visible all day"*, *"the route
   stays close to the question"*, *"the route pivots"*, *"the route then enters"*,
   *"the route uses it as the day’s final reading frame"*. Eleven occurrences
   across the five routes. This is the clearest machine register in the set — a
   route describing itself rather than its subject — and every rewritten paragraph
   now describes the place. Two of the eleven sat in `culturalStory` and were
   rewritten with the rest:
   - `southern-sea-table` stop 3: *"where the route shifts from labour to
     appetite"* → *"where labour gives way to appetite"*
   - `chaoshan-tea-culture` stop 3: *"The route uses it as the day’s final reading
     frame."* → *"…and it gives the day its final frame."*

   One further occurrence is **left untouched on purpose**: `danxia-and-nanhua`
   stop 2 `culturalStory` still reads *"the stop gives the route a Chan Buddhist
   frame"*. That field is not in this batch’s replacement list, so it is flagged
   here rather than edited quietly. If the route `culturalStory` field is ever
   opened for editing, that line is the one to take.
2. **The Open / By-late-morning / Close template.** Stop 1 of every route opened
   with *"Begin…"*, *"Start…"* or *"Open…"* (5 of 5); stop 2 of **two** routes
   opened with *"By late morning…"*; stop 3 of **four** routes opened with
   *"Close…"* or *"Finish…"*. The five routes were templated against each other.
   Each stop now opens on its own subject.

The route-level `story` was also thin for a detail page — one sentence, while
`summary` is already a full sentence doing the same job. Those stories are now
two clauses longer, still built only from facts already on the page.

## Editorial judgement recorded honestly

- **`summary` was left alone.** It is the strongest text in the set and rewording
  it would be churn, not improvement.
- **Nothing was added to make the routes look fuller.** Route detail pages show
  `duration` and `audience` but no practical anchors — when to go, how long to
  stay, what to book, how to reach stop 1. That is the real half of
  「面向国际用户」, and it needs facts the workspace cannot verify. The slot is
  left empty rather than filled with plausible-sounding text. Whoever supplies
  those facts should add them once, consistently, for all five.
- **Three stop `details` entries already carry practical notes** — *"Best with
  seafood dinner reservation"*, *"Pairs well with post-dinner stroll"*, *"Best
  near dusk"* — but only some stops have them, and they are not a consistent
  field. Normalising that is a structural change, not a copy change, and is out of
  scope here.
- **Route stops are thin in production data**: every route reports `stopCount` 3
  and has 3 stops, but across all fifteen stops **not one** carries a `meal`,
  `hotel`, `transit` or `plan` value, and two of `southern-sea-table`'s three stops
  reuse the same image. That is a content-completeness gap for the owner, not a
  copy problem, and it is why *图文并茂* cannot be met from existing material
  alone.