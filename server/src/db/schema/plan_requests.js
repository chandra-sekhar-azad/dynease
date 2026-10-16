const {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} = require('drizzle-orm/pg-core');

const { restaurants } = require('./restaurants');
const { plans } = require('./plans');
const { users } = require('./users');

const plan_requests = pgTable(
  'plan_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    restaurant_id: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    plan_id: uuid('plan_id')
      .notNull()
      .references(() => plans.id),
    billing_cycle: varchar('billing_cycle', { length: 50 })
      .notNull()
      .default('monthly'),
    status: varchar('status', { length: 50 })
      .notNull()
      .default('PENDING'),
    requested_by: uuid('requested_by').references(() => users.id, { onDelete: 'set null' }),
    rejection_reason: text('rejection_reason'),
    createdat: timestamp('createdat', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedat: timestamp('updatedat', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('plan_requests_restaurant_idx').on(table.restaurant_id),
    index('plan_requests_status_idx').on(table.status),
  ]
);

module.exports = { plan_requests };
