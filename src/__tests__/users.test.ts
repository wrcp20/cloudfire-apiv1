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
    const res = await post('/users', { name: 'Juan', email: 'JUAN@MAIL.COM' }, TEST_API_KEY)
    expect(res.status).toBe(201)
    const body = await res.json() as { data: { name: string; email: string } }
    expect(body.data.name).toBe('Juan')
    expect(body.data.email).toBe('juan@mail.com')
  })

  it('devuelve 401 sin API key', async () => {
    expect((await post('/users', { name: 'Test', email: 'a@a.com' })).status).toBe(401)
  })

  it('devuelve 422 si falta email', async () => {
    expect((await post('/users', { name: 'Solo nombre' }, TEST_API_KEY)).status).toBe(422)
  })

  it('devuelve 422 si email no es válido', async () => {
    expect((await post('/users', { name: 'Test', email: 'invalido' }, TEST_API_KEY)).status).toBe(422)
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
    await post('/users', { name: 'Ana', email: 'ana@mail.com' }, TEST_API_KEY)
    const list = await get('/users').then((response: Response) => response.json()) as { data: Array<{ id: number }> }
    const id = list.data[0]!.id
    const res = await get(`/users/${id}`)
    expect(res.status).toBe(200)
    const body = await res.json() as { data: { name: string } }
    expect(body.data.name).toBe('Ana')
  })
})

describe('PUT /users/:id', () => {
  it('actualiza el email', async () => {
    await post('/users', { name: 'Pedro', email: 'pedro@mail.com' }, TEST_API_KEY)
    const list = await get('/users').then((response: Response) => response.json()) as { data: Array<{ id: number }> }
    const id = list.data[0]!.id
    const res = await put(`/users/${id}`, { email: 'NUEVO@MAIL.COM' })
    expect(res.status).toBe(200)
    const body = await res.json() as { data: { email: string } }
    expect(body.data.email).toBe('nuevo@mail.com')
  })

  it('devuelve 404 si no existe', async () => {
    expect((await put('/users/999', { name: 'X' })).status).toBe(404)
  })
})

describe('DELETE /users/:id', () => {
  it('elimina y confirma con 404', async () => {
    await post('/users', { name: 'Borrar', email: 'borrar@mail.com' }, TEST_API_KEY)
    const list = await get('/users').then((response: Response) => response.json()) as { data: Array<{ id: number }> }
    const id = list.data[0]!.id
    expect((await del(`/users/${id}`)).status).toBe(200)
    expect((await get(`/users/${id}`)).status).toBe(404)
  })

  it('devuelve 404 si no existe', async () => {
    expect((await del('/users/999')).status).toBe(404)
  })
})
