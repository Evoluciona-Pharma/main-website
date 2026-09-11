# Evolución Farma — Frontend API Integration Guide

Guide for integrating the **Evolución Farma** patient flow with `custom-hub-api`.

**Audience:** frontend engineers  
**Base URL (local):** `http://localhost:3000`  
**Swagger:** `http://localhost:3000/docs`  
**OpenAPI JSON:** `http://localhost:3000/api/docs/openapi`

---

## 1. What this API covers

| Domain | Purpose |
|--------|---------|
| **Catalog** | Browse active products and categories |
| **Checkout context** | One call: product + whether assessment is required + assessment wizard + current session |
| **Assessment sessions** | Patient answers medical screening questions |
| **Patient orders** | Create/list/update orders with line items |

Admin CRUD (`/api/admin/...`) is for back-office only. The patient app should use the endpoints in this document.

---

## 2. Auth

All patient endpoints require a JWT.

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "patient@example.com",
  "password": "your-password"
}
```

**Response `data`:**

```json
{
  "token": "<jwt>",
  "user": {
    "id": 1,
    "uuid": "...",
    "email": "patient@example.com",
    "firstName": "...",
    "lastName": "...",
    "roles": ["user"]
  }
}
```

### Using the token

```http
Authorization: Bearer <token>
```

Store the token (memory / secure storage). Send it on every request below.

### Logout

```http
POST /api/auth/logout
Authorization: Bearer <token>
```

### Required permissions (role `user` already has these)

| Permission | Used by |
|------------|---------|
| `catalog.read` | Catalog endpoints |
| `assessment_sessions.create` | Start session |
| `assessment_sessions.read` | Get session |
| `assessment_sessions.update` | Save answers |
| `assessment_sessions.complete` | Complete session |
| `orders.read` | List/get patient orders |
| `orders.create` | Create order |
| `orders.update` | Update order (header only) |

---

## 3. Response envelope

Every endpoint returns:

**Success**

```json
{
  "success": true,
  "message": "…",
  "data": { }
}
```

**Error**

```json
{
  "success": false,
  "message": "…",
  "errors": { }
}
```

| Status | Meaning |
|--------|---------|
| `400` | Validation / business rule |
| `401` | Missing or invalid token |
| `403` | Authenticated but missing permission / ownership |
| `404` | Resource not found |

---

## 4. Recommended patient UX flow

```text
Login
  ↓
Browse catalog          GET /api/catalog/products
  ↓
Product detail          GET /api/catalog/products/:id
  ↓
Checkout context        GET /api/catalog/products/:id/checkout-context
  ↓
┌─ assessmentRequired === false ─────────────────────────┐
│  Add to cart / go to checkout                           │
└─────────────────────────────────────────────────────────┘
┌─ assessmentRequired === true ──────────────────────────┐
│  Resume activeSession OR start new session              │
│  POST /api/assessment-sessions                          │
│  Render assessment.steps → questions → options          │
│  PUT  /api/assessment-sessions/:id/answers              │
│  POST /api/assessment-sessions/:id/complete             │
│  Check outcome (eligible | requires_review | …)         │
└─────────────────────────────────────────────────────────┘
  ↓
Create order            POST /api/patient/orders
  (include assessmentSessionId on lines that need it)
