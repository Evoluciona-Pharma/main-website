# Accessibility Fix Plan — Evoluciona Provider Portal

Remediation plan for the findings in [`ACCESSIBILITY_AUDIT.md`](ACCESSIBILITY_AUDIT.md)
(audited 2026-08-07, WCAG 2.1 AA). Same structure as [`MOBILE_FIX_PLAN.md`](MOBILE_FIX_PLAN.md).

**Total: ~5 days.** Phases 1–3 (2.5 days) take the portal from "unusable without a mouse" to
"navigable and announced" — that is the ship-blocking subset.

**Only Phase 5 changes the design.** Phases 0–4 and 6–7 are markup and semantics; every screen
renders pixel-identically. Phase 5 (contrast) needs a designer's sign-off, and the tap-target
padding in Phase 6 shifts link spacing on mobile by a few pixels.

## Suggested PR split

| PR | Phases | Why grouped |
| --- | --- | --- |
| 1 | 0 + 1 | Primitives and form labels — one file each, no visual risk, unblocks the conversion flow |
| 2 | 2 | The keyboard sweep — large but mechanical; review as one coherent change |
| 3 | 3 + 4 | Drawer dialog + focus indicators — both about focus |
| 4 | 5 | Contrast only — needs design review, keep it isolated so it can be reverted alone |
| 5 | 6 + 7 | Headings, ARIA patterns, tap targets, CI guard |

---

## Phase 0 — Shared primitives (0.5 day) — ✅ SHIPPED 2026-08-07

Do this first. It turns Phase 2 from ~40 ad-hoc edits into a mechanical sweep, and it matches the
codebase idiom of exported Tailwind class strings (`navLink` in `EvoShopNav.tsx`, `label13` in
`fields.tsx`) rather than introducing a wrapper-component layer.

**0.1 — `lib/ui.ts`** (new)

```ts
/** Strips the UA button chrome so a semantic <button> can carry the design's own styling.
    Every div/span that used to hold an onClick becomes <button className={`${resetButton} …`}>. */
export const resetButton = 'cursor-pointer border-none bg-transparent p-0 text-left font-sans';

/** Visible ring for controls whose real input is sr-only (facets, presentation chips). */
export const peerRing =
  'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand';
```

`sr-only` is already available — Tailwind 3 ships it, no config change needed.

**0.2 — `components/a11y/AccordionItem.tsx`** (new, optional but recommended)

Two accordions (`FaqPage.tsx:101`, `ProductPage.tsx:202`) need an identical contract:
`<button aria-expanded aria-controls>` + a panel with a matching `id`. Extracting it once prevents
the two from drifting. Keep each call site's styling by passing `className` through — the visual
stays per-screen, only the semantics are shared.

