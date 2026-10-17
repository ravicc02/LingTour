# Culvoy Responsive Design Specification

Unified responsive system for both the admin panel and public site.

---

## Breakpoints

| Name | Min-width | Target                        |
|------|-----------|-------------------------------|
| base | 0         | Mobile portrait (375px)       |
| sm   | 640px     | Large phone                   |
| md   | 768px     | Tablet portrait               |
| lg   | 1024px    | Tablet landscape / sm desktop |
| xl   | 1280px    | Desktop                       |

All breakpoints are `min-width` (mobile-first). Use Tailwind prefixes: `sm:`, `md:`, `lg:`, `xl:`.

---

## Spacing Scale

| Device  | Values            |
|---------|-------------------|
| Mobile  | 4 / 8 / 12 / 16px |
| Tablet  | 8 / 12 / 16 / 24px |
| Desktop | 8 / 16 / 24 / 32px |

Implementation:

```
padding: 12px;          /* mobile default */
@media (min-width: 768px) { padding: 16px; }   /* md */
@media (min-width: 1024px) { padding: 24px; }  /* lg */
```

Or Tailwind: `p-3 md:p-4 lg:p-6`. Note: Tailwind 4 removed the v2/v3 `@screen` directive — use standard media queries or responsive variants.

---

## Typography Scale

| Device  | Base font size |
|---------|----------------|
| Mobile  | 16px           |
| Tablet  | 15px           |
| Desktop | 16px           |

The 16px mobile base is a hard floor: iOS Safari auto-zooms focused inputs smaller than 16px, and 2026-09-16 browser measurement confirmed site form controls render at 16px. The former 14px figure is obsolete.

Headings scale proportionally. Use Tailwind responsive prefixes:

```html
<h1 class="text-2xl md:text-3xl lg:text-4xl">Title</h1>
<p class="text-base">Body</p>
```

---

## Grid System

| Device  | Columns | Gap  | Notes                              |
|---------|---------|------|------------------------------------|
| Mobile  | 1       | 12px | Full-width stack                   |
| Tablet  | 2       | 16px | Content + sidebar collapses        |
| Desktop | 2       | 24px | Form + preview (admin), 3-col grid (site) |

```html
<!-- Site grid -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-6">

<!-- Admin form + preview -->
<div class="flex flex-col lg:flex-row gap-3 md:gap-4 lg:gap-6">
```

---

## Component Rules

### Buttons

- **Minimum touch target: 44 x 44px** (WCAG / Apple HIG)
- Use `min-h-[44px] min-w-[44px]` or ensure padding meets the threshold
- Icon-only buttons must have `aria-label`

### Inputs

- **font-size >= 16px on mobile** — prevents iOS Safari auto-zoom on focus
- Use `text-base` (16px) as the minimum for all `<input>`, `<select>`, `<textarea>`
- On desktop, can reduce to `text-sm` (14px)

### Horizontal Scroll Tracks

- Horizontal scroll-snap tracks (route cards, event carousels, filmstrips) are an established pattern: `overflow-x-auto` with `snap-x snap-mandatory` and consistent item padding
- A scrollable track must have a visible affordance (dots, arrows, or edge fade) — a track with no visible scroll hint fails mobile review
- Filter/chip rows may scroll freely without snap

### Tables

- Wrap in `<div class="overflow-x-auto">` on mobile
- Set `min-width` on `<table>` to prevent column crush
- Consider card layout for complex tables on small screens

### Dialogs / Modals

- Mobile: `w-[95%] max-w-lg` — nearly full width with small gutter
- Tablet+: `max-w-xl` or `max-w-2xl`
- Use `max-h-[90vh] overflow-y-auto` for long content

### Drawers / Panels

- Mobile: `w-full` — full width overlay
- Tablet+: `w-96` or `w-[400px]` — side panel

### Images

- Always: `max-width: 100%; height: auto;`
- Use `aspect-ratio` or Tailwind `aspect-video` / `aspect-square` for fixed-ratio containers
- Provide `sizes` attribute for responsive images:
  ```html
  <img sizes="(max-width: 768px) 100vw, 50vw" ... />
  ```

---

## Admin Panel Specific

### Sidebar Navigation

| Breakpoint | Behavior                     |
|------------|------------------------------|
| < md       | Overlay drawer (hamburger)   |
| >= md      | Persistent sidebar (collapsible) |

Implementation: sidebar is `position: fixed` on mobile with backdrop overlay. On `md+`, it's a normal flow element.

### Editor / Form Pages

