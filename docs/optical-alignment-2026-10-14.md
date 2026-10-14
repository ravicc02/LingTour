# Optical Alignment Pass - 2026-10-14

## Scope and design read

This is a preservation-mode alignment pass, not a redesign. The public site retains the Field Journal / Living Field Atlas palette, Georgia / Trebuchet typography, real content, intentional image rotations and narrative motion. The admin retains Element Plus, Chinese operational labels, existing themes and workflows.

The source inventory covered all public page families (Home, Culture list/detail, Routes list/detail, Interpreting, Shop/catalogue/product detail, Checkout/success, Community, Login/password reset/Profile, preview and error states) and all admin route families. Surfaces without a demonstrated source issue were not changed just to increase the file count.

## Implemented corrections

### Public shell and shared controls

- One 76px header-height token now drives the navigation row, mega-menu top edge, mobile overlay bounds and Community/Profile sticky rails. Checkout empty/loading and Interpreting hero viewport calculations use the same token. Navigation links have consistent hit areas; desktop actions do not shrink or wrap independently of their labels.
- The mobile menu's outer strokes travel the actual 7px center distance (1px stroke + 6px gap), so the close icon forms a single intersection rather than two offset diagonals.
- Tablet containers use 24px gutters, between the existing 16px mobile and 40px desktop gutters. Mobile safe-area insets use their respective left/right values.
- Shared button layout defaults live in the components cascade layer, preserving explicit Tailwind layout overrides. Inline CTA links now have a real centered control box; SVGs do not shrink beside labels.
- Archive-filter labels center against the first filter row on larger screens, without carrying desktop top padding into mobile stacks.
- Footer grid columns can shrink safely; the contact address can wrap at compact widths.
- The mobile icon-only favorite button retains an accessible name in both saved states.

### Public page families

- Route cards propagate full row height through their link wrappers.
- Community cards propagate height through opt-in Reveal wrappers. Brief/dispatch actions sit at the bottom of their flex columns; text-post gutters account for action hit-area padding.
- Community search and segmented-sort controls share their outer height.
- Interpreter cards propagate height through their content panels and anchor the request action consistently.
- Interpreting rate headings and body rows use the same horizontal coordinate system.
- Booking date controls share the ordinary field shell. Calendar weekdays and day cells use the same tracks/gaps, with shrink-safe day widths and a 44px vertical target.
- Product specimen metadata and action are stacked with an explicit gap where the narrow tag cannot support a single row.
- Checkout total label and amount share a baseline; the supporting note is separate.
- Profile email-code actions match adjacent field heights.
- A lone Next city link stays at the trailing edge.

### Admin

- Shared shell gutters and header-control boxes are tokenized; dark-mode content width matches light mode.
- Element Plus input, select, number, date-range, button and pagination sizes are coordinated, while desktop small/link variants remain compact. Mobile controls retain larger touch targets.
- Pagination footers own their spacing and width rather than using viewport-derived widths and an additional child top margin. Mobile pagination shows previous/current/next, avoiding seven 44px page buttons in a narrow card.
- Header copy and actions are grouped deliberately; mixed table actions use an explicit gap container.
- Product/route/event editor columns collapse through Element Plus responsive props. Tag-entry grids use one field plus one intrinsic action track.
- Staff rows switch based on available container width, not viewport width; desktop action headings align with their controls.
- Email source/preview panes share header row geometry. Editor shells and header layout collapse at 1023px; the existing 960px preview-hide/button breakpoint is retained because several legacy callers have no drawer handler.
- Settings save-bar bounds follow the actual content container.

## Verification status

This document records source changes, not a completed optical browser acceptance.

- Final site validation passed: TypeScript, ESLint (0 errors; 1083 existing warnings), 21 test files / 111 tests, and the Next.js production build.
- Final admin `vue-tsc -b` and Vite production build passed (4,660 modules), retaining the existing large vendor-chunk warning. All 26 changed Vue business scripts remain unchanged against HEAD. Final `git diff --check` passed.
- Regression coverage includes menu close-stroke intersection, next-only city navigation, shared date-field sizing, calendar track geometry/selection, and accessible favorite names in both saved states.
- Final source review identified and corrected three responsive regressions before handoff: missing previews at 961-1023px, the tablet-gutter cascade override, and seven-item mobile-pager overflow. Builds and whitespace checks were rerun after these corrections.
- Browser preview startup repeatedly returned: `claude-opus-5[1m] is temporarily unavailable, so auto mode cannot determine the safety of mcp__Claude_Browser__preview_start right now.` No server was started through another tool and no permission mode was changed to work around it.
- Therefore no screenshots, browser-measured glyph offsets, nine-width responsive acceptance, authenticated admin flows or final optical sign-off are claimed.
- Existing black values used in scroll masks are opacity-mask data, not visible palette drift. Existing colored button shadows were preserved; this pass does not recalibrate brand colors.

## Repository and data boundaries

Source edits are isolated in `claude/heuristic-ritchie-84e6bd`. On the owner's commit request, matching admin changes were committed first in the independent repository as `647147f` on `fix/optical-alignment-2026-10-14`. A separate index preserved its original `main` checkout and index. The root optical-alignment commit includes byte-equivalent admin blobs. Neither branch is integrated into `main` or pushed.

The owner authorized local commits only. No push, migration, deployment, production content mutation, account creation, payment or Feishu write was performed. Existing host services and original-checkout reference/WIP files were not replaced. An ignored Docker-only preview configuration uses isolated ports 3100 / 5273; it has not started because the preview tool is unavailable.
