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
});
