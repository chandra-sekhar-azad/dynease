const jwt = require('jsonwebtoken');
const PostgresAdapter = require('../services/PostgresAdapter');

const protect = async (req, res, next) => {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token || token === 'undefined' || token === 'null' || !token.trim()) {
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

    // Check if user exists in Supabase PostgreSQL via Drizzle
    let currentUser;
    try {
      currentUser = await PostgresAdapter.findUserById(decoded.id);
    } catch (dbError) {
      console.error('[Auth] Database lookup error:', dbError.message);
      return res.status(401).json({ success: false, message: 'Error verifying user.', error: dbError.message });
    }

    if (!currentUser) {
      return res.status(401).json({ success: false, message: 'The user belonging to this token no longer exists.' });
    }

    if (!currentUser.isActive) {
      return res.status(401).json({ success: false, message: 'Your account is inactive or pending approval.' });
    }

    // Check session version if present in token
    if (decoded.sessionVersion !== undefined && currentUser.sessionVersion !== undefined && decoded.sessionVersion !== currentUser.sessionVersion) {
      return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
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
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }
    const hasRole = roles.includes(req.user.role) || roles.includes(req.user.userType);
    if (!hasRole) {
      return res.status(403).json({ success: false, message: 'You do not have permission to perform this action' });
    }
    next();
  };
};

module.exports = { protect, restrictTo };

