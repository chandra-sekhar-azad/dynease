require('./env');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.SUPABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.on('error', (err) => {
  console.error('[PostgreSQL] Unexpected idle client error:', err);
});

/**
 * Execute a parameterized SQL query
 */
async function query(text, params = []) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.DEBUG_SQL === 'true') {
    console.log('[PostgreSQL] executed query', { text, duration, rows: res.rowCount });
  }
  return res;
}

/**
 * Helper to get a single row
 */
async function queryOne(text, params = []) {
  const res = await query(text, params);
  return res.rows[0] || null;
}

module.exports = {
  pool,
  query,
  queryOne
};
