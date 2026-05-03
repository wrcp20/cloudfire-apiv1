import { eq } from 'drizzle-orm'
import type { AppDb } from '../db'
import { users } from '../db/schema'
import type { User } from '../types'

export async function findAllUsers(db: AppDb): Promise<User[]> {
  return db.select().from(users)
}

export async function findUserById(db: AppDb, id: number): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1)
  return rows[0] ?? null
}

type UserCreateInput = {
  name: string
  email: string
}

type UserUpdateInput = {
  name?: string
  email?: string
}

export async function createUser(db: AppDb, data: UserCreateInput): Promise<User> {
  const rows = await db
    .insert(users)
    .values({
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
    })
    .returning()

  return rows[0] as User
}

export async function updateUser(db: AppDb, id: number, data: UserUpdateInput): Promise<User | null> {
  const patch: Partial<typeof users.$inferInsert> = {}

  if (data.name !== undefined) patch.name = data.name.trim()
  if (data.email !== undefined) patch.email = data.email.toLowerCase().trim()

  if (Object.keys(patch).length === 0) {
    return findUserById(db, id)
  }

  const rows = await db.update(users).set(patch).where(eq(users.id, id)).returning()
  return rows[0] ?? null
}

export async function deleteUser(db: AppDb, id: number): Promise<boolean> {
  const rows = await db.delete(users).where(eq(users.id, id)).returning()
  return rows.length > 0
}
