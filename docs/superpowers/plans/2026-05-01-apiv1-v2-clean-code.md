# apiv1 v2 — Clean Code Stack Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate cloudfire-apiv1 to Drizzle ORM + Chanfana (OpenAPI) + Zod v4 with Clean Code layered architecture, adding categories, users, and orders resources across 4 PRs.

**Architecture:** Routes are thin HTTP handlers that call repositories (data layer) or services (business logic). Zod schemas define both validation rules and OpenAPI shapes via Chanfana. No SQL exists outside of repositories.

**Tech Stack:** Hono, Chanfana, Drizzle ORM (drizzle-orm/d1), Zod v4, Vitest, better-sqlite3 (tests), Cloudflare Workers + D1.

---

## File Map

```
src/
├── db/
│   ├── schema.ts                          CREATE — Drizzle table definitions
│   └── index.ts                           CREATE — createDb() factory
├── schemas/
│   ├── items.schema.ts                    CREATE — Zod shapes for items
│   ├── categories.schema.ts               CREATE — Zod shapes for categories
│   ├── users.schema.ts                    CREATE — Zod shapes for users
│   └── orders.schema.ts                   CREATE — Zod shapes for orders
├── repositories/
│   ├── items.repository.ts                CREATE — D1 queries for items via Drizzle
│   ├── categories.repository.ts           CREATE — D1 queries for categories
│   ├── users.repository.ts                CREATE — D1 queries for users
│   └── orders.repository.ts               CREATE — D1 queries for orders + order_items
├── services/
│   └── orders.service.ts                  CREATE — createOrder business logic
├── routes/
│   ├── items.ts                           CREATE — replaces index.ts items handlers
│   ├── categories.ts                      CREATE
│   ├── users.ts                           CREATE
│   └── orders.ts                          CREATE
├── middleware/
│   └── apiKey.ts                          UNCHANGED
├── index.ts                               MODIFY — mount OpenAPIHono + all routes
└── types.ts                               MODIFY — inferred from Drizzle schema
src/__tests__/
├── helpers/
│   └── d1-mock.ts                         MODIFY — replace regex mock with better-sqlite3
├── setup.ts                               MODIFY — export SCHEMA, keep createTestEnv
├── items.test.ts                          MODIFY — adapt to new stack
├── categories.test.ts                     CREATE
├── users.test.ts                          CREATE
└── orders.test.ts                         CREATE
migrations/
└── 0002_v2_schema.sql                     CREATE — adds all new tables + category_id to items
```

---

## PR 1 — Infrastructure + Items Migration

**Branch:** `feat/infra-drizzle-chanfana`  
**Depends on:** nothing (first PR)

---

### Task 1: GitHub — issue, project, branch

- [ ] **Step 1: Find the GitHub project number**

```bash
gh project list --owner wrcp20
```

Note the number of the cloudfire project board (e.g. `1`). Use it in the next step.

- [ ] **Step 2: Create issue**

```bash
gh issue create \
  --title "feat: migrate infra to Drizzle + Chanfana + Zod v4" \
  --body "Migrate apiv1 to Clean Code architecture with Drizzle ORM, Chanfana OpenAPI docs, and Zod v4 validation. Migrate existing items resource to new stack. Part of v2 upgrade." \
  --label "enhancement"
```

Note the issue URL and number printed (e.g. `#5`).

- [ ] **Step 3: Add issue to project board**

```bash
gh project item-add <PROJECT_NUMBER> --owner wrcp20 --url <ISSUE_URL>
```

- [ ] **Step 4: Create and switch to feature branch**

```bash
git checkout main && git pull origin main
git checkout -b feat/infra-drizzle-chanfana
```

---

### Task 2: Install dependencies

- [ ] **Step 1: Add production dependencies to package.json**

Modify `package.json` — add to `"dependencies"`:

```json
"chanfana": "^2.4.3",
"drizzle-orm": "^0.43.1",
"zod": "^4.0.0"
```

- [ ] **Step 2: Add dev dependencies to package.json**

Add to `"devDependencies"`:

```json
"@types/better-sqlite3": "^7.6.13",
"better-sqlite3": "^11.10.0"
```

- [ ] **Step 3: Install inside Docker**

```bash
docker compose run --rm test npm install
```

Expected: `added N packages` with no errors.

---

### Task 3: Drizzle schema and DB factory

- [ ] **Step 1: Create `src/db/schema.ts`**

```typescript
import { sql } from 'drizzle-orm'
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const items = sqliteTable('items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  price: real('price').notNull().default(0),
  category_id: integer('category_id').references(() => categories.id),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').notNull().references(() => users.id),
  status: text('status', { enum: ['pending', 'confirmed', 'shipped', 'delivered'] })
    .notNull()
    .default('pending'),
  total: real('total').notNull().default(0),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const orderItems = sqliteTable('order_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  order_id: integer('order_id').notNull().references(() => orders.id),
  item_id: integer('item_id').notNull().references(() => items.id),
  quantity: integer('quantity').notNull(),
  unit_price: real('unit_price').notNull(),
})
```

- [ ] **Step 2: Create `src/db/index.ts`**

```typescript
import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema })
}

export type AppDb = ReturnType<typeof createDb>
```

---

### Task 4: Migration file

- [ ] **Step 1: Create `migrations/0002_v2_schema.sql`**

```sql
ALTER TABLE items ADD COLUMN category_id INTEGER REFERENCES categories(id);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  total REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  item_id INTEGER NOT NULL REFERENCES items(id),
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL
);
```

---

### Task 5: Update types.ts

- [ ] **Step 1: Replace `src/types.ts` entirely**

```typescript
import type { InferSelectModel } from 'drizzle-orm'
import type * as schema from './db/schema'

export type Category = InferSelectModel<typeof schema.categories>
export type User = InferSelectModel<typeof schema.users>
export type Item = InferSelectModel<typeof schema.items>
export type Order = InferSelectModel<typeof schema.orders>
export type OrderItem = InferSelectModel<typeof schema.orderItems>

export type Bindings = {
  DB: D1Database
  API_KEY: string
  ALLOWED_ORIGIN: string
}
```

---

### Task 6: Items Zod schema

- [ ] **Step 1: Create `src/schemas/items.schema.ts`**

```typescript
import { z } from 'zod'

export const ItemSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  category_id: z.number().int().nullable(),
  created_at: z.string(),
})

export const CreateItemSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  price: z.number().min(0).max(999_999),
  category_id: z.number().int().positive().nullable().optional(),
})

export const UpdateItemSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  price: z.number().min(0).max(999_999).optional(),
  category_id: z.number().int().positive().nullable().optional(),
})

export const ItemIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const ItemsQuerySchema = z.object({
  category_id: z.coerce.number().int().positive().optional(),
})
```

---

### Task 7: Items repository

- [ ] **Step 1: Create `src/repositories/items.repository.ts`**

```typescript
import { eq } from 'drizzle-orm'
import type { AppDb } from '../db'
import { items } from '../db/schema'
import type { Item } from '../types'

export async function findAllItems(db: AppDb, category_id?: number): Promise<Item[]> {
  if (category_id !== undefined) {
    return db.select().from(items).where(eq(items.category_id, category_id))
  }
  return db.select().from(items)
}

export async function findItemById(db: AppDb, id: number): Promise<Item | null> {
  const rows = await db.select().from(items).where(eq(items.id, id)).limit(1)
  return rows[0] ?? null
}

export async function createItem(
  db: AppDb,
  data: { name: string; description?: string | null; price: number; category_id?: number | null },
): Promise<Item> {
  const rows = await db
    .insert(items)
    .values({
      name: data.name.trim(),
      description: data.description ?? null,
      price: data.price,
      category_id: data.category_id ?? null,
    })
    .returning()
  return rows[0]!
}

export async function updateItem(
  db: AppDb,
  id: number,
  data: { name?: string; description?: string | null; price?: number; category_id?: number | null },
): Promise<Item | null> {
  const patch: Record<string, unknown> = {}
  if (data.name !== undefined) patch['name'] = data.name.trim()
  if ('description' in data) patch['description'] = data.description ?? null
  if (data.price !== undefined) patch['price'] = data.price
  if ('category_id' in data) patch['category_id'] = data.category_id ?? null
  if (Object.keys(patch).length === 0) {
    return findItemById(db, id)
  }
  const rows = await db.update(items).set(patch).where(eq(items.id, id)).returning()
  return rows[0] ?? null
}

export async function deleteItem(db: AppDb, id: number): Promise<boolean> {
  const rows = await db.delete(items).where(eq(items.id, id)).returning()
  return rows.length > 0
}
```

---

### Task 8: Items route with Chanfana

- [ ] **Step 1: Create `src/routes/items.ts`**

