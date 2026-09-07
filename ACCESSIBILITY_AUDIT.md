# Accessibility Audit — Evoluciona Provider Portal

**Audit date:** 2026-08-07 · **Standard:** WCAG 2.1 Level A / AA
**Method:** axe-core 4.10.2 injected into a live Chrome session via agent-browser, run against
`npm run dev` on all 11 routes at 1440×900 and 393×852, plus scripted keyboard/focus/interaction
tests for states axe cannot reach on a static page (request drawer open, programs dropdown,
typeahead results, mobile menu, FAQ and product accordions, failed form submission).
**Scripts:** `/private/tmp/claude-502/.../scratchpad/{a11y,drawer,nav,kbd,forms,clickables}.sh`
(scratch only — nothing was added to the repo by this audit).

---

## Verdict

**The portal does not currently meet WCAG 2.1 AA, and it is not usable by keyboard alone.**

Three of the four core provider tasks are unreachable without a mouse: filtering the catalog,
choosing a vial presentation, and reading any FAQ or product-detail answer. Separately, no form
field in the 4-step request wizard has a programmatic label, so a screen-reader user hears
"edit text, blank" on every field of the only conversion flow in the product.

These are all fixable in markup — none require redesign, and the visual design does not change for
any of the keyboard/semantics fixes. Only the contrast fixes alter pixels.

| Severity | Count | Theme |
| --- | --- | --- |
| 🔴 Blocker | 2 | Keyboard-inaccessible controls; unlabelled form fields |
| 🟠 Serious | 4 | Drawer not a dialog; colour contrast; missing focus indicators; `aria-hidden` trap |
| 🟡 Moderate | 6 | Missing `h1`; silent validation errors; typeahead/menu ARIA; tap targets; landmarks |
| ✅ Passing | 10 | Alt text, lang, landmarks, reduced motion, Escape handling, icon labels |

---

## 🔴 Blockers

### B1 — Core controls are `<div onClick>` and cannot be reached by keyboard

Measured count of pointer-cursor elements with no keyboard path: **/shop 44, /products/nad 26,
/faq/orders-shipping 9**. Verified that the FAQ question rows report `tabIndex = -1` and that
tabbing through the FAQ page never lands on one.

