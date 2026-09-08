# Dudas de API — integración Evoluciona (productos, órdenes, assessments)

Documento de trabajo para alinear **este frontend** (portal de proveedores, mismas vistas) con `custom-hub-api`.

**Fuente del contrato:** `evolucion-farma-frontend-integration.md`  
**Alcance v1:** catálogo + crear orden al submit.  
**Después:** assessments.  
**Fuera:** pantallas nuevas, precios en UI, historial de órdenes (no hay vista).

Cómo usar este archivo: cada pregunta tiene una **propuesta del front**. Backend (o producto) responde sí / no / alternativa. Con eso se puede empezar a integrar.

---

## 0. Respuesta corta: ¿omitimos campos o mandamos los que tenemos?

Hay **dos direcciones**. No es lo mismo.

### A. Campos de la API que este front no muestra (v1)

**Sí: no se usan, no se mandan**, si el backend los trata como opcionales.

| Campo API | ¿Lo tenemos en UI? | v1 |
|-----------|--------------------|----|
| `unitPrice` | No, y no debe aparecer | **Omitir.** Nunca mandar un precio inventado. |
| `currency` | No | **Omitir** (o confirmar default `USD` si el backend lo exige). |
| `assessmentSessionId` | No (después) | **Omitir.** Solo es válido si la orden es `draft`. |
| `details[].status` (`pending` / `approved` / …) | No | **Omitir.** |
| `subtotal` / `total` en create o PATCH | No | **Omitir.** |
| `userId` en el body | Lo impone el JWT | **No mandar.** El guide dice que se ignora. |

La orden v1 debería ser solo esto:

```json
{
  "status": "draft",
  "notes": "<mensaje del paso 4, y/o bloque de contacto/práctica si ustedes lo quieren>",
  "details": [
    {
      "productId": 1,
      "productPresentationId": 2,
      "quantity": 1
    }
  ]
}
```

Si algún campo de esa lista mínima es en realidad obligatorio (p. ej. `currency`, o `productPresentationId` cuando el producto tiene presentaciones), hay que decirlo: el guide los marca opcionales y el front se apoya en eso.

### B. Campos que SÍ tenemos en el wizard y la API no acepta

**No se pueden mandar como campos de primer nivel.** El `POST /api/patient/orders` no tiene licencia, NPI, consultorio, estado, practice type, etc.

Esos datos **siguen en el wizard** (la vista no se toca). Opciones:

1. **Quedan solo en el cliente** — la orden guarda líneas + `notes` con el mensaje libre. El resto se pierde al recargar, salvo `sessionStorage`.
2. **Van serializados dentro de `notes`** — un texto o JSON con contacto/práctica para que el representante / admin los lea.
3. **Backend agrega campos de provider más adelante** — entonces el wizard ya está listo para mapearlos.

**Propuesta v1:** (2) si `notes` aguanta el volumen; si no, (1) y el representante usa el email del usuario logueado.

El wizard **no se elimina**: es la UX de “request”, no el schema de la orden.

### C. Lo que sí hay que “tener” aunque no se vea

`productId` y `productPresentationId` **no salen del formulario**. Salen del catálogo al hacer “Add to Request List”. Hoy la lista solo guarda `{ name, program, presentation }` (texto). Hay que enriquecer ese objeto en memoria; no es un campo nuevo en pantalla.

---

## 1. Identidad y auth

El guide es un flujo **patient** con JWT en **todos** los endpoints de catálogo. Este sitio es un **provider portal** con browse abierto y Account inerte.

