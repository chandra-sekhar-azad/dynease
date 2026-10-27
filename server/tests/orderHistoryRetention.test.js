const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getOrderRetentionFilter } = require('../src/middlewares/entitlementMiddleware');

describe('Plan-based order history retention', () => {
  const now = new Date('2026-10-27T12:00:00.000Z');
  const daysBefore = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  it('limits Starter history to 7 days', () => {
    assert.equal(
      getOrderRetentionFilter('STARTER', now).toISOString(),
      daysBefore(7).toISOString()
    );
  });

  it('limits Growth history to 30 days', () => {
    assert.equal(
      getOrderRetentionFilter('GROWTH', now).toISOString(),
      daysBefore(30).toISOString()
    );
  });

  it('limits Business history to 1 year (365 days)', () => {
    assert.equal(
      getOrderRetentionFilter('BUSINESS', now).toISOString(),
      daysBefore(365).toISOString()
    );
  });

  it('keeps Pro/Custom order history unlimited', () => {
    assert.equal(getOrderRetentionFilter('PRO', now), null);
    assert.equal(getOrderRetentionFilter('CUSTOM', now), null);
  });

  it('uses resolved plan limits from the database when provided', () => {
    assert.equal(
      getOrderRetentionFilter({ orderHistoryDays: 30 }, now).toISOString(),
      daysBefore(30).toISOString()
    );
    assert.equal(getOrderRetentionFilter({ orderHistoryDays: null }, now), null);
  });

  it('returns no cutoff when the plan cannot be resolved', () => {
    assert.equal(getOrderRetentionFilter('UNKNOWN_PLAN', now), null);
    assert.equal(getOrderRetentionFilter(undefined, now), null);
  });
});
