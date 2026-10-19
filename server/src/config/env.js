const path = require('path');
const fs = require('fs');

/**
 * Robust environment loader:
 * - Development mode: loads root .env
 * - Production mode: loads root .env.production
 * 
 * After loading, detect if DATABASE_URL contains the stale/invalid
 * Supabase tenant "rnmcbrtdosbmtrwopqht". If so, redirect to the
 * canonical active pooler. The canonical URL must be set via Hostinger
 * hPanel environment variable DATABASE_URL_CANONICAL, or the user must
 * update DATABASE_URL in Hostinger hPanel to the correct new tenant.
 * 
 * This handles the case where Hostinger hPanel environment variables
 * retain an old/broken URL that override:false would otherwise prevent
 * from being updated from .env files.
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

// Sanitize DATABASE_URL: detect stale/invalid Supabase tenant.
// If detected, redirect using DATABASE_URL_CANONICAL from environment,
// otherwise prompt user to update DATABASE_URL in Hostinger hPanel.
// This must run after dotenv.config so that any DATABASE_URL from .env or the
// process environment is validated and corrected if needed.
if (process.env.DATABASE_URL) {
  if (process.env.DATABASE_URL.includes('rnmcbrtdosbmtrwopqht')) {
    // Attempt to use a canonical URL from Hostinger environment variable
    // DATABASE_URL_CANONICAL should be set in hPanel to the new valid pooler URL
    const canonical = process.env.DATABASE_URL_CANONICAL;
    if (canonical) {
      console.warn('[Config] Notice: DATABASE_URL contains stale/invalid tenant. Redirecting to canonical pooler.');
      process.env.DATABASE_URL = canonical;
    } else {
      // No canonical URL configured - warn but keep existing URL so app continues to run
      console.warn('[Config] Notice: DATABASE_URL contains stale/invalid tenant (postgres.rnmcbrtdosbmtrwopqht). ' +
        'Set DATABASE_URL_CANONICAL in Hostinger hPanel to the new Supabase pooler, or update DATABASE_URL directly.');
      // Explicitly keep the existing DATABASE_URL - do not clear it
      // (The old URL will still work or prompt user to update)
    }
  }
} else {
  console.error('[Config] ERROR: DATABASE_URL is not set. Please add it to your .env file.');
}

module.exports = { loadEnv };
