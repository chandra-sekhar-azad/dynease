const { describe, it } = require('node:test');
const assert = require('node:assert');
const publicController = require('../src/controllers/publicController');

describe('Customer Order Isolation & Non-Collision', () => {
  it('publicController exports getCustomerOrders and createOrder', () => {
    assert.strictEqual(typeof publicController.getCustomerOrders, 'function');
    assert.strictEqual(typeof publicController.createOrder, 'function');
  });

  it('getCustomerOrders returns empty list when neither orderIds, tableId, nor phone is provided', async () => {
    let responseStatus = null;
    let responseJson = null;

    const mockReq = {
      query: {}
    };

    const mockRes = {
      status(s) {
        responseStatus = s;
        return this;
      },
      json(data) {
        responseJson = data;
        return this;
      }
    };

    const mockNext = (err) => {
      if (err) throw err;
    };

    await publicController.getCustomerOrders(mockReq, mockRes, mockNext);

    assert.strictEqual(responseStatus, 200);
    assert.strictEqual(responseJson.success, true);
    assert.deepStrictEqual(responseJson.data.orders, []);
  });

  it('getCustomerOrders ignores invalid UUIDs in orderIds', async () => {
    let responseStatus = null;
    let responseJson = null;

    const mockReq = {
      query: {
        orderIds: 'invalid-id,another-bad-id'
      }
    };

    const mockRes = {
      status(s) {
        responseStatus = s;
        return this;
      },
      json(data) {
        responseJson = data;
        return this;
      }
    };

    const mockNext = (err) => {
      if (err) throw err;
    };

    await publicController.getCustomerOrders(mockReq, mockRes, mockNext);

    assert.strictEqual(responseStatus, 200);
    assert.strictEqual(responseJson.success, true);
    assert.deepStrictEqual(responseJson.data.orders, []);
  });

  it('protect middleware cleanly rejects undefined, null, and empty bearer tokens without jwt error', async () => {
    const { protect } = require('../src/middleware/auth');
    
    for (const authHeader of [
      'Bearer undefined',
      'Bearer null',
      'Bearer ',
      undefined,
      ''
    ]) {
      let status = null;
      let body = null;
      const req = {
        headers: authHeader !== undefined ? { authorization: authHeader } : {}
      };
      const res = {
        status(s) {
          status = s;
          return this;
        },
        json(data) {
          body = data;
          return this;
        }
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      await protect(req, res, next);
      assert.strictEqual(status, 401);
      assert.strictEqual(body.success, false);
      assert.strictEqual(nextCalled, false);
      assert.strictEqual(body.message, 'You are not logged in. Please log in to get access.');
    }
  });

  it('createOrder rejects request when tableId or items are missing', async () => {
    let status = null;
    let body = null;
    const req = {
      body: {}
    };
    const res = {
      status(s) {
        status = s;
        return this;
      },
      json(data) {
        body = data;
        return this;
      }
    };
    await publicController.createOrder(req, res, () => {});
    assert.strictEqual(status, 400);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.message, 'Table is required.');
  });
});
