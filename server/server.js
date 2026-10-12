require('./src/config/env');
const http = require('http');
const app = require('./src/app');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Socket.IO Setup
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      // Allow any localhost origin (including subdomains) or the main client URL
      if (!origin || origin.includes('localhost') || origin.includes('dynease.in')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

require('./src/sockets')(io);
app.set('io', io);

const { initSubscriptionJobs } = require('./src/jobs/subscriptionJobs');
const { initAssignmentTimeoutJobs } = require('./src/jobs/assignmentTimeoutJobs');
const { initRosterCron } = require('./src/jobs/rosterJobs');
const { pool } = require('./src/db/client');

// Start HTTP server immediately to satisfy Hostinger's 3-second healthcheck requirement
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Initialize Supabase PostgreSQL & CRON jobs
pool.query('SELECT current_database(), now()')
  .then(() => {
    console.log('[PostgreSQL] Connected to Supabase PostgreSQL successfully via Drizzle client');
    initRosterCron();
  })
  .catch((err) => {
    console.error('[PostgreSQL] Supabase connection error:', err.message);
  });

// Database connection & jobs
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/dynease')
  .then(() => {
    console.log('Connected to MongoDB');
    initSubscriptionJobs();
    initAssignmentTimeoutJobs();
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
  });
