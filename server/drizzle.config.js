require('./src/config/env');
const { defineConfig } = require('drizzle-kit');

module.exports = defineConfig({
  schema: './src/db/schema/index.js',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.SUPABASE_URL || process.env.DATABASE_URL
  }
});
