const PostgresAdapter = require('../services/PostgresAdapter');
const { db, schema } = require('../db/client');
const { eq } = require('drizzle-orm');
const { logError } = require('../utils/logError');

exports.checkSubscription = async (req, res, next) => {
  try {
    let registry = req.tenantRegistry || req.restaurant;
    
    // If tenantResolver didn't attach it, check slug in params
    if (!registry) {
      const slug = req.params.slug;
      if (slug) {
        registry = await PostgresAdapter.getRegistryBySubdomain(slug).catch((err) => {
          logError('Subscription Middleware', err);
          return null;
        });
        if (!registry) {
          registry = await PostgresAdapter.getRegistryById(slug).catch((err) => {
            logError('Subscription Middleware', err);
            return null;
          });
        }
      }
    }

    if (!registry) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    const now = new Date();
    
    // Check if subscription end date has passed
    if (registry.subscriptionEndDate && new Date(registry.subscriptionEndDate) < now) {
      if (registry.status !== 'INACTIVE' && registry.subscriptionStatus !== 'EXPIRED') {
        registry.subscriptionStatus = 'EXPIRED';
        if (registry.id) {
          await db.update(schema.restaurants)
            .set({ restaurant_status: 'INACTIVE', updatedat: new Date() })
            .where(eq(schema.restaurants.id, registry.id))
            .catch((err) => console.error('[Subscription Middleware] Status update error:', err.message));
        }
      }
      return res.status(403).json({ 
        success: false, 
        code: 'SUBSCRIPTION_EXPIRED',
        message: 'The subscription for this restaurant has expired. Ordering is currently disabled.'
      });
    }

    if (registry.status === 'PAUSED' || registry.restaurant_status === 'PAUSED' || registry.subscriptionStatus === 'SUSPENDED') {
      return res.status(403).json({ 
        success: false, 
        code: 'SUBSCRIPTION_SUSPENDED',
        message: 'This restaurant account is currently suspended or paused.'
      });
    }

    if (registry.status === 'INACTIVE' || registry.restaurant_status === 'INACTIVE' || registry.subscriptionStatus === 'PENDING') {
      return res.status(403).json({ 
        success: false, 
        code: 'SUBSCRIPTION_PENDING',
        message: 'This restaurant account is currently inactive.'
      });
    }

    req.subscriptionStatus = registry.subscriptionStatus || 'ACTIVE';
    req.tenantRegistry = registry;
    req.restaurant = registry;
    next();
  } catch (error) {
    console.error('[Subscription Middleware] Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error while verifying subscription.' });
  }
};
