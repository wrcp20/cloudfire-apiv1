import type { D1Database } from '@cloudflare/workers-types'
import type { Item } from '../../types'

type Row = Item

export function createTestDb(): D1Database {
  const rows: Row[] = []
  let nextId = 1

  function now() {
    return new Date().toISOString().replace('T', ' ').slice(0, 19)
  }

  function run(query: string, args: unknown[]): { results: Row[]; single: Row | null } {
    const q = query.trim().replace(/\s+/g, ' ')

    if (/^SELECT \* FROM items ORDER BY/.test(q)) {
      return { results: [...rows].reverse(), single: null }
    }

    if (/^SELECT (\*|id) FROM items WHERE id = \?/.test(q)) {
      const found = rows.find(r => r.id === Number(args[0])) ?? null
      return { results: found ? [found] : [], single: found }
    }

    if (/^INSERT INTO items/.test(q)) {
      const [name, description, price] = args as [string, string | null, number]
      const row: Row = { id: nextId++, name, description: description ?? null, price, created_at: now() }
      rows.push(row)
      return { results: [row], single: row }
    }

    if (/^UPDATE items SET/.test(q)) {
      const [name, description, price, id] = args as [string, string | null, number, number]
      const row = rows.find(r => r.id === id) ?? null
      if (row) { row.name = name; row.description = description ?? null; row.price = price }
      return { results: row ? [row] : [], single: row }
    }

    if (/^DELETE FROM items WHERE id = \?/.test(q)) {
      const idx = rows.findIndex(r => r.id === Number(args[0]))
      if (idx !== -1) rows.splice(idx, 1)
      return { results: [], single: null }
    }

    return { results: [], single: null }
  }

  const makeBound = (query: string, args: unknown[]) => ({
    all: <T>() => Promise.resolve({ results: run(query, args).results as unknown as T[] }),
    first: <T>() => Promise.resolve(run(query, args).single as unknown as T | null),
    run: () => { run(query, args); return Promise.resolve({ success: true as const, results: [], meta: {} as D1Meta }) },
    raw: <T>() => Promise.resolve([] as T[]),
  })

  return {
    prepare: (query: string) => ({
      bind: (...args: unknown[]) => makeBound(query, args),
      all: <T>() => Promise.resolve({ results: run(query, []).results as unknown as T[] }),
      first: <T>() => Promise.resolve(run(query, []).single as unknown as T | null),
      run: () => Promise.resolve({ success: true as const, results: [], meta: {} as D1Meta }),
      raw: <T>() => Promise.resolve([] as T[]),
    }),
    exec: (_q: string) => Promise.resolve({ count: 0, duration: 0 }),
    batch: async () => [],
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database
}
