const crypto = require('crypto');
const { db, schema } = require('../db/client');
const { eq, and, sql, isNull } = require('drizzle-orm');
const { tables, table_session, order_details, leads, restaurants, customer_orders } = schema;
const { logAudit } = require('./AuditService');
const { normalizePhoneNumber } = require('../utils/phone');

const COOKIE_NAME = 'dynease_table_session';

class CustomerSessionService {
  /**
   * Generates a 256-bit cryptographically secure random token (32 random bytes)
   * and computes its SHA-256 hash.
   * @returns {{ rawToken: string, tokenHash: string }}
   */
  generateToken() {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    return { rawToken, tokenHash };
  }

  /**
   * Computes SHA-256 hash of a raw token.
   * @param {string} rawToken
   * @returns {string} SHA-256 hex digest
   */
  hashToken(rawToken) {
    return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
  }

  /**
   * Set the secure HttpOnly cookie on the HTTP response.
   * @param {import('express').Response} res
   * @param {string} rawToken
   */
  setSessionCookie(res, rawToken) {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie(COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
      // No fixed maxAge: lifetime is tied to visit completion
    });
  }

  /**
   * Clears the session cookie on visit close or cancellation.
   * @param {import('express').Response} res
   */
  clearSessionCookie(res) {
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/'
    });
  }

  /**
   * Atomically checks table availability and allocates the table to a new visit.
   * Implements:
   * - Row-level locking on tables row
   * - Lead identification & reuse scoped to restaurant
   * - 256-bit random session token generation
   * - Visit record creation with NO_ORDER initial status
   * - Privacy preservation: never leaks occupant info
   */
  async allocateTableAndCreateSession({ restaurantId, tableId, rawPhone, customerName = 'Guest' }) {
    const normalizedPhone = normalizePhoneNumber(rawPhone);

    return await db.transaction(async (tx) => {
      // 1. Lock table row to prevent race conditions during concurrent scans
      const [table] = await tx.select().from(tables).where(
        and(
          eq(tables.id, tableId),
          eq(tables.restaurant_id, restaurantId),
          eq(tables.table_status, 'ACTIVE'),
          eq(tables.is_deleted, false)
        )
      ).for('update').limit(1);

      if (!table) {
        const err = new Error('This table is invalid or inactive.');
        err.code = 'INVALID_TABLE';
        err.status = 404;
        throw err;
      }

      // 2. Check if table currently has an active session
      const [existingActiveSession] = await tx.select().from(table_session).where(
        and(
          eq(table_session.table_id, tableId),
          eq(table_session.session_status, 'ACTIVE')
        )
      ).limit(1);

      // Check if table currently has an active visit
      const [existingActiveVisit] = await tx.select().from(order_details).where(
        and(
          eq(order_details.table_id, tableId),
          sql`${order_details.order_status} NOT IN ('COMPLETED', 'CANCELLED')`
        )
      ).limit(1);

      if (existingActiveSession || existingActiveVisit) {
        const err = new Error('This table is currently occupied. Please choose another table or contact a waiter.');
        err.code = 'TABLE_OCCUPIED';
        err.status = 409;
        throw err;
      }

      // 3. Lead identification & creation scoped to current restaurant
      // Enforce transaction-safe lookup/upsert using unique (restaurant_id, number)
      let leadId;
      const [existingLead] = await tx.select().from(leads).where(
        and(
          eq(leads.restaurant_id, restaurantId),
          eq(leads.number, normalizedPhone)
        )
      ).limit(1);

      if (existingLead) {
        leadId = existingLead.id;
        // Optionally update lead name if previously Guest and now provided
        if (customerName && customerName !== 'Guest' && (!existingLead.name || existingLead.name === 'Guest')) {
          await tx.update(leads)
            .set({ name: customerName, updatedat: new Date() })
            .where(eq(leads.id, existingLead.id));
        }
      } else {
        const [newLead] = await tx.insert(leads).values({
          restaurant_id: restaurantId,
          name: customerName || 'Guest',
          number: normalizedPhone,
          visits: 0
        }).onConflictDoUpdate({
          target: [leads.restaurant_id, leads.number],
          set: { updatedat: new Date() }
        }).returning();
        leadId = newLead.id;
      }

      // 4. Generate 256-bit cryptographically secure token & SHA-256 verifier
      const { rawToken, tokenHash } = this.generateToken();

      // 5. Create table_session record
      const [session] = await tx.insert(table_session).values({
        restaurant_id: restaurantId,
        table_id: tableId,
        lead_id: leadId,
        session_token: tokenHash,
        session_status: 'ACTIVE',
        session_start_time: new Date()
      }).returning();

      // 6. Create visit-level order_details record with initial status NO_ORDER
      const visitNumber = 'VISIT-' + Date.now().toString(36).toUpperCase();
      const [visit] = await tx.insert(order_details).values({
        restaurant_id: restaurantId,
        table_id: tableId,
        lead_id: leadId,
        session_id: session.id,
        order_status: 'NO_ORDER',
        app_status: 'PENDING',
        order_number: visitNumber,
        customer_name: customerName || 'Guest',
        customer_phone: normalizedPhone,
        total_amount: '0.00',
        tax_amount: '0.00',
        discount_amount: '0.00',
        final_amount: '0.00',
        payment_status: 'PENDING',
        payment_method: 'CASH'
      }).returning();

      // 7. Audit log entry
      await logAudit({
        restaurant_id: restaurantId,
        action: 'TABLE_ALLOCATED',
        entity_type: 'TABLE',
        entity_id: tableId,
        details: {
          tableNumber: table.table_code,
          visitId: visit.id,
          leadId,
          phone: normalizedPhone
        }
      }, tx);

      return {
        rawToken,
        session,
        visit,
        leadId,
        table
      };
    });
  }

  /**
   * Authenticates and resolves an active customer session by raw token.
   * @param {string} rawToken
   * @param {string} [claimedRestaurantId] - Optional check for tenant isolation
   */
  async findActiveSession(rawToken, claimedRestaurantId = null) {
    if (!rawToken || typeof rawToken !== 'string') return null;

    const tokenHash = this.hashToken(rawToken);

    // Look up active session
    const [session] = await db.select().from(table_session).where(
      and(
        eq(table_session.session_token, tokenHash),
        eq(table_session.session_status, 'ACTIVE')
      )
    ).limit(1);

    if (!session) return null;

    if (claimedRestaurantId && session.restaurant_id !== claimedRestaurantId) {
      return null;
    }

    // Look up active visit record
    const [visit] = await db.select().from(order_details).where(
      and(
        eq(order_details.session_id, session.id),
        sql`${order_details.order_status} NOT IN ('COMPLETED', 'CANCELLED')`
      )
    ).limit(1);

    if (!visit) return null;

    // Look up table
    const [table] = await db.select().from(tables).where(
      and(
        eq(tables.id, session.table_id),
        eq(tables.table_status, 'ACTIVE'),
        eq(tables.is_deleted, false)
      )
    ).limit(1);

    if (!table) return null;

    return {
      session,
      visit,
      table,
      restaurantId: session.restaurant_id,
      tableId: session.table_id,
      leadId: session.lead_id
    };
  }

  /**
   * Final visit completion: atomically marks visit COMPLETED, revokes token,
   * releases table, increments lead visits, and logs audit.
   */
  async completeVisit({ visitId, restaurantId, closedByUserId = null }) {
    return await db.transaction(async (tx) => {
      const [visit] = await tx.select().from(order_details).where(
        and(
          eq(order_details.id, visitId),
          eq(order_details.restaurant_id, restaurantId),
          sql`${order_details.order_status} NOT IN ('COMPLETED', 'CANCELLED')`
        )
      ).for('update').limit(1);

      if (!visit) {
        const err = new Error('Active visit not found.');
        err.status = 404;
        throw err;
      }

      // Mark visit COMPLETED and PAID
      const [updatedVisit] = await tx.update(order_details).set({
        order_status: 'COMPLETED',
        app_status: 'COMPLETED',
        payment_status: 'PAID',
        updatedat: new Date()
      }).where(eq(order_details.id, visitId)).returning();

      // Revoke session token immediately
      let revokedSession = null;
      if (visit.session_id) {
        const [sess] = await tx.update(table_session).set({
          session_status: 'COMPLETED',
          session_end_time: new Date(),
          closed_by: closedByUserId,
          updatedat: new Date()
        }).where(eq(table_session.id, visit.session_id)).returning();
        revokedSession = sess;
      }
      if (visit.table_id) {
        await tx.update(table_session).set({
          session_status: 'COMPLETED',
          session_end_time: new Date(),
          closed_by: closedByUserId,
          updatedat: new Date()
        }).where(
          and(
            eq(table_session.table_id, visit.table_id),
            eq(table_session.session_status, 'ACTIVE')
          )
        );
      }

      // Mark all orders under this visit as COMPLETED if still active
      await tx.update(customer_orders).set({
        order_status: 'COMPLETED',
        updatedat: new Date()
      }).where(
        and(
          eq(customer_orders.visit_id, visitId),
          sql`${customer_orders.order_status} NOT IN ('COMPLETED', 'CANCELLED')`
        )
      );

      // Increment completed visit count on lead
      if (visit.lead_id) {
        await tx.update(leads).set({
          visits: sql`${leads.visits} + 1`,
          updatedat: new Date()
        }).where(eq(leads.id, visit.lead_id));
      }

      // Audit log
      await logAudit({
        restaurant_id: restaurantId,
        user_id: closedByUserId,
        action: 'VISIT_COMPLETED',
        entity_type: 'ORDER',
        entity_id: visitId,
        details: {
          tableId: visit.table_id,
          leadId: visit.lead_id,
          finalAmount: updatedVisit.final_amount
        }
      }, tx);

      return {
        visit: updatedVisit,
        session: revokedSession,
        tableId: visit.table_id
      };
    });
  }

  /**
   * Waiter cancellation of an allocated table visit.
   * Atomically marks visit CANCELLED, revokes session, releases table.
   */
  async cancelAllocation({ tableId, visitId = null, restaurantId, cancelledByUserId = null, reason = 'Cancelled by waiter' }) {
    return await db.transaction(async (tx) => {
      // Find active visit on table if visitId not supplied
      let visit;
      if (visitId) {
        [visit] = await tx.select().from(order_details).where(
          and(
            eq(order_details.id, visitId),
            eq(order_details.restaurant_id, restaurantId),
            sql`${order_details.order_status} NOT IN ('COMPLETED', 'CANCELLED')`
          )
        ).for('update').limit(1);
      } else {
        [visit] = await tx.select().from(order_details).where(
          and(
            eq(order_details.table_id, tableId),
            eq(order_details.restaurant_id, restaurantId),
            sql`${order_details.order_status} NOT IN ('COMPLETED', 'CANCELLED')`
          )
        ).for('update').limit(1);
      }

      if (!visit) {
        // Still check and cancel table_session if orphaned
        await tx.update(table_session).set({
          session_status: 'CANCELLED',
          session_end_time: new Date(),
          closed_by: cancelledByUserId,
          updatedat: new Date()
        }).where(
          and(
            eq(table_session.table_id, tableId),
            eq(table_session.session_status, 'ACTIVE')
          )
        );

        return { cancelled: true, tableId };
      }

      // Mark visit CANCELLED
      const [updatedVisit] = await tx.update(order_details).set({
        order_status: 'CANCELLED',
        app_status: 'CANCELLED',
        updatedat: new Date()
      }).where(eq(order_details.id, visit.id)).returning();

      // Revoke session
      if (visit.session_id) {
        await tx.update(table_session).set({
          session_status: 'CANCELLED',
          session_end_time: new Date(),
          closed_by: cancelledByUserId,
          updatedat: new Date()
        }).where(eq(table_session.id, visit.session_id));
      }

      // Cancel any submitted orders
      await tx.update(customer_orders).set({
        order_status: 'CANCELLED',
        updatedat: new Date()
      }).where(eq(customer_orders.visit_id, visit.id));

      // Audit log
      await logAudit({
        restaurant_id: restaurantId,
        user_id: cancelledByUserId,
        action: 'ALLOCATION_CANCELLED',
        entity_type: 'TABLE',
        entity_id: tableId,
        details: {
          visitId: visit.id,
          reason
        }
      }, tx);

      return {
        visit: updatedVisit,
        tableId: visit.table_id
      };
    });
  }
}

module.exports = new CustomerSessionService();
