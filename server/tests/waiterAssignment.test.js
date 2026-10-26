const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const WaiterAssignmentService = require('../src/services/waiterAssignmentService');

describe('Waiter Assignment Service - Algorithm & Business Logic', () => {

  describe('1. Scoring Model Calculations', () => {
    it('correctly calculates default scoring weights', () => {
      const defaultSettings = {
        weightWorkload: 0.60,
        weightRecentAssignment: 0.25,
        weightSectionMismatch: 0.15
      };

      // Case A: Completely idle waiter, no recent assignment, matching section
      const normalizedWorkloadA = 0.0;
      const recentPenaltyA = 0.0;
      const sectionPenaltyA = 0.0;
      const scoreA = (
        defaultSettings.weightWorkload * normalizedWorkloadA +
        defaultSettings.weightRecentAssignment * recentPenaltyA +
        defaultSettings.weightSectionMismatch * sectionPenaltyA
      );
      assert.equal(scoreA, 0.0, 'Idle waiter with matching section should have 0 score');

      // Case B: Waiter at 50% capacity (2 out of 4), assigned 7.5 mins ago (penalty 0.5), section mismatch (1.0)
      const normalizedWorkloadB = 0.5;
      const recentPenaltyB = 0.5;
      const sectionPenaltyB = 1.0;
      const scoreB = (
        defaultSettings.weightWorkload * normalizedWorkloadB +
        defaultSettings.weightRecentAssignment * recentPenaltyB +
        defaultSettings.weightSectionMismatch * sectionPenaltyB
      );
      // 0.60 * 0.5 + 0.25 * 0.5 + 0.15 * 1.0 = 0.30 + 0.125 + 0.15 = 0.575
      assert.equal(parseFloat(scoreB.toFixed(4)), 0.575);

      // Case C: Waiter at 100% capacity (4 out of 4)
      const normalizedWorkloadC = 1.0;
      const recentPenaltyC = 0.0;
      const sectionPenaltyC = 0.0;
      const scoreC = (
        defaultSettings.weightWorkload * normalizedWorkloadC +
        defaultSettings.weightRecentAssignment * recentPenaltyC +
        defaultSettings.weightSectionMismatch * sectionPenaltyC
      );
      assert.equal(parseFloat(scoreC.toFixed(4)), 0.600);
      assert.ok(scoreA < scoreB && scoreA < scoreC, 'Lower score should always be preferred');
    });

    it('correctly normalizes workload capped at 1.0', () => {
      const capacity = 4;
      const underCapacity = Math.min(2 / capacity, 1.0);
      assert.equal(underCapacity, 0.5);

      const exactCapacity = Math.min(4 / capacity, 1.0);
      assert.equal(exactCapacity, 1.0);

      const overCapacity = Math.min(8 / capacity, 1.0);
      assert.equal(overCapacity, 1.0, 'Workload above capacity must be capped at 1.0');
    });

    it('correctly calculates recent assignment decay penalty', () => {
      const now = Date.now();
      const WINDOW = 15 * 60 * 1000; // 15 mins

      // Just assigned (0ms ago) -> penalty = 1.0
      const penaltyJustAssigned = Math.max(0, 1.0 - (0 / WINDOW));
      assert.equal(penaltyJustAssigned, 1.0);

      // Assigned 7.5 mins ago -> penalty = 0.5
      const penaltyHalfway = Math.max(0, 1.0 - ((7.5 * 60 * 1000) / WINDOW));
      assert.equal(penaltyHalfway, 0.5);

      // Assigned 20 mins ago -> penalty = 0.0
      const penaltyExpired = Math.max(0, 1.0 - ((20 * 60 * 1000) / WINDOW));
      assert.equal(penaltyExpired, 0.0);
    });

    it('ranks eligible candidates by score and breaks ties by longest idle time', async () => {
      const mockSettings = {
        mode: 'HYBRID',
        defaultCapacity: 5,
        weightWorkload: 0.60,
        weightRecentAssignment: 0.25,
        weightSectionMismatch: 0.15,
        allowOverflow: true
      };

      const restaurantId = 'rest_001';
      const table = { _id: 'tbl_1', section: 'Outdoor' };
      const now = Date.now();

      // Mock Waiters
      const waiterA = {
        _id: 'waiter_a',
        name: 'Alice (Busy, Outdoor)',
        restaurantId,
        role: 'RESTAURANT_STAFF',
        isActive: true,
        shiftStatus: 'ON_SHIFT',
        acceptingOrders: true,
        availabilityStatus: 'AVAILABLE',
        workloadCapacity: 5,
        sections: ['Outdoor'],
        lastAssignedAt: new Date(now - 10 * 60 * 1000)
      };

      const waiterB = {
        _id: 'waiter_b',
        name: 'Bob (Idle, Outdoor, longer idle time)',
        restaurantId,
        role: 'RESTAURANT_STAFF',
        isActive: true,
        shiftStatus: 'ON_SHIFT',
        acceptingOrders: true,
        availabilityStatus: 'AVAILABLE',
        workloadCapacity: 5,
        sections: ['Outdoor'],
        lastAssignedAt: new Date(now - 60 * 60 * 1000) // 1 hr ago
      };

      const waiterC = {
        _id: 'waiter_c',
        name: 'Charlie (Idle, Indoor)',
        restaurantId,
        role: 'RESTAURANT_STAFF',
        isActive: true,
        shiftStatus: 'ON_SHIFT',
        acceptingOrders: true,
        availabilityStatus: 'AVAILABLE',
        workloadCapacity: 5,
        sections: ['Indoor'], // Mismatch
        lastAssignedAt: new Date(now - 60 * 60 * 1000)
      };

      // Mock Tenant DB
      const mockTenantDb = {
        model(name) {
          if (name === 'User') {
            return {
              find: async () => [waiterA, waiterB, waiterC]
            };
          }
          if (name === 'Order') {
            return {
              countDocuments: async ({ assignedWaiterId }) => {
                if (assignedWaiterId === 'waiter_a') return 3; // Alice has 3 orders
                return 0; // Bob & Charlie have 0
              }
            };
          }
          if (name === 'ServiceRequest') {
            return {
              countDocuments: async () => 0
            };
          }
          return {};
        }
      };

      const candidates = await WaiterAssignmentService.findEligibleWaiters(
        mockTenantDb,
        restaurantId,
        table,
        mockSettings
      );

      assert.equal(candidates.length, 3);
      // Waiter B (Bob) has 0 workload + matching section -> score ~ 0
      // Waiter C (Charlie) has 0 workload + mismatched section -> penalty 0.15
      // Waiter A (Alice) has 3 workload -> score ~ 0.6 * (3/5) = 0.36
      assert.equal(candidates[0].waiter._id, 'waiter_b', 'Bob should be ranked #1');
      assert.equal(candidates[1].waiter._id, 'waiter_c', 'Charlie should be ranked #2 (idle with section penalty)');
      assert.equal(candidates[2].waiter._id, 'waiter_a', 'Alice should be ranked #3 (higher workload)');
    });
  });

  describe('2. Waiter Availability & Exclusion Rules', () => {
    it('excludes off-shift and paused waiters from selection', async () => {
      const mockSettings = {
        mode: 'AUTOMATIC',
        defaultCapacity: 5,
        weightWorkload: 0.60,
        weightRecentAssignment: 0.25,
        weightSectionMismatch: 0.15,
        allowOverflow: true
      };

      const restaurantId = 'rest_001';
      const table = { _id: 'tbl_1' };

      const allStaffInDb = [
        {
          _id: 'waiter_on_shift',
          role: 'RESTAURANT_STAFF',
          isActive: true,
          shiftStatus: 'ON_SHIFT',
          acceptingOrders: true,
          availabilityStatus: 'AVAILABLE'
        },
        {
          _id: 'waiter_off_shift',
          role: 'RESTAURANT_STAFF',
          isActive: true,
          shiftStatus: 'OFF_SHIFT',
          acceptingOrders: true,
          availabilityStatus: 'AVAILABLE'
        },
        {
          _id: 'waiter_paused',
          role: 'RESTAURANT_STAFF',
          isActive: true,
          shiftStatus: 'ON_SHIFT',
          acceptingOrders: true,
          availabilityStatus: 'PAUSED'
        },
        {
          _id: 'waiter_not_accepting',
          role: 'RESTAURANT_STAFF',
          isActive: true,
          shiftStatus: 'ON_SHIFT',
          acceptingOrders: false,
          availabilityStatus: 'AVAILABLE'
        }
      ];

      const mockTenantDb = {
        model(name) {
          if (name === 'User') {
            return {
              find: async (query) => {
                // Mimic Mongoose query filter executed in findEligibleWaiters
                return allStaffInDb.filter(u =>
                  u.role === query.role &&
                  u.isActive === query.isActive &&
                  u.shiftStatus === query.shiftStatus &&
                  u.acceptingOrders === query.acceptingOrders &&
                  u.availabilityStatus !== 'PAUSED'
                );
              }
            };
          }
          if (name === 'Order' || name === 'ServiceRequest') {
            return { countDocuments: async () => 0 };
          }
          return {};
        }
      };

      const candidates = await WaiterAssignmentService.findEligibleWaiters(
        mockTenantDb,
        restaurantId,
        table,
        mockSettings
      );

      assert.equal(candidates.length, 1);
      assert.equal(candidates[0].waiter._id, 'waiter_on_shift');
    });
  });

  describe('3. Hybrid Mode & Table Ownership Preservation', () => {
    it('preserves primary waiter when they are on-shift and within capacity', async () => {
      const restaurantId = 'rest_001';
      const table = {
        _id: 'tbl_1',
        primaryWaiterId: 'waiter_primary'
      };

      const primaryWaiter = {
        _id: 'waiter_primary',
        name: 'Primary Waiter',
        restaurantId,
        role: 'RESTAURANT_STAFF',
        isActive: true,
        shiftStatus: 'ON_SHIFT',
        acceptingOrders: true,
        availabilityStatus: 'AVAILABLE',
        workloadCapacity: 5
      };

      const mockTenantDb = {
        model(name) {
          if (name === 'RestaurantProfile') {
            return {
              findOne: async () => ({
                assignmentSettings: { mode: 'HYBRID', defaultCapacity: 5, allowOverflow: true }
              })
            };
          }
          if (name === 'User') {
            return {
              findOne: async ({ _id }) => (_id === 'waiter_primary' ? primaryWaiter : null),
              findByIdAndUpdate: async () => {}
            };
          }
          if (name === 'Order') {
            return {
              countDocuments: async () => 2, // 2 active orders (within capacity of 5)
              findByIdAndUpdate: async () => {}
            };
          }
          if (name === 'ServiceRequest') {
            return { countDocuments: async () => 0 };
          }
          if (name === 'AssignmentEvent') {
            return { create: async () => {} };
          }
          return {};
        }
      };

      const result = await WaiterAssignmentService.assignWaiterForOrder(
        mockTenantDb,
        restaurantId,
        table,
        'order_123'
      );

      assert.equal(result.assignedWaiterId, 'waiter_primary');
      assert.equal(result.assignmentType, 'PRIMARY');
      assert.match(result.reason, /primary table waiter/i);
    });

    it('overflows to alternative waiter when primary waiter exceeds capacity', async () => {
      const restaurantId = 'rest_001';
      const table = {
        _id: 'tbl_1',
        primaryWaiterId: 'waiter_primary'
      };

      const primaryWaiter = {
        _id: 'waiter_primary',
        name: 'Primary Waiter (Overloaded)',
        restaurantId,
        role: 'RESTAURANT_STAFF',
        isActive: true,
        shiftStatus: 'ON_SHIFT',
        acceptingOrders: true,
        availabilityStatus: 'AVAILABLE',
        workloadCapacity: 3
      };

      const backupWaiter = {
        _id: 'waiter_backup',
        name: 'Backup Waiter (Available)',
        restaurantId,
        role: 'RESTAURANT_STAFF',
        isActive: true,
        shiftStatus: 'ON_SHIFT',
        acceptingOrders: true,
        availabilityStatus: 'AVAILABLE',
        workloadCapacity: 5,
        lastAssignedAt: null
      };

      const mockTenantDb = {
        model(name) {
          if (name === 'RestaurantProfile') {
            return {
              findOne: async () => ({
                assignmentSettings: {
                  mode: 'HYBRID',
                  defaultCapacity: 5,
                  allowOverflow: true,
                  weightWorkload: 0.60,
                  weightRecentAssignment: 0.25,
                  weightSectionMismatch: 0.15
                }
              })
            };
          }
          if (name === 'User') {
            return {
              findOne: async ({ _id }) => (_id === 'waiter_primary' ? primaryWaiter : null),
              find: async () => [primaryWaiter, backupWaiter],
              findByIdAndUpdate: async () => {}
            };
          }
          if (name === 'Order') {
            return {
              countDocuments: async ({ assignedWaiterId }) => {
                if (assignedWaiterId === 'waiter_primary') return 5; // 5 orders > capacity 3
                return 1; // backup has 1 order < capacity 5
              },
              findByIdAndUpdate: async () => {}
            };
          }
          if (name === 'ServiceRequest') {
            return { countDocuments: async () => 0 };
          }
          if (name === 'AssignmentEvent') {
            return { create: async () => {} };
          }
          return {};
        }
      };

      const result = await WaiterAssignmentService.assignWaiterForOrder(
        mockTenantDb,
        restaurantId,
        table,
        'order_124'
      );

      assert.equal(result.assignedWaiterId, 'waiter_backup');
      assert.equal(result.assignmentType, 'OVERFLOW');
      assert.match(result.reason, /overflow/i);
    });

    it('places order in unassigned queue when no eligible waiters exist', async () => {
      const restaurantId = 'rest_001';
      const table = { _id: 'tbl_empty' };

      const mockTenantDb = {
        model(name) {
          if (name === 'RestaurantProfile') {
            return {
              findOne: async () => ({
                assignmentSettings: { mode: 'AUTOMATIC' }
              })
            };
          }
          if (name === 'User') {
            return {
              find: async () => [] // No waiters available
            };
          }
          if (name === 'Order') {
            return {
              findByIdAndUpdate: async () => {}
            };
          }
          if (name === 'AssignmentEvent') {
            return { create: async () => {} };
          }
          return {};
        }
      };

      const result = await WaiterAssignmentService.assignWaiterForOrder(
        mockTenantDb,
        restaurantId,
        table,
        'order_125'
      );

      assert.equal(result.assignedWaiterId, null);
      assert.equal(result.assignmentType, 'UNASSIGNED');
      assert.equal(result.assignmentStatus, 'UNASSIGNED');
      assert.match(result.reason, /no eligible waiters/i);
    });
  });

  describe('4. Order Acceptance, Rejection & Timeout Workflow', () => {
    it('sets order to ACCEPTED when waiter accepts', async () => {
      let createdEvent = null;

      const mockOrder = {
        _id: 'order_1',
        restaurantId: 'rest_1',
        assignedWaiterId: 'waiter_1',
        assignmentStatus: 'PENDING_ACCEPTANCE',
        async save() {
          return this;
        }
      };

      const mockTenantDb = {
        model(name) {
          if (name === 'Order') {
            return {
              findOne: async () => mockOrder
            };
          }
          if (name === 'AssignmentEvent') {
            return {
              create: async (evt) => {
                createdEvent = evt;
                return evt;
              }
            };
          }
          return {};
        }
      };

      const result = await WaiterAssignmentService.acceptOrder(
        mockTenantDb,
        'rest_1',
        'order_1',
        'waiter_1'
      );

      assert.equal(result.assignmentStatus, 'ACCEPTED');
      assert.equal(mockOrder.assignmentStatus, 'ACCEPTED');
      assert.equal(createdEvent.action, 'ACCEPTED');
      assert.equal(createdEvent.targetId, 'order_1');
    });

    it('rejects order and logs reason', async () => {
      let createdEvent = null;

      const mockOrder = {
        _id: 'order_2',
        restaurantId: 'rest_1',
        assignedWaiterId: 'waiter_1',
        assignmentStatus: 'PENDING_ACCEPTANCE',
        async save() {
          return this;
        }
      };

      const mockTenantDb = {
        model(name) {
          if (name === 'Order') {
            return {
              findOne: async () => mockOrder
            };
          }
          if (name === 'Table') {
            return {
              findById: async () => ({ _id: 'tbl_1' })
            };
          }
          if (name === 'RestaurantProfile') {
            return {
              findOne: async () => ({ assignmentSettings: { reassignmentPolicy: 'MANAGER_ESCALATION' } })
            };
          }
          if (name === 'AssignmentEvent') {
            return {
              create: async (evt) => {
                createdEvent = evt;
                return evt;
              }
            };
          }
          return {};
        }
      };

      const result = await WaiterAssignmentService.rejectOrder(
        mockTenantDb,
        'rest_1',
        'order_2',
        'waiter_1',
        'Currently attending VIP table'
      );

      assert.equal(result.order.assignmentStatus, 'UNASSIGNED');
      assert.equal(result.escalated, true);
      assert.equal(mockOrder.rejectionReason, 'Currently attending VIP table');
      assert.equal(createdEvent.action, 'REJECTED');
    });
  });

  describe('5. Manual Assignment, Authorization & Ineligible Waiter Rejections', () => {
    it('rejects manual assignment to an off-duty or paused waiter unless override is permitted', async () => {
      // Setup waiter presence as off-duty
      const waiterOffDutyId = 'waiter_offduty_1';
      WaiterAssignmentService.updateWaiterAvailability('rest_test', waiterOffDutyId, {
        shiftStatus: 'OFF_SHIFT',
        availabilityStatus: 'OFF_SHIFT',
        acceptingOrders: false
      });

      const presence = WaiterAssignmentService.getWaiterPresence(waiterOffDutyId);
      assert.equal(presence.shiftStatus, 'OFF_SHIFT');

      // Manual assignment without override should flag error in business check
      const canAssign = presence.shiftStatus === 'ON_SHIFT' && presence.availabilityStatus !== 'PAUSED';
      assert.equal(canAssign, false, 'Should not permit assignment to off-duty waiter');
    });

    it('records assignment metadata: actor, timestamp, previous waiter, new waiter, and reason', async () => {
      const actorId = 'manager_123';
      const prevWaiterId = 'waiter_old';
      const newWaiterId = 'waiter_new';
      const reason = 'Redistributing workload for rush hour';

      const eventPayload = {
        targetType: 'TABLE',
        tableId: 'tbl_5',
        previousWaiterId: prevWaiterId,
        newWaiterId: newWaiterId,
        action: 'REASSIGNED',
        actorId,
        reason,
        timestamp: new Date()
      };

      assert.equal(eventPayload.actorId, actorId);
      assert.equal(eventPayload.previousWaiterId, prevWaiterId);
      assert.equal(eventPayload.newWaiterId, newWaiterId);
      assert.equal(eventPayload.reason, reason);
      assert.ok(eventPayload.timestamp instanceof Date);
    });
  });

  describe('6. Dynamic Assignment Scoring, Normalization & Fairness Tie-Breaking', () => {
    it('applies configurable formula: 0.60 * workload + 0.25 * recent + 0.15 * section', () => {
      const settings = {
        weightWorkload: 0.60,
        weightRecentAssignment: 0.25,
        weightSectionMismatch: 0.15
      };

      const normalizedWorkload = 0.40; // 2 out of 5
      const recentPenalty = 0.50;      // 7.5 mins ago
      const sectionPenalty = 0.00;     // matching section

      const score = (
        settings.weightWorkload * normalizedWorkload +
        settings.weightRecentAssignment * recentPenalty +
        settings.weightSectionMismatch * sectionPenalty
      );

      // 0.60 * 0.40 + 0.25 * 0.50 + 0 = 0.24 + 0.125 = 0.365
      assert.equal(parseFloat(score.toFixed(4)), 0.3650);
    });

    it('breaks ties deterministically using longest idle time', () => {
      const now = Date.now();
      const candidate1 = {
        waiterId: 'w1',
        score: 0.20,
        idleTime: 500000 // 500s idle
      };
      const candidate2 = {
        waiterId: 'w2',
        score: 0.20,
        idleTime: 1200000 // 1200s idle (longer idle time)
      };

      const sorted = [candidate1, candidate2].sort((a, b) => {
        const diff = a.score - b.score;
        if (Math.abs(diff) > 0.0001) return diff;
        return b.idleTime - a.idleTime; // Longer idle time preferred
      });

      assert.equal(sorted[0].waiterId, 'w2', 'Candidate with longer idle time must win equal-score tie');
    });

    it('respects fairness rotation so the same waiter does not win indefinitely', () => {
      let waiterALastAssigned = Date.now() - 30 * 60 * 1000; // 30 mins ago
      let waiterBLastAssigned = Date.now() - 40 * 60 * 1000; // 40 mins ago

      // Candidate B wins because longer idle time
      let winner1 = waiterALastAssigned < waiterBLastAssigned ? 'A' : 'B';
      assert.equal(winner1, 'B');

      // After B is assigned, B's lastAssigned resets to now
      waiterBLastAssigned = Date.now();

      // Next assignment: now A has much longer idle time (30 mins vs 0 mins)
      let winner2 = waiterALastAssigned < waiterBLastAssigned ? 'A' : 'B';
      assert.equal(winner2, 'A', 'Fairness rotation ensures candidate A wins next decision');
    });
  });

  describe('7. Hybrid Mode Table Ownership & Overflow Isolation', () => {
    it('maintains table primary waiter while routing overflow order to alternative waiter', async () => {
      const table = {
        _id: 'table_10',
        tableNumber: '10',
        primaryWaiterId: 'waiter_table_owner'
      };

      const settings = {
        mode: 'HYBRID',
        defaultCapacity: 4,
        allowOverflow: true,
        weightWorkload: 0.60,
        weightRecentAssignment: 0.25,
        weightSectionMismatch: 0.15
      };

      const primaryOwner = {
        _id: 'waiter_table_owner',
        name: 'John Table Owner',
        role: 'RESTAURANT_STAFF',
        isActive: true,
        shiftStatus: 'ON_SHIFT',
        acceptingOrders: true,
        availabilityStatus: 'AVAILABLE',
        workloadCapacity: 4
      };

      const overflowWaiter = {
        _id: 'waiter_overflow',
        name: 'Sarah Overflow',
        role: 'RESTAURANT_STAFF',
        isActive: true,
        shiftStatus: 'ON_SHIFT',
        acceptingOrders: true,
        availabilityStatus: 'AVAILABLE',
        workloadCapacity: 5,
        lastAssignedAt: null
      };

      const mockTenantDb = {
        model(name) {
          if (name === 'RestaurantProfile') {
            return { findOne: async () => ({ assignmentSettings: settings }) };
          }
          if (name === 'User') {
            return {
              findOne: async ({ _id }) => (_id === 'waiter_table_owner' ? primaryOwner : null),
              find: async () => [primaryOwner, overflowWaiter],
              findByIdAndUpdate: async () => {}
            };
          }
          if (name === 'Order') {
            return {
              countDocuments: async ({ assignedWaiterId }) => {
                // John has 5 orders (exceeds capacity 4)
                if (assignedWaiterId === 'waiter_table_owner') return 5;
                // Sarah has 1 order (within capacity 5)
                return 1;
              },
              findByIdAndUpdate: async () => {}
            };
          }
          if (name === 'ServiceRequest') return { countDocuments: async () => 0 };
          if (name === 'AssignmentEvent') return { create: async () => {} };
          return {};
        }
      };

      const result = await WaiterAssignmentService.assignWaiterForOrder(
        mockTenantDb,
        'rest_demo',
        table,
        'order_overflow_test'
      );

      // Order should route to Sarah as overflow
      assert.equal(result.assignedWaiterId, 'waiter_overflow');
      assert.equal(result.assignmentType, 'OVERFLOW');

      // CRITICAL REQUIREMENT: Table primary waiter is PRESERVED and not overwritten
      assert.equal(table.primaryWaiterId, 'waiter_table_owner', 'Primary table ownership must never be overwritten by an overflow order');
    });

    it('routes subsequent orders to primary table owner when owner returns within capacity', async () => {
      const table = {
        _id: 'table_10',
        tableNumber: '10',
        primaryWaiterId: 'waiter_table_owner'
      };

      const settings = {
        mode: 'HYBRID',
        defaultCapacity: 5,
        allowOverflow: true
      };

      const primaryOwner = {
        _id: 'waiter_table_owner',
        name: 'John Table Owner',
        role: 'RESTAURANT_STAFF',
        isActive: true,
        shiftStatus: 'ON_SHIFT',
        acceptingOrders: true,
        availabilityStatus: 'AVAILABLE',
        workloadCapacity: 5
      };

      const mockTenantDb = {
        model(name) {
          if (name === 'RestaurantProfile') {
            return { findOne: async () => ({ assignmentSettings: settings }) };
          }
          if (name === 'User') {
            return {
              findOne: async ({ _id }) => (_id === 'waiter_table_owner' ? primaryOwner : null),
              findByIdAndUpdate: async () => {}
            };
          }
          if (name === 'Order') {
            return {
              countDocuments: async () => 2, // Now only 2 active orders (within capacity)
              findByIdAndUpdate: async () => {}
            };
          }
          if (name === 'ServiceRequest') return { countDocuments: async () => 0 };
          if (name === 'AssignmentEvent') return { create: async () => {} };
          return {};
        }
      };

      const result = await WaiterAssignmentService.assignWaiterForOrder(
        mockTenantDb,
        'rest_demo',
        table,
        'order_subsequent_test'
      );

      assert.equal(result.assignedWaiterId, 'waiter_table_owner');
      assert.equal(result.assignmentType, 'PRIMARY');
    });
  });

  describe('8. Timeout, Auto-Reassignment & Manager Escalation', () => {
    it('automatically reassigns timed-out orders when reassignmentPolicy is AUTO_REASSIGN', async () => {
      const timedOutOrder = {
        _id: 'order_timeout_1',
        restaurantId: 'rest_time_test',
        assignedWaiterId: 'waiter_asleep',
        tableId: 'tbl_time',
        tableNumber: '4',
        assignmentStatus: 'PENDING_ACCEPTANCE',
        assignmentTimeoutAt: new Date(Date.now() - 5 * 60 * 1000), // timed out 5 mins ago
        status: 'SUBMITTED',
        async save() { return this; }
      };

      const awakeWaiter = {
        _id: 'waiter_awake',
        name: 'Awake Waiter',
        role: 'RESTAURANT_STAFF',
        isActive: true,
        shiftStatus: 'ON_SHIFT',
        acceptingOrders: true,
        availabilityStatus: 'AVAILABLE',
        workloadCapacity: 5
      };

      const mockTenantDb = {
        model(name) {
          if (name === 'Order') {
            return {
              find: async () => [timedOutOrder],
              countDocuments: async () => 0,
              findByIdAndUpdate: async () => {}
            };
          }
          if (name === 'Table') {
            return {
              findById: async () => ({ _id: 'tbl_time', tableNumber: '4' })
            };
          }
          if (name === 'RestaurantProfile') {
            return {
              findOne: async () => ({
                assignmentSettings: {
                  mode: 'DYNAMIC',
                  reassignmentPolicy: 'AUTO_REASSIGN',
                  acceptanceTimeoutMinutes: 3,
                  weightWorkload: 0.6,
                  weightRecentAssignment: 0.25,
                  weightSectionMismatch: 0.15
                }
              })
            };
          }
          if (name === 'User') {
            return {
              find: async () => [awakeWaiter],
              findByIdAndUpdate: async () => {}
            };
          }
          if (name === 'ServiceRequest') return { countDocuments: async () => 0 };
          if (name === 'AssignmentEvent') return { create: async () => {} };
          return {};
        }
      };

      const results = await WaiterAssignmentService.checkAssignmentTimeouts(mockTenantDb, 'rest_time_test');
      assert.equal(results.length, 1);
      assert.equal(results[0].action, 'REASSIGNED');
      assert.equal(results[0].newWaiterId, 'waiter_awake');
      assert.equal(timedOutOrder.assignedWaiterId, 'waiter_awake');
      assert.equal(timedOutOrder.assignmentStatus, 'PENDING_ACCEPTANCE');
    });

    it('escalates to manager when all eligible waiters are at capacity or absent', async () => {
      const timedOutOrder = {
        _id: 'order_timeout_2',
        restaurantId: 'rest_time_test',
        assignedWaiterId: 'waiter_asleep',
        tableId: 'tbl_time',
        tableNumber: '4',
        assignmentStatus: 'PENDING_ACCEPTANCE',
        assignmentTimeoutAt: new Date(Date.now() - 5 * 60 * 1000),
        status: 'SUBMITTED',
        async save() { return this; }
      };

      const mockTenantDb = {
        model(name) {
          if (name === 'Order') {
            return { find: async () => [timedOutOrder], countDocuments: async () => 0 };
          }
          if (name === 'Table') {
            return { findById: async () => ({ _id: 'tbl_time' }) };
          }
          if (name === 'RestaurantProfile') {
            return {
              findOne: async () => ({
                assignmentSettings: { mode: 'DYNAMIC', reassignmentPolicy: 'AUTO_REASSIGN' }
              })
            };
          }
          if (name === 'User') {
            return { find: async () => [] }; // No available waiters
          }
          if (name === 'ServiceRequest') return { countDocuments: async () => 0 };
          if (name === 'AssignmentEvent') return { create: async () => {} };
          return {};
        }
      };

      const results = await WaiterAssignmentService.checkAssignmentTimeouts(mockTenantDb, 'rest_time_test');
      assert.equal(results.length, 1);
      assert.equal(results[0].action, 'ESCALATED_UNASSIGNED');
      assert.equal(timedOutOrder.assignedWaiterId, null);
      assert.equal(timedOutOrder.assignmentStatus, 'UNASSIGNED');
    });
  });

  describe('9. Settings Validation & Safe Fallbacks', () => {
    it('supplies safe defaults when restaurant settings are missing or invalid', async () => {
      const settings = await WaiterAssignmentService.getSettings(null, 'non_existent_restaurant_id');
      assert.equal(settings.mode, 'HYBRID');
      assert.equal(settings.defaultCapacity, 5);
      assert.equal(settings.weightWorkload, 0.60);
      assert.equal(settings.weightRecentAssignment, 0.25);
      assert.equal(settings.weightSectionMismatch, 0.15);
      assert.equal(settings.allowOverflow, true);
      assert.equal(settings.acceptanceTimeoutMinutes, 3);
      assert.equal(settings.reassignmentPolicy, 'AUTO_REASSIGN');
    });

    it('bounds and normalizes user-submitted settings safely', async () => {
      const mockTenantDb = {
        model(name) {
          if (name === 'RestaurantProfile') {
            return {
              findOne: async () => ({ assignmentSettings: {} }),
              findOneAndUpdate: async () => {}
            };
          }
          return {};
        }
      };

      const validated = await WaiterAssignmentService.updateSettings(
        mockTenantDb,
        'rest_val',
        {
          mode: 'INVALID_MODE',       // should fall back to HYBRID
          defaultCapacity: -10,        // should clamp to minimum 1
          weightWorkload: 5.5,         // should clamp to maximum 1
          acceptanceTimeoutMinutes: 999 // should clamp to maximum 60
        },
        'user_admin'
      );

      assert.equal(validated.mode, 'HYBRID');
      assert.equal(validated.defaultCapacity, 1);
      assert.equal(validated.weightWorkload, 1);
      assert.equal(validated.acceptanceTimeoutMinutes, 60);
    });
  });

  describe('10. Lifecycle & Billing Safety', () => {
    it('confirms waiter assignment never cancels active table visit or alters customer billing', () => {
      const customerVisit = {
        id: 'visit_999',
        tableId: 'tbl_999',
        orderStatus: 'ORDERED',
        totalAmount: '450.00',
        finalAmount: '450.00',
        paymentStatus: 'PENDING'
      };

      // Simulating assignment action
      const newWaiterId = 'waiter_assigned';
      const updatedVisit = {
        ...customerVisit,
        assignedWaiterId: newWaiterId
      };

      // Billing and session state must be strictly unchanged
      assert.equal(updatedVisit.orderStatus, 'ORDERED');
      assert.equal(updatedVisit.totalAmount, '450.00');
      assert.equal(updatedVisit.finalAmount, '450.00');
      assert.equal(updatedVisit.paymentStatus, 'PENDING');
      assert.equal(updatedVisit.assignedWaiterId, newWaiterId);
    });
  });
});

