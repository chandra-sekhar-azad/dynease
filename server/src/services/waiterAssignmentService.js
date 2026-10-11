/**
 * Waiter Assignment Service
 * Implements Workload-Aware Automatic and Hybrid Waiter Selection,
 * Score Calculations, Table Ownership Preservation, and Event Logging.
 */

/**
 * Normalization & Scoring Method Documentation:
 * 
 * 1. Normalized Workload:
 *    actualWorkload = activeOrdersCount + activeServiceRequestsCount
 *    normalizedWorkload = Math.min(actualWorkload / maxCapacity, 1.0)
 *    Scaled strictly between [0.0, 1.0] where 0 means completely idle and 1.0 means at or exceeding capacity.
 * 
 * 2. Recent Assignment Penalty:
 *    If waiter was assigned within recent window (e.g. 15 minutes = 900,000ms):
 *    recentAssignmentPenalty = Math.max(0, 1.0 - (now - lastAssignedAt) / 900000)
 *    Scaled between [0.0, 1.0] where 1.0 means just assigned, decaying linearly to 0.0 after 15 minutes.
 * 
 * 3. Section Mismatch Penalty:
 *    0.0 if waiter's sections include target table's section or if waiter has no section restrictions.
 *    1.0 if waiter has assigned sections that do not match the table's section.
 * 
 * Score Formula:
 *    assignmentScore = 
 *      (weightWorkload * normalizedWorkload) +
 *      (weightRecentAssignment * recentAssignmentPenalty) +
 *      (weightSectionMismatch * sectionMismatchPenalty)
 * 
 * Lower scores are preferred. Ties are broken by longest idle time (earliest lastAssignedAt or createdAt).
 */

class WaiterAssignmentService {
  /**
   * Get restaurant assignment settings with fallbacks
   */
  static async getSettings(tenantDb, restaurantId) {
    const RestaurantProfile = tenantDb.model('RestaurantProfile');
    const profile = await RestaurantProfile.findOne({ restaurantId });
    const defaults = {
      mode: 'HYBRID',
      defaultCapacity: 5,
      weightWorkload: 0.60,
      weightRecentAssignment: 0.25,
      weightSectionMismatch: 0.15,
      allowOverflow: true,
      acceptanceTimeoutMinutes: 3,
      reassignmentPolicy: 'AUTO_REASSIGN'
    };
    return { ...defaults, ...(profile?.assignmentSettings || {}) };
  }

  /**
   * Calculate live workload for a specific waiter
   * (Live pending/in-progress orders + unresolved service requests)
   */
  static async getWaiterWorkload(tenantDb, restaurantId, waiterId) {
    const Order = tenantDb.model('Order');
    const ServiceRequest = tenantDb.model('ServiceRequest');

    const [activeOrdersCount, activeRequestsCount] = await Promise.all([
      Order.countDocuments({
        restaurantId,
        assignedWaiterId: waiterId,
        status: { $nin: ['COMPLETED', 'CANCELLED', 'PAID'] }
      }),
      ServiceRequest.countDocuments({
        restaurantId,
        assignedWaiterId: waiterId,
        status: { $nin: ['RESOLVED', 'CANCELLED'] }
      })
    ]);

    return {
      activeOrdersCount,
      activeRequestsCount,
      totalWorkload: activeOrdersCount + activeRequestsCount
    };
  }