| What breaks | Where |
| --- | --- |
| **Every shop filter** (6 programs + 3 presentation facets) | `components/shop/ShopPage.tsx:58` |
| **Every FAQ answer** — all 19 questions across 6 topics | `components/faq/FaqPage.tsx:101` |
| **Presentation selector** (5 mL / 10 mL) | `components/product/ProductPage.tsx:149` |
| **Product accordions** (Description, How it's supplied, Provider requirements, Product FAQ) | `components/product/ProductPage.tsx:202` |
| Gallery thumbnails | `components/product/ProductPage.tsx:105` |
| "Clear all" filters | `components/shop/ShopPage.tsx:226` |
| Clear-search control | `components/EvoShopNav.tsx:289` |
| **Provider attestation checkbox** — blocks submission entirely | `app/request/additional/page.tsx:70` ✅ fixed |

> **Correction (2026-08-07, added during Phase 1).** The attestation row was missed by the original
> sweep: `/request/additional` was never scanned, and `/request/profile`'s score of 0 was an
> empty-state artifact (its `span onClick` tokens only render once the request list is non-empty).
> The attestation was a `<label>` containing **no input at all**, so it sat outside the tab order —
> and because `submit()` returns early without it, **a keyboard-only provider could not submit a
> request at all.** Tab order was: textarea → select → Back → Submit request. Fixed in Phase 1.
>
> The scan itself also needed refining: it flags any pointer-cursor element that is not focusable,
> which counts a correct `<label>` + visually-hidden `<input>` as 5 false positives. Exclude
> `LABEL` and `.closest('label')` when re-measuring, or Phase 2 will look like it regressed.

**Fails:** 2.1.1 Keyboard (A), 4.1.2 Name/Role/Value (A).

**Fix:** change the element to `<button type="button">` and reset the UA styling
(`border-none bg-transparent p-0 text-left`). For the two accordions add `aria-expanded={isOpen}`
and `aria-controls`; for the facets use a real `<input type="checkbox">` visually hidden behind the
existing custom tick, or `role="checkbox"` + `aria-checked`; for the presentation chips use
`role="radiogroup"` with `aria-checked`. No visual change.

### B2 — No form field in the request wizard has a programmatic label

`components/request/fields.tsx:37` (`TextField`) and `:72` (`SelectField`) render the label as a
`<span>` sibling, not a `<label htmlFor>`. Verified across every field: `id`, `name`, `aria-label`,
`aria-labelledby` are all null, and none is wrapped in a `<label>`.

axe: **`label` (critical)** — 3 nodes on `/request/contact`, 4 on `/request/practice`;
**`select-name` (critical)** — 1 node on each of the four wizard steps.

Affected: Name, Role, Email, Phone, License / NPI number, Licensed state, and every field on
practice/profile/additional.

**Fails:** 1.3.1 Info and Relationships (A), 3.3.2 Labels or Instructions (A), 4.1.2 (A).

**Fix:** give each field a generated `id` (e.g. `useId()`), turn the `<span>` into
`<label htmlFor={id}>`, and add `name` for autofill. Purely structural — the rendered design is
identical.

---

## 🟠 Serious

### S1 — The request drawer is not exposed as a dialog

`components/RequestDrawer.tsx:110`. Measured with the drawer open on `/products/nad`:

| Check | Result |
| --- | --- |
| `role="dialog"` / `aria-modal` / `aria-labelledby` | all absent |
| Focus on open | stays on the "Add to Request List" button — never enters the drawer |
| Focus trap | none — **33** focusable elements behind the drawer remain tabbable |
| Body scroll lock | none (`body { overflow: visible }`) |
| Escape to close | ✅ works (`RequestDrawer.tsx:74`) |
| Focus restored on close | ✅ returns to the trigger |
| Overlay | `<div>` with `onClick` — not keyboard reachable (Escape covers it) |
| "Added to request list" announcement | none; the nav badge (`EvoShopNav.tsx:389`) has no live region |

For a screen-reader user, pressing "Add to Request List" produces no perceptible feedback at all.

**Fails:** 4.1.2 (A), 2.4.3 Focus Order (A), 4.1.3 Status Messages (AA).

**Fix:** `role="dialog" aria-modal="true" aria-labelledby={headingId}` on the panel, move focus to
the close button on open, trap Tab within the panel, set `overflow: hidden` on `<body>` while open,
and add an `aria-live="polite"` region announcing the new item count.

### S2 — Five colour tokens fail AA contrast ✅ fixed 2026-08-07

> **Correction.** It was **six**, plus one hardcoded hex. `muted.DEFAULT` (`#6B7380`) scores
> 4.46:1 on `surface.alt` — under the floor, but axe never flagged it because on the pages sampled
> it happened to render on white (4.62:1). The ratios below were also measured only where axe
> found text; solving against every background each token actually appears on gave different
> replacement values. See `ACCESSIBILITY_FIX_PLAN.md` §5 for what shipped.

Measured ratios from axe (not estimated). All are token-level, so each fix is one line in
`tailwind.config.ts` and propagates everywhere.

| Token | Hex | On | Measured | Needs | Used for |
| --- | --- | --- | --- | --- | --- |
| `muted.3` | `#9BA5B7` | white | **2.33–2.48:1** | 4.5:1 | Placeholder text, counts, upcoming step labels |
| `footer.label` | `#5E6B83` | navy `#14253F` | **2.85:1** | 4.5:1 | Footer column headings (all pages) |
| `muted.2` | `#8C93A0` | white | **2.87–3.08:1** | 4.5:1 | Card meta, breadcrumbs, spec lines — the most-used muted token |
| `footer.legal` | `#6B7890` | navy | **3.45:1** | 4.5:1 | Footer legal / compliance copy |
| `teal.DEFAULT` | `#1B8B8A` | white | **4.11:1** | 4.5:1 | Product status chips at 11px |

Defined at `tailwind.config.ts:30, 31, 53, 73, 74`. Violation volume: 13 nodes on `/`, 17 on
`/shop`, 11 on `/products/nad`, 8 on `/request/confirmation`.

Note the compliance angle: `footer.legal` at 3.45:1 is the legally-reviewed disclaimer text — the
copy most likely to matter in a regulated context is among the hardest to read.

**Fails:** 1.4.3 Contrast (Minimum) (AA).

**Fix (suggested, preserves the greys' character):** `muted.2 → #6B7380` (already the `muted`
token, 4.9:1), `muted.3 → #767E8C`, `footer.label → #8C97AD`, `footer.legal → #98A3B8`,
`teal → #16736F`. Worth a designer's eye before merging.

### S3 — Text inputs have no visible focus indicator

`outline-none` in Tailwind is `outline: 2px solid transparent`, so the outline exists but is
invisible. Verified on the nav search input: on focus the wrapper border stays `#D9DEE5` and the
outline colour is `rgba(0,0,0,0)` — **no visual change whatsoever**.

| Input | Focus indicator |
| --- | --- |
| Nav search (desktop `EvoShopNav.tsx:285`, mobile `:439`) | ❌ none |
| Footer newsletter (`EvoShopFooter.tsx:31`) | ❌ none |
| Profile-page token input (`app/request/profile/page.tsx:96`) | ❌ none |
| Wizard text/select fields (`fields.tsx`) | ✅ wrapper border → brand `#14258F` via `focus-within` |
| Links and buttons everywhere | ✅ UA default ring preserved (no global outline reset) |

**Fails:** 2.4.7 Focus Visible (AA).

**Fix:** add `focus-within:border-brand` to the three wrapper elements, matching the pattern
`fields.tsx` already uses. (Minor aside: `focus-within:border-[1.5px]` in `fieldBorder()` does not
take effect — the computed width stays 1px.)

### S4 — `aria-hidden` container holds a focusable button

`components/home-alt/StickyRequestBar.tsx:25` sets `aria-hidden={!shown}` on a container whose
"Add to Request List" button stays in the tab order. `pointerEvents: none` blocks the mouse but not
Tab, so keyboard users can focus a button that assistive tech has been told does not exist.

axe: **`aria-hidden-focus` (serious)** on `/index-alt` at both viewports.

**Fails:** 4.1.2 (A).

**Fix:** add `inert` to the container when hidden, or `tabIndex={shown ? 0 : -1}` on the button.

---

## 🟡 Moderate

### M1 — Eight of eleven routes have no `<h1>`

Only `/shop`, `/faq/*`, and `/index-alt` have one. `/` has zero (3 × `h2`, 4 × `h3`); every product
page and all five wizard routes start at `h2`. axe: `page-has-heading-one` on 8 routes.
**Fix:** promote the top heading on each page — `ProductPage` product name, wizard step titles,
`/request/confirmation` "Request received", and the home hero headline.

### M2 — Validation errors are announced to nobody

After submitting an empty step 1: `ErrorBanner` (`fields.tsx:106`) is a plain `<div>` with no
`role="alert"`; **0** live regions on the page; **0** fields carry `aria-invalid`; the four inline
error messages have no `aria-describedby` link to their field; focus stays on the Continue button.
A screen-reader user gets no signal that submission failed.
**Fails:** 3.3.1 Error Identification (A), 4.1.3 Status Messages (AA).
**Fix:** `role="alert"` on the banner, `aria-invalid` + `aria-describedby={errorId}` on failing
fields, and move focus to the banner or the first invalid field on submit.

### M3 — The typeahead is not a combobox

`EvoShopNav.tsx:257`. Measured: `role`, `aria-expanded`, `aria-controls`, `aria-activedescendant`,
`aria-autocomplete` all null; 0 elements with `role="listbox"` or `role="option"`; 0 live regions.
ArrowDown moves the visual highlight and announces nothing. The mechanics are correct — only the
ARIA is missing.
**Fix:** apply the APG combobox pattern — `role="combobox" aria-expanded aria-controls
aria-autocomplete="list"` on the input, `role="listbox"`/`role="option"` on results, and
`aria-activedescendant` following the existing `hi` highlight index.

### M4 — Programs dropdown has no state exposed

`EvoShopNav.tsx:197`: no `aria-expanded`, `aria-haspopup`, or `aria-controls`; the panel has no
`role="menu"`. Escape does close it. The mobile hamburger (`:404`) is the counter-example done
right — it has both `aria-expanded` and a toggling `aria-label`; mirror it here.

### M5 — Tap targets below the minimum on phones

At 393px, per route: **8–12** interactive elements under 24×24 (WCAG 2.5.8 AA), **17–23** under
44×44. Worst offenders: footer links 157×20, breadcrumb "Home" 36×16, product cross-links 165×21,
"Contact support →" 308×20. This is item 13 of `MOBILE_FIX_PLAN.md` Phase 4, still open.
**Fix:** vertical padding on link lists — `py-2.5` on footer/breadcrumb/inline links.

### M6 — No skip link; some content sits outside landmarks

No skip-to-content link on any route (33 tab stops to cross the header before reaching product
content). axe `region` reports 17 nodes outside a landmark on the product page.
**Fix:** a visually-hidden skip link in `AppShell.tsx` targeting `<main>`, and wrap page sections in
`<section>` with accessible names.

---

## ✅ What already passes

Worth recording, because several of these are commonly missed:

- **Alt text is complete and meaningful** — 14/14 images, 0 missing, 0 empty. "NAD+ sterile vial",
  "Provider reviewing a treatment plan with a patient in a clinic". No decorative-image noise.
- `<html lang="en">` set correctly.
- Exactly one `<main>`, `<nav>`, `<header>`, `<footer>` per page.
- **`prefers-reduced-motion` is honoured** — media rule present and applied; `Reveal` has a 2s
  failsafe so content can never remain hidden.
- **Escape closes** the request drawer, the mobile menu, and the programs dropdown.
- Focus is **restored to the trigger** when the drawer closes.
- The mobile menu button has correct `aria-expanded` and a toggling `aria-label`.
- 16 `aria-label`s on icon-only buttons — close, quantity steppers, carousel arrows, account, bag —
  including per-item labels like "Increase NAD+ quantity".
- Links and buttons keep the browser's default focus ring (no global `outline: none` reset).
- Videos are muted with no autoplaying audio.
- Zero console errors on any route.

---

## Suggested order of work

| # | Work | Fixes | Effort |
| --- | --- | --- | --- |
| 1 | `div`/`span` → `button` sweep + accordion/facet/chip ARIA | B1 | 1–1.5 days |
| 2 | `useId` + `<label htmlFor>` in `fields.tsx` and the wizard steps | B2 | 0.5 day |
| 3 | Drawer dialog semantics, focus trap, scroll lock, live region | S1 | 0.5 day |
| 4 | Contrast token pass (with design sign-off) | S2 | 0.5 day |
| 5 | `focus-within` on the three bare inputs; `inert` on the sticky bar | S3, S4 | 2 hours |
| 6 | `h1` per route; `role="alert"` + `aria-invalid` on the wizard | M1, M2 | 0.5 day |
| 7 | Combobox + dropdown ARIA | M3, M4 | 0.5 day |
| 8 | Tap-target padding; skip link | M5, M6 | 0.5 day |

**Total: roughly 4.5–5 days.** Steps 1–3 alone take the portal from "unusable without a mouse" to
"navigable", and none of steps 1, 2, 3, 5, 6, 7 change a single pixel.

## Making it stick

`scripts/mobile-audit.sh` already establishes the pattern for a browser-driven regression guard.
The natural companion is `scripts/a11y-audit.sh` — same route list, axe-core instead of the
overflow check, failing on any violation of impact `serious` or `critical`. Wiring both into
`.github/workflows/pages.yml` alongside `npm test` would close the loop; today neither runs in CI.

Cheaper still, and available immediately: `jest-axe` assertions inside the existing Vitest setup,
using `components/home-alt/CountUp.test.tsx` as the template.