```typescript
import { OpenAPIRoute } from 'chanfana'
import { z } from 'zod'
import { createDb } from '../db'
import {
  createItem,
  deleteItem,
  findAllItems,
  findItemById,
  updateItem,
} from '../repositories/items.repository'
import {
  CreateItemSchema,
  ItemIdParamSchema,
  ItemSchema,
  ItemsQuerySchema,
  UpdateItemSchema,
} from '../schemas/items.schema'
import type { Bindings } from '../types'
import type { Context } from 'hono'

type AppCtx = Context<{ Bindings: Bindings }>

const ItemsResponse = z.object({ data: z.array(ItemSchema), count: z.number() })
const ItemResponse = z.object({ data: ItemSchema })
const NotFound = z.object({ error: z.string() })

export class ItemsList extends OpenAPIRoute {
  schema = {
    tags: ['Items'],
    summary: 'List all items',
    request: { query: ItemsQuerySchema },
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: ItemsResponse } } },
    },
  }
  async handle(c: AppCtx) {
    const query = ItemsQuerySchema.parse(Object.fromEntries(new URL(c.req.url).searchParams))
    const db = createDb(c.env.DB)
    const data = await findAllItems(db, query.category_id)
    return c.json({ data, count: data.length })
  }
}

export class ItemsGet extends OpenAPIRoute {
  schema = {
    tags: ['Items'],
    summary: 'Get item by ID',
    request: { params: ItemIdParamSchema },
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: ItemResponse } } },
      404: { description: 'Not found', content: { 'application/json': { schema: NotFound } } },
    },
  }
  async handle(c: AppCtx) {
    const { id } = ItemIdParamSchema.parse(c.req.param())
    const db = createDb(c.env.DB)
    const item = await findItemById(db, id)
    if (!item) return c.json({ error: 'Item no encontrado' }, 404)
    return c.json({ data: item })
  }
}

export class ItemsCreate extends OpenAPIRoute {
  schema = {
    tags: ['Items'],
    summary: 'Create item',
    security: [{ ApiKeyAuth: [] }],
    request: { body: { content: { 'application/json': { schema: CreateItemSchema } } } },
    responses: {
      201: { description: 'Created', content: { 'application/json': { schema: ItemResponse } } },
      422: { description: 'Validation error', content: { 'application/json': { schema: NotFound } } },
    },
  }
  async handle(c: AppCtx) {
    const result = CreateItemSchema.safeParse(await c.req.json().catch(() => null))
    if (!result.success) return c.json({ error: result.error.issues[0]?.message ?? 'Datos inválidos' }, 422)
    const db = createDb(c.env.DB)
    const item = await createItem(db, result.data)
    return c.json({ data: item }, 201)
  }
}

export class ItemsUpdate extends OpenAPIRoute {
  schema = {
    tags: ['Items'],
    summary: 'Update item',
    security: [{ ApiKeyAuth: [] }],
    request: {
      params: ItemIdParamSchema,
      body: { content: { 'application/json': { schema: UpdateItemSchema } } },
    },
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: ItemResponse } } },
      404: { description: 'Not found', content: { 'application/json': { schema: NotFound } } },
      422: { description: 'Validation error', content: { 'application/json': { schema: NotFound } } },
    },
  }
  async handle(c: AppCtx) {
    const { id } = ItemIdParamSchema.parse(c.req.param())
    const result = UpdateItemSchema.safeParse(await c.req.json().catch(() => null))
    if (!result.success) return c.json({ error: result.error.issues[0]?.message ?? 'Datos inválidos' }, 422)
    const db = createDb(c.env.DB)
    const item = await updateItem(db, id, result.data)
    if (!item) return c.json({ error: 'Item no encontrado' }, 404)
    return c.json({ data: item })
  }
}

export class ItemsDelete extends OpenAPIRoute {
  schema = {
    tags: ['Items'],
    summary: 'Delete item',
    security: [{ ApiKeyAuth: [] }],
    request: { params: ItemIdParamSchema },
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: z.object({ message: z.string() }) } } },
      404: { description: 'Not found', content: { 'application/json': { schema: NotFound } } },
    },
  }
  async handle(c: AppCtx) {
    const { id } = ItemIdParamSchema.parse(c.req.param())
    const db = createDb(c.env.DB)
    const deleted = await deleteItem(db, id)
    if (!deleted) return c.json({ error: 'Item no encontrado' }, 404)
    return c.json({ message: 'Item eliminado' })
  }
}
```

---

### Task 9: Update index.ts

- [ ] **Step 1: Replace `src/index.ts` entirely**

```typescript
import { fromHono } from 'chanfana'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { apiKeyAuth } from './middleware/apiKey'
import { ItemsCreate, ItemsDelete, ItemsGet, ItemsList, ItemsUpdate } from './routes/items'
import type { Bindings } from './types'

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', logger())
app.use('*', (c, next) => cors({ origin: c.env.ALLOWED_ORIGIN })(c, next))

app.get('/', (c) =>
  c.json({ name: 'cloudfire-apiv1', status: 'ok', version: '2.0.0' }),
)

// Auth middleware for all mutation routes
app.on(['POST', 'PUT', 'DELETE'], '/*', apiKeyAuth)

const openapi = fromHono(app, {
  docs_url: '/docs',
  openapi_url: '/openapi.json',
  schema: {
    info: { title: 'cloudfire-apiv1', version: '2.0.0' },
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      },
    },
  },
})

openapi.get('/items', ItemsList)
openapi.get('/items/:id', ItemsGet)
openapi.post('/items', ItemsCreate)
openapi.put('/items/:id', ItemsUpdate)
openapi.delete('/items/:id', ItemsDelete)

export default app
```

---

### Task 10: Replace d1-mock with better-sqlite3

- [ ] **Step 1: Replace `src/__tests__/helpers/d1-mock.ts` entirely**

```typescript
import BetterSqlite3 from 'better-sqlite3'

export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL DEFAULT 0,
    category_id INTEGER REFERENCES categories(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending',
    total REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    item_id INTEGER NOT NULL REFERENCES items(id),
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL
  );
`

export function createTestDb(schema: string = SCHEMA): D1Database {
  const sqlite = new BetterSqlite3(':memory:')
  sqlite.exec(schema)

  function makeStmt(query: string, args: unknown[] = []) {
    const stmt = sqlite.prepare(query)
    return {
      all: <T>() => Promise.resolve({ results: stmt.all(...args) as T[] }),
      first: <T>() => Promise.resolve((stmt.get(...args) ?? null) as T | null),
      run: () => {
        stmt.run(...args)
        return Promise.resolve({ success: true as const, results: [], meta: {} as D1Meta })
      },
      raw: <T>() => Promise.resolve([] as T[]),
    }
  }

  return {
    prepare: (query: string) => ({
      ...makeStmt(query),
      bind: (...args: unknown[]) => makeStmt(query, args),
    }),
    exec: (q: string) => {
      sqlite.exec(q)
      return Promise.resolve({ count: 0, duration: 0 })
    },
    batch: async () => [],
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database
}
```

- [ ] **Step 2: Update `src/__tests__/setup.ts`**

```typescript
import { createTestDb, SCHEMA } from './helpers/d1-mock'
import type { Bindings } from '../types'

export const TEST_API_KEY = 'test-api-key-12345'

export function createTestEnv(): Bindings {
  return {
    DB: createTestDb(SCHEMA),
    API_KEY: TEST_API_KEY,
    ALLOWED_ORIGIN: '*',
  }
}
```

---

### Task 11: Update items tests

- [ ] **Step 1: Replace `src/__tests__/items.test.ts` entirely**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import app from '../index'
import { createTestEnv, TEST_API_KEY } from './setup'
import type { Bindings } from '../types'

let env: Bindings

beforeEach(() => {
  env = createTestEnv()
})

function req(method: string, path: string, opts: { body?: unknown; key?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.key) headers['X-API-Key'] = opts.key
  return app.fetch(
    new Request(`http://localhost${path}`, {
      method,
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }),
    env as unknown as Record<string, unknown>,
  )
}

const get = (path: string) => req('GET', path)
const post = (path: string, body: unknown, key?: string) => req('POST', path, { body, key })
const put = (path: string, body: unknown) => req('PUT', path, { body, key: TEST_API_KEY })
const del = (path: string) => req('DELETE', path, { key: TEST_API_KEY })

describe('GET /', () => {
  it('devuelve health check con version 2.0.0', async () => {
    const res = await get('/')
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.status).toBe('ok')
    expect(body.version).toBe('2.0.0')
    expect(body.name).toBe('cloudfire-apiv1')
  })
})

describe('Auth middleware', () => {
  it('POST sin API key devuelve 401', async () => {
    expect((await post('/items', { name: 'Test', price: 10 })).status).toBe(401)
  })
  it('POST con API key incorrecta devuelve 401', async () => {
    expect((await post('/items', { name: 'Test', price: 10 }, 'clave-falsa')).status).toBe(401)
  })
  it('PUT sin API key devuelve 401', async () => {
    expect((await req('PUT', '/items/1', { body: { price: 5 } })).status).toBe(401)
  })
  it('DELETE sin API key devuelve 401', async () => {
    expect((await req('DELETE', '/items/1')).status).toBe(401)
  })
})

