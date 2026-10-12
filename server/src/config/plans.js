/**
 * Dynease Centralized Subscription Plans Configuration
 * Canonical definition of all 4 plans, integer paise pricing, feature limits, and entitlements.
 * Updated to match the latest official pricing & capacity matrix:
 * Starter (₹999 / ₹9,999), Growth (₹1,999 / ₹19,999), Business (₹3,499 / ₹34,999), Custom/Enterprise
 */

// Prices in integer paise (1 INR = 100 paise)
const PLANS = {
  STARTER: {
    planId: 'STARTER',
    name: 'Starter',
    tagline: 'Ideal for small cafes & bistros starting their digital journey',
    monthlyPricePaise: 99900,     // ₹999
    yearlyPricePaise: 999900,    // ₹9,999 (~16.7% cheaper than monthly for 12 months)
    monthlyDisplayPrice: 999,
    yearlyDisplayPrice: 9999,
    currency: 'INR',
    currencySymbol: '₹',
    badge: null,
    isPopular: false,
    isActive: true,
    limits: {
      maxLocations: 1,
      maxTables: 5,               // Total tables: 5
      maxMenuItems: 50,           // Active menu items: 50
      maxStaffAccounts: 3,        // Staff roles: 3 (owner excluded)
      orderHistoryDays: 7         // 7 days historical order visibility
    },
    features: {
      qrOrdering: true,
      liveOrders: true,
      customerReviews: true,      // Included to help small restaurants build trust
      salesAnalytics: 'basic',    // 'basic' | 'advanced' | 'consolidated'
      restaurantBranding: 'basic',// Basic: restaurant name and logo
      customerCrm: 'none',        // Not included
      reportsExport: false,       // Not included
      multiLocationDashboard: false,
      loyaltySystem: false,
      supportLevel: 'standard',   // Standard
      waiterAssignment: true
    },
    displayFeatures: [
      '1 Restaurant location',
      'Up to 5 Tables',
      'Up to 50 Active menu items',
      'QR ordering & live orders',
      'Up to 3 Staff accounts',
      '7 days Order history',
      'Basic Sales analytics',
      'Customer reviews included',
      'Basic restaurant branding',
      'Standard support'
    ]
  },

  GROWTH: {
    planId: 'GROWTH',
    name: 'Growth',
    tagline: 'Best for growing dine-in restaurants needing expanded capacity',
    monthlyPricePaise: 199900,    // ₹1,999
    yearlyPricePaise: 1999900,   // ₹19,999 (~16.7% cheaper than monthly for 12 months)
    monthlyDisplayPrice: 1999,
    yearlyDisplayPrice: 19999,
    currency: 'INR',
    currencySymbol: '₹',
    badge: 'Most Popular',
    isPopular: true,
    isActive: true,
    limits: {
      maxLocations: 1,
      maxTables: 20,              // Total tables: 20
      maxMenuItems: 200,          // Active menu items: 200
      maxStaffAccounts: 10,       // Staff accounts: 10
      orderHistoryDays: 30        // 30 days
    },
    features: {
      qrOrdering: true,
      liveOrders: true,
      customerReviews: true,      // Included
      salesAnalytics: 'advanced', // Advanced trends and breakdowns
      restaurantBranding: 'customizable', // Customizable colors & layouts
      customerCrm: 'basic',       // Basic customer profiles and visit history
      reportsExport: false,       // Not included
      multiLocationDashboard: false,
      loyaltySystem: false,
      supportLevel: 'priority',   // Priority
      waiterAssignment: true
    },
    displayFeatures: [
      '1 Restaurant location',
      'Up to 20 Tables',
      'Up to 200 Active menu items',
      'QR ordering & live orders',
      'Up to 10 Staff accounts',
      '30 days Order history',
      'Advanced Sales analytics',
      'Customer reviews & ratings',
      'Customizable restaurant branding',
      'Basic Customer CRM',
      'Priority support'
    ]
  },

  BUSINESS: {
    planId: 'BUSINESS',
    name: 'Business',
    tagline: 'Perfect for established multi-table and multi-outlet food businesses',
    monthlyPricePaise: 349900,    // ₹3,499
    yearlyPricePaise: 3499900,   // ₹34,999 (~16.7% cheaper than monthly for 12 months)
    monthlyDisplayPrice: 3499,
    yearlyDisplayPrice: 34999,
    currency: 'INR',
    currencySymbol: '₹',
    badge: 'Best for Multi-Location',
    isPopular: false,
    isActive: true,
    limits: {
      maxLocations: 3,            // Up to 3 locations
      maxTables: 40,              // Total tables: 40
      maxMenuItems: null,         // Unlimited active menu items
      maxStaffAccounts: 30,       // Staff accounts: 30
      orderHistoryDays: 365       // 1 year
    },
    features: {
      qrOrdering: true,
      liveOrders: true,
      customerReviews: true,      // Included
      salesAnalytics: 'advanced', // Advanced
      restaurantBranding: 'customizable', // Customizable
      customerCrm: 'full',        // Full CRM
      reportsExport: true,        // Included (CSV / Excel)
      multiLocationDashboard: true,
      loyaltySystem: false,
      supportLevel: 'priority',   // Priority
      waiterAssignment: true
    },
    displayFeatures: [
      'Up to 3 Restaurant locations',
      'Up to 40 Tables',
      'Unlimited Menu items',
      'QR ordering & live orders',
      'Up to 30 Staff accounts',
      '1 year Order history',
      'Advanced Sales analytics',
      'Customer reviews',
      'Customizable branding',
      'Full Customer CRM',
      'Reports export (CSV/Excel)',
      'Multi-location dashboard',
      'Priority support'
    ]
  },

  CUSTOM: {
    planId: 'CUSTOM',
    name: 'Custom',
    tagline: 'Enterprise-grade platform tailored for restaurant chains and franchises',
    monthlyPricePaise: null,      // Custom pricing
    yearlyPricePaise: null,       // Custom pricing
    monthlyDisplayPrice: 'Custom',
    yearlyDisplayPrice: 'Custom',
    currency: 'INR',
    currencySymbol: '₹',
    badge: 'Enterprise & Chains',
    isPopular: false,
    isActive: true,
    isCustom: true,
    limits: {
      maxLocations: null,         // Unlimited locations
      maxTables: null,            // Unlimited tables
      maxMenuItems: null,         // Unlimited menu items
      maxStaffAccounts: null,     // Unlimited staff accounts
      orderHistoryDays: null      // Unlimited order history
    },
    features: {
      qrOrdering: true,
      liveOrders: true,
      customerReviews: true,
      salesAnalytics: 'consolidated',     // Advanced + consolidated multi-outlet
      restaurantBranding: 'advanced',     // Advanced custom branding
      customerCrm: 'loyalty',             // Full CRM + loyalty program
      reportsExport: true,                // Included
      multiLocationDashboard: true,
      loyaltySystem: true,
      supportLevel: 'priority_onboarding',// Priority + onboarding
      waiterAssignment: true
    },
    displayFeatures: [
      'Unlimited Restaurant locations',
      'Unlimited Tables',
      'Unlimited Menu items',
      'QR ordering & live orders',
      'Unlimited Staff accounts',
      'Unlimited Order history',
      'Advanced + Consolidated analytics',
      'Customer reviews',
      'Advanced restaurant branding',
      'Full CRM + Loyalty rewards',
      'Reports export (CSV/Excel)',
      'Multi-location dashboard',
      'Priority support + dedicated onboarding'
    ]
  }
};

