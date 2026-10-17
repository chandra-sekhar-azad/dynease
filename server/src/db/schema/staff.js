
const {
  pgTable,
  uuid,
  varchar,
  time,
  date,
  timestamp,
  index,
  uniqueIndex,
} = require('drizzle-orm/pg-core');

const { restaurants } = require('./restaurants');
const { users } = require('./users');
const { shiftTypeEnum } = require('./enums');

const shifts = pgTable(
  'shifts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    restaurant_id: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id),
    name: varchar('name', { length: 100 }),
    start_time: time('start_time').notNull(),
    end_time: time('end_time').notNull(),
    createdat: timestamp('createdat', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedat: timestamp('updatedat', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('shifts_restaurant_idx').on(table.restaurant_id)]
);

const rosters = pgTable(
  'rosters',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    restaurant_id: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id),
    date: date('date').notNull(),
    shift_id: uuid('shift_id').references(() => shifts.id),
    shift_type: shiftTypeEnum('shift_type').notNull().default('WORKING'),
    createdat: timestamp('createdat', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedat: timestamp('updatedat', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('rosters_user_date_unique').on(table.user_id, table.date),
    index('rosters_restaurant_idx').on(table.restaurant_id),
    index('rosters_shift_idx').on(table.shift_id),
  ]
);

module.exports = { shifts, rosters };