```

---

## 5. Catalog

### List categories

```http
GET /api/catalog/categories
Authorization: Bearer <token>
```

Use for filters / navigation. Only active categories with active product counts.

---

### List products

```http
GET /api/catalog/products
GET /api/catalog/products?categoryId=1
GET /api/catalog/products?featured=true
Authorization: Bearer <token>
```

| Query | Type | Notes |
|-------|------|-------|
| `categoryId` | number | Optional |
| `featured` | `true` | Optional; only featured products |

Returns **active** products only (presentations, category, tags).

---

### Product detail

```http
GET /api/catalog/products/:id
Authorization: Bearer <token>
```

Includes presentations, images, content sections, tags, related products.

Use for the product page. For “can I buy this?” use **checkout-context** instead.

---

### Checkout context (most important for front)

```http
GET /api/catalog/products/:id/checkout-context
Authorization: Bearer <token>
```

Single aggregation for the buy / assessment screen.

**`data` shape:**

```json
{
  "product": { "id": 1, "name": "NAD+", "presentations": [], "…": "…" },
  "assessmentRequired": true,
  "assignment": {
    "id": 10,
    "isRequired": true,
    "priority": 10,
    "status": "active"
  },
  "assessment": {
    "id": 3,
    "name": "NAD+ Eligibility Screening",
    "version": 1,
    "steps": [
      {
        "id": 1,
        "code": "basics",
        "title": "Basic eligibility",
        "questions": [
          {
            "id": 11,
            "code": "age",
            "questionText": "What is your age?",
            "questionType": "number",
            "isRequired": true,
            "options": []
          },
          {
            "id": 12,
            "code": "pregnant",
            "questionText": "Are you currently pregnant?",
            "questionType": "single_choice",
            "isRequired": true,
            "options": [
              { "id": 1, "label": "Yes", "value": "yes" },
              { "id": 2, "label": "No", "value": "no" }
            ]
          }
        ]
      }
    ]
  },
  "activeSession": null,
  "latestCompletedSession": {
    "id": 44,
    "status": "completed",
    "outcome": "eligible",
    "completedAt": "2026-08-28T…"
  }
}
```

| Field | Front usage |
|-------|-------------|
| `assessmentRequired` | If `false`, skip assessment UI |
| `assignment` | Metadata; usually ignore except debugging |
| `assessment` | Full wizard (steps → questions → options). `null` if none / not published |
| `activeSession` | Resume in-progress session if present |
| `latestCompletedSession` | Reuse completed session when creating an order if still valid for UX |

**Question types you may see:**  
`text`, `number`, `email`, `phone`, `date`, `boolean`, `single_choice`, `multiple_choice`, `height_weight`

---

## 6. Assessment sessions

### Start session

```http
POST /api/assessment-sessions
Authorization: Bearer <token>
Content-Type: application/json

{
  "productId": 1
}
```

Optional: `"assessmentId": 3` (must match the resolved assignment for that product).

**Response:** session with `status: "in_progress"`.

Prefer starting from checkout-context: use `assessment.id` only if you need to be explicit; otherwise send `productId` alone.

---

### Get session

```http
GET /api/assessment-sessions/:id
Authorization: Bearer <token>
```

Patients can only read their own sessions (admins can read any).

---

### Save answers

```http
PUT /api/assessment-sessions/:id/answers
Authorization: Bearer <token>
Content-Type: application/json

{
  "answers": [
    { "questionId": 11, "answerText": "34" },
    { "questionId": 12, "answerValues": "no" }
  ]
}
```

| Field | When to use |
|-------|-------------|
| `answerText` | Free text / number / simple string answers |
| `answerValues` | Choice values, multi-select arrays, structured JSON |

At least one of `answerText` or `answerValues` is required per answer.  
Upserts by `questionId` — safe to call multiple times while the user progresses.

Only works while session `status === "in_progress"`.

---

### Complete session

```http
POST /api/assessment-sessions/:id/complete
Authorization: Bearer <token>
```

Validates required questions, runs outcome rules, sets:

- `status`: `"completed"`
- `outcome`: one of below
- `outcomeRuleId`, `recommendedProductId` (optional)

**Outcomes**

| Outcome | Meaning for UI / order |
|---------|-------------------------|
| `eligible` | Can order |
| `requires_review` | Can order (flag only — Option C; no blocking yet) |
| `ineligible` | Should **not** allow confirm order for that product |
| `recommend_alternative` | Show alternative if `recommendedProductId` is set; do **not** confirm order for original product |

If no rule matches → backend defaults to `requires_review`.

---

## 7. Patient orders

`order_details` are **not** separate endpoints. They are nested under the order as `details[]`.

### List my orders

```http
GET /api/patient/orders
GET /api/patient/orders?status=draft
Authorization: Bearer <token>
```

Non-admin users only see their own orders.

---

### Get order

```http
GET /api/patient/orders/:id
Authorization: Bearer <token>
```

Includes nested `details` with product, presentation, and assessment session snapshot.

---

### Create order

```http
POST /api/patient/orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "confirmed",
  "currency": "USD",
  "notes": null,
  "details": [
    {
      "productId": 1,
      "productPresentationId": 2,
      "quantity": 1,
      "unitPrice": 150,
      "assessmentSessionId": 44
    },
    {
      "productId": 5,
      "quantity": 2
    }
  ]
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `details` | Yes | Min 1 line |
| `details[].productId` | Yes | Must be active when confirming |
| `details[].productPresentationId` | No | Must belong to that product |
| `details[].quantity` | No | Default `1` |
| `details[].unitPrice` | No | If set, `lineTotal = quantity × unitPrice` |
| `details[].assessmentSessionId` | Conditional | **Required** when product has a required assessment and order is not `draft` |
| `status` | No | Default `draft` |

