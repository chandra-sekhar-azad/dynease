const {
  pgTable,
  uuid,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} = require('drizzle-orm/pg-core');

const { ads } = require('./ads');
const { restaurants } = require('./restaurants');

const ads_visibility = pgTable(
  'ads_visibility',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ads_id: uuid('ads_id')
      .notNull()
      .references(() => ads.id, { onDelete: 'cascade' }),
    restaurant_id: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    ads_visibility_status: boolean('ads_visibility_status')
      .notNull()
      .default(true),
    is_deleted: boolean('is_deleted').notNull().default(false),
    createdat: timestamp('createdat', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedat: timestamp('updatedat', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('ads_visibility_ads_restaurant_idx').on(
      table.ads_id,
      table.restaurant_id
    ),
    index('ads_visibility_restaurant_idx').on(table.restaurant_id),
    index('ads_visibility_ads_idx').on(table.ads_id),
    index('ads_visibility_status_idx').on(table.ads_visibility_status),
  ]
);

module.exports = { ads_visibility };
