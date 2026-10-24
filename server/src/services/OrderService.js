const { db, schema } = require('../db/client');
const { eq, and, sql, isNull } = require('drizzle-orm');
const { restaurants, tables, menu_categories_items, order_details, customer_orders, order_items, leads } = schema;
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
            isNull(menu_categories_items.deletedat)
          )
        ).limit(1);

        if (!menuItem) {
          throw new Error(`Menu item not found or does not belong to this restaurant: ${item.menu_item_id}`);
        }

        if (menuItem.menu_item_status !== 'AVAILABLE') {
          throw new Error(`Menu item "${menuItem.name}" is currently ${menuItem.menu_item_status} and cannot be ordered.`);
        }

        let unitPrice = parseFloat(menuItem.price);
        if (item.customizations && Array.isArray(menuItem.quantities) && menuItem.quantities.length > 0) {
          const matchedVariant = menuItem.quantities.find(
            q => q && q.size && q.size.trim().toLowerCase() === item.customizations.trim().toLowerCase()
          );
          if (matchedVariant && !isNaN(parseFloat(matchedVariant.price))) {
            unitPrice = parseFloat(matchedVariant.price);
          }
        }

        if (isNaN(unitPrice) || unitPrice < 0) {
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
          const [newLead] = await tx.insert(leads).values({
            restaurant_id,
            name: customer_name,
            number: customer_phone,
            visits: 0
          }).returning();
          leadId = newLead.id;
        }
      }

      // 6. Generate order details
      const orderNumber = idempotency_key || ('ORD-' + Date.now().toString(36).toUpperCase());

      const [order] = await tx.insert(order_details).values({
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

      const orderId = order.id;

      // 7. Insert all order items
      const createdItems = [];
      for (const vi of validatedItems) {
        const [oi] = await tx.insert(order_items).values({
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
   * Add items to an existing active order transactionally
   * @param {Object} data
   * @param {string} data.restaurant_id
   * @param {string} data.order_id
   * @param {Array<{menu_item_id: string, quantity: number, customizations?: string}>} data.items
   * @param {string} [data.special_instructions]
   */
  async addItemsToOrder(data) {
    const {
      restaurant_id,
      order_id,
      items,
      special_instructions = ''
    } = data;

    if (!restaurant_id || !order_id || !Array.isArray(items) || items.length === 0) {
      throw new Error('Invalid payload: restaurant_id, order_id, and items are required.');
    }

    return await db.transaction(async (tx) => {
      // 1. Fetch and verify existing order
      const [existingOrder] = await tx.select().from(order_details).where(
        and(
          eq(order_details.id, order_id),
          eq(order_details.restaurant_id, restaurant_id)
        )
      ).limit(1);

      if (!existingOrder) {
        throw new Error('Existing order not found.');
      }

      if (['COMPLETED', 'CANCELLED', 'PAID'].includes(existingOrder.order_status)) {
        throw new Error(`Cannot add items to an order with status "${existingOrder.order_status}".`);
      }

      // 2. Validate menu items and calculate prices
      let additionalAmount = 0;
      const validatedItems = [];

      for (const item of items) {
        if (!item.quantity || item.quantity <= 0) {
          throw new Error(`Invalid item quantity: ${item.quantity}`);
        }

        const [menuItem] = await tx.select().from(menu_categories_items).where(
          and(
            eq(menu_categories_items.id, item.menu_item_id),
            eq(menu_categories_items.restaurant_id, restaurant_id),
            isNull(menu_categories_items.deletedat)
          )
        ).limit(1);

        if (!menuItem) {
          throw new Error(`Menu item not found: ${item.menu_item_id}`);
        }

        if (menuItem.menu_item_status !== 'AVAILABLE') {
          throw new Error(`Menu item "${menuItem.name}" is currently unavailable.`);
        }

        let unitPrice = parseFloat(menuItem.price);
        if (item.customizations && Array.isArray(menuItem.quantities) && menuItem.quantities.length > 0) {
          const matchedVariant = menuItem.quantities.find(
            q => q && q.size && q.size.trim().toLowerCase() === item.customizations.trim().toLowerCase()
          );
          if (matchedVariant && !isNaN(parseFloat(matchedVariant.price))) {
            unitPrice = parseFloat(matchedVariant.price);
          }
        }

        if (isNaN(unitPrice) || unitPrice < 0) {
          throw new Error(`Invalid price for item "${menuItem.name}".`);
        }

        const itemTotal = unitPrice * item.quantity;
        additionalAmount += itemTotal;

        validatedItems.push({
          menu_item_id: menuItem.id,
          item_name: menuItem.name,
          unit_price: unitPrice.toFixed(2),
          quantity: item.quantity,
          total: itemTotal.toFixed(2),
          customizations: item.customizations || ''
        });
      }

      // 3. Insert new items into order_items
      const createdItems = [];
      for (const vi of validatedItems) {
        const [oi] = await tx.insert(order_items).values({
          restaurant_id,
          order_id: existingOrder.id,
          item_name: vi.item_name,
          menu_item_id: vi.menu_item_id,
          quantity: vi.quantity,
          unit_price: vi.unit_price,
          total: vi.total,
          customizations: vi.customizations
        }).returning();
        createdItems.push(oi);
      }

      // 4. Update order totals and status
      const updatedTotalAmount = (parseFloat(existingOrder.total_amount || 0) + additionalAmount).toFixed(2);
      const updatedFinalAmount = (parseFloat(existingOrder.final_amount || 0) + additionalAmount).toFixed(2);

      const newInstructions = special_instructions
        ? (existingOrder.special_instructions ? `${existingOrder.special_instructions} | ${special_instructions}` : special_instructions)
        : existingOrder.special_instructions;

      const [updatedOrder] = await tx.update(order_details).set({
        total_amount: updatedTotalAmount,
        final_amount: updatedFinalAmount,
        order_status: 'ORDERED',
        app_status: 'PENDING',
        special_instructions: newInstructions,
        updatedat: new Date()
      }).where(eq(order_details.id, existingOrder.id)).returning();

      // 5. Fetch all items for this order
      const allItems = await tx.select().from(order_items).where(
        eq(order_items.order_id, existingOrder.id)
      ).orderBy(order_items.createdat);

      // 6. Audit log
      await logAudit({
        restaurant_id,
        action: 'ORDER_ITEMS_ADDED',
        entity_type: 'ORDER',
        entity_id: existingOrder.id,
        details: {
          orderNumber: existingOrder.order_number,
          addedItemsCount: createdItems.length,
          additionalAmount,
          newFinalAmount: updatedFinalAmount
        }
      }, tx);

      return {
        order: updatedOrder,
        items: allItems,
        newItems: createdItems,
        isExistingOrder: true
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

  /**
   * Submit an individual order within an active dining visit
   * Enforces:
   * - Session and active visit validation
   * - Idempotency protection (network retries / double clicks return existing order)
   * - Server-side price calculation and item availability
   * - Association with visit-level order_details
   * - Transition of visit order_status from NO_ORDER to ORDERED
   */
  async submitOrderInVisit({ visitId, restaurantId, items, special_instructions = '', idempotency_key = null }) {
    if (!visitId || !restaurantId || !Array.isArray(items) || items.length === 0) {
      throw new Error('Invalid order payload: visitId, restaurantId, and items are required.');
    }

    return await db.transaction(async (tx) => {
      // 1. Verify visit is active
      const [visit] = await tx.select().from(order_details).where(
        and(
          eq(order_details.id, visitId),
          eq(order_details.restaurant_id, restaurantId),
          sql`${order_details.order_status} NOT IN ('COMPLETED', 'CANCELLED')`
        )
      ).for('update').limit(1);

      if (!visit) {
        throw new Error('Active dining visit not found or already closed.');
      }

      // 2. Idempotency check: if order with this idempotency key already exists for this restaurant, return it
      if (idempotency_key) {
        const [existingOrder] = await tx.select().from(customer_orders).where(
          and(
            eq(customer_orders.restaurant_id, restaurantId),
            eq(customer_orders.idempotency_key, idempotency_key)
          )
        ).limit(1);

        if (existingOrder) {
          const existingItems = await tx.select().from(order_items).where(
            eq(order_items.order_id, existingOrder.id)
          );
          return {
            order: existingOrder,
            items: existingItems,
            visit,
            duplicate: true
          };
        }
      }

      // 3. Server-side price calculation & item availability validation
      let subtotalAmount = 0;
      const validatedItems = [];

      for (const item of items) {
        const qty = parseInt(item.quantity, 10);
        if (isNaN(qty) || qty <= 0) {
          throw new Error(`Invalid item quantity: ${item.quantity}`);
        }

        const [menuItem] = await tx.select().from(menu_categories_items).where(
          and(
            eq(menu_categories_items.id, item.menu_item_id),
            eq(menu_categories_items.restaurant_id, restaurantId),
            isNull(menu_categories_items.deletedat)
          )
        ).limit(1);

        if (!menuItem) {
          throw new Error(`Menu item not found or does not belong to this restaurant: ${item.menu_item_id}`);
        }

        if (menuItem.menu_item_status !== 'AVAILABLE') {
          throw new Error(`Menu item "${menuItem.name}" is currently ${menuItem.menu_item_status} and cannot be ordered.`);
        }

        let unitPrice = parseFloat(menuItem.price);
        if (item.customizations && Array.isArray(menuItem.quantities) && menuItem.quantities.length > 0) {
          const matchedVariant = menuItem.quantities.find(
            q => q && q.size && q.size.trim().toLowerCase() === item.customizations.trim().toLowerCase()
          );
          if (matchedVariant && !isNaN(parseFloat(matchedVariant.price))) {
            unitPrice = parseFloat(matchedVariant.price);
          }
        }

        if (isNaN(unitPrice) || unitPrice < 0) {
          throw new Error(`Invalid price for item "${menuItem.name}".`);
        }

        const lineTotal = unitPrice * qty;
        subtotalAmount += lineTotal;

        validatedItems.push({
          menu_item_id: menuItem.id,
          item_name: menuItem.name,
          unit_price: unitPrice.toFixed(2),
          quantity: qty,
          requested_quantity: qty,
          accepted_quantity: qty,
          total: lineTotal.toFixed(2),
          customizations: item.customizations || '',
          item_status: 'PENDING'
        });
      }

      // 4. Create separate customer_orders record
      const orderNumber = idempotency_key ? `ORD-${idempotency_key.slice(0, 8).toUpperCase()}` : ('ORD-' + Date.now().toString(36).toUpperCase());

      const [order] = await tx.insert(customer_orders).values({
        restaurant_id: restaurantId,
        visit_id: visit.id,
        order_number: orderNumber,
        order_status: 'SUBMITTED',
        idempotency_key: idempotency_key || null,
        subtotal: subtotalAmount.toFixed(2),
        special_instructions
      }).returning();

      // 5. Insert order_items
      const createdItems = [];
      for (const vi of validatedItems) {
        const [oi] = await tx.insert(order_items).values({
          restaurant_id: restaurantId,
          order_id: order.id,
          visit_id: visit.id,
          menu_item_id: vi.menu_item_id,
          item_name: vi.item_name,
          quantity: vi.quantity,
          requested_quantity: vi.requested_quantity,
          accepted_quantity: vi.accepted_quantity,
          unit_price: vi.unit_price,
          total: vi.total,
          item_status: vi.item_status,
          customizations: vi.customizations
        }).returning();
        createdItems.push(oi);
      }

      // 6. Update visit-level order_details:
      // Status transitions from NO_ORDER -> ORDERED
      // Recalculate total_amount and final_amount
      const newTotalAmount = (parseFloat(visit.total_amount || 0) + subtotalAmount).toFixed(2);
      const newFinalAmount = (parseFloat(visit.final_amount || 0) + subtotalAmount).toFixed(2);

      const [updatedVisit] = await tx.update(order_details).set({
        order_status: 'ORDERED',
        app_status: 'PENDING',
        total_amount: newTotalAmount,
        final_amount: newFinalAmount,
        updatedat: new Date()
      }).where(eq(order_details.id, visit.id)).returning();

      // 7. Audit log
      await logAudit({
        restaurant_id: restaurantId,
        action: 'ORDER_SUBMITTED',
        entity_type: 'ORDER',
        entity_id: order.id,
        details: {
          visitId: visit.id,
          orderNumber: order.order_number,
          subtotal: order.subtotal,
          itemsCount: createdItems.length
        }
      }, tx);

      return {
        order,
        items: createdItems,
        visit: updatedVisit,
        duplicate: false
      };
    });
  }

  /**
   * Waiter management of live order item quantities (partial / full unavailability)
   * Enforces:
   * - Retaining original item record (never physically deleted)
   * - Preserving requested_quantity, accepted_quantity, reason, waiter ID, and timestamp
   * - Recalculating line totals using accepted_quantity
   * - Recalculating order subtotal and visit-level total
   */
  async updateOrderItemQuantity({ itemId, acceptedQuantity, reason = '', waiterId, restaurantId }) {
    const acceptedQty = parseInt(acceptedQuantity, 10);
    if (isNaN(acceptedQty) || acceptedQty < 0) {
      throw new Error('Accepted quantity must be a non-negative integer.');
    }

    return await db.transaction(async (tx) => {
      // 1. Fetch order item
      const [item] = await tx.select().from(order_items).where(
        and(
          eq(order_items.id, itemId),
          eq(order_items.restaurant_id, restaurantId)
        )
      ).for('update').limit(1);

      if (!item) {
        throw new Error('Order item not found.');
      }

      const requestedQty = item.requested_quantity || item.quantity;
      if (acceptedQty > requestedQty) {
        throw new Error(`Accepted quantity cannot exceed originally requested quantity of ${requestedQty}.`);
      }

      // 2. Determine new status
      let itemStatus = 'ACCEPTED';
      if (acceptedQty === 0) {
        itemStatus = 'UNAVAILABLE';
      } else if (acceptedQty < requestedQty) {
        itemStatus = 'REDUCED';
      }

      const unitPrice = parseFloat(item.unit_price);
      const newTotal = (unitPrice * acceptedQty).toFixed(2);

      // 3. Update order_items preserving original requested quantity
      const [updatedItem] = await tx.update(order_items).set({
        accepted_quantity: acceptedQty,
        quantity: acceptedQty, // keep quantity aligned with accepted for backward compat
        total: newTotal,
        item_status: itemStatus,
        rejection_reason: reason || null,
        modified_by: waiterId,
        modified_at: new Date(),
        updatedat: new Date()
      }).where(eq(order_items.id, itemId)).returning();

      // 4. Recalculate order subtotal
      let updatedOrder = null;
      if (item.order_id) {
        const orderAllItems = await tx.select().from(order_items).where(
          eq(order_items.order_id, item.order_id)
        );
        const newOrderSubtotal = orderAllItems.reduce(
          (sum, oi) => sum + parseFloat(oi.total || 0),
          0
        ).toFixed(2);

        [updatedOrder] = await tx.update(customer_orders).set({
          subtotal: newOrderSubtotal,
          updatedat: new Date()
        }).where(eq(customer_orders.id, item.order_id)).returning();
      }

      // 5. Recalculate visit total_amount and final_amount
      const visitId = item.visit_id;
      let updatedVisit = null;
      if (visitId) {
        const visitAllItems = await tx.select().from(order_items).where(
          eq(order_items.visit_id, visitId)
        );
        const newVisitTotal = visitAllItems.reduce(
          (sum, oi) => sum + parseFloat(oi.total || 0),
          0
        ).toFixed(2);

        [updatedVisit] = await tx.update(order_details).set({
          total_amount: newVisitTotal,
          final_amount: newVisitTotal,
          updatedat: new Date()
        }).where(eq(order_details.id, visitId)).returning();
      }

      // 6. Audit log
      await logAudit({
        restaurant_id: restaurantId,
        user_id: waiterId,
        action: 'ORDER_ITEM_QUANTITY_MODIFIED',
        entity_type: 'ORDER',
        entity_id: item.order_id || itemId,
        details: {
          itemId,
          itemName: item.item_name,
          requestedQuantity: requestedQty,
          acceptedQuantity: acceptedQty,
          reason,
          newTotal
        }
      }, tx);

      return {
        item: updatedItem,
        order: updatedOrder,
        visit: updatedVisit
      };
    });
  }

  /**
   * Generates bill aggregated across all orders in the visit
   * Calculated strictly from accepted quantities and trusted server prices
   */
  async getVisitBill(visitId, restaurantId) {
    const [visit] = await db.select().from(order_details).where(
      and(
        eq(order_details.id, visitId),
        eq(order_details.restaurant_id, restaurantId)
      )
    ).limit(1);

    if (!visit) {
      throw new Error('Visit record not found.');
    }

    const [restaurant] = await db.select().from(restaurants).where(
      eq(restaurants.id, restaurantId)
    ).limit(1);

    const orders = await db.select().from(customer_orders).where(
      eq(customer_orders.visit_id, visitId)
    ).orderBy(customer_orders.createdat);

    const allItems = await db.select().from(order_items).where(
      eq(order_items.visit_id, visitId)
    ).orderBy(order_items.createdat);

    // Calculate subtotal strictly from accepted quantities
    let subtotal = 0;
    const itemsFormatted = allItems.map(item => {
      const acceptedQty = item.accepted_quantity !== null && item.accepted_quantity !== undefined
        ? item.accepted_quantity
        : item.quantity;
      const requestedQty = item.requested_quantity || item.quantity;
      const unitPrice = parseFloat(item.unit_price);
      const lineTotal = acceptedQty > 0 ? unitPrice * acceptedQty : 0;
      subtotal += lineTotal;

      return {
        id: item.id,
        orderId: item.order_id,
        menuItemId: item.menu_item_id,
        name: item.item_name,
        requestedQuantity: requestedQty,
        acceptedQuantity: acceptedQty,
        unitPrice,
        total: parseFloat(lineTotal.toFixed(2)),
        status: item.item_status || (acceptedQty === 0 ? 'UNAVAILABLE' : (acceptedQty < requestedQty ? 'REDUCED' : 'ACCEPTED')),
        rejectionReason: item.rejection_reason || null,
        size: item.customizations || null
      };
    });

    const taxPercent = restaurant?.taxPercent || 0;
    const taxAmount = parseFloat(((subtotal * taxPercent) / 100).toFixed(2));
    const totalAmount = parseFloat((subtotal + taxAmount).toFixed(2));

    return {
      visitId: visit.id,
      tableId: visit.table_id,
      customerName: visit.customer_name,
      customerPhone: visit.customer_phone,
      orderStatus: visit.order_status,
      paymentStatus: visit.payment_status,
      ordersCount: orders.length,
      orders: orders.map(o => ({
        id: o.id,
        orderNumber: o.order_number,
        status: o.order_status,
        subtotal: parseFloat(o.subtotal),
        createdAt: o.createdat
      })),
      items: itemsFormatted,
      subtotal: parseFloat(subtotal.toFixed(2)),
      taxPercent,
      taxAmount,
      totalAmount
    };
  }

  /**
   * Enforce operational state transitions on individual customer order:
   * SUBMITTED -> ACCEPTED -> PREPARING -> READY -> SERVED (or CANCELLED)
   */
  async updateCustomerOrderStatus(orderId, nextStatus, restaurantId, actorId = null) {
    const validTransitions = {
      'SUBMITTED': ['ACCEPTED', 'PREPARING', 'CANCELLED'],
      'ACCEPTED': ['PREPARING', 'READY', 'CANCELLED'],
      'PREPARING': ['READY', 'SERVED', 'CANCELLED'],
      'READY': ['SERVED', 'CANCELLED'],
      'SERVED': ['COMPLETED', 'CANCELLED'],
      'CANCELLED': []
    };

    const [order] = await db.select().from(customer_orders).where(
      and(
        eq(customer_orders.id, orderId),
        eq(customer_orders.restaurant_id, restaurantId)
      )
    ).limit(1);

    if (!order) throw new Error('Customer order not found.');

    const currentStatus = order.order_status;
    const allowed = validTransitions[currentStatus] || [];

    if (!allowed.includes(nextStatus)) {
      throw new Error(`Cannot transition order status from "${currentStatus}" to "${nextStatus}".`);
    }

    const [updated] = await db.update(customer_orders).set({
      order_status: nextStatus,
      updatedat: new Date()
    }).where(eq(customer_orders.id, orderId)).returning();

    await logAudit({
      restaurant_id: restaurantId,
      user_id: actorId,
      action: 'ORDER_STATUS_UPDATED',
      entity_type: 'ORDER',
      entity_id: orderId,
      details: { previousStatus: currentStatus, nextStatus }
    });

    return updated;
  }
}

module.exports = new OrderService();

