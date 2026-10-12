const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { PLANS, getPlan, getSavingsInfo, getPublicPlans, hasEntitlement } = require('../src/config/plans');
const SubscriptionService = require('../src/services/SubscriptionService');

describe('Dynease Subscription & Pricing Plans - Test Suite', () => {

  describe('1. Plan Pricing & Monetary Integrity', () => {
    it('verifies exact monthly and yearly prices in integer paise for all plans', () => {
      // Starter: ₹999/mo, ₹9,999/yr
      assert.equal(PLANS.STARTER.monthlyPricePaise, 99900, 'Starter monthly price must be 99900 paise (₹999)');
      assert.equal(PLANS.STARTER.yearlyPricePaise, 999900, 'Starter yearly price must be 999900 paise (₹9,999)');

      // Growth: ₹1,999/mo, ₹19,999/yr
      assert.equal(PLANS.GROWTH.monthlyPricePaise, 199900, 'Growth monthly price must be 199900 paise (₹1,999)');
      assert.equal(PLANS.GROWTH.yearlyPricePaise, 1999900, 'Growth yearly price must be 1999900 paise (₹19,999)');

      // Business: ₹3,499/mo, ₹34,999/yr
      assert.equal(PLANS.BUSINESS.monthlyPricePaise, 349900, 'Business monthly price must be 349900 paise (₹3,499)');
      assert.equal(PLANS.BUSINESS.yearlyPricePaise, 3499900, 'Business yearly price must be 3499900 paise (₹34,999)');

      // Custom: custom pricing
      assert.equal(PLANS.CUSTOM.monthlyPricePaise, null, 'Custom monthly price is negotiable/custom');
      assert.equal(PLANS.CUSTOM.yearlyPricePaise, null, 'Custom yearly price is negotiable/custom');
    });

    it('verifies exact yearly savings and discount percentage calculation for paid tiers', () => {
      // Formula: (monthlyPrice * 12) - yearlyPrice
      // Starter: (999 * 12) - 9999 = 11988 - 9999 = 1989 (~16.6%)
      const starterSavings = getSavingsInfo(PLANS.STARTER);
      assert.equal(starterSavings.savingsRupees, 1989, 'Starter yearly savings must be ₹1,989');
      assert.equal(starterSavings.discountPercent, 16.6, 'Starter discount must be ~16.6%');

      // Growth: (1999 * 12) - 19999 = 23988 - 19999 = 3989 (~16.6%)
      const growthSavings = getSavingsInfo(PLANS.GROWTH);
      assert.equal(growthSavings.savingsRupees, 3989, 'Growth yearly savings must be ₹3,989');
      assert.equal(growthSavings.discountPercent, 16.6, 'Growth discount must be ~16.6%');

      // Business: (3499 * 12) - 34999 = 41988 - 34999 = 6989 (~16.6%)
      const businessSavings = getSavingsInfo(PLANS.BUSINESS);
      assert.equal(businessSavings.savingsRupees, 6989, 'Business yearly savings must be ₹6,989');
      assert.equal(businessSavings.discountPercent, 16.6, 'Business discount must be ~16.6%');
    });

    it('resolves legacy and case-insensitive plan identifiers safely', () => {
      assert.equal(getPlan('starter').planId, 'STARTER');
      assert.equal(getPlan('growth').planId, 'GROWTH');
      assert.equal(getPlan('business').planId, 'BUSINESS');
      assert.equal(getPlan('custom').planId, 'CUSTOM');
      assert.equal(getPlan('pro').planId, 'CUSTOM', 'Legacy PRO must map safely to CUSTOM');
      assert.equal(getPlan('FREE').planId, 'STARTER', 'Legacy FREE must map safely to STARTER');
      assert.equal(getPlan('nonexistent_plan'), null, 'Nonexistent plan must return null');
    });
  });

  describe('2. Resource Limits & Capacities', () => {
    it('verifies table limits: Starter=5, Growth=20, Business=40, Custom=Unlimited (null)', () => {
      assert.equal(PLANS.STARTER.limits.maxTables, 5);
      assert.equal(PLANS.GROWTH.limits.maxTables, 20);
      assert.equal(PLANS.BUSINESS.limits.maxTables, 40);
      assert.equal(PLANS.CUSTOM.limits.maxTables, null);
    });

    it('verifies menu item limits: Starter=50, Growth=200, Business=Unlimited, Custom=Unlimited', () => {
      assert.equal(PLANS.STARTER.limits.maxMenuItems, 50);
      assert.equal(PLANS.GROWTH.limits.maxMenuItems, 200);
      assert.equal(PLANS.BUSINESS.limits.maxMenuItems, null);
      assert.equal(PLANS.CUSTOM.limits.maxMenuItems, null);
    });

    it('verifies staff account limits: Starter=3, Growth=10, Business=30, Custom=Unlimited', () => {
      assert.equal(PLANS.STARTER.limits.maxStaffAccounts, 3);
      assert.equal(PLANS.GROWTH.limits.maxStaffAccounts, 10);
      assert.equal(PLANS.BUSINESS.limits.maxStaffAccounts, 30);
      assert.equal(PLANS.CUSTOM.limits.maxStaffAccounts, null);
    });

    it('verifies order history retention days: Starter=7, Growth=30, Business=365, Custom=Unlimited', () => {
      assert.equal(PLANS.STARTER.limits.orderHistoryDays, 7);
      assert.equal(PLANS.GROWTH.limits.orderHistoryDays, 30);
      assert.equal(PLANS.BUSINESS.limits.orderHistoryDays, 365);
      assert.equal(PLANS.CUSTOM.limits.orderHistoryDays, null);
    });
  });

  describe('3. Feature Entitlements & Access Control', () => {
    it('Starter plan feature entitlements', () => {
      assert.equal(hasEntitlement('STARTER', 'reportsExport'), false, 'Starter cannot export reports');
      assert.equal(hasEntitlement('STARTER', 'multiLocationDashboard'), false, 'Starter has no multi-location dashboard');
      assert.equal(hasEntitlement('STARTER', 'customerCrm', 'basic'), false, 'Starter has no CRM');
      assert.equal(hasEntitlement('STARTER', 'salesAnalytics', 'basic'), true, 'Starter has basic analytics');
      assert.equal(hasEntitlement('STARTER', 'salesAnalytics', 'advanced'), false, 'Starter does not have advanced analytics');
      assert.equal(hasEntitlement('STARTER', 'customerReviews'), true, 'Starter includes reviews to build trust');
    });

    it('Growth plan feature entitlements', () => {
      assert.equal(hasEntitlement('GROWTH', 'reportsExport'), false, 'Growth reports export is not included');
      assert.equal(hasEntitlement('GROWTH', 'customerCrm', 'basic'), true, 'Growth has basic CRM');
      assert.equal(hasEntitlement('GROWTH', 'customerCrm', 'full'), false, 'Growth does not have full CRM');
      assert.equal(hasEntitlement('GROWTH', 'customerReviews'), true, 'Growth includes reviews');
    });

    it('Business plan feature entitlements', () => {
      assert.equal(hasEntitlement('BUSINESS', 'customerCrm', 'full'), true, 'Business has full CRM');
      assert.equal(hasEntitlement('BUSINESS', 'reportsExport'), true, 'Business includes reports export');
      assert.equal(hasEntitlement('BUSINESS', 'loyaltySystem'), false, 'Business does not have loyalty rewards');
    });

    it('Custom plan feature entitlements', () => {
      assert.equal(hasEntitlement('CUSTOM', 'customerCrm', 'loyalty'), true, 'Custom has full CRM and loyalty rewards');
      assert.equal(hasEntitlement('CUSTOM', 'loyaltySystem'), true, 'Custom has loyalty system');
      assert.equal(hasEntitlement('CUSTOM', 'salesAnalytics', 'consolidated'), true, 'Custom has consolidated analytics');
      assert.equal(hasEntitlement('CUSTOM', 'restaurantBranding', 'advanced'), true, 'Custom has advanced branding');
    });
  });

  describe('4. Mock Tenant Limit Enforcement', () => {
    it('blocks table creation when limit is reached', async () => {
      const mockTenantDb = {
        model: (name) => {
          if (name === 'Table') {
            return {
              countDocuments: async () => 5 // already at 5 tables for Starter
            };
          }
          return { countDocuments: async () => 0 };
        }
      };

      const starterRegistry = { restaurantId: 'rest_starter_test', selectedPlan: 'STARTER' };

      // Starter limit is 5, attempting to add 1 more when at 5 should throw
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
              countDocuments: async () => 4 // 4 tables out of 5
            };
          }
          return { countDocuments: async () => 0 };
        }
      };

      const starterRegistry = { restaurantId: 'rest_starter_test', selectedPlan: 'STARTER' };
      const allowed = await SubscriptionService.checkResourceLimit(mockTenantDb, starterRegistry, 'tables', 1);
      assert.equal(allowed, true);
    });

    it('allows unlimited table creation for Custom', async () => {
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

      const customRegistry = { restaurantId: 'rest_custom_test', selectedPlan: 'CUSTOM' };
      assert.equal(await SubscriptionService.checkResourceLimit(mockTenantDb, customRegistry, 'tables', 1), true);
    });
  });

});
