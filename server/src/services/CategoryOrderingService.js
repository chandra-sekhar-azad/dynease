const { db, schema } = require('../db/client');
const { eq, and, sql, isNull, ne } = require('drizzle-orm');
const { menu_categories } = schema;

class CategoryOrderingService {
  /**
   * Validates a requested priority.
   * Must be an integer >= 1.
   * Throws Error with statusCode 400 if invalid.
   */
  static validatePriority(priority) {
    if (priority === null || priority === undefined || priority === '') {
      const err = new Error('Priority is required.');
      err.statusCode = 400;
      throw err;
    }

    const strVal = String(priority).trim();
    if (!/^-?\d+$/.test(strVal)) {
      const err = new Error('Priority must be a valid integer greater than or equal to 1.');
      err.statusCode = 400;
      throw err;
    }

    const num = Number(strVal);
    if (!Number.isInteger(num) || num < 1) {
      const err = new Error('Priority must be a valid integer greater than or equal to 1.');
      err.statusCode = 400;
      throw err;
    }

    return num;
  }

  /**
   * Reorders a category to a new target priority using automatic positional shifting.
   *
   * 1. When Moving Down (oldPriority < targetPriority):
   *    Shift categories in (oldPriority, targetPriority] UP by 1 (decrease display_order by 1).
   * 2. When Moving Up (oldPriority > targetPriority):
   *    Shift categories in [targetPriority, oldPriority) DOWN by 1 (increase display_order by 1).
   * 3. Same Priority (oldPriority === targetPriority):
   *    No shift needed; no-op.
   *
   * Categories outside the affected range remain completely untouched.
   * Scoped strictly by restaurant_id.
   * Runs inside an atomic transaction.
   *
   * @param {Object} options
   * @param {Object} [options.tx] - Optional Drizzle transaction
   * @param {string} options.restaurantId - Restaurant UUID
   * @param {string} options.categoryId - Category UUID
   * @param {number|string} options.targetPriority - Requested destination priority
   * @returns {Promise<{ moved: boolean, oldPriority: number, targetPriority: number, category: Object }>}
   */
  static async reorderCategory({ tx, restaurantId, categoryId, targetPriority }) {
    if (!tx) {
      return await db.transaction(async (t) => {
        return await CategoryOrderingService.reorderCategory({
          tx: t,
          restaurantId,
          categoryId,
          targetPriority
        });
      });
    }

    const runner = tx;
    const validatedTarget = this.validatePriority(targetPriority);

    // 1. Fetch target category
    const [currentCat] = await runner.select().from(menu_categories).where(
      and(
        eq(menu_categories.id, categoryId),
        eq(menu_categories.restaurant_id, restaurantId),
        isNull(menu_categories.deletedat)
      )
    ).limit(1);

    if (!currentCat) {
      const err = new Error('Category not found.');
      err.statusCode = 404;
      throw err;
    }

    const oldPriority = currentCat.display_order;

    // 2. Fetch stats for active categories of this restaurant
    const [stats] = await runner.select({
      maxPriority: sql`MAX(${menu_categories.display_order})`,
      count: sql`COUNT(*)`
    }).from(menu_categories).where(
      and(
        eq(menu_categories.restaurant_id, restaurantId),
        isNull(menu_categories.deletedat)
      )
    );

    const totalCount = parseInt(stats?.count || 0, 10);
    const maxP = stats?.maxPriority !== null && stats?.maxPriority !== undefined
      ? parseInt(stats.maxPriority, 10)
      : totalCount;

    // If only 1 category exists, priority is 1 and cannot shift
    if (totalCount <= 1) {
      if (oldPriority !== 1) {
        const [fixed] = await runner.update(menu_categories).set({
          display_order: 1,
          updatedat: new Date()
        }).where(
          and(
            eq(menu_categories.id, categoryId),
            eq(menu_categories.restaurant_id, restaurantId)
          )
        ).returning();
        return { moved: false, oldPriority, targetPriority: 1, category: fixed };
      }
      return { moved: false, oldPriority: 1, targetPriority: 1, category: currentCat };
    }

    // Determine effective target priority.
    // Clamping to max(maxP, totalCount) ensures priorities remain continuous without gaps.
    const effectiveTarget = Math.max(1, Math.min(validatedTarget, Math.max(maxP, totalCount)));

    // 3. If target priority matches existing priority: no-op, do not update other categories
    if (oldPriority === effectiveTarget) {
      return { moved: false, oldPriority, targetPriority: effectiveTarget, category: currentCat };
    }

    // 4. Moving DOWN: oldPriority < effectiveTarget
    // Shift categories in (oldPriority, effectiveTarget] UP by 1 (decrease display_order by 1)
    if (oldPriority < effectiveTarget) {
      // Step A: Temporarily set target category out of range to avoid transient collisions
      await runner.update(menu_categories).set({
        display_order: -1 * Math.abs(oldPriority || 1) - 1000,
        updatedat: new Date()
      }).where(
        and(
          eq(menu_categories.id, categoryId),
          eq(menu_categories.restaurant_id, restaurantId)
        )
      );

      // Step B: Shift categories strictly in (oldPriority, effectiveTarget] UP by 1
      await runner.update(menu_categories).set({
        display_order: sql`${menu_categories.display_order} - 1`,
        updatedat: new Date()
      }).where(
        and(
          eq(menu_categories.restaurant_id, restaurantId),
          isNull(menu_categories.deletedat),
          ne(menu_categories.id, categoryId),
          sql`${menu_categories.display_order} > ${oldPriority} AND ${menu_categories.display_order} <= ${effectiveTarget}`
        )
      );

      // Step C: Set target category to effectiveTarget
      const [updatedCat] = await runner.update(menu_categories).set({
        display_order: effectiveTarget,
        updatedat: new Date()
      }).where(
        and(
          eq(menu_categories.id, categoryId),
          eq(menu_categories.restaurant_id, restaurantId)
        )
      ).returning();

      return { moved: true, oldPriority, targetPriority: effectiveTarget, category: updatedCat };
    }

    // 5. Moving UP: oldPriority > effectiveTarget
    // Shift categories in [effectiveTarget, oldPriority) DOWN by 1 (increase display_order by 1)
    if (oldPriority > effectiveTarget) {
      // Step A: Temporarily set target category out of range to avoid transient collisions
      await runner.update(menu_categories).set({
        display_order: -1 * Math.abs(oldPriority || 1) - 1000,
        updatedat: new Date()
      }).where(
        and(
          eq(menu_categories.id, categoryId),
          eq(menu_categories.restaurant_id, restaurantId)
        )
      );

      // Step B: Shift categories strictly in [effectiveTarget, oldPriority) DOWN by 1
      await runner.update(menu_categories).set({
        display_order: sql`${menu_categories.display_order} + 1`,
        updatedat: new Date()
      }).where(
        and(
          eq(menu_categories.restaurant_id, restaurantId),
          isNull(menu_categories.deletedat),
          ne(menu_categories.id, categoryId),
          sql`${menu_categories.display_order} >= ${effectiveTarget} AND ${menu_categories.display_order} < ${oldPriority}`
        )
      );

      // Step C: Set target category to effectiveTarget
      const [updatedCat] = await runner.update(menu_categories).set({
        display_order: effectiveTarget,
        updatedat: new Date()
      }).where(
        and(
          eq(menu_categories.id, categoryId),
          eq(menu_categories.restaurant_id, restaurantId)
        )
      ).returning();

      return { moved: true, oldPriority, targetPriority: effectiveTarget, category: updatedCat };
    }
  }

