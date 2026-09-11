# API answers — Evoluciona frontend integration

Answers from **backend** to `API_INTEGRATION_QUESTIONS.md`.  
Use this as the contract for **v1** (catalog + draft order). Assessments stay for later.

**Related:** `docs/evolucion-farma-frontend-integration.md`

Legend: **YES** / **NO** / **ALT** (alternative)

---

## 0. Omit fields vs send what we have

### A. API fields the front does not show

| Field | Answer |
|-------|--------|
| `unitPrice` | **YES — omit.** Never invent a price. Backend stores `null`. |
| `currency` | **YES — omit.** Optional. Stored as `null` if omitted. No default applied. |
| `assessmentSessionId` | **YES — omit in v1** when `status: "draft"`. Assessment is **not** enforced on `draft`. |
| `details[].status` | **YES — omit.** Defaults to `"pending"`. |
| `subtotal` / `total` | **YES — omit on create.** Computed only when line prices exist; otherwise `null`. |
| `userId` | **YES — do not send.** Forced from JWT for patient/provider callers. |

**Minimal v1 payload — confirmed valid:**

```json
{
  "status": "draft",
  "notes": "optional free text or structured wizard dump",
  "details": [
    {
      "productId": 1,
      "productPresentationId": 2,
      "quantity": 1
    }
  ]
}
```

- `productPresentationId`: optional. Send when the user selected a presentation; omit/null if pending / no presentations.
- `quantity`: optional (default `1`); **prefer always sending it**.
- `currency`: not required.

### B. Wizard fields the API does not accept

**Confirmed:** no first-class fields for license, NPI, practice, attestation, etc.

**v1 recommendation: YES to option (2)** — put wizard data in `notes` as plain text (format in §3.2 of the questions doc is fine).

- `notes` is MySQL `TEXT` (~64 KB). Zod does not enforce a short max. A structured block of a few KB is OK.
- If you prefer not to persist PII there, send only `message` (or omit `notes`) — that is also valid.

### C. IDs from catalog

**YES.** Enrich the request list in memory with `productId` (+ `productPresentationId` when known). Do not invent IDs.

---

## 1. Identity & auth

| # | Answer |
|---|--------|
| **A1** | **YES — treat JWT `user` as the logged-in provider.** Role slug `user` already has `catalog.read`, `orders.read/create/update`, and assessment-session permissions. There is no separate “clinic” role today. Admin uses `/api/admin/*`. |
| **A2** | **NO guest catalog today.** All `/api/catalog/*` require `Authorization: Bearer` + `catalog.read`. **ALT for v1:** login before shop (or before first catalog fetch). Public catalog would be a backend change (not implemented). |
| **A3** | **Minimum: token before any catalog GET and before `POST` order.** Prefer login once (Account) then browse with token. You cannot load `/api/catalog/*` without JWT. |
| **A4** | **YES:** `POST /api/auth/login` with `{ "email", "password" }` → `{ data: { token, user } }`. **Logout:** `POST /api/auth/logout`. **No** patient register / forgot-password flows for this portal. Invitation `set-password` exists for invited users (admin invite), not a self-serve register UI. **JWT expires in 7 days.** No refresh token. |
| **A5** | **YES — demo users are seeded** (unless `SEED_DEMO_USERS=false`). After `npx prisma db seed`: **Provider** `provider@evolucionafar.ma` / `Demo123!` (role `user`); **Admin** `admin@evolucionafar.ma` / `Demo123!` (role `admin`). Idempotent upsert. |
| **A6** | **YES — CORS is enabled** via `src/proxy.ts` for `/api/*`. Default allowlist: `http://localhost:3000`, `http://localhost:3001`, `http://127.0.0.1:3000`, `http://127.0.0.1:3001`, `https://evoluciona-pharma.github.io`. Override with comma-separated `CORS_ORIGINS`. Allows `Authorization` + `Content-Type`. Set `NEXT_PUBLIC_API_URL` to the API host. |
| **A7** | **YES — independent.** Order `userId` = JWT user (who submitted). Wizard contact/practice can differ; put them in `notes` if backoffice needs them. |

---

## 2. Catalog / products

### 2.1 Data contract

