const crypto = require('crypto');
const { db, schema } = require('../db/client');
const { eq, and } = require('drizzle-orm');
const { tables, tables_assignment } = schema;
const { logAudit } = require('./AuditService');
const WaiterAssignmentService = require('./waiterAssignmentService');

/**
 * Waiter and Table Assignment Service using Drizzle ORM & PostgreSQL
 * Integrates with WaiterAssignmentService for unified manual, dynamic, and hybrid logic.
 */
class TableAssignmentService {
  /**
   * Manual Assignment by an Administrator or Manager
   */
  async assignWaiterManually({ restaurantId, tableId, staffId, actorId, options = {} }) {
    return await WaiterAssignmentService.assignTableWaiter(
      restaurantId,
      tableId,
      staffId,
      actorId,
      { assignmentType: 'MANUAL', allowOffDutyOverride: true, ...options }
    );
  }

  /**
   * Release active assignment for a table
   */
  async releaseAssignment({ restaurantId, tableId, actorId }) {
    return await WaiterAssignmentService.assignTableWaiter(
      restaurantId,
      tableId,
      null,
      actorId,
      { reason: 'Table assignment released' }
    );
  }

  /**
   * Dynamic Assignment with deterministic tie-breaking
   */
  async assignWaiterDynamic({ restaurantId, tableId, actorId = 'SYSTEM' }) {
    // Check if table already has an active assignment
    const [currentAssignment] = await db.select().from(tables_assignment).where(
      and(
        eq(tables_assignment.table_id, tableId),
        eq(tables_assignment.assignment_status, 'ASSIGNED')
      )
    ).limit(1);

    if (currentAssignment) {
      return { assignment: currentAssignment, reused: true };
    }

    const [tableRow] = await db.select().from(tables).where(eq(tables.id, tableId)).limit(1);
    const res = await WaiterAssignmentService.assignWaiterForOrder(null, restaurantId, tableRow);

    const [newAssignment] = await db.select().from(tables_assignment).where(
      and(
        eq(tables_assignment.table_id, tableId),
        eq(tables_assignment.assignment_status, 'ASSIGNED')
      )
    ).limit(1);

    return {
      assignment: newAssignment || {
        staff_id: res.assignedWaiterId,
        assignment_type: res.assignmentType,
        assignment_status: res.assignmentStatus
      },
      reused: false
    };
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
