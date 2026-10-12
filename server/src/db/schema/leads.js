const { pgTable, varchar, timestamp, boolean, integer, uniqueIndex } = require('drizzle-orm/pg-core');
const { restaurants } = require('./restaurants');

const leads = pgTable('leads', {
  id: varchar('id', { length: 64 }).primaryKey(),
  restaurant_id: varchar('restaurant_id', { length: 64 }).notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }),
  number: varchar('number', { length: 50 }).notNull(),
  visits: integer('visits').notNull().default(0),
  is_deleted: boolean('is_deleted').notNull().default(false),
  createdat: timestamp('createdat', { withTimezone: true }).defaultNow().notNull(),
  updatedat: timestamp('updatedat', { withTimezone: true }).defaultNow().notNull(),
  deletedat: timestamp('deletedat', { withTimezone: true }),
  createdby: varchar('createdby', { length: 64 }),
  updatedby: varchar('updatedby', { length: 64 }),
  deletedby: varchar('deletedby', { length: 64 })
}, (table) => [
  uniqueIndex('uq_leads_restaurant_number')
    .on(table.restaurant_id, table.number)
]);

module.exports = { leads };
