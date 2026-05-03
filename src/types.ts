import type { InferSelectModel } from 'drizzle-orm'
import type * as schema from './db/schema'

export type Category = InferSelectModel<typeof schema.categories>
export type User = InferSelectModel<typeof schema.users>
export type Item = InferSelectModel<typeof schema.items>
export type Order = InferSelectModel<typeof schema.orders>
export type OrderItem = InferSelectModel<typeof schema.orderItems>

export type Bindings = {
  DB: D1Database
  API_KEY: string
  ALLOWED_ORIGIN: string
}