  /**
   * Find and rank all eligible waiters for a table/order
   */
  static async findEligibleWaiters(tenantDb, restaurantId, table, settings, options = {}) {
    const User = tenantDb.model('User');
    const { bypassCapacity = false } = options;

    // Step A: Filter waiters who belong to restaurant, active, on shift, accepting orders, not paused
    const waiters = await User.find({
      restaurantId,
      role: 'RESTAURANT_STAFF',
      isActive: true,
      shiftStatus: 'ON_SHIFT',
      acceptingOrders: true,
      availabilityStatus: { $ne: 'PAUSED' }
    });

    if (!waiters || waiters.length === 0) {
      return [];
    }

    const scoredWaiters = [];
    const now = Date.now();
    const RECENT_WINDOW_MS = 15 * 60 * 1000; // 15 mins

    for (const waiter of waiters) {
      const capacity = waiter.workloadCapacity || settings.defaultCapacity || 5;
      const { totalWorkload, activeOrdersCount, activeRequestsCount } = await this.getWaiterWorkload(
        tenantDb,
        restaurantId,
        waiter._id
      );

      // Check remaining capacity unless bypass is allowed
      const hasRemainingCapacity = totalWorkload < capacity;
      if (!hasRemainingCapacity && !settings.allowOverflow && !bypassCapacity) {
        continue;
      }

      // Step B & C: Compute Normalized Score
      const normalizedWorkload = Math.min(totalWorkload / capacity, 1.0);

      let recentPenalty = 0;
      if (waiter.lastAssignedAt) {
        const timeSince = now - new Date(waiter.lastAssignedAt).getTime();
        if (timeSince < RECENT_WINDOW_MS) {
          recentPenalty = Math.max(0, 1.0 - timeSince / RECENT_WINDOW_MS);
        }
      }

      let sectionPenalty = 0;
      if (waiter.sections && waiter.sections.length > 0 && table?.section) {
        const hasSection = waiter.sections.some(
          s => s.toLowerCase() === table.section.toLowerCase()
        );
        if (!hasSection) {
          sectionPenalty = 1.0;
        }
      }

      const score = (
        (settings.weightWorkload * normalizedWorkload) +
        (settings.weightRecentAssignment * recentPenalty) +
        (settings.weightSectionMismatch * sectionPenalty)
      );

      scoredWaiters.push({
        waiter,
        score,
        totalWorkload,
        capacity,
        activeOrdersCount,
        activeRequestsCount,
        normalizedWorkload,
        recentPenalty,
        sectionPenalty,
        idleTime: waiter.lastAssignedAt ? now - new Date(waiter.lastAssignedAt).getTime() : Infinity
      });
    }

    // Rank: lower score first. Tie-breaker: longer idle time (larger idleTime value)
    scoredWaiters.sort((a, b) => {
      const diff = a.score - b.score;
      if (Math.abs(diff) > 0.001) {
        return diff;
      }
      return b.idleTime - a.idleTime;
    });

    return scoredWaiters;
  }

  /**
   * Determine responsible waiter for a new Order or Table Assignment
   */
  static async assignWaiterForOrder(tenantDb, restaurantId, table, orderId = null) {
    const settings = await this.getSettings(tenantDb, restaurantId);
    const mode = settings.mode || 'HYBRID';
    const now = new Date();
    const timeoutAt = new Date(now.getTime() + (settings.acceptanceTimeoutMinutes || 3) * 60000);

    let assignedWaiterId = null;
    let assignmentType = 'PRIMARY';
    let assignmentScore = null;
    let scoreDetails = null;
    let reason = '';

    // Check Step D: Hybrid Mode preserves primary waiter ownership if eligible
    if (mode === 'HYBRID' || mode === 'MANUAL') {
      if (table.primaryWaiterId) {
        const User = tenantDb.model('User');
        const primaryWaiter = await User.findOne({
          _id: table.primaryWaiterId,
          restaurantId,
          role: 'RESTAURANT_STAFF',
          isActive: true
        });

        if (
          primaryWaiter &&
          primaryWaiter.shiftStatus === 'ON_SHIFT' &&
          primaryWaiter.acceptingOrders &&
          primaryWaiter.availabilityStatus !== 'PAUSED'
        ) {
          const capacity = primaryWaiter.workloadCapacity || settings.defaultCapacity || 5;
          const { totalWorkload } = await this.getWaiterWorkload(tenantDb, restaurantId, primaryWaiter._id);

          if (totalWorkload < capacity || mode === 'MANUAL') {
            assignedWaiterId = primaryWaiter._id;
            assignmentType = 'PRIMARY';
            reason = 'Routed to primary table waiter (eligible & within capacity)';
          } else if (settings.allowOverflow) {
            // Overloaded: route to best available alternative
            reason = `Primary waiter (${primaryWaiter.name}) overloaded (${totalWorkload}/${capacity}); seeking overflow waiter`;
          } else {
            assignedWaiterId = primaryWaiter._id;
            assignmentType = 'PRIMARY';
            reason = 'Assigned to primary waiter (overflow disabled)';
          }
        } else {
          reason = 'Primary waiter off-shift, paused, or unavailable; selecting alternative';
        }
      }
    }

    // If not assigned by primary owner check, run selection algorithm
    if (!assignedWaiterId && mode !== 'MANUAL') {
      const candidates = await this.findEligibleWaiters(tenantDb, restaurantId, table, settings);

      if (candidates.length > 0) {
        const best = candidates[0];
        assignedWaiterId = best.waiter._id;
        assignmentType = table.primaryWaiterId ? 'OVERFLOW' : 'PRIMARY';
        assignmentScore = parseFloat(best.score.toFixed(4));
        scoreDetails = {
          score: best.score,
          workload: best.totalWorkload,
          capacity: best.capacity,
          normalizedWorkload: best.normalizedWorkload,
          recentPenalty: best.recentPenalty,
          sectionPenalty: best.sectionPenalty
        };
        reason = assignmentType === 'OVERFLOW'
          ? `Overflow assignment to ${best.waiter.name} (score: ${assignmentScore})`
          : `Automatic assignment to ${best.waiter.name} (score: ${assignmentScore})`;

        // If table doesn't have a primary waiter, set this best waiter as table's primary
        if (!table.primaryWaiterId) {
          const Table = tenantDb.model('Table');
          await Table.findByIdAndUpdate(table._id, {
            primaryWaiterId: best.waiter._id,
            assignmentMode: 'AUTOMATIC',
            assignedAt: now,
            assignmentStatus: 'ASSIGNED'
          });
          table.primaryWaiterId = best.waiter._id;
        }
      } else {
        // Step E: No eligible waiters
        assignedWaiterId = null;
        assignmentType = 'UNASSIGNED';
        reason = 'No eligible waiters available (all off-shift, paused, or at capacity)';
      }
    } else if (!assignedWaiterId && mode === 'MANUAL') {
      assignmentType = 'UNASSIGNED';
      reason = 'Manual mode: No primary waiter assigned to this table';
    }

    // If we have an assigned waiter, update their lastAssignedAt timestamp
    if (assignedWaiterId) {
      const User = tenantDb.model('User');
      await User.findByIdAndUpdate(assignedWaiterId, { lastAssignedAt: now });
    }

    // Log Assignment Event
    if (orderId) {
      const AssignmentEvent = tenantDb.model('AssignmentEvent');
      await AssignmentEvent.create({
        restaurantId,
        targetType: 'ORDER',
        targetId: orderId,
        tableId: table._id,
        tableNumber: table.tableNumber,
        newWaiterId: assignedWaiterId,
        assignmentMode: mode,
        action: assignedWaiterId ? (assignmentType === 'OVERFLOW' ? 'OVERFLOW_ASSIGNED' : 'ASSIGNED') : 'UNASSIGNED',
        score: assignmentScore,
        scoreDetails,
        reason,
        actorRole: 'SYSTEM'
      }).catch(err => console.error('Failed to log assignment event:', err));
    }

    return {
      assignedWaiterId,
      assignmentType,
      assignmentStatus: assignedWaiterId ? 'PENDING_ACCEPTANCE' : 'UNASSIGNED',
      assignedAt: assignedWaiterId ? now : null,
      assignmentTimeoutAt: assignedWaiterId ? timeoutAt : null,
      reason
    };
  }

