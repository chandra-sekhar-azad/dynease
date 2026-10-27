const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { db, schema, pool } = require('../src/db/client');
const { eq, and, sql, isNull, asc } = require('drizzle-orm');
const CategoryOrderingService = require('../src/services/CategoryOrderingService');
const restaurantController = require('../src/controllers/restaurantController');

const { menu_categories, restaurants, plans } = schema;

describe('Category Priority Automatic Positional Shifting Suite', () => {
  let samplePlanId;
  let restaurantA;
  let restaurantB;
  let singleCatRestaurant;
  let categoriesA = [];

  // Helper to fetch active categories sorted by display_order
  async function getSortedCategories(restaurantId) {
    return await db.select().from(menu_categories).where(
      and(
        eq(menu_categories.restaurant_id, restaurantId),
        isNull(menu_categories.deletedat)
      )
    ).orderBy(asc(menu_categories.display_order));
  }

  before(async () => {
    // 1. Get an existing plan id
    const [plan] = await db.select().from(plans).limit(1);
    samplePlanId = plan ? plan.id : null;

    // 2. Create Restaurant A for main scenarios
    const [rA] = await db.insert(restaurants).values({
      name: 'Priority Test Restaurant A',
      restaurant_name: 'Priority Test Restaurant A',
      domain: `priority-test-a-${Date.now()}`,
      plan_id: samplePlanId,
      restaurant_status: 'ACTIVE'
    }).returning();
    restaurantA = rA;

    // 3. Create 15 categories for Restaurant A (1 through 15)
    for (let i = 1; i <= 15; i++) {
      const [cat] = await db.insert(menu_categories).values({
        restaurant_id: restaurantA.id,
        category: `Category ${String(i).padStart(2, '0')}`,
        display_order: i,
        menu_category_status: 'ACTIVE'
      }).returning();
      categoriesA.push(cat);
    }
  });

  after(async () => {
    // Clean up all created test data
    if (restaurantA) {
      await db.delete(menu_categories).where(eq(menu_categories.restaurant_id, restaurantA.id));
      await db.delete(restaurants).where(eq(restaurants.id, restaurantA.id));
    }
    if (restaurantB) {
      await db.delete(menu_categories).where(eq(menu_categories.restaurant_id, restaurantB.id));
      await db.delete(restaurants).where(eq(restaurants.id, restaurantB.id));
    }
    if (singleCatRestaurant) {
      await db.delete(menu_categories).where(eq(menu_categories.restaurant_id, singleCatRestaurant.id));
      await db.delete(restaurants).where(eq(restaurants.id, singleCatRestaurant.id));
    }
    await pool.end();
  });

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 1: Move priority 2 to priority 10
  // ─────────────────────────────────────────────────────────────
  it('Scenario 1: Move priority 2 to priority 10 (downward shift)', async () => {
    const listBefore = await getSortedCategories(restaurantA.id);
    const catAt2 = listBefore.find(c => c.display_order === 2);
    assert.ok(catAt2, 'Category at priority 2 must exist');

    const result = await CategoryOrderingService.reorderCategory({
      restaurantId: restaurantA.id,
      categoryId: catAt2.id,
      targetPriority: 10
    });

    assert.equal(result.moved, true);
    assert.equal(result.oldPriority, 2);
    assert.equal(result.targetPriority, 10);

    const listAfter = await getSortedCategories(restaurantA.id);
    assert.equal(listAfter.length, 15);

    // Verify priorities are strictly continuous 1..15
    const priorities = listAfter.map(c => c.display_order);
    assert.deepEqual(priorities, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

    // Priority 1 outside range must remain unchanged
    const catAt1 = listAfter.find(c => c.display_order === 1);
    assert.equal(catAt1.category, 'Category 01');

    // Categories in (2, 10] shifted up by 1 (display_order - 1)
    // Old 3 is now 2, Old 4 is now 3, ..., Old 10 is now 9
    assert.equal(listAfter.find(c => c.display_order === 2).category, 'Category 03');
    assert.equal(listAfter.find(c => c.display_order === 3).category, 'Category 04');
    assert.equal(listAfter.find(c => c.display_order === 9).category, 'Category 10');

    // The moved category is now at priority 10
    const catMoved = listAfter.find(c => c.display_order === 10);
    assert.equal(catMoved.id, catAt2.id);
    assert.equal(catMoved.category, 'Category 02');

    // Categories > 10 outside range must remain unchanged
    assert.equal(listAfter.find(c => c.display_order === 11).category, 'Category 11');
    assert.equal(listAfter.find(c => c.display_order === 15).category, 'Category 15');
  });

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 2: Move priority 15 to priority 11
  // ─────────────────────────────────────────────────────────────
  it('Scenario 2: Move priority 15 to priority 11 (upward shift)', async () => {
    const listBefore = await getSortedCategories(restaurantA.id);
    const catAt15 = listBefore.find(c => c.display_order === 15);
    assert.ok(catAt15, 'Category at priority 15 must exist');

    const result = await CategoryOrderingService.reorderCategory({
      restaurantId: restaurantA.id,
      categoryId: catAt15.id,
      targetPriority: 11
    });

    assert.equal(result.moved, true);
    assert.equal(result.oldPriority, 15);
    assert.equal(result.targetPriority, 11);

    const listAfter = await getSortedCategories(restaurantA.id);
    assert.equal(listAfter.length, 15);

    // Priorities must be continuous 1..15
    const priorities = listAfter.map(c => c.display_order);
    assert.deepEqual(priorities, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

    // Categories 1..10 outside affected range must remain unchanged
    const catAt10 = listAfter.find(c => c.display_order === 10);
    assert.equal(catAt10.category, 'Category 02');

    // The moved category is now at priority 11
    const catMoved = listAfter.find(c => c.display_order === 11);
    assert.equal(catMoved.id, catAt15.id);
    assert.equal(catMoved.category, 'Category 15');

    // Categories in [11, 15) shifted down by 1 (+1)
    // What was at 11 before (Category 11) is now at 12
    assert.equal(listAfter.find(c => c.display_order === 12).category, 'Category 11');
    assert.equal(listAfter.find(c => c.display_order === 13).category, 'Category 12');
    assert.equal(listAfter.find(c => c.display_order === 14).category, 'Category 13');
    assert.equal(listAfter.find(c => c.display_order === 15).category, 'Category 14');
  });

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 3: Move priority 10 to priority 2
  // ─────────────────────────────────────────────────────────────
  it('Scenario 3: Move priority 10 to priority 2 (upward shift)', async () => {
    const listBefore = await getSortedCategories(restaurantA.id);
    const catAt10 = listBefore.find(c => c.display_order === 10);
    assert.ok(catAt10, 'Category at priority 10 must exist');

    const result = await CategoryOrderingService.reorderCategory({
      restaurantId: restaurantA.id,
      categoryId: catAt10.id,
      targetPriority: 2
    });

    assert.equal(result.moved, true);
    assert.equal(result.oldPriority, 10);
    assert.equal(result.targetPriority, 2);

    const listAfter = await getSortedCategories(restaurantA.id);
    assert.equal(listAfter.length, 15);

    // Priorities must remain continuous 1..15
    const priorities = listAfter.map(c => c.display_order);
    assert.deepEqual(priorities, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

    // Priority 1 outside range must remain unchanged
    assert.equal(listAfter.find(c => c.display_order === 1).category, 'Category 01');

    // The moved category is now at priority 2
    const catMoved = listAfter.find(c => c.display_order === 2);
    assert.equal(catMoved.id, catAt10.id);
    assert.equal(catMoved.category, 'Category 02');

    // Categories previously at [2, 10) shifted down by 1 (+1)
    // What was at 2 before (Category 03) is now at 3
    assert.equal(listAfter.find(c => c.display_order === 3).category, 'Category 03');

    // Categories > 10 outside range must remain unchanged
    assert.equal(listAfter.find(c => c.display_order === 11).category, 'Category 15');
    assert.equal(listAfter.find(c => c.display_order === 12).category, 'Category 11');
  });

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 4: Move the first category to the last position
  // ─────────────────────────────────────────────────────────────
  it('Scenario 4: Move the first category to the last position', async () => {
    const listBefore = await getSortedCategories(restaurantA.id);
    const firstCat = listBefore[0];
    assert.equal(firstCat.display_order, 1);

    const result = await CategoryOrderingService.reorderCategory({
      restaurantId: restaurantA.id,
      categoryId: firstCat.id,
      targetPriority: 15
    });

    assert.equal(result.moved, true);
    assert.equal(result.oldPriority, 1);
    assert.equal(result.targetPriority, 15);

    const listAfter = await getSortedCategories(restaurantA.id);
    assert.equal(listAfter.length, 15);

    // Priorities must be continuous 1..15
    const priorities = listAfter.map(c => c.display_order);
    assert.deepEqual(priorities, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

    // What was at 2 before (Category 02) is now at 1
    assert.equal(listAfter[0].category, 'Category 02');
    assert.equal(listAfter[0].display_order, 1);

    // The moved first category is now at the last position (15)
    const lastCat = listAfter[14];
    assert.equal(lastCat.id, firstCat.id);
    assert.equal(lastCat.category, 'Category 01');
    assert.equal(lastCat.display_order, 15);
  });

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 5: Move the last category to the first position
  // ─────────────────────────────────────────────────────────────
  it('Scenario 5: Move the last category to the first position', async () => {
    const listBefore = await getSortedCategories(restaurantA.id);
    const lastCat = listBefore[listBefore.length - 1];
    assert.equal(lastCat.display_order, 15);

    const result = await CategoryOrderingService.reorderCategory({
      restaurantId: restaurantA.id,
      categoryId: lastCat.id,
      targetPriority: 1
    });

    assert.equal(result.moved, true);
    assert.equal(result.oldPriority, 15);
    assert.equal(result.targetPriority, 1);

    const listAfter = await getSortedCategories(restaurantA.id);
    assert.equal(listAfter.length, 15);

    // Priorities must be continuous 1..15
    const priorities = listAfter.map(c => c.display_order);
    assert.deepEqual(priorities, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

    // The last category is now first (1)
    assert.equal(listAfter[0].id, lastCat.id);
    assert.equal(listAfter[0].display_order, 1);

    // What was at 1 (Category 02) is now at 2
    assert.equal(listAfter[1].category, 'Category 02');
    assert.equal(listAfter[1].display_order, 2);
  });

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 6: Move a category to its current position
  // ─────────────────────────────────────────────────────────────
  it('Scenario 6: Move a category to its current position (no-op)', async () => {
    const listBefore = await getSortedCategories(restaurantA.id);
    const catAt5 = listBefore.find(c => c.display_order === 5);
    assert.ok(catAt5);

    const result = await CategoryOrderingService.reorderCategory({
      restaurantId: restaurantA.id,
      categoryId: catAt5.id,
      targetPriority: 5
    });

    assert.equal(result.moved, false, 'Moving to current position must be a no-op');
    assert.equal(result.oldPriority, 5);
    assert.equal(result.targetPriority, 5);

    const listAfter = await getSortedCategories(restaurantA.id);
    for (let i = 0; i < listBefore.length; i++) {
      assert.equal(listAfter[i].id, listBefore[i].id);
      assert.equal(listAfter[i].display_order, listBefore[i].display_order);
    }
  });

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 7: Submit an invalid priority (0, negative, non-integer)
  // ─────────────────────────────────────────────────────────────
  it('Scenario 7: Submit an invalid priority such as 0, negative number, or non-integer', async () => {
    const invalidInputs = [0, -1, -100, 2.5, 'abc', '1.5', null, undefined, '', '   '];

    for (const invalid of invalidInputs) {
      assert.throws(
        () => CategoryOrderingService.validatePriority(invalid),
        (err) => {
          assert.equal(err.statusCode, 400);
          return true;
        },
        `Expected rejection for invalid priority: ${JSON.stringify(invalid)}`
      );
    }

    // Verify valid positive integers pass
    assert.equal(CategoryOrderingService.validatePriority(1), 1);
    assert.equal(CategoryOrderingService.validatePriority('10'), 10);
    assert.equal(CategoryOrderingService.validatePriority(99), 99);

    // Verify controller returns 400 Bad Request on invalid priority
    const list = await getSortedCategories(restaurantA.id);
    const cat = list[0];

    let statusCode = null;
    let jsonBody = null;
    const mockRes = {
      status(c) { statusCode = c; return this; },
      json(b) { jsonBody = b; return this; }
    };

    await restaurantController.updateCategory({
      user: { restaurantId: restaurantA.id },
      params: { id: cat.id },
      body: { displayOrder: 0 }
    }, mockRes);

    assert.equal(statusCode, 400);
    assert.equal(jsonBody.success, false);
    assert.match(jsonBody.message, /valid integer/i);
  });

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 8: Reorder categories when only one category exists
  // ─────────────────────────────────────────────────────────────
  it('Scenario 8: Reorder categories when only one category exists', async () => {
    const [singleRest] = await db.insert(restaurants).values({
      name: 'Single Cat Restaurant',
      restaurant_name: 'Single Cat Restaurant',
      domain: `single-cat-${Date.now()}`,
      plan_id: samplePlanId,
      restaurant_status: 'ACTIVE'
    }).returning();
    singleCatRestaurant = singleRest;

    const [onlyCat] = await db.insert(menu_categories).values({
      restaurant_id: singleCatRestaurant.id,
      category: 'Only Category',
      display_order: 1,
      menu_category_status: 'ACTIVE'
    }).returning();

    // Attempting to move it to 5 or 2
    const result = await CategoryOrderingService.reorderCategory({
      restaurantId: singleCatRestaurant.id,
      categoryId: onlyCat.id,
      targetPriority: 5
    });

    assert.equal(result.moved, false);
    assert.equal(result.targetPriority, 1);

    const [catAfter] = await getSortedCategories(singleCatRestaurant.id);
    assert.equal(catAfter.display_order, 1);
  });

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 9: Different restaurants remain completely independent
  // ─────────────────────────────────────────────────────────────
  it('Scenario 9: Reorder categories belonging to different restaurants and verify priorities remain independent', async () => {
    const [rB] = await db.insert(restaurants).values({
      name: 'Independent Restaurant B',
      restaurant_name: 'Independent Restaurant B',
      domain: `independent-b-${Date.now()}`,
      plan_id: samplePlanId,
      restaurant_status: 'ACTIVE'
    }).returning();
    restaurantB = rB;

    // Create 3 categories in Restaurant B (1, 2, 3)
    const bCats = [];
    for (let i = 1; i <= 3; i++) {
      const [c] = await db.insert(menu_categories).values({
        restaurant_id: restaurantB.id,
        category: `B Category ${i}`,
        display_order: i,
        menu_category_status: 'ACTIVE'
      }).returning();
      bCats.push(c);
    }

    // Capture Restaurant A categories before
    const aBefore = await getSortedCategories(restaurantA.id);

    // Reorder B: move priority 1 to priority 3
    const resultB = await CategoryOrderingService.reorderCategory({
      restaurantId: restaurantB.id,
      categoryId: bCats[0].id,
      targetPriority: 3
    });
    assert.equal(resultB.moved, true);

    // Verify Restaurant B categories shifted: B2 is 1, B3 is 2, B1 is 3
    const bAfter = await getSortedCategories(restaurantB.id);
    assert.equal(bAfter[0].category, 'B Category 2');
    assert.equal(bAfter[0].display_order, 1);
    assert.equal(bAfter[1].category, 'B Category 3');
    assert.equal(bAfter[1].display_order, 2);
    assert.equal(bAfter[2].category, 'B Category 1');
    assert.equal(bAfter[2].display_order, 3);

    // Verify Restaurant A categories are COMPLETELY UNTOUCHED
    const aAfter = await getSortedCategories(restaurantA.id);
    assert.equal(aAfter.length, aBefore.length);
    for (let i = 0; i < aBefore.length; i++) {
      assert.equal(aAfter[i].id, aBefore[i].id);
      assert.equal(aAfter[i].display_order, aBefore[i].display_order);
    }
  });

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 10: Simulate failed database update and verify no partial reordering
  // ─────────────────────────────────────────────────────────────
  it('Scenario 10: Simulate a failed database update and verify that no partial reordering is persisted', async () => {
    const listBefore = await getSortedCategories(restaurantA.id);
    const catToMove = listBefore[0]; // currently priority 1

    let errorThrown = false;
    try {
      await db.transaction(async (tx) => {
        // Step 1: Execute reorder within tx
        await CategoryOrderingService.reorderCategory({
          tx,
          restaurantId: restaurantA.id,
          categoryId: catToMove.id,
          targetPriority: 8
        });

        // Step 2: Simulate failure / crash mid-operation
        throw new Error('SIMULATED_TRANSACTION_FAILURE');
      });
    } catch (err) {
      if (err.message === 'SIMULATED_TRANSACTION_FAILURE') {
        errorThrown = true;
      } else {
        throw err;
      }
    }

    assert.equal(errorThrown, true);

    // Verify database state was fully rolled back
    const listAfter = await getSortedCategories(restaurantA.id);
    assert.equal(listAfter.length, listBefore.length);
    for (let i = 0; i < listBefore.length; i++) {
      assert.equal(listAfter[i].id, listBefore[i].id);
      assert.equal(listAfter[i].display_order, listBefore[i].display_order);
    }
  });

  // ─────────────────────────────────────────────────────────────
  // BONUS: Category creation & deletion shifting verification
  // ─────────────────────────────────────────────────────────────
  it('Category Creation & Deletion with automatic positional shifting', async () => {
    // 1. Create a category at priority 2 using shiftForCreate inside a transaction
    let createdCat;
    await db.transaction(async (tx) => {
      const assigned = await CategoryOrderingService.shiftForCreate({
        tx,
        restaurantId: restaurantA.id,
        targetPriority: 2
      });
      assert.equal(assigned, 2);

      const [c] = await tx.insert(menu_categories).values({
        restaurant_id: restaurantA.id,
        category: 'New Temp Cat at 2',
        display_order: assigned,
        menu_category_status: 'ACTIVE'
      }).returning();
      createdCat = c;
    });

    // Verify list has 16 items and continuous 1..16
    const listWithNew = await getSortedCategories(restaurantA.id);
    assert.equal(listWithNew.length, 16);
    assert.deepEqual(listWithNew.map(c => c.display_order), Array.from({ length: 16 }, (_, i) => i + 1));
    assert.equal(listWithNew.find(c => c.display_order === 2).id, createdCat.id);

    // 2. Delete the created category using deleteCategoryWithShift inside a transaction
    await db.transaction(async (tx) => {
      await CategoryOrderingService.deleteCategoryWithShift({
        tx,
        restaurantId: restaurantA.id,
        categoryId: createdCat.id
      });
    });

    // Verify list is back to 15 items and continuous 1..15
    const listAfterDelete = await getSortedCategories(restaurantA.id);
    assert.equal(listAfterDelete.length, 15);
    assert.deepEqual(listAfterDelete.map(c => c.display_order), Array.from({ length: 15 }, (_, i) => i + 1));
    assert.equal(listAfterDelete.find(c => c.id === createdCat.id), undefined);
  });
});
