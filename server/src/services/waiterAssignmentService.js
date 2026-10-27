/**
 * Waiter Assignment Service
 * -------------------------------------------------------------
 * Full-stack implementation supporting Manual, Dynamic & Hybrid
 * Waiter-to-Table and Waiter-to-Order Assignment.
 * 
 * Works seamlessly with Supabase PostgreSQL via Drizzle ORM and
 * supports transactional ACID operations, audit logging, and
 * real-time Socket.IO dispatch.
 */

const crypto = require('crypto');
const { db, schema } = require('../db/client');
const { eq, and, sql, desc } = require('drizzle-orm');
const { restaurants, tables, tables_assignment, users, order_details, customer_orders, order_items } = schema;
const { service_requests, assignment_events } = require('../db/schema/compat');
const { logAudit } = require('./AuditService');
const RealtimeService = require('./RealtimeService');

// In-memory presence & availability cache (waiterId -> presence object)
const waiterPresenceCache = new Map();

class WaiterAssignmentService {
  /**
   * Helper: Get presence object for a waiter with fallbacks (synchronous)
   */
  static getWaiterPresence(waiterId) {
    if (!waiterId) return { shiftStatus: 'OFF_SHIFT', availabilityStatus: 'OFF_SHIFT', acceptingOrders: false, lastAssignedAt: null };
    const cached = waiterPresenceCache.get(waiterId);
    if (cached) return cached;
    return {
      shiftStatus: 'OFF_SHIFT',
      availabilityStatus: 'OFF_SHIFT',
      acceptingOrders: false,
      workloadCapacity: 5,
      sections: [],
      lastAssignedAt: null
    };
  }

  /**
   * Helper: Restore presence from DB (assignment_events) if not in memory cache
   */
  static async getOrRestoreWaiterPresence(waiterId, restaurantId) {
    if (!waiterId) return { shiftStatus: 'OFF_SHIFT', availabilityStatus: 'OFF_SHIFT', acceptingOrders: false, lastAssignedAt: null };
    const cached = waiterPresenceCache.get(waiterId);
    if (cached) return cached;

    try {
      const [latestEvent] = await db.select().from(assignment_events).where(
        and(
          eq(assignment_events.staff_id, waiterId),
          eq(assignment_events.event_type, 'AVAILABILITY_UPDATE')
        )
      ).orderBy(desc(assignment_events.createdat)).limit(1);

      if (latestEvent && latestEvent.details && typeof latestEvent.details === 'object') {
        const details = latestEvent.details;
        const shiftStatus = details.shiftStatus || 'OFF_SHIFT';
        const availabilityStatus = details.availabilityStatus || (shiftStatus === 'ON_SHIFT' ? 'AVAILABLE' : 'OFF_SHIFT');
        const acceptingOrders = details.acceptingOrders !== undefined 
          ? details.acceptingOrders 
          : (shiftStatus === 'ON_SHIFT' && availabilityStatus === 'AVAILABLE');

        const restored = {
          shiftStatus,
          availabilityStatus,
          acceptingOrders,
          workloadCapacity: details.workloadCapacity || 5,
          sections: details.sections || [],
          lastAssignedAt: details.lastAssignedAt || null,
          updatedAt: details.updatedAt || latestEvent.createdat
        };
        waiterPresenceCache.set(waiterId, restored);
        return restored;
      }
    } catch (err) {
      console.warn('[WaiterAssignmentService.getOrRestoreWaiterPresence] DB lookup warning:', err.message);
    }

    const defaultPresence = {
      shiftStatus: 'OFF_SHIFT',
      availabilityStatus: 'OFF_SHIFT',
      acceptingOrders: false,
      workloadCapacity: 5,
      sections: [],
      lastAssignedAt: null
    };
    waiterPresenceCache.set(waiterId, defaultPresence);
    return defaultPresence;
  }

  /**
   * Helper: Update presence cache and record last assignment time
   */
  static recordAssignment(waiterId) {
    if (!waiterId) return;
    const current = this.getWaiterPresence(waiterId);
    waiterPresenceCache.set(waiterId, {
      ...current,
      lastAssignedAt: new Date()
    });
  }

  /**
   * Helper: Update waiter availability in cache and DB event
   */
  static async updateWaiterAvailability(restaurantId, waiterId, data = {}) {
    const current = this.getWaiterPresence(waiterId);
    let shiftStatus = data.shiftStatus !== undefined ? data.shiftStatus : current.shiftStatus;
    let availabilityStatus = data.availabilityStatus !== undefined ? data.availabilityStatus : current.availabilityStatus;
    let acceptingOrders = data.acceptingOrders !== undefined ? data.acceptingOrders : current.acceptingOrders;

    // Harmonize shiftStatus and availabilityStatus
    if (data.shiftStatus === 'OFF_SHIFT') {
      shiftStatus = 'OFF_SHIFT';
      availabilityStatus = 'OFF_SHIFT';
      acceptingOrders = false;
    } else if (data.shiftStatus === 'ON_SHIFT') {
      shiftStatus = 'ON_SHIFT';
      if (!data.availabilityStatus || data.availabilityStatus === 'OFF_SHIFT') {
        availabilityStatus = 'AVAILABLE';
        acceptingOrders = true;
      }
    }

    if (data.availabilityStatus) {
      if (data.availabilityStatus === 'OFF_SHIFT') {
        shiftStatus = 'OFF_SHIFT';
        availabilityStatus = 'OFF_SHIFT';
        acceptingOrders = false;
      } else if (data.availabilityStatus === 'AVAILABLE') {
        shiftStatus = 'ON_SHIFT';
        availabilityStatus = 'AVAILABLE';
        acceptingOrders = true;
      } else if (data.availabilityStatus === 'BUSY') {
        shiftStatus = 'ON_SHIFT';
        availabilityStatus = 'BUSY';
        acceptingOrders = false;
      } else if (data.availabilityStatus === 'PAUSED') {
        shiftStatus = 'ON_SHIFT';
        availabilityStatus = 'PAUSED';
        acceptingOrders = false;
      }
    }

    const updated = {
      ...current,
      ...data,
      shiftStatus,
      availabilityStatus,
      acceptingOrders,
      updatedAt: new Date()
    };
    waiterPresenceCache.set(waiterId, updated);

    try {
      await db.insert(assignment_events).values({
        id: crypto.randomUUID(),
        restaurant_id: restaurantId,
        assignment_id: waiterId,
        staff_id: waiterId,
        event_type: 'AVAILABILITY_UPDATE',
        details: {
          shiftStatus: updated.shiftStatus,
          availabilityStatus: updated.availabilityStatus,
          acceptingOrders: updated.acceptingOrders,
          workloadCapacity: updated.workloadCapacity || current.workloadCapacity || 5,
          updatedAt: updated.updatedAt
        }
      });
    } catch (err) {
      console.warn('[WaiterAssignmentService.updateWaiterAvailability] DB log warning:', err.message);
    }

    return updated;
  }

