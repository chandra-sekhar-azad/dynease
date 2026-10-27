const { test } = require('node:test');
const assert = require('node:assert/strict');

// These modules read process.env at require-time, so set it before requiring.
process.env.NODE_ENV = 'production';
process.env.BASE_DOMAIN = 'dynease.in';
delete process.env.CORS_ALLOWED_DOMAINS;
process.env.CORS_ALLOWED_ORIGINS = 'https://special.partner.io';

const { normalizeSubdomain, baseDomain, isUuid } = require('../src/utils/tenant');
const { isAllowedOrigin, corsOptions, DOMAINS } = require('../src/config/cors');

test('tenant: normalizeSubdomain reduces hosts/slugs to the tenant slug', () => {
  assert.equal(normalizeSubdomain('chandrikafamilyrestaurant'), 'chandrikafamilyrestaurant');
  assert.equal(normalizeSubdomain('chandrikafamilyrestaurant.dynease.in'), 'chandrikafamilyrestaurant');
  assert.equal(normalizeSubdomain('https://chandrikafamilyrestaurant.dynease.in/menu?x=1'), 'chandrikafamilyrestaurant');
  assert.equal(normalizeSubdomain('CHANDRIKAFAMILYRESTAURANT.dynease.in'), 'chandrikafamilyrestaurant');
  assert.equal(normalizeSubdomain('chandrikafamilyrestaurant.dynease.in:443'), 'chandrikafamilyrestaurant');
  // Apex / infra hosts carry no tenant slug
  assert.equal(normalizeSubdomain('dynease.in'), '');
  assert.equal(normalizeSubdomain('www.dynease.in'), '');
  assert.equal(normalizeSubdomain('api.dynease.in'), '');
  assert.equal(normalizeSubdomain('admin.dynease.in'), '');
  assert.equal(normalizeSubdomain(''), '');
  assert.equal(normalizeSubdomain(null), '');
  assert.equal(baseDomain(), 'dynease.in');
});

test('tenant: isUuid guards the id lookup against slug input', () => {
  assert.equal(isUuid('a535d9a0-9f3a-4b14-8525-92b57cd68e24'), true);
  assert.equal(isUuid('chandrikafamilyrestaurant'), false);
  assert.equal(isUuid(''), false);
  assert.equal(isUuid(undefined), false);
});

test('cors: allowed restaurant origins in production', () => {
  assert.ok(DOMAINS.includes('dynease.in'));
  assert.equal(isAllowedOrigin('https://chandrikafamilyrestaurant.dynease.in'), true);
  assert.equal(isAllowedOrigin('https://dynease.in'), true);
  assert.equal(isAllowedOrigin('https://admin.dynease.in'), true);
  assert.equal(isAllowedOrigin('https://special.partner.io'), true);
  // no Origin header => curl / server-to-server
  assert.equal(isAllowedOrigin(undefined), true);
});

test('cors: disallowed origins get no header (and never throw)', () => {
  assert.equal(isAllowedOrigin('https://evil.com'), false);
  assert.equal(isAllowedOrigin('https://dynease.in.evil.com'), false);
  assert.equal(isAllowedOrigin('https://sub.dynease.in.evil.com'), false);
  assert.equal(isAllowedOrigin('http://localhost:5173'), false); // dev-only, NODE_ENV=production
  assert.equal(isAllowedOrigin('http://test.localhost:5173'), false); // dev-only, NODE_ENV=production
  assert.equal(isAllowedOrigin('http://dynease.in'), false);     // https only in production
});

test('cors: dev mode allows localhost, 127.0.0.1, and all *.localhost subdomains on dev ports', () => {
  const originalEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'development';
    assert.equal(isAllowedOrigin('http://localhost:5173'), true);
    assert.equal(isAllowedOrigin('http://test.localhost:5173'), true);
    assert.equal(isAllowedOrigin('http://admin.localhost:5173'), true);
    assert.equal(isAllowedOrigin('http://chandrika.localhost:5173'), true);
    assert.equal(isAllowedOrigin('http://127.0.0.1:5173'), true);
    assert.equal(isAllowedOrigin('http://localhost:3000'), true);
    assert.equal(isAllowedOrigin('http://test.localhost:3000'), true);
    assert.equal(isAllowedOrigin('http://localhost:5000'), true);
    assert.equal(isAllowedOrigin('http://localhost:8080'), true);
    // Malicious hosts should still be rejected in dev mode
    assert.equal(isAllowedOrigin('http://evil.com'), false);
    assert.equal(isAllowedOrigin('http://localhost.evil.com:5173'), false);
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

test('cors: allowedHeaders includes idempotency-key and x-table-session-token', () => {
  const opts = corsOptions();
  const lowerHeaders = opts.allowedHeaders.map(h => h.toLowerCase());
  assert.ok(lowerHeaders.includes('idempotency-key'), 'idempotency-key must be in allowedHeaders');
  assert.ok(lowerHeaders.includes('x-table-session-token'), 'x-table-session-token must be in allowedHeaders');
  assert.ok(lowerHeaders.includes('content-type'), 'content-type must be in allowedHeaders');
  assert.ok(lowerHeaders.includes('authorization'), 'authorization must be in allowedHeaders');
  assert.ok(lowerHeaders.includes('x-tenant-subdomain'), 'x-tenant-subdomain must be in allowedHeaders');
});