| # | Pregunta | Por qué importa | Propuesta del front |
|---|----------|-----------------|---------------------|
| A1 | ¿El `user` del JWT **es el provider** (rol `user` / `catalog.read` + `orders.*`), o hay un rol/permisos distintos para clínica? | Si es patient-only, este portal está usando el contrato equivocado. | Tratar `user` como el provider logueado. |
| A2 | ¿Catálogo **sin** JWT en v1, o login obligatorio antes de `/shop`? El §11 dice guest catalog *not available*. | Sin guest, no se puede llenar shop/ficha como hoy. | Ideal: `GET /api/catalog/*` público. Si no: login en el botón Account, y shop espera token. |
| A3 | Si hace falta login: ¿cuándo? ¿Al entrar al sitio, al abrir shop, o solo al **Submit request**? | Cambia si el catálogo se puede cachear en cliente o no. | Mínimo: token antes del `POST` de orden. Preferible: también para leer productos, si A2 no da guest. |
| A4 | ¿Login es email + password contra `POST /api/auth/login`? ¿Hay register, forgot password, refresh token, expiración del JWT? | Account hoy no tiene UI. Un modal cubre login; register/forgot **serían vista nueva** (fuera de v1). | Solo login + logout. Sin register en este front hasta que exista pantalla. |
| A5 | ¿Hay usuarios demo (email/password) para desarrollo? | El seed menciona productos, no un provider. | Un user `provider@…` con `catalog.read` y `orders.*`. |
| A6 | ¿CORS: orígenes permitidos para `localhost:3001` (o el puerto del Next) y el dominio Pages (`evoluciona-pharma.github.io`)? | Front y API no pueden compartir `:3000`. | API en otro puerto/host; `NEXT_PUBLIC_API_URL`; CORS explícito. |
| A7 | ¿El email/nombre del wizard deben coincidir con el `user` del JWT, o el wizard es “datos de la clínica” independientes? | Hoy el wizard pide Name/Email propios. El `userId` de la orden es el del token. | Independientes; el token identifica quién pide, el wizard es el contacto clínico. |

---

## 2. Catálogo / productos

Hoy todo vive en `data/catalog.json` (8 productos, 6 programas, slugs tipo `nad`). La API lista por `id` numérico; el seed usa `nad-plus` vs nuestro `nad`.

### 2.1 Contrato de datos (necesitamos el JSON real)

| # | Pregunta | Por qué importa | Propuesta del front |
|---|----------|-----------------|---------------------|
| P1 | ¿Pueden pegar un ejemplo **real** de `GET /api/catalog/products` y `GET /api/catalog/products/:id` (un ítem completo)? El guide no define el schema. | Sin esto el mapper a la ficha/shop es adivinanza. | OpenAPI o un JSON de NAD+ y uno de MOTS-C. |
| P2 | ¿Existe `slug` estable y único? ¿Se puede rutear `/products/:slug` o solo `/products/:id`? | Todas las URLs actuales son slug. Cambiar a id rompe links y SSG. | Campo `slug` en el producto (`nad`, `bpc-157`, …). Si el API usa `nad-plus`, confirmar el valor canónico. |
| P3 | ¿`categories` = nuestros **programs** (Longevity, Recovery, Hormone, …)? ¿Un producto puede tener categoría secundaria (`programAlt`)? | El shop filtra por programa. | `category.id` + `category.name` + `category.slug`. `programAlt` opcional. |
| P4 | Shape de `presentations[]`: ¿`{ id, label, … }`? ¿El label es exactamente `"5 mL"` / `"10 mL"`? | La orden necesita `productPresentationId`; la UI muestra el label. | `id` number + `label` string. |
| P5 | ¿Hay productos **sin** presentación (MOTS-C *pending*)? ¿Se puede crear línea **sin** `productPresentationId`? | El guide lo marca opcional; hay que confirmarlo en negocio. | Permitir `null` / omitir. En UI: “Presentation pending confirmation”. |
| P6 | ¿Hay `concentration`, `concentrationStatus`, `presentationStatus` (`confirmed` / `pending` / `on-label`)? | Copy legal: no inventar valores pending. | Si no vienen, el front no los muestra (no estima). |
| P7 | ¿`content` / sections cubren `description`, `howSupplied`, `tagline`, `blurb`, `spec`? ¿Qué shape (`[{ title, body }]`, HTML, markdown)? | La ficha tiene acordeones fijos. | Mapear lo que venga; lo que falte se oculta, no se rellena desde `catalog.json` mezclado (fuente única = API). |
| P8 | ¿Imágenes? ¿URL absoluta, path, varias vistas (front / label / scale / carton)? | Hoy 1 foto local vía `asset()`; el resto son placeholders. | Array de URLs; si viene una sola, la galería usa esa. |
| P9 | ¿`featured` es campo boolean en el producto o solo query `?featured=true`? ¿Hay `badge` (`Featured` / `New`)? | Sort “Featured” y chips del shop. | Boolean `featured` + `badge` opcional. |
| P10 | ¿Related products y `pairsWith` vienen en el detail? | Rail “You may also review” y card de pairing. | Array de productos resumidos o ids. |
| P11 | ¿Paginación en list? ¿Límite? | 8 SKUs caben en un GET; si crece, el typeahead local se queda corto. | Un solo GET sin paginar en v1, o `pageSize` alto. |
| P12 | ¿Hay búsqueda de texto en API (`?q=`)? | Nav typeahead y `?q=` del shop son cliente. | v1: filtrar en cliente sobre el listado. Endpoint `q` más adelante. |
| P13 | ¿Filtro por presentación (5 mL / 10 mL / pending) en API? | Facetas del shop. | v1: cliente. |
| P14 | ¿Solo productos `active`? ¿Qué pasa si un ítem de la request list se desactiva entre add y submit? | El create exige producto active al confirmar; en `draft` no está claro. | `draft` debe aceptar el snapshot o devolver 400 claro. |
| P15 | ¿El catálogo de prod/staging ya tiene los **8 productos y 6 programas**, o solo el seed (Longevity + NAD+ / MOTS-C)? | Shop/home se ven vacíos con 2 SKUs. | Catálogo real (o seed ampliado) **antes** de integrar UI. |
| P16 | Copy de compliance (strip, disclaimers, attestation): ¿sigue 100% local? | No está en esta API. | Local, no se toca. |

