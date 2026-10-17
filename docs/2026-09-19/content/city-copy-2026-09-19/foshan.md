# Foshan (`foshan`) — replacement copy

Source of truth for the current values: production `GET /api/v1/public/cities`
(fetched read-only 2026-09-19). Only the four text fields are replaced; slug,
region label, tags, and every image record stay exactly as they are.

## `heroNarrative`

```
In Foshan, temple ritual, martial lineages, kiln ceramics, and manufacturing share the same urban grain. The city still feels handmade even where the scale turns industrial.
```

## `editorIntro`

```
Read Foshan through its materials — clay, glaze, timber, temple stone — and then through the table of neighbouring Shunde. This has always been a workshop as much as a market, and the two are hard to separate.
```

## `foodTitle` / `foodDescription`

```
Workshop city, table city
```

```
Foshan sits beside Shunde, one of Guangdong's strongest food traditions. Clay, metal, and cooking all carry the same local preference: precision, held quietly, without display.
```

## `contentMarkdown`

The first two paragraphs repeat `editorIntro` and then `heroNarrative`; the site
detects that (`isSummaryInArticle` in `CultureDetailClient.tsx`) and hides the
duplicate masthead deck. Keep the pairing exactly as it is here, or the masthead
will either lose its summary or show it twice.

Keep every `![...](</uploads/...>)` line byte-identical to the current value.

```
Read Foshan through its materials — clay, glaze, timber, temple stone — and then through the table of neighbouring Shunde. This has always been a workshop as much as a market, and the two are hard to separate.

In Foshan, temple ritual, martial lineages, kiln ceramics, and manufacturing share the same urban grain. The city still feels handmade even where the scale turns industrial.

![Foshan](</uploads/cities/foshan-hero-f2f20fb692ed.jpg>)

![Foshan gallery](</uploads/cities/foshan-gallery-2-807634cd1d90.jpg>)

![Foshan gallery](</uploads/cities/foshan-gallery-3-90229fce3a0f.jpg>)

## Zumiao and public ritual

Foshan Ancestral Temple remains the city's most concentrated lesson in local ritual life. Temple fairs, lion dance, and martial memory keep gathering around it, and the surrounding streets still organise themselves on that calendar.

![Zumiao and public ritual](</uploads/cities/foshan-section-1-image-744bec842bb8.jpg>)

![Zumiao and public ritual](</uploads/cities/foshan-section-1-breath-f2f20fb692ed.jpg>)

> Foshan never separated craftsmanship from ceremony; both still occupy the same street.

## Nanfeng Kiln

Nanfeng Kiln was built in the Zhengde period of the Ming dynasty and has fired Shiwan ware for more than five centuries. Few places in Guangdong make continuity feel this literal — the heat is not a re-enactment, it is the working method.

![Nanfeng Kiln](</uploads/cities/foshan-section-2-image-807634cd1d90.jpg>)

> The kiln explains Foshan better than a slogan does: heat, repetition, and patient control.

## Bridge crossings and city texture

Tongji Bridge and the lanes around it belong to the river town that existed here long before the factories. Foshan's texture still comes from crossing water, then market lanes, then temple frontage, in close sequence.

![Bridge crossings and city texture](</uploads/cities/foshan-section-3-image-90229fce3a0f.jpg>)

> In Foshan, movement still follows waterways even when the factories are already on the horizon.

## Workshop city, table city

Foshan sits beside Shunde, one of Guangdong's strongest food traditions. Clay, metal, and cooking all carry the same local preference: precision, held quietly, without display.

![Workshop City, Table City](</uploads/cities/foshan-food-1-744bec842bb8.jpg>)
```