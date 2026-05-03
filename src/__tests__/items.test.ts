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
    const body = await get('/items').then((response: Response) => response.json()) as { data: unknown[]; count: number }
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
    const res = await get('/items/999')
    expect(res.status).toBe(404)
  })

  it('devuelve 400 si el ID no es numérico', async () => {
    expect((await get('/items/abc')).status).toBe(400)
  })

  it('devuelve el item si existe', async () => {
    await post('/items', { name: 'Monitor', price: 300 }, TEST_API_KEY)
    const list = await get('/items').then((r: Response) => r.json()) as { data: Array<{ id: number }> }
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
    const list = await get('/items').then((r: Response) => r.json()) as { data: Array<{ id: number }> }
    const id = list.data[0]!.id

    const res = await put(`/items/${id}`, { price: 65 })
    expect(res.status).toBe(200)
    const body = await res.json() as { data: { price: number } }
    expect(body.data.price).toBe(65)
  })

  it('actualiza el nombre de un item', async () => {
    await post('/items', { name: 'Viejo', price: 50 }, TEST_API_KEY)
    const list = await get('/items').then((r: Response) => r.json()) as { data: Array<{ id: number }> }
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
    const list = await get('/items').then((r: Response) => r.json()) as { data: Array<{ id: number }> }
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
