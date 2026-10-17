const crypto = require('crypto');
const { db, schema } = require('../db/client');
const { eq, and, or, sql, desc, inArray, isNull } = require('drizzle-orm');
const {
  restaurants,
  tables,
  menu_categories,
  menu_categories_items,
  order_details,
  order_items,
  leads,
  service_requests,
  ads,
  audit_log
} = schema;

const RealtimeService = require('../services/RealtimeService');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const inferCategoryType = (name, explicitType) => {
  if (explicitType && explicitType !== 'all') return explicitType.toLowerCase();
  const lower = (name || '').toLowerCase();
  if (lower.includes('non-veg') || lower.includes('non veg') || lower.includes('nonveg')) return 'non-veg';
  if (lower.includes('vegan')) return 'vegan';
  if (lower.includes('veg')) return 'veg';
  return explicitType || 'all';
};

/**
 * GET /api/public/qr/:qrToken
 * Resolves a QR token → restaurant + table info
 */
exports.getTableByQR = async (req, res, next) => {
  try {
    const { qrToken } = req.params;

    const [table] = await db.select().from(tables).where(
      and(
        eq(tables.qr_token, qrToken),
        eq(tables.table_status, 'ACTIVE'),
        eq(tables.is_deleted, false)
      )
    ).limit(1);

    if (!table) {
      return res.status(404).json({
        success: false,
        code: 'INVALID_QR',
        message: 'This table QR code is invalid or inactive.'
      });
    }

    const [restaurant] = await db.select().from(restaurants).where(
      and(
        eq(restaurants.id, table.restaurant_id),
        eq(restaurants.is_deleted, false)
      )
    ).limit(1);

    if (!restaurant || restaurant.restaurant_status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        code: 'RESTAURANT_UNAVAILABLE',
        message: 'This restaurant is currently unavailable.'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        restaurant: {
          id: restaurant.id,
          name: restaurant.restaurant_name || restaurant.name,
          slug: restaurant.domain,
          logo: null,
          taxPercent: 0,
          googleReviewLink: null
        },
        table: {
          id: table.id,
          tableNumber: table.table_code,
          tableName: table.table_code
        },
        session: { qrToken }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/public/table/:tableNumber
 * Resolves a table number → restaurant + table info
 */
exports.getTableByNumber = async (req, res, next) => {
  try {
    const { tableNumber } = req.params;
    const restaurant = req.restaurant || req.tenantRegistry;

    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found or not active.' });
    }

    const restaurantId = restaurant.id || restaurant.restaurantId;

    const [table] = await db.select().from(tables).where(
      and(
        eq(tables.table_code, tableNumber),
        eq(tables.restaurant_id, restaurantId),
        eq(tables.table_status, 'ACTIVE'),
        eq(tables.is_deleted, false)
      )
    ).limit(1);

    if (!table) {
      return res.status(404).json({
        success: false,
        code: 'INVALID_TABLE',
        message: 'This table number is invalid or inactive.'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        restaurant: {
          id: restaurantId,
          name: restaurant.restaurantName || restaurant.name,
          subtitle: null,
          slug: restaurant.domain || restaurant.slug || restaurant.subdomain,
          logo: null,
          taxPercent: 0,
          googleReviewLink: null
        },
        table: {
          id: table.id,
          tableNumber: table.table_code,
          tableName: table.table_code
        },
        session: { qrToken: table.qr_token || tableNumber }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper to build category and menu items list
 */
async function fetchMenuForRestaurant(restaurantId) {
  const categoryDocs = await db.select().from(menu_categories).where(
    and(
      eq(menu_categories.restaurant_id, restaurantId),
      eq(menu_categories.menu_category_status, 'ACTIVE'),
      isNull(menu_categories.deletedat)
    )
  ).orderBy(menu_categories.display_order, menu_categories.category);

  const menuItems = await db.select().from(menu_categories_items).where(
    and(
      eq(menu_categories_items.restaurant_id, restaurantId),
      eq(menu_categories_items.menu_item_status, 'AVAILABLE'),
      isNull(menu_categories_items.deletedat)
    )
  ).orderBy(menu_categories_items.display_order, menu_categories_items.name);

  const categoriesMap = new Map();
  for (const c of categoryDocs) {
    categoriesMap.set(c.id, {
      name: c.category,
      type: inferCategoryType(c.category, 'all'),
      image: c.image?.secure_url || null,
      items: []
    });
  }

  for (const item of menuItems) {
    let targetCat = categoriesMap.get(item.category_id);
    if (!targetCat) {
      targetCat = { name: 'General', type: 'all', image: null, items: [] };
      categoriesMap.set(item.category_id || 'general', targetCat);
    }
    targetCat.items.push({
      id: item.id,
      name: item.name,
      description: item.description,
      price: parseFloat(item.price),
      imageUrl: item.image?.secure_url || null,
      isAvailable: item.menu_item_status === 'AVAILABLE',
      dietaryPreference: item.menu_item_type === 'VEG' ? 'veg' : 'non-veg',
      preparationTime: 15,
      quantities: item.item_size ? [{ size: item.item_size, price: parseFloat(item.price) }] : []
    });
  }

  return Array.from(categoriesMap.values());
}

/**
 * GET /api/public/menu
 * Returns the restaurant menu grouped by category
 */
exports.getMenu = async (req, res, next) => {
  try {
    const restaurant = req.restaurant || req.tenantRegistry;
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found or inactive.' });
    }

    const restaurantId = restaurant.id || restaurant.restaurantId;
    const categories = await fetchMenuForRestaurant(restaurantId);

    res.status(200).json({
      success: true,
      data: {
        restaurant: {
          id: restaurantId,
          name: restaurant.restaurantName || restaurant.name,
          subtitle: null,
          slug: restaurant.domain || restaurant.slug || restaurant.subdomain,
          logo: null,
          taxPercent: 0,
          googleReviewLink: null
        },
        categories
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/public/restaurant/:slug/menu
 * Legacy endpoint - returns same menu data by slug
 */
exports.getRestaurantMenu = async (req, res, next) => {
  try {
    const { slug } = req.params;
    let restaurant = req.restaurant || req.tenantRegistry;

    if (!restaurant) {
      const [found] = await db.select().from(restaurants).where(
        and(
          eq(sql`LOWER(${restaurants.domain})`, slug.toLowerCase()),
          eq(restaurants.is_deleted, false)
        )
      ).limit(1);

      if (!found || found.restaurant_status !== 'ACTIVE') {
        return res.status(404).json({ success: false, message: 'Restaurant not found or inactive.' });
      }
      restaurant = found;
    }

    const restaurantId = restaurant.id || restaurant.restaurantId;
    const categories = await fetchMenuForRestaurant(restaurantId);

    res.status(200).json({
      success: true,
      data: {
        restaurant: {
          id: restaurantId,
          name: restaurant.restaurant_name || restaurant.restaurantName || restaurant.name,
          subtitle: null,
          slug: restaurant.domain || restaurant.slug || restaurant.subdomain,
          logo: null,
          taxPercent: 0,
          googleReviewLink: null
        },
        categories
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/public/orders
 * Create a customer order
 */
exports.createOrder = async (req, res, next) => {
  try {
    const { tableId, customerName, customerPhone, items } = req.body;

    if (!tableId) {
      return res.status(400).json({ success: false, message: 'Table is required.' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Order must have at least one item.' });
    }
    for (const item of items) {
      if (!item.menuItemId || !item.quantity || item.quantity < 1) {
        return res.status(400).json({ success: false, message: 'Each item must have a valid menuItemId and quantity >= 1.' });
      }
    }

    const [table] = await db.select().from(tables).where(
      and(
        eq(tables.id, tableId),
        eq(tables.table_status, 'ACTIVE'),
        eq(tables.is_deleted, false)
      )
    ).limit(1);

    if (!table) {
      return res.status(400).json({ success: false, message: 'Invalid or inactive table.' });
    }

    const restaurantId = table.restaurant_id;
    const OrderService = require('../services/OrderService');

    const result = await OrderService.createOrder({
      restaurant_id: restaurantId,
      table_id: table.id,
      customer_name: customerName?.trim() || 'Guest',
      customer_phone: customerPhone?.trim() || null,
      items: items.map(i => ({
        menu_item_id: i.menuItemId,
        quantity: parseInt(i.quantity, 10),
        customizations: i.size || ''
      }))
    });

    const order = result.order;
    const orderItemsList = result.items;

    // Dynamic Waiter Assignment
    const WaiterAssignmentService = require('../services/waiterAssignmentService');
    const assignment = await WaiterAssignmentService.assignWaiterForOrder(
      null,
      restaurantId,
      table,
      order.id
    );

    RealtimeService.orderCreated({
      restaurantId,
      order: {
        id: order.id,
        _id: order.id,
        orderNumber: order.order_number || `ORD-${order.id.slice(0, 8).toUpperCase()}`,
        tableId: table.id,
        tableNumber: table.table_code,
        items: orderItemsList.map(oi => ({
          id: oi.id,
          itemName: oi.item_name,
          unitPrice: parseFloat(oi.unit_price),
          quantity: oi.quantity,
          total: parseFloat(oi.total)
        })),
        total: parseFloat(order.final_amount || order.total_amount || 0),
        status: order.order_status,
        assignedWaiterId: assignment?.assignedWaiterId || null,
        assignmentType: assignment?.assignmentType || 'DYNAMIC',
        assignmentStatus: assignment?.assignmentStatus || 'ASSIGNED',
        createdAt: order.createdat || order.date
      },
      orderId: order.id,
      tableId: table.id,
      waiterId: assignment?.assignedWaiterId ? assignment.assignedWaiterId.toString() : null
    });

    res.status(201).json({
      success: true,
      data: {
        order: {
          id: order.id,
          _id: order.id,
          orderNumber: order.order_number || `ORD-${order.id.slice(0, 8).toUpperCase()}`,
          tableNumber: table.table_code,
          items: orderItemsList.map(oi => ({
            id: oi.id,
            itemName: oi.item_name,
            unitPrice: parseFloat(oi.unit_price),
            quantity: oi.quantity,
            total: parseFloat(oi.total)
          })),
          subtotal: parseFloat(order.total_amount || 0),
          taxAmount: parseFloat(order.tax_amount || 0),
          total: parseFloat(order.final_amount || order.total_amount || 0),
          status: order.order_status,
          createdAt: order.createdat || order.date
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/public/orders
 * Fetch customer orders by orderIds and/or tableId and/or phone
 */
exports.getCustomerOrders = async (req, res, next) => {
  try {
    const { orderIds, tableId, phone } = req.query;
    const conditions = [];

    if (orderIds) {
      const rawIds = (Array.isArray(orderIds) ? orderIds : String(orderIds).split(','))
        .map(s => String(s).trim())
        .filter(id => UUID_RE.test(id));

      if (rawIds.length > 0) {
        conditions.push(inArray(order_details.id, rawIds));
      }
    }

    if (tableId && UUID_RE.test(String(tableId).trim())) {
      conditions.push(eq(order_details.table_id, String(tableId).trim()));
    }

    if (phone) {
      const trimmedPhone = String(phone).trim();
      const matchingLeads = await db.select({ id: leads.id }).from(leads).where(
        eq(leads.number, trimmedPhone)
      );
      if (matchingLeads.length > 0) {
        conditions.push(inArray(order_details.lead_id, matchingLeads.map(l => l.id)));
      }
    }

    if (conditions.length === 0) {
      return res.status(200).json({ success: true, data: { orders: [] } });
    }

    const orders = await db.select().from(order_details)
      .where(or(...conditions))
      .orderBy(desc(order_details.date))
      .limit(50);

    const formattedOrders = [];
    for (const ord of orders) {
      const items = await db.select().from(order_items).where(
        eq(order_items.order_id, ord.id)
      );

      const [tbl] = ord.table_id ? await db.select().from(tables).where(eq(tables.id, ord.table_id)).limit(1) : [null];

      formattedOrders.push({
        id: ord.id,
        _id: ord.id,
        orderNumber: ord.order_number || `ORD-${ord.id.slice(0, 8).toUpperCase()}`,
        restaurantId: ord.restaurant_id,
        tableId: ord.table_id,
        tableNumber: tbl?.table_code || 'Table',
        customerName: ord.customer_name || 'Guest',
        customerPhone: ord.customer_phone || null,
        items: items.map(oi => ({
          id: oi.id,
          itemName: oi.item_name,
          unitPrice: parseFloat(oi.unit_price),
          quantity: oi.quantity,
          total: parseFloat(oi.total)
        })),
        subtotal: parseFloat(ord.total_amount || 0),
        taxPercent: 0,
        taxAmount: parseFloat(ord.tax_amount || 0),
        discount: parseFloat(ord.discount_amount || 0),
        total: parseFloat(ord.final_amount || ord.total_amount || 0),
        status: ord.order_status,
        paymentStatus: ord.payment_status || 'PENDING',
        createdAt: ord.date || ord.createdat,
        updatedAt: ord.updatedat
      });
    }

    res.status(200).json({
      success: true,
      data: { orders: formattedOrders }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/public/orders/:orderId
 * Get order details for confirmation page
 */
exports.getOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    if (!UUID_RE.test(String(orderId))) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const [order] = await db.select().from(order_details).where(
      eq(order_details.id, orderId)
    ).limit(1);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const items = await db.select().from(order_items).where(
      eq(order_items.order_id, orderId)
    );

    const [tbl] = order.table_id ? await db.select().from(tables).where(eq(tables.id, order.table_id)).limit(1) : [null];

    const formattedOrder = {
      id: order.id,
      _id: order.id,
      orderNumber: order.order_number || `ORD-${order.id.slice(0, 8).toUpperCase()}`,
      restaurantId: order.restaurant_id,
      tableId: order.table_id,
      tableNumber: tbl?.table_code || 'Table',
      customerName: order.customer_name || 'Guest',
      customerPhone: order.customer_phone || null,
      items: items.map(oi => ({
        id: oi.id,
        itemName: oi.item_name,
        unitPrice: parseFloat(oi.unit_price),
        quantity: oi.quantity,
        total: parseFloat(oi.total)
      })),
      subtotal: parseFloat(order.total_amount || 0),
      taxPercent: 0,
      taxAmount: parseFloat(order.tax_amount || 0),
      discount: parseFloat(order.discount_amount || 0),
      total: parseFloat(order.final_amount || order.total_amount || 0),
      status: order.order_status,
      paymentStatus: order.payment_status || 'PENDING',
      createdAt: order.date || order.createdat,
      updatedAt: order.updatedat
    };

    res.status(200).json({ success: true, data: { order: formattedOrder } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/public/service-requests
 * Customer creates a service request (Call waiter, Water, Cutlery, Bill)
 */
exports.createServiceRequest = async (req, res, next) => {
  try {
    const { tableId, type, note } = req.body;
    if (!tableId) {
      return res.status(400).json({ success: false, message: 'tableId is required.' });
    }

    const [table] = await db.select().from(tables).where(
      and(
        eq(tables.id, tableId),
        eq(tables.table_status, 'ACTIVE'),
        eq(tables.is_deleted, false)
      )
    ).limit(1);

    if (!table) {
      return res.status(400).json({ success: false, message: 'Invalid or inactive table.' });
    }

    const [serviceRequest] = await db.insert(service_requests).values({
      restaurant_id: table.restaurant_id,
      table_id: table.id,
      request_type: type || 'CALL_WAITER',
      request_status: 'OPEN',
      details: {
        note: note || '',
        tableNumber: table.table_code
      }
    }).returning();

    const payload = {
      id: serviceRequest.id,
      _id: serviceRequest.id,
      tableId: table.id,
      tableNumber: table.table_code,
      type: serviceRequest.request_type,
      note: note || '',
      status: serviceRequest.request_status,
      createdAt: serviceRequest.createdat
    };

    RealtimeService.serviceRequestCreated(table.restaurant_id, payload);

    res.status(201).json({
      success: true,
      message: 'Service request created successfully',
      data: {
        serviceRequest: {
          id: serviceRequest.id,
          _id: serviceRequest.id,
          tableId: table.id,
          tableNumber: table.table_code,
          type: serviceRequest.request_type,
          note: note || '',
          status: serviceRequest.request_status,
          createdAt: serviceRequest.createdat
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/public/banners or /api/public/ads
 */
exports.getBanners = async (req, res, next) => {
  try {
    const bannerRows = await db.select().from(ads).where(
      eq(ads.ad_status, true)
    ).orderBy(ads.display_order, desc(ads.createdat));

    const banners = bannerRows.map(b => ({
      _id: b.id,
      id: b.id,
      title: b.name || 'Special Offer',
      subtitle: b.description || '',
      imageUrl: b.image || '',
      targetUrl: b.url || '',
      isActive: b.ad_status !== false,
      status: 'active',
      createdAt: b.createdat
    }));

    res.status(200).json({ success: true, data: { banners, ads: banners } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/public/advertise
 */
exports.createAdInquiry = async (req, res, next) => {
  try {
    const { name, mobileNumber, businessName, email, city, message } = req.body;
    if (!name || !mobileNumber || !businessName) {
      return res.status(400).json({
        success: false,
        message: 'Name, mobile number, and business name are required'
      });
    }

    const inquiry = {
      id: crypto.randomUUID(),
      name,
      mobileNumber,
      businessName,
      email: email || '',
      city: city || '',
      message: message || '',
      status: 'NEW',
      createdAt: new Date()
    };

    await db.insert(audit_log).values({
      action: 'AD_INQUIRY',
      entity_type: 'AD_INQUIRY',
      details: inquiry
    });

    RealtimeService.adminEvent('ad_inquiry', inquiry);

    res.status(201).json({
      success: true,
      message: 'Advertisement inquiry submitted successfully',
      data: { inquiry }
    });
  } catch (error) {
    next(error);
  }
};
