const { describe, it } = require('node:test');
const assert = require('node:assert');
const restaurantController = require('../src/controllers/restaurantController');

describe('Menu Item Creation with Multiple Sizes / Quantities', () => {
  it('restaurantController exports createMenuItem and updateMenuItem', () => {
    assert.strictEqual(typeof restaurantController.createMenuItem, 'function');
    assert.strictEqual(typeof restaurantController.updateMenuItem, 'function');
  });

  it('createMenuItem rejects requests missing item name', async () => {
    let responseStatus = null;
    let responseJson = null;

    const mockReq = {
      user: { restaurantId: 'test-restaurant-id' },
      body: { name: '', quantities: [{ size: 'Full', price: 200 }] }
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

    await restaurantController.createMenuItem(mockReq, mockRes);

    assert.strictEqual(responseStatus, 400);
    assert.strictEqual(responseJson.success, false);
    assert.match(responseJson.message, /Item name is required/i);
  });

  it('createMenuItem rejects requests with no valid portions or price', async () => {
    let responseStatus = null;
    let responseJson = null;

    const mockReq = {
      user: { restaurantId: 'test-restaurant-id' },
      body: { name: 'Chicken Biryani', quantities: [] }
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

    await restaurantController.createMenuItem(mockReq, mockRes);

    assert.strictEqual(responseStatus, 400);
    assert.strictEqual(responseJson.success, false);
    assert.match(responseJson.message, /portion size and valid price/i);
  });
});
