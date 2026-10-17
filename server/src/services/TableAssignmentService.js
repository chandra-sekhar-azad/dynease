const crypto = require('crypto');
const { db, schema } = require('../db/client');
const { eq, and, sql } = require('drizzle-orm');
const { tables, tables_assignment, users, restaurants } = schema;
const { logAudit } = require('./AuditService');

/**
 * Waiter and Table Assignment Service using Drizzle ORM & PostgreSQL
 */
class TableAssignmentService {
  /**
   * Manual Assignment by an Administrator
   */
  async assignWaiterManually({ restaurantId, tableId, staffId, actorId }) {
    return await db.transaction(async (tx) => {
      // 1. Verify restaurant and staff
      const [staff] = await tx.select().from(users).where(
        and(
          eq(users.id, staffId),
          eq(users.restaurant_id, restaurantId),
          eq(users.user_status, 'ACTIVE'),
          eq(users.is_deleted, false)
        )
      ).limit(1);

      if (!staff) {
        throw new Error('Staff member not found, inactive or not belonging to this restaurant.');
      }

      // 2. Release any currently active assignment for this table
      await tx.update(tables_assignment)
        .set({
          assignment_status: 'COMPLETED',
          released_at: new Date(),
          updatedat: new Date()
        })
        .where(
          and(
            eq(tables_assignment.table_id, tableId),
            eq(tables_assignment.assignment_status, 'ASSIGNED')
          )
        );

      // 3. Create new assignment history record
      const assignmentId = crypto.randomUUID();
      const [assignment] = await tx.insert(tables_assignment).values({
        id: assignmentId,
        restaurant_id: restaurantId,
        table_id: tableId,
        staff_id: staffId,
        assignment_type: 'MANUAL',
        assigned_by: actorId,
        assignment_status: 'ASSIGNED',
        assigned_at: new Date()
      }).returning();

      // 4. Update table reference
      await tx.update(tables).set({
        updatedat: new Date()
      }).where(eq(tables.id, tableId));

      await logAudit({
        restaurant_id: restaurantId,
        user_id: actorId,
        action: 'TABLE_ASSIGNED_MANUAL',
        entity_type: 'TABLE_ASSIGNMENT',
        entity_id: assignmentId,
        details: { tableId, staffId }
      }, tx);

      return assignment;
    });
  }

  /**
   * Release active assignment for a table
   */
  async releaseAssignment({ restaurantId, tableId, actorId }) {
    return await db.transaction(async (tx) => {
      const updated = await tx.update(tables_assignment)
        .set({
          assignment_status: 'COMPLETED',
          released_at: new Date(),
          updatedat: new Date()
        })
        .where(
          and(
            eq(tables_assignment.restaurant_id, restaurantId),
            eq(tables_assignment.table_id, tableId),
            eq(tables_assignment.assignment_status, 'ASSIGNED')
          )
        ).returning();

      await logAudit({
        restaurant_id: restaurantId,
        user_id: actorId,
        action: 'TABLE_ASSIGNMENT_RELEASED',
        entity_type: 'TABLE',
        entity_id: tableId,
        details: { count: updated.length }
      }, tx);

      return updated;
    });
  }

  /**
   * Dynamic Assignment with deterministic tie-breaking:
   * Selects eligible active staff members belonging to the same restaurant.
   * Ranks by current active assignment count (lowest workload), then by creation date.
   */
  async assignWaiterDynamic({ restaurantId, tableId, actorId = 'SYSTEM' }) {
    return await db.transaction(async (tx) => {
      // Check if table already has an active assignment
      const [currentAssignment] = await tx.select().from(tables_assignment).where(
        and(
          eq(tables_assignment.table_id, tableId),
          eq(tables_assignment.assignment_status, 'ASSIGNED')
        )
      ).limit(1);

      if (currentAssignment) {
        return { assignment: currentAssignment, reused: true };
      }

      // Fetch eligible active staff
      const eligibleStaff = await tx.select().from(users).where(
        and(
          eq(users.restaurant_id, restaurantId),
          eq(users.user_status, 'ACTIVE'),
          eq(users.is_deleted, false)
        )
      );

      if (eligibleStaff.length === 0) {
        throw new Error('No eligible active staff members available for dynamic assignment.');
      }

      // Calculate active workload per staff member
      const staffWorkload = [];
      for (const st of eligibleStaff) {
        const [wRes] = await tx.select({
          count: sql`count(*)`
        }).from(tables_assignment).where(
          and(
            eq(tables_assignment.staff_id, st.id),
            eq(tables_assignment.assignment_status, 'ASSIGNED')
          )
        );
        staffWorkload.push({
          staff: st,
          activeCount: parseInt(wRes.count, 10)
        });
      }

      // Sort by workload ASC, then tie-break deterministically by staff ID
      staffWorkload.sort((a, b) => {
        if (a.activeCount !== b.activeCount) {
          return a.activeCount - b.activeCount;
        }
        return a.staff.id.localeCompare(b.staff.id);
      });

      const selectedStaff = staffWorkload[0].staff;

      // Create dynamic assignment record
      const assignmentId = crypto.randomUUID();
      const [newAssignment] = await tx.insert(tables_assignment).values({
        id: assignmentId,
        restaurant_id: restaurantId,
        table_id: tableId,
        staff_id: selectedStaff.id,
        assignment_type: 'DYNAMIC',
        assigned_by: actorId,
        assignment_status: 'ASSIGNED',
        assigned_at: new Date()
      }).returning();

      await logAudit({
        restaurant_id: restaurantId,
        user_id: actorId,
        action: 'TABLE_ASSIGNED_DYNAMIC',
        entity_type: 'TABLE_ASSIGNMENT',
        entity_id: assignmentId,
        details: { tableId, staffId: selectedStaff.id, workload: staffWorkload[0].activeCount }
      }, tx);

      return { assignment: newAssignment, reused: false };
    });
  }

  /**
   * Regenerate QR code for a table with authorization and validation
   */
  async regenerateQrToken(restaurantId, tableId, actorId) {
    return await db.transaction(async (tx) => {
      const newToken = 'qr_' + crypto.randomBytes(16).toString('hex');
      const [updated] = await tx.update(tables)
        .set({
          qr_token: newToken,
          updatedat: new Date()
        })
        .where(
          and(
            eq(tables.id, tableId),
            eq(tables.restaurant_id, restaurantId),
            eq(tables.is_deleted, false)
          )
        ).returning();

      if (!updated) {
        throw new Error('Table not found or is deleted.');
      }

      await logAudit({
        restaurant_id: restaurantId,
        user_id: actorId,
        action: 'TABLE_QR_REGENERATED',
        entity_type: 'TABLE',
        entity_id: tableId,
        details: { oldTokenPreserved: false }
      }, tx);

      return updated;
    });
  }
}

module.exports = new TableAssignmentService();
