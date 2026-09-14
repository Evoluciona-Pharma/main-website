# Pending — forward draft orders to the external service

**Status:** not in v1. Today `POST /api/patient/orders` **only persists to the hub DB** (`status: "draft"`).

When product confirms the external sync, **do not invent this payload in the frontend**. The hub API should enrich the saved order (product name, presentation label, qty, `notes`, dummy/real prices) and POST to the external service.

## What the portal sends today (DB only)

```json
{
  "status": "draft",
  "notes": "wizard flattened as text",
  "details": [{ "productId": 1, "productPresentationId": 2, "quantity": 2 }]
}
```

Omitted on purpose: `unitPrice`, `currency`, `userId`, `assessmentSessionId`, `subtotal`, `total`.

## Approximate payload for the external service (ticket, dummy prices)

See the ticket comment (2026-09-14). Shape to expect:

- `orderNumber`, `status`, `currency`, `subtotal`, `total`
- `provider` (name, role, email, phone, license, state)
- `practice` (name, type, address, website)
- `notes` (message, hearAbout, attestation, interests)
- `lines[]` with `productName`, `slug`, `presentation`, `quantity`, `unitPrice`, `lineTotal`

Prices in that example are **dummy**. The portal still does not collect pricing.

## Blocked on

- External service contract (required fields)
- Whether backend or a later job performs the forward
- Real price source (not this frontend)