describe('GET /items', () => {
  it('devuelve lista vacía inicialmente', async () => {
    const res = await get('/items')
    expect(res.status).toBe(200)
    const body = await res.json() as { data: unknown[]; count: number }
    expect(body.data).toEqual([])
    expect(body.count).toBe(0)
  })
  it('count coincide con cantidad de items creados', async () => {
    await post('/items', { name: 'A', price: 1 }, TEST_API_KEY)
    await post('/items', { name: 'B', price: 2 }, TEST_API_KEY)
    const body = await get('/items').then(r => r.json()) as { data: unknown[]; count: number }
    expect(body.count).toBe(2)
    expect(body.data).toHaveLength(2)
  })
})

describe('POST /items', () => {
  it('crea un item con datos válidos', async () => {
    const res = await post('/items', { name: 'Laptop', price: 999.99 }, TEST_API_KEY)
    expect(res.status).toBe(201)
    const body = await res.json() as { data: { name: string; price: number } }
    expect(body.data.name).toBe('Laptop')
    expect(body.data.price).toBe(999.99)
  })
  it('price = 0 es válido', async () => {
    expect((await post('/items', { name: 'Free', price: 0 }, TEST_API_KEY)).status).toBe(201)
  })
  it('price = 999999 es válido', async () => {
    expect((await post('/items', { name: 'Caro', price: 999_999 }, TEST_API_KEY)).status).toBe(201)
  })
  it('devuelve 422 si falta name', async () => {
    expect((await post('/items', { price: 10 }, TEST_API_KEY)).status).toBe(422)
  })
  it('devuelve 422 si name supera 200 caracteres', async () => {
    expect((await post('/items', { name: 'A'.repeat(201), price: 10 }, TEST_API_KEY)).status).toBe(422)
  })
  it('devuelve 422 si price es negativo', async () => {
    expect((await post('/items', { name: 'Test', price: -1 }, TEST_API_KEY)).status).toBe(422)
  })
  it('devuelve 422 si price supera 999999', async () => {
    expect((await post('/items', { name: 'Test', price: 1_000_000 }, TEST_API_KEY)).status).toBe(422)
  })
  it('devuelve 422 si name es solo espacios', async () => {
    expect((await post('/items', { name: '   ', price: 10 }, TEST_API_KEY)).status).toBe(422)
  })
  it('devuelve 422 si description supera 1000 caracteres', async () => {
    expect((await post('/items', { name: 'Test', price: 10, description: 'X'.repeat(1001) }, TEST_API_KEY)).status).toBe(422)
  })
})

describe('GET /items/:id', () => {
  it('devuelve 404 si el item no existe', async () => {
    expect((await get('/items/999')).status).toBe(404)
  })
  it('devuelve 400 si el ID no es numérico', async () => {
    expect((await get('/items/abc')).status).toBe(400)
  })
  it('devuelve el item si existe', async () => {
    await post('/items', { name: 'Monitor', price: 300 }, TEST_API_KEY)
    const list = await get('/items').then(r => r.json()) as { data: Array<{ id: number }> }
    const id = list.data[0]!.id
    const res = await get(`/items/${id}`)
    expect(res.status).toBe(200)
    const body = await res.json() as { data: { name: string } }
    expect(body.data.name).toBe('Monitor')
  })
})

describe('PUT /items/:id', () => {
  it('actualiza el precio de un item', async () => {
    await post('/items', { name: 'Teclado', price: 80 }, TEST_API_KEY)
    const list = await get('/items').then(r => r.json()) as { data: Array<{ id: number }> }
    const id = list.data[0]!.id
    const res = await put(`/items/${id}`, { price: 65 })
    expect(res.status).toBe(200)
    const body = await res.json() as { data: { price: number } }
    expect(body.data.price).toBe(65)
  })
  it('actualiza el nombre de un item', async () => {
    await post('/items', { name: 'Viejo', price: 50 }, TEST_API_KEY)
    const list = await get('/items').then(r => r.json()) as { data: Array<{ id: number }> }
    const id = list.data[0]!.id
    const res = await put(`/items/${id}`, { name: 'Nuevo' })
    expect(res.status).toBe(200)
    const body = await res.json() as { data: { name: string } }
    expect(body.data.name).toBe('Nuevo')
  })
  it('devuelve 404 si el item no existe', async () => {
    expect((await put('/items/999', { price: 10 })).status).toBe(404)
  })
  it('devuelve 400 si el ID no es numérico', async () => {
    expect((await req('PUT', '/items/abc', { body: { price: 10 }, key: TEST_API_KEY })).status).toBe(400)
  })
})

describe('DELETE /items/:id', () => {
  it('elimina un item existente y confirma con 404', async () => {
    await post('/items', { name: 'Mouse', price: 30 }, TEST_API_KEY)
    const list = await get('/items').then(r => r.json()) as { data: Array<{ id: number }> }
    const id = list.data[0]!.id
    expect((await del(`/items/${id}`)).status).toBe(200)
    expect((await get(`/items/${id}`)).status).toBe(404)
  })
  it('devuelve 404 si el item no existe', async () => {
    expect((await del('/items/999')).status).toBe(404)
  })
  it('devuelve 400 si el ID no es numérico', async () => {
    expect((await req('DELETE', '/items/abc', { key: TEST_API_KEY })).status).toBe(400)
  })
})
```

---

### Task 12: Run tests and typecheck

- [ ] **Step 1: Run tests inside Docker**

```bash
docker compose --profile test run --rm test
```

Expected: all tests pass (green).

- [ ] **Step 2: Run typecheck**

```bash
docker compose run --rm test npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Run lint**

```bash
docker compose run --rm test npm run lint
```

Expected: no errors.

---

### Task 13: Commit and push PR 1

- [ ] **Step 1: Stage and commit all changes**

```bash
git add src/ migrations/0002_v2_schema.sql package.json package-lock.json
git commit -m "feat: migrate to Drizzle ORM + Chanfana + Zod v4 with Clean Code architecture

- Replace raw SQL with Drizzle ORM (drizzle-orm/d1)
- Add Chanfana for OpenAPI 3.1 auto-docs at /docs
- Add Zod v4 for schema validation
- Separate layers: db/, schemas/, repositories/, routes/
- Replace regex-based d1-mock with better-sqlite3 real SQLite
- Add migration 0002 for new tables (categories, users, orders, order_items)
- Expand items tests to cover all edge cases

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

- [ ] **Step 2: Push branch**

```bash
git push -u origin feat/infra-drizzle-chanfana
```

- [ ] **Step 3: Create PR**

```bash
gh pr create \
  --title "feat: migrate infra to Drizzle + Chanfana + Zod v4" \
  --body "$(cat <<'EOF'
## Summary
- Migrates all DB access to Drizzle ORM with type-safe queries
- Adds OpenAPI 3.1 docs at `/docs` via Chanfana
- Adds Zod v4 for formal schema validation
- Implements Clean Code layered architecture (db, schemas, repositories, routes)
- Replaces regex d1-mock with real better-sqlite3 in-memory SQLite for tests
- Adds migration `0002` for categories, users, orders, order_items tables

## Test plan
- [ ] All existing items tests pass
- [ ] New edge case tests pass (invalid IDs, boundary prices, auth on all mutations)
- [ ] `GET /docs` returns OpenAPI UI
- [ ] CI passes (lint + typecheck + tests)

Closes #5

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Verify CI is green on GitHub**

```bash
gh pr checks
```

Expected: lint-typecheck ✓, tests ✓

---

## PR 2 — Categories Resource

**Branch:** `feat/categories`  
**Depends on:** PR 1 merged into main

---

### Task 1: GitHub setup

- [ ] **Step 1: Create issue**

```bash
gh issue create \
  --title "feat: categories resource" \
  --body "Add CRUD endpoints for categories resource. Part of v2 upgrade. Depends on #5." \
  --label "enhancement"
```

- [ ] **Step 2: Add to project board**

```bash
gh project item-add <PROJECT_NUMBER> --owner wrcp20 --url <ISSUE_URL>
```

- [ ] **Step 3: Pull main and create branch**

```bash
git checkout main && git pull origin main
git checkout -b feat/categories
```

---

### Task 2: Categories Zod schema

- [ ] **Step 1: Create `src/schemas/categories.schema.ts`**

```typescript
import { z } from 'zod'

export const CategorySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string().nullable(),
  created_at: z.string(),
})

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
})

export const UpdateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
})

export const CategoryIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})
```

---

### Task 3: Categories repository

- [ ] **Step 1: Create `src/repositories/categories.repository.ts`**

