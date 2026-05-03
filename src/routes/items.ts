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
const ErrorResponse = z.object({ error: z.string() })
const DeleteResponse = z.object({ message: z.string() })

export class ItemsList extends OpenAPIRoute {
  schema = {
    tags: ['Items'],
    summary: 'List all items',
    request: { query: ItemsQuerySchema },
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: ItemsResponse } } },
      400: { description: 'Invalid query', content: { 'application/json': { schema: ErrorResponse } } },
    },
  } as any

  async handle(c: AppCtx) {
    const queryResult = ItemsQuerySchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams))
    if (!queryResult.success) {
      return c.json({ error: queryResult.error.issues[0]?.message ?? 'Query inválida' }, 400)
    }

    const db = createDb(c.env.DB)
    const data = await findAllItems(db, queryResult.data.category_id)
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
      400: { description: 'Invalid ID', content: { 'application/json': { schema: ErrorResponse } } },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } },
    },
  } as any

  async handle(c: AppCtx) {
    const paramsResult = ItemIdParamSchema.safeParse(c.req.param())
    if (!paramsResult.success) {
      return c.json({ error: paramsResult.error.issues[0]?.message ?? 'ID inválido' }, 400)
    }

    const db = createDb(c.env.DB)
    const item = await findItemById(db, paramsResult.data.id)
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
      422: { description: 'Validation error', content: { 'application/json': { schema: ErrorResponse } } },
    },
  } as any

  async handle(c: AppCtx) {
    const bodyResult = CreateItemSchema.safeParse(await c.req.json().catch(() => null))
    if (!bodyResult.success) {
      return c.json({ error: bodyResult.error.issues[0]?.message ?? 'Datos inválidos' }, 422)
    }

    const db = createDb(c.env.DB)
    const item = await createItem(db, bodyResult.data)
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
      400: { description: 'Invalid ID', content: { 'application/json': { schema: ErrorResponse } } },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } },
      422: { description: 'Validation error', content: { 'application/json': { schema: ErrorResponse } } },
    },
  } as any

  async handle(c: AppCtx) {
    const paramsResult = ItemIdParamSchema.safeParse(c.req.param())
    if (!paramsResult.success) {
      return c.json({ error: paramsResult.error.issues[0]?.message ?? 'ID inválido' }, 400)
    }

    const bodyResult = UpdateItemSchema.safeParse(await c.req.json().catch(() => null))
    if (!bodyResult.success) {
      return c.json({ error: bodyResult.error.issues[0]?.message ?? 'Datos inválidos' }, 422)
    }

    const db = createDb(c.env.DB)
    const item = await updateItem(db, paramsResult.data.id, bodyResult.data)
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
      200: { description: 'OK', content: { 'application/json': { schema: DeleteResponse } } },
      400: { description: 'Invalid ID', content: { 'application/json': { schema: ErrorResponse } } },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } },
    },
  } as any

  async handle(c: AppCtx) {
    const paramsResult = ItemIdParamSchema.safeParse(c.req.param())
    if (!paramsResult.success) {
      return c.json({ error: paramsResult.error.issues[0]?.message ?? 'ID inválido' }, 400)
    }

    const db = createDb(c.env.DB)
    const deleted = await deleteItem(db, paramsResult.data.id)
    if (!deleted) return c.json({ error: 'Item no encontrado' }, 404)

    return c.json({ message: 'Item eliminado' })
  }
}
