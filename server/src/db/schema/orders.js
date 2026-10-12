const { pgTable, varchar, timestamp, numeric, integer, text, index } = require('drizzle-orm/pg-core');
const { orderStatusEnum } = require('./enums');
const { restaurants } = require('./restaurants');
const { tables } = require('./tables');
const { leads } = require('./leads');
const { menu_categories_items } = require('./menu');

const order_details = pgTable('order_details', {
  id: varchar('id', { length: 64 }).primaryKey(),
  restaurant_id: varchar('restaurant_id', { length: 64 }).notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  table_id: varchar('table_id', { length: 64 }).notNull().references(() => tables.id, { onDelete: 'cascade' }),
  lead_id: varchar('lead_id', { length: 64 }).references(() => leads.id, { onDelete: 'set null' }),
  order_status: orderStatusEnum('order_status').notNull().default('ORDERED'),
  date: timestamp('date', { withTimezone: true }).defaultNow().notNull(),
  order_number: varchar('order_number', { length: 100 }),
  customer_name: varchar('customer_name', { length: 255 }).default('Guest'),
  customer_phone: varchar('customer_phone', { length: 50 }),
  total_amount: numeric('total_amount', { precision: 10, scale: 2 }).notNull().default('0.00'),
  tax_amount: numeric('tax_amount', { precision: 10, scale: 2 }).default('0.00'),
  discount_amount: numeric('discount_amount', { precision: 10, scale: 2 }).default('0.00'),
  final_amount: numeric('final_amount', { precision: 10, scale: 2 }).notNull().default('0.00'),
  payment_status: varchar('payment_status', { length: 50 }).default('PENDING'),
  payment_method: varchar('payment_method', { length: 50 }).default('CASH'),
  special_instructions: text('special_instructions'),
  assigned_waiter_id: varchar('assigned_waiter_id', { length: 64 }),
  app_status: varchar('app_status', { length: 50 }).default('PENDING'),
  createdat: timestamp('createdat', { withTimezone: true }).defaultNow().notNull(),
  updatedat: timestamp('updatedat', { withTimezone: true }).defaultNow().notNull(),
  createdby: varchar('createdby', { length: 64 }),
  updatedby: varchar('updatedby', { length: 64 })
}, (table) => [
  index('idx_order_details_restaurant_date')
    .on(table.restaurant_id, table.date),
  index('idx_order_details_restaurant_table')
    .on(table.restaurant_id, table.table_id),
  index('idx_order_details_restaurant_lead')
    .on(table.restaurant_id, table.lead_id)
]);

const order_items = pgTable('order_items', {
  id: varchar('id', { length: 64 }).primaryKey(),
  restaurant_id: varchar('restaurant_id', { length: 64 }).notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  order_id: varchar('order_id', { length: 64 }).notNull().references(() => order_details.id, { onDelete: 'cascade' }),
  item_name: varchar('item_name', { length: 255 }).notNull(),
  menu_item_id: varchar('menu_item_id', { length: 64 }).references(() => menu_categories_items.id, { onDelete: 'set null' }),
  quantity: integer('quantity').notNull().default(1),
  unit_price: numeric('unit_price', { precision: 10, scale: 2 }).notNull().default('0.00'),
  total: numeric('total', { precision: 10, scale: 2 }).notNull().default('0.00'),
  customizations: text('customizations'),
  createdat: timestamp('createdat', { withTimezone: true }).defaultNow().notNull(),
  updatedat: timestamp('updatedat', { withTimezone: true }).defaultNow().notNull(),
  createdby: varchar('createdby', { length: 64 }),
  updatedby: varchar('updatedby', { length: 64 })
}, (table) => [
  index('idx_order_items_restaurant_order')
    .on(table.restaurant_id, table.order_id),
  index('idx_order_items_restaurant_menu_item')
    .on(table.restaurant_id, table.menu_item_id)
]);

module.exports = { order_details, order_items };
