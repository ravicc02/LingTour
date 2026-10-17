# City copy, rewritten for international travellers — 2026-09-19

Staging copy for the Feishu todo 「产品文案优化（城市）— 面向国际用户」
(`recvvE72wHBZfx`). The owner answered the scope question on 2026-09-19 with:
*all five cities, add images if possible, publish straight to production, no
review*. This folder is the five cities' rewritten English copy, ready to be
written into the CMS. It has **not** been written yet — see *Blocker* below.

Cities: [Guangzhou](guangzhou.md) · [Chaozhou](chaozhou.md) · [Foshan](foshan.md) ·
[Shaoguan](shaoguan.md) · [Zhanjiang](zhanjiang.md)

## Blocker — this is staged, not published

Writing these values means **writing production business data** (the city rows in
the production CMS). That is outside the standing authorization of the assistant
run (verified against `AGENTS.md` §6 and the run's own authorization statement),
so the run stops here and asks for it explicitly instead of doing it quietly.

To finish the todo, either

1. authorize a run to `PATCH /api/v1/admin/cities/:id` with these five records —
   the run needs a real admin credential for that, or
2. paste the values yourself in 内容 → 城市 for the five slugs.

Either one is enough; the copy itself is finished either way.

The owner also asked for **精美图 / 图文并茂**. Adding images is a second
production write (upload to `/uploads`), and new photography is outside anything
this workspace can produce from existing material. Every image currently on the
five cities is preserved untouched; no new image is proposed here. If new images
should be added, say which source they come from.

## What is replaced, and what is not

Only four text fields per city: `heroNarrative`, `editorIntro`,
`foodTitle` + `foodDescription`, and the prose of `contentMarkdown`.

Everything else stays byte-identical, verified by script against the production
payload fetched read-only on 2026-09-19:

| City | image records preserved | pull quotes preserved | food title ↔ body heading |
| --- | --- | --- | --- |
| shaoguan | 6/6 | 3/3 | match |
| chaozhou | 6/6 | 3/3 | match |
| foshan | 8/8 | 3/3 | match |
| guangzhou | 7/7 | 3/3 | match |
| zhanjiang | 4/4 | 3/3 | match |

Slug, `regionLabel`, `adcode`, tags, gallery, `heroMedia`, related routes, and
publish state are untouched. No new fact is introduced: every date, name,
world-heritage line, and geographic claim in the replacement text already exists
in the current published copy.

## Two couplings that must not be broken

1. **Summary in article.** `contentMarkdown` opens with `editorIntro` and then
   `heroNarrative`, and the page hides the masthead deck when it finds that same
   text inside the article (`isSummaryInArticle` in
   `site/src/app/culture/[slug]/CultureDetailClient.tsx`). The replacement bodies
   keep exactly that pairing, so the masthead behaves as it does today. If the
   opening paragraphs are ever edited apart from these two fields, the deck
   either disappears or doubles.
2. **Food heading.** The final `##` heading in the body mirrors `foodTitle`
   verbatim. Both were changed together.

## What actually changed, and why

The verified defects in the published copy were narrow, so the edit is narrow:

- **Formulaic fragments removed.** Every section carried a bold label line such
  as `**Street logic**: Shade + trade + rain cover` or
  `**UNESCO inscription**: 2010`. All fifteen of them — three per city, on every
  city — read as structured filler rather than prose; each fact is now inside a
  sentence.
- **Food section title case harmonised.** The other section headings are already
  sentence case (`Arcade streets`, `Northern river gateway`); the four food
  headings were Title Case. They now match their sentence-case `foodTitle`.
- **Opening lines given a reader.** `editorIntro` now says what to do with the
  city rather than only describing it, and the second paragraph keeps the
  existing cross-city editorial device.

## Editorial judgement recorded honestly

The published city copy is **already** specific, restrained, and free of the
generic register this todo is worried about — "Guangzhou is a city that learned
to sell, shelter, and stroll in the same gesture" is not machine filler. A
blanket rewrite therefore carries real risk for little gain, and the rewrite here
improves structure and rhythm rather than replacing a broken voice.

Two things that would raise the copy further are **not** in this folder, because
they need facts the workspace cannot verify and must not invent: a
*when to go / how long to stay / what to skip* line per city. Those are the
missing half of "面向国际用户" — an international reader deciding a trip needs
practical anchors, not only atmosphere. Whoever supplies those facts (season,
duration, access) should add one `## Practical notes` section per city; the
slot is deliberately left empty rather than filled with plausible-sounding text.

Finally, `无需审核` means new prose would go live unread by anyone. Everything
here is a re-expression of facts that are already published, which is the only
reason that is safe. Any further copy that adds claims should be read once by a
human before it is published.