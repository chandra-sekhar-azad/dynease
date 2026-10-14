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
        require('dotenv').config({ path: fullPath, override: true });
        console.log(`[Config] Loaded environment variables from: ${fullPath} (${isProduction ? 'production' : 'development'} mode)`);
        loaded = true;
        break;
      }
    }
    if (loaded && (file === '.env.production' || !isProduction)) break;
  }

  // Ensure DATABASE_URL and SUPABASE_URL are synced if either is provided
  if (!process.env.DATABASE_URL && process.env.SUPABASE_URL) {
    process.env.DATABASE_URL = process.env.SUPABASE_URL;
  }
  if (!process.env.SUPABASE_URL && process.env.DATABASE_URL) {
    process.env.SUPABASE_URL = process.env.DATABASE_URL;
  }

  // Fallback production Supabase URL if running in cloud production where .env was not uploaded to Git
  if (!process.env.SUPABASE_URL) {
    process.env.SUPABASE_URL = process.env.DATABASE_URL;
    process.env.DATABASE_URL = process.env.SUPABASE_URL;
  }
}

loadEnv();

module.exports = { loadEnv };
