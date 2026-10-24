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
});
