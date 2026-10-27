const { getPlan, PLANS, hasEntitlement, isAdsEnabledForPlan } = require('../config/plans');
const { db, schema } = require('../db/client');
const { eq, and, sql, isNull } = require('drizzle-orm');
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
    let storedPlan = null;
    if (restaurant.plan_id) {
      const [p] = await db.select().from(plans).where(eq(plans.id, restaurant.plan_id)).limit(1);
      if (p) {
        storedPlan = p;
        planConfig = getPlan(p.name) || getPlan(p.configuration?.planId) || PLANS.STARTER;
      }
    }

    // An explicit admin override names the effective plan (e.g. CUSTOM).
    if (restaurant.is_plan_overridden && restaurant.overriden_plan) {
      const overridePlan = getPlan(restaurant.overriden_plan);
      if (overridePlan) {
        planConfig = overridePlan;
        // Stored configuration belongs to the base plan; don't let it
        // overwrite entitlements of the overridden plan.
        storedPlan = null;
      }
    }

    // Merge stored plan configuration over the canonical config so admin
    // overrides work while newly added entitlements (e.g. showAds) still
    // resolve for plans seeded before the entitlement existed.
    const planLimits = {
      ...(planConfig.limits || {}),
      ...(storedPlan?.configuration?.limits || {})
    };
    const planFeatures = {
      ...(planConfig.features || {}),
      ...(storedPlan?.configuration?.features || {})
    };
    const showAds = planFeatures.showAds !== undefined
      ? planFeatures.showAds === true
      : isAdsEnabledForPlan(planConfig.planId);

    const now = new Date();
    const subStartDate = restaurant.subscription_start_date || restaurant.createdat;
    const periodEnd = restaurant.subscription_end_date 
      ? new Date(restaurant.subscription_end_date) 
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const msLeft = periodEnd.getTime() - now.getTime();
    const remainingDays = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));

    return {
      restaurantId: restaurant.id,
      subdomain: restaurant.domain,
      planId: planConfig.planId,
      billingCycle: 'monthly',
      status: (restaurant.restaurant_status === 'ACTIVE' && remainingDays > 0) ? 'active' : 'suspended',
      startDate: subStartDate,
      currentPeriodStart: subStartDate,
      currentPeriodEnd: periodEnd,
      nextBillingDate: periodEnd,
      remainingDays: remainingDays,
      pricePaise: planConfig.monthlyPricePaise || 0,
      limits: planLimits,
      features: planFeatures,
      showAds
    };
  }

  /**
   * Resolves whether platform ads/banners may be shown to customers of a
   * restaurant. Custom/Enterprise plans are ad-free (showAds: false);
   * Starter, Growth and Business are ad-supported.
   * Unknown restaurants fail open to preserve existing banner behaviour.
   */
  async areAdsEnabledForRestaurant(restaurantId = null, subdomain = null) {
    try {
      const subscription = await this.getSubscriptionForRestaurant(restaurantId, subdomain);
      if (!subscription) return true;
      return subscription.showAds !== false;
    } catch (err) {
      console.error('[SubscriptionService] Error resolving ads entitlement:', err.message);
      return true;
    }
  }

  /**
   * Gets current resource usage and plan limits for a restaurant.
   */
  async getUsageAndLimits(tenantDb, restaurantRegistry) {
    if (!restaurantRegistry) throw new Error('Restaurant registry not found');

    const restaurantId = restaurantRegistry.restaurantId || restaurantRegistry.id;
    let limits = null;
    let planName = 'Starter';
    let planId = 'STARTER';
    let features = {};

    // Fetch restaurant and active plan from PostgreSQL if restaurantId is provided
    if (restaurantId) {
      try {
        const [rest] = await db.select().from(restaurants).where(
          and(eq(restaurants.id, restaurantId), eq(restaurants.is_deleted, false))
        ).limit(1);

        if (rest) {
          if (rest.plan_id) {
            const [dbPlan] = await db.select().from(plans).where(eq(plans.id, rest.plan_id)).limit(1);
            if (dbPlan) {
              const canonicalPlan = getPlan(dbPlan.name) || getPlan(dbPlan.configuration?.planId);
              planName = dbPlan.name;
              planId = canonicalPlan?.planId || (dbPlan.name || 'STARTER').toUpperCase();
              // Canonical config first, then stored overrides, so entitlements
              // added after a plan row was seeded still resolve.
              limits = {
                ...(canonicalPlan?.limits || {}),
                ...(dbPlan.configuration?.limits || {})
              };
              features = {
                ...(canonicalPlan?.features || {}),
                ...(dbPlan.configuration?.features || {})
              };
            }
          }
          if (!limits) {
            const rawPlan = rest.overriden_plan || rest.plan_id || restaurantRegistry.selectedPlan || 'STARTER';
            const p = getPlan(rawPlan) || PLANS.STARTER;
            planName = p.name;
            planId = p.planId;
            limits = { ...p.limits };
            features = { ...p.features };
          }
          if (rest.is_plan_overridden && rest.overriden_plan && typeof rest.overriden_plan === 'object') {
            limits = { ...(limits || {}), ...(rest.overriden_plan.limits || {}) };
            features = { ...(features || {}), ...(rest.overriden_plan.features || {}) };
          }
        }
      } catch (err) {
        console.error('[SubscriptionService] Error resolving restaurant plan:', err.message);
      }
    }

    if (!limits) {
      const rawPlan = restaurantRegistry.selectedPlan || restaurantRegistry.plan_id || 'STARTER';
      const p = getPlan(rawPlan) || PLANS.STARTER;
      planName = p.name;
      planId = p.planId;
      limits = { ...p.limits };
      features = { ...p.features };
    }

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
            and(eq(menu_categories_items.restaurant_id, restaurantId), isNull(menu_categories_items.deletedat))
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

    const maxLocations = limits.maxLocations ?? null;
    const maxTables = limits.maxTables ?? null;
    const maxMenuItems = limits.maxMenuItems ?? null;
    const maxStaffAccounts = limits.maxStaffAccounts ?? limits.maxStaff ?? null;

    return {
      planId,
      planName,
      limits: {
        ...limits,
        maxLocations,
        maxTables,
        maxMenuItems,
        maxStaffAccounts
      },
      features,
      usage: {
        locations: locationCount,
        tables: tableCount,
        menuItems: menuItemCount,
        staffAccounts: staffCount
      },
      capacityRemaining: {
        locations: maxLocations === null ? null : Math.max(0, maxLocations - locationCount),
        tables: maxTables === null ? null : Math.max(0, maxTables - tableCount),
        menuItems: maxMenuItems === null ? null : Math.max(0, maxMenuItems - menuItemCount),
        staffAccounts: maxStaffAccounts === null ? null : Math.max(0, maxStaffAccounts - staffCount)
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
      if (limits.maxTables !== null && limits.maxTables !== undefined && (usage.tables + additionalUnits) > limits.maxTables) {
        const error = new Error('Your tables limit reached. Contact admin.');
        error.status = 403;
        error.code = 'LIMIT_EXCEEDED';
        error.details = { resource: 'tables', current: usage.tables, limit: limits.maxTables };
        throw error;
      }
    } else if (resourceType === 'menuItems') {
      if (limits.maxMenuItems !== null && limits.maxMenuItems !== undefined && (usage.menuItems + additionalUnits) > limits.maxMenuItems) {
        const error = new Error('Your menu items limit reached. Contact admin.');
        error.status = 403;
        error.code = 'LIMIT_EXCEEDED';
        error.details = { resource: 'menuItems', current: usage.menuItems, limit: limits.maxMenuItems };
        throw error;
      }
    } else if (resourceType === 'staff') {
      const maxStaff = limits.maxStaffAccounts ?? limits.maxStaff;
      if (maxStaff !== null && maxStaff !== undefined && (usage.staffAccounts + additionalUnits) > maxStaff) {
        const error = new Error('Your staff accounts limit reached. Contact admin.');
        error.status = 403;
        error.code = 'LIMIT_EXCEEDED';
        error.details = { resource: 'staff', current: usage.staffAccounts, limit: maxStaff };
        throw error;
      }
    } else if (resourceType === 'locations') {
      if (limits.maxLocations !== null && limits.maxLocations !== undefined && (usage.locations + additionalUnits) > limits.maxLocations) {
        const error = new Error('Your locations limit reached. Contact admin.');
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