```tsx
'use client';
import { useId } from 'react';

export function AccordionItem({ open, onToggle, header, headingLevel: H = 'h3', className, headerClassName, children }: {
  open: boolean; onToggle: () => void; header: React.ReactNode;
  headingLevel?: 'h2' | 'h3'; className?: string; headerClassName?: string; children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className={className}>
      <H className="contents">
        <button type="button" id={`${id}-button`} onClick={onToggle}
                aria-expanded={open} aria-controls={`${id}-panel`} className={headerClassName}>
          {header}
        </button>
      </H>
      {/* a region needs an accessible name — without aria-labelledby axe flags it */}
      {open && <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-button`}>{children}</div>}
    </div>
  );
}
```

**0.3 — Test harness.** `npm i -D jest-axe @types/jest-axe`, then extend `vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import { expect } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);
```

`components/home-alt/CountUp.test.tsx` is the template for component tests. From here each phase
lands with its own regression test.

**Verify:** `npm test` green, `npm run build` green.

**As shipped:** `lib/ui.ts`, `components/a11y/AccordionItem.tsx`, `types/vitest.d.ts`, and an
extended `vitest.setup.ts`. One addition not in the original plan — Testing Library's auto-cleanup
only registers when vitest runs with `globals: true`, which this config does not set, so rendered
DOM accumulated across test cases and queries matched elements from earlier ones. `afterEach(cleanup)`
now lives in the setup file; without it every multi-render test file will fail confusingly.

---

## Phase 1 — 🔴 Blocker B2: form labels + error semantics (0.5 day) — ✅ SHIPPED 2026-08-07

Fixes B2 and M2. One file plus five step pages. Highest value per line changed: this is the only
conversion flow in the product, and today a screen reader announces "edit text, blank" on every
field.

**1.1 — `components/request/fields.tsx:22-49` (`TextField`)**

```diff
-export function TextField({ label, value, onChange, error, placeholder, type = 'text' }: {…}) {
+export function TextField({ label, value, onChange, error, placeholder, type = 'text', name, required }: {…}) {
+  const id = useId();
+  const errorId = `${id}-error`;
   return (
     <div className="flex flex-col gap-[7px]">
-      <span className={label13}>{label}</span>
+      <label htmlFor={id} className={label13}>{label}</label>
       <div className={`flex h-12 items-center rounded-[10px] px-[15px] ${fieldBorder(error)}`}>
         <input
+          id={id}
+          name={name}
+          required={required}
+          aria-invalid={error ? true : undefined}
+          aria-describedby={error ? errorId : undefined}
           type={type}
           …
-      {error && <span className="text-xs text-danger">{error}</span>}
+      {error && <span id={errorId} className="text-xs text-danger">{error}</span>}
```

`<label>` and `<span>` are both `display: inline` under Tailwind preflight, so **the layout does
not move**.

**1.2 — `fields.tsx:51-104` (`SelectField`)** — identical treatment. This also clears the
`select-name` critical violation on all four wizard steps.

**1.3 — `fields.tsx:106` (`ErrorBanner`)** — add `role="alert"` and make it focusable so the step
pages can move focus to it:

```diff
-<div className="flex gap-3 rounded-xl border border-danger-border bg-danger-bg px-4 py-3.5">
+<div role="alert" tabIndex={-1} ref={ref} className="flex gap-3 rounded-xl …">
```

**1.4 — Move focus on failed submit.** In each step's `onContinue`
(`app/request/contact/page.tsx:34`, `practice:*`, `profile:*`, `additional:*`):

```diff
 const onContinue = () => {
   const e = validate();
   setErrors(e);
-  if (Object.keys(e).length === 0) router.push('/request/practice');
+  if (Object.keys(e).length === 0) { router.push('/request/practice'); return; }
+  bannerRef.current?.focus();   // announces the alert and puts the user at the problem
 };
```

**1.5 — Pass `name` to every field** for browser autofill (`name`, `email`, `tel`,
`organization`, `address-level1`) — a usability win that costs nothing here.

**Verify:**
- `npx agent-browser open http://localhost:3000/request/contact` then axe → `label` and
  `select-name` violations gone on all four steps.
- Keyboard: Tab to Continue, press Enter on an empty form → focus lands on the error banner.
- New test `components/request/fields.test.tsx`: `getByLabelText('Email')` resolves; `axe()` clean.

**As shipped, with one scope addition.** Phase 1 also absorbed the **attestation checkbox**
(`app/request/additional/page.tsx`) — a `<label>` with no `<input>` inside, so it was outside the
tab order, and since `submit()` returns early without it, a keyboard-only provider could not submit
a request at all. It became `CheckboxField` in `fields.tsx`, using the Phase 0 `peerRing` primitive.
It belonged here rather than in Phase 2: it is a form control on the flow this phase exists to
unblock, and leaving it would have meant shipping a "fixed" wizard that still could not be
completed. The profile step's token input and the additional step's textarea also gained real
labels, so B2 is now closed across all four steps rather than just the `fields.tsx` call sites.

**Measured after (was → now):**

| Check | Before | After |
| --- | --- | --- |
| axe `critical` violations, all 11 routes | 8 (`label`, `select-name`) | **0** |
| Keyboard-unreachable controls, `/request/*` | 5 on `/request/additional` | **0** on all four steps |
| Fields with `aria-invalid` after a failed submit | 0 | 4 of 4 (contact), 5 of 5 (practice) |
| Focus after a failed submit | stayed on Continue | the `role="alert"` banner |

`color-contrast` (Phase 5) and `page-has-heading-one` (Phase 6) remain on these routes as expected.

---

## Phase 2 — 🔴 Blocker B1: the keyboard sweep (1.5 days) — ✅ SHIPPED 2026-08-07

The big one. Ten call sites, all the same move: an element with `onClick` becomes a real control.
Reuse `resetButton` from Phase 0 so no call site loses its styling.

**Order within the phase — by user impact:**

**2.1 — Shop filters** (`components/shop/ShopPage.tsx:58`, `FacetRow`). A native checkbox inside a
`<label>` gives keyboard operation, `aria-checked`, and the label association for free:

```diff
-<div onClick={onToggle} className="flex cursor-pointer items-center gap-[11px] py-[5px] hover:opacity-75">
-  <span className="relative h-[18px] w-[18px] shrink-0 rounded-[5px] border-[1.5px] …">
+<label className="flex cursor-pointer items-center gap-[11px] py-[5px] hover:opacity-75">
+  <input type="checkbox" checked={on} onChange={onToggle} className="peer sr-only" />
+  <span aria-hidden="true" className={`relative h-[18px] w-[18px] shrink-0 rounded-[5px] border-[1.5px] … ${peerRing}`}>
```

`peerRing` puts the focus ring on the custom tick box, since the real input is `sr-only`.

**2.2 — FAQ accordion** (`components/faq/FaqPage.tsx:99-105`) → `AccordionItem` with
`headingLevel="h3"`. This is the one that unlocks all 19 answers. Wrapping each question in an
`<h3>` also gives screen-reader users heading-by-heading navigation through a topic.

**2.3 — Product accordion** (`components/product/ProductPage.tsx:200-206`) → same, `h3`. Unlocks
Description, How it's supplied, Provider requirements, Product FAQ.

**2.4 — Presentation selector** (`components/product/ProductPage.tsx:146-160`). Native radios give
correct arrow-key behaviour for free, which hand-rolled `role="radio"` would not:

```diff
-<span className="text-[13px] font-semibold text-navy">Presentation</span>
-<div className="flex flex-wrap gap-2">
-  {product.presentations.map((label) => (
-    <span key={label} onClick={() => setSize(label)} className={size === label ? '…' : '…'}>
-      {label}
-    </span>
+<fieldset className="flex flex-col gap-[9px] border-none p-0 m-0">
+  <legend className="text-[13px] font-semibold text-navy">Presentation</legend>
+  <div className="flex flex-wrap gap-2">
+    {product.presentations.map((label) => (
+      <label key={label} className={size === label ? '…' : '…'}>
+        <input type="radio" name="presentation" checked={size === label}
+               onChange={() => setSize(label)} className="peer sr-only" />
+        {label}
+      </label>
```

Add `peerRing` to both chip class strings.

**2.5 — Gallery thumbnails** (`ProductPage.tsx:104-110`):
`<button type="button" aria-label={`View ${view}`} aria-pressed={imgIndex === i}>`.

**2.6 — Shop toolbar.** Three separate controls:
- `ShopPage.tsx:226` "Clear all" → `<button type="button" className={resetButton + ' text-xs …'}>`
- `ShopPage.tsx:272-276` active filter chips → `<button type="button" aria-label={`Remove ${ch.label} filter`}>`
- `ShopPage.tsx:212-216` "Filter" heading. It is a heading on desktop (`lg:cursor-default`) and a
  toggle on mobile — so **split it** rather than making the heading a button: keep the text as
  `<h2>`, and add a sibling `<button className="lg:hidden" aria-expanded={filtersOpen}
  aria-controls="shop-filters" aria-label="Show filters">` carrying the chevron. Give the collapsed
  panel `id="shop-filters"`.

**2.7 — Sort menu** (`ShopPage.tsx:286-310`): trigger gets `aria-expanded` +
`aria-haspopup="listbox"` + `aria-controls`; panel gets `role="listbox"`; each option becomes
`<button role="option" aria-selected={sort === o.id}>`.

**2.8 — Nav search controls** (`EvoShopNav.tsx:289` clear-search →
`<button type="button" aria-label="Clear search">`; `:307` popular-search chips → `<button type="button">`).

**Verify (per call site, not just at the end):**
- The scan that produced the audit numbers — re-run and expect **0**:
  ```js
  Array.from(document.querySelectorAll('*')).filter(e =>
    e.offsetParent && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(e.tagName) &&
    e.tabIndex < 0 && getComputedStyle(e).cursor === 'pointer' && !e.closest('a,button')).length
  ```
  Baseline (re-measured 2026-08-07): `/shop` 44, `/products/nad` 26, `/faq/orders-shipping` 9,
  `/` 6. **Exclude `LABEL` and `.closest('label')`** as shown — otherwise the correct
  `<label>` + `sr-only <input>` pattern this phase introduces reads as 5 new violations per control.
- Keyboard-only run-through: filter the catalog, pick a presentation, open an FAQ answer, open a
  product accordion — all without touching the mouse.
- Screenshot diff at 1440px against `design_handoff_.../screenshots/` to prove nothing moved.

**As shipped.** All ten call sites, plus two the plan had not listed:

- **Hero carousel arrows** (`components/home/HeroCarousel.tsx`) — the two `<span onClick>` arrows
  were the 6 flagged elements on `/`, which the plan had recorded as a count without naming them.
- **Profile step interest tokens and suggestion list** (`app/request/profile/page.tsx`) — invisible
  to the original audit because they only render once the request list is non-empty or the input is
  focused. Same defect class, so they belonged in this sweep.

`AccordionItem` gained a `panelClassName` prop during the work: without it the FAQ and product
panels would have been wrapped in an extra unstyled `<div>`, which is exactly the kind of
incidental DOM change a pixel-for-pixel build should not accumulate.

**Measured after (was → now):**

| Route | Keyboard-unreachable controls before | After |
| --- | --- | --- |
| `/shop` | 44 | **0** |
| `/products/nad` | 26 | **0** |
| `/faq/orders-shipping` | 9 | **0** |
| `/` | 6 | **0** |
| All 11 routes + sort menu, search panel, open drawer | — | **0** |

**Functional checks, all by keyboard alone:**

| Journey | Result |
| --- | --- |
| Filter the catalog (Space on a facet) | 8 → 3 products, URL `?program=longevity-cellular-health`, chip appears; Space again → 8 |
| Open an FAQ answer (Enter) | `aria-expanded` flips, panel `aria-labelledby` resolves to its button, 828 chars of answer exposed |
| Choose a presentation (ArrowRight) | 5 mL → 10 mL, chip recolours, sticky CTA spec follows |
| Open a product accordion | panel resolves via `aria-controls`, content present |
| Sort menu | trigger `aria-expanded`, `role="listbox"`, `aria-selected` on the active option |

Question rows and product sections are now `<h3>`-wrapped, so screen-reader users can navigate
section by section rather than reading linearly.

**No visual change.** Screenshots at 1440px match
`design_handoff_.../screenshots/state-shop-grid-filters.png` and the product/FAQ references;
`scripts/mobile-audit.sh` reports zero horizontal overflow on all 10 routes at 393px. axe on the
changed routes returns only `color-contrast` (Phase 5) and `page-has-heading-one` (Phase 6) — the
sweep introduced no new violations.

---

## Phase 3 — 🟠 S1: request drawer as a dialog (0.5 day) — ✅ SHIPPED 2026-08-07

`components/RequestDrawer.tsx`. Escape (`:74`) and the close button already work; what is missing is
dialog semantics, focus containment, and any signal that an item was added.

**3.1 — Panel semantics** (`:110`):

```diff
+const headingId = useId();
-<div className="fixed bottom-0 right-0 top-0 z-40 flex w-full max-w-[470px] …">
+<div role="dialog" aria-modal="true" aria-labelledby={headingId} ref={panelRef}
+     className="fixed bottom-0 right-0 top-0 z-40 flex w-full max-w-[470px] …">
-  <h2 className="font-display text-[34px] leading-none text-navy">Request list</h2>
+  <h2 id={headingId} className="font-display text-[34px] leading-none text-navy">Request list</h2>
```

**3.2 — Move focus in on open**, into the close button, and restore to the opener on close. Store
`document.activeElement` when `open` flips true.

**3.3 — Trap Tab** within `panelRef` while open (wrap from last focusable to first and back).
Baseline to beat: **33** focusable elements are currently reachable behind the open drawer.

**3.4 — Lock body scroll** while open — `document.body.style.overflow = 'hidden'`, restored in the
effect cleanup. Today it stays `visible` and the page scrolls behind the drawer.

**3.5 — Mark the overlay decorative** (`:107`): `aria-hidden="true"`. It stays a click-to-close
`<div>`; Escape and the close button are the keyboard paths.

**3.6 — Announce additions.** Add one polite live region in `AppShell.tsx` fed by
`RequestListContext`, so "Add to Request List" is perceivable:

```tsx
<div aria-live="polite" className="sr-only">{announcement}</div>
// e.g. `NAD+ added to your request list. 3 items.`
```

This is the fix for the audit's sharpest point: today pressing the primary CTA produces *no*
perceptible feedback for a screen-reader user.

**Verify:** open the drawer, Tab repeatedly — focus never leaves the panel; Escape closes and
returns focus to the trigger; the page behind does not scroll; VoiceOver announces the addition.

**As shipped, measured on `/products/nad`:**

| Check | Before | After |
| --- | --- | --- |
| Dialog semantics | none | `role="dialog"`, `aria-modal="true"`, named "Request list" |
| Focus on open | stayed on the trigger | moves to "Close request list" |
| Focus containment | 33 background elements tabbable | Tab ×25 and Shift+Tab ×8 never leave the panel |
| Body scroll | `visible` | `hidden` while open, `visible` after |
| Overlay | exposed to AT | `aria-hidden="true"` |
| Add announcement | none | `role="status"` → "NAD+ added to your request list. 1 item in list." |
| Escape | closed | closes, unlocks scroll, restores focus to "Add to Request List" |

Removals are announced too — same defect class, three extra lines. The message is staged in a ref
and completed with the new count in an effect, so the `setItems` updater stays pure (writing state
from inside an updater double-fires under StrictMode).

Covered by `components/RequestDrawer.test.tsx` — 8 tests including the Tab-trap walk and the
scroll-lock restore.

---

## Phase 4 — 🟠 S3 + S4: focus indicators and the aria-hidden trap (2 hours) — ✅ SHIPPED 2026-08-07

**4.1 — Three inputs with no focus indicator.** `outline-none` in Tailwind is
`outline: 2px solid transparent` — the outline exists but is invisible, and no wrapper reacts to
focus. Add `focus-within:` to the wrapper, matching the pattern `fields.tsx` already uses:

| File | Element |
| --- | --- |
| `EvoShopNav.tsx:246` | desktop search `<form>` |
| `EvoShopNav.tsx:418` | mobile search `<form>` |
| `EvoShopFooter.tsx:31` | newsletter input (add a wrapper or `focus:` on the input itself) |
| `app/request/profile/page.tsx:66` | token input wrapper |

**4.2 — Make the wizard's own indicator actually apply.** `fieldBorder()` in `fields.tsx:16` sets
`focus-within:border-[1.5px]`, but the computed width stays 1px — `border` and the focus variant
both set `border-width` and the base class wins in the generated order. Switch to a ring, which
cannot collide:

```diff
-focus-within:border-[1.5px] focus-within:border-brand
+focus-within:border-brand focus-within:ring-1 focus-within:ring-brand
```

**4.3 — `components/home-alt/StickyRequestBar.tsx:25`.** `aria-hidden={!shown}` wraps a button that
stays tabbable. React 19 supports `inert` natively:

```diff
-<div aria-hidden={!shown} className="fixed inset-x-0 bottom-0 …">
+<div inert={!shown} className="fixed inset-x-0 bottom-0 …">
```

`inert` removes the subtree from both the tab order and the accessibility tree, which is exactly
the intent — and it lets `pointerEvents` in the inline style go too.

**Verify:** Tab to each of the four inputs and confirm a visible indicator; axe on `/index-alt`
reports no `aria-hidden-focus`.

**As shipped.** Every input now changes visibly on focus (measured border + box-shadow):

| Input | Before | After |
| --- | --- | --- |
| Nav search (desktop + mobile) | no change at all | brand ring `#14258F` |
| Footer newsletter | no change | border → white + white ring |
| Wizard fields | border colour only, the 1.5px width never applied | border → brand **and** a ring |
| Profile token box | no change (border is brand at rest) | brand ring |

The `additional` step's textarea had the same `focus:border-[1.5px]` width collision and got the
same ring treatment. Rings are `box-shadow`, so nothing reflows — resting state is untouched.

`StickyRequestBar` now uses `inert={!shown}` (React 19 supports it natively), which also made the
inline `pointerEvents` toggle redundant. The `aria-hidden-focus` **serious** violation is gone from
`/index-alt`.

**Remaining across all seven routes checked: `color-contrast` (Phase 5) and
`page-has-heading-one` (Phase 6) only.** No `critical` or other `serious` violations anywhere.

---

## Phase 5 — 🟠 S2: contrast tokens (0.5 day + design review) — ✅ SHIPPED 2026-08-07

**Design sign-off required** — this is the only phase that changes what the site looks like. All
five failures are token-level in `tailwind.config.ts`, so each is a one-line change that propagates
everywhere.

| Line | Token | Current | Measured | Proposed | New ratio |
| --- | --- | --- | --- | --- | --- |
| `:30` | `muted.2` | `#8C93A0` | 2.87–3.08:1 | `#6B7380` | 4.9:1 |
| `:31` | `muted.3` | `#9BA5B7` | 2.33–2.48:1 | `#767E8C` | 4.6:1 |
| `:73` | `footer.label` | `#5E6B83` | 2.85:1 | `#8C97AD` | 4.6:1 on navy |
| `:74` | `footer.legal` | `#6B7890` | 3.45:1 | `#98A3B8` | 5.4:1 on navy |
| `:53` | `teal.DEFAULT` | `#1B8B8A` | 4.11:1 | `#16736F` | 5.4:1 |

`muted.2` is the most-used muted token (card meta, breadcrumbs, spec lines) — expect the largest
visual delta there. Note that `footer.legal` carries the legally-reviewed compliance copy, so this
is the one with a regulatory argument behind it, not just a standards one.

**5.1 — Guard it with a unit test** so the tokens cannot silently regress. Cheap, runs in the
existing Vitest setup, no browser needed:

```ts
// tailwind.contrast.test.ts — relative luminance per WCAG 2.1
it.each([['muted.2', colors.muted[2], '#FFFFFF'], …])('%s meets 4.5:1', (_, fg, bg) => {
  expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
});
```

**Verify:** re-run the axe sweep — `color-contrast` should drop from 13/17/11/8 nodes per route to
0. Compare against `design_handoff_.../screenshots/` and get the design owner's approval before
merging.

### As shipped — the values above were wrong; these are the ones in the config

The table above was hand-estimated **against white only**. Most tokens sit on `surface.alt`
(`#F5F7FA`) or `surface.form` (`#F7F8FA`) as often as on white, and a tinted background is the
worse case. Solving against the real background set changed every value, and exposed a sixth
failing token the audit missed:

| Token | Was | Worst before | Now | white / alt / form |
| --- | --- | --- | --- | --- |
| `muted.DEFAULT` | `#6B7380` | **4.46** ⚠️ *not flagged by axe* | `#6A727F` | 4.85 / 4.52 / 4.57 |
| `muted.2` | `#8C93A0` | 2.88 | `#6A727F` | 4.85 / 4.52 / 4.57 |
| `muted.3` | `#9BA5B7` | 2.31 | `#64728C` | 4.85 / 4.52 / 4.57 |
| `footer.label` | `#5E6B83` | 2.86 | `#7F8CA3` | 4.53 on navy |
| `footer.legal` | `#6B7890` | 3.45 | `#808CA1` | 4.53 on navy |
| `teal.DEFAULT` | `#1B8B8A` | 4.11 | `#1A8382` | 4.55 on white |
| hardcoded hero grey (`HomeAltPage.tsx:160`) | `#7A8494` | 3.16 | `#626B7A` | 4.50 on `#E7EBF3` |

The plan's proposed `muted.2 → #6B7380` would have shipped a token that **still failed** on tinted
surfaces — `#6B7380` is 4.46:1 there, not the 4.9:1 the table claimed. `teal` was also constrained
to white only, since `text-teal` never renders on `teal.tint` (that token backs icons, not text).

### ⚠️ Design consequence: the grey scale is now two tiers, not three

`muted` and `muted-2` hold **the same value**. This is not an oversight — a three-step grey scale
cannot survive AA on light surfaces by lightness alone. Pulling `muted-2` up to 4.5:1 lands it
exactly where `muted` already sat, and `muted` itself had to move too. They are set to one shared
hex rather than two hexes differing by 2/255, so the collapse is explicit rather than accidental.

`muted-3` stays visually distinct by being **bluer** (`#64728C`), not lighter — which is the route
open to design if `muted-2` needs to be a separate tier again. That is a one-line change here.

**Measured after:** `color-contrast` is at **0 nodes on all 11 routes**, at both 1440px and 393px.
Guarded by `tailwind.contrast.test.ts` — 18 token/background pairs, plus assertions on the ratio
helper itself.

---

## Phase 6 — 🟡 Moderate: headings, ARIA patterns, targets, landmarks (1 day)

**6.1 — M1, one `<h1>` per route.** Eight of eleven routes have none.

| Route | Change |
| --- | --- |
| `/` | Add an `sr-only` `<h1>Evoluciona Pharma — Provider Portal</h1>` in `HomePage.tsx`. Prefer this over promoting the carousel headline: an `<h1>` whose text rotates every 4s is worse than a stable hidden one. |
| `/products/*` | `ProductPage.tsx:126` `Reveal as="h2"` → `as="h1"` |
| `/request/*` (4 steps) | step heading `<h2>` → `<h1>` |
| `/request/confirmation` | "Request received" `<h2>` → `<h1>` |

`/shop`, `/faq/*`, `/index-alt` already have one — leave them.

**6.2 — M3, typeahead as a combobox** (`EvoShopNav.tsx:257`). The mechanics are already right
(`onKey` at `:162` handles ArrowUp/Down/Escape); only the ARIA is missing. Apply the APG pattern:
`role="combobox" aria-expanded={searchOpen} aria-controls="search-results"
aria-autocomplete="list"` on the input; `role="listbox" id="search-results"` on the panel;
`role="option" aria-selected` + a stable `id` on each result; `aria-activedescendant` bound to the
existing `hi` index. Do the same for the mobile input at `:431`.

**6.3 — M4, programs dropdown** (`EvoShopNav.tsx:197`): add `aria-expanded={menuOpen}`,
`aria-haspopup="true"`, `aria-controls`. The mobile hamburger at `:403` is already correct — mirror
it.

**6.4 — M5, tap targets.** 8–12 elements per route are under 24×24 at 393px; 17–23 under 44×44.
Add vertical padding (`py-2.5`) to: footer link columns (`EvoShopFooter.tsx`), breadcrumbs
(`ProductPage.tsx`, `ShopPage.tsx`, `FaqPage.tsx` — "Home" is 36×16), and inline links like
"Contact support →" and "Read the Provider FAQ →". This closes item 13 of `MOBILE_FIX_PLAN.md`
Phase 4.

**6.5 — M6, skip link + landmarks.** In `AppShell.tsx`, add `id="main"` to `<main>` and a skip link
as the first focusable element:

```tsx
<a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-full focus:bg-brand focus:px-4 focus:py-2 focus:text-white">
  Skip to content
</a>
```

There are currently 33 tab stops between page load and product content. Also wrap page sections in
`<section aria-labelledby>` to clear axe's `region` finding (17 nodes on the product page).

**Verify:** axe reports no `page-has-heading-one` or `region`; the tap-target scan returns 0 under
24×24; ArrowDown through search results announces each option.

---

## Phase 7 — Guardrails, so it doesn't regress (0.5 day)

Neither `npm test` nor the existing `scripts/mobile-audit.sh` currently catches any of this, and
`mobile-audit.sh` isn't in CI either — this phase closes both gaps at once.

**7.1 — `scripts/a11y-audit.sh`** (new). Same shape as `scripts/mobile-audit.sh`: same route list,
same agent-browser driver, axe-core instead of the overflow check. Fail on any violation of impact
`serious` or `critical`. The audit scripts in the session scratchpad are working starting points.

**7.2 — Component-level tests** with `jest-axe` from Phase 0 — one per phase, so each fix has a
test that fails without it. Highest value: `fields.test.tsx` (labels), `FaqPage.test.tsx`
(accordion is a button with `aria-expanded`), `RequestDrawer.test.tsx` (dialog role + focus lands
inside), `tailwind.contrast.test.ts` (tokens).

**7.3 — Wire both into `.github/workflows/pages.yml`**, after the existing `npm test` step:

```yaml
      - name: Accessibility + mobile audit
        run: |
          npm run dev & npx wait-on http://localhost:3000
          zsh scripts/a11y-audit.sh
          zsh scripts/mobile-audit.sh
```

Both need a dev server, hence the background start. Keep them in the `build` job so a failure blocks
the deploy.

---

## Effort summary

| Phase | Scope | Effort | Changes pixels? |
| --- | --- | --- | --- |
| 0 | Primitives + jest-axe harness — ✅ **shipped** | 0.5 day | No |
| 1 | 🔴 Form labels + error semantics — ✅ **shipped** | 0.5 day | No |
| 2 | 🔴 Keyboard sweep (12 call sites) — ✅ **shipped** | 1.5 days | No |
| 3 | 🟠 Drawer dialog + live region — ✅ **shipped** | 0.5 day | No |
| 4 | 🟠 Focus indicators + `inert` — ✅ **shipped** | 2 hours | Focus states only |
| 5 | 🟠 Contrast tokens — ✅ **shipped** | 0.5 day | **Yes — needs design review** |
| 6 | 🟡 Headings, ARIA, targets, landmarks | 1 day | Minor mobile spacing |
| 7 | CI guardrails | 0.5 day | No |

**Test matrix per phase:** keyboard-only pass on the affected route; axe at 1440 and 393; screenshot
diff against `design_handoff_evoluciona_provider_portal/screenshots/` for anything in Phases 5–6.

## Definition of done

- The pointer-cursor-without-keyboard-path scan returns **0** on every route.
- axe reports **0** violations of impact `critical` or `serious` at 1440px and 393px.
- A keyboard-only user can complete the primary journey end to end: search → filter → open a
  product → choose a presentation → add to request list → complete all four wizard steps → submit.
- A screen-reader user is told when an item is added, when validation fails, and what each form
  field is.
- `npm test` and `scripts/a11y-audit.sh` both run in CI and block the Pages deploy on failure.
