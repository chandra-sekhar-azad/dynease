/**
 * Seed Menu Categories for a Restaurant.
 *
 * Usage:
 *   node scripts/seedCategories.js [domain_or_subdomain]
 * Default target: 'test' (i.e. test.dynease.in)
 */
require('../src/config/env');

const { eq, and, sql, isNull } = require('drizzle-orm');
const { db, pool } = require('../src/db/client');
const { restaurants } = require('../src/db/schema/restaurants');
const { menu_categories } = require('../src/db/schema/menu');

const TARGET_DOMAIN = process.argv[2] || 'test';

const CATEGORIES = [
  'Starters',
  'Veg Starters',
  'Non-Veg Starters',
  'Soups',
  'Salads',
  'Biryanis',
  'Pulao',
  'Fried Rice',
  'Rice & Main Course',
  'Veg Curries',
  'Non-Veg Curries',
  'Chicken Curries',
  'Mutton Curries',
  'Seafood Curries',
  'Paneer Curries',
  'Dal Items',
  'Indian Breads',
  'Tandoori Items',
  'Kebabs',
  'Grilled Items',
  'South Indian Tiffins',
  'North Indian Dishes',
  'Andhra Specials',
  'Telangana Specials',
  'Chinese',
  'Indo-Chinese',
  'Noodles',
  'Fast Food',
  'Burgers',
  'Pizza',
  'Pasta',
  'Sandwiches',
  'Rolls & Wraps',
  'Shawarma',
  'Momos',
  'Indian Snacks',
  'Street Food',
  'Egg Items',
  'Seafood',
  'Fish Items',
  'Prawn Items',
  'Veg Meals',
  'Non-Veg Meals',
  'Thalis',
  'Combos',
  'Family Packs',
  "Kids' Menu",
  'Desserts',
  'Indian Sweets',
  'Ice Creams',
  'Cakes & Pastries',
  'Bakery Items',
  'Beverages',
  'Hot Beverages',
  'Cold Beverages',
  'Fresh Juices',
  'Milkshakes',
  'Mocktails',
  'Tea & Coffee',
  'Breakfast',
  'Lunch',
  'Dinner',
  'Healthy Food',
  'Vegan Food',
  'Millet Specials',
  'Chef\'s Specials',
  'Seasonal Specials',
  'Festival Specials',
  'Party Packs',
  'Add-ons & Extras',
];

async function main() {
  console.log(`[Seed Categories] Looking up restaurant with domain: "${TARGET_DOMAIN}"...`);

  const [restaurant] = await db
    .select()
    .from(restaurants)
    .where(
      and(
        eq(sql`LOWER(${restaurants.domain})`, TARGET_DOMAIN.toLowerCase()),
        eq(restaurants.is_deleted, false)
      )
    )
    .limit(1);

  if (!restaurant) {
    throw new Error(`Active restaurant with domain "${TARGET_DOMAIN}" not found.`);
  }

  console.log(`[Seed Categories] Found restaurant: ${restaurant.name} (id: ${restaurant.id}, domain: ${restaurant.domain})`);

  // Fetch any existing categories for this restaurant
  const existingCategories = await db
    .select()
    .from(menu_categories)
    .where(
      and(
        eq(menu_categories.restaurant_id, restaurant.id),
        isNull(menu_categories.deletedat)
      )
    );

  const existingMap = new Map();
  for (const c of existingCategories) {
    existingMap.set(c.category.trim().toLowerCase(), c);
  }

  const toInsert = [];
  const skipped = [];

  CATEGORIES.forEach((name, index) => {
    const trimmed = name.trim();
    if (existingMap.has(trimmed.toLowerCase())) {
      skipped.push(trimmed);
    } else {
      toInsert.push({
        restaurant_id: restaurant.id,
        category: trimmed,
        description: '',
        image: null,
        display_order: index + 1,
        menu_category_status: 'ACTIVE',
      });
    }
  });

  if (toInsert.length > 0) {
    console.log(`[Seed Categories] Inserting ${toInsert.length} new categories...`);
    const inserted = await db.insert(menu_categories).values(toInsert).returning();
    console.log(`[Seed Categories] Successfully inserted ${inserted.length} categories.`);
  } else {
    console.log('[Seed Categories] All categories already exist.');
  }

  if (skipped.length > 0) {
    console.log(`[Seed Categories] Skipped ${skipped.length} existing categories:`, skipped);
  }

  // Summary of total active categories now in DB
  const total = await db
    .select()
    .from(menu_categories)
    .where(
      and(
        eq(menu_categories.restaurant_id, restaurant.id),
        isNull(menu_categories.deletedat)
      )
    )
    .orderBy(menu_categories.display_order);

  console.log(`\n[Seed Categories] Total active categories for "${restaurant.domain}": ${total.length}`);
  console.log('[Seed Categories] Complete listing:');
  total.forEach((c) => {
    console.log(`  ${c.display_order}. ${c.category} (id: ${c.id})`);
  });
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('[Seed Categories] Error:', err);
    try {
      await pool.end();
    } catch (_) {}
    process.exit(1);
  });
