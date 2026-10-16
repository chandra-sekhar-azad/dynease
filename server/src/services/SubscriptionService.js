const { getPlan, PLANS, hasEntitlement } = require('../config/plans');
const { db, schema } = require('../db/client');
const { eq, and, sql } = require('drizzle-orm');
const { restaurants, tables, menu_categories_items, users, plans, audit_log } = schema;
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
   * Resolves the subscription record for a restaurant from Supabase PostgreSQL.
   */
  async getSubscriptionForRestaurant(restaurantId, subdomain = null) {
    let restaurant = null;
    if (restaurantId) {
      const [row] = await db.select().from(restaurants).where(
        and(eq(restaurants.id, restaurantId), eq(restaurants.is_deleted, false))
      ).limit(1);
      restaurant = row;
    } else if (subdomain) {
      const [row] = await db.select().from(restaurants).where(
        and(eq(sql`LOWER(${restaurants.domain})`, subdomain.toLowerCase()), eq(restaurants.is_deleted, false))
      ).limit(1);
      restaurant = row;
    }

    if (!restaurant) return null;

    let planConfig = PLANS.STARTER;
    if (restaurant.plan_id) {
      const [p] = await db.select().from(plans).where(eq(plans.id, restaurant.plan_id)).limit(1);
      if (p) {
        planConfig = getPlan(p.name) || PLANS.STARTER;
      }
    }

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return {
      restaurantId: restaurant.id,
      subdomain: restaurant.domain,
      planId: planConfig.planId,
      billingCycle: 'monthly',
      status: restaurant.restaurant_status === 'ACTIVE' ? 'active' : 'suspended',
      startDate: restaurant.createdat,
      currentPeriodStart: restaurant.createdat,
      currentPeriodEnd: periodEnd,
      nextBillingDate: periodEnd,
      pricePaise: planConfig.monthlyPricePaise || 0,
      limits: planConfig.limits,
      features: planConfig.features
    };
  }

  /**
   * Gets current resource usage and plan limits for a restaurant.
   */
  async getUsageAndLimits(tenantDb, restaurantRegistry) {
    if (!restaurantRegistry) throw new Error('Restaurant registry not found');

    const restaurantId = restaurantRegistry.restaurantId || restaurantRegistry.id;
    const rawPlan = restaurantRegistry.selectedPlan || restaurantRegistry.plan_id || 'STARTER';
    const plan = getPlan(rawPlan) || PLANS.STARTER;

    let locationCount = 1;
    let tableCount = 0;
    let menuItemCount = 0;
    let staffCount = 0;

    // Check if mock tenantDb is provided (e.g. In unit tests)
    if (tenantDb && typeof tenantDb.model === 'function') {
      try {
        const Table = tenantDb.model('Table');
        tableCount = await Table.countDocuments({ restaurantId, status: { $ne: 'DELETED' } });
      } catch {}
      try {
        const MenuItem = tenantDb.model('MenuItem');
        menuItemCount = await MenuItem.countDocuments({ restaurantId });
      } catch {}
      try {
        const User = tenantDb.model('User');
        staffCount = await User.countDocuments({
          restaurantId,
          role: { $in: ['RESTAURANT_STAFF', 'KITCHEN_STAFF'] },
          isActive: true
        });
      } catch {}
    } else {
      // Query Supabase PostgreSQL via Drizzle ORM
      try {
        if (restaurantId) {
          const [tRes] = await db.select({ count: sql`count(*)` }).from(tables).where(
            and(eq(tables.restaurant_id, restaurantId), eq(tables.is_deleted, false))
          );
          tableCount = parseInt(tRes?.count || '0', 10);

          const [mRes] = await db.select({ count: sql`count(*)` }).from(menu_categories_items).where(
            and(eq(menu_categories_items.restaurant_id, restaurantId), eq(menu_categories_items.is_deleted, false))
          );
          menuItemCount = parseInt(mRes?.count || '0', 10);

          const [sRes] = await db.select({ count: sql`count(*)` }).from(users).where(
            and(
              eq(users.restaurant_id, restaurantId),
              eq(users.user_type, 'STAFF'),
              eq(users.user_status, 'ACTIVE'),
              eq(users.is_deleted, false)
            )
          );
          staffCount = parseInt(sRes?.count || '0', 10);
        }
      } catch (err) {
        console.error('[SubscriptionService] Error counting usage from PostgreSQL:', err.message);
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
   * Records an invoice for a subscription payment or plan adjustment.
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
    try {
      await db.insert(audit_log).values({
        restaurant_id: restaurantId,
        action: 'INVOICE_GENERATED',
        entity_type: 'INVOICE',
        details: {
          invoiceNumber,
          subdomain,
          planId,
          planName,
          billingCycle,
          amountPaise,
          status,
          paymentMethod,
          transactionId,
          notes,
          recordedBy
        }
      });
    } catch (err) {
      console.warn('[SubscriptionService] Could not log invoice in audit_log:', err.message);
    }

    return {
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
      notes,
      recordedBy,
      paidAt: status === 'PAID' ? new Date() : null
    };
  }
}

module.exports = new SubscriptionService();
