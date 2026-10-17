# Shaoguan (`shaoguan`) — replacement copy

Source of truth for the current values: production `GET /api/v1/public/cities`
(fetched read-only 2026-09-19). Only the four text fields are replaced; slug,
region label, tags, and every image record stay exactly as they are.

## `heroNarrative`

```
Shaoguan opens a different chapter of Guangdong: red sandstone peaks, river valleys, and Chan Buddhist memory. This is the province's mountain threshold, not its coastal front room.
```

## `editorIntro`

```
Shaoguan teaches relief. If Guangzhou teaches speed and Chaozhou teaches repetition, the north gives you distance instead — rock, water, and monastery walls begin carrying the story, and the pace of the trip changes with them.
```

## `foodTitle` / `foodDescription`

```
Mountain pace, river appetite
```

```
Northern Guangdong cooking in Shaoguan leans on mountain greens, river fish, and preserved flavours, served at a slower table. The meal matches the terrain rather than the season's fashion.
```

## `contentMarkdown`

The first two paragraphs repeat `editorIntro` and then `heroNarrative`; the site
detects that (`isSummaryInArticle` in `CultureDetailClient.tsx`) and hides the
duplicate masthead deck. Keep the pairing exactly as it is here, or the masthead
will either lose its summary or show it twice.

Keep every `![...](</uploads/...>)` line byte-identical to the current value.

```
Shaoguan teaches relief. If Guangzhou teaches speed and Chaozhou teaches repetition, the north gives you distance instead — rock, water, and monastery walls begin carrying the story, and the pace of the trip changes with them.

Shaoguan opens a different chapter of Guangdong: red sandstone peaks, river valleys, and Chan Buddhist memory. This is the province's mountain threshold, not its coastal front room.

![Shaoguan](</uploads/cities/shaoguan-hero-3f58c0d642fa.jpg>)

![Shaoguan gallery](</uploads/cities/shaoguan-gallery-1-47ea919945eb.jpg>)

![Shaoguan gallery](</uploads/cities/shaoguan-gallery-2-b410c9bbeb77.jpg>)

## Mount Danxia

Mount Danxia was inscribed in 2010 as part of the China Danxia World Heritage Site. The red sandstone cliffs change the visual register of Guangdong at once: erosion becomes spectacle, and the province stops looking coastal.

![Mount Danxia](</uploads/cities/shaoguan-section-1-image-47ea919945eb.jpg>)

> In Shaoguan, the rock face tells the story before any guide begins to speak.

## Nanhua Temple

Nanhua Temple is closely associated with Huineng, the Sixth Patriarch of Chan Buddhism. It gives Shaoguan a philosophical weight rare on a route that is otherwise framed as scenery.

![Nanhua Temple](</uploads/cities/shaoguan-section-2-image-b410c9bbeb77.jpg>)

> The mountain route pauses differently once a monastery enters the frame.

## Northern river gateway

Shaoguan's position between Guangdong, Hunan, and Jiangxi made it a passage city long before modern highways existed. River and mountain corridors still define its practical geography, and most journeys through it are still journeys onward.

![Northern river gateway](</uploads/cities/shaoguan-section-3-image-3f58c0d642fa.jpg>)

> Shaoguan is less about arrival than passage, and that is exactly its character.

## Mountain pace, river appetite

Northern Guangdong cooking in Shaoguan leans on mountain greens, river fish, and preserved flavours, served at a slower table. The meal matches the terrain rather than the season's fashion.
```