| # | Answer |
|---|--------|
| **P1** | Shape below (illustrative but matches repo). Use Swagger `/docs` or `GET /api/docs/openapi` against a seeded env for live IDs. |
| **P2** | **YES — `slug` is unique and stable** (e.g. seed: `nad-plus`, `mots-c`). Route by **slug on the front**; resolve product via list/detail. Detail endpoint is **`GET /api/catalog/products/:id` (numeric id only)**. Pattern: load list → map `slug → id`, or keep slug in client state after list. |
| **P3** | **YES — `category` ≈ program.** One category per product (`categoryId`). Shape: `{ id, slug, name }` (detail also `description`). **No** secondary `programAlt` field. Use tags or a second relation later if needed. |
| **P4** | **YES:** `presentations[]` includes `{ id, label, volumeMl, concentration, sku, isDefault, sortOrder }`. Labels in seed are `"5 mL"` / `"10 mL"` / `"Default"` — free strings, not an enum. |
| **P5** | **YES — line without `productPresentationId` is allowed.** MOTS-C seed has a `"Default"` presentation; if a product has zero presentations, omit the field. |
| **P6** | **`concentration` exists on presentation** (nullable string). **No** `concentrationStatus` / `presentationStatus` / `on-label`. Don’t invent pending copy from missing fields. |
| **P7** | Detail includes: `shortSummary`, `description`, `contentSections[]` as `{ id, sectionType, title, content, sortOrder }`. Content is plain string (not guaranteed HTML/MD). Map what exists; hide missing sections. **No** separate `tagline` / `blurb` / `spec` fields. |
| **P8** | Cover: `imageUrl` (nullable string, absolute or path as stored). Gallery: `images[]` with `imageUrl`, `altText`, `sortOrder`, `isPrimary`, optional `productPresentationId`. Not a fixed front/label/scale/carton set. |
| **P9** | Product has **`isFeatured`** and **`isNew`** booleans. Query `?featured=true` filters `isFeatured`. **No** `badge` string — derive UI chip from `isFeatured` / `isNew`. |
| **P10** | Detail includes **`relationsFrom[]`** → `{ relationType, relatedProduct: { id, slug, name, imageUrl, shortSummary } }`. Use for “also review”. No separate `pairsWith` name. |
| **P11** | **No pagination.** Full active list in one GET. Fine for small catalogs. |
| **P12** | **No `?q=`.** Filter client-side in v1. |
| **P13** | **No presentation filter on API.** Client-side facets. |
| **P14** | Catalog endpoints return **`status: "active"` only.** For **`draft` orders**, product does **not** have to be active (validation only enforces active when status ≠ `draft`). Still recommend only adding active products from catalog. If product is deleted/missing → **404**. |
| **P15** | **Demo seed today: 1 category + NAD+ + MOTS-C** (not 8 products / 6 programs). Full catalog must be loaded in DB (admin/seed) before the shop looks complete. |
| **P16** | **YES — compliance copy stays local.** |

### Example — list item (`GET /api/catalog/products`)

```json
{
  "id": 1,
  "slug": "nad-plus",
  "name": "NAD+",
  "shortSummary": "Cellular energy and longevity support",
  "description": "…",
  "status": "active",
  "isFeatured": true,
  "isNew": false,
  "requiresPrescription": true,
  "imageUrl": null,
  "sortOrder": 0,
  "category": {
    "id": 1,
    "slug": "longevity-cellular-health",
    "name": "Longevity & Cellular Health"
  },
  "presentations": [
    {
      "id": 1,
      "label": "5 mL",
      "volumeMl": "5",
      "concentration": null,
      "sku": null,
      "isDefault": true,
      "sortOrder": 0
    },
    {
      "id": 2,
      "label": "10 mL",
      "volumeMl": "10",
      "concentration": null,
      "sku": null,
      "isDefault": false,
      "sortOrder": 1
    }
  ],
  "tags": []
}
```

### Example — detail extras (`GET /api/catalog/products/:id`)

Same as list, plus typically:

- `images[]`
- `contentSections[]` (`sectionType`, `title`, `content`)
- `relationsFrom[]` (related products)
- category may include `description`

---

## 3. Orders (v1)

| # | Answer |
|---|--------|
| **O1** | **YES.** `status: "draft"` **never** requires assessment, even if the product has a required assignment (e.g. NAD+). |
| **O2** | **Use `draft` for v1 provider “information request”.** Do **not** use `pending_review` / `confirmed` yet — those are non-draft and will require a completed assessment session when the product has `isRequired` assignment → **400**. |
| **O3** | Provider **can** technically `PATCH` status (permission `orders.update`), but **v1 front should not.** Prefer admin/backoffice to move draft → confirmed/processing later. |
| **O4** | **YES — omit `unitPrice`.** Backend stores `null`; totals stay `null`. |
| **O5** | **YES — omit `currency`.** Optional; no forced default. |
| **O6** | **Not mandatory in API.** Send when user selected a presentation; omit if pending / none. If sent, it must belong to that `productId` or **400**. |
| **O7** | **Default quantity is 1** if omitted. Prefer always sending `quantity` ≥ 1. |
| **O8** | **API allows** multiple lines with same `productId` and different presentations. Matching current UI (one line per product) is a **front rule** — fine. |
| **O9** | **`notes` = TEXT (~64KB).** No short Zod max. Structured wizard dump is OK. |
| **O10** | **YES — we accept wizard content in `notes`** for v1 (format you proposed is fine). Alternative: only free-text `message`. No dedicated provider fields yet. |
| **O11** | POST `201` returns full order in `data`, including: `id`, **`orderNumber`** (e.g. `ORD-2026-00001`), `status`, `notes`, `details[]`, timestamps. **Use `orderNumber` as reference** on confirmation (not a separate `REQ-` field). No `uuid` on orders. |
| **O12** | Errors: `{ "success": false, "message": "…", "errors"?: … }`. Validation failures often include Zod `errors` flatten. Business rules usually a single `message` (e.g. presentation mismatch, assessment missing on non-draft). |
| **O13** | **YES — client cart until submit.** Correct. No server-side cart; lines cannot be edited after create. |
| **O14** | **Several drafts per user allowed.** Each submit = new order. |
| **O15** | **Use POST `data` for confirmation.** Extra GET optional. |
| **O16** | **Skip order history in v1** if there is no UI. Endpoint exists: `GET /api/patient/orders`. |
| **O17** | **Modal at Submit (or when entering request flow) is fine.** Catalog itself also needs token (see A2). |

