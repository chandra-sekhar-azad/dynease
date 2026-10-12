const { pgTable, varchar, timestamp, boolean, integer, uniqueIndex } = require('drizzle-orm/pg-core');
const { sql } = require('drizzle-orm');
const { tableStatusEnum } = require('./enums');
const { restaurants } = require('./restaurants');

const tables = pgTable('tables', {
  id: varchar('id', { length: 64 }).primaryKey(),
  restaurant_id: varchar('restaurant_id', { length: 64 }).notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  table_code: varchar('table_code', { length: 50 }).notNull(),
  capacity: integer('capacity').notNull().default(4),
  section: varchar('section', { length: 100 }),
  qr_token: varchar('qr_token', { length: 255 }).notNull().unique(),
  table_status: tableStatusEnum('table_status').notNull().default('ACTIVE'),
  is_deleted: boolean('is_deleted').notNull().default(false),
  createdat: timestamp('createdat', { withTimezone: true }).defaultNow().notNull(),
  updatedat: timestamp('updatedat', { withTimezone: true }).defaultNow().notNull(),
  deletedat: timestamp('deletedat', { withTimezone: true }),
  createdby: varchar('createdby', { length: 64 }),
  updatedby: varchar('updatedby', { length: 64 }),
  deletedby: varchar('deletedby', { length: 64 })
}, (table) => [
  uniqueIndex('uq_tables_restaurant_code_active')
    .on(table.restaurant_id, table.table_code)
    .where(sql`${table.is_deleted} = false`)
]);

module.exports = { tables };
