const { pgTable, varchar, timestamp, text, jsonb } = require('drizzle-orm/pg-core');
const { restaurants } = require('./restaurants');
const { tables } = require('./tables');
const { users } = require('./users');

const service_requests = pgTable('service_requests', {
  id: varchar('id', { length: 64 }).primaryKey(),
  restaurant_id: varchar('restaurant_id', { length: 64 }).notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  table_id: varchar('table_id', { length: 64 }).notNull().references(() => tables.id, { onDelete: 'cascade' }),
  table_number: varchar('table_number', { length: 50 }).notNull(),
  type: varchar('type', { length: 50 }).notNull().default('CALL_WAITER'),
  note: text('note').default(''),
  status: varchar('status', { length: 50 }).notNull().default('OPEN'),
  assigned_waiter_id: varchar('assigned_waiter_id', { length: 64 }).references(() => users.id, { onDelete: 'set null' }),
  acknowledged_at: timestamp('acknowledged_at', { withTimezone: true }),
  resolved_at: timestamp('resolved_at', { withTimezone: true }),
  resolved_by: varchar('resolved_by', { length: 255 }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

const assignment_events = pgTable('assignment_events', {
  id: varchar('id', { length: 64 }).primaryKey(),
  restaurant_id: varchar('restaurant_id', { length: 64 }).notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  target_type: varchar('target_type', { length: 50 }).notNull(),
  target_id: varchar('target_id', { length: 64 }).notNull(),
  table_id: varchar('table_id', { length: 64 }),
  table_number: varchar('table_number', { length: 50 }),
  previous_waiter_id: varchar('previous_waiter_id', { length: 64 }),
  new_waiter_id: varchar('new_waiter_id', { length: 64 }),
  assignment_mode: varchar('assignment_mode', { length: 50 }).default('HYBRID'),
  action: varchar('action', { length: 50 }).notNull(),
  actor_id: varchar('actor_id', { length: 64 }),
  actor_role: varchar('actor_role', { length: 50 }),
  score: varchar('score', { length: 50 }),
  score_inputs: jsonb('score_inputs'),
  reason: text('reason'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

module.exports = { service_requests, assignment_events };
