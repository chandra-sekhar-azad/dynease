const u = new URL(process.env.DATABASE_URL || "http://none");
console.log("[Debug] DB user:", u.username, "host:", u.hostname);

require('../config/env');

const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const schema = require('./schema');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('[Database] FATAL: DATABASE_URL environment variable is missing.');
  throw new Error('DATABASE_URL is not set. Configure the Supabase Transaction Pooler connection string.');
}

try {
  const parsed = new URL(connectionString);
  console.log(`[Database] Target pooler -> host: ${parsed.host}, user: ${parsed.username}, db: ${parsed.pathname}`);
} catch {
  console.log('[Database] DATABASE_URL loaded');
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
