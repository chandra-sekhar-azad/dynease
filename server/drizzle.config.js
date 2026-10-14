
const { defineConfig } = require('drizzle-kit');
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
});

module.exports = defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/*.js',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
