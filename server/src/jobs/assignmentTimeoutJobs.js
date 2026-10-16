const cron = require('node-cron');
const { db, schema } = require('../db/client');
const { eq, and } = require('drizzle-orm');
const { restaurants } = schema;
const WaiterAssignmentService = require('../services/waiterAssignmentService');

/**
 * Checks for timed-out waiter order assignments every 60 seconds
 * and reassigns them or escalates them to managers.
 */
const initAssignmentTimeoutJobs = () => {
  cron.schedule('*/1 * * * *', async () => {
    try {
      const activeRestaurants = await db.select().from(restaurants).where(
        and(
          eq(restaurants.restaurant_status, 'ACTIVE'),
          eq(restaurants.is_deleted, false)
        )
      );

      for (const restaurant of activeRestaurants) {
        try {
          const results = await WaiterAssignmentService.checkAssignmentTimeouts(
            null,
            restaurant.id
          );

          if (results && results.length > 0) {
            console.log(`[AssignmentTimeoutJob] Processed ${results.length} timed-out orders in ${restaurant.domain || restaurant.name}`);
          }
        } catch (tenantErr) {
          // Continue to next restaurant if one encounters an error
        }
      }
    } catch (err) {
      console.error('[AssignmentTimeoutJob] Error:', err.message);
    }
  });
};

module.exports = { initAssignmentTimeoutJobs };
