import { OpenAPIRoute } from 'chanfana'
import type { Context } from 'hono'
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

type AppCtx = Context<{ Bindings: Bindings }>

const CategoriesResponse = z.object({ data: z.array(CategorySchema), count: z.number() })
const CategoryResponse = z.object({ data: CategorySchema })
const ErrorResponse = z.object({ error: z.string() })
const DeleteResponse = z.object({ message: z.string() })

export class CategoriesList extends OpenAPIRoute {
  schema = {
    tags: ['Categories'],
    summary: 'List all categories',
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: CategoriesResponse } } },
    },
  } as any

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
      400: { description: 'Invalid ID', content: { 'application/json': { schema: ErrorResponse } } },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } },
    },
  } as any

  async handle(c: AppCtx) {
    const paramsResult = CategoryIdParamSchema.safeParse(c.req.param())
    if (!paramsResult.success) {
      return c.json({ error: paramsResult.error.issues[0]?.message ?? 'ID inválido' }, 400)
    }

    const db = createDb(c.env.DB)
    const category = await findCategoryById(db, paramsResult.data.id)
    if (!category) return c.json({ error: 'Categoria no encontrada' }, 404)

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
      422: { description: 'Validation error', content: { 'application/json': { schema: ErrorResponse } } },
    },
  } as any

  async handle(c: AppCtx) {
    const bodyResult = CreateCategorySchema.safeParse(await c.req.json().catch(() => null))
    if (!bodyResult.success) {
      return c.json({ error: bodyResult.error.issues[0]?.message ?? 'Datos inválidos' }, 422)
    }

    const db = createDb(c.env.DB)
    const category = await createCategory(db, bodyResult.data)
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
      400: { description: 'Invalid ID', content: { 'application/json': { schema: ErrorResponse } } },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } },
      422: { description: 'Validation error', content: { 'application/json': { schema: ErrorResponse } } },
    },
  } as any

  async handle(c: AppCtx) {
    const paramsResult = CategoryIdParamSchema.safeParse(c.req.param())
    if (!paramsResult.success) {
      return c.json({ error: paramsResult.error.issues[0]?.message ?? 'ID inválido' }, 400)
    }

    const bodyResult = UpdateCategorySchema.safeParse(await c.req.json().catch(() => null))
    if (!bodyResult.success) {
      return c.json({ error: bodyResult.error.issues[0]?.message ?? 'Datos inválidos' }, 422)
    }

    const db = createDb(c.env.DB)
    const category = await updateCategory(db, paramsResult.data.id, bodyResult.data)
    if (!category) return c.json({ error: 'Categoria no encontrada' }, 404)

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
      200: { description: 'OK', content: { 'application/json': { schema: DeleteResponse } } },
      400: { description: 'Invalid ID', content: { 'application/json': { schema: ErrorResponse } } },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } },
    },
  } as any

  async handle(c: AppCtx) {
    const paramsResult = CategoryIdParamSchema.safeParse(c.req.param())
    if (!paramsResult.success) {
      return c.json({ error: paramsResult.error.issues[0]?.message ?? 'ID inválido' }, 400)
    }

    const db = createDb(c.env.DB)
    const deleted = await deleteCategory(db, paramsResult.data.id)
    if (!deleted) return c.json({ error: 'Categoria no encontrada' }, 404)

    return c.json({ message: 'Categoria eliminada' })
  }
}
