
const {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  index,
} = require('drizzle-orm/pg-core');

const { restaurants } = require('./restaurants');
const { userTypeEnum, userStatusEnum } = require('./enums');

const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    phone_number: varchar('phone_number', { length: 30 }),
    password_hash: varchar('password_hash', { length: 255 }).notNull(),
    restaurant_id: uuid('restaurant_id').references(() => restaurants.id),
    user_type: userTypeEnum('user_type').notNull(),
    user_status: userStatusEnum('user_status').notNull().default('ACTIVE'),
    sessionVersion: integer('sessionVersion').notNull().default(0),
    is_deleted: boolean('is_deleted').notNull().default(false),
    createdat: timestamp('createdat', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedat: timestamp('updatedat', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedat: timestamp('deletedat', { withTimezone: true }),
  },
  (table) => [
    index('users_restaurant_idx').on(table.restaurant_id),
    index('users_status_idx').on(table.user_status),
  ]
);

module.exports = { users };
