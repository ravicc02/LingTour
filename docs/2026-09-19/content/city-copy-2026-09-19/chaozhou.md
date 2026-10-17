# Chaozhou (`chaozhou`) — replacement copy

Source of truth for the current values: production `GET /api/v1/public/cities`
(fetched read-only 2026-09-19). Only the four text fields are replaced; slug,
region label, tags, and every image record stay exactly as they are.

## `heroNarrative`

```
In Chaozhou the old city, the river bridge, tea practice, and family kitchens all stay legible at street level. Nothing is behind glass; it is being used, daily.
```

## `editorIntro`

```
Chaozhou does not perform its heritage for the camera. It keeps working it — brewing tea, crossing the Han River, setting out braised goose, reopening the shutters after lunch. Stay long enough to repeat one of those gestures and the city starts to make sense.
```

## `foodTitle` / `foodDescription`

```
Tea first, then the table
```

```
Teochew cooking is admired for clarity and knife work as much as for flavour. The meal and the tea session belong to the same social grammar, and neither is rushed.
```

## `contentMarkdown`

The first two paragraphs repeat `editorIntro` and then `heroNarrative`; the site
detects that (`isSummaryInArticle` in `CultureDetailClient.tsx`) and hides the
duplicate masthead deck. Keep the pairing exactly as it is here, or the masthead
will either lose its summary or show it twice.

Keep every `![...](</uploads/...>)` line byte-identical to the current value.

```
Chaozhou does not perform its heritage for the camera. It keeps working it — brewing tea, crossing the Han River, setting out braised goose, reopening the shutters after lunch. Stay long enough to repeat one of those gestures and the city starts to make sense.

In Chaozhou the old city, the river bridge, tea practice, and family kitchens all stay legible at street level. Nothing is behind glass; it is being used, daily.

![Chaozhou](</uploads/cities/chaozhou-hero-19f0236e9da7.jpg>)

![Chaozhou gallery](</uploads/cities/chaozhou-gallery-2-6a762e2ce27e.jpg>)

![Chaozhou gallery](</uploads/cities/chaozhou-gallery-3-b70e1b312481.jpg>)

## Guangji Bridge

Guangji Bridge is one of China's four famous ancient bridges, and it is still the quickest way to understand how much this city trusts engineering and exchange. Crossing the Han River here was always a cultural act as much as a practical one.

![Guangji Bridge](</uploads/cities/chaozhou-section-1-image-6a762e2ce27e.jpg>)

> The bridge is a moving threshold: part monument, part infrastructure, part city memory.

## Gongfu tea

Gongfu tea is not a staged ceremony in Chaozhou but a daily method, repeated until it becomes second nature. The precision of vessel, water, and pacing gives ordinary conversation its architecture.

![Gongfu tea](</uploads/cities/chaozhou-section-2-image-b70e1b312481.jpg>)

> A Chaozhou afternoon is often measured not by the clock but by how many pours are left in the pot.

## Old city after lunch

Paifang Street and the surrounding blocks show how the old city holds commerce, family life, and visitors in a delicate balance. Even when it is busiest, the scale stays human.

![Old city after lunch](</uploads/cities/chaozhou-section-3-image-19f0236e9da7.jpg>)

> In Chaozhou the archive is not behind glass. It is still open for business.

## Tea first, then the table

Teochew cooking is admired for clarity and knife work as much as for flavour. The meal and the tea session belong to the same social grammar, and neither is rushed.
```