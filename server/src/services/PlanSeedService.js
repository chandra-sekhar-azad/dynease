const { db } = require('../db/client');
const { plans } = require('../db/schema/plans');
const { PLANS } = require('../config/plans');

/**
 * Ensures canonical plans (STARTER, GROWTH, BUSINESS, PRO) are seeded in the PostgreSQL plans table.
 */
async function seedPlansIfMissing() {
  try {
    const canonicalKeys = ['STARTER', 'GROWTH', 'BUSINESS', 'PRO'];
    for (const key of canonicalKeys) {
      const p = PLANS[key];
      if (!p) continue;

      const name = key === 'PRO' ? 'Pro' : p.name;
      const config = {
        planId: key,
        name: name,
        limits: p.limits || {},
        features: p.features || {},
        monthlyPrice: p.monthlyDisplayPrice,
        yearlyPrice: p.yearlyDisplayPrice
      };

      await db.insert(plans).values({
        name: name,
        configuration: config,
        plan_status: 'ACTIVE',
        is_deleted: false
      }).onConflictDoNothing();
    }
  } catch (err) {
    console.error('[PlanSeedService] Error seeding canonical plans:', err.message);
  }
}

module.exports = { seedPlansIfMissing };
