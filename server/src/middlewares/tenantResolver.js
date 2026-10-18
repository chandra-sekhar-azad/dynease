const PostgresAdapter = require('../services/PostgresAdapter');
const { logError } = require('../utils/logError');

/**
 * Middleware to resolve tenant restaurant from subdomain
 * and attach tenant context (req.tenantRegistry, req.restaurant, req.pg)
 * backed by Supabase PostgreSQL and Drizzle ORM.
 */
module.exports = async (req, res, next) => {
  try {
    let subdomain = req.headers['x-tenant-subdomain'] || null;
    const hostname = req.hostname; // e.g., spicegarden.dynease.in

    if (!subdomain) {
      // Ignore admin, public domain, and www
      if (hostname.includes('admin') || hostname === process.env.BASE_DOMAIN || hostname.includes('www')) {
        return next();
      }

      // Extract subdomain
      if (hostname.includes(process.env.BASE_DOMAIN || 'dynease.in')) {
        subdomain = hostname.split('.')[0];
      } else if (hostname.includes('localhost')) {
        subdomain = hostname.split('.')[0];
      }
    }

    if (!subdomain || subdomain === 'localhost' || subdomain === '127' || subdomain === 'admin' || subdomain === 'api' || subdomain === 'www') {
      return next();
    }

    // Lookup restaurant in the shared PostgreSQL database via Drizzle ORM.
    // A database failure must NOT be reported as "restaurant not found".
    let pgRegistry;
    try {
      pgRegistry = await PostgresAdapter.getRegistryBySubdomain(subdomain);
    } catch (err) {
      logError('TenantResolver', err);
      return res.status(503).json({
        success: false,
        code: 'DATABASE_UNAVAILABLE',
        message: 'The service is temporarily unable to reach the database. Please try again shortly.'
      });
    }

    if (!pgRegistry) {
      return res.status(404).json({ success: false, message: 'Restaurant not found or not active.' });
    }

    // Attach restaurant context to request
    req.restaurant = pgRegistry;
    req.tenantRegistry = pgRegistry;
    req.pg = PostgresAdapter;

    next();
  } catch (error) {
    console.error('[TenantResolver] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to resolve tenant restaurant' });
  }
};