  /**
   * 1. Get restaurant assignment settings with fallbacks
   */
  static async getSettings(tenantDb, restaurantId) {
    const defaults = {
      mode: 'HYBRID',
      defaultCapacity: 5,
      weightWorkload: 0.60,
      weightRecentAssignment: 0.25,
      weightSectionMismatch: 0.15,
      allowOverflow: true,
      acceptanceTimeoutMinutes: 3,
      reassignmentPolicy: 'AUTO_REASSIGN',
      allowAutoAssignment: true
    };

    // Mongoose / Mock tenant DB path for unit tests
    if (tenantDb && typeof tenantDb.model === 'function') {
      try {
        const RestaurantProfile = tenantDb.model('RestaurantProfile');
        const profile = await RestaurantProfile.findOne({ restaurantId });
        const isAutoAllowed = profile?.tableAllocationMode !== undefined
          ? profile.tableAllocationMode === 'DYNAMIC'
          : (profile?.allowAutoAssignment ?? true);
        const savedSettings = profile?.assignmentSettings || {};
        const effectiveMode = isAutoAllowed ? (savedSettings.mode || defaults.mode) : 'MANUAL';
        return {
          ...defaults,
          ...savedSettings,
          allowAutoAssignment: isAutoAllowed,
          mode: effectiveMode
        };
      } catch {
        return defaults;
      }
    }

    // PostgreSQL / Drizzle ORM production path
    try {
      // 1. Check system admin allocation mode permission on restaurants table
      const [rest] = await db.select({ mode: restaurants.table_allocation_mode }).from(restaurants).where(
        eq(restaurants.id, restaurantId)
      ).limit(1);

      // In Postgres enum: 'DYNAMIC' allows all modes; 'MANUAL' restricts to Manual only
      const isAutoAllowed = rest?.mode ? rest.mode === 'DYNAMIC' : true;

      const [latestConfig] = await db.select().from(assignment_events).where(
        and(
          eq(assignment_events.restaurant_id, restaurantId),
          eq(assignment_events.event_type, 'SETTINGS_UPDATE')
        )
      ).orderBy(desc(assignment_events.createdat)).limit(1);

      let config = { ...defaults };
      if (latestConfig && latestConfig.details && typeof latestConfig.details === 'object') {
        config = { ...defaults, ...latestConfig.details };
      } else if (rest?.mode) {
        config = { ...defaults, mode: rest.mode };
      }

      // If System Admin has restricted to MANUAL only, force mode to MANUAL
      const effectiveMode = isAutoAllowed ? (config.mode || 'HYBRID') : 'MANUAL';

      return {
        ...config,
        allowAutoAssignment: isAutoAllowed,
        mode: effectiveMode
      };
    } catch (err) {
      console.warn('[WaiterAssignmentService.getSettings] DB query warning:', err.message);
      return defaults;
    }
  }

  /**
   * Update and validate assignment settings
   */
  static async updateSettings(tenantDb, restaurantId, newSettings, actorId) {
    const current = await this.getSettings(tenantDb, restaurantId);

    // If System Admin disabled auto assignment, reject attempts to configure DYNAMIC or HYBRID
    if (!current.allowAutoAssignment && (newSettings.mode === 'DYNAMIC' || newSettings.mode === 'HYBRID')) {
      const err = new Error('System Admin has configured this restaurant for Manual Assignment only. Contact your administrator to enable Dynamic and Hybrid modes.');
      err.status = 403;
      throw err;
    }

    const requestedMode = ['MANUAL', 'DYNAMIC', 'HYBRID'].includes(newSettings.mode) ? newSettings.mode : current.mode;
    const finalMode = current.allowAutoAssignment ? requestedMode : 'MANUAL';

    const sanitized = {
      mode: finalMode,
      defaultCapacity: Math.max(1, Math.min(50, parseInt(newSettings.defaultCapacity, 10) || current.defaultCapacity)),
      weightWorkload: typeof newSettings.weightWorkload === 'number' ? Math.max(0, Math.min(1, newSettings.weightWorkload)) : current.weightWorkload,
      weightRecentAssignment: typeof newSettings.weightRecentAssignment === 'number' ? Math.max(0, Math.min(1, newSettings.weightRecentAssignment)) : current.weightRecentAssignment,
      weightSectionMismatch: typeof newSettings.weightSectionMismatch === 'number' ? Math.max(0, Math.min(1, newSettings.weightSectionMismatch)) : current.weightSectionMismatch,
      allowOverflow: newSettings.allowOverflow !== undefined ? Boolean(newSettings.allowOverflow) : current.allowOverflow,
      acceptanceTimeoutMinutes: Math.max(1, Math.min(60, parseInt(newSettings.acceptanceTimeoutMinutes, 10) || current.acceptanceTimeoutMinutes)),
      reassignmentPolicy: ['AUTO_REASSIGN', 'MANAGER_ESCALATION'].includes(newSettings.reassignmentPolicy) ? newSettings.reassignmentPolicy : current.reassignmentPolicy,
      allowAutoAssignment: current.allowAutoAssignment
    };

    if (tenantDb && typeof tenantDb.model === 'function') {
      try {
        const RestaurantProfile = tenantDb.model('RestaurantProfile');
        await RestaurantProfile.findOneAndUpdate(
          { restaurantId },
          { assignmentSettings: sanitized },
          { upsert: true, new: true }
        );
      } catch (err) {
        console.warn('[WaiterAssignmentService.updateSettings] mock update warning:', err.message);
      }
      return sanitized;
    }

    try {
      const eventId = crypto.randomUUID();
      await db.insert(assignment_events).values({
        id: eventId,
        restaurant_id: restaurantId,
        assignment_id: eventId,
        staff_id: actorId || null,
        event_type: 'SETTINGS_UPDATE',
        details: sanitized
      });

      if (sanitized.mode === 'MANUAL' || sanitized.mode === 'DYNAMIC') {
        await db.update(restaurants).set({
          table_allocation_mode: sanitized.mode,
          updatedat: new Date()
        }).where(eq(restaurants.id, restaurantId));
      }

      await logAudit({
        restaurant_id: restaurantId,
        user_id: actorId,
        action: 'ASSIGNMENT_SETTINGS_UPDATED',
        entity_type: 'ASSIGNMENT_SETTINGS',
        entity_id: eventId,
        details: sanitized
      }).catch(() => {});

      RealtimeService.emit(`restaurant:${restaurantId}`, 'assignment_settings_updated', sanitized);

      return sanitized;
    } catch (err) {
      console.error('[WaiterAssignmentService.updateSettings] DB error:', err);
      throw err;
    }
  }

