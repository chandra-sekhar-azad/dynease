const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveAdsVisibility,
  normalizeAdsOverride
} = require('../src/utils/adsVisibility');

describe('Per-restaurant ads visibility', () => {
  it('follows the plan default when there is no restaurant override', () => {
    assert.deepEqual(resolveAdsVisibility(true, null), {
      adsEnabled: true,
      adsEnabledOverride: null,
      adsEnabledSource: 'PLAN'
    });
    assert.deepEqual(resolveAdsVisibility(false, undefined), {
      adsEnabled: false,
      adsEnabledOverride: null,
      adsEnabledSource: 'PLAN'
    });
  });

  it('allows enabling ads for an ad-free plan at one restaurant', () => {
    const result = resolveAdsVisibility(false, true);
    assert.equal(result.adsEnabled, true);
    assert.equal(result.adsEnabledOverride, true);
    assert.equal(result.adsEnabledSource, 'RESTAURANT');
  });

  it('allows hiding ads for an ad-supported plan at one restaurant', () => {
    const result = resolveAdsVisibility(true, false);
    assert.equal(result.adsEnabled, false);
    assert.equal(result.adsEnabledOverride, false);
    assert.equal(result.adsEnabledSource, 'RESTAURANT');
  });

  it('normalizes admin input for plan default, show, and hide', () => {
    assert.equal(normalizeAdsOverride(null), null);
    assert.equal(normalizeAdsOverride('DEFAULT'), null);
    assert.equal(normalizeAdsOverride(true), true);
    assert.equal(normalizeAdsOverride('YES'), true);
    assert.equal(normalizeAdsOverride('ENABLED'), true);
    assert.equal(normalizeAdsOverride(false), false);
    assert.equal(normalizeAdsOverride('NO'), false);
    assert.equal(normalizeAdsOverride('DISABLED'), false);
  });
});
