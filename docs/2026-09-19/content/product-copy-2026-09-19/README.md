# Product copy, rewritten for international travellers — 2026-09-19

Staging copy for the Feishu todo 「产品文案优化（商品）— 面向国际用户」
(`recvvE7CLiRMCS`). The owner’s decision was recorded on 2026-09-19 as *same terms
as the city batch: rewrite everything, keep to the existing image library, publish
straight to production, no review*. This folder is the shop’s rewritten English
copy, ready to be written into the CMS. It has **not** been written yet — see
*Blocker* below.

Products: [Canton Porcelain Tea Cup](canton-porcelain-cup.md) ·
[Volcanic Soil Tea Bowl](volcanic-soil-bowl.md)

## Blocker — this is staged, not published

Identical to the city and route batches: writing these values means **writing
production business data** (the shop product rows in the production CMS).
Production business data writes are excluded from the standing authorization of
this run (`AGENTS.md` §6 and the run’s own authorization statement), and no
administrator credential exists in this environment (verified this run:
`LINGTOUR_ADMIN_EMAIL`, `LINGTOUR_ADMIN_PASSWORD`, `LINGTOUR_ADMIN_TOKEN` all
unset). The run stops here rather than writing quietly.

## Scope is two records, and the published payload is thin

The shop has exactly **two published products**. Both fetch cleanly from
`GET /api/v1/public/shop/products`. The fields that exist are:

`slug`, `price`, `currency`, `image`, `gallery[3]`, `primaryMedia`,
`galleryMedia[3]`, `collection`, `product{name, tag}`, `materialNotes`, `story`.

Two things follow, and both matter more than any rewording:

1. **There is almost no copy to optimise.** Each product carries one `story`
   sentence, one `materialNotes` phrase and one `tag`. The gap for an
   international buyer is not tone, it is *missing information* — see *Facts
   needed* below. Rewriting one sentence per product cannot fix that.
2. **Do not blanket-rewrite.** The two `story` sentences are already specific
   ("clay from the Leizhou Peninsula volcanic fields"), which is exactly the
   register this todo is asking for. Only what is actually weak is changed.

## What is replaced, and what is not

Per product, only the `story` field is rewritten. Everything else stays
byte-identical to the production payload fetched read-only on 2026-09-19:

| Product | slug | price | cover + gallery | `materialNotes` | `product.name` | `product.tag` | `collection` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Canton Porcelain Tea Cup | `canton-porcelain-cup` | 46 SGD | kept (4 images) | kept | kept | kept | kept (`null`) |
| Volcanic Soil Tea Bowl | `volcanic-soil-bowl` | 32 SGD | kept (4 images) | kept | kept | kept | kept (`coastal-life-kit`) |

No image record is touched, no product is added or removed, no price is changed.
No new fact is introduced: every material and origin claim in the replacement text
already exists in the currently published copy for that product.

## What actually changed, and why

Both published `story` fields are **one sentence** and share the same construction:
a noun phrase, a comma, then a participial clause about what the object *carries*
or *is chosen as*. The rewrite keeps every fact and fixes the register only:

- **`canton-porcelain-cup`** — *"…chosen as a calm companion for Canton morning
  tea and afternoon table conversation"* is the weakest line in the shop: it tells
  the buyer how to feel about the cup instead of what it is for. It now describes
  use.
- **`volcanic-soil-bowl`** — the sentence was already good and casual
  *"carrying the dark, rich texture of the southern coast"* was left in place; it
  is welded to the `materialNotes` glaze phrase so the two fields stop repeating
  each other without connecting.

## Open items found while reading the production records

These are recorded, **not changed**, because each is a merchandising or data
decision rather than a copy decision:

1. **`product.tag` uses two different registers.** `canton-porcelain-cup` is tagged
   *"Tea table object"* (a category) and `volcanic-soil-bowl` is tagged
   *"Handcrafted"* (an attribute). Side by side in the shop grid they read as
   inconsistent. Also note *"Handcrafted"* is a claim about how the bowl was made
   which nothing else in the record supports or denies; either substantiate it or
   drop it.
2. **The cup belongs to no collection, the bowl belongs to one.** `collection` is
   `null` for the cup and `{slug: coastal-life-kit, title: Coastal Life Kit}` for
   the bowl. Whether the Canton cup should join a collection is the owner’s call;
   it is left exactly as published.
3. **`materialNotes` is a bare word for the cup** (*"Porcelain"*) against a full
   phrase for the bowl (*"Natural volcanic clay, lead-free matte glaze"*). Same
   inconsistency as (1).

## Facts needed — left empty on purpose

An international buyer deciding whether to put a SGD 46 cup in a suitcase needs
facts this workspace cannot verify, so **no plausible-sounding text was invented**.
Each slot below should be filled once, consistently, for both products:

- dimensions and capacity (ml / cm), and whether the two objects are a set;
- care instructions — dishwasher, microwave, thermal shock;
- whether *food-safe* / *lead-free* may be stated as a product claim (the bowl’s
  `materialNotes` already claims a lead-free glaze; the cup claims nothing);
- maker and provenance — the bowl names a clay origin, the cup names none;
- shipping, packaging and returns for a destination outside China;
- the currency situation: both prices are `SGD` on a site selling Guangdong trips
  in RMB (interpreting is priced *"From RMB 680"*). A traveller sees two currencies
  on one site and no explanation.

That last one is a checkout question, not a copy question, but it is the single
most likely thing to stop a purchase and it surfaced from the same two records.

Finally, `无需审核` means this prose would go live unread. Both replacements here
are re-expressions of facts already published, which is the only reason that is
safe. Any further product copy that adds a claim — a size, a care rule, a
provenance — should be read once by a human before it is published.