---

## 3. Órdenes (v1)

Flujo actual: lista en cliente → wizard 4 pasos → submit inventa `REQ-2026-xxxx` → confirmation.  
Objetivo: el submit hace `POST /api/patient/orders`.

### 3.1 Payload y reglas

| # | Pregunta | Por qué importa | Propuesta del front |
|---|----------|-----------------|---------------------|
| O1 | ¿Confirmado: `status: "draft"` **nunca** exige assessment, aunque el producto tenga assignment (NAD+ en el seed)? | Es la única forma de integrar órdenes **sin** assessments. | Sí. v1 **siempre** `draft`. |
| O2 | ¿`draft` es el status correcto para una “information request” de provider, o prefieren `pending_review`? | `pending_review` es non-draft → exige assessment si el producto lo tiene → 400 en NAD+. | `draft` hasta que existan assessments o un status “request” que no exija session. |
| O3 | ¿Quién pasa `draft` → `confirmed` / `processing`? ¿Solo admin? ¿El provider puede PATCH? | El front no va a confirmar compras en v1. | Front no hace PATCH de status. |
| O4 | ¿`unitPrice` omitido es válido? ¿El backend pone null / 0 / calcula? | No pricing online. | Omitir siempre. Si el API rechaza, hay que cambiar el API, no el UI. |
| O5 | ¿`currency` se puede omitir? Si no, ¿default? | No hay selector. | Omitir o `"USD"` si lo exigen, sin mostrarlo. |
| O6 | ¿`productPresentationId` es obligatorio cuando el producto **tiene** presentaciones? | Guide: opcional. UI: el user elige 5 mL / 10 mL. | Mandarlo si hay selección; omitirlo si pending. |
| O7 | ¿`quantity` default 1 si se omite? El drawer ya tiene 1–20 pero **no se persiste** hoy. | Hay que guardarlo en la lista. | Mandar siempre `quantity` (min 1). |
| O8 | ¿Se permiten dos líneas del mismo `productId` con distinta presentación? Hoy la lista **dedupea por nombre** y solo actualiza presentación. | Comportamiento actual: un producto = una línea. | Seguir: una línea por producto; cambiar presentación actualiza la línea. |
| O9 | ¿`notes` acepta texto largo / JSON? ¿Límite de caracteres? | Opción de volcar el wizard (ver §0.B). | Confirmar max length. Si ≥ 4–8 KB, mandamos un bloque estructurado. |
| O10 | ¿Quieren que `notes` incluya el wizard (contacto, licencia, práctica, attestation)? ¿Formato acordado? | Si no, esos datos no llegan al backoffice. | Ver bloque propuesto abajo. |
| O11 | Respuesta del `POST`: ¿viene `id`, `uuid`, `status`, `details[]`? ¿Hay **número de referencia** tipo `REQ-…` o usamos el `id` numérico? | Confirmation muestra “Reference …”. | Preferible un `reference` / `orderNumber` estable. Si no, mostrar `id`. |
| O12 | Envelope de error: shape de `errors` en 400 (por campo, por línea, mensaje único). | El submit tiene que mostrar algo en el paso 4, sin pantalla nueva. | Ejemplo real de 400 (producto inactivo, presentation ajena, assessment missing). |
| O13 | Carrito en cliente hasta el submit: ¿correcto? (no se pueden editar líneas después del create). | Coincide con el guide. | No usamos draft-como-carrito en servidor en v1. |
| O14 | ¿Varios `draft` abiertos por user, o uno solo? | Submit repetido. | Permitir varios; cada submit = una orden nueva. |
| O15 | ¿`GET /api/patient/orders/:id` post-create para armar confirmation, o basta el `data` del POST? | Menos round-trips. | Usar el `data` del POST. |
| O16 | Historial (`GET /api/patient/orders`): ¿existe pantalla prevista? Hoy no. | Fuera de v1 si no hay vista. | No integrar listado hasta que Account/historial exista. |
| O17 | Auth en el POST: si el user no está logueado al llegar a Submit, ¿interrupt con el modal Account y reintentar, o bloquear el wizard desde el paso 1? | No hay pantalla de login. | Modal en Submit (o al entrar a `/request/contact`). |