- **Mobile**: single column layout. Preview hidden by default, accessible via toggle button.
- **Tablet**: single column, preview in collapsible panel below.
- **Desktop**: side-by-side — form left, preview right.

```html
<div class="flex flex-col lg:flex-row gap-4">
  <div class="flex-1 min-w-0"><!-- form --></div>
  <div class="hidden lg:block lg:w-1/2"><!-- preview --></div>
</div>
```

### List / Table Toolbars

- **Mobile**: vertical stack — search on top, filters below, action buttons at bottom.
- **Tablet+**: horizontal row — search and filters side by side.

```html
<div class="flex flex-col md:flex-row gap-3">
  <input class="flex-1" placeholder="Search..." />
  <div class="flex gap-2">
    <select>...</select>
    <button>Action</button>
  </div>
</div>
```

### Pagination

- **Mobile**: simplified — prev/next + current page only. Hide page sizes and jump-to-page.
- **Tablet+**: full pagination with page sizes selector.

```html
<!-- Mobile -->
<div class="flex md:hidden gap-2">
  <button>Prev</button>
  <span>Page 1 of 5</span>
  <button>Next</button>
</div>
<!-- Desktop -->
<div class="hidden md:flex gap-2 items-center">
  <!-- full pagination controls -->
</div>
```

---

## Public Site Specific

### Typography

Use responsive Tailwind prefixes for all heading and body text:

```html
<!-- Hero -->
<h1 class="text-5xl md:text-7xl lg:text-9xl font-bold">Culvoy</h1>

<!-- Section title -->
<h2 class="text-2xl md:text-3xl lg:text-4xl">Explore Culture</h2>

<!-- Body -->
<p class="text-sm md:text-base lg:text-lg leading-relaxed">
  Discover the stories behind every journey.
</p>
```

### Content Grids

Mobile-first responsive grid:

```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
  <!-- cards -->
</div>
```

### Hero Sections

- **Mobile**: full-height viewport, centered text, single CTA
- **Tablet**: taller with side content
- **Desktop**: wide layout with multiple CTAs

```html
<section class="min-h-[60vh] md:min-h-[70vh] lg:min-h-screen flex items-center">
  <h1 class="text-5xl md:text-7xl lg:text-9xl">Title</h1>
</section>
```

### Cards

- **Mobile**: full-width, stacked content, no hover effects
- **Tablet+**: grid layout, hover effects enabled

Disable hover on touch devices:

```css
@media (hover: hover) {
  .card:hover {
    transform: translateY(-2px);
    box-shadow: ...;
  }
}
```

Or Tailwind: `hover:md:shadow-lg` (requires custom config or `@media (hover: hover)` wrapper).

### Navigation

| Breakpoint | Behavior                          |
|------------|-----------------------------------|
| < md       | Hamburger menu, full-width header dropdown panel (implemented 2026-09; a full-screen overlay is not required) |
| >= md      | Horizontal nav bar                |

---

## Testing Checklist

Validate responsive changes in a real browser first (the browser-verification rules in AGENTS.md). The scripts below are supplemental only: they cover a subset of viewports, may require undeclared Puppeteer dependencies, and write temporary reports/screenshots that must not be committed.

```bash
node tools/mobile-verify.mjs   # supplemental mobile checks
node tools/mobile-perf.mjs     # supplemental performance analysis
```

Manual checks:

- [ ] No horizontal scroll on any page at 375px
- [ ] All interactive elements >= 44px touch target
- [ ] No iOS zoom on input focus (font-size >= 16px)
- [ ] Tables scroll horizontally on mobile
- [ ] Dialogs are 95% width on mobile
- [ ] Images don't overflow their containers
- [ ] Sidebar is overlay drawer on mobile
- [ ] Pagination is simplified on mobile
- [ ] Hero text scales across all breakpoints
- [ ] No hover effects on touch devices

---

## Reference Viewports

| Device             | Width  | Height | Scale |
|--------------------|--------|--------|-------|
| Compact phone      | 320    | 568    | 2x    |
| iPhone SE          | 375    | 667    | 2x    |
| iPhone 12/13/14    | 390    | 844    | 3x    |
| iPhone 14 Pro Max  | 430    | 932    | 3x    |
| iPad Mini          | 768    | 1024   | 2x    |
| iPad Pro 11"       | 834    | 1194   | 2x    |
| MacBook Air 13"    | 1280   | 800    | 2x    |
| Large laptop       | 1440   | 900    | 2x    |
| 1080p Monitor      | 1920   | 1080   | 1x    |
