
const {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  index,
} = require('drizzle-orm/pg-core');

const { restaurants } = require('./restaurants');

const leads = pgTable(
  'leads',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    restaurant_id: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id),
    name: varchar('name', { length: 255 }),
    number: varchar('number', { length: 30 }).notNull(),
    visits: integer('visits').notNull().default(0),
    createdat: timestamp('createdat', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedat: timestamp('updatedat', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedat: timestamp('deletedat', { withTimezone: true }),
  },
  (table) => [
    index('leads_restaurant_idx').on(table.restaurant_id),
    index('leads_number_idx').on(table.number),
  ]
);

module.exports = { leads };