  /**
   * Handle Waiter Order Acceptance
   */
  static async acceptOrder(tenantDb, restaurantId, orderId, waiterId) {
    const Order = tenantDb.model('Order');
    const AssignmentEvent = tenantDb.model('AssignmentEvent');

    const order = await Order.findOne({ _id: orderId, restaurantId });
    if (!order) throw new Error('Order not found');

    if (order.assignedWaiterId && order.assignedWaiterId.toString() !== waiterId.toString()) {
      throw new Error('This order is assigned to another waiter');
    }

    order.assignmentStatus = 'ACCEPTED';
    order.acceptedAt = new Date();
    order.isReadByWaiter = true;
    if (order.status === 'PENDING') {
      order.status = 'READ';
    }
    await order.save();

    await AssignmentEvent.create({
      restaurantId,
      targetType: 'ORDER',
      targetId: order._id,
      tableId: order.tableId,
      tableNumber: order.tableNumber,
      newWaiterId: waiterId,
      assignmentMode: 'MANUAL',
      action: 'ACCEPTED',
      actorId: waiterId,
      actorRole: 'WAITER',
      reason: 'Order accepted by assigned waiter'
    }).catch(err => console.error(err));

    return order;
  }

  /**
   * Handle Waiter Order Rejection
   */
  static async rejectOrder(tenantDb, restaurantId, orderId, waiterId, reason = 'Busy') {
    const Order = tenantDb.model('Order');
    const Table = tenantDb.model('Table');
    const AssignmentEvent = tenantDb.model('AssignmentEvent');

    const order = await Order.findOne({ _id: orderId, restaurantId });
    if (!order) throw new Error('Order not found');

    const previousWaiterId = order.assignedWaiterId;
    order.assignmentStatus = 'REJECTED';
    order.rejectionReason = reason;
    await order.save();

    await AssignmentEvent.create({
      restaurantId,
      targetType: 'ORDER',
      targetId: order._id,
      tableId: order.tableId,
      tableNumber: order.tableNumber,
      previousWaiterId,
      assignmentMode: 'MANUAL',
      action: 'REJECTED',
      actorId: waiterId,
      actorRole: 'WAITER',
      reason: `Rejected by waiter: ${reason}`
    }).catch(err => console.error(err));

    // Attempt automatic reassignment to next eligible waiter
    const table = await Table.findById(order.tableId);
    const settings = await this.getSettings(tenantDb, restaurantId);

    if (settings.reassignmentPolicy === 'AUTO_REASSIGN') {
      const candidates = await this.findEligibleWaiters(tenantDb, restaurantId, table, settings);
      // Exclude rejecting waiter
      const alternative = candidates.find(c => c.waiter._id.toString() !== waiterId.toString());

      if (alternative) {
        const now = new Date();
        const timeoutAt = new Date(now.getTime() + (settings.acceptanceTimeoutMinutes || 3) * 60000);

        order.assignedWaiterId = alternative.waiter._id;
        order.assignmentType = 'OVERFLOW';
        order.assignmentStatus = 'PENDING_ACCEPTANCE';
        order.assignedAt = now;
        order.assignmentTimeoutAt = timeoutAt;
        await order.save();

        const User = tenantDb.model('User');
        await User.findByIdAndUpdate(alternative.waiter._id, { lastAssignedAt: now });

        await AssignmentEvent.create({
          restaurantId,
          targetType: 'ORDER',
          targetId: order._id,
          tableId: order.tableId,
          tableNumber: order.tableNumber,
          previousWaiterId,
          newWaiterId: alternative.waiter._id,
          assignmentMode: 'AUTOMATIC',
          action: 'REASSIGNED',
          actorRole: 'SYSTEM',
          reason: `Auto-reassigned after rejection by previous waiter`
        }).catch(err => console.error(err));

        return { order, reassignedTo: alternative.waiter };
      }
    }

    // Fallback: Escalated / Unassigned
    order.assignmentStatus = 'UNASSIGNED';
    order.assignedWaiterId = null;
    await order.save();

    return { order, reassignedTo: null, escalated: true };
  }

