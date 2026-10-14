
const {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  timestamp,
  index,
  uniqueIndex,
} = require('drizzle-orm/pg-core');

const { restaurants } = require('./restaurants');
const {
  menuCategoryStatusEnum,
  menuItemStatusEnum,
  menuItemTypeEnum,
  itemSizeEnum,
} = require('./enums');

const menu_categories = pgTable(
  'menu_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    restaurant_id: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id),
    category: varchar('category', { length: 255 }).notNull(),
    description: text('description'),
    menu_category_status: menuCategoryStatusEnum('menu_category_status')
      .notNull()
      .default('ACTIVE'),
    display_order: integer('display_order').notNull().default(0),
    createdat: timestamp('createdat', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedat: timestamp('updatedat', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedat: timestamp('deletedat', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('menu_categories_restaurant_category_unique').on(
      table.restaurant_id,
      table.category
    ),
    index('menu_categories_restaurant_idx').on(table.restaurant_id),
  ]
);

const menu_categories_items = pgTable(
  'menu_categories_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    restaurant_id: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id),
    category_id: uuid('category_id')
      .notNull()
      .references(() => menu_categories.id),
    menu_item_status: menuItemStatusEnum('menu_item_status')
      .notNull()
      .default('AVAILABLE'),
    menu_item_type: menuItemTypeEnum('menu_item_type').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    item_size: itemSizeEnum('item_size').notNull(),
    description: text('description'),
    price: numeric('price', { precision: 12, scale: 2 }).notNull(),
    rating: numeric('rating', { precision: 3, scale: 2 }),
    display_order: integer('display_order').notNull().default(0),
    createdat: timestamp('createdat', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedat: timestamp('updatedat', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedat: timestamp('deletedat', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('menu_items_category_name_size_unique').on(
      table.category_id,
      table.name,
      table.item_size
    ),
    index('menu_items_restaurant_idx').on(table.restaurant_id),
    index('menu_items_category_idx').on(table.category_id),
  ]
);

module.exports = { menu_categories, menu_categories_items };
