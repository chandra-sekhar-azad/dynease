const { pgTable, varchar, timestamp, boolean, jsonb } = require('drizzle-orm/pg-core');
const { planStatusEnum } = require('./enums');

const plans = pgTable('plans', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  configuration: jsonb('configuration').notNull().default('{}'),
  plan_status: planStatusEnum('plan_status').notNull().default('ACTIVE'),
  is_deleted: boolean('is_deleted').notNull().default(false),
  createdat: timestamp('createdat', { withTimezone: true }).defaultNow().notNull(),
  updatedat: timestamp('updatedat', { withTimezone: true }).defaultNow().notNull(),
  deletedat: timestamp('deletedat', { withTimezone: true }),
  createdby: varchar('createdby', { length: 64 }),
  updatedby: varchar('updatedby', { length: 64 }),
  deletedby: varchar('deletedby', { length: 64 })
});

module.exports = { plans };
