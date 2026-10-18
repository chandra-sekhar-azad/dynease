require('./src/config/env');
const http = require('http');
const app = require('./src/app');
const { Server } = require('socket.io');
const { isAllowedOrigin } = require('./src/config/cors');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Socket.IO Setup
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      // Same policy as the HTTP API: dynease.in + subdomains, dev localhost,
      // and non-browser clients (no Origin). Never throw.
      callback(null, isAllowedOrigin(origin));
    },
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Subdomain']
  }
});

require('./src/sockets')(io);
require('./src/services/RealtimeService').init(io);
app.set('io', io);

const { initSubscriptionJobs } = require('./src/jobs/subscriptionJobs');
const { initAssignmentTimeoutJobs } = require('./src/jobs/assignmentTimeoutJobs');
const { initRosterCron } = require('./src/jobs/rosterJobs');
const { pool } = require('./src/db/client');

// Start HTTP server immediately to satisfy Hostinger's 3-second healthcheck requirement
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ [PORT CONFLICT] Port ${PORT} is already in use by another running process.`);
    console.error(`   Please terminate any existing server process or run: npx kill-port ${PORT}\n`);
  } else {
    console.error('[Server Error]:', err);
  }
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection]:', reason);
});

// Initialize Supabase PostgreSQL & CRON jobs
pool.query('SELECT current_database(), now()')
  .then(() => {
    console.log('[PostgreSQL] Connected to Supabase PostgreSQL successfully via Drizzle client');
    initRosterCron();
    initSubscriptionJobs();
    initAssignmentTimeoutJobs();
  })
  .catch((err) => {
    console.error('[PostgreSQL] Supabase connection error:', err.message);
  });