```typescript
import { eq } from 'drizzle-orm'
import type { AppDb } from '../db'
import { categories } from '../db/schema'
import type { Category } from '../types'

export async function findAllCategories(db: AppDb): Promise<Category[]> {
  return db.select().from(categories)
}

export async function findCategoryById(db: AppDb, id: number): Promise<Category | null> {
  const rows = await db.select().from(categories).where(eq(categories.id, id)).limit(1)
  return rows[0] ?? null
}

export async function createCategory(
  db: AppDb,
  data: { name: string; description?: string | null },
): Promise<Category> {
  const rows = await db
    .insert(categories)
    .values({ name: data.name.trim(), description: data.description ?? null })
    .returning()
  return rows[0]!
}

export async function updateCategory(
  db: AppDb,
  id: number,
  data: { name?: string; description?: string | null },
): Promise<Category | null> {
  const patch: Record<string, unknown> = {}
  if (data.name !== undefined) patch['name'] = data.name.trim()
  if ('description' in data) patch['description'] = data.description ?? null
  if (Object.keys(patch).length === 0) return findCategoryById(db, id)
  const rows = await db.update(categories).set(patch).where(eq(categories.id, id)).returning()
  return rows[0] ?? null
}

export async function deleteCategory(db: AppDb, id: number): Promise<boolean> {
  const rows = await db.delete(categories).where(eq(categories.id, id)).returning()
  return rows.length > 0
}
```

---

### Task 4: Categories route

- [ ] **Step 1: Create `src/routes/categories.ts`**

```typescript
import { OpenAPIRoute } from 'chanfana'
import { z } from 'zod'
import { createDb } from '../db'
import {
  createCategory,
  deleteCategory,
  findAllCategories,
  findCategoryById,
  updateCategory,
} from '../repositories/categories.repository'
import {
  CategoryIdParamSchema,
  CategorySchema,
  CreateCategorySchema,
  UpdateCategorySchema,
} from '../schemas/categories.schema'
import type { Bindings } from '../types'
import type { Context } from 'hono'

type AppCtx = Context<{ Bindings: Bindings }>

const CategoriesResponse = z.object({ data: z.array(CategorySchema), count: z.number() })
const CategoryResponse = z.object({ data: CategorySchema })
const NotFound = z.object({ error: z.string() })

export class CategoriesList extends OpenAPIRoute {
  schema = {
    tags: ['Categories'],
    summary: 'List all categories',
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: CategoriesResponse } } },
    },
  }
  async handle(c: AppCtx) {
    const db = createDb(c.env.DB)
    const data = await findAllCategories(db)
    return c.json({ data, count: data.length })
  }
}

export class CategoriesGet extends OpenAPIRoute {
  schema = {
    tags: ['Categories'],
    summary: 'Get category by ID',
    request: { params: CategoryIdParamSchema },
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: CategoryResponse } } },
      404: { description: 'Not found', content: { 'application/json': { schema: NotFound } } },
    },
  }
  async handle(c: AppCtx) {
    const { id } = CategoryIdParamSchema.parse(c.req.param())
    const db = createDb(c.env.DB)
    const category = await findCategoryById(db, id)
    if (!category) return c.json({ error: 'Categoría no encontrada' }, 404)
    return c.json({ data: category })
  }
}

export class CategoriesCreate extends OpenAPIRoute {
  schema = {
    tags: ['Categories'],
    summary: 'Create category',
    security: [{ ApiKeyAuth: [] }],
    request: { body: { content: { 'application/json': { schema: CreateCategorySchema } } } },
    responses: {
      201: { description: 'Created', content: { 'application/json': { schema: CategoryResponse } } },
      422: { description: 'Validation error', content: { 'application/json': { schema: NotFound } } },
    },
  }
  async handle(c: AppCtx) {
    const result = CreateCategorySchema.safeParse(await c.req.json().catch(() => null))
    if (!result.success) return c.json({ error: result.error.issues[0]?.message ?? 'Datos inválidos' }, 422)
    const db = createDb(c.env.DB)
    const category = await createCategory(db, result.data)
    return c.json({ data: category }, 201)
  }
}

export class CategoriesUpdate extends OpenAPIRoute {
  schema = {
    tags: ['Categories'],
    summary: 'Update category',
    security: [{ ApiKeyAuth: [] }],
    request: {
      params: CategoryIdParamSchema,
      body: { content: { 'application/json': { schema: UpdateCategorySchema } } },
    },
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: CategoryResponse } } },
      404: { description: 'Not found', content: { 'application/json': { schema: NotFound } } },
      422: { description: 'Validation error', content: { 'application/json': { schema: NotFound } } },
    },
  }
  async handle(c: AppCtx) {
    const { id } = CategoryIdParamSchema.parse(c.req.param())
    const result = UpdateCategorySchema.safeParse(await c.req.json().catch(() => null))
    if (!result.success) return c.json({ error: result.error.issues[0]?.message ?? 'Datos inválidos' }, 422)
    const db = createDb(c.env.DB)
    const category = await updateCategory(db, id, result.data)
    if (!category) return c.json({ error: 'Categoría no encontrada' }, 404)
    return c.json({ data: category })
  }
}

export class CategoriesDelete extends OpenAPIRoute {
  schema = {
    tags: ['Categories'],
    summary: 'Delete category',
    security: [{ ApiKeyAuth: [] }],
    request: { params: CategoryIdParamSchema },
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: z.object({ message: z.string() }) } } },
      404: { description: 'Not found', content: { 'application/json': { schema: NotFound } } },
    },
  }
  async handle(c: AppCtx) {
    const { id } = CategoryIdParamSchema.parse(c.req.param())
    const db = createDb(c.env.DB)
    const deleted = await deleteCategory(db, id)
    if (!deleted) return c.json({ error: 'Categoría no encontrada' }, 404)
    return c.json({ message: 'Categoría eliminada' })
  }
}
```

---

### Task 5: Register categories in index.ts

- [ ] **Step 1: Add imports and route registrations to `src/index.ts`**

Add import after existing imports:
```typescript
import { CategoriesCreate, CategoriesDelete, CategoriesGet, CategoriesList, CategoriesUpdate } from './routes/categories'
```

Add route registrations after the items block:
```typescript
openapi.get('/categories', CategoriesList)
openapi.get('/categories/:id', CategoriesGet)
openapi.post('/categories', CategoriesCreate)
openapi.put('/categories/:id', CategoriesUpdate)
openapi.delete('/categories/:id', CategoriesDelete)
```

---

### Task 6: Categories tests

- [ ] **Step 1: Create `src/__tests__/categories.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import app from '../index'
import { createTestEnv, TEST_API_KEY } from './setup'
import type { Bindings } from '../types'

let env: Bindings

beforeEach(() => { env = createTestEnv() })

function req(method: string, path: string, opts: { body?: unknown; key?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.key) headers['X-API-Key'] = opts.key
  return app.fetch(
    new Request(`http://localhost${path}`, {
      method, headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }),
    env as unknown as Record<string, unknown>,
  )
}

const get = (path: string) => req('GET', path)
const post = (path: string, body: unknown, key?: string) => req('POST', path, { body, key })
const put = (path: string, body: unknown) => req('PUT', path, { body, key: TEST_API_KEY })
const del = (path: string) => req('DELETE', path, { key: TEST_API_KEY })

describe('GET /categories', () => {
  it('devuelve lista vacía inicialmente', async () => {
    const res = await get('/categories')
    expect(res.status).toBe(200)
    const body = await res.json() as { data: unknown[]; count: number }
    expect(body.data).toEqual([])
    expect(body.count).toBe(0)
  })
})

describe('POST /categories', () => {
  it('crea una categoría válida', async () => {
    const res = await post('/categories', { name: 'Electrónica' }, TEST_API_KEY)
    expect(res.status).toBe(201)
    const body = await res.json() as { data: { name: string } }
    expect(body.data.name).toBe('Electrónica')
  })
  it('devuelve 401 sin API key', async () => {
    expect((await post('/categories', { name: 'Test' })).status).toBe(401)
  })
  it('devuelve 422 si falta name', async () => {
    expect((await post('/categories', { description: 'Solo desc' }, TEST_API_KEY)).status).toBe(422)
  })
  it('devuelve 422 si name supera 100 caracteres', async () => {
    expect((await post('/categories', { name: 'A'.repeat(101) }, TEST_API_KEY)).status).toBe(422)
  })
})

describe('GET /categories/:id', () => {
  it('devuelve 404 si no existe', async () => {
    expect((await get('/categories/999')).status).toBe(404)
  })
  it('devuelve 400 si ID no es numérico', async () => {
    expect((await get('/categories/abc')).status).toBe(400)
  })
  it('devuelve la categoría si existe', async () => {
    await post('/categories', { name: 'Ropa' }, TEST_API_KEY)
    const list = await get('/categories').then(r => r.json()) as { data: Array<{ id: number }> }
    const id = list.data[0]!.id
    const res = await get(`/categories/${id}`)
    expect(res.status).toBe(200)
    const body = await res.json() as { data: { name: string } }
    expect(body.data.name).toBe('Ropa')
  })
})

