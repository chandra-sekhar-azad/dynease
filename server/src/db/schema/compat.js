
const {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  index,
} = require('drizzle-orm/pg-core');

const { restaurants } = require('./restaurants');
const { tables } = require('./tables');
const { users } = require('./users');

const service_requests = pgTable(
  'service_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    restaurant_id: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id),
    table_id: uuid('table_id').references(() => tables.id),
    request_type: varchar('request_type', { length: 100 }).notNull(),
    request_status: varchar('request_status', { length: 50 })
      .notNull()
      .default('PENDING'),
    details: jsonb('details').notNull().default({}),
    createdat: timestamp('createdat', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedat: timestamp('updatedat', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('service_requests_restaurant_idx').on(table.restaurant_id),
    index('service_requests_table_idx').on(table.table_id),
    index('service_requests_status_idx').on(table.request_status),
  ]
);

const assignment_events = pgTable(
  'assignment_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    restaurant_id: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id),
    assignment_id: uuid('assignment_id').notNull(),
    staff_id: uuid('staff_id').references(() => users.id),
    event_type: varchar('event_type', { length: 100 }).notNull(),
    details: jsonb('details').notNull().default({}),
    createdat: timestamp('createdat', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('assignment_events_restaurant_idx').on(table.restaurant_id),
    index('assignment_events_assignment_idx').on(table.assignment_id),
    index('assignment_events_staff_idx').on(table.staff_id),
  ]
);

module.exports = { service_requests, assignment_events };
