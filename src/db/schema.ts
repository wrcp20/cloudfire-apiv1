import { sql } from 'drizzle-orm'
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const items = sqliteTable('items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  price: real('price').notNull().default(0),
  category_id: integer('category_id').references(() => categories.id),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').notNull().references(() => users.id),
  status: text('status', { enum: ['pending', 'confirmed', 'shipped', 'delivered'] })
    .notNull()
    .default('pending'),
  total: real('total').notNull().default(0),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const orderItems = sqliteTable('order_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  order_id: integer('order_id').notNull().references(() => orders.id),
  item_id: integer('item_id').notNull().references(() => items.id),
  quantity: integer('quantity').notNull(),
  unit_price: real('unit_price').notNull(),
})