describe('PUT /categories/:id', () => {
  it('actualiza el nombre', async () => {
    await post('/categories', { name: 'Vieja' }, TEST_API_KEY)
    const list = await get('/categories').then(r => r.json()) as { data: Array<{ id: number }> }
    const id = list.data[0]!.id
    const res = await put(`/categories/${id}`, { name: 'Nueva' })
    expect(res.status).toBe(200)
    const body = await res.json() as { data: { name: string } }
    expect(body.data.name).toBe('Nueva')
  })
  it('devuelve 404 si no existe', async () => {
    expect((await put('/categories/999', { name: 'X' })).status).toBe(404)
  })
})

describe('DELETE /categories/:id', () => {
  it('elimina y confirma con 404', async () => {
    await post('/categories', { name: 'Borrar' }, TEST_API_KEY)
    const list = await get('/categories').then(r => r.json()) as { data: Array<{ id: number }> }
    const id = list.data[0]!.id
    expect((await del(`/categories/${id}`)).status).toBe(200)
    expect((await get(`/categories/${id}`)).status).toBe(404)
  })
  it('devuelve 404 si no existe', async () => {
    expect((await del('/categories/999')).status).toBe(404)
  })
})
```

---

### Task 7: Run tests, commit, push PR 2

- [ ] **Step 1: Run tests**

```bash
docker compose --profile test run --rm test
```

Expected: all tests pass.

- [ ] **Step 2: Commit**

```bash
git add src/
git commit -m "feat: add categories resource with Clean Code layers

- src/schemas/categories.schema.ts — Zod v4 validation shapes
- src/repositories/categories.repository.ts — Drizzle queries
- src/routes/categories.ts — Chanfana OpenAPIRoute handlers
- src/__tests__/categories.test.ts — full CRUD + edge case tests

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

- [ ] **Step 3: Push and create PR**

```bash
git push -u origin feat/categories
gh pr create \
  --title "feat: categories resource" \
  --body "$(cat <<'EOF'
## Summary
- Adds full CRUD for categories resource with Clean Code layered architecture
- Schema, repository, and route are separate files with single responsibility
- Full test coverage including auth, validation, and edge cases

## Test plan
- [ ] GET /categories returns empty list
- [ ] POST /categories creates with valid data
- [ ] Validation rejects name > 100 chars
- [ ] GET /categories/:id returns 404 for missing
- [ ] DELETE removes and confirms 404
- [ ] CI passes

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Verify CI**

```bash
gh pr checks
```

---

## PR 3 — Users Resource

**Branch:** `feat/users`  
**Depends on:** PR 1 merged into main

---

### Task 1: GitHub setup

- [ ] **Step 1: Create issue**

```bash
gh issue create \
  --title "feat: users resource" \
  --body "Add CRUD endpoints for users resource (data entity only, no auth). Part of v2 upgrade." \
  --label "enhancement"
```

- [ ] **Step 2: Add to project board**

```bash
gh project item-add <PROJECT_NUMBER> --owner wrcp20 --url <ISSUE_URL>
```

- [ ] **Step 3: Pull main and create branch**

```bash
git checkout main && git pull origin main
git checkout -b feat/users
```

---

### Task 2: Users Zod schema

- [ ] **Step 1: Create `src/schemas/users.schema.ts`**

```typescript
import { z } from 'zod'

export const UserSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string().email(),
  created_at: z.string(),
})

export const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(200),
})

export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().max(200).optional(),
})

export const UserIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})
```

---

### Task 3: Users repository

- [ ] **Step 1: Create `src/repositories/users.repository.ts`**

```typescript
import { eq } from 'drizzle-orm'
import type { AppDb } from '../db'
import { users } from '../db/schema'
import type { User } from '../types'

export async function findAllUsers(db: AppDb): Promise<User[]> {
  return db.select().from(users)
}

export async function findUserById(db: AppDb, id: number): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1)
  return rows[0] ?? null
}

export async function createUser(
  db: AppDb,
  data: { name: string; email: string },
): Promise<User> {
  const rows = await db
    .insert(users)
    .values({ name: data.name.trim(), email: data.email.toLowerCase().trim() })
    .returning()
  return rows[0]!
}

export async function updateUser(
  db: AppDb,
  id: number,
  data: { name?: string; email?: string },
): Promise<User | null> {
  const patch: Record<string, unknown> = {}
  if (data.name !== undefined) patch['name'] = data.name.trim()
  if (data.email !== undefined) patch['email'] = data.email.toLowerCase().trim()
  if (Object.keys(patch).length === 0) return findUserById(db, id)
  const rows = await db.update(users).set(patch).where(eq(users.id, id)).returning()
  return rows[0] ?? null
}

export async function deleteUser(db: AppDb, id: number): Promise<boolean> {
  const rows = await db.delete(users).where(eq(users.id, id)).returning()
  return rows.length > 0
}
```

---

### Task 4: Users route

- [ ] **Step 1: Create `src/routes/users.ts`**

```typescript
import { OpenAPIRoute } from 'chanfana'
import { z } from 'zod'
import { createDb } from '../db'
import {
  createUser,
  deleteUser,
  findAllUsers,
  findUserById,
  updateUser,
} from '../repositories/users.repository'
import {
  CreateUserSchema,
  UpdateUserSchema,
  UserIdParamSchema,
  UserSchema,
} from '../schemas/users.schema'
import type { Bindings } from '../types'
import type { Context } from 'hono'

type AppCtx = Context<{ Bindings: Bindings }>

const UsersResponse = z.object({ data: z.array(UserSchema), count: z.number() })
const UserResponse = z.object({ data: UserSchema })
const NotFound = z.object({ error: z.string() })

export class UsersList extends OpenAPIRoute {
  schema = {
    tags: ['Users'],
    summary: 'List all users',
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: UsersResponse } } },
    },
  }
  async handle(c: AppCtx) {
    const db = createDb(c.env.DB)
    const data = await findAllUsers(db)
    return c.json({ data, count: data.length })
  }
}

export class UsersGet extends OpenAPIRoute {
  schema = {
    tags: ['Users'],
    summary: 'Get user by ID',
    request: { params: UserIdParamSchema },
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: UserResponse } } },
      404: { description: 'Not found', content: { 'application/json': { schema: NotFound } } },
    },
  }
  async handle(c: AppCtx) {
    const { id } = UserIdParamSchema.parse(c.req.param())
    const db = createDb(c.env.DB)
    const user = await findUserById(db, id)
    if (!user) return c.json({ error: 'Usuario no encontrado' }, 404)
    return c.json({ data: user })
  }
}

export class UsersCreate extends OpenAPIRoute {
  schema = {
    tags: ['Users'],
    summary: 'Create user',
    security: [{ ApiKeyAuth: [] }],
    request: { body: { content: { 'application/json': { schema: CreateUserSchema } } } },
    responses: {
      201: { description: 'Created', content: { 'application/json': { schema: UserResponse } } },
      422: { description: 'Validation error', content: { 'application/json': { schema: NotFound } } },
    },
  }
  async handle(c: AppCtx) {
    const result = CreateUserSchema.safeParse(await c.req.json().catch(() => null))
    if (!result.success) return c.json({ error: result.error.issues[0]?.message ?? 'Datos inválidos' }, 422)
    const db = createDb(c.env.DB)
    const user = await createUser(db, result.data)
    return c.json({ data: user }, 201)
  }
}

export class UsersUpdate extends OpenAPIRoute {
  schema = {
    tags: ['Users'],
    summary: 'Update user',
    security: [{ ApiKeyAuth: [] }],
    request: {
      params: UserIdParamSchema,
      body: { content: { 'application/json': { schema: UpdateUserSchema } } },
    },
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: UserResponse } } },
      404: { description: 'Not found', content: { 'application/json': { schema: NotFound } } },
      422: { description: 'Validation error', content: { 'application/json': { schema: NotFound } } },
    },
  }
  async handle(c: AppCtx) {
    const { id } = UserIdParamSchema.parse(c.req.param())
    const result = UpdateUserSchema.safeParse(await c.req.json().catch(() => null))
    if (!result.success) return c.json({ error: result.error.issues[0]?.message ?? 'Datos inválidos' }, 422)
    const db = createDb(c.env.DB)
    const user = await updateUser(db, id, result.data)
    if (!user) return c.json({ error: 'Usuario no encontrado' }, 404)
    return c.json({ data: user })
  }
}

