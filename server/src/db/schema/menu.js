const { pgTable, varchar, text, timestamp, boolean, integer, numeric, index, uniqueIndex } = require('drizzle-orm/pg-core');
const { sql } = require('drizzle-orm');
const { menuCategoryStatusEnum, menuItemStatusEnum, menuItemTypeEnum, itemSizeEnum } = require('./enums');
const { restaurants } = require('./restaurants');

const menu_categories = pgTable('menu_categories', {
  id: varchar('id', { length: 64 }).primaryKey(),
  restaurant_id: varchar('restaurant_id', { length: 64 }).notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  category: varchar('category', { length: 255 }).notNull(),
  description: text('description'),
  menu_category_status: menuCategoryStatusEnum('menu_category_status').notNull().default('ACTIVE'),
  display_order: integer('display_order').notNull().default(0),
  is_deleted: boolean('is_deleted').notNull().default(false),
  createdat: timestamp('createdat', { withTimezone: true }).defaultNow().notNull(),
  updatedat: timestamp('updatedat', { withTimezone: true }).defaultNow().notNull(),
  deletedat: timestamp('deletedat', { withTimezone: true }),
  createdby: varchar('createdby', { length: 64 }),
  updatedby: varchar('updatedby', { length: 64 }),
  deletedby: varchar('deletedby', { length: 64 })
}, (table) => [
  uniqueIndex('uq_menu_categories_restaurant_name_active')
    .on(table.restaurant_id, sql`LOWER(${table.category})`)
    .where(sql`${table.is_deleted} = false`)
]);

const menu_categories_items = pgTable('menu_categories_items', {
  id: varchar('id', { length: 64 }).primaryKey(),
  restaurant_id: varchar('restaurant_id', { length: 64 }).notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  category_id: varchar('category_id', { length: 64 }).notNull().references(() => menu_categories.id, { onDelete: 'cascade' }),
  menu_item_status: menuItemStatusEnum('menu_item_status').notNull().default('AVAILABLE'),
  menu_item_type: menuItemTypeEnum('menu_item_type').notNull().default('VEG'),
  name: varchar('name', { length: 255 }).notNull(),
  item_size: itemSizeEnum('item_size').default('MEDIUM'),
  description: text('description'),
  price: numeric('price', { precision: 10, scale: 2 }).notNull().default('0.00'),
  rating: numeric('rating', { precision: 3, scale: 2 }).default('5.00'),
  preparation_time: integer('preparation_time').default(15),
  image: text('image'),
  is_deleted: boolean('is_deleted').notNull().default(false),
  createdat: timestamp('createdat', { withTimezone: true }).defaultNow().notNull(),
  updatedat: timestamp('updatedat', { withTimezone: true }).defaultNow().notNull(),
  deletedat: timestamp('deletedat', { withTimezone: true }),
  createdby: varchar('createdby', { length: 64 }),
  updatedby: varchar('updatedby', { length: 64 }),
  deletedby: varchar('deletedby', { length: 64 })
}, (table) => [
  uniqueIndex('uq_menu_items_category_name_active')
    .on(table.category_id, sql`LOWER(${table.name})`)
    .where(sql`${table.is_deleted} = false`),
  index('idx_menu_items_restaurant_status')
    .on(table.restaurant_id, table.menu_item_status)
]);

module.exports = { menu_categories, menu_categories_items };