  /**
   * 2. Calculate live workload for a specific waiter
   * (Live pending/in-progress orders + unresolved service requests)
   */
  static async getWaiterWorkload(tenantDb, restaurantId, waiterId) {
    if (tenantDb && typeof tenantDb.model === 'function') {
      try {
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
      } catch {
        return { activeOrdersCount: 0, activeRequestsCount: 0, totalWorkload: 0 };
      }
    }

    // PostgreSQL Drizzle ORM
    try {
      const [orderRes] = await db.select({
        count: sql`count(*)`
      }).from(order_details).where(
        and(
          eq(order_details.restaurant_id, restaurantId),
          eq(order_details.assigned_waiter_id, waiterId),
          sql`${order_details.order_status} NOT IN ('COMPLETED', 'CANCELLED', 'PAID')`
        )
      );
      const activeOrdersCount = parseInt(orderRes?.count || '0', 10);

      const [reqRes] = await db.select({
        count: sql`count(*)`
      }).from(service_requests).where(
        and(
          eq(service_requests.restaurant_id, restaurantId),
          sql`${service_requests.request_status} NOT IN ('RESOLVED', 'CANCELLED')`,
          sql`(${service_requests.details}->>'assigned_waiter_id' = ${waiterId} OR ${service_requests.table_id} IN (
            SELECT table_id FROM tables_assignment WHERE staff_id = ${waiterId} AND assignment_status = 'ASSIGNED'
          ))`
        )
      );
      const activeRequestsCount = parseInt(reqRes?.count || '0', 10);

      return {
        activeOrdersCount,
        activeRequestsCount,
        totalWorkload: activeOrdersCount + activeRequestsCount
      };
    } catch (err) {
      console.warn('[WaiterAssignmentService.getWaiterWorkload] error:', err.message);
      return { activeOrdersCount: 0, activeRequestsCount: 0, totalWorkload: 0 };
    }
  }

