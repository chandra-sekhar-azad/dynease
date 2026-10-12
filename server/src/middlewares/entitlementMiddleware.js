const { hasEntitlement, getPlan } = require('../config/plans');

/**
 * Middleware factory to enforce feature entitlements based on tenant's active plan.
 * Returns consistent 403 Forbidden with FEATURE_NOT_INCLUDED code.
 *
 * @param {string} entitlementKey - e.g., 'reportsExport', 'customerCrm', 'salesAnalytics', 'multiLocationDashboard'
 * @param {string} [requiredLevel] - e.g., 'advanced', 'full', 'loyalty'
 */
exports.requireEntitlement = (entitlementKey, requiredLevel = null) => {
  return (req, res, next) => {
    try {
      const registry = req.tenantRegistry;
      if (!registry) {
        return res.status(403).json({
          success: false,
          code: 'TENANT_NOT_RESOLVED',
          message: 'Tenant context required to verify feature entitlement.'
        });
      }

      const planId = registry.selectedPlan || 'STARTER';
      const plan = getPlan(planId);

      const isAllowed = hasEntitlement(planId, entitlementKey, requiredLevel);

      if (!isAllowed) {
        return res.status(403).json({
          success: false,
          code: 'FEATURE_NOT_INCLUDED',
          message: `This feature is not included in your current (${plan?.name || planId}) plan. Please upgrade your subscription to access this feature.`,
          requiredFeature: entitlementKey,
          currentPlan: plan?.name || planId
        });
      }

      next();
    } catch (err) {
      console.error('[EntitlementMiddleware] Error:', err);
      res.status(500).json({ success: false, message: 'Internal error checking feature entitlements.' });
    }
  };
};

/**
 * Returns date filter object for Order query based on subscription plan order history retention limit.
 * Retention limits:
 * - STARTER: 7 days
 * - GROWTH: 30 days
 * - BUSINESS: 365 days (1 year)
 * - PRO: null (unlimited)
 */
exports.getOrderRetentionFilter = (planId) => {
  const plan = getPlan(planId);
  const retentionDays = plan?.limits?.orderHistoryDays;

  if (retentionDays === null || retentionDays === undefined) {
    return null; // Unlimited history
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  return cutoffDate;
};