  /**
   * Prepares and shifts priorities for a newly inserted category.
   * If targetPriority is provided, shifts existing categories >= targetPriority down by 1.
   * If omitted, assigns maxPriority + 1.
   *
   * @param {Object} options
   * @param {Object} [options.tx] - Optional Drizzle transaction
   * @param {string} options.restaurantId - Restaurant UUID
   * @param {number|string} [options.targetPriority] - Requested priority or null for next available
   * @returns {Promise<number>} Final display_order to assign
   */
  static async shiftForCreate({ tx, restaurantId, targetPriority }) {
    if (!tx) {
      return await db.transaction(async (t) => {
        return await CategoryOrderingService.shiftForCreate({
          tx: t,
          restaurantId,
          targetPriority
        });
      });
    }

    const runner = tx;

    const [stats] = await runner.select({
      maxPriority: sql`MAX(${menu_categories.display_order})`,
      count: sql`COUNT(*)`
    }).from(menu_categories).where(
      and(
        eq(menu_categories.restaurant_id, restaurantId),
        isNull(menu_categories.deletedat)
      )
    );

    const totalCount = parseInt(stats?.count || 0, 10);
    const maxP = stats?.maxPriority !== null && stats?.maxPriority !== undefined
      ? parseInt(stats.maxPriority, 10)
      : totalCount;

    // If no priority specified, place at the end
    if (targetPriority === undefined || targetPriority === null || targetPriority === '') {
      return maxP + 1;
    }

    const validated = this.validatePriority(targetPriority);
    const effectiveTarget = Math.max(1, Math.min(validated, maxP + 1));

    // If inserting before or at an existing priority, shift all existing categories >= effectiveTarget down by 1
    if (effectiveTarget <= maxP) {
      await runner.update(menu_categories).set({
        display_order: sql`${menu_categories.display_order} + 1`,
        updatedat: new Date()
      }).where(
        and(
          eq(menu_categories.restaurant_id, restaurantId),
          isNull(menu_categories.deletedat),
          sql`${menu_categories.display_order} >= ${effectiveTarget}`
        )
      );
    }

    return effectiveTarget;
  }

  /**
   * Soft-deletes a category and shifts all subsequent categories up by 1 to maintain continuous priorities without gaps.
   *
   * @param {Object} options
   * @param {Object} [options.tx] - Optional Drizzle transaction
   * @param {string} options.restaurantId - Restaurant UUID
   * @param {string} options.categoryId - Category UUID
   * @returns {Promise<Object>} The deleted category record
   */
  static async deleteCategoryWithShift({ tx, restaurantId, categoryId }) {
    if (!tx) {
      return await db.transaction(async (t) => {
        return await CategoryOrderingService.deleteCategoryWithShift({
          tx: t,
          restaurantId,
          categoryId
        });
      });
    }

    const runner = tx;

    const [category] = await runner.select().from(menu_categories).where(
      and(
        eq(menu_categories.id, categoryId),
        eq(menu_categories.restaurant_id, restaurantId),
        isNull(menu_categories.deletedat)
      )
    ).limit(1);

    if (!category) return null;

    const deletedPriority = category.display_order;

    // 1. Soft-delete the category
    const [deleted] = await runner.update(menu_categories).set({
      deletedat: new Date(),
      updatedat: new Date()
    }).where(
      and(
        eq(menu_categories.id, categoryId),
        eq(menu_categories.restaurant_id, restaurantId)
      )
    ).returning();

    // 2. Shift all categories with display_order > deletedPriority UP by 1 (decrease display_order by 1)
    await runner.update(menu_categories).set({
      display_order: sql`${menu_categories.display_order} - 1`,
      updatedat: new Date()
    }).where(
      and(
        eq(menu_categories.restaurant_id, restaurantId),
        isNull(menu_categories.deletedat),
        sql`${menu_categories.display_order} > ${deletedPriority}`
      )
    );

    return deleted;
  }
}

module.exports = CategoryOrderingService;