  /**
   * 3. Find and rank all eligible waiters for a table/order
   */
  static async findEligibleWaiters(tenantDb, restaurantId, table, settings, options = {}) {
    const { bypassCapacity = false } = options;

    // Unit test mock / Mongoose branch
    if (tenantDb && typeof tenantDb.model === 'function') {
      const User = tenantDb.model('User');
      const waiters = await User.find({
        restaurantId,
        role: 'RESTAURANT_STAFF',
        isActive: true,
        shiftStatus: 'ON_SHIFT',
        acceptingOrders: true,
        availabilityStatus: { $ne: 'PAUSED' }
      });

      if (!waiters || waiters.length === 0) return [];

      const scoredWaiters = [];
      const now = Date.now();
      const RECENT_WINDOW_MS = 15 * 60 * 1000;

      for (const waiter of waiters) {
        const capacity = waiter.workloadCapacity || settings.defaultCapacity || 5;
        const { totalWorkload, activeOrdersCount, activeRequestsCount } = await this.getWaiterWorkload(
          tenantDb,
          restaurantId,
          waiter._id
        );

        const hasRemainingCapacity = totalWorkload < capacity;
        if (!hasRemainingCapacity && !settings.allowOverflow && !bypassCapacity) {
          continue;
        }

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
          if (!hasSection) sectionPenalty = 1.0;
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

      scoredWaiters.sort((a, b) => {
        const diff = a.score - b.score;
        if (Math.abs(diff) > 0.0001) return diff;
        if (a.idleTime !== b.idleTime) return b.idleTime - a.idleTime;
        return String(a.waiter._id).localeCompare(String(b.waiter._id));
      });

      return scoredWaiters;
    }

    // PostgreSQL Drizzle ORM production branch
    try {
      const staffRows = await db.select().from(users).where(
        and(
          eq(users.restaurant_id, restaurantId),
          eq(users.user_type, 'STAFF'),
          eq(users.user_status, 'ACTIVE'),
          eq(users.is_deleted, false)
        )
      );

      if (staffRows.length === 0) return [];

      const scoredWaiters = [];
      const now = Date.now();
      const RECENT_WINDOW_MS = 15 * 60 * 1000;

      for (const st of staffRows) {
        const presence = await this.getOrRestoreWaiterPresence(st.id, restaurantId);

        if (presence.shiftStatus !== 'ON_SHIFT' || presence.acceptingOrders === false || presence.availabilityStatus === 'PAUSED' || presence.availabilityStatus === 'BUSY') {
          continue;
        }

        const capacity = presence.workloadCapacity || settings.defaultCapacity || 5;
        const { totalWorkload, activeOrdersCount, activeRequestsCount } = await this.getWaiterWorkload(
          null,
          restaurantId,
          st.id
        );

        const hasRemainingCapacity = totalWorkload < capacity;
        if (!hasRemainingCapacity && !settings.allowOverflow && !bypassCapacity) {
          continue;
        }

        const normalizedWorkload = Math.min(totalWorkload / capacity, 1.0);

        let recentPenalty = 0;
        const lastAssigned = presence.lastAssignedAt;
        if (lastAssigned) {
          const timeSince = now - new Date(lastAssigned).getTime();
          if (timeSince < RECENT_WINDOW_MS) {
            recentPenalty = Math.max(0, 1.0 - timeSince / RECENT_WINDOW_MS);
          }
        }

        let sectionPenalty = 0;
        const waiterSections = presence.sections || [];
        const tableSection = table?.section;
        if (waiterSections.length > 0 && tableSection) {
          const match = waiterSections.some(s => s.toLowerCase() === tableSection.toLowerCase());
          if (!match) sectionPenalty = 1.0;
        }

        const score = (
          (settings.weightWorkload * normalizedWorkload) +
          (settings.weightRecentAssignment * recentPenalty) +
          (settings.weightSectionMismatch * sectionPenalty)
        );

        scoredWaiters.push({
          waiter: {
            ...st,
            _id: st.id,
            id: st.id,
            role: 'RESTAURANT_STAFF',
            shiftStatus: presence.shiftStatus,
            availabilityStatus: presence.availabilityStatus,
            acceptingOrders: presence.acceptingOrders,
            workloadCapacity: capacity,
            sections: waiterSections,
            lastAssignedAt: presence.lastAssignedAt
          },
          score,
          totalWorkload,
          capacity,
          activeOrdersCount,
          activeRequestsCount,
          normalizedWorkload,
          recentPenalty,
          sectionPenalty,
          idleTime: lastAssigned ? now - new Date(lastAssigned).getTime() : Infinity
        });
      }

      scoredWaiters.sort((a, b) => {
        const diff = a.score - b.score;
        if (Math.abs(diff) > 0.0001) return diff;
        if (a.idleTime !== b.idleTime) return b.idleTime - a.idleTime;
        return String(a.waiter.id).localeCompare(String(b.waiter.id));
      });

      return scoredWaiters;
    } catch (err) {
      console.error('[WaiterAssignmentService.findEligibleWaiters] DB error:', err);
      return [];
    }
  }

  /**
   * 4. Determine responsible waiter for a new Order or Table Visit
   * Supports: MANUAL, DYNAMIC, and HYBRID (Recommended Default)
   */
  static async assignWaiterForOrder(tenantDb, restaurantId, table, orderId = null, options = {}) {
    // Unit test mock branch
    if (tenantDb && typeof tenantDb.model === 'function') {
      const settings = await this.getSettings(tenantDb, restaurantId);
      const mode = settings.mode || 'HYBRID';
      const now = new Date();
      const timeoutAt = new Date(now.getTime() + (settings.acceptanceTimeoutMinutes || 3) * 60000);

      let assignedWaiterId = null;
      let assignmentType = 'PRIMARY';
      let assignmentScore = null;
      let scoreDetails = null;
      let reason = '';

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

          if (!table.primaryWaiterId) {
            const Table = tenantDb.model('Table');
            if (Table?.findByIdAndUpdate) {
              await Table.findByIdAndUpdate(table._id, {
                primaryWaiterId: best.waiter._id,
                assignmentMode: 'AUTOMATIC',
                assignedAt: now,
                assignmentStatus: 'ASSIGNED'
              });
            }
            table.primaryWaiterId = best.waiter._id;
          }
        } else {
          assignedWaiterId = null;
          assignmentType = 'UNASSIGNED';
          reason = 'No eligible waiters available (all off-shift, paused, or at capacity)';
        }
      } else if (!assignedWaiterId && mode === 'MANUAL') {
        assignmentType = 'UNASSIGNED';
        reason = 'Manual mode: No primary waiter assigned to this table';
      }

      if (assignedWaiterId) {
        const User = tenantDb.model('User');
        if (User?.findByIdAndUpdate) {
          await User.findByIdAndUpdate(assignedWaiterId, { lastAssignedAt: now });
        }
      }

      if (orderId) {
        const AssignmentEvent = tenantDb.model('AssignmentEvent');
        if (AssignmentEvent?.create) {
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

    // PostgreSQL Drizzle ORM production branch
    const settings = await this.getSettings(null, restaurantId);
    const mode = settings.mode || 'HYBRID';
    const now = new Date();
    const timeoutMinutes = settings.acceptanceTimeoutMinutes || 3;
    const timeoutAt = new Date(now.getTime() + timeoutMinutes * 60000);

    const tableId = table?.id || table?._id;
    let assignedWaiterId = null;
    let assignmentType = 'PRIMARY';
    let assignmentScore = null;
    let scoreDetails = null;
    let reason = '';

    // Check table-level primary waiter in tables_assignment
    let primaryAssignment = null;
    if (tableId) {
      const [activeAsgn] = await db.select().from(tables_assignment).where(
        and(
          eq(tables_assignment.restaurant_id, restaurantId),
          eq(tables_assignment.table_id, tableId),
          eq(tables_assignment.assignment_status, 'ASSIGNED')
        )
      ).limit(1);
      primaryAssignment = activeAsgn;
    }

    // ── Mode logic: HYBRID & MANUAL check primary table owner first ──
    if (mode === 'HYBRID' || mode === 'MANUAL') {
      if (primaryAssignment) {
        const [primaryWaiter] = await db.select().from(users).where(
          and(
            eq(users.id, primaryAssignment.staff_id),
            eq(users.restaurant_id, restaurantId),
            eq(users.user_status, 'ACTIVE'),
            eq(users.is_deleted, false)
          )
        ).limit(1);

        if (primaryWaiter) {
          const presence = await this.getOrRestoreWaiterPresence(primaryWaiter.id, restaurantId);
          const isEligible = presence.shiftStatus === 'ON_SHIFT' &&
                             presence.acceptingOrders !== false &&
                             presence.availabilityStatus !== 'PAUSED' &&
                             presence.availabilityStatus !== 'BUSY';

          if (isEligible) {
            const capacity = presence.workloadCapacity || settings.defaultCapacity || 5;
            const { totalWorkload } = await this.getWaiterWorkload(null, restaurantId, primaryWaiter.id);

            if (totalWorkload < capacity || mode === 'MANUAL') {
              assignedWaiterId = primaryWaiter.id;
              assignmentType = 'PRIMARY';
              reason = `Routed to primary table waiter (${primaryWaiter.name}) (eligible & within capacity)`;
            } else if (settings.allowOverflow) {
              reason = `Primary waiter (${primaryWaiter.name}) overloaded (${totalWorkload}/${capacity}); seeking overflow waiter`;
            } else {
              assignedWaiterId = primaryWaiter.id;
              assignmentType = 'PRIMARY';
              reason = 'Assigned to primary waiter (overflow disabled)';
            }
          } else {
            reason = `Primary waiter (${primaryWaiter.name}) off-shift or paused; seeking alternative`;
          }
        }
      }
    }

    // ── Dynamic assignment fallback if not assigned ──
    if (!assignedWaiterId && mode !== 'MANUAL') {
      const candidates = await this.findEligibleWaiters(null, restaurantId, table, settings);

      if (candidates.length > 0) {
        const best = candidates[0];
        assignedWaiterId = best.waiter.id;
        assignmentType = primaryAssignment ? 'OVERFLOW' : 'PRIMARY';
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

        // If table has NO primary assignment, establish this best waiter as table's primary in tables_assignment!
        if (!primaryAssignment && tableId) {
          await this.assignTableWaiter(restaurantId, tableId, best.waiter.id, 'SYSTEM', {
            assignmentType: 'DYNAMIC',
            reason: `Automatically assigned primary table waiter: ${best.waiter.name}`
          }).catch(err => console.warn('[assignWaiterForOrder] Auto table assignment warning:', err.message));
        }
      } else {
        assignedWaiterId = null;
        assignmentType = 'UNASSIGNED';
        reason = 'No eligible waiters available (all off-shift, paused, or at capacity)';
      }
    } else if (!assignedWaiterId && mode === 'MANUAL') {
      assignmentType = 'UNASSIGNED';
      reason = 'Manual mode: No primary waiter assigned to this table';
    }

    if (assignedWaiterId) {
      this.recordAssignment(assignedWaiterId);
    }

    // Update order in DB if orderId provided
    if (orderId && assignedWaiterId) {
      await db.update(order_details).set({
        assigned_waiter_id: assignedWaiterId,
        updatedat: new Date()
      }).where(eq(order_details.id, orderId)).catch(() => {});
    }

    // Log assignment event
    const eventId = crypto.randomUUID();
    await db.insert(assignment_events).values({
      id: eventId,
      restaurant_id: restaurantId,
      assignment_id: orderId || eventId,
      staff_id: assignedWaiterId || null,
      event_type: assignedWaiterId ? (assignmentType === 'OVERFLOW' ? 'OVERFLOW_ASSIGNED' : 'ASSIGNED') : 'UNASSIGNED',
      details: {
        targetType: 'ORDER',
        targetId: orderId,
        tableId,
        tableNumber: table?.table_code || table?.tableNumber,
        newWaiterId: assignedWaiterId,
        assignmentMode: mode,
        assignmentType,
        score: assignmentScore,
        scoreDetails,
        reason,
        actorRole: 'SYSTEM'
      }
    }).catch(err => console.error('[WaiterAssignmentService] event logging error:', err));

    // Realtime notification
    if (assignedWaiterId) {
      RealtimeService.orderAssigned({
        waiterId: assignedWaiterId,
        order: {
          id: orderId,
          _id: orderId,
          tableId,
          tableNumber: table?.table_code || table?.tableNumber,
          assignmentType,
          assignmentStatus: 'PENDING_ACCEPTANCE',
          assignmentTimeoutAt: timeoutAt
        }
      });
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
   * 5. Table-Level Assignment (Manager or System assigns primary waiter to a table)
   */
  static async assignTableWaiter(restaurantId, tableId, staffId, actorId, options = {}) {
    const { allowOffDutyOverride = false, reason = 'Manager assigned waiter' } = options;

    return await db.transaction(async (tx) => {
      let staff = null;
      if (staffId) {
        const [foundStaff] = await tx.select().from(users).where(
          and(
            eq(users.id, staffId),
            eq(users.restaurant_id, restaurantId),
            eq(users.user_status, 'ACTIVE'),
            eq(users.is_deleted, false)
          )
        ).limit(1);

        if (!foundStaff) {
          throw new Error('Staff member not found, inactive or not belonging to this restaurant.');
        }
        staff = foundStaff;

        if (!allowOffDutyOverride) {
          const presence = this.getWaiterPresence(staffId);
          if (presence.shiftStatus !== 'ON_SHIFT' && presence.availabilityStatus === 'OFF_SHIFT') {
            throw new Error(`Cannot assign off-duty waiter (${staff.name}) without explicit override.`);
          }
        }
      }

      // Check previous active assignment
      const [previousAssignment] = await tx.select().from(tables_assignment).where(
        and(
          eq(tables_assignment.table_id, tableId),
          eq(tables_assignment.assignment_status, 'ASSIGNED')
        )
      ).limit(1);

      const previousWaiterId = previousAssignment ? previousAssignment.staff_id : null;

      // Release previous assignment
      if (previousAssignment) {
        await tx.update(tables_assignment)
          .set({
            assignment_status: 'COMPLETED',
            released_at: new Date(),
            updatedat: new Date()
          })
          .where(eq(tables_assignment.id, previousAssignment.id));
      }

      let newAssignment = null;
      if (staffId) {
        const assignmentId = crypto.randomUUID();
        const [created] = await tx.insert(tables_assignment).values({
          id: assignmentId,
          restaurant_id: restaurantId,
          table_id: tableId,
          staff_id: staffId,
          assignment_type: options.assignmentType || 'MANUAL',
          assigned_by: actorId,
          assignment_status: 'ASSIGNED',
          assigned_at: new Date()
        }).returning();
        newAssignment = created;

        this.recordAssignment(staffId);
      }

      const [tbl] = await tx.update(tables).set({
        updatedat: new Date()
      }).where(eq(tables.id, tableId)).returning();

      // Insert event into assignment_events
      const eventId = crypto.randomUUID();
      await tx.insert(assignment_events).values({
        id: eventId,
        restaurant_id: restaurantId,
        assignment_id: newAssignment ? newAssignment.id : eventId,
        staff_id: staffId || null,
        event_type: previousWaiterId && staffId ? 'TABLE_REASSIGNED' : (staffId ? 'TABLE_ASSIGNED' : 'TABLE_RELEASED'),
        details: {
          targetType: 'TABLE',
          tableId,
          tableNumber: tbl?.table_code,
          previousWaiterId,
          newWaiterId: staffId || null,
          action: previousWaiterId && staffId ? 'REASSIGNED' : (staffId ? 'ASSIGNED' : 'RELEASED'),
          actorId,
          reason
        }
      });

      await logAudit({
        restaurant_id: restaurantId,
        user_id: actorId,
        action: staffId ? (previousWaiterId ? 'TABLE_REASSIGNED' : 'TABLE_ASSIGNED_MANUAL') : 'TABLE_ASSIGNMENT_RELEASED',
        entity_type: 'TABLE_ASSIGNMENT',
        entity_id: newAssignment ? newAssignment.id : tableId,
        details: { tableId, staffId, previousWaiterId, reason }
      }, tx);

      // Realtime notification
      const formattedTable = {
        id: tableId,
        _id: tableId,
        tableNumber: tbl?.table_code,
        tableName: `Table ${tbl?.table_code}`,
        primaryWaiterId: staff ? { id: staff.id, _id: staff.id, name: staff.name, email: staff.email, phone: staff.phone_number } : null
      };

      RealtimeService.tableUpdated(restaurantId, formattedTable);
      if (staffId) {
        RealtimeService.emit(`waiter_user:${staffId}`, 'table_assigned', formattedTable);
      }
      if (previousWaiterId && previousWaiterId !== staffId) {
        RealtimeService.emit(`waiter_user:${previousWaiterId}`, 'table_reassigned', {
          ...formattedTable,
          previousWaiterId,
          reassignedTo: staff?.name
        });
      }

      return newAssignment;
    });
  }

  /**
   * 6. Handle Waiter Order Acceptance
   */
  static async acceptOrder(tenantDb, restaurantId, orderId, waiterId) {
    if (tenantDb && typeof tenantDb.model === 'function') {
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
      if (order.status === 'PENDING') order.status = 'READ';
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

    // PostgreSQL Drizzle ORM
    let visitId = orderId;
    const [custOrder] = await db.select().from(customer_orders).where(
      and(eq(customer_orders.id, orderId), eq(customer_orders.restaurant_id, restaurantId))
    ).limit(1);
    if (custOrder) visitId = custOrder.visit_id;

    const [visit] = await db.select().from(order_details).where(
      and(eq(order_details.id, visitId), eq(order_details.restaurant_id, restaurantId))
    ).limit(1);

    if (!visit) throw new Error('Order not found');

    if (visit.assigned_waiter_id && visit.assigned_waiter_id !== waiterId) {
      throw new Error('This order is assigned to another waiter');
    }

    await db.update(order_details).set({
      app_status: 'ACCEPTED',
      assigned_waiter_id: waiterId,
      updatedat: new Date()
    }).where(eq(order_details.id, visitId));

    await db.update(customer_orders).set({
      order_status: 'ACCEPTED',
      updatedat: new Date()
    }).where(and(eq(customer_orders.visit_id, visitId), eq(customer_orders.restaurant_id, restaurantId)));

    await db.update(order_items).set({
      item_status: 'ACCEPTED',
      updatedat: new Date()
    }).where(and(eq(order_items.visit_id, visitId), eq(order_items.item_status, 'PENDING')));

    const eventId = crypto.randomUUID();
    await db.insert(assignment_events).values({
      id: eventId,
      restaurant_id: restaurantId,
      assignment_id: visitId,
      staff_id: waiterId,
      event_type: 'ACCEPTED',
      details: {
        targetType: 'ORDER',
        targetId: orderId,
        visitId,
        action: 'ACCEPTED',
        actorId: waiterId,
        actorRole: 'WAITER',
        reason: 'Order accepted by assigned waiter'
      }
    });

    const updatedOrder = {
      id: visitId,
      _id: visitId,
      visitId,
      status: 'ACCEPTED',
      appStatus: 'ACCEPTED',
      assignmentStatus: 'ACCEPTED',
      assignedWaiterId: waiterId
    };

    RealtimeService.orderUpdated({
      restaurantId,
      order: updatedOrder,
      orderId: visitId,
      tableId: visit.table_id
    });

    return updatedOrder;
  }

  /**
   * 7. Handle Waiter Order Rejection
   */
  static async rejectOrder(tenantDb, restaurantId, orderId, waiterId, reason = 'Busy') {
    if (tenantDb && typeof tenantDb.model === 'function') {
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

      const table = await Table.findById(order.tableId);
      const settings = await this.getSettings(tenantDb, restaurantId);

      if (settings.reassignmentPolicy === 'AUTO_REASSIGN') {
        const candidates = await this.findEligibleWaiters(tenantDb, restaurantId, table, settings);
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
          if (User?.findByIdAndUpdate) {
            await User.findByIdAndUpdate(alternative.waiter._id, { lastAssignedAt: now });
          }

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

          return { order, reassignedTo: alternative.waiter, escalated: false };
        }
      }

      order.assignmentStatus = 'UNASSIGNED';
      order.assignedWaiterId = null;
      await order.save();

      return { order, reassignedTo: null, escalated: true };
    }

    // PostgreSQL Drizzle ORM
    let visitId = orderId;
    const [custOrder] = await db.select().from(customer_orders).where(
      and(eq(customer_orders.id, orderId), eq(customer_orders.restaurant_id, restaurantId))
    ).limit(1);
    if (custOrder) visitId = custOrder.visit_id;

    const [visit] = await db.select().from(order_details).where(
      and(eq(order_details.id, visitId), eq(order_details.restaurant_id, restaurantId))
    ).limit(1);

    if (!visit) throw new Error('Order not found');

    const previousWaiterId = visit.assigned_waiter_id;

    await db.insert(assignment_events).values({
      id: crypto.randomUUID(),
      restaurant_id: restaurantId,
      assignment_id: visitId,
      staff_id: waiterId,
      event_type: 'REJECTED',
      details: {
        targetType: 'ORDER',
        targetId: orderId,
        visitId,
        previousWaiterId,
        action: 'REJECTED',
        actorId: waiterId,
        actorRole: 'WAITER',
        reason: `Rejected by waiter: ${reason}`
      }
    });

    const settings = await this.getSettings(null, restaurantId);
    let table = null;
    if (visit.table_id) {
      const [t] = await db.select().from(tables).where(eq(tables.id, visit.table_id)).limit(1);
      table = t;
    }

    if (settings.reassignmentPolicy === 'AUTO_REASSIGN') {
      const candidates = await this.findEligibleWaiters(null, restaurantId, table, settings);
      const alternative = candidates.find(c => c.waiter.id !== waiterId);

      if (alternative) {
        const timeoutMinutes = settings.acceptanceTimeoutMinutes || 3;
        const timeoutAt = new Date(Date.now() + timeoutMinutes * 60000);

        await db.update(order_details).set({
          assigned_waiter_id: alternative.waiter.id,
          updatedat: new Date()
        }).where(eq(order_details.id, visitId));

        this.recordAssignment(alternative.waiter.id);

        await db.insert(assignment_events).values({
          id: crypto.randomUUID(),
          restaurant_id: restaurantId,
          assignment_id: visitId,
          staff_id: alternative.waiter.id,
          event_type: 'REASSIGNED',
          details: {
            targetType: 'ORDER',
            targetId: orderId,
            visitId,
            previousWaiterId,
            newWaiterId: alternative.waiter.id,
            action: 'REASSIGNED',
            actorRole: 'SYSTEM',
            reason: `Auto-reassigned after rejection: ${reason}`
          }
        });

        const reassignedPayload = {
          id: visitId,
          _id: visitId,
          visitId,
          assignedWaiterId: alternative.waiter.id,
          assignmentStatus: 'PENDING_ACCEPTANCE',
          assignmentTimeoutAt: timeoutAt
        };

        RealtimeService.orderAssigned({ waiterId: alternative.waiter.id, order: reassignedPayload });
        RealtimeService.orderUpdated({ restaurantId, order: reassignedPayload, orderId: visitId, tableId: visit.table_id });

        return { order: reassignedPayload, reassignedTo: alternative.waiter, escalated: false };
      }
    }

    // Fallback: Escalated / Unassigned
    await db.update(order_details).set({
      assigned_waiter_id: null,
      updatedat: new Date()
    }).where(eq(order_details.id, visitId));

    await db.insert(assignment_events).values({
      id: crypto.randomUUID(),
      restaurant_id: restaurantId,
      assignment_id: visitId,
      staff_id: null,
      event_type: 'ESCALATED_UNASSIGNED',
      details: {
        targetType: 'ORDER',
        targetId: orderId,
        visitId,
        previousWaiterId,
        action: 'ESCALATED_UNASSIGNED',
        actorRole: 'SYSTEM',
        reason: `Escalated to manager after rejection: ${reason}`
      }
    });

    const unassignedPayload = {
      id: visitId,
      _id: visitId,
      visitId,
      assignedWaiterId: null,
      assignmentStatus: 'UNASSIGNED',
      rejectionReason: reason
    };

    RealtimeService.orderUpdated({ restaurantId, order: unassignedPayload, orderId: visitId, tableId: visit.table_id });

    return { order: unassignedPayload, reassignedTo: null, escalated: true };
  }

  /**
   * 8. Manager Manual Reassignment of an Order
   */
  static async reassignOrder(tenantDb, restaurantId, orderId, newWaiterId, actorId, reason = 'Manager reassignment') {
    let visitId = orderId;
    const [custOrder] = await db.select().from(customer_orders).where(
      and(eq(customer_orders.id, orderId), eq(customer_orders.restaurant_id, restaurantId))
    ).limit(1);
    if (custOrder) visitId = custOrder.visit_id;

    const [visit] = await db.select().from(order_details).where(
      and(eq(order_details.id, visitId), eq(order_details.restaurant_id, restaurantId))
    ).limit(1);

    if (!visit) throw new Error('Order not found');

    const previousWaiterId = visit.assigned_waiter_id;
    let newWaiter = null;

    if (newWaiterId) {
      const [w] = await db.select().from(users).where(
        and(
          eq(users.id, newWaiterId),
          eq(users.restaurant_id, restaurantId),
          eq(users.user_status, 'ACTIVE'),
          eq(users.is_deleted, false)
        )
      ).limit(1);

      if (!w) throw new Error('Target waiter not found or inactive');
      newWaiter = w;
      this.recordAssignment(newWaiterId);
    }

    await db.update(order_details).set({
      assigned_waiter_id: newWaiterId || null,
      updatedat: new Date()
    }).where(eq(order_details.id, visitId));

    const eventId = crypto.randomUUID();
    await db.insert(assignment_events).values({
      id: eventId,
      restaurant_id: restaurantId,
      assignment_id: visitId,
      staff_id: newWaiterId || null,
      event_type: newWaiterId ? 'MANUAL_REASSIGN' : 'UNASSIGNED',
      details: {
        targetType: 'ORDER',
        targetId: orderId,
        visitId,
        previousWaiterId,
        newWaiterId,
        waiterName: newWaiter?.name || null,
        actorId,
        actorRole: 'MANAGER',
        reason
      }
    });

    const updatedOrder = {
      id: visitId,
      _id: visitId,
      visitId,
      assignedWaiterId: newWaiterId || null,
      assignmentStatus: newWaiterId ? 'ASSIGNED' : 'UNASSIGNED'
    };

    RealtimeService.orderUpdated({ restaurantId, order: updatedOrder, orderId: visitId, tableId: visit.table_id });
    if (newWaiterId) {
      RealtimeService.orderAssigned({ waiterId: newWaiterId, order: updatedOrder });
    }
    if (previousWaiterId && previousWaiterId !== newWaiterId) {
      RealtimeService.emit(`waiter_user:${previousWaiterId}`, 'order_unassigned', { orderId: visitId, reason });
    }

    return updatedOrder;
  }

  /**
   * 9. Check and Reassign Timed Out Orders (CRON worker)
   */
  static async checkAssignmentTimeouts(tenantDb, restaurantId) {
    if (tenantDb && typeof tenantDb.model === 'function') {
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
        }).catch(() => {});

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

    // PostgreSQL Drizzle ORM
    try {
      const settings = await this.getSettings(null, restaurantId);
      const timeoutMinutes = settings.acceptanceTimeoutMinutes || 3;
      const timeoutThreshold = new Date(Date.now() - timeoutMinutes * 60000);

      const pendingOrders = await db.select().from(order_details).where(
        and(
          eq(order_details.restaurant_id, restaurantId),
          eq(order_details.app_status, 'PENDING'),
          sql`${order_details.assigned_waiter_id} IS NOT NULL`,
          sql`${order_details.order_status} NOT IN ('COMPLETED', 'CANCELLED', 'PAID')`,
          sql`${order_details.updatedat} <= ${timeoutThreshold}`
        )
      );

      const results = [];
      for (const ord of pendingOrders) {
        const prevWaiterId = ord.assigned_waiter_id;

        await db.insert(assignment_events).values({
          id: crypto.randomUUID(),
          restaurant_id: restaurantId,
          assignment_id: ord.id,
          staff_id: prevWaiterId,
          event_type: 'TIMEOUT',
          details: {
            targetType: 'ORDER',
            targetId: ord.id,
            previousWaiterId: prevWaiterId,
            action: 'TIMEOUT',
            actorRole: 'SYSTEM',
            reason: `Acceptance timeout (${timeoutMinutes}m) exceeded`
          }
        });

        let table = null;
        if (ord.table_id) {
          const [tbl] = await db.select().from(tables).where(eq(tables.id, ord.table_id)).limit(1);
          table = tbl;
        }

        if (settings.reassignmentPolicy === 'AUTO_REASSIGN') {
          const candidates = await this.findEligibleWaiters(null, restaurantId, table, settings);
          const nextCandidate = candidates.find(c => c.waiter.id !== prevWaiterId);

          if (nextCandidate) {
            await db.update(order_details).set({
              assigned_waiter_id: nextCandidate.waiter.id,
              updatedat: new Date()
            }).where(eq(order_details.id, ord.id));

            this.recordAssignment(nextCandidate.waiter.id);

            await db.insert(assignment_events).values({
              id: crypto.randomUUID(),
              restaurant_id: restaurantId,
              assignment_id: ord.id,
              staff_id: nextCandidate.waiter.id,
              event_type: 'REASSIGNED',
              details: {
                targetType: 'ORDER',
                targetId: ord.id,
                previousWaiterId: prevWaiterId,
                newWaiterId: nextCandidate.waiter.id,
                action: 'REASSIGNED',
                actorRole: 'SYSTEM',
                reason: 'Auto-reassigned due to previous waiter timeout'
              }
            });

            const updatedOrder = {
              id: ord.id,
              _id: ord.id,
              assignedWaiterId: nextCandidate.waiter.id,
              assignmentStatus: 'PENDING_ACCEPTANCE'
            };

            RealtimeService.orderAssigned({ waiterId: nextCandidate.waiter.id, order: updatedOrder });
            RealtimeService.orderUpdated({ restaurantId, order: updatedOrder, orderId: ord.id, tableId: ord.table_id });

            results.push({ orderId: ord.id, action: 'REASSIGNED', newWaiterId: nextCandidate.waiter.id });
            continue;
          }
        }

        // Escalated / Unassigned
        await db.update(order_details).set({
          assigned_waiter_id: null,
          updatedat: new Date()
        }).where(eq(order_details.id, ord.id));

        await db.insert(assignment_events).values({
          id: crypto.randomUUID(),
          restaurant_id: restaurantId,
          assignment_id: ord.id,
          staff_id: null,
          event_type: 'ESCALATED_UNASSIGNED',
          details: {
            targetType: 'ORDER',
            targetId: ord.id,
            previousWaiterId: prevWaiterId,
            action: 'ESCALATED_UNASSIGNED',
            actorRole: 'SYSTEM',
            reason: 'Order timed out and escalated to manager (no alternative waiter available)'
          }
        });

        const unassignedOrder = {
          id: ord.id,
          _id: ord.id,
          assignedWaiterId: null,
          assignmentStatus: 'UNASSIGNED'
        };

        RealtimeService.orderUpdated({ restaurantId, order: unassignedOrder, orderId: ord.id, tableId: ord.table_id });
        RealtimeService.emit(`restaurant:${restaurantId}`, 'assignment_escalated', { orderId: ord.id, reason: 'Timeout escalated' });

        results.push({ orderId: ord.id, action: 'ESCALATED_UNASSIGNED' });
      }

      return results;
    } catch (err) {
      console.error('[WaiterAssignmentService.checkAssignmentTimeouts] DB error:', err);
      return [];
    }
  }

  /**
   * 10. Audit Trail: Retrieve assignment history for restaurant
   */
  static async getAssignmentHistory(restaurantId, limit = 100) {
    try {
      const events = await db.select().from(assignment_events).where(
        eq(assignment_events.restaurant_id, restaurantId)
      ).orderBy(desc(assignment_events.createdat)).limit(limit);

      return events.map(e => ({
        _id: e.id,
        id: e.id,
        restaurantId: e.restaurant_id,
        assignmentId: e.assignment_id,
        staffId: e.staff_id,
        eventType: e.event_type,
        action: e.details?.action || e.event_type,
        targetType: e.details?.targetType || 'ORDER',
        targetId: e.details?.targetId || e.assignment_id,
        tableId: e.details?.tableId,
        tableNumber: e.details?.tableNumber,
        previousWaiterId: e.details?.previousWaiterId,
        newWaiterId: e.details?.newWaiterId || e.staff_id,
        waiterName: e.details?.waiterName,
        assignmentMode: e.details?.assignmentMode,
        score: e.details?.score,
        scoreDetails: e.details?.scoreDetails,
        reason: e.details?.reason,
        actorId: e.details?.actorId,
        actorRole: e.details?.actorRole || 'SYSTEM',
        createdAt: e.createdat
      }));
    } catch (err) {
      console.error('[WaiterAssignmentService.getAssignmentHistory] error:', err);
      return [];
    }
  }

  /**
   * 11. Retrieve waiters with calculated live workloads and capacities
   */
  static async getWaitersWithWorkload(restaurantId) {
    const settings = await this.getSettings(null, restaurantId);

    const staffRows = await db.select().from(users).where(
      and(
        eq(users.restaurant_id, restaurantId),
        eq(users.user_type, 'STAFF'),
        eq(users.is_deleted, false)
      )
    );

    const activeAssignments = await db.select().from(tables_assignment).where(
      and(
        eq(tables_assignment.restaurant_id, restaurantId),
        eq(tables_assignment.assignment_status, 'ASSIGNED')
      )
    );

    const tableRows = await db.select().from(tables).where(
      and(
        eq(tables.restaurant_id, restaurantId),
        eq(tables.is_deleted, false)
      )
    );
    const tableCodeMap = new Map(tableRows.map(t => [t.id, t.table_code]));

    const assignedTablesMap = new Map();
    for (const a of activeAssignments) {
      if (!assignedTablesMap.has(a.staff_id)) {
        assignedTablesMap.set(a.staff_id, []);
      }
      assignedTablesMap.get(a.staff_id).push(tableCodeMap.get(a.table_id) || 'Table');
    }

    const result = [];
    for (const st of staffRows) {
      const presence = await this.getOrRestoreWaiterPresence(st.id, restaurantId);
      const { activeOrdersCount, activeRequestsCount, totalWorkload } = await this.getWaiterWorkload(
        null,
        restaurantId,
        st.id
      );

      const capacity = presence.workloadCapacity || settings.defaultCapacity || 5;

      result.push({
        _id: st.id,
        id: st.id,
        name: st.name,
        email: st.email,
        phone: st.phone_number,
        shiftStatus: presence.shiftStatus,
        availabilityStatus: presence.availabilityStatus,
        acceptingOrders: presence.acceptingOrders,
        workloadCapacity: capacity,
        sections: presence.sections || [],
        assignedTables: assignedTablesMap.get(st.id) || [],
        activeOrdersCount,
        activeRequestsCount,
        totalWorkload,
        lastAssignedAt: presence.lastAssignedAt
      });
    }

    return result;
  }
}

module.exports = WaiterAssignmentService;