### 3.2 Wizard → `notes` (propuesta, pendiente de O9/O10)

Campos que **no van** en el schema de la orden y que el front ya captura:

**Paso 1 Contact:** `name`, `role`, `email`, `phone`, `license`, `licensedState`  
**Paso 2 Practice:** `practiceName`, `website`, `address`, `city`, `state`, `zip`  
**Paso 3 Profile:** `practiceType`, `interests[]`  
**Paso 4 Additional:** `message`, `hearAbout`, `attestation` (boolean)

Propuesta de `notes` (texto, no HTML):

```text
Message: …
Hear about: …
Attestation: yes

Contact: {name} · {role} · {email} · {phone}
License/NPI: {license} ({licensedState})
Practice: {practiceName} · {practiceType}
Address: {address}, {city}, {state} {zip}
Website: {website}
Interests: NAD+, BPC-157, …
```

Si el backend **no** quiere esto en `notes`, el front manda solo `message` (o `notes: null`) y el resto queda local.

---

## 4. Assessments (después — para tenerlo claro, no implementar)

No se construye wizard de assessment ni se llama `checkout-context` en v1. Igual hay que cerrar el contrato para no pintar la orden a un rincón.

| # | Pregunta | Por qué importa | Propuesta / supuesto |
|---|----------|-----------------|----------------------|
| S1 | ¿El assessment es **del paciente** (edad, embarazo) o del **provider**? En un portal B2B las preguntas del seed no encajan. | Puede ser que assessments **no deban** entrar nunca a este front, y sí a otra app patient. | Confirmar audiencia. Si es patient-only, este repo no los implementa. |
| S2 | ¿Se exige por producto (`assignment`) al pasar de `draft` → non-draft? | El día que alguien PATCH a `confirmed`, NAD+ va a 400 sin session. | Admin confirma en backoffice, o el front no PATCHea. |
| S3 | ¿v2 se engancha en la **ficha** o en el **drawer**, sin ruta nueva? | “No crear vistas nuevas.” | Overlay/stepper dentro de product o request, no `/assessment`. |
| S4 | ¿Se puede reusar `latestCompletedSession` en la línea (`assessmentSessionId`) sin repetir el wizard? | Guide lo sugiere. | Sí, si el outcome sigue siendo `eligible` / `requires_review`. |
| S5 | ¿Las sessions vencen? | Un eligible de hace 6 meses puede no valer. | Confirmar TTL. |
| S6 | Outcomes: `ineligible` y `recommend_alternative` bloquean confirm (400). ¿`requires_review` sigue dejando ordenar (Option C)? | El guide dice que sí, Option A deferred. | UI: `ineligible` no confirma; `requires_review` deja seguir. |
| S7 | `answerText` vs `answerValues` por `questionType` (`text`, `number`, `single_choice`, `multiple_choice`, `height_weight`, …). ¿Ejemplo de `height_weight`? | Sin ejemplo el mapper de respuestas se inventa. | Un JSON de answers por cada tipo. |
| S8 | ¿El 4-step de **request** y el wizard de **assessment** son flujos distintos (sí)? | No reutilizar `/request/*` para preguntas médicas. | Request = provider. Assessment = otro paso, más tarde. |
| S9 | En v1, ¿podemos **ignorar por completo** `GET .../checkout-context`? | Evita acoplar el add-to-list al assessment. | Sí. Add to list no llama checkout-context. |