export class UsersDelete extends OpenAPIRoute {
  schema = {
    tags: ['Users'],
    summary: 'Delete user',
    security: [{ ApiKeyAuth: [] }],
    request: { params: UserIdParamSchema },
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: z.object({ message: z.string() }) } } },
      404: { description: 'Not found', content: { 'application/json': { schema: NotFound } } },
    },
  }
  async handle(c: AppCtx) {
    const { id } = UserIdParamSchema.parse(c.req.param())
    const db = createDb(c.env.DB)
    const deleted = await deleteUser(db, id)
    if (!deleted) return c.json({ error: 'Usuario no encontrado' }, 404)
    return c.json({ message: 'Usuario eliminado' })
  }
}
```

---

### Task 5: Register users in index.ts

- [ ] **Step 1: Add import to `src/index.ts`**

```typescript
import { UsersCreate, UsersDelete, UsersGet, UsersList, UsersUpdate } from './routes/users'
```

- [ ] **Step 2: Add route registrations after categories block**

```typescript
openapi.get('/users', UsersList)
openapi.get('/users/:id', UsersGet)
openapi.post('/users', UsersCreate)
openapi.put('/users/:id', UsersUpdate)
openapi.delete('/users/:id', UsersDelete)
```

---

### Task 6: Users tests

- [ ] **Step 1: Create `src/__tests__/users.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import app from '../index'
import { createTestEnv, TEST_API_KEY } from './setup'
import type { Bindings } from '../types'

let env: Bindings

beforeEach(() => { env = createTestEnv() })

function req(method: string, path: string, opts: { body?: unknown; key?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.key) headers['X-API-Key'] = opts.key
  return app.fetch(
    new Request(`http://localhost${path}`, {
      method, headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }),
    env as unknown as Record<string, unknown>,
  )
}

const get = (path: string) => req('GET', path)
const post = (path: string, body: unknown, key?: string) => req('POST', path, { body, key })
const put = (path: string, body: unknown) => req('PUT', path, { body, key: TEST_API_KEY })
const del = (path: string) => req('DELETE', path, { key: TEST_API_KEY })

describe('GET /users', () => {
  it('devuelve lista vacía inicialmente', async () => {
    const res = await get('/users')
    expect(res.status).toBe(200)
    const body = await res.json() as { data: unknown[]; count: number }
    expect(body.data).toEqual([])
    expect(body.count).toBe(0)
  })
})

describe('POST /users', () => {
  it('crea un usuario válido', async () => {
    const res = await post('/users', { name: 'Ana', email: 'ana@test.com' }, TEST_API_KEY)
    expect(res.status).toBe(201)
    const body = await res.json() as { data: { name: string; email: string } }
    expect(body.data.name).toBe('Ana')
    expect(body.data.email).toBe('ana@test.com')
  })
  it('devuelve 401 sin API key', async () => {
    expect((await post('/users', { name: 'Ana', email: 'ana@test.com' })).status).toBe(401)
  })
  it('devuelve 422 si email es inválido', async () => {
    expect((await post('/users', { name: 'Ana', email: 'no-es-email' }, TEST_API_KEY)).status).toBe(422)
  })
  it('devuelve 422 si falta name', async () => {
    expect((await post('/users', { email: 'ana@test.com' }, TEST_API_KEY)).status).toBe(422)
  })
  it('devuelve 422 si name supera 100 caracteres', async () => {
    expect((await post('/users', { name: 'A'.repeat(101), email: 'a@b.com' }, TEST_API_KEY)).status).toBe(422)
  })
})

describe('GET /users/:id', () => {
  it('devuelve 404 si no existe', async () => {
    expect((await get('/users/999')).status).toBe(404)
  })
  it('devuelve 400 si ID no es numérico', async () => {
    expect((await get('/users/abc')).status).toBe(400)
  })
  it('devuelve el usuario si existe', async () => {
    await post('/users', { name: 'Luis', email: 'luis@test.com' }, TEST_API_KEY)
    const list = await get('/users').then(r => r.json()) as { data: Array<{ id: number }> }
    const id = list.data[0]!.id
    const res = await get(`/users/${id}`)
    expect(res.status).toBe(200)
    const body = await res.json() as { data: { name: string } }
    expect(body.data.name).toBe('Luis')
  })
})

describe('PUT /users/:id', () => {
  it('actualiza el nombre', async () => {
    await post('/users', { name: 'Viejo', email: 'v@test.com' }, TEST_API_KEY)
    const list = await get('/users').then(r => r.json()) as { data: Array<{ id: number }> }
    const id = list.data[0]!.id
    const res = await put(`/users/${id}`, { name: 'Nuevo' })
    expect(res.status).toBe(200)
    const body = await res.json() as { data: { name: string } }
    expect(body.data.name).toBe('Nuevo')
  })
  it('devuelve 404 si no existe', async () => {
    expect((await put('/users/999', { name: 'X' })).status).toBe(404)
  })
})

describe('DELETE /users/:id', () => {
  it('elimina y confirma con 404', async () => {
    await post('/users', { name: 'Borrar', email: 'b@test.com' }, TEST_API_KEY)
    const list = await get('/users').then(r => r.json()) as { data: Array<{ id: number }> }
    const id = list.data[0]!.id
    expect((await del(`/users/${id}`)).status).toBe(200)
    expect((await get(`/users/${id}`)).status).toBe(404)
  })
  it('devuelve 404 si no existe', async () => {
    expect((await del('/users/999')).status).toBe(404)
  })
})
```

---

### Task 7: Run tests, commit, push PR 3

- [ ] **Step 1: Run tests**

```bash
docker compose --profile test run --rm test
```

Expected: all tests pass.

- [ ] **Step 2: Commit**

```bash
git add src/
git commit -m "feat: add users resource with Clean Code layers

- src/schemas/users.schema.ts — Zod v4 validation with email format check
- src/repositories/users.repository.ts — Drizzle queries, email normalized to lowercase
- src/routes/users.ts — Chanfana OpenAPIRoute handlers
- src/__tests__/users.test.ts — full CRUD + edge case tests

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

- [ ] **Step 3: Push and create PR**

```bash
git push -u origin feat/users
gh pr create \
  --title "feat: users resource" \
  --body "$(cat <<'EOF'
## Summary
- Adds full CRUD for users resource (data entity, no auth)
- Email normalized to lowercase on create/update
- Full test coverage including email validation

## Test plan
- [ ] POST /users creates with valid name + email
- [ ] 422 on invalid email format
- [ ] GET /users/:id returns 404 for missing user
- [ ] CI passes

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Verify CI**

```bash
gh pr checks
```

---

## PR 4 — Orders Resource

**Branch:** `feat/orders`  
**Depends on:** PR 1 merged + PR 3 merged (needs users table populated for FK)

---

### Task 1: GitHub setup

- [ ] **Step 1: Create issue**

```bash
gh issue create \
  --title "feat: orders resource with order_items" \
  --body "Add orders resource with business logic: creates order_items, snapshots unit_price, calculates total. Includes orders.service.ts for createOrder logic." \
  --label "enhancement"
```

- [ ] **Step 2: Add to project board**

```bash
gh project item-add <PROJECT_NUMBER> --owner wrcp20 --url <ISSUE_URL>
```

- [ ] **Step 3: Pull main and create branch**

```bash
git checkout main && git pull origin main
git checkout -b feat/orders
```

---

### Task 2: Orders Zod schema

- [ ] **Step 1: Create `src/schemas/orders.schema.ts`**

```typescript
import { z } from 'zod'

export const OrderItemSchema = z.object({
  id: z.number().int(),
  order_id: z.number().int(),
  item_id: z.number().int(),
  quantity: z.number().int(),
  unit_price: z.number(),
})

export const OrderSchema = z.object({
  id: z.number().int(),
  user_id: z.number().int(),
  status: z.enum(['pending', 'confirmed', 'shipped', 'delivered']),
  total: z.number(),
  created_at: z.string(),
})

export const OrderWithItemsSchema = OrderSchema.extend({
  order_items: z.array(OrderItemSchema),
})

export const CreateOrderSchema = z.object({
  user_id: z.number().int().positive(),
  items: z.array(
    z.object({
      item_id: z.number().int().positive(),
      quantity: z.number().int().min(1),
    }),
  ).min(1),
})

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'shipped', 'delivered']),
})

export const OrderIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})
```

---

### Task 3: Orders repository

- [ ] **Step 1: Create `src/repositories/orders.repository.ts`**

```typescript
import { eq } from 'drizzle-orm'
import type { AppDb } from '../db'
import { orderItems, orders } from '../db/schema'
import type { Order, OrderItem } from '../types'

export async function findAllOrders(db: AppDb): Promise<Order[]> {
  return db.select().from(orders)
}

export async function findOrderById(db: AppDb, id: number): Promise<Order | null> {
  const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  return rows[0] ?? null
}

export async function findOrderItemsByOrderId(db: AppDb, order_id: number): Promise<OrderItem[]> {
  return db.select().from(orderItems).where(eq(orderItems.order_id, order_id))
}

