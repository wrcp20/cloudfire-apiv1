import { z } from 'zod'

export const UserSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string().email(),
  created_at: z.string(),
})

export const CreateUserSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().email().max(200),
})

export const UpdateUserSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().email().max(200).optional(),
})

export const UserIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})
