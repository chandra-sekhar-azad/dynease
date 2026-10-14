
const {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} = require('drizzle-orm/pg-core');

const ads = pgTable(
  'ads',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    image: text('image'),
    display_order: integer('display_order').notNull().default(0),
    url: text('url'),
    ad_status: boolean('ad_status').notNull().default(true),
    createdat: timestamp('createdat', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedat: timestamp('updatedat', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('ads_status_idx').on(table.ad_status),
    index('ads_display_order_idx').on(table.display_order),
  ]
);

module.exports = { ads };
