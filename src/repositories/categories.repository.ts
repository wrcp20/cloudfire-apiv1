import { eq } from 'drizzle-orm'
import type { AppDb } from '../db'
import { categories } from '../db/schema'
import type { Category } from '../types'

export async function findAllCategories(db: AppDb): Promise<Category[]> {
  return db.select().from(categories)
}

export async function findCategoryById(db: AppDb, id: number): Promise<Category | null> {
  const rows = await db.select().from(categories).where(eq(categories.id, id)).limit(1)
  return rows[0] ?? null
}

type CategoryCreateInput = {
  name: string
  description?: string | null
}

type CategoryUpdateInput = {
  name?: string
  description?: string | null
}

export async function createCategory(db: AppDb, data: CategoryCreateInput): Promise<Category> {
  const rows = await db
    .insert(categories)
    .values({
      name: data.name.trim(),
      description: data.description ?? null,
    })
    .returning()

  return rows[0] as Category
}

export async function updateCategory(db: AppDb, id: number, data: CategoryUpdateInput): Promise<Category | null> {
  const patch: Partial<typeof categories.$inferInsert> = {}

  if (data.name !== undefined) patch.name = data.name.trim()
  if ('description' in data) patch.description = data.description ?? null

  if (Object.keys(patch).length === 0) {
    return findCategoryById(db, id)
  }

  const rows = await db.update(categories).set(patch).where(eq(categories.id, id)).returning()
  return rows[0] ?? null
}

export async function deleteCategory(db: AppDb, id: number): Promise<boolean> {
  const rows = await db.delete(categories).where(eq(categories.id, id)).returning()
  return rows.length > 0
}
