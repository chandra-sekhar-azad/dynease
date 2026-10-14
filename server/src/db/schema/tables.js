
const {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} = require('drizzle-orm/pg-core');

const { restaurants } = require('./restaurants');
const { tableStatusEnum } = require('./enums');

const tables = pgTable(
  'tables',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    restaurant_id: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id),
    table_code: varchar('table_code', { length: 100 }).notNull(),
    qr_token: varchar('qr_token', { length: 255 }).notNull(),
    table_status: tableStatusEnum('table_status').notNull().default('ACTIVE'),
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
    uniqueIndex('tables_restaurant_code_unique').on(
      table.restaurant_id,
      table.table_code
    ),
    uniqueIndex('tables_qr_token_unique').on(table.qr_token),
    index('tables_restaurant_idx').on(table.restaurant_id),
  ]
);

module.exports = { tables };
