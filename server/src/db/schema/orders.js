
const {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  timestamp,
  text,
  index,
  uniqueIndex,
} = require('drizzle-orm/pg-core');
const { sql } = require('drizzle-orm');

const { restaurants } = require('./restaurants');
const { tables } = require('./tables');
const { leads } = require('./leads');
const { users } = require('./users');
const { menu_categories_items } = require('./menu');
const { orderStatusEnum } = require('./enums');
const { table_session } = require('./table_session');

const order_details = pgTable(
  'order_details',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    restaurant_id: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id),
    table_id: uuid('table_id').references(() => tables.id),
    lead_id: uuid('lead_id').references(() => leads.id),
    session_id: uuid('session_id').references(() => table_session.id),
    order_status: orderStatusEnum('order_status').notNull().default('NO_ORDER'),
    app_status: varchar('app_status', { length: 30 }).notNull().default('PENDING'),
    order_number: varchar('order_number', { length: 100 }),
    customer_name: varchar('customer_name', { length: 255 }),
    customer_phone: varchar('customer_phone', { length: 30 }),
    total_amount: numeric('total_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    tax_amount: numeric('tax_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    discount_amount: numeric('discount_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    final_amount: numeric('final_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    payment_status: varchar('payment_status', { length: 30 }).notNull().default('PENDING'),
    payment_method: varchar('payment_method', { length: 30 }).notNull().default('CASH'),
    special_instructions: text('special_instructions'),
    assigned_waiter_id: uuid('assigned_waiter_id').references(() => users.id),
    date: timestamp('date', { withTimezone: true }).notNull().defaultNow(),
    createdat: timestamp('createdat', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedat: timestamp('updatedat', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('order_details_restaurant_idx').on(table.restaurant_id),
    index('order_details_table_idx').on(table.table_id),
    index('order_details_lead_idx').on(table.lead_id),
    index('order_details_session_idx').on(table.session_id),
    index('order_details_status_idx').on(table.order_status),
    index('order_details_app_status_idx').on(table.app_status),
    index('order_details_order_number_idx').on(table.order_number),
    uniqueIndex('active_table_visit_idx')
      .on(table.table_id)
      .where(sql`${table.order_status} NOT IN ('COMPLETED', 'CANCELLED')`),
  ]
);

const customer_orders = pgTable(
  'customer_orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    restaurant_id: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id),
    visit_id: uuid('visit_id')
      .notNull()
      .references(() => order_details.id, { onDelete: 'cascade' }),
    order_number: varchar('order_number', { length: 100 }).notNull(),
    order_status: varchar('order_status', { length: 30 }).notNull().default('SUBMITTED'),
    idempotency_key: varchar('idempotency_key', { length: 255 }),
    subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull().default('0'),
    special_instructions: text('special_instructions'),
    createdat: timestamp('createdat', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedat: timestamp('updatedat', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('customer_orders_visit_idx').on(table.visit_id),
    index('customer_orders_restaurant_idx').on(table.restaurant_id),
    uniqueIndex('customer_orders_idempotency_idx').on(
      table.restaurant_id,
      table.idempotency_key
    ),
  ]
);

const order_items = pgTable(
  'order_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    restaurant_id: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id),
    order_id: uuid('order_id')
      .references(() => customer_orders.id),
    visit_id: uuid('visit_id')
      .references(() => order_details.id),
    item_name: varchar('item_name', { length: 255 }).notNull(),
    menu_item_id: uuid('menu_item_id').references(() => menu_categories_items.id),
    quantity: integer('quantity').notNull(),
    requested_quantity: integer('requested_quantity'),
    accepted_quantity: integer('accepted_quantity'),
    unit_price: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
    total: numeric('total', { precision: 12, scale: 2 }).notNull(),
    item_status: varchar('item_status', { length: 30 }).default('PENDING'),
    rejection_reason: text('rejection_reason'),
    modified_by: uuid('modified_by').references(() => users.id),
    modified_at: timestamp('modified_at', { withTimezone: true }),
    customizations: text('customizations'),
    createdat: timestamp('createdat', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedat: timestamp('updatedat', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('order_items_restaurant_idx').on(table.restaurant_id),
    index('order_items_order_idx').on(table.order_id),
    index('order_items_visit_idx').on(table.visit_id),
    index('order_items_menu_item_idx').on(table.menu_item_id),
  ]
);

module.exports = { order_details, customer_orders, order_items };
