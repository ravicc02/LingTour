# Guangzhou (`guangzhou`) — replacement copy

Source of truth for the current values: production `GET /api/v1/public/cities`
(fetched read-only 2026-09-19). Only the four text fields are replaced; slug,
region label, tags, and every image record stay exactly as they are.

## `heroNarrative`

```
Guangzhou is a trading port that never stopped improvising: arcade shade, clan halls, tea rooms, and wholesale lanes still share one working script along the Pearl River.
```

## `editorIntro`

```
Enter Guangzhou in sequence rather than by checklist — tea first, then shade, then a market lane, then the river after dark. The city keeps its own tempo, and it is easier to follow it than to argue with it.
```

## `foodTitle` / `foodDescription`

```
Beyond dim sum
```

```
Canton food culture runs from morning tea rooms to roast shops and produce markets. For a visitor, appetite is the fastest way to read how this city organises its day.
```

## `contentMarkdown`

The first two paragraphs repeat `editorIntro` and then `heroNarrative`; the site
detects that (`isSummaryInArticle` in `CultureDetailClient.tsx`) and hides the
duplicate masthead deck. Keep the pairing exactly as it is here, or the masthead
will either lose its summary or show it twice.

Keep every `![...](</uploads/...>)` line byte-identical to the current value —
the image records are the published media, and the body is the only place that
references the section images.

```
Enter Guangzhou in sequence rather than by checklist — tea first, then shade, then a market lane, then the river after dark. The city keeps its own tempo, and it is easier to follow it than to argue with it.

Guangzhou is a trading port that never stopped improvising: arcade shade, clan halls, tea rooms, and wholesale lanes still share one working script along the Pearl River.

![Guangzhou](</uploads/cities/guangzhou-hero-1db39c6a8ee9.jpg>)

![Guangzhou gallery](</uploads/cities/guangzhou-gallery-1-ae205c0b255d.jpg>)

![Guangzhou gallery](</uploads/cities/guangzhou-gallery-3-e80b22031bbf.jpg>)

## Arcade streets

The qilou arcades of old Guangzhou solve three problems in one structure: sun, rain, and the need to trade in both. Walking them in the middle of a wet afternoon explains more about the city's commercial temperament than any museum label, because the buildings were never decoration — they were the working envelope of a street economy.

> Guangzhou is a city that learned to sell, shelter, and stroll in the same gesture.

## Clan halls and craft memory

The Chen Clan Ancestral Hall was completed in 1894 and now holds the Guangdong Folk Art Museum. Its carved timber, ceramics, and ironwork record how family patronage paid for craft in late Qing Guangzhou, and how many hands it took to make one building speak for a lineage.

![Clan halls and craft memory](</uploads/cities/guangzhou-section-2-image-48bc91820edf.jpg>)

> In Guangzhou, the archive was never only on paper. It also survived in brick, timber, and ornament.

## Port light on the Pearl River

Guangzhou has more than 2,200 years of urban history and long served as a southern terminus of maritime exchange. The riverfront is where that long commercial memory still feels physical: cargo, passengers, and evening light all arrive at the same edge of the city.

![Port light on the Pearl River](</uploads/cities/guangzhou-section-3-image-3d73ba30dca9.jpg>)

![Port light on the Pearl River](</uploads/cities/guangzhou-section-3-breath-1db39c6a8ee9.jpg>)

> When the light comes on over the Pearl River, Guangzhou still looks like a place built to meet arrivals.

## Beyond dim sum

Canton food culture moves from morning tea rooms to roast shops and produce markets. Appetite is one of the clearest ways to read the city — and the cheapest way to understand what it does with everything it imports.

![Beyond Dim Sum](</uploads/cities/guangzhou-food-1-830c2b7ea2f8.jpg>)
```