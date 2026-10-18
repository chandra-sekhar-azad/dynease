const test = require('node:test');
const assert = require('node:assert/strict');
const { db, schema, pool } = require('../src/db/client');
const { eq, and, sql } = require('drizzle-orm');
const LifecycleService = require('../src/services/LifecycleService');
const OrderService = require('../src/services/OrderService');
const TableAssignmentService = require('../src/services/TableAssignmentService');
const { generateDailyRosters } = require('../src/jobs/rosterJobs');

// SAFETY: this suite creates orders, assignments and rosters. It must never run
// against production. It is opt-in and must point at a disposable database.
const RUN_DB_TESTS = process.env.RUN_DB_TESTS === 'true';

test('Dynease Supabase PostgreSQL + Drizzle ORM Integration Suite',
  { skip: RUN_DB_TESTS ? false : 'Writes data. Set RUN_DB_TESTS=true and point DATABASE_URL at a NON-production database to run.' },
  async (t) => {
  await t.test('1. Database Connection and Schema verification', async () => {
    const res = await pool.query('SELECT 1 + 1 AS result');
    assert.equal(res.rows[0].result, 2);

    const [plan] = await db.select().from(schema.plans).limit(1);
    assert.ok(plan, 'Plans table should have rows');
    assert.ok(plan.name, 'Plan should have a name');
  });

  await t.test('2. Case-insensitive unique restaurant domain & non-deleted constraints', async () => {
    const [existing] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.is_deleted, false)).limit(1);
    assert.ok(existing, 'Should have an active restaurant');

    let duplicateCaught = false;
    try {
      await db.insert(schema.restaurants).values({
        id: 'dup_test_' + Date.now(),
        name: 'Duplicate Domain Test',
        domain: existing.domain.toUpperCase(),
        plan_id: existing.plan_id,
        restaurant_status: 'ACTIVE',
        is_deleted: false
      });
    } catch (err) {
      if (err.cause?.code === '23505' || /unique|uq_restaurants_domain_active/i.test(err.cause?.message || err.message)) {
        duplicateCaught = true;
      }
    }
    assert.equal(duplicateCaught, true, 'Case-insensitive duplicate domain must be rejected by PostgreSQL index');
  });

  await t.test('3. Table limits & QR Code uniqueness', async () => {
    const [existingTable] = await db.select().from(schema.tables).where(eq(schema.tables.is_deleted, false)).limit(1);
    assert.ok(existingTable, 'Should have existing table');

    let qrDuplicateCaught = false;
    try {
      await db.insert(schema.tables).values({
        id: 'tbl_dup_' + Date.now(),
        restaurant_id: existingTable.restaurant_id,
        table_code: 'T9999',
        qr_token: existingTable.qr_token,
        table_status: 'ACTIVE'
      });
    } catch (err) {
      if (err.cause?.code === '23505' || /unique|tables_qr_token_unique/i.test(err.cause?.message || err.message)) {
        qrDuplicateCaught = true;
      }
    }
    assert.equal(qrDuplicateCaught, true, 'Duplicate QR token must be rejected by unique constraint');
  });

  await t.test('4. Manual and Dynamic Waiter Assignment lifecycle', async () => {
    const [restaurant] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.is_deleted, false)).limit(1);
    const [table] = await db.select().from(schema.tables).where(eq(schema.tables.restaurant_id, restaurant.id)).limit(1);
    const [staff] = await db.select().from(schema.users).where(eq(schema.users.restaurant_id, restaurant.id)).limit(1);

    if (table && staff) {
      // Manual assign
      const asgn1 = await TableAssignmentService.assignWaiterManually({
        restaurantId: restaurant.id,
        tableId: table.id,
        staffId: staff.id,
        actorId: staff.id
      });
      assert.equal(asgn1.assignment_status, 'ASSIGNED');
      assert.equal(asgn1.assignment_type, 'MANUAL');

      // Partial unique constraint: cannot have two active assignments for same table
      let assignmentConflictCaught = false;
      try {
        await db.insert(schema.tables_assignment).values({
          id: 'conflict_' + Date.now(),
          restaurant_id: restaurant.id,
          table_id: table.id,
          staff_id: staff.id,
          assignment_status: 'ASSIGNED',
          assignment_type: 'MANUAL'
        });
      } catch (err) {
        if (err.cause?.code === '23505' || /unique|uq_table_active_assignment/i.test(err.cause?.message || err.message)) {
          assignmentConflictCaught = true;
        }
      }
      assert.equal(assignmentConflictCaught, true, 'Cannot have two active assignments on same table');

      // Release assignment
      await TableAssignmentService.releaseAssignment({
        restaurantId: restaurant.id,
        tableId: table.id,
        actorId: staff.id
      });
    }
  });

  await t.test('5. Transactional Order Creation and Server-Side Pricing', async () => {
    const [restaurant] = await db.select().from(schema.restaurants).where(eq(schema.restaurants.is_deleted, false)).limit(1);
    const [table] = await db.select().from(schema.tables).where(eq(schema.tables.restaurant_id, restaurant.id)).limit(1);
    const [item] = await db.select().from(schema.menu_categories_items).where(
      and(
        eq(schema.menu_categories_items.restaurant_id, restaurant.id),
        eq(schema.menu_categories_items.menu_item_status, 'AVAILABLE')
      )
    ).limit(1);

    if (table && item) {
      const idempotencyKey = 'IDEMP-' + Date.now();
      const orderPayload = {
        restaurant_id: restaurant.id,
        table_id: table.id,
        customer_name: 'Test Customer',
        customer_phone: '9988776655',
        items: [
          { menu_item_id: item.id, quantity: 2 }
        ],
        idempotency_key: idempotencyKey
      };

      const result = await OrderService.createOrder(orderPayload);
      assert.ok(result.order, 'Order should be created');
      assert.equal(result.items.length, 1);
      const expectedTotal = (parseFloat(item.price) * 2).toFixed(2);
      assert.equal(result.order.total_amount, expectedTotal);
      assert.equal(result.duplicate, false);

      // Idempotent retry check
      const retryResult = await OrderService.createOrder(orderPayload);
      assert.equal(retryResult.duplicate, true);
      assert.equal(retryResult.order.id, result.order.id);

      // Complete order check
      const completed = await OrderService.completeOrder(result.order.id, restaurant.id);
      assert.equal(completed.app_status, 'COMPLETED');
    }
  });

  await t.test('6. Restaurant and User Lifecycle Rules & Session Invalidation', async () => {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.user_status, 'ACTIVE')).limit(1);
    if (user) {
      const initialVersion = user.sessionVersion;
      const updatedUser = await LifecycleService.deactivateUser(user.id);
      assert.equal(updatedUser.user_status, 'INACTIVE');
      assert.equal(updatedUser.sessionVersion, initialVersion + 1);

      // Reactivate
      await db.update(schema.users).set({ user_status: 'ACTIVE' }).where(eq(schema.users.id, user.id));
    }
  });

  await t.test('7. Daily Roster Cron Idempotency', async () => {
    const dateStr = '2026-10-15';
    const run1 = await generateDailyRosters(dateStr);
    assert.ok(run1.createdCount >= 0);

    const run2 = await generateDailyRosters(dateStr);
    assert.equal(run2.createdCount, 0, 'Second run for same date must not create duplicate roster records');
  });

  await t.test('8. Audit Log Verification', async () => {
    const [audit] = await db.select().from(schema.audit_log).orderBy(sql`${schema.audit_log.createdat} DESC`).limit(1);
    assert.ok(audit, 'Audit log entries should exist');
    assert.ok(audit.action, 'Audit action must be populated');
  });

  // Cleanly close pool so test process terminates
  await pool.end();
});
