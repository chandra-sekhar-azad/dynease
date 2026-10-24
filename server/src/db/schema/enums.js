
const { pgEnum } = require('drizzle-orm/pg-core');

const userTypeEnum = pgEnum('user_type', [
  'SYSTEM_ADMIN',
  'ADMIN',
  'STAFF',
]);

const userStatusEnum = pgEnum('user_status', ['ACTIVE', 'INACTIVE']);

const restaurantStatusEnum = pgEnum('restaurant_status', [
  'ACTIVE',
  'PAUSED',
  'INACTIVE',
  'PENDING',
  'REJECTED',
]);

const planStatusEnum = pgEnum('plan_status', ['ACTIVE', 'INACTIVE']);

const tableStatusEnum = pgEnum('table_status', ['ACTIVE', 'INACTIVE']);

const assignmentStatusEnum = pgEnum('assignment_status', [
  'ASSIGNED',
  'COMPLETED',
  'CANCELLED',
]);

const assignmentTypeEnum = pgEnum('assignment_type', [
  'MANUAL',
  'DYNAMIC',
]);

const tableAllocationModeEnum = pgEnum('table_allocation_mode', [
  'MANUAL',
  'DYNAMIC',
]);

const menuCategoryStatusEnum = pgEnum('menu_category_status', [
  'ACTIVE',
  'INACTIVE',
]);

const menuItemStatusEnum = pgEnum('menu_item_status', [
  'AVAILABLE',
  'UNAVAILABLE',
  'INACTIVE',
]);

const menuItemTypeEnum = pgEnum('menu_item_type', ['VEG', 'NON_VEG']);

const itemSizeEnum = pgEnum('item_size', [
  'SMALL',
  'MEDIUM',
  'LARGE',
  'JUMBO',
  'FULL',
  'HALF',
]);

const orderStatusEnum = pgEnum('order_status', [
  'NO_ORDER',
  'ORDERED',
  'PREPARING',
  'READY',
  'SERVED',
  'COMPLETED',
  'CANCELLED',
  'PAID',
]);


const shiftTypeEnum = pgEnum('shift_type', [
  'WORKING',
  'HOLIDAY',
  'LEAVE',
]);

const sessionStatusEnum = pgEnum('session_status', [
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
]);

module.exports = {
  userTypeEnum,
  userStatusEnum,
  restaurantStatusEnum,
  planStatusEnum,
  tableStatusEnum,
  assignmentStatusEnum,
  assignmentTypeEnum,
  tableAllocationModeEnum,
  menuCategoryStatusEnum,
  menuItemStatusEnum,
  menuItemTypeEnum,
  itemSizeEnum,
  orderStatusEnum,
  shiftTypeEnum,
  sessionStatusEnum,
};