  /**
   * Check and Reassign Timed Out Orders (CRON or on-demand worker)
   */
  static async checkAssignmentTimeouts(tenantDb, restaurantId) {
    const Order = tenantDb.model('Order');
    const Table = tenantDb.model('Table');
    const AssignmentEvent = tenantDb.model('AssignmentEvent');
    const now = new Date();

    const timedOutOrders = await Order.find({
      restaurantId,
      assignmentStatus: 'PENDING_ACCEPTANCE',
      assignmentTimeoutAt: { $lte: now },
      status: { $nin: ['COMPLETED', 'CANCELLED', 'PAID'] }
    });

    const results = [];
    for (const order of timedOutOrders) {
      const prevWaiterId = order.assignedWaiterId;
      order.assignmentStatus = 'TIMEOUT';
      await order.save();

      await AssignmentEvent.create({
        restaurantId,
        targetType: 'ORDER',
        targetId: order._id,
        tableId: order.tableId,
        tableNumber: order.tableNumber,
        previousWaiterId: prevWaiterId,
        action: 'TIMEOUT',
        actorRole: 'SYSTEM',
        reason: 'Waiter acceptance window expired'
      }).catch(err => console.error(err));

      const table = await Table.findById(order.tableId);
      const settings = await this.getSettings(tenantDb, restaurantId);

      if (settings.reassignmentPolicy === 'AUTO_REASSIGN') {
        const candidates = await this.findEligibleWaiters(tenantDb, restaurantId, table, settings);
        const nextCandidate = candidates.find(c => !prevWaiterId || c.waiter._id.toString() !== prevWaiterId.toString());

        if (nextCandidate) {
          const timeoutAt = new Date(Date.now() + (settings.acceptanceTimeoutMinutes || 3) * 60000);
          order.assignedWaiterId = nextCandidate.waiter._id;
          order.assignmentType = 'OVERFLOW';
          order.assignmentStatus = 'PENDING_ACCEPTANCE';
          order.assignedAt = new Date();
          order.assignmentTimeoutAt = timeoutAt;
          await order.save();

          results.push({ orderId: order._id, action: 'REASSIGNED', newWaiterId: nextCandidate.waiter._id });
          continue;
        }
      }

      order.assignmentStatus = 'UNASSIGNED';
      order.assignedWaiterId = null;
      await order.save();
      results.push({ orderId: order._id, action: 'ESCALATED_UNASSIGNED' });
    }

    return results;
  }
}

module.exports = WaiterAssignmentService;
