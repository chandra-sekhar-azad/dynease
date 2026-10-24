/**
 * RealtimeService
 * ---------------
 * Central helper for emitting Socket.IO events so that every controller
 * targets a consistent set of rooms. Previously each controller built its
 * own room list (and often forgot the customer rooms), which made realtime
 * updates unreliable.
 *
 * Rooms
 * -----
 *  restaurant:<restaurantId>   restaurant owners/staff dashboards
 *  kitchen:<restaurantId>      kitchen display
 *  waiter:<restaurantId>       all waiters of a restaurant
 *  waiter_user:<userId>        a single waiter
 *  menu:<restaurantId>         public/customer viewers of a menu
 *  order:<orderId>             the customer tracking one order
 *  table:<tableId>             the customer session at a table
 *  admin:system                all system admins
 */

let io = null;

const init = (server) => {
  io = server;
};

const emit = (room, event, payload) => {
  if (!io || !room) return;
  io.to(room).emit(event, payload);
};

// Controllers sometimes pass raw DB rows (only `id`) and sometimes UI-shaped
// payloads (both `id` and `_id`). Normalise so every client can match either.
const normalizeOrder = (order) => {
  if (!order || typeof order !== 'object') return order || {};
  const payload = { ...order };
  if (payload.id && !payload._id) payload._id = payload.id;
  if (payload._id && !payload.id) payload.id = payload._id;
  return payload;
};

const orderRooms = (restaurantId, { orderId, tableId } = {}) => {
  const rooms = [];
  if (restaurantId) {
    rooms.push(`kitchen:${restaurantId}`, `restaurant:${restaurantId}`, `waiter:${restaurantId}`);
  }
  if (orderId) rooms.push(`order:${orderId}`);
  if (tableId) rooms.push(`table:${tableId}`);
  return rooms;
};

/** A brand new order was placed. */
const orderCreated = ({ restaurantId, order, orderId, tableId, waiterId }) => {
  if (!io) return;
  const payload = normalizeOrder(order);
  orderRooms(restaurantId, { orderId, tableId }).forEach((room) => emit(room, 'new_order', payload));
  if (waiterId) emit(`waiter_user:${waiterId}`, 'assigned_order', payload);
};

/** An existing order changed (status, acceptance, reassignment...). */
const orderUpdated = ({ restaurantId, order, orderId, tableId }) => {
  if (!io) return;
  const payload = normalizeOrder(order);
  orderRooms(restaurantId, { orderId, tableId }).forEach((room) => emit(room, 'order_updated', payload));
};

/** Additional items were added to an existing order. Intimates waiters and updates kitchen/table. */
const orderItemsAdded = ({ restaurantId, order, orderId, tableId, waiterId, newItems, addedCount }) => {
  if (!io) return;
  const payload = {
    ...normalizeOrder(order),
    newItems,
    addedCount,
    hasNewItems: true,
    addedAt: new Date().toISOString()
  };

  // Broadcast order_updated and more_items_added to all order rooms
  orderRooms(restaurantId, { orderId, tableId }).forEach((room) => {
    emit(room, 'order_updated', payload);
    emit(room, 'more_items_added', payload);
  });

  // Direct alert to the specific assigned waiter if set
  if (waiterId) {
    emit(`waiter_user:${waiterId}`, 'more_items_added', payload);
    emit(`waiter_user:${waiterId}`, 'order_updated', payload);
    emit(`waiter_user:${waiterId}`, 'assigned_order', payload);
  }
};

/** Push a freshly assigned order to a specific waiter. */
const orderAssigned = ({ waiterId, order }) => {
  if (!io || !waiterId) return;
  emit(`waiter_user:${waiterId}`, 'assigned_order', normalizeOrder(order));
};

/** Service requests (call waiter / water / bill...). */
const serviceRequestCreated = (restaurantId, request) => {
  if (!io || !restaurantId) return;
  emit(`restaurant:${restaurantId}`, 'new_service_request', request);
  emit(`waiter:${restaurantId}`, 'new_service_request', request);
};

const serviceRequestUpdated = (restaurantId, request) => {
  if (!io || !restaurantId) return;
  emit(`restaurant:${restaurantId}`, 'service_request_updated', request);
  emit(`waiter:${restaurantId}`, 'service_request_updated', request);
};

