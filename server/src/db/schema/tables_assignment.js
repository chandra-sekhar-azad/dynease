
const {
  pgTable,
  uuid,
  timestamp,
  index,
} = require('drizzle-orm/pg-core');

const { restaurants } = require('./restaurants');
const { tables } = require('./tables');
const { users } = require('./users');
const { assignmentStatusEnum, assignmentTypeEnum } = require('./enums');

const tables_assignment = pgTable(
  'tables_assignment',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    restaurant_id: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id),
    table_id: uuid('table_id')
      .notNull()
      .references(() => tables.id),
    staff_id: uuid('staff_id')
      .notNull()
      .references(() => users.id),
    assignment_type: assignmentTypeEnum('assignment_type')
      .notNull()
      .default('MANUAL'),
    assigned_at: timestamp('assigned_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    assigned_by: uuid('assigned_by').references(() => users.id),
    released_at: timestamp('released_at', { withTimezone: true }),
    assignment_status: assignmentStatusEnum('assignment_status')
      .notNull()
      .default('ASSIGNED'),
    createdat: timestamp('createdat', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedat: timestamp('updatedat', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('tables_assignment_restaurant_idx').on(table.restaurant_id),
    index('tables_assignment_table_idx').on(table.table_id),
    index('tables_assignment_staff_idx').on(table.staff_id),
    index('tables_assignment_status_idx').on(table.assignment_status),
  ]
);

module.exports = { tables_assignment };
