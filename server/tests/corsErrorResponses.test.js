const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');

// These modules read process.env at require-time.
process.env.NODE_ENV = 'production';
process.env.BASE_DOMAIN = 'dynease.in';
delete process.env.CORS_ALLOWED_DOMAINS;

// --- Stub the DB-backed adapter so we can simulate an outage without a database.
const srcDir = path.resolve(__dirname, '../src');
const adapterPath = path.join(srcDir, 'services/PostgresAdapter.js');
const RESTAURANT = { id: 'a535d9a0-9f3a-4b14-8525-92b57cd68e24', domain: 'chandrikafamilyrestaurant', status: 'ACTIVE', restaurant_status: 'ACTIVE', subscriptionStatus: 'ACTIVE' };
const adapterStub = {
  _mode: 'throw',
  async getRegistryBySubdomain() {
    if (this._mode === 'throw') throw Object.assign(new Error('Failed query ... (ENOTFOUND) tenant/user postgres.<ref> not found'), { code: 'ENOTFOUND' });
    if (this._mode === 'null') return null;
    return { ...RESTAURANT };
  },
  async getRegistryById() { return null; },
  async findUserById() { return null; }
};
require.cache[adapterPath] = { id: adapterPath, filename: adapterPath, loaded: true, exports: adapterStub };

const app = require('../src/app');

const MENU = '/api/public/restaurant/chandrikafamilyrestaurant/menu';
const ALLOWED = 'https://chandrikafamilyrestaurant.dynease.in';

let server, base;

function request(pathname, { method = 'GET', origin, preflight = false } = {}) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (origin) headers.Origin = origin;
    if (preflight) {
      headers['Access-Control-Request-Method'] = 'GET';
      headers['Access-Control-Request-Headers'] = 'content-type';
    }
    const req = require('node:http').request(`${base}${pathname}`, { method, headers, agent: false }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  try { require('../src/db/client').pool.end(); } catch { /* ignore */ }
});

test('CORS header present on an application 503 (DB outage) response', async () => {
  adapterStub._mode = 'throw';
  const res = await request(MENU, { origin: ALLOWED });
  assert.equal(res.status, 503);
  assert.equal(res.headers['access-control-allow-origin'], ALLOWED);
  assert.equal(res.headers['access-control-allow-credentials'], 'true');
});

test('CORS preflight succeeds with 204 + allow headers', async () => {
  const res = await request(MENU, { method: 'OPTIONS', origin: ALLOWED, preflight: true });
  assert.equal(res.status, 204);
  assert.equal(res.headers['access-control-allow-origin'], ALLOWED);
  assert.match(res.headers['access-control-allow-methods'] || '', /GET/);
});

test('disallowed origin never receives an Access-Control-Allow-Origin header', async () => {
  adapterStub._mode = 'throw';
  const res = await request(MENU, { origin: 'https://evil.com' });
  assert.equal(res.headers['access-control-allow-origin'], undefined);
});

test('genuine missing restaurant => 404 (distinct from DB outage) with CORS header', async () => {
  adapterStub._mode = 'null';
  const res = await request(MENU, { origin: ALLOWED });
  assert.equal(res.status, 404);
  assert.equal(res.headers['access-control-allow-origin'], ALLOWED);

  adapterStub._mode = 'throw';
  const outage = await request(MENU, { origin: ALLOWED });
  assert.equal(outage.status, 503);
  assert.notEqual(outage.status, 404);
});