/** Dining table state changed. */
const tableUpdated = (restaurantId, table) => {
  if (!io || !restaurantId) return;
  emit(`restaurant:${restaurantId}`, 'table_updated', table);
  emit(`waiter:${restaurantId}`, 'table_updated', table);
};

/** A waiter went on/off shift. */
const waiterStatusUpdated = (restaurantId, payload) => {
  if (!io || !restaurantId) return;
  emit(`restaurant:${restaurantId}`, 'waiter_status_updated', payload);
};

/** Menu / categories changed — customers and admins should refetch. */
const menuUpdated = (restaurantId) => {
  if (!io || !restaurantId) return;
  emit(`restaurant:${restaurantId}`, 'menu_updated', { restaurantId });
  emit(`menu:${restaurantId}`, 'menu_updated', { restaurantId });
};

/** Staff roster / shifts changed. */
const rosterUpdated = (restaurantId) => {
  if (!io || !restaurantId) return;
  emit(`restaurant:${restaurantId}`, 'roster_updated', { restaurantId });
  emit(`waiter:${restaurantId}`, 'roster_updated', { restaurantId });
};

/** Staff members changed. */
const staffUpdated = (restaurantId) => {
  if (!io || !restaurantId) return;
  emit(`restaurant:${restaurantId}`, 'staff_updated', { restaurantId });
  emit(`waiter:${restaurantId}`, 'staff_updated', { restaurantId });
};

/** Anything a system admin dashboard cares about. */
const adminEvent = (event, payload) => {
  emit('admin:system', event, payload);
};

/** Global banner/ads change — every connected client (incl. customers) refetches. */
const bannersUpdated = (payload = {}) => {
  if (!io) return;
  io.emit('banners_updated', payload);
};

/** A new table allocation was created. */
const tableAllocated = ({ restaurantId, tableId, tableNumber, visitId, leadName, waiterId }) => {
  if (!io || !restaurantId) return;
  const payload = { tableId, tableNumber, visitId, customerName: leadName || 'Guest', allocatedAt: new Date().toISOString() };
  emit(`restaurant:${restaurantId}`, 'table_allocated', payload);
  emit(`waiter:${restaurantId}`, 'table_allocated', payload);
  if (waiterId) emit(`waiter_user:${waiterId}`, 'table_allocated', payload);
};

/** Waiter cancelled an allocated visit. */
const allocationCancelled = ({ restaurantId, tableId, visitId, reason }) => {
  if (!io || !restaurantId) return;
  const payload = { tableId, visitId, reason: reason || 'Cancelled by staff', cancelledAt: new Date().toISOString() };
  emit(`table:${tableId}`, 'allocation_cancelled', payload);
  emit(`restaurant:${restaurantId}`, 'table_updated', { tableId, status: 'AVAILABLE' });
  emit(`waiter:${restaurantId}`, 'table_updated', { tableId, status: 'AVAILABLE' });
};

/** Waiter modified an order item quantity/status. */
const orderItemUpdated = ({ restaurantId, orderId, visitId, tableId, item }) => {
  if (!io || !restaurantId) return;
  emit(`order:${orderId}`, 'order_item_updated', item);
  if (tableId) emit(`table:${tableId}`, 'order_item_updated', item);
  emit(`kitchen:${restaurantId}`, 'order_item_updated', { orderId, item });
  emit(`waiter:${restaurantId}`, 'order_item_updated', { orderId, item });
};

/** Waiter completed the visit -> frees the table and revokes customer session. */
const visitClosed = ({ restaurantId, tableId, visitId, tableNumber }) => {
  if (!io || !restaurantId) return;
  const payload = { tableId, visitId, tableNumber, closedAt: new Date().toISOString() };
  emit(`table:${tableId}`, 'visit_closed', payload);
  emit(`restaurant:${restaurantId}`, 'table_updated', { tableId, tableNumber, status: 'AVAILABLE' });
  emit(`waiter:${restaurantId}`, 'table_updated', { tableId, tableNumber, status: 'AVAILABLE' });
};

module.exports = {
  init,
  orderCreated,
  orderUpdated,
  orderItemsAdded,
  orderAssigned,
  serviceRequestCreated,
  serviceRequestUpdated,
  tableUpdated,
  waiterStatusUpdated,
  menuUpdated,
  rosterUpdated,
  staffUpdated,
  adminEvent,
  bannersUpdated,
  tableAllocated,
  allocationCancelled,
  orderItemUpdated,
  visitClosed,
};
