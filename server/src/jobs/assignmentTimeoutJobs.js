const cron = require('node-cron');
const RestaurantRegistry = require('../models/platform/RestaurantRegistry');
const TenantDatabaseManager = require('../services/TenantDatabaseManager');
const WaiterAssignmentService = require('../services/waiterAssignmentService');

/**
 * Checks for timed-out waiter order assignments every 60 seconds
 * and reassigns them or escalates them to managers.
 */
const initAssignmentTimeoutJobs = () => {
  cron.schedule('*/1 * * * *', async () => {
    try {
      const activeRegistries = await RestaurantRegistry.find({ status: 'ACTIVE' });

      for (const registry of activeRegistries) {
        try {
          const tenantDb = await TenantDatabaseManager.getConnection(registry.databaseName);
          const results = await WaiterAssignmentService.checkAssignmentTimeouts(
            tenantDb,
            registry.restaurantId
          );

          if (results.length > 0) {
            console.log(`[AssignmentTimeoutJob] Processed ${results.length} timed-out orders in ${registry.subdomain}`);
          }
        } catch (tenantErr) {
          // Continue to next tenant if one fails
        }
      }
    } catch (err) {
      console.error('[AssignmentTimeoutJob] Error:', err.message);
    }
  });
};

module.exports = { initAssignmentTimeoutJobs };
