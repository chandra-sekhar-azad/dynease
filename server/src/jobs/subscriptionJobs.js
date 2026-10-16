const cron = require('node-cron');
const { db, schema } = require('../db/client');
const { eq, and } = require('drizzle-orm');
const { restaurants } = schema;
const whatsapp = require('../utils/whatsapp');

// Run every day at midnight (UTC)
const initSubscriptionJobs = () => {
  cron.schedule('0 0 * * *', async () => {
    console.log('[SubscriptionJob] Running daily subscription check...');
    try {
      const now = new Date();
      // Fetch active, non-deleted restaurants
      const list = await db.select().from(restaurants).where(
        and(
          eq(restaurants.is_deleted, false)
        )
      );

      for (const restaurant of list) {
        // If restaurant is paused or inactive, skip active reminders
        if (restaurant.restaurant_status === 'INACTIVE') continue;

        // In PostgreSQL schema, restaurants has deletedat, plan_id, etc.
        // If plan subscription tracking is active, check expiry
        if (restaurant.deletedat && new Date(restaurant.deletedat) < now) {
          if (restaurant.restaurant_status !== 'INACTIVE') {
            await db.update(restaurants)
              .set({ restaurant_status: 'INACTIVE', updatedat: new Date() })
              .where(eq(restaurants.id, restaurant.id));
            await sendReminder(restaurant, 'EXPIRED', 0);
          }
        }
      }
      console.log('[SubscriptionJob] Daily check complete.');
    } catch (error) {
      console.error('[SubscriptionJob] Error during job execution:', error);
    }
  });
};

const sendReminder = async (restaurant, type, days) => {
  const phone = restaurant.phone_number;
  if (!phone) return;

  let message = '';
  switch (type) {
    case '7_DAYS':
      message = `Hello from Dynease. Your subscription for ${restaurant.name} will expire in 7 days. Please login to your dashboard to renew.`;
      break;
    case '3_DAYS':
      message = `URGENT: Your Dynease subscription for ${restaurant.name} expires in ${days} days. Renew soon to avoid interruption of orders!`;
      break;
    case '1_DAY':
      message = `FINAL NOTICE: Your Dynease subscription for ${restaurant.name} expires TOMORROW. Please renew immediately to keep your online menu active.`;
      break;
    case 'EXPIRED':
      message = `Your Dynease subscription for ${restaurant.name} has EXPIRED. Online ordering has been disabled. Login to renew and reactivate your services.`;
      break;
  }

  try {
    if (message) {
      await whatsapp.sendTextMessage(phone, message);
      console.log(`[SubscriptionJob] Sent ${type} reminder to ${restaurant.name}`);
    }
  } catch (error) {
    console.error(`[SubscriptionJob] Failed to send ${type} reminder to ${restaurant.name}:`, error.message);
  }
};

module.exports = { initSubscriptionJobs };
