# Project Report — Evoluciona Pharma Provider Portal

**Repository:** `/Users/luisvalve/Sites/evoluciona` · package `evoluciona-provider-portal@0.1.0` (private)
**Branch:** `main` · 33 commits, 2026-08-05 → 2026-08-06 · working tree clean
**Live:** https://evoluciona-pharma.github.io/Site/
**Report date:** 2026-08-07

---

## 1. Executive summary

A licensed-provider-only web portal for a sterile compounding pharmacy, built as a fully static
Next.js 15 app. Providers browse 8 compounded formulations across 6 clinical programs, build a
**Request List** (deliberately not a shopping cart), and submit a 4-step information request. **No
pricing appears anywhere** — a representative follows up.

The app was implemented pixel-for-pixel from a committed design handoff and shipped in two days.
It is feature-complete against that handoff: 24 prerendered URLs, all real content, a working
request flow, and automated deployment to GitHub Pages on every push to `main`. Verified during
this review: unit tests pass (5/5) and the static export builds clean.

Its two open threads are a **duplicate home page awaiting an A/B decision** (`/` vs `/index-alt`)
and **thin automated coverage** — one component test, and the mobile regression script exists but
is not wired into CI.

---

## 2. What it does

| Area | Behaviour |
| --- | --- |
| Catalog | 8 products, 6 programs, faceted by program + presentation, URL-backed filters and sort |
| Request List | Add/remove/quantity via a right-side drawer; persisted to `localStorage`; dedupes by name |
| Request wizard | 4 steps — contact → practice → profile → additional → confirmation; `sessionStorage`-backed |
| Search | Nav typeahead (AND across tokens, ranked, capped at 5 products + 2 programs) plus shop `?q=` |
| FAQ | 6 topics, path-based routing (`/faq/orders-shipping`), 19 questions total |
| Compliance | Top strip, amber notices, disclaimers, attestation — verbatim legal copy, never paraphrased |

**Domain rules encoded in the product:** browsing is open, ordering is gated on license
verification; the "cart" is a request list and "checkout" is an information request; MOTS-C
presentation and Lipo-C concentration render as *pending* rather than estimated.

### Catalog content

| Program | Count | Products |
| --- | --- | --- |
| Longevity & Cellular Health | 3 | NAD+ *(Featured)*, NAD+/Glutathione *(New)*, MOTS-C |
| Recovery & Regenerative | 2 | BPC-157, TB-500 |
| Hormone Optimization | 1 | Sermorelin |
| Nutrient & Metabolic | 1 | Lipo-C |
| Metabolic Health | 1 | — *(program defined, no product assigned)* |
| Sexual Wellness | 1 | PT-141 |

---

## 3. Technical profile

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15.4 (App Router), React 19, TypeScript 5.7 |
| Styling | Tailwind CSS 3 — theme tokens pasted from the design handoff |
| Fonts | Instrument Serif / Instrument Sans / Anek Latin / Fira Code via `next/font/google` |
| Data | `data/catalog.json` (28 KB) — the single source for all copy and product data |
| State | React context + `localStorage`/`sessionStorage`; `searchParams` for filter/search/sort |
| Rendering | 100% static — every route prerenders; no server runtime, no database, no API |
| Tests | Vitest + Testing Library + jsdom |
| Deploy | GitHub Actions → GitHub Pages static export |

**Size:** ~4,325 lines of TS/TSX across 10 route templates and 22 components. The five largest
files are `EvoShopNav.tsx` (471), `ShopPage.tsx` (451), `HomeAltPage.tsx` (445),
`RequestDrawer.tsx` (329), and `ProductPage.tsx` (324).

**Build output (verified 2026-08-07):** 24 URLs — 16 static, 8 SSG via `generateStaticParams`.
Shared first-load JS 103 kB; per-route first load 115–119 kB.

### Architecture notes worth knowing

- **Routing contract.** Product identity lives in the path (`/products/bpc-157`); filter, search,
  presentation, sort, and FAQ topic live in `searchParams`, so state survives refresh and is
  linkable. Filter changes navigate with `scroll: false`.
- **`lib/asset.ts` is load-bearing.** GitHub Pages serves from `/Site`, and Next does not prefix
  `basePath` onto raw `<img src>`. Every public-asset path must go through `asset()` — a hardcoded
  `/assets/...` works locally and 404s in production.
- **`trailingSlash: true`** on export, so each route emits `<route>/index.html`; without it Pages
  404s on deep links.
- **Motion** (scroll reveals, hero carousel, stat count-up) is gated behind
  `prefers-reduced-motion`, and `Reveal` carries a 2s failsafe so content can never stay hidden.
- **Content discipline.** Copy is legally reviewed and lives only in `catalog.json`; the file's own
  `_note` forbids paraphrasing and forbids substituting estimates for `pending` values.

---

## 4. Delivery & CI

`.github/workflows/pages.yml` runs on every push to `main`: `npm ci` → `npm test` → static export
with `NEXT_PUBLIC_BASE_PATH=/Site` → `touch out/.nojekyll` → upload artifact → deploy.

