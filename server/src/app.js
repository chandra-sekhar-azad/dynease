const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { corsOptions } = require('./config/cors');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const restaurantRoutes = require('./routes/restaurantRoutes');
const shiftRoutes = require('./routes/shiftRoutes');
const rosterRoutes = require('./routes/rosterRoutes');
const tableRoutes = require('./routes/tableRoutes');
const publicRoutes = require('./routes/publicRoutes');
const staffRoutes = require('./routes/staffRoutes');

const app = express();

// Trust reverse proxy for rate limiter (Hostinger uses Nginx/LiteSpeed)
app.set('trust proxy', 1);

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: false
}));

const corsMw = cors(corsOptions());

// CORS MUST run before auth, the rate limiter and all routes so that preflight
// requests are answered here and never reach tenant/auth/subscription middleware.
app.use(corsMw);

// Explicitly terminate OPTIONS preflight requests (204, no auth required).
// NOTE: Express 5 uses path-to-regexp v8 where app.options('*') throws; a RegExp
// path is the supported equivalent.
app.options(/.*/, corsMw);

const cookieParser = require('cookie-parser');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  // Never rate-limit CORS preflight requests.
  skip: (req) => req.method === 'OPTIONS'
});
app.use('/api', limiter);

const path = require('path');

const tenantResolver = require('./middlewares/tenantResolver');

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'API is running smoothly.' });
});

// Mount Routes
app.use('/api/admin', adminRoutes);

// Apply tenantResolver to APIs that need tenant context
app.use('/api/auth', tenantResolver, authRoutes);

// Apply tenantResolver to APIs that need tenant context
app.use('/api/restaurant', tenantResolver, restaurantRoutes);
app.use('/api/restaurant/tables', tenantResolver, tableRoutes);
app.use('/api/restaurant/staff', tenantResolver, staffRoutes);
app.use('/api/restaurant/shifts', tenantResolver, shiftRoutes);
app.use('/api/restaurant/rosters', tenantResolver, rosterRoutes);
app.use('/api/public', tenantResolver, publicRoutes);

// Serve React App for any unknown non-api routes (SPA fallback)
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  const { logError } = require('./utils/logError');
  logError('GlobalErrorHandler', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

module.exports = app;