export async function createOrder(
  db: AppDb,
  data: { user_id: number; total: number },
): Promise<Order> {
  const rows = await db
    .insert(orders)
    .values({ user_id: data.user_id, total: data.total, status: 'pending' })
    .returning()
  return rows[0]!
}

export async function createOrderItems(
  db: AppDb,
  items: { order_id: number; item_id: number; quantity: number; unit_price: number }[],
): Promise<OrderItem[]> {
  return db.insert(orderItems).values(items).returning()
}

export async function updateOrderStatus(
  db: AppDb,
  id: number,
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered',
): Promise<Order | null> {
  const rows = await db.update(orders).set({ status }).where(eq(orders.id, id)).returning()
  return rows[0] ?? null
}

export async function deleteOrderWithItems(db: AppDb, id: number): Promise<boolean> {
  await db.delete(orderItems).where(eq(orderItems.order_id, id))
  const rows = await db.delete(orders).where(eq(orders.id, id)).returning()
  return rows.length > 0
}
```

---

### Task 4: Orders service

- [ ] **Step 1: Create `src/services/orders.service.ts`**

```typescript
import type { AppDb } from '../db'
import { findItemById } from '../repositories/items.repository'
import {
  createOrder,
  createOrderItems,
  findOrderItemsByOrderId,
} from '../repositories/orders.repository'
import { findUserById } from '../repositories/users.repository'
import type { Order, OrderItem } from '../types'

export type CreateOrderInput = {
  user_id: number
  items: { item_id: number; quantity: number }[]
}

export type OrderWithItems = Order & { order_items: OrderItem[] }

export type CreateOrderResult =
  | { ok: true; data: OrderWithItems }
  | { ok: false; status: 404 | 422; error: string }

export async function createOrderWithItems(
  db: AppDb,
  input: CreateOrderInput,
): Promise<CreateOrderResult> {
  const user = await findUserById(db, input.user_id)
  if (!user) {
    return { ok: false, status: 404, error: `Usuario ${input.user_id} no encontrado` }
  }

  const resolvedItems: { item_id: number; quantity: number; unit_price: number }[] = []
  for (const line of input.items) {
    const item = await findItemById(db, line.item_id)
    if (!item) {
      return { ok: false, status: 404, error: `Item ${line.item_id} no encontrado` }
    }
    resolvedItems.push({ item_id: line.item_id, quantity: line.quantity, unit_price: item.price })
  }

  const total = resolvedItems.reduce(
    (sum, line) => sum + line.unit_price * line.quantity,
    0,
  )

  const order = await createOrder(db, { user_id: input.user_id, total })
  const order_items = await createOrderItems(
    db,
    resolvedItems.map((line) => ({ ...line, order_id: order.id })),
  )

  return { ok: true, data: { ...order, order_items } }
}

export async function getOrderWithItems(db: AppDb, order: Order): Promise<OrderWithItems> {
  const order_items = await findOrderItemsByOrderId(db, order.id)
  return { ...order, order_items }
}
```

---

### Task 5: Orders route

- [ ] **Step 1: Create `src/routes/orders.ts`**

```typescript
import { OpenAPIRoute } from 'chanfana'
import { z } from 'zod'
import { createDb } from '../db'
import {
  deleteOrderWithItems,
  findAllOrders,
  findOrderById,
  updateOrderStatus,
} from '../repositories/orders.repository'
import {
  CreateOrderSchema,
  OrderIdParamSchema,
  OrderSchema,
  OrderWithItemsSchema,
  UpdateOrderStatusSchema,
} from '../schemas/orders.schema'
import { createOrderWithItems, getOrderWithItems } from '../services/orders.service'
import type { Bindings } from '../types'
import type { Context } from 'hono'

type AppCtx = Context<{ Bindings: Bindings }>

const OrdersResponse = z.object({ data: z.array(OrderSchema), count: z.number() })
const OrderResponse = z.object({ data: OrderWithItemsSchema })
const NotFound = z.object({ error: z.string() })

export class OrdersList extends OpenAPIRoute {
  schema = {
    tags: ['Orders'],
    summary: 'List all orders',
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: OrdersResponse } } },
    },
  }
  async handle(c: AppCtx) {
    const db = createDb(c.env.DB)
    const data = await findAllOrders(db)
    return c.json({ data, count: data.length })
  }
}

export class OrdersGet extends OpenAPIRoute {
  schema = {
    tags: ['Orders'],
    summary: 'Get order by ID with order_items',
    request: { params: OrderIdParamSchema },
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: OrderResponse } } },
      404: { description: 'Not found', content: { 'application/json': { schema: NotFound } } },
    },
  }
  async handle(c: AppCtx) {
    const { id } = OrderIdParamSchema.parse(c.req.param())
    const db = createDb(c.env.DB)
    const order = await findOrderById(db, id)
    if (!order) return c.json({ error: 'Orden no encontrada' }, 404)
    const data = await getOrderWithItems(db, order)
    return c.json({ data })
  }
}

export class OrdersCreate extends OpenAPIRoute {
  schema = {
    tags: ['Orders'],
    summary: 'Create order',
    security: [{ ApiKeyAuth: [] }],
    request: { body: { content: { 'application/json': { schema: CreateOrderSchema } } } },
    responses: {
      201: { description: 'Created', content: { 'application/json': { schema: OrderResponse } } },
      404: { description: 'User or item not found', content: { 'application/json': { schema: NotFound } } },
      422: { description: 'Validation error', content: { 'application/json': { schema: NotFound } } },
    },
  }
  async handle(c: AppCtx) {
    const result = CreateOrderSchema.safeParse(await c.req.json().catch(() => null))
    if (!result.success) return c.json({ error: result.error.issues[0]?.message ?? 'Datos inválidos' }, 422)
    const db = createDb(c.env.DB)
    const outcome = await createOrderWithItems(db, result.data)
    if (!outcome.ok) return c.json({ error: outcome.error }, outcome.status)
    return c.json({ data: outcome.data }, 201)
  }
}

export class OrdersUpdateStatus extends OpenAPIRoute {
  schema = {
    tags: ['Orders'],
    summary: 'Update order status',
    security: [{ ApiKeyAuth: [] }],
    request: {
      params: OrderIdParamSchema,
      body: { content: { 'application/json': { schema: UpdateOrderStatusSchema } } },
    },
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: z.object({ data: OrderSchema }) } } },
      404: { description: 'Not found', content: { 'application/json': { schema: NotFound } } },
      422: { description: 'Validation error', content: { 'application/json': { schema: NotFound } } },
    },
  }
  async handle(c: AppCtx) {
    const { id } = OrderIdParamSchema.parse(c.req.param())
    const result = UpdateOrderStatusSchema.safeParse(await c.req.json().catch(() => null))
    if (!result.success) return c.json({ error: result.error.issues[0]?.message ?? 'Datos inválidos' }, 422)
    const db = createDb(c.env.DB)
    const order = await updateOrderStatus(db, id, result.data.status)
    if (!order) return c.json({ error: 'Orden no encontrada' }, 404)
    return c.json({ data: order })
  }
}

export class OrdersDelete extends OpenAPIRoute {
  schema = {
    tags: ['Orders'],
    summary: 'Delete order and its items',
    security: [{ ApiKeyAuth: [] }],
    request: { params: OrderIdParamSchema },
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: z.object({ message: z.string() }) } } },
      404: { description: 'Not found', content: { 'application/json': { schema: NotFound } } },
    },
  }
  async handle(c: AppCtx) {
    const { id } = OrderIdParamSchema.parse(c.req.param())
    const db = createDb(c.env.DB)
    const deleted = await deleteOrderWithItems(db, id)
    if (!deleted) return c.json({ error: 'Orden no encontrada' }, 404)
    return c.json({ message: 'Orden eliminada' })
  }
}
```

---

### Task 6: Register orders in index.ts

- [ ] **Step 1: Add import to `src/index.ts`**

```typescript
import { OrdersCreate, OrdersDelete, OrdersGet, OrdersList, OrdersUpdateStatus } from './routes/orders'
```

- [ ] **Step 2: Add route registrations after users block**

```typescript
openapi.get('/orders', OrdersList)
openapi.get('/orders/:id', OrdersGet)
openapi.post('/orders', OrdersCreate)
openapi.put('/orders/:id', OrdersUpdateStatus)
openapi.delete('/orders/:id', OrdersDelete)
```

---

### Task 7: Orders service unit tests

- [ ] **Step 1: Create `src/__tests__/orders.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import app from '../index'
import { createTestEnv, TEST_API_KEY } from './setup'
import { createDb } from '../db'
import { createOrderWithItems } from '../services/orders.service'
import { createTestDb, SCHEMA } from './helpers/d1-mock'
import type { Bindings } from '../types'

let env: Bindings

beforeEach(() => { env = createTestEnv() })

