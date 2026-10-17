# Zhanjiang (`zhanjiang`) — replacement copy

Source of truth for the current values: production `GET /api/v1/public/cities`
(fetched read-only 2026-09-19). Only the four text fields are replaced; slug,
region label, tags, and every image record stay exactly as they are.

## `heroNarrative`

```
Zhanjiang faces the South China Sea with a working, tidal confidence. Port trade, volcanic geology, and seafood culture all stay visible within a single day.
```

## `editorIntro`

```
Read Zhanjiang from the shore inward: first the bay, then the market, then the traces of the older colonial streets, and finally the crater country further out on the peninsula. The order matters — the coast sets the terms here.
```

## `foodTitle` / `foodDescription`

```
The southern sea table
```

```
Zhanjiang's food culture starts with what the harbour lands at dawn and ends with how that catch is cooked, auctioned, shared, and remembered before the day is out.
```

## `contentMarkdown`

The first two paragraphs repeat `editorIntro` and then `heroNarrative`; the site
detects that (`isSummaryInArticle` in `CultureDetailClient.tsx`) and hides the
duplicate masthead deck. Keep the pairing exactly as it is here, or the masthead
will either lose its summary or show it twice.

Keep every `![...](</uploads/...>)` line byte-identical to the current value.

```
Read Zhanjiang from the shore inward: first the bay, then the market, then the traces of the older colonial streets, and finally the crater country further out on the peninsula. The order matters — the coast sets the terms here.

Zhanjiang faces the South China Sea with a working, tidal confidence. Port trade, volcanic geology, and seafood culture all stay visible within a single day.

![Zhanjiang](</uploads/cities/zhanjiang-hero-28e55b943348.jpg>)

![Zhanjiang gallery](</uploads/cities/zhanjiang-gallery-2-b21edfc2d133.jpg>)

## Huguangyan crater lake

Huguangyan is the signature geological stop of the Leizhou Peninsula: a maar lake formed by volcanic eruption, and now the region's most recognisable landscape.

![Huguangyan crater lake](</uploads/cities/zhanjiang-section-1-image-b21edfc2d133.jpg>)

> Before you taste the coast, Zhanjiang asks you to look at the crater that shaped its soil.

## Harbour rhythm

As the southernmost major port on mainland China's coast, Zhanjiang still moves to a maritime timetable. Prices, freshness, and the shape of a day all begin at the harbour edge.

![Harbour rhythm](</uploads/cities/zhanjiang-section-2-image-28e55b943348.jpg>)

> Here the market is not a backdrop. It is the city’s working pulse.

## Leizhou Peninsula terrain

The peninsula's black basalt soils and open shoreline give Zhanjiang a harsher, cleaner visual language than the Pearl River cities. Its beauty comes from exposure rather than polish, and it rarely looks like a place arranged for visitors.

> Zhanjiang never tries to look finished. That is part of why it feels real.

## The southern sea table

Zhanjiang's food culture starts with what the harbour lands at dawn and ends with how that catch is cooked, auctioned, shared, and remembered before the day is out.
```