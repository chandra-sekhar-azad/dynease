
const {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
  index,
} = require('drizzle-orm/pg-core');

const { restaurants } = require('./restaurants');
const { users } = require('./users');

const audit_log = pgTable(
  'audit_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    restaurant_id: uuid('restaurant_id').references(() => restaurants.id),
    user_id: uuid('user_id').references(() => users.id),
    action: varchar('action', { length: 255 }).notNull(),
    entity_type: varchar('entity_type', { length: 100 }),
    entity_id: uuid('entity_id'),
    details: jsonb('details').notNull().default({}),
    createdat: timestamp('createdat', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('audit_log_restaurant_idx').on(table.restaurant_id),
    index('audit_log_user_idx').on(table.user_id),
    index('audit_log_created_idx').on(table.createdat),
  ]
);

module.exports = { audit_log };
