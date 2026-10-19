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

// Safeguard: Warn if DATABASE_URL is missing or stale after loading .env
if (!process.env.DATABASE_URL) {
  console.error('[Config] ERROR: DATABASE_URL is not set. Please add it to your .env file.');
} else if (process.env.DATABASE_URL.includes('rnmcbrtdosbmtrwopqht')) {
  console.warn('[Config] WARNING: DATABASE_URL contains a stale/invalid tenant. Update DATABASE_URL in your .env file.');
}

module.exports = { loadEnv };
