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
 * Returns the earliest order date visible under a plan's order history retention limit.
 * Accepts either a canonical plan ID or a resolved plan limits object.
 * Retention limits:
 * - STARTER: 7 days
 * - GROWTH: 30 days
 * - BUSINESS: 365 days (1 year)
 * - PRO/CUSTOM: null (unlimited)
 */
exports.getOrderRetentionFilter = (planOrLimits, now = new Date()) => {
  const retentionDays = planOrLimits && typeof planOrLimits === 'object'
    ? planOrLimits.orderHistoryDays
    : getPlan(planOrLimits)?.limits?.orderHistoryDays;

  if (retentionDays === null || retentionDays === undefined) {
    return null; // Unlimited history
  }

  const days = Number(retentionDays);
  if (!Number.isFinite(days) || days < 0) {
    return null;
  }

  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
};
