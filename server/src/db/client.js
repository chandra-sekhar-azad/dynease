require('../config/env');

const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const schema = require('./schema');

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_URL;

if (!connectionString) {
  console.error('[Database] FATAL: DATABASE_URL environment variable is missing.');
  throw new Error('Missing database connection string in environment variables');
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('error', (err) => {
  console.error('[PostgreSQL] Unexpected pool client error:', err.message);
});

const db = drizzle(pool, { schema });

module.exports = {
  pool,
  db,
  schema
};
