const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { PLANS, getPlan, getSavingsInfo, getPublicPlans, hasEntitlement } = require('../src/config/plans');
const SubscriptionService = require('../src/services/SubscriptionService');

describe('Dynease Subscription & Pricing Plans - Test Suite', () => {

  describe('1. Plan Pricing & Monetary Integrity', () => {
    it('verifies exact monthly and yearly prices in integer paise for all 4 plans', () => {
      // Starter: ₹999/mo, ₹9,990/yr
      assert.equal(PLANS.STARTER.monthlyPricePaise, 99900, 'Starter monthly price must be 99900 paise (₹999)');
      assert.equal(PLANS.STARTER.yearlyPricePaise, 999000, 'Starter yearly price must be 999000 paise (₹9,990)');

      // Growth: ₹1,999/mo, ₹19,990/yr
      assert.equal(PLANS.GROWTH.monthlyPricePaise, 199900, 'Growth monthly price must be 199900 paise (₹1,999)');
      assert.equal(PLANS.GROWTH.yearlyPricePaise, 1999000, 'Growth yearly price must be 1999000 paise (₹19,990)');

      // Business: ₹3,499/mo, ₹34,990/yr
      assert.equal(PLANS.BUSINESS.monthlyPricePaise, 349900, 'Business monthly price must be 349900 paise (₹3,499)');
      assert.equal(PLANS.BUSINESS.yearlyPricePaise, 3499000, 'Business yearly price must be 3499000 paise (₹34,990)');

      // Pro: ₹5,999/mo, ₹59,990/yr
      assert.equal(PLANS.PRO.monthlyPricePaise, 599900, 'Pro monthly price must be 599900 paise (₹5,999)');
      assert.equal(PLANS.PRO.yearlyPricePaise, 5999000, 'Pro yearly price must be 5999000 paise (₹59,990)');
    });

    it('verifies exact yearly savings and discount percentage calculation for all 4 plans', () => {
      // Formula: (monthlyPrice * 12) - yearlyPrice
      // Starter: (999 * 12) - 9990 = 11988 - 9990 = 1998 (16.7%)
      const starterSavings = getSavingsInfo(PLANS.STARTER);
      assert.equal(starterSavings.savingsRupees, 1998, 'Starter yearly savings must be ₹1,998');
      assert.equal(starterSavings.discountPercent, 16.7, 'Starter discount must be 16.7%');

      // Growth: (1999 * 12) - 19990 = 23988 - 19990 = 3998 (16.7%)
      const growthSavings = getSavingsInfo(PLANS.GROWTH);
      assert.equal(growthSavings.savingsRupees, 3998, 'Growth yearly savings must be ₹3,998');
      assert.equal(growthSavings.discountPercent, 16.7, 'Growth discount must be 16.7%');

      // Business: (3499 * 12) - 34990 = 41988 - 34990 = 6998 (16.7%)
      const businessSavings = getSavingsInfo(PLANS.BUSINESS);
      assert.equal(businessSavings.savingsRupees, 6998, 'Business yearly savings must be ₹6,998');
      assert.equal(businessSavings.discountPercent, 16.7, 'Business discount must be 16.7%');

      // Pro: (5999 * 12) - 59990 = 71988 - 59990 = 11998 (16.7%)
      const proSavings = getSavingsInfo(PLANS.PRO);
      assert.equal(proSavings.savingsRupees, 11998, 'Pro yearly savings must be ₹11,998');
      assert.equal(proSavings.discountPercent, 16.7, 'Pro discount must be 16.7%');
    });

    it('resolves legacy and case-insensitive plan identifiers safely', () => {
      assert.equal(getPlan('starter').planId, 'STARTER');
      assert.equal(getPlan('growth').planId, 'GROWTH');
      assert.equal(getPlan('business').planId, 'BUSINESS');
      assert.equal(getPlan('pro').planId, 'PRO');
      assert.equal(getPlan('FREE').planId, 'STARTER', 'Legacy FREE must map safely to STARTER');
      assert.equal(getPlan('nonexistent_plan'), null, 'Nonexistent plan must return null');
    });
  });

  describe('2. Resource Limits & Capacities', () => {
    it('verifies table limits: Starter=10, Growth=30, Business=Unlimited (null), Pro=Unlimited (null)', () => {
      assert.equal(PLANS.STARTER.limits.maxTables, 10);
      assert.equal(PLANS.GROWTH.limits.maxTables, 30);
      assert.equal(PLANS.BUSINESS.limits.maxTables, null);
      assert.equal(PLANS.PRO.limits.maxTables, null);
    });

    it('verifies menu item limits: Starter=50, Growth=200, Business=Unlimited, Pro=Unlimited', () => {
      assert.equal(PLANS.STARTER.limits.maxMenuItems, 50);
      assert.equal(PLANS.GROWTH.limits.maxMenuItems, 200);
      assert.equal(PLANS.BUSINESS.limits.maxMenuItems, null);
      assert.equal(PLANS.PRO.limits.maxMenuItems, null);
    });

    it('verifies staff account limits: Starter=3, Growth=10, Business=30, Pro=Unlimited', () => {
      assert.equal(PLANS.STARTER.limits.maxStaffAccounts, 3);
      assert.equal(PLANS.GROWTH.limits.maxStaffAccounts, 10);
      assert.equal(PLANS.BUSINESS.limits.maxStaffAccounts, 30);
      assert.equal(PLANS.PRO.limits.maxStaffAccounts, null);
    });

    it('verifies location limits: Starter=1, Growth=1, Business=3, Pro=5', () => {
      assert.equal(PLANS.STARTER.limits.maxLocations, 1);
      assert.equal(PLANS.GROWTH.limits.maxLocations, 1);
      assert.equal(PLANS.BUSINESS.limits.maxLocations, 3);
      assert.equal(PLANS.PRO.limits.maxLocations, 5);
    });

    it('verifies order history retention days: Starter=7, Growth=30, Business=365, Pro=Unlimited', () => {
      assert.equal(PLANS.STARTER.limits.orderHistoryDays, 7);
      assert.equal(PLANS.GROWTH.limits.orderHistoryDays, 30);
      assert.equal(PLANS.BUSINESS.limits.orderHistoryDays, 365);
      assert.equal(PLANS.PRO.limits.orderHistoryDays, null);
    });
  });

  describe('3. Feature Entitlements & Access Control', () => {
    it('Starter plan feature entitlements', () => {
      assert.equal(hasEntitlement('STARTER', 'reportsExport'), false, 'Starter cannot export reports');
      assert.equal(hasEntitlement('STARTER', 'multiLocationDashboard'), false, 'Starter has no multi-location dashboard');
      assert.equal(hasEntitlement('STARTER', 'customerCrm', 'basic'), false, 'Starter has no CRM');
      assert.equal(hasEntitlement('STARTER', 'salesAnalytics', 'basic'), true, 'Starter has basic analytics');
      assert.equal(hasEntitlement('STARTER', 'salesAnalytics', 'advanced'), false, 'Starter does not have advanced analytics');
    });

    it('Growth plan feature entitlements', () => {
      assert.equal(hasEntitlement('GROWTH', 'reportsExport'), true, 'Growth can export reports');
      assert.equal(hasEntitlement('GROWTH', 'customerCrm', 'basic'), true, 'Growth has basic CRM');
      assert.equal(hasEntitlement('GROWTH', 'customerCrm', 'full'), false, 'Growth does not have full CRM');
      assert.equal(hasEntitlement('GROWTH', 'multiLocationDashboard'), false, 'Growth has no multi-location dashboard');
    });

    it('Business plan feature entitlements', () => {
      assert.equal(hasEntitlement('BUSINESS', 'customerCrm', 'full'), true, 'Business has full CRM');
      assert.equal(hasEntitlement('BUSINESS', 'multiLocationDashboard'), true, 'Business has multi-location dashboard');
      assert.equal(hasEntitlement('BUSINESS', 'loyaltySystem'), false, 'Business does not have loyalty rewards');
    });

    it('Pro plan feature entitlements', () => {
      assert.equal(hasEntitlement('PRO', 'customerCrm', 'loyalty'), true, 'Pro has full CRM and loyalty rewards');
      assert.equal(hasEntitlement('PRO', 'loyaltySystem'), true, 'Pro has loyalty system');
      assert.equal(hasEntitlement('PRO', 'salesAnalytics', 'consolidated'), true, 'Pro has consolidated analytics');
      assert.equal(hasEntitlement('PRO', 'restaurantBranding', 'advanced'), true, 'Pro has advanced branding');
    });
  });

  describe('4. Mock Tenant Limit Enforcement', () => {
    it('blocks table creation when limit is reached', async () => {
      const mockTenantDb = {
        model: (name) => {
          if (name === 'Table') {
            return {
              countDocuments: async () => 10 // already at 10 tables
            };
          }
          return { countDocuments: async () => 0 };
        }
      };

      const starterRegistry = { restaurantId: 'rest_starter_test', selectedPlan: 'STARTER' };

      // Starter limit is 10, attempting to add 1 more when at 10 should throw
      await assert.rejects(
        async () => {
          await SubscriptionService.checkResourceLimit(mockTenantDb, starterRegistry, 'tables', 1);
        },
        (err) => {
          assert.equal(err.code, 'LIMIT_EXCEEDED');
          assert.equal(err.status, 403);
          return true;
        }
      );
    });

    it('permits table creation within limit', async () => {
      const mockTenantDb = {
        model: (name) => {
          if (name === 'Table') {
            return {
              countDocuments: async () => 8 // 8 tables
            };
          }
          return { countDocuments: async () => 0 };
        }
      };

      const starterRegistry = { restaurantId: 'rest_starter_test', selectedPlan: 'STARTER' };
      const allowed = await SubscriptionService.checkResourceLimit(mockTenantDb, starterRegistry, 'tables', 1);
      assert.equal(allowed, true);
    });

    it('allows unlimited table creation for Business and Pro', async () => {
      const mockTenantDb = {
        model: (name) => {
          if (name === 'Table') {
            return {
              countDocuments: async () => 500 // 500 tables
            };
          }
          return { countDocuments: async () => 0 };
        }
      };

      const businessRegistry = { restaurantId: 'rest_biz_test', selectedPlan: 'BUSINESS' };
      const proRegistry = { restaurantId: 'rest_pro_test', selectedPlan: 'PRO' };

      assert.equal(await SubscriptionService.checkResourceLimit(mockTenantDb, businessRegistry, 'tables', 1), true);
      assert.equal(await SubscriptionService.checkResourceLimit(mockTenantDb, proRegistry, 'tables', 1), true);
    });
  });

});
