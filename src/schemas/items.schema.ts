import { z } from 'zod'

export const ItemSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  category_id: z.number().int().nullable(),
  created_at: z.string(),
})

export const CreateItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  price: z.number().min(0).max(999_999),
  category_id: z.number().int().positive().nullable().optional(),
})

export const UpdateItemSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  price: z.number().min(0).max(999_999).optional(),
  category_id: z.number().int().positive().nullable().optional(),
})

export const ItemIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const ItemsQuerySchema = z.object({
  category_id: z.coerce.number().int().positive().optional(),
})