The workflow carries hard-won fixes, each commented in place: `concurrency: cancel-in-progress`
(a superseded run that gives up leaves a Pages deployment held, jamming every later run),
`include-hidden-files` on the upload (v4 started dropping `.nojekyll`), `enablement: true` so the
first run turns Pages on itself, and one retry on the deploy step. Roughly a third of the commit
history is deployment hardening — that friction appears to be resolved.

The build is portable: any Node host or static platform works, and `vercel` is present as a dev
dependency for `npx vercel --prod` (no base path needed there).

---

## 5. Quality & testing

| Check | Status |
| --- | --- |
| Unit tests | ✅ 5/5 passing — but only one file, `components/home-alt/CountUp.test.tsx` |
| Static export build | ✅ clean, 24 routes |
| TypeScript | ✅ strict, compiled as part of the build |
| Mobile audit | ⚠️ `scripts/mobile-audit.sh` exists and works; **not** run in CI |
| Accessibility | ❌ audited 2026-08-07 — **fails WCAG 2.1 AA**, see [`ACCESSIBILITY_AUDIT.md`](ACCESSIBILITY_AUDIT.md) |

### The mobile story

`MOBILE_FIX_PLAN.md` documents an iPhone-16-emulation audit of all 10 routes that found 10 verified
bugs, 4 of them blockers — at 393px the whole 1440px frame rendered off-canvas, so the nav, the
request drawer, and the entire wizard were unreachable.

Both remedies in the plan shipped on 2026-08-06: option A (a `width=1440` viewport stopgap) first,
then option B (a real responsive refactor, all four phases), which reverted A. Current state:
desktop ≥1024px is pixel-identical to the original design; below that, layouts stack, the nav
collapses to a hamburger sheet, and the drawer goes full-width. Verified zero horizontal overflow
at 360/393/430px.

---

## 6. Known gaps and risks

**Product decisions still open**

1. **Two home pages.** `/` (carousel-led) and `/index-alt` (product-led, 445 lines) both ship. No
   decision recorded; `/index-alt` is unlinked from the nav but publicly reachable.
2. **Intentionally inert UI.** Nav *About*, footer *About / Privacy / Terms*, *Account*, and the
   FAQ *"Open assistant"* button do nothing. `shop/classic` is unbuilt pending client confirmation.
3. **Content pending sign-off.** FAQ answer copy and the testimonial await content-owner/compliance
   approval; MOTS-C presentation and Lipo-C concentration await pharmacy confirmation.
4. **Metabolic Health** is a defined program with a declared count of 1 but no product mapped to it.

**Engineering risks**

5. **Coverage is thin.** One component test against ~22 components. The highest-value untested
   logic is `lib/search.ts` (filter/sort/typeahead ranking — pure functions, cheap to test) and the
   two state contexts (`RequestListContext` dedupe + persistence, `RequestWizardContext` validation).
6. **The mobile regression guard is not enforced.** `scripts/mobile-audit.sh` was written as Phase-4
   item 16 "run it in CI alongside `npm test`", but the workflow only runs `npm test`. It also needs
   a live dev server on :3000, so wiring it in requires a background-server step.
7. **`README.md:78` is stale.** It still states "**Desktop only.** … no responsive breakpoints exist
   on purpose", which commit `ba6c88b` reversed. `AppShell.tsx` has the correct comment. Anyone
   reading the README first will draw the wrong conclusion.
8. **The design handoff dominates the repo** — 84 of 160 tracked files. That is deliberate (it is
   the design source of truth) but it makes the repo heavy and search noisy.

---

## 7. Recommended next steps

| Priority | Action | Effort |
| --- | --- | --- |
| High | Decide `/` vs `/index-alt` and delete the loser (or gate it behind a flag) | 0.5 day |
| High | Fix the stale "Desktop only" claim in `README.md:78` | 5 min |
| High | Add unit tests for `lib/search.ts` and the two contexts | 0.5–1 day |
| Medium | Run `scripts/mobile-audit.sh` in CI (start dev server, then audit) | 0.5 day |
| Medium | Resolve or track the pending content and the empty Metabolic Health program | client-blocked |
| High | Accessibility remediation — keyboard access and form labels are blockers (`ACCESSIBILITY_AUDIT.md`) | 4.5–5 days |
| Low | Decide the fate of the inert links (build, hide, or document as intentional) | client-blocked |

---

## Appendix — layout

```
app/                          10 route templates → 24 prerendered URLs
  page.tsx · index-alt/ · shop/ · products/[slug]/ · faq/[topic]/ · request/{4 steps + confirmation}
components/                   22 components
  AppShell · EvoShopNav · EvoShopFooter · RequestDrawer · RequestListContext · Reveal
  home/ home-alt/ shop/ product/ faq/ request/
lib/                          catalog.ts (typed accessors) · search.ts (filter/sort/typeahead) · asset.ts (basePath)
data/catalog.json             all real content — 28 KB, legally reviewed, never retyped
public/assets/                vial photography, brand marks, step photos, hero video
scripts/mobile-audit.sh       phone-width overflow regression guard
design_handoff_.../           design source of truth: spec, .dc.html references, 30 screenshots, tokens
.github/workflows/pages.yml   test → static export → GitHub Pages
MOBILE_FIX_PLAN.md            mobile audit findings + the 4-phase refactor, both marked shipped
```
