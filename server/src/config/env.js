const path = require('path');
const fs = require('fs');

/**
 * Robust multi-location environment loader
 * Supports:
 * - Hostinger hbuilds deployments (where CWD is nodejs/ or project root)
 * - Local development
 * - Production .env.production, .env, or process.env variables injected by host
 */
function loadEnv() {
  const searchDirs = [
    process.cwd(),
    path.resolve(process.cwd(), '..'),
    path.resolve(__dirname, '..'),
    path.resolve(__dirname, '../..'),
    path.resolve(__dirname, '../../..'),
  ];

  const envFiles = [
    process.env.NODE_ENV === 'production' ? '.env.production' : null,
    '.env',
    '.env.local'
  ].filter(Boolean);

  for (const dir of searchDirs) {
    for (const file of envFiles) {
      const fullPath = path.resolve(dir, file);
      if (fs.existsSync(fullPath)) {
        require('dotenv').config({ path: fullPath });
      }
    }
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
    process.env.SUPABASE_URL = "postgresql://postgres.zgwpxgpuberdxgxuutdw:Sagar%40dynease@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres";
    process.env.DATABASE_URL = process.env.SUPABASE_URL;
  }
}

loadEnv();

module.exports = { loadEnv };
