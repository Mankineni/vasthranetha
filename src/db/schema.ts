import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// All timestamps are epoch milliseconds.

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  login: text('login').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
})

export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at').notNull(),
})

export const loginAttempts = sqliteTable('login_attempts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  login: text('login').notNull(),
  at: integer('at').notNull(),
})

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  codePrefix: text('code_prefix').notNull(),
  tileImage: text('tile_image'),
  position: integer('position').notNull().default(0),
})

export const fabrics = sqliteTable('fabrics', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
})

export const occasions = sqliteTable('occasions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
})

export const priceBands = sqliteTable('price_bands', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  label: text('label').notNull(),
  min: integer('min').notNull(),
  max: integer('max'),
  position: integer('position').notNull().default(0),
})

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  price: integer('price').notNull(),
  status: text('status', { enum: ['draft', 'available', 'sold'] }).notNull().default('draft'),
  categoryId: integer('category_id').notNull().references(() => categories.id),
  fabricId: integer('fabric_id').references(() => fabrics.id),
  length: text('length').notNull().default(''),
  blousePiece: integer('blouse_piece', { mode: 'boolean' }),
  care: text('care').notNull().default(''),
  description: text('description').notNull().default(''),
  sizes: text('sizes', { mode: 'json' }).$type<string[]>().notNull().$defaultFn(() => []),
  colours: text('colours', { mode: 'json' }).$type<string[]>().notNull().$defaultFn(() => []),
  dealerName: text('dealer_name').notNull().default(''),
  dealerCode: text('dealer_code').notNull().default(''),
  dealerPrice: integer('dealer_price'),
  notes: text('notes').notNull().default(''),
  submitToken: text('submit_token').unique(),
  createdBy: integer('created_by').notNull().references(() => users.id),
  updatedBy: integer('updated_by').notNull().references(() => users.id),
  publishedAt: integer('published_at'),
  soldAt: integer('sold_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const productOccasions = sqliteTable(
  'product_occasions',
  {
    productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    occasionId: integer('occasion_id').notNull().references(() => occasions.id),
  },
  (t) => [primaryKey({ columns: [t.productId, t.occasionId] })],
)

export type Variant = { width: number; path: string }

// Deleting a product deliberately does not cascade here: files are shared
// between rows, so media rows are removed through deleteMediaRows().
export const media = sqliteTable('media', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').references(() => products.id),
  batchId: text('batch_id'),
  kind: text('kind', { enum: ['photo', 'video'] }).notNull(),
  position: integer('position').notNull().default(0),
  originalPath: text('original_path').notNull(),
  width: integer('width').notNull().default(0),
  height: integer('height').notNull().default(0),
  variants: text('variants', { mode: 'json' }).$type<Variant[]>().notNull().$defaultFn(() => []),
  previewPath: text('preview_path'),
  createdAt: integer('created_at').notNull(),
})

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export const pages = sqliteTable('pages', {
  slug: text('slug').primaryKey(),
  title: text('title').notNull(),
  body: text('body').notNull(),
})

export const events = sqliteTable(
  'events',
  {
    productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    type: text('type', { enum: ['view', 'order_tap'] }).notNull(),
    day: text('day').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.productId, t.type, t.day] })],
)
