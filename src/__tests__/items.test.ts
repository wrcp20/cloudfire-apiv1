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
  it('devuelve health check', async () => {
    const res = await get('/')
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.status).toBe('ok')
  })
})

describe('Auth middleware', () => {
  it('POST sin API key devuelve 401', async () => {
    const res = await post('/items', { name: 'Test', price: 10 })
    expect(res.status).toBe(401)
  })

  it('POST con API key incorrecta devuelve 401', async () => {
    const res = await post('/items', { name: 'Test', price: 10 }, 'clave-falsa')
    expect(res.status).toBe(401)
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
})

describe('POST /items', () => {
  it('crea un item con datos válidos', async () => {
    const res = await post('/items', { name: 'Laptop', price: 999.99 }, TEST_API_KEY)
    expect(res.status).toBe(201)
    const body = await res.json() as { data: { name: string; price: number } }
    expect(body.data.name).toBe('Laptop')
    expect(body.data.price).toBe(999.99)
  })

  it('devuelve 422 si falta name', async () => {
    const res = await post('/items', { price: 10 }, TEST_API_KEY)
    expect(res.status).toBe(422)
  })

  it('devuelve 422 si name supera 200 caracteres', async () => {
    const res = await post('/items', { name: 'A'.repeat(201), price: 10 }, TEST_API_KEY)
    expect(res.status).toBe(422)
  })

  it('devuelve 422 si price es negativo', async () => {
    const res = await post('/items', { name: 'Test', price: -1 }, TEST_API_KEY)
    expect(res.status).toBe(422)
  })
})

describe('GET /items/:id', () => {
  it('devuelve 404 si el item no existe', async () => {
    const res = await get('/items/999')
    expect(res.status).toBe(404)
  })

  it('devuelve el item si existe', async () => {
    await post('/items', { name: 'Monitor', price: 300 }, TEST_API_KEY)
    const list = await get('/items').then((r: Response) => r.json()) as { data: Array<{ id: number }> }
    const id = list.data[0]?.id

    const res = await get(`/items/${id}`)
    expect(res.status).toBe(200)
  })
})

describe('PUT /items/:id', () => {
  it('actualiza el precio de un item', async () => {
    await post('/items', { name: 'Teclado', price: 80 }, TEST_API_KEY)
    const list = await get('/items').then((r: Response) => r.json()) as { data: Array<{ id: number }> }
    const id = list.data[0]?.id

    const res = await put(`/items/${id}`, { price: 65 })
    expect(res.status).toBe(200)
    const body = await res.json() as { data: { price: number } }
    expect(body.data.price).toBe(65)
  })
})

describe('DELETE /items/:id', () => {
  it('elimina un item existente y confirma con 404', async () => {
    await post('/items', { name: 'Mouse', price: 30 }, TEST_API_KEY)
    const list = await get('/items').then((r: Response) => r.json()) as { data: Array<{ id: number }> }
    const id = list.data[0]?.id

    expect((await del(`/items/${id}`)).status).toBe(200)
    expect((await get(`/items/${id}`)).status).toBe(404)
  })
})
