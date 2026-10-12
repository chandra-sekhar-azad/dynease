const crypto = require('crypto');
const { db, schema } = require('../db/client');
const { eq, and, sql } = require('drizzle-orm');
const { restaurants, tables, menu_categories_items, order_details, order_items, leads } = schema;
const { logAudit } = require('./AuditService');

/**
 * Service to handle secure, transactional Order Management
 */
class OrderService {
  /**
   * Create an order transactionally with server-side pricing and customer visit incrementation
   * @param {Object} orderData
   * @param {string} orderData.restaurant_id
   * @param {string} orderData.table_id
   * @param {string} [orderData.customer_name]
   * @param {string} [orderData.customer_phone]
   * @param {Array<{menu_item_id: string, quantity: number, customizations?: string}>} orderData.items
   * @param {string} [orderData.special_instructions]
   * @param {string} [orderData.assigned_waiter_id]
   * @param {string} [orderData.idempotency_key]
   */
  async createOrder(orderData) {
    const {
      restaurant_id,
      table_id,
      customer_name = 'Guest',
      customer_phone,
      items,
      special_instructions = '',
      assigned_waiter_id = null,
      idempotency_key = null
    } = orderData;

    if (!restaurant_id || !table_id || !Array.isArray(items) || items.length === 0) {
      throw new Error('Invalid order payload: restaurant_id, table_id, and items are required.');
    }

    return await db.transaction(async (tx) => {
      // 1. Verify restaurant status
      const [rest] = await tx.select().from(restaurants).where(
        and(eq(restaurants.id, restaurant_id), eq(restaurants.is_deleted, false))
      ).limit(1);

      if (!rest || rest.restaurant_status !== 'ACTIVE') {
        throw new Error('Restaurant is inactive or not found.');
      }

      // 2. Verify table status
      const [tbl] = await tx.select().from(tables).where(
        and(eq(tables.id, table_id), eq(tables.restaurant_id, restaurant_id), eq(tables.is_deleted, false))
      ).limit(1);

      if (!tbl || tbl.table_status !== 'ACTIVE') {
        throw new Error('Table is inactive, deleted or does not belong to this restaurant.');
      }

      // 3. Idempotency check: if order with this idempotency key already exists, return it
      if (idempotency_key) {
        const [existingOrder] = await tx.select().from(order_details).where(
          and(
            eq(order_details.restaurant_id, restaurant_id),
            eq(order_details.order_number, idempotency_key)
          )
        ).limit(1);

        if (existingOrder) {
          const existingItems = await tx.select().from(order_items).where(
            eq(order_items.order_id, existingOrder.id)
          );
          return { order: existingOrder, items: existingItems, duplicate: true };
        }
      }

      // 4. Server-side price calculation and validation
      let totalAmount = 0;
      const validatedItems = [];

      for (const item of items) {
        if (!item.quantity || item.quantity <= 0) {
          throw new Error(`Invalid item quantity: ${item.quantity}`);
        }

        const [menuItem] = await tx.select().from(menu_categories_items).where(
          and(
            eq(menu_categories_items.id, item.menu_item_id),
            eq(menu_categories_items.restaurant_id, restaurant_id),
            eq(menu_categories_items.is_deleted, false)
          )
        ).limit(1);

        if (!menuItem) {
          throw new Error(`Menu item not found or does not belong to this restaurant: ${item.menu_item_id}`);
        }

        if (menuItem.menu_item_status !== 'AVAILABLE') {
          throw new Error(`Menu item "${menuItem.name}" is currently ${menuItem.menu_item_status} and cannot be ordered.`);
        }

        const unitPrice = parseFloat(menuItem.price);
        if (unitPrice < 0) {
          throw new Error(`Invalid price for item "${menuItem.name}".`);
        }

        const itemTotal = unitPrice * item.quantity;
        totalAmount += itemTotal;

        validatedItems.push({
          menu_item_id: menuItem.id,
          item_name: menuItem.name,
          unit_price: unitPrice.toFixed(2),
          quantity: item.quantity,
          total: itemTotal.toFixed(2),
          customizations: item.customizations || ''
        });
      }

      // 5. Handle Leads (Customer phone)
      let leadId = null;
      if (customer_phone) {
        let [existingLead] = await tx.select().from(leads).where(
          and(
            eq(leads.restaurant_id, restaurant_id),
            eq(leads.number, customer_phone)
          )
        ).limit(1);

        if (existingLead) {
          leadId = existingLead.id;
        } else {
          leadId = 'lead_' + crypto.randomBytes(8).toString('hex');
          const [newLead] = await tx.insert(leads).values({
            id: leadId,
            restaurant_id,
            name: customer_name,
            number: customer_phone,
            visits: 0
          }).returning();
          leadId = newLead.id;
        }
      }

      // 6. Generate order details
      const orderId = 'ord_' + crypto.randomBytes(8).toString('hex');
      const orderNumber = idempotency_key || ('ORD-' + Date.now().toString(36).toUpperCase());

      const [order] = await tx.insert(order_details).values({
        id: orderId,
        restaurant_id,
        table_id,
        lead_id: leadId,
        order_status: 'ORDERED',
        date: new Date(),
        order_number: orderNumber,
        customer_name,
        customer_phone,
        total_amount: totalAmount.toFixed(2),
        tax_amount: '0.00',
        discount_amount: '0.00',
        final_amount: totalAmount.toFixed(2),
        payment_status: 'PENDING',
        payment_method: 'CASH',
        special_instructions,
        assigned_waiter_id,
        app_status: 'PENDING'
      }).returning();

      // 7. Insert all order items
      const createdItems = [];
      for (const vi of validatedItems) {
        const orderItemId = 'oi_' + crypto.randomBytes(8).toString('hex');
        const [oi] = await tx.insert(order_items).values({
          id: orderItemId,
          restaurant_id,
          order_id: orderId,
          item_name: vi.item_name,
          menu_item_id: vi.menu_item_id,
          quantity: vi.quantity,
          unit_price: vi.unit_price,
          total: vi.total,
          customizations: vi.customizations
        }).returning();
        createdItems.push(oi);
      }

      // 8. Audit log
      await logAudit({
        restaurant_id,
        action: 'ORDER_CREATED',
        entity_type: 'ORDER',
        entity_id: orderId,
        details: { orderNumber, final_amount: order.final_amount, itemsCount: createdItems.length }
      }, tx);

      return {
        order,
        items: createdItems,
        duplicate: false
      };
    });
  }

  /**
   * Complete an order and increment completed customer visits on lead
   */
  async completeOrder(orderId, restaurantId, actorId = null) {
    return await db.transaction(async (tx) => {
      const [order] = await tx.select().from(order_details).where(
        and(eq(order_details.id, orderId), eq(order_details.restaurant_id, restaurantId))
      ).limit(1);

      if (!order) throw new Error('Order not found');

      const [updated] = await tx.update(order_details).set({
        app_status: 'COMPLETED',
        payment_status: 'PAID',
        updatedat: new Date()
      }).where(eq(order_details.id, orderId)).returning();

      // If lead exists, increment visits
      if (order.lead_id) {
        await tx.update(leads).set({
          visits: sql`${leads.visits} + 1`,
          updatedat: new Date()
        }).where(eq(leads.id, order.lead_id));
      }

      await logAudit({
        restaurant_id: restaurantId,
        user_id: actorId,
        action: 'ORDER_COMPLETED',
        entity_type: 'ORDER',
        entity_id: orderId,
        details: { lead_id: order.lead_id }
      }, tx);

      return updated;
    });
  }
}

module.exports = new OrderService();
