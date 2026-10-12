const { pgTable, varchar, timestamp, jsonb, index } = require('drizzle-orm/pg-core');
const { restaurants } = require('./restaurants');
const { users } = require('./users');

const audit_log = pgTable('audit_log', {
  id: varchar('id', { length: 64 }).primaryKey(),
  restaurant_id: varchar('restaurant_id', { length: 64 }).references(() => restaurants.id, { onDelete: 'cascade' }),
  user_id: varchar('user_id', { length: 64 }).references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(),
  entity_type: varchar('entity_type', { length: 100 }).notNull(),
  entity_id: varchar('entity_id', { length: 64 }),
  details: jsonb('details').default('{}'),
  createdat: timestamp('createdat', { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  index('idx_audit_log_restaurant_created')
    .on(table.restaurant_id, table.createdat),
  index('idx_audit_log_restaurant_entity')
    .on(table.restaurant_id, table.entity_type, table.entity_id)
]);

module.exports = { audit_log };
