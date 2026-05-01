# cloudfire-apiv1 v2 — Clean Code Stack Upgrade

**Date:** 2026-05-01  
**Status:** Approved  
**Scope:** Migrate apiv1 to Drizzle ORM + Chanfana + Zod v4 with Clean Code architecture, adding categories, users, and orders resources.

---

## 1. Motivation

The current API uses raw SQL strings, no schema validation library, and all concerns (validation, DB access, HTTP response) are mixed inside each route handler. This upgrade separates those concerns into distinct layers, adds OpenAPI documentation, and type-safe database access.

---

## 2. Stack Changes

| Layer | Before | After |
|---|---|---|
| Framework | Hono | Hono + Chanfana (OpenAPIHono) |
| Database access | Raw D1 SQL | Drizzle ORM (`drizzle-orm/d1`) |
| Validation | Manual `if` checks | Zod v4 schemas |
| API docs | None | OpenAPI 3.1 via Chanfana (`/docs`) |
| Auth | API Key middleware | API Key middleware (unchanged) |
| Rate limiting | None | None (out of scope) |

---

## 3. Clean Code Architecture

```
src/
├── db/
│   ├── schema.ts              # Drizzle table definitions (single source of truth)
│   └── index.ts               # createDb(d1: D1Database) → DrizzleD1Database
├── schemas/                   # Zod v4 shapes used by Chanfana for OpenAPI + validation
│   ├── items.schema.ts
│   ├── categories.schema.ts
│   ├── users.schema.ts
│   └── orders.schema.ts
├── repositories/              # All D1 access via Drizzle — no SQL outside this layer
│   ├── items.repository.ts
│   ├── categories.repository.ts
│   ├── users.repository.ts
│   └── orders.repository.ts
├── services/
│   └── orders.service.ts      # Only file with business logic (total calc, order_items)
├── routes/                    # Thin HTTP handlers: parse → call repo/service → respond
│   ├── items.ts
│   ├── categories.ts
│   ├── users.ts
│   └── orders.ts
├── middleware/
│   └── apiKey.ts              # Unchanged
├── index.ts                   # Mounts OpenAPIHono, registers routes, serves /docs
└── types.ts                   # Inferred types from Drizzle schema (replaces manual types)
```

**Rule:** Routes call repositories directly for simple CRUD. Routes call services for business logic. Services call repositories. No layer skips another.

---

## 4. Data Model

### Tables

```sql
categories
  id           INTEGER PRIMARY KEY AUTOINCREMENT
  name         TEXT NOT NULL (max 100)
  description  TEXT (max 500, nullable)
  created_at   TEXT NOT NULL DEFAULT datetime('now')

users
  id           INTEGER PRIMARY KEY AUTOINCREMENT
  name         TEXT NOT NULL (max 100)
  email        TEXT NOT NULL UNIQUE (max 200)
  created_at   TEXT NOT NULL DEFAULT datetime('now')

items
  id           INTEGER PRIMARY KEY AUTOINCREMENT
  name         TEXT NOT NULL (max 200)
  description  TEXT (max 1000, nullable)
  price        REAL NOT NULL (0–999999)
  category_id  INTEGER (nullable, FK → categories.id)
  created_at   TEXT NOT NULL DEFAULT datetime('now')

orders
  id           INTEGER PRIMARY KEY AUTOINCREMENT
  user_id      INTEGER NOT NULL (FK → users.id)
  status       TEXT NOT NULL DEFAULT 'pending' (pending|confirmed|shipped|delivered)
  total        REAL NOT NULL DEFAULT 0
  created_at   TEXT NOT NULL DEFAULT datetime('now')

order_items
  id           INTEGER PRIMARY KEY AUTOINCREMENT
  order_id     INTEGER NOT NULL (FK → orders.id)
  item_id      INTEGER NOT NULL (FK → items.id)
  quantity     INTEGER NOT NULL (min 1)
  unit_price   REAL NOT NULL (snapshot of item price at order time)
```

### Relationships

- `items.category_id` → `categories.id` (nullable — item can exist without category)
- `orders.user_id` → `users.id` (required)
- `order_items.order_id` → `orders.id`
- `order_items.item_id` → `items.id`

---

## 5. API Endpoints

All GET endpoints are public. POST / PUT / DELETE require `X-API-Key` header.  
`GET /docs` serves the Chanfana OpenAPI UI.

### PR 1 — Infrastructure + items migration
```
GET    /                        Health check {name, status, version}
GET    /docs                    OpenAPI 3.1 UI
GET    /items                   List items (optional ?category_id= filter)
GET    /items/:id               Get one item
POST   /items                   Create item {name, description?, price, category_id?}
PUT    /items/:id               Update item (partial)
DELETE /items/:id               Delete item
```

### PR 2 — categories
```
GET    /categories              List all categories
GET    /categories/:id          Get one category
POST   /categories              Create {name, description?}
PUT    /categories/:id          Update (partial)
DELETE /categories/:id          Delete category
```

### PR 3 — users
```
GET    /users                   List all users
GET    /users/:id               Get one user
POST   /users                   Create {name, email}
PUT    /users/:id               Update (partial)
DELETE /users/:id               Delete user
```

### PR 4 — orders
```
GET    /orders                  List orders (includes user info)
GET    /orders/:id              Get order with full order_items + item details
POST   /orders                  Create order {user_id, items: [{item_id, quantity}]}
                                → service fetches item prices, creates order_items, calculates total
PUT    /orders/:id              Update status only {status}
DELETE /orders/:id              Delete order + cascade order_items
```

---

## 6. orders.service.ts Logic

`createOrder(db, { user_id, items })`:
1. Verify `user_id` exists → 404 if not
2. Fetch each `item_id` from DB → 404 if any missing
3. Calculate `total = sum(item.price * quantity)`
4. Insert into `orders` (status: pending, total)
5. Insert all rows into `order_items` (with `unit_price` snapshot)
6. Return order with nested `order_items`

`unit_price` is snapshotted at order creation time so price changes don't affect historical orders.

---

## 7. GitHub Flow

**Strategy:** Option C — one issue + one feature branch + one PR per resource.

| # | Issue title | Branch | PR | Depends on |
|---|---|---|---|---|
| 1 | `feat: migrate infra to Drizzle + Chanfana + Zod v4` | `feat/infra-drizzle-chanfana` | PR 1 | — |
| 2 | `feat: categories resource` | `feat/categories` | PR 2 | PR 1 merged |
| 3 | `feat: users resource` | `feat/users` | PR 3 | PR 1 merged |
| 4 | `feat: orders resource with order_items` | `feat/orders` | PR 4 | PR 1 + PR 3 merged |

PR 2 and PR 3 can be worked on in parallel after PR 1 merges.  
Each issue is added to the existing GitHub Project board.  
Each PR targets `main`. CI runs on push: lint → typecheck → tests.  
Merge to `main` triggers automatic deploy to production (existing workflow).

---

## 8. Testing Strategy

- Each PR includes tests for its own resource in `src/__tests__/`
- `helpers/d1-mock.ts` extended per PR to support new tables
- Route tests via `app.fetch` (integration style, existing pattern)
- Repository functions testable in isolation with mock DB
- PR 4 (orders) includes service unit tests for `createOrder` logic

---

## 9. Migration

New migration file `migrations/0002_v2_schema.sql` added in PR 1:
- Adds `categories`, `users`, `orders`, `order_items` tables
- Adds `category_id` column to `items`

Existing `items` data is preserved. `category_id` is nullable so no backfill needed.

---

## 10. Out of Scope

- Rate limiting
- User authentication / JWT
- Pagination (list endpoints return all rows)
- Soft deletes
