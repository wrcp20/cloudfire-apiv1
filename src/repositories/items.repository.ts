import { eq } from 'drizzle-orm'
import type { AppDb } from '../db'
import { items } from '../db/schema'
import type { Item } from '../types'

export async function findAllItems(db: AppDb, categoryId?: number): Promise<Item[]> {
  if (categoryId !== undefined) {
    return db.select().from(items).where(eq(items.category_id, categoryId))
  }

  return db.select().from(items)
}

export async function findItemById(db: AppDb, id: number): Promise<Item | null> {
  const rows = await db.select().from(items).where(eq(items.id, id)).limit(1)
  return rows[0] ?? null
}

type ItemCreateInput = {
  name: string
  description?: string | null
  price: number
  category_id?: number | null
}

type ItemUpdateInput = {
  name?: string
  description?: string | null
  price?: number
  category_id?: number | null
}

export async function createItem(db: AppDb, data: ItemCreateInput): Promise<Item> {
  const rows = await db
    .insert(items)
    .values({
      name: data.name.trim(),
      description: data.description ?? null,
      price: data.price,
      category_id: data.category_id ?? null,
    })
    .returning()

  return rows[0] as Item
}

export async function updateItem(db: AppDb, id: number, data: ItemUpdateInput): Promise<Item | null> {
  const patch: Partial<typeof items.$inferInsert> = {}

  if (data.name !== undefined) patch.name = data.name.trim()
  if ('description' in data) patch.description = data.description ?? null
  if (data.price !== undefined) patch.price = data.price
  if ('category_id' in data) patch.category_id = data.category_id ?? null

  if (Object.keys(patch).length === 0) {
    return findItemById(db, id)
  }

  const rows = await db.update(items).set(patch).where(eq(items.id, id)).returning()
  return rows[0] ?? null
}

export async function deleteItem(db: AppDb, id: number): Promise<boolean> {
  const rows = await db.delete(items).where(eq(items.id, id)).returning()
  return rows.length > 0
}
