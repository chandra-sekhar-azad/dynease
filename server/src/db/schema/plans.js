
const {
  pgTable,
  uuid,
  varchar,
  jsonb,
  boolean,
  timestamp,
  uniqueIndex,
} = require('drizzle-orm/pg-core');

const { planStatusEnum } = require('./enums');

const plans = pgTable(
  'plans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    configuration: jsonb('configuration').notNull().default({}),
    plan_status: planStatusEnum('plan_status').notNull().default('ACTIVE'),
    is_deleted: boolean('is_deleted').notNull().default(false),
    createdat: timestamp('createdat', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedat: timestamp('updatedat', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedat: timestamp('deletedat', { withTimezone: true }),
  },
  (table) => [uniqueIndex('plans_name_unique').on(table.name)]
);

module.exports = { plans };