function req(method: string, path: string, opts: { body?: unknown; key?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.key) headers['X-API-Key'] = opts.key
  return app.fetch(
    new Request(`http://localhost${path}`, {
      method, headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }),
    env as unknown as Record<string, unknown>,
  )
}

const get = (path: string) => req('GET', path)
const post = (path: string, body: unknown, key?: string) => req('POST', path, { body, key })
const put = (path: string, body: unknown) => req('PUT', path, { body, key: TEST_API_KEY })
const del = (path: string) => req('DELETE', path, { key: TEST_API_KEY })

// ─── Service unit tests ────────────────────────────────────────────────────────

describe('createOrderWithItems (service)', () => {
  it('devuelve error 404 si el user_id no existe', async () => {
    const db = createDb(createTestDb(SCHEMA))
    const result = await createOrderWithItems(db, { user_id: 999, items: [{ item_id: 1, quantity: 1 }] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(404)
  })

  it('devuelve error 404 si algún item no existe', async () => {
    const db = createDb(createTestDb(SCHEMA))
    // Create user first
    await db.insert((await import('../db/schema')).users).values({ name: 'Ana', email: 'ana@t.com' })
    const result = await createOrderWithItems(db, { user_id: 1, items: [{ item_id: 999, quantity: 1 }] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(404)
  })

  it('calcula el total correctamente', async () => {
    const db = createDb(createTestDb(SCHEMA))
    const schema = await import('../db/schema')
    await db.insert(schema.users).values({ name: 'Ana', email: 'ana@t.com' })
    await db.insert(schema.items).values({ name: 'A', price: 10 })
    await db.insert(schema.items).values({ name: 'B', price: 25 })
    // 2 x item A (10) + 3 x item B (25) = 20 + 75 = 95
    const result = await createOrderWithItems(db, {
      user_id: 1,
      items: [{ item_id: 1, quantity: 2 }, { item_id: 2, quantity: 3 }],
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.total).toBe(95)
      expect(result.data.order_items).toHaveLength(2)
    }
  })

  it('snapshots el unit_price al crear la orden', async () => {
    const db = createDb(createTestDb(SCHEMA))
    const schema = await import('../db/schema')
    await db.insert(schema.users).values({ name: 'Ana', email: 'ana@t.com' })
    await db.insert(schema.items).values({ name: 'Item', price: 50 })
    const result = await createOrderWithItems(db, { user_id: 1, items: [{ item_id: 1, quantity: 1 }] })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.order_items[0]!.unit_price).toBe(50)
    }
    // Price change after order doesn't affect snapshot
    await db.update(schema.items).set({ price: 999 }).where((await import('drizzle-orm')).eq(schema.items.id, 1))
    if (result.ok) {
      expect(result.data.order_items[0]!.unit_price).toBe(50)
    }
  })
})

// ─── Route integration tests ──────────────────────────────────────────────────

async function seedUserAndItem() {
  await post('/users', { name: 'Ana', email: 'ana@test.com' }, TEST_API_KEY)
  await post('/items', { name: 'Laptop', price: 100 }, TEST_API_KEY)
  const users = await get('/users').then(r => r.json()) as { data: Array<{ id: number }> }
  const items = await get('/items').then(r => r.json()) as { data: Array<{ id: number }> }
  return { userId: users.data[0]!.id, itemId: items.data[0]!.id }
}

describe('GET /orders', () => {
  it('devuelve lista vacía inicialmente', async () => {
    const res = await get('/orders')
    expect(res.status).toBe(200)
    const body = await res.json() as { data: unknown[]; count: number }
    expect(body.data).toEqual([])
    expect(body.count).toBe(0)
  })
})

describe('POST /orders', () => {
  it('crea una orden con items y calcula total', async () => {
    const { userId, itemId } = await seedUserAndItem()
    const res = await post('/orders', {
      user_id: userId,
      items: [{ item_id: itemId, quantity: 2 }],
    }, TEST_API_KEY)
    expect(res.status).toBe(201)
    const body = await res.json() as { data: { total: number; order_items: unknown[] } }
    expect(body.data.total).toBe(200)
    expect(body.data.order_items).toHaveLength(1)
  })
  it('devuelve 401 sin API key', async () => {
    expect((await post('/orders', { user_id: 1, items: [{ item_id: 1, quantity: 1 }] })).status).toBe(401)
  })
  it('devuelve 404 si user_id no existe', async () => {
    expect((await post('/orders', { user_id: 999, items: [{ item_id: 1, quantity: 1 }] }, TEST_API_KEY)).status).toBe(404)
  })
  it('devuelve 422 si items está vacío', async () => {
    expect((await post('/orders', { user_id: 1, items: [] }, TEST_API_KEY)).status).toBe(422)
  })
  it('devuelve 422 si quantity es 0', async () => {
    expect((await post('/orders', { user_id: 1, items: [{ item_id: 1, quantity: 0 }] }, TEST_API_KEY)).status).toBe(422)
  })
})

describe('GET /orders/:id', () => {
  it('devuelve 404 si no existe', async () => {
    expect((await get('/orders/999')).status).toBe(404)
  })
  it('devuelve orden con order_items', async () => {
    const { userId, itemId } = await seedUserAndItem()
    await post('/orders', { user_id: userId, items: [{ item_id: itemId, quantity: 1 }] }, TEST_API_KEY)
    const list = await get('/orders').then(r => r.json()) as { data: Array<{ id: number }> }
    const id = list.data[0]!.id
    const res = await get(`/orders/${id}`)
    expect(res.status).toBe(200)
    const body = await res.json() as { data: { order_items: unknown[] } }
    expect(body.data.order_items).toHaveLength(1)
  })
})

describe('PUT /orders/:id', () => {
  it('actualiza el status', async () => {
    const { userId, itemId } = await seedUserAndItem()
    await post('/orders', { user_id: userId, items: [{ item_id: itemId, quantity: 1 }] }, TEST_API_KEY)
    const list = await get('/orders').then(r => r.json()) as { data: Array<{ id: number }> }
    const id = list.data[0]!.id
    const res = await put(`/orders/${id}`, { status: 'confirmed' })
    expect(res.status).toBe(200)
    const body = await res.json() as { data: { status: string } }
    expect(body.data.status).toBe('confirmed')
  })
  it('devuelve 422 si status es inválido', async () => {
    expect((await put('/orders/1', { status: 'cancelado' })).status).toBe(422)
  })
  it('devuelve 404 si la orden no existe', async () => {
    expect((await put('/orders/999', { status: 'confirmed' })).status).toBe(404)
  })
})

describe('DELETE /orders/:id', () => {
  it('elimina la orden y sus order_items, confirma con 404', async () => {
    const { userId, itemId } = await seedUserAndItem()
    await post('/orders', { user_id: userId, items: [{ item_id: itemId, quantity: 1 }] }, TEST_API_KEY)
    const list = await get('/orders').then(r => r.json()) as { data: Array<{ id: number }> }
    const id = list.data[0]!.id
    expect((await del(`/orders/${id}`)).status).toBe(200)
    expect((await get(`/orders/${id}`)).status).toBe(404)
  })
  it('devuelve 404 si no existe', async () => {
    expect((await del('/orders/999')).status).toBe(404)
  })
})
```

---

### Task 8: Run tests, commit, push PR 4

- [ ] **Step 1: Run tests**

```bash
docker compose --profile test run --rm test
```

Expected: all tests pass including service unit tests.

- [ ] **Step 2: Commit**

```bash
git add src/
git commit -m "feat: add orders resource with order_items and service layer

- src/schemas/orders.schema.ts — Zod v4 shapes including OrderWithItemsSchema
- src/repositories/orders.repository.ts — Drizzle queries for orders + order_items
- src/services/orders.service.ts — createOrder business logic: validates user/items,
  snapshots unit_price, calculates total
- src/routes/orders.ts — Chanfana OpenAPIRoute handlers
- src/__tests__/orders.test.ts — service unit tests + route integration tests

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

- [ ] **Step 3: Push and create PR**

```bash
git push -u origin feat/orders
gh pr create \
  --title "feat: orders resource with order_items" \
  --body "$(cat <<'EOF'
## Summary
- Adds orders resource with business logic in dedicated service layer
- POST /orders creates order_items, snapshots unit_price at creation time, calculates total
- PUT /orders/:id updates status only (pending → confirmed → shipped → delivered)
- DELETE cascades to order_items
- Includes service unit tests (total calculation, price snapshot, 404 on missing user/item)

## Test plan
- [ ] POST /orders creates with correct total
- [ ] unit_price snapshot is preserved after item price change
- [ ] 404 on unknown user_id or item_id
- [ ] 422 on empty items array or quantity=0
- [ ] DELETE removes order and order_items
- [ ] CI passes

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Verify CI**

```bash
gh pr checks
```

Expected: all checks green. Merge to main triggers deploy to production.
