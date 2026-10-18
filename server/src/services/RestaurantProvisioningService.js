const { db, schema } = require('../db/client');
const { eq, and, sql } = require('drizzle-orm');
const { restaurants, users, plans } = schema;
const { getPlan } = require('../config/plans');
const { logAudit } = require('./AuditService');

class RestaurantProvisioningService {
  /**
   * Main idempotent workflow to provision a new restaurant from a registration
   * Uses the single shared Supabase PostgreSQL database via Drizzle ORM.
   */
  async provisionRestaurant(registration) {
    const subdomain = (registration.subdomain || '').toLowerCase().trim();
    console.log(`[Provisioning] Starting PostgreSQL provisioning for ${registration.restaurantName} (domain: ${subdomain})`);

    return await db.transaction(async (tx) => {
      // 1. Check if restaurant already exists by domain (case-insensitive)
      let [existingRestaurant] = await tx.select().from(restaurants).where(
        and(
          eq(sql`LOWER(${restaurants.domain})`, subdomain),
          eq(restaurants.is_deleted, false)
        )
      ).limit(1);

      let restaurantRecord;
      if (existingRestaurant) {
        // If already active, return existing
        if (existingRestaurant.restaurant_status === 'ACTIVE') {
          console.log(`[Provisioning] Restaurant already provisioned and active for ${subdomain}`);
          restaurantRecord = existingRestaurant;
        } else {
          // Update status to ACTIVE
          const [updated] = await tx.update(restaurants).set({
            restaurant_status: 'ACTIVE',
            updatedat: new Date()
          }).where(eq(restaurants.id, existingRestaurant.id)).returning();
          restaurantRecord = updated;
        }
      } else {
        // Resolve plan
        const canonicalPlan = getPlan(registration.selectedPlan) || getPlan('STARTER');
        let planId = null;
        if (canonicalPlan) {
          const [dbPlan] = await tx.select().from(plans).where(
            eq(sql`UPPER(${plans.name})`, canonicalPlan.planId.toUpperCase())
          ).limit(1);
          if (dbPlan) planId = dbPlan.id;
        }

        // Create new restaurant record in PostgreSQL
        const [newRest] = await tx.insert(restaurants).values({
          name: registration.restaurantName,
          restaurant_name: registration.restaurantName,
          domain: subdomain,
          phone_number: registration.ownerPhone || null,
          restaurant_status: 'ACTIVE',
          plan_id: planId,
          table_allocation_mode: 'MANUAL',
          is_deleted: false
        }).returning();
        restaurantRecord = newRest;
      }

      // 2. Create or update the owner account in users table
      const ownerEmail = (registration.ownerEmail || `${subdomain}@temp.com`).toLowerCase().trim();
      const [existingUser] = await tx.select().from(users).where(
        and(
          eq(sql`LOWER(${users.email})`, ownerEmail),
          eq(users.is_deleted, false)
        )
      ).limit(1);

      let ownerRecord;
      if (existingUser) {
        const [updatedUser] = await tx.update(users).set({
          restaurant_id: restaurantRecord.id,
          user_type: 'ADMIN',
          user_status: 'ACTIVE',
          phone_number: registration.ownerPhone || existingUser.phone_number,
          updatedat: new Date()
        }).where(eq(users.id, existingUser.id)).returning();
        ownerRecord = updatedUser;
      } else {
        const [newUser] = await tx.insert(users).values({
          name: registration.ownerName || 'Restaurant Owner',
          email: ownerEmail,
          phone_number: registration.ownerPhone || null,
          password_hash: registration.ownerPassword, // Already hashed
          restaurant_id: restaurantRecord.id,
          user_type: 'ADMIN',
          user_status: 'ACTIVE',
          sessionVersion: 0,
          is_deleted: false
        }).returning();
        ownerRecord = newUser;
      }

      await logAudit({
        restaurant_id: restaurantRecord.id,
        user_id: ownerRecord.id,
        action: 'RESTAURANT_PROVISIONED',
        entity_type: 'RESTAURANT',
        entity_id: restaurantRecord.id,
        details: { subdomain, ownerEmail }
      }, tx).catch(() => {});

      console.log(`[Provisioning] Successfully provisioned ${registration.restaurantName} in PostgreSQL`);

      return {
        id: restaurantRecord.id,
        _id: restaurantRecord.id,
        restaurantId: restaurantRecord.id,
        restaurantName: restaurantRecord.name,
        name: restaurantRecord.name,
        subdomain: restaurantRecord.domain,
        slug: restaurantRecord.domain,
        domain: restaurantRecord.domain,
        status: restaurantRecord.restaurant_status,
        ownerEmail,
        ownerName: registration.ownerName,
        ownerPhone: registration.ownerPhone
        // NOTE: no databaseProvisioned flags — restaurants share one database/schema.
      };
    });
  }
}

module.exports = new RestaurantProvisioningService();
