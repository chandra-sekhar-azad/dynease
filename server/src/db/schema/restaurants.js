
const {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
  numeric,
  integer,
} = require('drizzle-orm/pg-core');

const { plans } = require('./plans');
const {
  restaurantStatusEnum,
  tableAllocationModeEnum,
} = require('./enums');

const restaurants = pgTable(
  'restaurants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    restaurant_name: varchar('restaurant_name', { length: 255 }).notNull(),
    address: text('address'),
    phone_number: varchar('phone_number', { length: 30 }),
    latitude: numeric('latitude', { precision: 10, scale: 7 }),
    longitude: numeric('longitude', { precision: 10, scale: 7 }),
    geofence_radius_meters: integer('geofence_radius_meters').notNull().default(50),
    restaurant_status: restaurantStatusEnum('restaurant_status')
      .notNull()
      .default('ACTIVE'),
    plan_id: uuid('plan_id').references(() => plans.id),
    is_plan_overridden: boolean('is_plan_overridden')
      .notNull()
      .default(false),
    overriden_plan: varchar('overriden_plan', { length: 100 }),
    domain: varchar('domain', { length: 255 }).notNull(),
    table_allocation_mode: tableAllocationModeEnum('table_allocation_mode')
      .notNull()
      .default('MANUAL'),
    is_deleted: boolean('is_deleted').notNull().default(false),
    rejection_reason: text('rejection_reason'),
    subscription_start_date: timestamp('subscription_start_date', { withTimezone: true })
      .defaultNow(),
    subscription_end_date: timestamp('subscription_end_date', { withTimezone: true }),
    createdat: timestamp('createdat', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedat: timestamp('updatedat', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedat: timestamp('deletedat', { withTimezone: true }),
  },
  (table) => [
    index('restaurants_status_idx').on(table.restaurant_status),
    index('restaurants_domain_idx').on(table.domain),
  ]
);

module.exports = { restaurants };
