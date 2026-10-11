const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'You are not logged in. Please log in to get access.' });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod');
    } catch (tokenError) {
      console.error('[Auth] Token verification failed:', tokenError.message);
      return res.status(401).json({ success: false, message: 'Invalid token or token expired.', error: tokenError.message });
    }

    // Check if user still exists (Mongo or PostgreSQL)
    let currentUser;
    try {
      if (req.tenantDb) {
        const TenantUser = req.tenantDb.model('User');
        currentUser = await TenantUser.findById(decoded.id);
      } else {
        currentUser = await User.findById(decoded.id);
      }

      // If not found in Mongo, check PostgreSQL
      if (!currentUser) {
        const { queryOne } = require('../config/postgres');
        const pgUser = await queryOne('SELECT * FROM dynease_users WHERE id = $1 LIMIT 1', [decoded.id]);
        if (pgUser) {
          currentUser = {
            _id: pgUser.id,
            id: pgUser.id,
            name: pgUser.name,
            email: pgUser.email,
            role: pgUser.role,
            phone: pgUser.phone,
            restaurantId: pgUser.restaurant_id,
            isActive: pgUser.is_active,
            shiftStatus: pgUser.shift_status,
            availabilityStatus: pgUser.availability_status,
            acceptingOrders: pgUser.accepting_orders,
            workloadCapacity: pgUser.workload_capacity,
            lastAssignedAt: pgUser.last_assigned_at,
            sections: pgUser.sections || [],
            assignedTables: pgUser.assigned_tables || []
          };
        }
      }
    } catch (dbError) {
      console.error('[Auth] Database lookup error:', dbError.message);
      return res.status(401).json({ success: false, message: 'Error verifying user.', error: dbError.message });
    }

    if (!currentUser) {
      return res.status(401).json({ success: false, message: 'The user belonging to this token does no longer exist.' });
    }

    // Grant access to protected route
    req.user = currentUser;
    next();
  } catch (error) {
    console.error('[Auth] Unexpected error:', error.message);
    return res.status(401).json({ success: false, message: 'Invalid token or token expired.', error: error.message });
  }
};

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to perform this action' });
    }
    next();
  };
};

module.exports = { protect, restrictTo };
