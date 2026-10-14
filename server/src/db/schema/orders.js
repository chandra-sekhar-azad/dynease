
const {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  timestamp,
  index,
} = require('drizzle-orm/pg-core');

const { restaurants } = require('./restaurants');
const { tables } = require('./tables');
const { leads } = require('./leads');
const { menu_categories_items } = require('./menu');
const { orderStatusEnum } = require('./enums');

const order_details = pgTable(
  'order_details',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    restaurant_id: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id),
    table_id: uuid('table_id').references(() => tables.id),
    lead_id: uuid('lead_id').references(() => leads.id),
    order_status: orderStatusEnum('order_status').notNull().default('NO_ORDER'),
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
    index('order_details_status_idx').on(table.order_status),
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
      .notNull()
      .references(() => order_details.id),
    item_name: varchar('item_name', { length: 255 }).notNull(),
    menu_item_id: uuid('menu_item_id').references(() => menu_categories_items.id),
    quantity: integer('quantity').notNull(),
    unit_price: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
    total: numeric('total', { precision: 12, scale: 2 }).notNull(),
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
    index('order_items_menu_item_idx').on(table.menu_item_id),
  ]
);

module.exports = { order_details, order_items };