### Example — successful create response (shape)

```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "id": 12,
    "orderNumber": "ORD-2026-00012",
    "userId": 3,
    "status": "draft",
    "notes": "Message: …\nContact: …",
    "subtotal": null,
    "total": null,
    "currency": null,
    "placedAt": null,
    "details": [
      {
        "id": 40,
        "productId": 1,
        "productPresentationId": 2,
        "quantity": 1,
        "unitPrice": null,
        "lineTotal": null,
        "assessmentSessionId": null,
        "assessmentOutcome": null,
        "status": "pending",
        "product": { "id": 1, "slug": "nad-plus", "name": "NAD+" },
        "productPresentation": { "id": 2, "label": "10 mL" }
      }
    ]
  }
}
```

---

## 4. Assessments (later — contract only)

| # | Answer |
|---|--------|
| **S1** | Seed questions are **patient-style** (age, pregnancy). Designed for a **patient** taker. On a **B2B provider portal**, assessments may never belong in this UI — confirm with product. If patient-only, this frontend skips them permanently and keeps orders as `draft` (or admin confirms). |
| **S2** | **YES — enforced on non-draft** when assignment `isRequired`. Don’t PATCH to confirmed without session. |
| **S3** | When you implement: overlay/stepper is fine; no dedicated public route required by API. |
| **S4** | **YES** — reuse `latestCompletedSession.id` as `assessmentSessionId` if outcome is still `eligible` or `requires_review`. |
| **S5** | **No session TTL in API today.** Completed sessions stay valid until business rules change. |
| **S6** | **Option C still:** `requires_review` allows order when confirming; `ineligible` / `recommend_alternative` → **400** on non-draft. |
| **S7** | Use `answerText` and/or `answerValues`. Examples: number/text → `answerText`; `single_choice` → `answerValues: "no"` (or text); `multiple_choice` → `answerValues: ["a","b"]`. **`height_weight`:** no fixed schema enforced — prefer `answerValues: { "height": …, "weight": … }` (document with product when you implement). |
| **S8** | **YES — separate flows.** Request wizard ≠ medical assessment. |
| **S9** | **YES for v1 — ignore `checkout-context` entirely.** |

---

## 5. Environment & ops

| # | Answer |
|---|--------|
| **E1** | Local API default `http://localhost:3000`. Use `NEXT_PUBLIC_API_URL`. Prefer different port/host than the Next app. Staging/prod URLs: confirm with your deploy (not hardcoded in this repo). |
| **E2** | **YES:** `http://localhost:3000/docs` and `http://localhost:3000/api/docs/openapi`. |
| **E3** | **YES — static export + client fetch works** with the API CORS allowlist (local + GitHub Pages origin included by default). Add other staging origins via `CORS_ORIGINS` if needed. |
| **E4** | **Only** `Authorization: Bearer <token>` (+ `Content-Type: application/json` on POST/PATCH). No API key / tenant header. |

---

## 6. Can you start coding? (minimum)

| Blocker from questions | Status |
|------------------------|--------|
| A1 who is user | **Cleared** — JWT `user` = provider |
| A2 catalog auth | **Cleared with constraint** — JWT required (no guest) |
| A6 CORS | **Cleared** — `src/proxy.ts` allowlist (override with `CORS_ORIGINS`) |
| P1/P2/P4 shapes | **Cleared** — see examples; slug + presentation `id`/`label` |
| P15 full catalog | **Partial** — only 2 demo SKUs until data is loaded |
| O1 draft without assessment | **Cleared — YES** |
| O4 omit unitPrice | **Cleared — YES** |
| O11 reference | **Cleared — use `orderNumber`** |
| O12 errors | **Cleared — envelope documented** |
| O9/O10 notes | **Cleared — wizard in `notes` OK** |

**Safe v1 path:** login → catalog with Bearer → client request list with ids → `POST /api/patient/orders` with `status: "draft"` → show `orderNumber`.

**Demo login (seed):** `provider@evolucionafar.ma` / `Demo123!`

---

## 7. Field cheat sheet (confirmed)

**Send in v1**

- Login → store `token`
- `POST /api/patient/orders`: `status: "draft"`, `details[{ productId, productPresentationId?, quantity }]`, `notes?`

**Do not send in v1**

- `unitPrice`, `currency`, `assessmentSessionId`, `userId`, `subtotal`, `total`, line `status`

**UI-only → optional `notes`**

- Contact, license, practice, profile, attestation, hearAbout, message

**Ignore for now**

- Assessment sessions, checkout-context, order history, PATCH status, pricing, admin APIs