---

## 5. Entorno y operación

| # | Pregunta | Propuesta |
|---|----------|-----------|
| E1 | Base URL local, staging, prod (el guide pone API en `:3000`, igual que este Next). | `NEXT_PUBLIC_API_URL`, API en otro puerto. |
| E2 | ¿Swagger/OpenAPI accesible para el equipo front (`/api/docs/openapi`)? | Sí, y un export JSON en repo o URL estable. |
| E3 | ¿Este front sigue siendo static export (GitHub Pages) con fetch en cliente? | Sí, v1. CORS tiene que permitir Pages. |
| E4 | ¿Headers extra (API key, tenant)? El guide solo menciona Bearer. | Solo `Authorization: Bearer`. |

---

## 6. Qué necesitamos para empezar a codear (mínimo)

No hace falta tener assessments ni historial. Bloquea empezar:

1. **A1 + A2 + A6** — quién es el user, catálogo con/sin JWT, URL/CORS.
2. **P1 + P2 + P4 + P15** — JSON real de producto, slug, presentaciones con id, catálogo más completo que el seed de 2 SKUs.
3. **O1 + O4 + O11 + O12** — `draft` sin assessment, `unitPrice` omitible, shape del POST ok y de error.
4. **O9 + O10** — si el wizard va en `notes` o se descarta.

Con eso se integra: shop, ficha, lista, submit → `draft`, confirmation.

Queda para una segunda conversación: A4 register, P12 search API, O16 historial, todo el §4.

---

## 7. Resumen de campos (chuleta)

**Mandamos en v1**

- Auth: email/password → token (cuando A3 lo pida)
- Orden: `status: "draft"`, `details[{ productId, productPresentationId?, quantity }]`, `notes?`
- Productos: solo lectura

**No mandamos en v1**

- `unitPrice`, `currency` (salvo que O5 lo exija), `assessmentSessionId`, `userId`, `subtotal`, `total`, line `status`

**Capturamos en UI y la API hoy no tiene campo**

- Todo el wizard de request (contacto, licencia, práctica, profile, attestation, hearAbout)
- Destino: `notes` (O10) o solo cliente

**La API tiene y este front no va a usar todavía**

- Assessment sessions + checkout-context
- Listado de órdenes
- PATCH de orden
- Precios
- Admin CRUD
