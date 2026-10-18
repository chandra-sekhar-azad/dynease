const path = require('path');
const fs = require('fs');

/**
 * Robust environment loader:
 * - Development mode: loads root .env
 * - Production mode: loads root .env.production
 */
function loadEnv() {
  const isProduction = process.env.NODE_ENV === 'production';
  const targetFiles = isProduction
    ? ['.env.production', '.env']
    : ['.env'];

  const searchDirs = [
    process.cwd(),
    path.resolve(process.cwd(), '..'),
    path.resolve(__dirname, '..'),
    path.resolve(__dirname, '../..'),
    path.resolve(__dirname, '../../..'),
  ];

  let loaded = false;
  for (const file of targetFiles) {
    for (const dir of searchDirs) {
      const fullPath = path.resolve(dir, file);
      if (fs.existsSync(fullPath)) {
        // override:false => real environment variables (e.g. Hostinger hPanel)
        // take precedence over bundled files. This prevents a stale/leftover
        // .env file on the server from silently overriding DATABASE_URL etc.
        require('dotenv').config({ path: fullPath, override: false });
        console.log(`[Config] Loaded environment variables from: ${fullPath} (${isProduction ? 'production' : 'development'} mode)`);
        loaded = true;
        break;
      }
    }
    if (loaded && (file === '.env.production' || !isProduction)) break;
  }
}

loadEnv();

// Canonical active Supabase Transaction Pooler URL
const CANONICAL_DATABASE_URL = "postgresql://postgres.zasrobocszjjubhrjnes:WZmHJpFS9tioDYt0@aws-0-ap-south-1.pooler.supabase.com:6543/postgres";

// Safeguard: If DATABASE_URL is missing or contains the broken/non-existent tenant "rnmcbrtdosbmtrwopqht",
// automatically sanitize and redirect to the verified active pooler (zasrobocszjjubhrjnes).
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('rnmcbrtdosbmtrwopqht')) {
  console.warn('[Config] Notice: Overriding invalid/stale DATABASE_URL with active Supabase pooler (zasrobocszjjubhrjnes).');
  process.env.DATABASE_URL = CANONICAL_DATABASE_URL;
}

module.exports = { loadEnv };
