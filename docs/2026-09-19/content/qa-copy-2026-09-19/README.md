# Q&A copy — 2026-09-19

Staging copy for the Feishu todo 「产品文案优化（Q&A）— 面向国际用户」
(`recvvE7CLi1QGz`). The owner’s decision was recorded on 2026-09-19 as *same terms
as the city batch: rewrite everything, publish straight to production, no review*.
This folder is the rewritten English copy for the interpreting page’s FAQ list,
ready to be written into the CMS. It has **not** been written yet — see *Blocker*.

The three FAQ records live in `GET /api/v1/public/interpreting` → `faqs[]`, alongside
`service_modes[]` and `profiles[]`. Fetched read-only 2026-09-19.

## Blocker — this is staged, not published

Same as the city, route and product batches: writing these values means **writing
production business data** (FAQ rows in the production CMS). Production business
data writes are excluded from the standing authorization of this run (`AGENTS.md`
§6 and the run’s own authorization statement), and no administrator credential
exists in this environment (verified this run: `LINGTOUR_ADMIN_EMAIL`,
`LINGTOUR_ADMIN_PASSWORD`, `LINGTOUR_ADMIN_TOKEN` all unset).

## The one hard defect: the FAQ still names the old brand

**This is the finding of the batch.** Two published, customer-facing strings still
say **`LingTour`**, while the product is branded **Culvoy** everywhere else — the
site’s own metadata says `siteName: "Culvoy"` and `title: "Culvoy Guangdong — Story
Routes, Culture & Local Interpreters"`, and `grep -rn "LingTour" site/src` returns
**zero** hits. The stale name survives only in the database copy.

| # | Record | Field | Published value |
| --- | --- | --- | --- |
| 1 | `faqs[2]` `9a71ad48-32e6-49d1-a502-4ae5698ff510` | `question` | *"Do I need to follow a **LingTour** route exactly?"* |
| 2 | `service_modes[1]` `af190051-f5f8-467f-aeed-0032ba245070` | `body` | *"For visitors following a **LingTour** route…"* |

Record 2 is not part of the FAQ list, but it sits in the same payload, on the same
page, one card away — a visitor reads the old brand name twice on `/interpreting`.
It is included here rather than left for someone to find later.

Replacement in both cases is `Culvoy`. Nothing else in either string changes.

## Full replacement table

### `faqs[0]` — `82b10a95-6520-48a7-91c1-f8cfe3d04409`, `sortOrder` 0

`question` — **unchanged**: *"Is this a tour guide or interpreting service?"*

`answer` — replace

Before:

> It is cultural interpreting plus travel support. The focus is on clear
> communication, route pacing, local etiquette, food and venue navigation, and
> making the story of a place accessible to international visitors.

After:

> It is cultural interpreting plus travel support rather than a conventional
> guided tour. In practice that means English support on the ground — route
> pacing, local etiquette, food and venue navigation — and making the story of a
> place readable for international visitors.

Why: the question asks for a *difference* and the published answer does not give
one — it just lists services, and "The focus is on" is filler. The replacement
answers the question in its first clause.

### `faqs[1]` — `58e8d621-2b88-418b-80bb-f511cb29ded6`, `sortOrder` 1

`question` — **unchanged**: *"Can I book only restaurant or transport support?"*

`answer` — replace

Before:

> Yes. Not every visit needs a full-day route. Short support is available for food
> streets, hotel check-in, station transfer, or one key cultural stop.

After:

> Yes. Not every visit needs a full day. Short support is available for food
> streets, hotel check-in, station transfer, or a single cultural stop.

Why: *"a full-day route"* reuses the word *route* for something the buyer is not
buying, which reads as an upsell. *"one key cultural stop"* → *"a single cultural
stop"* removes an adjective doing no work.

### `faqs[2]` — `9a71ad48-32e6-49d1-a502-4ae5698ff510`, `sortOrder` 2

`question` — replace

Before: *"Do I need to follow a LingTour route exactly?"*
After: *"Do I need to follow a Culvoy route exactly?"*

`answer` — **unchanged**

> No. The published routes are starting points. You can follow one closely,
> simplify it, combine ideas from several routes, or ask for support around your
> own schedule.

Why: the answer is already clear and needs no edit; only the brand name is wrong.

### `service_modes[1]` — `af190051-f5f8-467f-aeed-0032ba245070` ("Story route guided support"), adjacent fix

`body` — replace

Before:

> For visitors following a LingTour route. The interpreter manages the practical
> side while keeping the cultural thread clear across every stop and meal.

After:

> For visitors following a Culvoy route. The interpreter manages the practical
> side while keeping the cultural thread clear across every stop and meal.

`title`, `price` (*From RMB 1,280 / half day*), `bestFor`, `includes[]`, `accent`,
`featured`, `sortOrder` — all unchanged.

## Editorial judgement recorded honestly

- **These three answers are the best copy in the four batches.** They are short,
  direct, and answer what was asked. Two of the three needed no change at all
  beyond one word. A blanket rewrite here would have been pure churn, and the
  README for the city batch reached the same conclusion about its own source.
- **The real gap is practical information, and it is left empty.** A visitor
  reading this page cannot learn: how to actually book, how far ahead, what
  languages are spoken, which cities are covered, what happens if a booking is
  cancelled, or how the *From RMB 680 / half day* price is computed. **None of
  that was invented.** It should be added as two or three more FAQ records by
  whoever owns the commercial answers. `sortOrder` currently runs 0,1,2 with no
  gaps, so appending is clean.
- **The `category` field is `"interpreting"` on all three records** and is not
  surfaced to the visitor. If more FAQs are added later for other sections, that
  field is the filter to rely on — worth confirming before it is reused.
- Finally, `无需审核` means this goes live unread. Every change here is either a
  corrected brand name or a re-expression of facts already published, which is the
  only reason that is safe. Any *new* FAQ that promises a policy — a refund rule,
  a lead time — must be read by a human once before it is published.