/**
 * Dynease Centralized Subscription Plans Configuration
 * Canonical definition of all 4 plans, integer paise pricing, feature limits, and entitlements.
 */

// Prices in integer paise (1 INR = 100 paise)
const PLANS = {
  STARTER: {
    planId: 'STARTER',
    name: 'Starter',
    tagline: 'Ideal for small cafes & bistros starting their digital journey',
    monthlyPricePaise: 99900,     // ₹999
    yearlyPricePaise: 999000,    // ₹9,990 (Save ₹1,998 / 16.7%)
    monthlyDisplayPrice: 999,
    yearlyDisplayPrice: 9990,
    currency: 'INR',
    currencySymbol: '₹',
    badge: null,
    isPopular: false,
    isActive: true,
    limits: {
      maxLocations: 1,
      maxTables: 10,
      maxMenuItems: 50,
      maxStaffAccounts: 3,        // Staff roles (waiter, kitchen, cashier). Owner excluded.
      orderHistoryDays: 7         // 7 days historical order visibility
    },
    features: {
      qrOrdering: true,
      liveOrders: true,
      customerReviews: true,
      salesAnalytics: 'basic',          // 'basic' | 'advanced' | 'consolidated'
      restaurantBranding: 'basic',      // 'basic' | 'customizable' | 'advanced'
      customerCrm: 'none',              // 'none' | 'basic' | 'full' | 'loyalty'
      reportsExport: false,
      multiLocationDashboard: false,
      loyaltySystem: false,
      supportLevel: 'standard',         // 'standard' | 'priority' | 'priority_onboarding'
      waiterAssignment: true
    },
    displayFeatures: [
      '1 Restaurant location',
      'Up to 10 Tables',
      'Up to 50 Menu items',
      'QR ordering & live orders',
      'Up to 3 Staff accounts',
      '7 days Order history',
      'Basic Sales analytics',
      'Customer reviews',
      'Basic restaurant branding',
      'Standard support'
    ]
  },

  GROWTH: {
    planId: 'GROWTH',
    name: 'Growth',
    tagline: 'Best for growing dine-in restaurants needing expanded capacity',
    monthlyPricePaise: 199900,    // ₹1,999
    yearlyPricePaise: 1999000,   // ₹19,990 (Save ₹3,998 / 16.7%)
    monthlyDisplayPrice: 1999,
    yearlyDisplayPrice: 19990,
    currency: 'INR',
    currencySymbol: '₹',
    badge: 'Most Popular',
    isPopular: true,
    isActive: true,
    limits: {
      maxLocations: 1,
      maxTables: 30,
      maxMenuItems: 200,
      maxStaffAccounts: 10,
      orderHistoryDays: 30        // 30 days
    },
    features: {
      qrOrdering: true,
      liveOrders: true,
      customerReviews: true,
      salesAnalytics: 'advanced',
      restaurantBranding: 'customizable',
      customerCrm: 'basic',
      reportsExport: true,
      multiLocationDashboard: false,
      loyaltySystem: false,
      supportLevel: 'priority',
      waiterAssignment: true
    },
    displayFeatures: [
      '1 Restaurant location',
      'Up to 30 Tables',
      'Up to 200 Menu items',
      'QR ordering & live orders',
      'Up to 10 Staff accounts',
      '30 days Order history',
      'Advanced Sales analytics',
      'Customer reviews',
      'Customizable branding',
      'Basic Customer CRM',
      'Reports export (CSV/Excel)',
      'Priority support'
    ]
  },

  BUSINESS: {
    planId: 'BUSINESS',
    name: 'Business',
    tagline: 'Perfect for established multi-table and multi-outlet food businesses',
    monthlyPricePaise: 349900,    // ₹3,499
    yearlyPricePaise: 3499000,   // ₹34,990 (Save ₹6,998 / 16.7%)
    monthlyDisplayPrice: 3499,
    yearlyDisplayPrice: 34990,
    currency: 'INR',
    currencySymbol: '₹',
    badge: 'Best for Multi-Location',
    isPopular: false,
    isActive: true,
    limits: {
      maxLocations: 3,            // Up to 3 locations
      maxTables: null,            // Unlimited
      maxMenuItems: null,         // Unlimited
      maxStaffAccounts: 30,
      orderHistoryDays: 365       // 1 year
    },
    features: {
      qrOrdering: true,
      liveOrders: true,
      customerReviews: true,
      salesAnalytics: 'advanced',
      restaurantBranding: 'customizable',
      customerCrm: 'full',
      reportsExport: true,
      multiLocationDashboard: true,
      loyaltySystem: false,
      supportLevel: 'priority',
      waiterAssignment: true
    },
    displayFeatures: [
      'Up to 3 Restaurant locations',
      'Unlimited Tables',
      'Unlimited Menu items',
      'QR ordering & live orders',
      'Up to 30 Staff accounts',
      '1 year Order history',
      'Advanced Sales analytics',
      'Customer reviews',
      'Customizable branding',
      'Full Customer CRM',
      'Reports export',
      'Multi-location dashboard',
      'Priority support'
    ]
  },

  PRO: {
    planId: 'PRO',
    name: 'Pro',
    tagline: 'Enterprise-grade platform for restaurant chains and franchises',
    monthlyPricePaise: 599900,    // ₹5,999
    yearlyPricePaise: 5999000,   // ₹59,990 (Save ₹11,998 / 16.7%)
    monthlyDisplayPrice: 5999,
    yearlyDisplayPrice: 59990,
    currency: 'INR',
    currencySymbol: '₹',
    badge: 'Enterprise & Chains',
    isPopular: false,
    isActive: true,
    limits: {
      maxLocations: 5,            // Up to 5 locations
      maxTables: null,            // Unlimited
      maxMenuItems: null,         // Unlimited
      maxStaffAccounts: null,     // Unlimited
      orderHistoryDays: null      // Unlimited
    },
    features: {
      qrOrdering: true,
      liveOrders: true,
      customerReviews: true,
      salesAnalytics: 'consolidated',
      restaurantBranding: 'advanced',
      customerCrm: 'loyalty',
      reportsExport: true,
      multiLocationDashboard: true,
      loyaltySystem: true,
      supportLevel: 'priority_onboarding',
      waiterAssignment: true
    },
    displayFeatures: [
      'Up to 5 Restaurant locations',
      'Unlimited Tables',
      'Unlimited Menu items',
      'QR ordering & live orders',
      'Unlimited Staff accounts',
      'Unlimited Order history',
      'Advanced + Consolidated analytics',
      'Customer reviews',
      'Advanced restaurant branding',
      'Full CRM + Loyalty rewards',
      'Reports export',
      'Multi-location dashboard',
      'Priority support + dedicated onboarding'
    ]
  }
};

/**
 * Calculates yearly savings and discount percentage.
 * Formula:
 * savings = (monthlyPrice * 12) - yearlyPrice
 * discountPercent = (savings / (monthlyPrice * 12)) * 100
 */
function getSavingsInfo(plan) {
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
 * Maps legacy 'FREE' plan to 'STARTER'.
 */
function getPlan(planId) {
  if (!planId) return null;
  const upper = String(planId).toUpperCase().trim();
  if (upper === 'FREE') return PLANS.STARTER;
  return PLANS[upper] || null;
}

/**
 * Returns public array of active plans with savings calculations.
 */
function getPublicPlans() {
  return Object.values(PLANS)
    .filter(p => p.isActive)
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
