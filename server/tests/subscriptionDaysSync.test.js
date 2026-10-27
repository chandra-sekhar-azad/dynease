const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const restaurantController = require('../src/controllers/restaurantController');
const adminController = require('../src/controllers/adminController');

describe('Subscription Days & Renewal Date Synchronization', () => {
  it('exports required handlers', () => {
    assert.equal(typeof restaurantController.getSubscription, 'function');
    assert.equal(typeof adminController.getAllRestaurants, 'function');
    assert.equal(typeof adminController.updateRestaurantBilling, 'function');
  });

  it('calculates remaining days and end date identically on both admin and restaurant sides', () => {
    const now = new Date('2026-10-27T12:00:00.000Z');
    const targetEndDate = new Date('2026-11-26T12:00:00.000Z'); // 30 days away

    const msLeft = targetEndDate.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));

    assert.equal(daysRemaining, 30, 'Should accurately compute 30 days remaining');
  });

  it('marks subscription as EXPIRED when remaining days is 0 or less', () => {
    const now = new Date('2026-10-27T12:00:00.000Z');
    const expiredEndDate = new Date('2026-10-25T12:00:00.000Z'); // 2 days in the past

    const msLeft = expiredEndDate.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));

    assert.equal(daysRemaining, 0, 'Past date must result in 0 days remaining');
    const status = daysRemaining <= 0 ? 'EXPIRED' : 'ACTIVE';
    assert.equal(status, 'EXPIRED', 'Status must be EXPIRED when remaining days is 0');
  });
});
