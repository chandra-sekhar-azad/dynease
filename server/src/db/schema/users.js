const { pgTable, varchar, timestamp, boolean, integer, uniqueIndex } = require('drizzle-orm/pg-core');
const { sql } = require('drizzle-orm');
const { userTypeEnum, userStatusEnum } = require('./enums');
const { restaurants } = require('./restaurants');

const users = pgTable('users', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  password: varchar('password', { length: 255 }).notNull(),
  phone_number: varchar('phone_number', { length: 50 }),
  restaurant_id: varchar('restaurant_id', { length: 64 }).references(() => restaurants.id, { onDelete: 'cascade' }),
  user_type: userTypeEnum('user_type').notNull().default('STAFF'),
  user_status: userStatusEnum('user_status').notNull().default('ACTIVE'),
  sessionVersion: integer('sessionVersion').notNull().default(1),
  is_deleted: boolean('is_deleted').notNull().default(false),
  createdat: timestamp('createdat', { withTimezone: true }).defaultNow().notNull(),
  updatedat: timestamp('updatedat', { withTimezone: true }).defaultNow().notNull(),
  deletedat: timestamp('deletedat', { withTimezone: true }),
  createdby: varchar('createdby', { length: 64 }),
  updatedby: varchar('updatedby', { length: 64 }),
  deletedby: varchar('deletedby', { length: 64 })
}, (table) => [
  uniqueIndex('uq_users_email_active')
    .on(sql`LOWER(${table.email})`)
    .where(sql`${table.is_deleted} = false`),
  uniqueIndex('uq_users_phone_active')
    .on(table.phone_number)
    .where(sql`${table.is_deleted} = false AND ${table.phone_number} IS NOT NULL`)
]);

module.exports = { users };
