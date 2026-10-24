const { describe, it } = require('node:test');
const assert = require('node:assert');
const OrderService = require('../src/services/OrderService');
const RealtimeService = require('../src/services/RealtimeService');

describe('More Items Order & Waiter Intimation', () => {
  it('OrderService has addItemsToOrder function', () => {
    assert.strictEqual(typeof OrderService.addItemsToOrder, 'function');
  });

  it('addItemsToOrder throws error for invalid payload parameters', async () => {
    await assert.rejects(
      async () => {
        await OrderService.addItemsToOrder({});
      },
      /Invalid payload: restaurant_id, order_id, and items are required/
    );

    await assert.rejects(
      async () => {
        await OrderService.addItemsToOrder({
          restaurant_id: '11111111-1111-1111-1111-111111111111',
          order_id: '22222222-2222-2222-2222-222222222222',
          items: []
        });
      },
      /Invalid payload: restaurant_id, order_id, and items are required/
    );
  });

  it('RealtimeService has orderItemsAdded function', () => {
    assert.strictEqual(typeof RealtimeService.orderItemsAdded, 'function');
  });

  it('RealtimeService.orderItemsAdded can be called without errors', () => {
    assert.doesNotThrow(() => {
      RealtimeService.orderItemsAdded({
        restaurantId: 'rest-123',
        order: { id: 'ord-123', orderNumber: 'ORD-123', status: 'ORDERED' },
        orderId: 'ord-123',
        tableId: 'tbl-123',
        waiterId: 'waiter-123',
        newItems: [{ name: 'Garlic Naan', quantity: 2 }],
        addedCount: 2
      });
    });
  });
});
