const path = require('path');
const cron = require('node-cron');
const { db, schema } = require('../db/client');
const { eq, and } = require('drizzle-orm');
const { restaurants, users, shifts, rosters } = schema;
const crypto = require('crypto');

/**
 * Configure Roster Cron Job
 * Default schedule: 1:00 AM (0 1 * * *)
 * Timezone: process.env.BUSINESS_TIMEZONE || 'Asia/Kolkata'
 */
const initRosterCron = () => {
  const timezone = process.env.BUSINESS_TIMEZONE || 'Asia/Kolkata';
  const cronExpression = process.env.ROSTER_CRON_SCHEDULE || '0 1 * * *';

  console.log(`[RosterCron] Initializing daily roster cron schedule: "${cronExpression}" in timezone: "${timezone}"`);

  cron.schedule(cronExpression, async () => {
    console.log(`[RosterCron] Running daily roster generation for active restaurants at ${new Date().toISOString()}...`);
    try {
      await generateDailyRosters();
    } catch (err) {
      console.error('[RosterCron] Fatal error during daily roster generation:', err.message);
    }
  }, {
    timezone
  });
};

/**
 * Idempotent daily roster generator
 * 1. Fetch eligible active, non-deleted restaurants
 * 2. Fetch eligible active, non-deleted staff members (STAFF)
 * 3. Determine or auto-create default shift
 * 4. Insert roster record for current date with shift_type = 'WORKING'
 * 5. Conflict-safe (ON CONFLICT DO NOTHING) ensuring idempotency
 */
async function generateDailyRosters(targetDateStr) {
  // Use today's date in YYYY-MM-DD
  const dateStr = targetDateStr || new Date().toISOString().split('T')[0];
  console.log(`[RosterCron] Generating rosters for business date: ${dateStr}`);

  // 1. Fetch all active restaurants
  const activeRestaurants = await db.select().from(restaurants).where(
    and(
      eq(restaurants.restaurant_status, 'ACTIVE'),
      eq(restaurants.is_deleted, false)
    )
  );

  console.log(`[RosterCron] Found ${activeRestaurants.length} active restaurants.`);
  let createdCount = 0;
  let skippedCount = 0;

  for (const restaurant of activeRestaurants) {
    try {
      // 2. Fetch or create default shift for this restaurant
      let [defaultShift] = await db.select().from(shifts).where(
        eq(shifts.restaurant_id, restaurant.id)
      ).limit(1);

      if (!defaultShift) {
        const shiftId = 'shift_' + crypto.randomBytes(8).toString('hex');
        const [newShift] = await db.insert(shifts).values({
          id: shiftId,
          restaurant_id: restaurant.id,
          name: 'General Shift',
          start_time: '09:00',
          end_time: '22:00'
        }).returning();
        defaultShift = newShift;
        console.log(`[RosterCron] Created default shift for restaurant ${restaurant.name} (${restaurant.id})`);
      }

      // 3. Fetch active staff members
      const activeStaff = await db.select().from(users).where(
        and(
          eq(users.restaurant_id, restaurant.id),
          eq(users.user_status, 'ACTIVE'),
          eq(users.is_deleted, false)
        )
      );

      for (const staff of activeStaff) {
        // 4. Insert roster record idempotently
        const rosterId = 'ros_' + crypto.randomBytes(8).toString('hex');
        const result = await db.insert(rosters).values({
          id: rosterId,
          restaurant_id: restaurant.id,
          user_id: staff.id,
          date: dateStr,
          shift_id: defaultShift ? defaultShift.id : null,
          shift_type: 'WORKING'
        }).onConflictDoNothing({
          target: [rosters.restaurant_id, rosters.user_id, rosters.date]
        }).returning();

        if (result.length > 0) {
          createdCount++;
        } else {
          skippedCount++;
        }
      }
    } catch (restErr) {
      console.error(`[RosterCron] Error processing restaurant ${restaurant.id}:`, restErr.message);
    }
  }

  console.log(`[RosterCron] Completed daily roster generation. Created: ${createdCount}, Already existed/skipped: ${skippedCount}`);
  return { createdCount, skippedCount, dateStr };
}

module.exports = {
  initRosterCron,
  generateDailyRosters
};
