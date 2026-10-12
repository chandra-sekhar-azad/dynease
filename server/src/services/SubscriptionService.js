const { getPlan, PLANS, hasEntitlement } = require('../config/plans');
const PlatformSubscription = require('../models/platform/PlatformSubscription');
const PlatformInvoice = require('../models/platform/PlatformInvoice');
const RestaurantRegistry = require('../models/platform/RestaurantRegistry');
const crypto = require('crypto');

class SubscriptionService {
  /**
   * Generates a unique invoice number
   */
  generateInvoiceNumber() {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `INV-${dateStr}-${rand}`;
  }

  /**
   * Resolves the canonical subscription record for a restaurant.
   * If PlatformSubscription record does not yet exist for a legacy registry, automatically backfills it.
   */
  async getSubscriptionForRestaurant(restaurantId, subdomain = null) {
    let sub = await PlatformSubscription.findOne({ restaurantId });
    if (sub) return sub;

    // Fallback: lookup in RestaurantRegistry and create initial subscription
    const query = restaurantId ? { restaurantId } : { subdomain };
    const registry = await RestaurantRegistry.findOne(query);
    if (!registry) return null;

    const rawPlan = registry.selectedPlan || 'STARTER';
    const plan = getPlan(rawPlan) || PLANS.STARTER;
    const now = new Date();
    const periodStart = registry.subscriptionStartDate || now;
    const periodEnd = registry.subscriptionEndDate || new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const billingCycle = registry.billingCycle || 'monthly';
    const pricePaise = billingCycle === 'yearly' ? plan.yearlyPricePaise : plan.monthlyPricePaise;

    let subStatus = 'trialing';
    if (registry.subscriptionStatus === 'ACTIVE') subStatus = 'active';
    else if (registry.subscriptionStatus === 'EXPIRED') subStatus = 'expired';
    else if (registry.subscriptionStatus === 'SUSPENDED') subStatus = 'suspended';

    sub = await PlatformSubscription.create({
      restaurantId: registry.restaurantId,
      subdomain: registry.subdomain,
      planId: plan.planId,
      billingCycle,
      status: subStatus,
      startDate: periodStart,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      nextBillingDate: periodEnd,
      pricePaise,
      history: [{
        action: 'CREATED',
        toPlan: plan.planId,
        toStatus: subStatus,
        amountPaise: pricePaise,
        performedBy: 'SYSTEM_SYNC',
        note: 'Backfilled from restaurant registry record'
      }]
    });

    return sub;
  }

  /**
   * Gets current resource usage and plan limits for a restaurant.
   */
  async getUsageAndLimits(tenantDb, restaurantRegistry) {
    if (!restaurantRegistry) throw new Error('Restaurant registry not found');

    const rawPlan = restaurantRegistry.selectedPlan || 'STARTER';
    const plan = getPlan(rawPlan) || PLANS.STARTER;

    // 1. Locations count (groups or registered subdomains for this owner email)
    let locationCount = 1;
    try {
      if (restaurantRegistry.ownerEmail) {
        locationCount = await RestaurantRegistry.countDocuments({
          ownerEmail: restaurantRegistry.ownerEmail,
          status: { $in: ['ACTIVE', 'PROVISIONING', 'PENDING_APPROVAL'] }
        });
      }
    } catch {
      locationCount = 1;
    }

    // 2. Tables count (valid, active/non-deleted tables)
    let tableCount = 0;
    if (tenantDb) {
      try {
        const Table = tenantDb.model('Table');
        // Count non-deleted tables (status !== 'DELETED')
        tableCount = await Table.countDocuments({
          restaurantId: restaurantRegistry.restaurantId,
          status: { $ne: 'DELETED' }
        });
      } catch (err) {
        console.error('Error counting tables for usage:', err);
      }
    }

    // 3. Menu items count
    let menuItemCount = 0;
    if (tenantDb) {
      try {
        const MenuItem = tenantDb.model('MenuItem');
        menuItemCount = await MenuItem.countDocuments({
          restaurantId: restaurantRegistry.restaurantId
        });
      } catch (err) {
        console.error('Error counting menu items for usage:', err);
      }
    }

    // 4. Staff count (RESTAURANT_STAFF, KITCHEN_STAFF, etc. Owner excluded from limit)
    let staffCount = 0;
    if (tenantDb) {
      try {
        const User = tenantDb.model('User');
        staffCount = await User.countDocuments({
          restaurantId: restaurantRegistry.restaurantId,
          role: { $in: ['RESTAURANT_STAFF', 'KITCHEN_STAFF'] },
          isActive: true
        });
      } catch (err) {
        console.error('Error counting staff for usage:', err);
      }
    }

    return {
      planId: plan.planId,
      planName: plan.name,
      limits: plan.limits,
      features: plan.features,
      usage: {
        locations: locationCount,
        tables: tableCount,
        menuItems: menuItemCount,
        staffAccounts: staffCount
      },
      capacityRemaining: {
        locations: plan.limits.maxLocations === null ? null : Math.max(0, plan.limits.maxLocations - locationCount),
        tables: plan.limits.maxTables === null ? null : Math.max(0, plan.limits.maxTables - tableCount),
        menuItems: plan.limits.maxMenuItems === null ? null : Math.max(0, plan.limits.maxMenuItems - menuItemCount),
        staffAccounts: plan.limits.maxStaffAccounts === null ? null : Math.max(0, plan.limits.maxStaffAccounts - staffCount)
      }
    };
  }

