import { z } from 'zod'

export const CategorySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string().nullable(),
  created_at: z.string(),
})

export const CreateCategorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
})

export const UpdateCategorySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
})

export const CategoryIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})
