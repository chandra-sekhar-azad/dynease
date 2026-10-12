const { pgTable, varchar, timestamp, date, uniqueIndex, index } = require('drizzle-orm/pg-core');
const { shiftTypeEnum } = require('./enums');
const { restaurants } = require('./restaurants');
const { users } = require('./users');

const shifts = pgTable('shifts', {
  id: varchar('id', { length: 64 }).primaryKey(),
  restaurant_id: varchar('restaurant_id', { length: 64 }).notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  start_time: varchar('start_time', { length: 10 }).notNull(), // 'HH:mm'
  end_time: varchar('end_time', { length: 10 }).notNull(),     // 'HH:mm'
  name: varchar('name', { length: 100 }).default('Default Shift'),
  createdat: timestamp('createdat', { withTimezone: true }).defaultNow().notNull(),
  updatedat: timestamp('updatedat', { withTimezone: true }).defaultNow().notNull(),
  createdby: varchar('createdby', { length: 64 }),
  updatedby: varchar('updatedby', { length: 64 })
}, (table) => [
  index('idx_shifts_restaurant').on(table.restaurant_id)
]);

const rosters = pgTable('rosters', {
  id: varchar('id', { length: 64 }).primaryKey(),
  restaurant_id: varchar('restaurant_id', { length: 64 }).notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  user_id: varchar('user_id', { length: 64 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  shift_id: varchar('shift_id', { length: 64 }).references(() => shifts.id, { onDelete: 'set null' }),
  shift_type: shiftTypeEnum('shift_type').notNull().default('WORKING'),
  createdat: timestamp('createdat', { withTimezone: true }).defaultNow().notNull(),
  updatedat: timestamp('updatedat', { withTimezone: true }).defaultNow().notNull(),
  createdby: varchar('createdby', { length: 64 }),
  updatedby: varchar('updatedby', { length: 64 })
}, (table) => [
  uniqueIndex('uq_rosters_restaurant_user_date')
    .on(table.restaurant_id, table.user_id, table.date)
]);

module.exports = { shifts, rosters };
