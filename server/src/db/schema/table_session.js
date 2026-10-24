const {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
  uniqueIndex,
} = require('drizzle-orm/pg-core');
const { sql } = require('drizzle-orm');

const { restaurants } = require('./restaurants');
const { tables } = require('./tables');
const { leads } = require('./leads');
const { users } = require('./users');
const { sessionStatusEnum } = require('./enums');

const table_session = pgTable(
  'table_session',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    restaurant_id: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    table_id: uuid('table_id')
      .notNull()
      .references(() => tables.id, { onDelete: 'cascade' }),
    lead_id: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    session_token: varchar('session_token', { length: 255 }).notNull(),
    session_start_time: timestamp('session_start_time', { withTimezone: true })
      .notNull()
      .defaultNow(),
    session_end_time: timestamp('session_end_time', { withTimezone: true }),
    session_status: sessionStatusEnum('session_status')
      .notNull()
      .default('ACTIVE'),
    closed_by: uuid('closed_by').references(() => users.id, { onDelete: 'set null' }),
    createdat: timestamp('createdat', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedat: timestamp('updatedat', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('table_session_restaurant_idx').on(table.restaurant_id),
    index('table_session_table_idx').on(table.table_id),
    index('table_session_lead_idx').on(table.lead_id),
    index('table_session_token_idx').on(table.session_token),
    index('table_session_status_idx').on(table.session_status),
    uniqueIndex('active_table_session_idx')
      .on(table.table_id)
      .where(sql`${table.session_status} = 'ACTIVE'`),
  ]
);

module.exports = { table_session };
