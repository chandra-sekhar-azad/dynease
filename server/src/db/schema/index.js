const enums = require('./enums');
const { users } = require('./users');
const { restaurants } = require('./restaurants');
const { plans } = require('./plans');
const { tables } = require('./tables');
const { tables_assignment } = require('./tables_assignment');
const { menu_categories, menu_categories_items } = require('./menu');
const { order_details, order_items } = require('./orders');
const { leads } = require('./leads');
const { shifts, rosters } = require('./staff');
const { audit_log } = require('./audit-log');
const { service_requests, assignment_events } = require('./compat');

module.exports = {
  ...enums,
  users,
  restaurants,
  plans,
  tables,
  tables_assignment,
  menu_categories,
  menu_categories_items,
  order_details,
  order_items,
  leads,
  shifts,
  rosters,
  audit_log,
  service_requests,
  assignment_events
};
