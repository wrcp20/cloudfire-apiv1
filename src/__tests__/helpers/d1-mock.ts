import BetterSqlite3 from 'better-sqlite3'
import type { D1Database } from '@cloudflare/workers-types'

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
    const rawStmt = sqlite.prepare(query).raw(true)

    return {
      all: <T>() => Promise.resolve({ results: stmt.all(...args) as T[] }),
      first: <T>() => Promise.resolve((stmt.get(...args) ?? null) as T | null),
      run: () => {
        stmt.run(...args)
        return Promise.resolve({ success: true as const, results: [], meta: {} as D1Meta })
      },
      raw: <T>() => Promise.resolve(rawStmt.all(...args) as T[]),
    }
  }

  return {
    prepare: (query: string) => ({
      ...makeStmt(query),
      bind: (...args: unknown[]) => makeStmt(query, args),
    }),
    exec: (query: string) => {
      sqlite.exec(query)
      return Promise.resolve({ count: 0, duration: 0 })
    },
    batch: async () => [],
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database
}
