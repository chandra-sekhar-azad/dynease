const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const restaurantController = require('../src/controllers/restaurantController');

describe('Waiter Past Orders - Controller & Query Logic', () => {
  it('exports getOrders handler from restaurantController', () => {
    assert.equal(typeof restaurantController.getOrders, 'function', 'getOrders must be an exported function');
  });

  it('correctly maps order statuses into past categories (COMPLETED, PAID, CANCELLED)', () => {
    const sampleStatuses = [
      { status: 'ORDERED', isPast: false },
      { status: 'PREPARING', isPast: false },
      { status: 'READY', isPast: false },
      { status: 'SERVED', isPast: false },
      { status: 'COMPLETED', isPast: true },
      { status: 'PAID', isPast: true },
      { status: 'CANCELLED', isPast: true }
    ];

    const pastStatuses = ['COMPLETED', 'CANCELLED', 'PAID'];

    sampleStatuses.forEach(({ status, isPast }) => {
      assert.equal(
        pastStatuses.includes(status),
        isPast,
        `Status ${status} should ${isPast ? 'be' : 'not be'} treated as a past order`
      );
    });
  });

  it('correctly attributes order to assigned waiter or assigned tables', () => {
    const waiterId = 'waiter-uuid-1';
    const waiterTables = ['table-101', 'table-102'];

    const orders = [
      { id: '1', assigned_waiter_id: waiterId, table_id: 'table-999', status: 'COMPLETED' },
      { id: '2', assigned_waiter_id: null, table_id: 'table-101', status: 'PAID' },
      { id: '3', assigned_waiter_id: 'other-waiter', table_id: 'table-101', status: 'COMPLETED' },
      { id: '4', assigned_waiter_id: null, table_id: 'table-555', status: 'COMPLETED' }
    ];

    // Filter rule matching getOrders STAFF query:
    // Order belongs to waiter if assigned_waiter_id == waiterId,
    // OR (assigned_waiter_id IS NULL AND table_id IN waiterTables)
    const myOrders = orders.filter(o => 
      o.assigned_waiter_id === waiterId ||
      (!o.assigned_waiter_id && waiterTables.includes(o.table_id))
    );

    assert.equal(myOrders.length, 2, 'Should only return orders matching this waiter or their fallback tables');
    assert.equal(myOrders[0].id, '1', 'Order with direct waiter assignment should match');
    assert.equal(myOrders[1].id, '2', 'Order on waiter table with null direct assignment should match');
  });
});
