import { beforeEach, describe, expect, it } from 'vitest'
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
    const res = await post('/categories', { name: 'Electronica' }, TEST_API_KEY)
    expect(res.status).toBe(201)
    const body = await res.json() as { data: { name: string } }
    expect(body.data.name).toBe('Electronica')
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
    const list = await get('/categories').then((response: Response) => response.json()) as { data: Array<{ id: number }> }
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
    const list = await get('/categories').then((response: Response) => response.json()) as { data: Array<{ id: number }> }
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
    const list = await get('/categories').then((response: Response) => response.json()) as { data: Array<{ id: number }> }
    const id = list.data[0]!.id
    expect((await del(`/categories/${id}`)).status).toBe(200)
    expect((await get(`/categories/${id}`)).status).toBe(404)
  })

  it('devuelve 404 si no existe', async () => {
    expect((await del('/categories/999')).status).toBe(404)
  })
}
)
