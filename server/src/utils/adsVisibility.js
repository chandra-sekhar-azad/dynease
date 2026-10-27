/**
 * Resolves ads visibility for a restaurant.
 *
 * A nullable restaurant-level override takes precedence over the plan
 * entitlement: `true` forces ads on, `false` forces them off, and
 * `null`/`undefined` follows the plan default.
 */
function resolveAdsVisibility(planShowAds, adsEnabledOverride) {
  const hasOverride = adsEnabledOverride === true || adsEnabledOverride === false;
  const planDefault = planShowAds !== false;

  return {
    adsEnabled: hasOverride ? adsEnabledOverride : planDefault,
    adsEnabledOverride: hasOverride ? adsEnabledOverride : null,
    adsEnabledSource: hasOverride ? 'RESTAURANT' : 'PLAN'
  };
}

/**
 * Normalizes an admin-provided ads visibility value into the nullable
 * boolean stored on the restaurant. Invalid input falls back to the plan
 * default so a bad payload cannot accidentally force ads on.
 */
function normalizeAdsOverride(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toUpperCase();
  if (['DEFAULT', 'INHERIT', 'PLAN'].includes(normalized)) return null;
  if (['TRUE', 'YES', 'ENABLED', 'SHOW', 'ON', '1'].includes(normalized)) return true;
  if (['FALSE', 'NO', 'DISABLED', 'HIDE', 'OFF', '0'].includes(normalized)) return false;
  return null;
}

module.exports = {
  resolveAdsVisibility,
  normalizeAdsOverride
};