// Backwards compatibility alias
PLANS.PRO = PLANS.CUSTOM;

/**
 * Calculates yearly savings and discount percentage.
 * Formula:
 * savings = (monthlyPrice * 12) - yearlyPrice
 * discountPercent = (savings / (monthlyPrice * 12)) * 100
 */
function getSavingsInfo(plan) {
  if (!plan.monthlyPricePaise || !plan.yearlyPricePaise) {
    return {
      savingsPaise: 0,
      savingsRupees: 0,
      discountPercent: 16.7
    };
  }

  const annualMonthlyPaise = plan.monthlyPricePaise * 12;
  const yearlyPaise = plan.yearlyPricePaise;
  const savingsPaise = annualMonthlyPaise - yearlyPaise;
  const savingsRupees = Math.round(savingsPaise / 100);
  const discountPercent = ((savingsPaise / annualMonthlyPaise) * 100).toFixed(1);

  return {
    savingsPaise,
    savingsRupees,
    discountPercent: parseFloat(discountPercent)
  };
}

/**
 * Resolves a plan by its ID (case-insensitive).
 * Maps legacy 'FREE' plan to 'STARTER', and 'PRO' to 'CUSTOM'.
 */
function getPlan(planId) {
  if (!planId) return null;
  const upper = String(planId).toUpperCase().trim();
  if (upper === 'FREE') return PLANS.STARTER;
  if (upper === 'PRO') return PLANS.CUSTOM;
  return PLANS[upper] || null;
}

/**
 * Returns public array of active plans with savings calculations.
 */
function getPublicPlans() {
  const planOrder = ['STARTER', 'GROWTH', 'BUSINESS', 'CUSTOM'];
  return planOrder
    .map(key => PLANS[key])
    .filter(p => p && p.isActive)
    .map(p => {
      const savings = getSavingsInfo(p);
      return {
        ...p,
        savingsRupees: savings.savingsRupees,
        savingsPaise: savings.savingsPaise,
        discountPercent: savings.discountPercent
      };
    });
}

/**
 * Checks whether an entitlement is satisfied by a plan.
 */
function hasEntitlement(planId, entitlementKey, requiredLevel) {
  const plan = getPlan(planId);
  if (!plan) return false;

  const featureVal = plan.features[entitlementKey];
  if (featureVal === undefined) return false;

  if (typeof featureVal === 'boolean') {
    return featureVal === true;
  }

  // Hierarchy levels
  const CRM_LEVELS = { none: 0, basic: 1, full: 2, loyalty: 3 };
  const ANALYTICS_LEVELS = { basic: 1, advanced: 2, consolidated: 3 };
  const BRANDING_LEVELS = { basic: 1, customizable: 2, advanced: 3 };
  const SUPPORT_LEVELS = { standard: 1, priority: 2, priority_onboarding: 3 };

  if (entitlementKey === 'customerCrm') {
    return (CRM_LEVELS[featureVal] || 0) >= (CRM_LEVELS[requiredLevel] || 0);
  }
  if (entitlementKey === 'salesAnalytics') {
    return (ANALYTICS_LEVELS[featureVal] || 0) >= (ANALYTICS_LEVELS[requiredLevel] || 0);
  }
  if (entitlementKey === 'restaurantBranding') {
    return (BRANDING_LEVELS[featureVal] || 0) >= (BRANDING_LEVELS[requiredLevel] || 0);
  }
  if (entitlementKey === 'supportLevel') {
    return (SUPPORT_LEVELS[featureVal] || 0) >= (SUPPORT_LEVELS[requiredLevel] || 0);
  }

  return featureVal === requiredLevel;
}

module.exports = {
  PLANS,
  getPlan,
  getPublicPlans,
  getSavingsInfo,
  hasEntitlement
};
