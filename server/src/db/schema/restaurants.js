const { pgTable, varchar, text, timestamp, boolean, jsonb, uniqueIndex } = require('drizzle-orm/pg-core');
const { sql } = require('drizzle-orm');
const { restaurantStatusEnum, tableAllocationModeEnum } = require('./enums');
const { plans } = require('./plans');

const restaurants = pgTable('restaurants', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  address: jsonb('address'),
  phone_number: varchar('phone_number', { length: 50 }),
  restaurant_status: restaurantStatusEnum('restaurant_status').notNull().default('ACTIVE'),
  plan_id: varchar('plan_id', { length: 64 }).references(() => plans.id, { onDelete: 'restrict' }),
  is_plan_overridden: boolean('is_plan_overridden').notNull().default(false),
  overriden_plan: jsonb('overriden_plan'),
  domain: varchar('domain', { length: 255 }).notNull(),
  table_allocation_mode: tableAllocationModeEnum('table_allocation_mode').notNull().default('MANUAL'),
  is_deleted: boolean('is_deleted').notNull().default(false),
  createdat: timestamp('createdat', { withTimezone: true }).defaultNow().notNull(),
  updatedat: timestamp('updatedat', { withTimezone: true }).defaultNow().notNull(),
  deletedat: timestamp('deletedat', { withTimezone: true }),
  createdby: varchar('createdby', { length: 64 }),
  updatedby: varchar('updatedby', { length: 64 }),
  deletedby: varchar('deletedby', { length: 64 })
}, (table) => [
  uniqueIndex('uq_restaurants_domain_active')
    .on(sql`LOWER(${table.domain})`)
    .where(sql`${table.is_deleted} = false`)
]);

module.exports = { restaurants };
