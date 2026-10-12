const { pgTable, varchar, timestamp, index, uniqueIndex } = require('drizzle-orm/pg-core');
const { sql } = require('drizzle-orm');
const { assignmentStatusEnum, assignmentTypeEnum } = require('./enums');
const { restaurants } = require('./restaurants');
const { tables } = require('./tables');
const { users } = require('./users');

const tables_assignment = pgTable('tables_assignment', {
  id: varchar('id', { length: 64 }).primaryKey(),
  restaurant_id: varchar('restaurant_id', { length: 64 }).notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  table_id: varchar('table_id', { length: 64 }).notNull().references(() => tables.id, { onDelete: 'cascade' }),
  staff_id: varchar('staff_id', { length: 64 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  assignment_type: assignmentTypeEnum('assignment_type').notNull().default('MANUAL'),
  assigned_at: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
  assigned_by: varchar('assigned_by', { length: 64 }),
  released_at: timestamp('released_at', { withTimezone: true }),
  assignment_status: assignmentStatusEnum('assignment_status').notNull().default('ASSIGNED'),
  createdat: timestamp('createdat', { withTimezone: true }).defaultNow().notNull(),
  updatedat: timestamp('updatedat', { withTimezone: true }).defaultNow().notNull(),
  createdby: varchar('createdby', { length: 64 }),
  updatedby: varchar('updatedby', { length: 64 })
}, (table) => [
  uniqueIndex('uq_table_active_assignment')
    .on(table.table_id)
    .where(sql`${table.assignment_status} = 'ASSIGNED'`),
  index('idx_tables_assignment_restaurant_staff')
    .on(table.restaurant_id, table.staff_id)
]);

module.exports = { tables_assignment };
