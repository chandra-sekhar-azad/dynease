const { pgEnum } = require('drizzle-orm/pg-core');

const userTypeEnum = pgEnum('user_type', ['SYSTEM_ADMIN', 'ADMIN', 'STAFF']);
const restaurantStatusEnum = pgEnum('restaurant_status', ['ACTIVE', 'PAUSED', 'INACTIVE']);
const userStatusEnum = pgEnum('user_status', ['ACTIVE', 'INACTIVE']);
const planStatusEnum = pgEnum('plan_status', ['ACTIVE', 'INACTIVE']);
const tableStatusEnum = pgEnum('table_status', ['ACTIVE', 'INACTIVE']);
const assignmentStatusEnum = pgEnum('assignment_status', ['ASSIGNED', 'COMPLETED', 'CANCELLED']);
const assignmentTypeEnum = pgEnum('assignment_type', ['MANUAL', 'DYNAMIC']);
const orderStatusEnum = pgEnum('order_status', ['NO_ORDER', 'ORDERED']);
const menuItemTypeEnum = pgEnum('menu_item_type', ['VEG', 'NON_VEG']);
const itemSizeEnum = pgEnum('item_size', ['SMALL', 'MEDIUM', 'LARGE', 'JUMBO', 'FULL', 'HALF']);
const menuItemStatusEnum = pgEnum('menu_item_status', ['AVAILABLE', 'UNAVAILABLE', 'INACTIVE']);
const menuCategoryStatusEnum = pgEnum('menu_category_status', ['ACTIVE', 'INACTIVE']);
const tableAllocationModeEnum = pgEnum('table_allocation_mode', ['MANUAL', 'DYNAMIC']);
const shiftTypeEnum = pgEnum('shift_type', ['WORKING', 'HOLIDAY', 'LEAVE']);

module.exports = {
  userTypeEnum,
  restaurantStatusEnum,
  userStatusEnum,
  planStatusEnum,
  tableStatusEnum,
  assignmentStatusEnum,
  assignmentTypeEnum,
  orderStatusEnum,
  menuItemTypeEnum,
  itemSizeEnum,
  menuItemStatusEnum,
  menuCategoryStatusEnum,
  tableAllocationModeEnum,
  shiftTypeEnum
};
