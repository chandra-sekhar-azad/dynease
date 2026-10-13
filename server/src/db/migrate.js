require('../config/env');
const path = require('path');
const { Pool } = require('pg');
const fs = require('fs');

async function migrate() {
  const connectionString = process.env.SUPABASE_URL || process.env.DATABASE_URL;
  console.log('[Migration] Target database:', connectionString.split('@')[1] || connectionString);
  
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  const sqlFile = path.resolve(__dirname, '../../drizzle/0000_married_mulholland_black.sql');
  const sql = fs.readFileSync(sqlFile, 'utf-8');
  const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);

  console.log(`[Migration] Executing ${statements.length} DDL statements in a transaction...`);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < statements.length; i++) {
      await client.query(statements[i]);
    }

    await client.query(`CREATE SCHEMA IF NOT EXISTS drizzle;`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      );
    `);
    await client.query(`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES ('0000_married_mulholland_black', EXTRACT(EPOCH FROM NOW())::bigint);
    `);

    await client.query('COMMIT');
    console.log('[Migration] All tables and constraints applied successfully to Supabase PostgreSQL!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migration] Failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