**Order statuses:**  
`draft` · `pending_review` · `confirmed` · `processing` · `shipped` · `cancelled` · `completed`

**Line statuses** (optional on create):  
`pending` · `approved` · `rejected` · `substituted`

#### Business rules the front must respect

1. **`status: "draft"`** — assessment not enforced; good for “save cart”.
2. **Any non-draft status** — if the product requires assessment:
   - `assessmentSessionId` must be present
   - session must be `completed`
   - session must belong to that `productId`
   - outcome must be `eligible` or `requires_review`
3. Outcomes `ineligible` / `recommend_alternative` → API returns **400**; disable confirm in UI.
4. `userId` in body is ignored for patients (forced to the authenticated user).

---

### Update order (header only)

```http
PATCH /api/patient/orders/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "confirmed",
  "notes": "Please ship Mon–Fri"
}
```

Can update: `status`, `notes`, `currency`, `subtotal`, `total`.

**Cannot** add/remove/edit line items after create.  
To change lines: create a new draft order (or keep cart only on the client until submit).

Moving `draft` → non-draft re-validates assessment requirements on existing lines.

---

## 8. Suggested front data model

```ts
type CheckoutContext = {
  product: Product;
  assessmentRequired: boolean;
  assignment: Assignment | null;
  assessment: AssessmentWizard | null;
  activeSession: SessionSummary | null;
  latestCompletedSession: SessionSummary | null;
};

type CartLine = {
  productId: number;
  productPresentationId?: number | null;
  quantity: number;
  unitPrice?: number | null;
  assessmentSessionId?: number | null; // set after complete
  outcome?: string | null;             // gate UI confirm
};
```

Keep `assessmentSessionId` per cart line (not global), because different products may need different sessions.

---

## 9. Minimal integration checklist

- [ ] Login → store JWT → send `Authorization: Bearer …`
- [ ] Product list / detail from `/api/catalog/...`
- [ ] Always call `checkout-context` before buy
- [ ] If `assessmentRequired`, render wizard from `assessment.steps`
- [ ] Resume `activeSession` when present
- [ ] Save answers incrementally; complete once
- [ ] Gate checkout by `outcome`
- [ ] `POST /api/patient/orders` with `details[]` + `assessmentSessionId` where needed
- [ ] Show order history via `GET /api/patient/orders`

---

## 10. Local demo data

After migrations:

```bash
docker compose exec next-app npx prisma db seed
```

Includes (unless `SEED_EF_DEMO=false`):

- Category: Longevity & Cellular Health  
- Products: `nad-plus`, `mots-c`  
- Published assessment + assignment on NAD+

Use Swagger or the patient flow above against those IDs.

---

## 11. Out of scope (do not expect yet)

| Topic | Status |
|-------|--------|
| Separate `/order-details` CRUD | Not available — nested only |
| Blocking orders on `requires_review` (Option A) | Deferred |
| Guest / unauthenticated catalog | Not available — JWT required |
| Real payment / pricing engine | `unitPrice` optional; may be null |
| GraphQL | REST only |

---

## 12. Quick endpoint map

| Method | Path | Permission |
|--------|------|------------|
| `POST` | `/api/auth/login` | — |
| `POST` | `/api/auth/logout` | auth |
| `GET` | `/api/catalog/categories` | `catalog.read` |
| `GET` | `/api/catalog/products` | `catalog.read` |
| `GET` | `/api/catalog/products/:id` | `catalog.read` |
| `GET` | `/api/catalog/products/:id/checkout-context` | `catalog.read` |
| `POST` | `/api/assessment-sessions` | `assessment_sessions.create` |
| `GET` | `/api/assessment-sessions/:id` | `assessment_sessions.read` |
| `PUT` | `/api/assessment-sessions/:id/answers` | `assessment_sessions.update` |
| `POST` | `/api/assessment-sessions/:id/complete` | `assessment_sessions.complete` |
| `GET` | `/api/patient/orders` | `orders.read` |
| `POST` | `/api/patient/orders` | `orders.create` |
| `GET` | `/api/patient/orders/:id` | `orders.read` |
| `PATCH` | `/api/patient/orders/:id` | `orders.update` |

Interactive exploration: **http://localhost:3000/docs** (tags: Catalog, Assessment Sessions, Patient / Orders).
