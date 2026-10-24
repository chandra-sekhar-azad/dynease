const CustomerSessionService = require('../services/CustomerSessionService');

/**
 * Middleware ensuring incoming customer requests carry a valid, active session token
 * bound to their specific restaurant and table visit.
 */
async function customerSessionAuth(req, res, next) {
  try {
    const rawToken =
      req.cookies?.dynease_table_session ||
      req.headers['x-table-session-token'] ||
      (req.headers.authorization && req.headers.authorization.startsWith('Session ')
        ? req.headers.authorization.slice(8)
        : null);

    if (!rawToken) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED_SESSION',
        message: 'A valid active table session is required. Please scan the table QR code.'
      });
    }

    const claimedRestaurant = req.restaurant || req.tenantRegistry;
    const claimedRestaurantId = claimedRestaurant ? (claimedRestaurant.id || claimedRestaurant.restaurantId) : null;

    const activeSession = await CustomerSessionService.findActiveSession(rawToken, claimedRestaurantId);

    if (!activeSession) {
      return res.status(401).json({
        success: false,
        code: 'SESSION_REVOKED_OR_EXPIRED',
        message: 'Your dining session is invalid or has already been closed.'
      });
    }

    // Attach verified session context to request
    req.customerSession = activeSession;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  customerSessionAuth
};