  /**
   * Asserts whether creating N units of a resource is allowed under the current plan.
   * Throws 403 error with detailed code if limit is reached.
   */
  async checkResourceLimit(tenantDb, restaurantRegistry, resourceType, additionalUnits = 1) {
    const { limits, usage } = await this.getUsageAndLimits(tenantDb, restaurantRegistry);

    if (resourceType === 'tables') {
      if (limits.maxTables !== null && (usage.tables + additionalUnits) > limits.maxTables) {
        const error = new Error(`Table limit reached (${usage.tables}/${limits.maxTables}). Upgrade your plan to add more tables.`);
        error.status = 403;
        error.code = 'LIMIT_EXCEEDED';
        error.details = { resource: 'tables', current: usage.tables, limit: limits.maxTables };
        throw error;
      }
    } else if (resourceType === 'menuItems') {
      if (limits.maxMenuItems !== null && (usage.menuItems + additionalUnits) > limits.maxMenuItems) {
        const error = new Error(`Menu item limit reached (${usage.menuItems}/${limits.maxMenuItems}). Upgrade your plan to add more menu items.`);
        error.status = 403;
        error.code = 'LIMIT_EXCEEDED';
        error.details = { resource: 'menuItems', current: usage.menuItems, limit: limits.maxMenuItems };
        throw error;
      }
    } else if (resourceType === 'staff') {
      if (limits.maxStaffAccounts !== null && (usage.staffAccounts + additionalUnits) > limits.maxStaffAccounts) {
        const error = new Error(`Staff account limit reached (${usage.staffAccounts}/${limits.maxStaffAccounts}). Upgrade your plan to add more staff accounts.`);
        error.status = 403;
        error.code = 'LIMIT_EXCEEDED';
        error.details = { resource: 'staff', current: usage.staffAccounts, limit: limits.maxStaffAccounts };
        throw error;
      }
    } else if (resourceType === 'locations') {
      if (limits.maxLocations !== null && (usage.locations + additionalUnits) > limits.maxLocations) {
        const error = new Error(`Location limit reached (${usage.locations}/${limits.maxLocations}). Upgrade to Business or Pro plan to add multiple locations.`);
        error.status = 403;
        error.code = 'LIMIT_EXCEEDED';
        error.details = { resource: 'locations', current: usage.locations, limit: limits.maxLocations };
        throw error;
      }
    }
    return true;
  }

  /**
   * Records an immutable invoice for a subscription payment/adjustment.
   */
  async createInvoice({
    restaurantId,
    subdomain,
    planId,
    planName,
    billingCycle,
    amountPaise,
    status = 'PAID',
    periodStart,
    periodEnd,
    paymentMethod = 'MANUAL_OFFLINE',
    transactionId = null,
    notes = '',
    recordedBy = 'SYSTEM'
  }) {
    const invoiceNumber = this.generateInvoiceNumber();
    const invoice = await PlatformInvoice.create({
      invoiceNumber,
      restaurantId,
      subdomain,
      planId,
      planName,
      billingCycle,
      amountPaise,
      amountRupees: Math.round(amountPaise / 100),
      currency: 'INR',
      status,
      periodStart,
      periodEnd,
      paymentMethod,
      transactionId,
      paidAt: status === 'PAID' ? new Date() : null,
      notes,
      recordedBy
    });
    return invoice;
  }
}

module.exports = new SubscriptionService();
