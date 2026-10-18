const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// --- Stub the DB-backed modules BEFORE requiring the middleware under test ---
const srcDir = path.resolve(__dirname, '../src');
const clientPath = path.join(srcDir, 'db/client.js');
const adapterPath = path.join(srcDir, 'services/PostgresAdapter.js');

require.cache[clientPath] = {
  id: clientPath, filename: clientPath, loaded: true,
  exports: {
    db: { update: () => ({ set: () => ({ where: () => Promise.resolve() }) }) },
    schema: { restaurants: {} }
  }
};

// Mutable stub so each test can choose behaviour.
const adapterStub = {
  _mode: 'throw',
  async getRegistryBySubdomain() {
    if (this._mode === 'throw') throw Object.assign(new Error('connect (ENOTFOUND) tenant/user not found'), { code: 'ENOTFOUND' });
    if (this._mode === 'null') return null;
    return { id: 'a535d9a0-9f3a-4b14-8525-92b57cd68e24', domain: 'chandrikafamilyrestaurant', status: 'ACTIVE', restaurant_status: 'ACTIVE', subscriptionStatus: 'ACTIVE' };
  },
  async getRegistryById() { return null; }
};
require.cache[adapterPath] = { id: adapterPath, filename: adapterPath, loaded: true, exports: adapterStub };

const tenantResolver = require('../src/middlewares/tenantResolver');
const subscriptionMiddleware = require('../src/middlewares/subscriptionMiddleware');

function mockRes() {
  return {
    statusCode: null, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; }
  };
}

test('tenantResolver: DB failure returns 503, not 404 "not found"', async () => {
  adapterStub._mode = 'throw';
  const req = { headers: { 'x-tenant-subdomain': 'chandrikafamilyrestaurant' }, hostname: 'api.dynease.in' };
  const res = mockRes();
  await tenantResolver(req, res, () => { throw new Error('next() must not be called on DB failure'); });
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.success, false);
});

test('tenantResolver: genuine missing restaurant still returns 404', async () => {
  adapterStub._mode = 'null';
  const req = { headers: { 'x-tenant-subdomain': 'does-not-exist' }, hostname: 'api.dynease.in' };
  const res = mockRes();
  await tenantResolver(req, res, () => {});
  assert.equal(res.statusCode, 404);
});

test('tenantResolver: valid tenant is attached and next() is called', async () => {
  adapterStub._mode = 'found';
  const req = { headers: { 'x-tenant-subdomain': 'chandrikafamilyrestaurant' }, hostname: 'api.dynease.in' };
  const res = mockRes();
  let called = false;
  await tenantResolver(req, res, () => { called = true; });
  assert.equal(called, true);
  assert.equal(req.restaurant.domain, 'chandrikafamilyrestaurant');
});

test('subscriptionMiddleware: DB failure returns 503, not 404 "Restaurant not found"', async () => {
  adapterStub._mode = 'throw';
  const req = { headers: {}, params: { slug: 'chandrikafamilyrestaurant' } };
  const res = mockRes();
  await subscriptionMiddleware.checkSubscription(req, res, () => { throw new Error('next() must not be called on DB failure'); });
  assert.equal(res.statusCode, 503);
});

test('subscriptionMiddleware: genuine missing restaurant returns 404', async () => {
  adapterStub._mode = 'null';
  const req = { headers: {}, params: { slug: 'does-not-exist' } };
  const res = mockRes();
  await subscriptionMiddleware.checkSubscription(req, res, () => {});
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.message, 'Restaurant not found');
});
