const MenuItemSchema = require('./MenuItem');
const OrderSchema = require('./Order');
const TableSchema = require('./Table');
const UserSchema = require('./User'); // Restaurant staff/owners
const RestaurantProfileSchema = require('./RestaurantProfile');
const CategorySchema = require('./Category');
const ServiceRequestSchema = require('./ServiceRequest');
const AssignmentEventSchema = require('./AssignmentEvent');

module.exports = {
  MenuItem: MenuItemSchema,
  Order: OrderSchema,
  Table: TableSchema,
  User: UserSchema,
  RestaurantProfile: RestaurantProfileSchema,
  Category: CategorySchema,
  ServiceRequest: ServiceRequestSchema,
  AssignmentEvent: AssignmentEventSchema
};
