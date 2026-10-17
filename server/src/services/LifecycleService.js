const { db, schema } = require('../db/client');
const { eq, and, sql } = require('drizzle-orm');
const { restaurants, users, plans, tables } = schema;
const { logAudit } = require('./AuditService');

/**
 * Service to manage Restaurant & User Lifecycle Rules
 */
class LifecycleService {
  /**
   * Pause a restaurant:
   * Sets restaurant_status to 'PAUSED', deactivates all active users,
   * and increments sessionVersion to invalidate existing sessions.
   */
  async pauseRestaurant(restaurantId, actorId = null) {
    return await db.transaction(async (tx) => {
      // 1. Update restaurant status
      const [rest] = await tx.update(restaurants)
        .set({
          restaurant_status: 'PAUSED',
          updatedat: new Date()
        })
        .where(eq(restaurants.id, restaurantId))
        .returning();

      if (!rest) throw new Error('Restaurant not found');

      // 2. Deactivate users and increment sessionVersion
      await tx.update(users)
        .set({
          user_status: 'INACTIVE',
          sessionVersion: sql`${users.sessionVersion} + 1`,
          updatedat: new Date()
        })
        .where(
          and(
            eq(users.restaurant_id, restaurantId),
            eq(users.is_deleted, false)
          )
        );

      // 3. Audit log
      await logAudit({
        restaurant_id: restaurantId,
        user_id: actorId,
        action: 'RESTAURANT_PAUSED',
        entity_type: 'RESTAURANT',
        entity_id: restaurantId,
        details: { previousStatus: rest.restaurant_status, newStatus: 'PAUSED' }
      }, tx);

      return rest;
    });
  }

  /**
   * Deactivate/Deactivate to INACTIVE a restaurant:
   * Sets restaurant_status to 'INACTIVE', deactivates users and invalidates sessions.
   */
  async deactivateRestaurant(restaurantId, actorId = null) {
    return await db.transaction(async (tx) => {
      const [rest] = await tx.update(restaurants)
        .set({
          restaurant_status: 'INACTIVE',
          updatedat: new Date()
        })
        .where(eq(restaurants.id, restaurantId))
        .returning();

      if (!rest) throw new Error('Restaurant not found');

      await tx.update(users)
        .set({
          user_status: 'INACTIVE',
          sessionVersion: sql`${users.sessionVersion} + 1`,
          updatedat: new Date()
        })
        .where(
          and(
            eq(users.restaurant_id, restaurantId),
            eq(users.is_deleted, false)
          )
        );

      await logAudit({
        restaurant_id: restaurantId,
        user_id: actorId,
        action: 'RESTAURANT_DEACTIVATED',
        entity_type: 'RESTAURANT',
        entity_id: restaurantId,
        details: { newStatus: 'INACTIVE' }
      }, tx);

      return rest;
    });
  }

  /**
   * Reactivate a restaurant:
   * Sets restaurant_status to 'ACTIVE'.
   * Automatically activates only eligible ADMIN users.
   * Other users (STAFF) remain INACTIVE until an administrator explicitly enables them.
   */
  async reactivateRestaurant(restaurantId, actorId = null) {
    return await db.transaction(async (tx) => {
      const [rest] = await tx.update(restaurants)
        .set({
          restaurant_status: 'ACTIVE',
          updatedat: new Date()
        })
        .where(eq(restaurants.id, restaurantId))
        .returning();

      if (!rest) throw new Error('Restaurant not found');

      // Automatically activate only eligible ADMIN users
      await tx.update(users)
        .set({
          user_status: 'ACTIVE',
          sessionVersion: sql`${users.sessionVersion} + 1`,
          updatedat: new Date()
        })
        .where(
          and(
            eq(users.restaurant_id, restaurantId),
            eq(users.user_type, 'ADMIN'),
            eq(users.is_deleted, false)
          )
        );

      await logAudit({
        restaurant_id: restaurantId,
        user_id: actorId,
        action: 'RESTAURANT_REACTIVATED',
        entity_type: 'RESTAURANT',
        entity_id: restaurantId,
        details: { newStatus: 'ACTIVE', note: 'Only ADMIN accounts auto-activated' }
      }, tx);

      return rest;
    });
  }

  /**
   * Deactivate or soft-delete a user:
   * Increments sessionVersion to immediately invalidate existing JWT tokens.
   */
  async deactivateUser(userId, actorId = null) {
    return await db.transaction(async (tx) => {
      const [u] = await tx.update(users)
        .set({
          user_status: 'INACTIVE',
          sessionVersion: sql`${users.sessionVersion} + 1`,
          updatedat: new Date()
        })
        .where(eq(users.id, userId))
        .returning();

      if (!u) throw new Error('User not found');

      await logAudit({
        restaurant_id: u.restaurant_id,
        user_id: actorId,
        action: 'USER_DEACTIVATED',
        entity_type: 'USER',
        entity_id: userId,
        details: { email: u.email }
      }, tx);

      return u;
    });
  }

  /**
   * Soft-delete a user:
   */
  async deleteUser(userId, actorId = null) {
    return await db.transaction(async (tx) => {
      const [u] = await tx.update(users)
        .set({
          is_deleted: true,
          user_status: 'INACTIVE',
          deletedat: new Date(),
          sessionVersion: sql`${users.sessionVersion} + 1`,
          updatedat: new Date()
        })
        .where(eq(users.id, userId))
        .returning();

      if (!u) throw new Error('User not found');

      await logAudit({
        restaurant_id: u.restaurant_id,
        user_id: actorId,
        action: 'USER_DELETED',
        entity_type: 'USER',
        entity_id: userId,
        details: { email: u.email }
      }, tx);

      return u;
    });
  }

  /**
   * Get effective plan configuration merging active plan with restaurant override:
   * effective_plan = active_plan.configuration merged with validated restaurant.overriden_plan
   */
  async getEffectivePlan(restaurantId) {
    const [rest] = await db.select().from(restaurants).where(eq(restaurants.id, restaurantId)).limit(1);
    if (!rest) throw new Error('Restaurant not found');

    let baseConfig = {};
    if (rest.plan_id) {
      const [p] = await db.select().from(plans).where(eq(plans.id, rest.plan_id)).limit(1);
      if (p && p.configuration) {
        baseConfig = p.configuration;
      }
    }

    const override = (rest.is_plan_overridden && rest.overriden_plan) ? rest.overriden_plan : {};
    
    // Deep merge limits and features
    const effectivePlan = {
      ...baseConfig,
      limits: {
        ...(baseConfig.limits || {}),
        ...(override.limits || {})
      },
      features: {
        ...(baseConfig.features || {}),
        ...(override.features || {})
      }
    };

    return {
      restaurant: rest,
      effectivePlan
    };
  }

  /**
   * Check table creation capacity against effective plan limits
   */
  async canCreateTable(restaurantId) {
    const { restaurant, effectivePlan } = await this.getEffectivePlan(restaurantId);
    if (restaurant.restaurant_status !== 'ACTIVE' || restaurant.is_deleted) {
      throw new Error('Restaurant is not active or is deleted');
    }

    const maxTables = effectivePlan.limits?.maxTables;
    if (maxTables === null || maxTables === undefined) {
      return true; // Unlimited
    }

    const [countRes] = await db.select({
      count: sql`count(*)`
    }).from(tables).where(
      and(
        eq(tables.restaurant_id, restaurantId),
        eq(tables.is_deleted, false)
      )
    );

    const currentCount = parseInt(countRes.count, 10);
    return currentCount < maxTables;
  }
}

module.exports = new LifecycleService();
