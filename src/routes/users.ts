import { OpenAPIRoute } from 'chanfana'
import type { Context } from 'hono'
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

type AppCtx = Context<{ Bindings: Bindings }>

const UsersResponse = z.object({ data: z.array(UserSchema), count: z.number() })
const UserResponse = z.object({ data: UserSchema })
const ErrorResponse = z.object({ error: z.string() })
const DeleteResponse = z.object({ message: z.string() })

export class UsersList extends OpenAPIRoute {
  schema = {
    tags: ['Users'],
    summary: 'List all users',
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: UsersResponse } } },
    },
  } as any

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
      400: { description: 'Invalid ID', content: { 'application/json': { schema: ErrorResponse } } },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } },
    },
  } as any

  async handle(c: AppCtx) {
    const paramsResult = UserIdParamSchema.safeParse(c.req.param())
    if (!paramsResult.success) {
      return c.json({ error: paramsResult.error.issues[0]?.message ?? 'ID inválido' }, 400)
    }

    const db = createDb(c.env.DB)
    const user = await findUserById(db, paramsResult.data.id)
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
      422: { description: 'Validation error', content: { 'application/json': { schema: ErrorResponse } } },
    },
  } as any

  async handle(c: AppCtx) {
    const bodyResult = CreateUserSchema.safeParse(await c.req.json().catch(() => null))
    if (!bodyResult.success) {
      return c.json({ error: bodyResult.error.issues[0]?.message ?? 'Datos inválidos' }, 422)
    }

    const db = createDb(c.env.DB)
    const user = await createUser(db, bodyResult.data)
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
      400: { description: 'Invalid ID', content: { 'application/json': { schema: ErrorResponse } } },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } },
      422: { description: 'Validation error', content: { 'application/json': { schema: ErrorResponse } } },
    },
  } as any

  async handle(c: AppCtx) {
    const paramsResult = UserIdParamSchema.safeParse(c.req.param())
    if (!paramsResult.success) {
      return c.json({ error: paramsResult.error.issues[0]?.message ?? 'ID inválido' }, 400)
    }

    const bodyResult = UpdateUserSchema.safeParse(await c.req.json().catch(() => null))
    if (!bodyResult.success) {
      return c.json({ error: bodyResult.error.issues[0]?.message ?? 'Datos inválidos' }, 422)
    }

    const db = createDb(c.env.DB)
    const user = await updateUser(db, paramsResult.data.id, bodyResult.data)
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
      200: { description: 'OK', content: { 'application/json': { schema: DeleteResponse } } },
      400: { description: 'Invalid ID', content: { 'application/json': { schema: ErrorResponse } } },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } },
    },
  } as any

  async handle(c: AppCtx) {
    const paramsResult = UserIdParamSchema.safeParse(c.req.param())
    if (!paramsResult.success) {
      return c.json({ error: paramsResult.error.issues[0]?.message ?? 'ID inválido' }, 400)
    }

    const db = createDb(c.env.DB)
    const deleted = await deleteUser(db, paramsResult.data.id)
    if (!deleted) return c.json({ error: 'Usuario no encontrado' }, 404)

    return c.json({ message: 'Usuario eliminado' })
  }
}
