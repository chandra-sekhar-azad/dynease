const {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} = require('drizzle-orm/pg-core');

const { restaurants } = require('./restaurants');
const { plans } = require('./plans');

const restaurant_info = pgTable(
  'restaurant_info',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    restaurant_id: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    plan_id: uuid('plan_id').references(() => plans.id),
    is_plan_overridden: boolean('is_plan_overridden')
      .notNull()
      .default(false),
    overriden_plan: varchar('overriden_plan', { length: 100 }),
    is_active: boolean('is_active').notNull().default(true),
    used_tables: integer('used_tables').notNull().default(0),
    used_menu_items: integer('used_menu_items').notNull().default(0),
    used_staff_accounts: integer('used_staff_accounts').notNull().default(0),
    createdat: timestamp('createdat', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedat: timestamp('updatedat', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('restaurant_info_restaurant_idx').on(table.restaurant_id),
    index('restaurant_info_plan_idx').on(table.plan_id),
  ]
);

module.exports = { restaurant_info };
