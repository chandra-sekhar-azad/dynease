const crypto = require('crypto');
const { db, schema } = require('../db/client');
const { eq, and, or, sql, desc, inArray, isNull } = require('drizzle-orm');
const {
  restaurants,
  tables,
  menu_categories,
  menu_categories_items,
  order_details,
  customer_orders,
  order_items,
  leads,
  service_requests,
  ads,
  audit_log,
  table_session
} = schema;

const RealtimeService = require('../services/RealtimeService');
const CustomerSessionService = require('../services/CustomerSessionService');
const { verifyProximity } = require('../utils/geo');
const { normalizePhoneNumber } = require('../utils/phone');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const inferCategoryType = (name, explicitType) => {
  const exp = (explicitType || '').toLowerCase().trim();
  if (exp === 'non-veg') return 'non-veg';
  if (exp === 'veg') return 'veg';
  const lower = (name || '').toLowerCase();
  if (
    lower.includes('non-veg') || 
    lower.includes('non veg') || 
    lower.includes('nonveg') ||
    lower.includes('chicken') ||
    lower.includes('mutton') ||
    lower.includes('fish') ||
    lower.includes('prawn') ||
    lower.includes('seafood') ||
    lower.includes('egg')
  ) {
    return 'non-veg';
  }
  return 'veg';
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
 * POST /api/public/tables/verify-location
 * Verifies QR token, 50-metre proximity, and atomic table availability
 */
exports.verifyTableLocation = async (req, res, next) => {
  try {
    const { qrToken, latitude, longitude } = req.body;

    if (!qrToken) {
      return res.status(400).json({ success: false, message: 'QR token is required.' });
    }

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

    // Anti-collision: Ensure QR code matches the visited restaurant subdomain
    if (req.tenantRegistry && req.tenantRegistry.id && req.tenantRegistry.id !== restaurant.id) {
      return res.status(403).json({
        success: false,
        code: 'RESTAURANT_MISMATCH',
        message: `This table QR belongs to "${restaurant.restaurant_name || restaurant.name}", not "${req.tenantRegistry.name}". Cross-restaurant QR scanning is not permitted.`
      });
    }

    // Geolocation verification (50 meters radius)
    let verifiedDistance = null;
    if (restaurant.latitude && restaurant.longitude) {
      if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) {
        return res.status(400).json({
          success: false,
          code: 'LOCATION_REQUIRED',
          message: `Location permission is required to verify that you are within 50 metres of ${restaurant.restaurant_name || restaurant.name}.`
        });
      }

      try {
        const radius = restaurant.geofence_radius_meters || 50;
        const prox = verifyProximity(latitude, longitude, restaurant.latitude, restaurant.longitude, radius);
        if (!prox.isWithin) {
          return res.status(403).json({
            success: false,
            code: 'LOCATION_OUT_OF_RANGE',
            message: `You are outside the permitted ${radius}-metre radius of ${restaurant.restaurant_name || restaurant.name} (${prox.distanceMeters}m away). Please scan while inside the restaurant.`
          });
        }
        verifiedDistance = prox.distanceMeters;
      } catch (geoErr) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_LOCATION',
          message: geoErr.message || 'Invalid geolocation coordinates.'
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        code: 'RESTAURANT_LOCATION_NOT_SET',
        message: `The location for "${restaurant.restaurant_name || restaurant.name}" has not been configured by the admin yet. Please ask restaurant staff to set the location in Settings.`
      });
    }

    // Atomic Table Availability Check
    const [activeSession] = await db.select().from(table_session).where(
      and(
        eq(table_session.table_id, table.id),
        eq(table_session.session_status, 'ACTIVE')
      )
    ).limit(1);

    const [activeVisit] = await db.select().from(order_details).where(
      and(
        eq(order_details.table_id, table.id),
        sql`${order_details.order_status} NOT IN ('COMPLETED', 'CANCELLED')`
      )
    ).limit(1);

    if (activeSession || activeVisit) {
      return res.status(409).json({
        success: false,
        code: 'TABLE_OCCUPIED',
        message: 'This table is currently occupied. Please choose another table or contact a waiter.'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        verified: true,
        restaurant: {
          id: restaurant.id,
          name: restaurant.restaurant_name || restaurant.name,
          slug: restaurant.domain,
          logo: null,
          taxPercent: restaurant.taxPercent || 0
        },
        table: {
          id: table.id,
          tableNumber: table.table_code,
          tableName: table.table_code,
          distanceMeters: verifiedDistance
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/public/tables/start-session
 * Allocates table, registers/reuses lead, creates 256-bit secure session token in HttpOnly cookie
 */
exports.startTableSession = async (req, res, next) => {
  try {
    const { qrToken, phone, name, latitude, longitude } = req.body;

    if (!qrToken) {
      return res.status(400).json({ success: false, message: 'QR token is required.' });
    }
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Mobile number is required to start your dining session.' });
    }

    const [table] = await db.select().from(tables).where(
      and(
        eq(tables.qr_token, qrToken),
        eq(tables.table_status, 'ACTIVE'),
        eq(tables.is_deleted, false)
      )
    ).limit(1);

    if (!table) {
      return res.status(404).json({ success: false, code: 'INVALID_QR', message: 'Invalid or inactive table QR code.' });
    }

    const [restaurant] = await db.select().from(restaurants).where(
      and(eq(restaurants.id, table.restaurant_id), eq(restaurants.is_deleted, false))
    ).limit(1);

    if (!restaurant || restaurant.restaurant_status !== 'ACTIVE') {
      return res.status(403).json({ success: false, code: 'RESTAURANT_UNAVAILABLE', message: 'Restaurant is currently unavailable.' });
    }

    // Anti-collision: Ensure QR code matches the visited restaurant subdomain
    if (req.tenantRegistry && req.tenantRegistry.id && req.tenantRegistry.id !== restaurant.id) {
      return res.status(403).json({
        success: false,
        code: 'RESTAURANT_MISMATCH',
        message: `This table QR belongs to "${restaurant.restaurant_name || restaurant.name}", not "${req.tenantRegistry.name}". Cross-restaurant QR scanning is not permitted.`
      });
    }

    // Geolocation verification
    if (restaurant.latitude && restaurant.longitude) {
      if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) {
        return res.status(400).json({
          success: false,
          code: 'LOCATION_REQUIRED',
          message: 'Location permission is required to verify table proximity.'
        });
      }
      const radius = restaurant.geofence_radius_meters || 50;
      const prox = verifyProximity(latitude, longitude, restaurant.latitude, restaurant.longitude, radius);
      if (!prox.isWithin) {
        return res.status(403).json({
          success: false,
          code: 'LOCATION_OUT_OF_RANGE',
          message: `You are outside the permitted ${radius}-metre radius of ${restaurant.restaurant_name || restaurant.name} (${prox.distanceMeters}m away).`
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        code: 'RESTAURANT_LOCATION_NOT_SET',
        message: `The location for "${restaurant.restaurant_name || restaurant.name}" has not been configured by the admin yet.`
      });
    }

    // Allocate table and create session
    const allocation = await CustomerSessionService.allocateTableAndCreateSession({
      restaurantId: restaurant.id,
      tableId: table.id,
      rawPhone: phone,
      customerName: name
    });

    // Set HttpOnly, Secure cookie
    CustomerSessionService.setSessionCookie(res, allocation.rawToken);

    // Notify assigned waiter in real time
    RealtimeService.tableAllocated({
      restaurantId: restaurant.id,
      tableId: table.id,
      tableNumber: table.table_code,
      visitId: allocation.visit.id,
      leadName: name || 'Guest',
      waiterId: table.assigned_waiter_id || null
    });

    res.status(200).json({
      success: true,
      message: `Table ${table.table_code} allocated successfully.`,
      data: {
        sessionStatus: allocation.session.session_status,
        visitId: allocation.visit.id,
        table: {
          id: table.id,
          tableNumber: table.table_code
        },
        restaurant: {
          id: restaurant.id,
          name: restaurant.restaurant_name || restaurant.name,
          slug: restaurant.domain
        }
      }
    });
  } catch (error) {
    if (error.code === 'TABLE_OCCUPIED') {
      return res.status(409).json({
        success: false,
        code: 'TABLE_OCCUPIED',
        message: error.message
      });
    }
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
      type: inferCategoryType(c.category, c.type),
      image: c.image?.secure_url || null,
      items: []
    });
  }

  for (const item of menuItems) {
    let targetCat = categoriesMap.get(item.category_id);
    if (!targetCat) {
      targetCat = { name: 'General', type: 'veg', image: null, items: [] };
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
      quantities: (Array.isArray(item.quantities) && item.quantities.length > 0)
        ? item.quantities
        : (item.item_size ? [{ size: item.item_size, price: parseFloat(item.price) }] : [{ size: 'Full', price: parseFloat(item.price) }])
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
 * Create a customer order or append items to an existing active order
 */
exports.createOrder = async (req, res, next) => {
  try {
    const { tableId, customerName, customerPhone, items, orderId } = req.body;

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
    const WaiterAssignmentService = require('../services/waiterAssignmentService');

    const orderPayloadItems = items.map(i => ({
      menu_item_id: i.menuItemId,
      quantity: parseInt(i.quantity, 10),
      customizations: i.size || ''
    }));

    // ── Check if active customer visit session exists (via middleware or cookie) ──
    let customerSession = req.customerSession;
    if (!customerSession) {
      const rawToken = req.cookies?.dynease_table_session || req.headers['x-table-session-token'];
      if (rawToken) {
        customerSession = await CustomerSessionService.findActiveSession(rawToken);
      }
    }

    if (customerSession && customerSession.visit) {
      const visit = customerSession.visit;
      const table = customerSession.table;
      const currentRestaurantId = customerSession.restaurantId;
      const idempotencyKey = req.body.idempotencyKey || req.headers['idempotency-key'] || req.body.orderId || null;

      const result = await OrderService.submitOrderInVisit({
        visitId: visit.id,
        restaurantId: currentRestaurantId,
        items: orderPayloadItems,
        special_instructions: req.body.specialInstructions || '',
        idempotency_key: idempotencyKey
      });

      const order = result.order;
      const orderItemsList = result.items;

      // Dynamic Waiter Assignment if not already assigned on visit
      let assignedWaiterId = visit.assigned_waiter_id;
      if (!assignedWaiterId) {
        const assignment = await WaiterAssignmentService.assignWaiterForOrder(
          null,
          currentRestaurantId,
          table,
          order.id
        );
        assignedWaiterId = assignment?.assignedWaiterId || null;
        if (assignedWaiterId) {
          await db.update(order_details)
            .set({ assigned_waiter_id: assignedWaiterId })
            .where(eq(order_details.id, visit.id));
        }
      }

      const formattedOrder = {
        id: order.id,
        _id: order.id,
        orderNumber: order.order_number,
        visitId: visit.id,
        tableId: table.id,
        tableNumber: table.table_code,
        items: orderItemsList.map(oi => ({
          id: oi.id,
          itemName: oi.item_name,
          unitPrice: parseFloat(oi.unit_price),
          quantity: oi.quantity,
          requestedQuantity: oi.requested_quantity || oi.quantity,
          acceptedQuantity: oi.accepted_quantity !== null ? oi.accepted_quantity : oi.quantity,
          total: parseFloat(oi.total),
          subtotal: parseFloat(oi.total),
          size: oi.customizations || null,
          status: oi.item_status || 'PENDING'
        })),
        subtotal: parseFloat(order.subtotal || 0),
        taxAmount: 0,
        total: parseFloat(order.subtotal || 0),
        status: order.order_status,
        assignedWaiterId,
        createdAt: order.createdat
      };

      if (!result.duplicate) {
        RealtimeService.orderCreated({
          restaurantId: currentRestaurantId,
          order: formattedOrder,
          orderId: order.id,
          tableId: table.id,
          waiterId: assignedWaiterId ? assignedWaiterId.toString() : null
        });
      }

      return res.status(201).json({
        success: true,
        data: {
          order: formattedOrder,
          visitId: visit.id,
          duplicate: result.duplicate || false
        }
      });
    }

    // ── Check if there is an active dining visit on this table ──
    let activeTableVisit = null;
    const [foundVisit] = await db.select().from(order_details).where(
      and(
        eq(order_details.table_id, table.id),
        eq(order_details.restaurant_id, restaurantId),
        sql`${order_details.order_status} NOT IN ('COMPLETED', 'CANCELLED')`
      )
    ).limit(1);
    if (foundVisit) activeTableVisit = foundVisit;

    if (activeTableVisit) {
      const visit = activeTableVisit;
      const idempotencyKey = req.body.idempotencyKey || req.headers['idempotency-key'] || req.body.orderId || null;

      const result = await OrderService.submitOrderInVisit({
        visitId: visit.id,
        restaurantId,
        items: orderPayloadItems,
        special_instructions: req.body.specialInstructions || '',
        idempotency_key: idempotencyKey
      });

      const order = result.order;
      const orderItemsList = result.items;

      let assignedWaiterId = visit.assigned_waiter_id;
      if (!assignedWaiterId) {
        const assignment = await WaiterAssignmentService.assignWaiterForOrder(
          null,
          restaurantId,
          table,
          order.id
        );
        assignedWaiterId = assignment?.assignedWaiterId || null;
        if (assignedWaiterId) {
          await db.update(order_details)
            .set({ assigned_waiter_id: assignedWaiterId })
            .where(eq(order_details.id, visit.id));
        }
      }

      const formattedOrder = {
        id: order.id,
        _id: order.id,
        orderNumber: order.order_number,
        visitId: visit.id,
        tableId: table.id,
        tableNumber: table.table_code,
        items: orderItemsList.map(oi => ({
          id: oi.id,
          itemName: oi.item_name,
          unitPrice: parseFloat(oi.unit_price),
          quantity: oi.quantity,
          requestedQuantity: oi.requested_quantity || oi.quantity,
          acceptedQuantity: oi.accepted_quantity !== null ? oi.accepted_quantity : oi.quantity,
          total: parseFloat(oi.total),
          subtotal: parseFloat(oi.total),
          size: oi.customizations || null,
          status: oi.item_status || 'PENDING'
        })),
        subtotal: parseFloat(order.subtotal || 0),
        taxAmount: 0,
        total: parseFloat(order.subtotal || 0),
        status: order.order_status,
        assignedWaiterId,
        createdAt: order.createdat
      };

      if (!result.duplicate) {
        RealtimeService.orderCreated({
          restaurantId,
          order: formattedOrder,
          orderId: order.id,
          tableId: table.id,
          waiterId: assignedWaiterId ? assignedWaiterId.toString() : null
        });
      }

      return res.status(201).json({
        success: true,
        data: {
          order: formattedOrder,
          visitId: visit.id,
          duplicate: result.duplicate || false
        }
      });
    }

    // ── Case B: Brand new order creation ──
    const result = await OrderService.createOrder({
      restaurant_id: restaurantId,
      table_id: table.id,
      customer_name: customerName?.trim() || 'Guest',
      customer_phone: customerPhone?.trim() || null,
      items: orderPayloadItems,
      special_instructions: req.body.specialInstructions || '',
      idempotency_key: req.body.idempotencyKey || req.headers['idempotency-key'] || null
    });

    const order = result.order;
    const orderItemsList = result.items;
    const visit = result.visit;

    // Dynamic Waiter Assignment
    const assignment = await WaiterAssignmentService.assignWaiterForOrder(
      null,
      restaurantId,
      table,
      order.id
    );

    const assignedWaiterId = assignment?.assignedWaiterId || null;
    if (assignedWaiterId && visit?.id) {
      await db.update(order_details)
        .set({ assigned_waiter_id: assignedWaiterId })
        .where(eq(order_details.id, visit.id));
    }

    const formattedOrder = {
      id: order.id,
      _id: order.id,
      orderNumber: order.order_number || `ORD-${order.id.slice(0, 8).toUpperCase()}`,
      visitId: visit?.id,
      tableId: table.id,
      tableNumber: table.table_code,
      items: orderItemsList.map(oi => ({
        id: oi.id,
        itemName: oi.item_name,
        unitPrice: parseFloat(oi.unit_price),
        quantity: oi.quantity,
        total: parseFloat(oi.total),
        subtotal: parseFloat(oi.total),
        size: oi.customizations || null
      })),
      subtotal: parseFloat(order.subtotal || order.total_amount || 0),
      taxAmount: parseFloat(order.tax_amount || 0),
      total: parseFloat(order.subtotal || order.final_amount || order.total_amount || 0),
      status: order.order_status,
      assignedWaiterId,
      assignmentType: assignment?.assignmentType || 'DYNAMIC',
      assignmentStatus: assignment?.assignmentStatus || 'ASSIGNED',
      createdAt: order.createdat || order.date
    };

    if (!result.duplicate) {
      RealtimeService.orderCreated({
        restaurantId,
        order: formattedOrder,
        orderId: order.id,
        tableId: table.id,
        waiterId: assignedWaiterId ? assignedWaiterId.toString() : null
      });
    }

    res.status(201).json({
      success: true,
      data: {
        order: formattedOrder,
        visitId: visit?.id
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

    const rawIds = orderIds
      ? (Array.isArray(orderIds) ? orderIds : String(orderIds).split(','))
          .map(s => String(s).trim())
          .filter(id => UUID_RE.test(id))
      : [];

    if (rawIds.length > 0) {
      conditions.push(inArray(order_details.id, rawIds));
    }

    if (tableId && UUID_RE.test(String(tableId).trim())) {
      conditions.push(
        and(
          eq(order_details.table_id, String(tableId).trim()),
          sql`${order_details.order_status} NOT IN ('COMPLETED', 'CANCELLED', 'PAID')`
        )
      );
    }

    let leadPhoneMap = new Map();
    if (phone) {
      const trimmedPhone = String(phone).trim();
      const digitsOnly = trimmedPhone.replace(/\D/g, '');
      const last10 = digitsOnly.slice(-10);

      const phoneConditions = [
        eq(order_details.customer_phone, trimmedPhone)
      ];

      if (digitsOnly && digitsOnly !== trimmedPhone) {
        phoneConditions.push(eq(order_details.customer_phone, digitsOnly));
      }

      if (last10 && last10.length >= 7) {
        phoneConditions.push(
          sql`RIGHT(REGEXP_REPLACE(COALESCE(${order_details.customer_phone}, ''), '[^0-9]', '', 'g'), 10) = ${last10}`
        );
      }

      const leadConditions = [eq(leads.number, trimmedPhone)];
      if (digitsOnly && digitsOnly !== trimmedPhone) {
        leadConditions.push(eq(leads.number, digitsOnly));
      }
      if (last10 && last10.length >= 7) {
        leadConditions.push(
          sql`RIGHT(REGEXP_REPLACE(COALESCE(${leads.number}, ''), '[^0-9]', '', 'g'), 10) = ${last10}`
        );
      }

      const matchingLeads = await db.select({ id: leads.id, number: leads.number }).from(leads).where(
        or(...leadConditions)
      );

      if (matchingLeads.length > 0) {
        matchingLeads.forEach(l => leadPhoneMap.set(l.id, l.number));
        phoneConditions.push(inArray(order_details.lead_id, matchingLeads.map(l => l.id)));
      }

      conditions.push(or(...phoneConditions));
    }

    // Also check if rawIds contains any customer_orders IDs
    let custOrders = [];
    if (rawIds.length > 0) {
      custOrders = await db.select().from(customer_orders).where(
        inArray(customer_orders.id, rawIds)
      );
    }

    if (conditions.length === 0 && custOrders.length === 0) {
      return res.status(200).json({ success: true, data: { orders: [] } });
    }

    let orders = [];
    if (conditions.length > 0) {
      orders = await db.select().from(order_details)
        .where(or(...conditions))
        .orderBy(desc(order_details.date))
        .limit(100);
    }

    const formattedOrders = [];
    const seenOrderIds = new Set();

    // 1. Process individual customer_orders if any were explicitly queried
    for (const co of custOrders) {
      if (seenOrderIds.has(co.id)) continue;
      seenOrderIds.add(co.id);

      const items = await db.select().from(order_items).where(
        eq(order_items.order_id, co.id)
      );

      const [visit] = await db.select().from(order_details).where(
        eq(order_details.id, co.visit_id)
      ).limit(1);

      const [tbl] = visit?.table_id ? await db.select().from(tables).where(eq(tables.id, visit.table_id)).limit(1) : [null];

      formattedOrders.push({
        id: co.id,
        _id: co.id,
        orderNumber: co.order_number || `ORD-${co.id.slice(0, 8).toUpperCase()}`,
        visitId: co.visit_id,
        restaurantId: co.restaurant_id,
        tableId: visit?.table_id,
        tableNumber: tbl?.table_code || 'Table',
        customerName: visit?.customer_name || 'Guest',
        customerPhone: visit?.customer_phone || (visit?.lead_id ? leadPhoneMap.get(visit.lead_id) : null) || (phone ? String(phone).trim() : null),
        items: items.map(oi => ({
          id: oi.id,
          itemName: oi.item_name,
          unitPrice: parseFloat(oi.unit_price),
          quantity: oi.quantity,
          requestedQuantity: oi.requested_quantity || oi.quantity,
          acceptedQuantity: oi.accepted_quantity !== null && oi.accepted_quantity !== undefined ? oi.accepted_quantity : oi.quantity,
          total: parseFloat(oi.total),
          subtotal: parseFloat(oi.total),
          size: oi.customizations || null,
          status: oi.item_status || 'PENDING'
        })),
        subtotal: parseFloat(co.subtotal || 0),
        taxPercent: 0,
        taxAmount: 0,
        discount: 0,
        total: parseFloat(co.subtotal || 0),
        status: (visit?.order_status === 'COMPLETED' || co.order_status === 'COMPLETED') ? 'COMPLETED' : (visit?.order_status === 'CANCELLED' || co.order_status === 'CANCELLED') ? 'CANCELLED' : (visit?.order_status === 'SERVED' || co.order_status === 'SERVED') ? 'SERVED' : (co.order_status || visit?.order_status),
        paymentStatus: visit?.payment_status || 'PENDING',
        createdAt: co.createdat,
        updatedAt: co.updatedat
      });
    }

    // 2. Process visit-level orders
    for (const ord of orders) {
      const childCustOrders = await db.select().from(customer_orders).where(
        eq(customer_orders.visit_id, ord.id)
      ).orderBy(desc(customer_orders.createdat));

      if (childCustOrders.length > 0) {
        for (const cco of childCustOrders) {
          if (seenOrderIds.has(cco.id)) continue;
          seenOrderIds.add(cco.id);

          const items = await db.select().from(order_items).where(
            eq(order_items.order_id, cco.id)
          );
          const [tbl] = ord.table_id ? await db.select().from(tables).where(eq(tables.id, ord.table_id)).limit(1) : [null];

          formattedOrders.push({
            id: cco.id,
            _id: cco.id,
            orderNumber: cco.order_number,
            visitId: ord.id,
            restaurantId: ord.restaurant_id,
            tableId: ord.table_id,
            tableNumber: tbl?.table_code || 'Table',
            customerName: ord.customer_name || 'Guest',
            customerPhone: ord.customer_phone || (ord.lead_id ? leadPhoneMap.get(ord.lead_id) : null) || (phone ? String(phone).trim() : null),
            items: items.map(oi => ({
              id: oi.id,
              itemName: oi.item_name,
              unitPrice: parseFloat(oi.unit_price),
              quantity: oi.quantity,
              requestedQuantity: oi.requested_quantity || oi.quantity,
              acceptedQuantity: oi.accepted_quantity !== null && oi.accepted_quantity !== undefined ? oi.accepted_quantity : oi.quantity,
              total: parseFloat(oi.total),
              subtotal: parseFloat(oi.total),
              size: oi.customizations || null,
              status: oi.item_status || 'PENDING'
            })),
            subtotal: parseFloat(cco.subtotal || 0),
            taxPercent: 0,
            taxAmount: 0,
            discount: 0,
            total: parseFloat(cco.subtotal || 0),
            status: (ord.order_status === 'COMPLETED' || cco.order_status === 'COMPLETED') ? 'COMPLETED' : (ord.order_status === 'CANCELLED' || cco.order_status === 'CANCELLED') ? 'CANCELLED' : (ord.order_status === 'SERVED' || cco.order_status === 'SERVED') ? 'SERVED' : (cco.order_status || ord.order_status),
            paymentStatus: ord.payment_status || 'PENDING',
            createdAt: cco.createdat,
            updatedAt: cco.updatedat
          });
        }
      } else {
        if (seenOrderIds.has(ord.id)) continue;
        seenOrderIds.add(ord.id);

        const items = await db.select().from(order_items).where(
          or(
            eq(order_items.visit_id, ord.id),
            eq(order_items.order_id, ord.id)
          )
        );

        const [tbl] = ord.table_id ? await db.select().from(tables).where(eq(tables.id, ord.table_id)).limit(1) : [null];

        formattedOrders.push({
          id: ord.id,
          _id: ord.id,
          orderNumber: ord.order_number || `ORD-${ord.id.slice(0, 8).toUpperCase()}`,
          visitId: ord.id,
          restaurantId: ord.restaurant_id,
          tableId: ord.table_id,
          tableNumber: tbl?.table_code || 'Table',
          customerName: ord.customer_name || 'Guest',
          customerPhone: ord.customer_phone || (ord.lead_id ? leadPhoneMap.get(ord.lead_id) : null) || (phone ? String(phone).trim() : null),
          items: items.map(oi => ({
            id: oi.id,
            itemName: oi.item_name,
            unitPrice: parseFloat(oi.unit_price),
            quantity: oi.quantity,
            total: parseFloat(oi.total),
            subtotal: parseFloat(oi.total),
            size: oi.customizations || null
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

    let [order] = await db.select().from(order_details).where(
      eq(order_details.id, orderId)
    ).limit(1);

    let custOrder = null;
    if (!order) {
      const [foundCust] = await db.select().from(customer_orders).where(
        eq(customer_orders.id, orderId)
      ).limit(1);

      if (foundCust) {
        custOrder = foundCust;
        [order] = await db.select().from(order_details).where(
          eq(order_details.id, custOrder.visit_id)
        ).limit(1);
      }
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const items = await db.select().from(order_items).where(
      custOrder
        ? eq(order_items.order_id, custOrder.id)
        : or(eq(order_items.visit_id, order.id), eq(order_items.order_id, order.id))
    );

    const [tbl] = order.table_id ? await db.select().from(tables).where(eq(tables.id, order.table_id)).limit(1) : [null];

    const formattedOrder = {
      id: custOrder ? custOrder.id : order.id,
      _id: custOrder ? custOrder.id : order.id,
      orderNumber: (custOrder ? custOrder.order_number : order.order_number) || `ORD-${(custOrder ? custOrder.id : order.id).slice(0, 8).toUpperCase()}`,
      visitId: order.id,
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
        total: parseFloat(oi.total),
        subtotal: parseFloat(oi.total),
        size: oi.customizations || null,
        status: oi.item_status || 'PENDING'
      })),
      subtotal: parseFloat((custOrder ? custOrder.subtotal : order.total_amount) || 0),
      taxPercent: 0,
      taxAmount: parseFloat(order.tax_amount || 0),
      discount: parseFloat(order.discount_amount || 0),
      total: parseFloat((custOrder ? custOrder.subtotal : (order.final_amount || order.total_amount)) || 0),
      status: custOrder ? custOrder.order_status : order.order_status,
      paymentStatus: order.payment_status || 'PENDING',
      createdAt: (custOrder ? custOrder.createdat : order.date) || order.createdat,
      updatedAt: (custOrder ? custOrder.updatedat : order.updatedat)
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

/**
 * GET /api/public/visit/bill
 * Retrieve aggregated bill for the active dining visit
 */
exports.getVisitBill = async (req, res, next) => {
  try {
    let session = req.customerSession;
    if (!session) {
      const rawToken = req.cookies?.dynease_table_session || req.headers['x-table-session-token'];
      if (rawToken) {
        session = await CustomerSessionService.findActiveSession(rawToken);
      }
    }

    if (!session || !session.visit) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED_SESSION', message: 'Active visit session is required.' });
    }

    const OrderService = require('../services/OrderService');
    const bill = await OrderService.getVisitBill(session.visit.id, session.restaurantId);

    res.status(200).json({
      success: true,
      data: { bill }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/public/visit/orders
 * Retrieve all orders submitted during the active visit
 */
exports.getVisitOrders = async (req, res, next) => {
  try {
    let session = req.customerSession;
    if (!session) {
      const rawToken = req.cookies?.dynease_table_session || req.headers['x-table-session-token'];
      if (rawToken) {
        session = await CustomerSessionService.findActiveSession(rawToken);
      }
    }

    if (!session || !session.visit) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED_SESSION', message: 'Active visit session is required.' });
    }

    const orders = await db.select().from(customer_orders).where(
      eq(customer_orders.visit_id, session.visit.id)
    ).orderBy(desc(customer_orders.createdat));

    const allItems = await db.select().from(order_items).where(
      eq(order_items.visit_id, session.visit.id)
    ).orderBy(order_items.createdat);

    const itemsByOrder = new Map();
    for (const item of allItems) {
      if (!itemsByOrder.has(item.order_id)) {
        itemsByOrder.set(item.order_id, []);
      }
      itemsByOrder.get(item.order_id).push({
        id: item.id,
        name: item.item_name,
        itemName: item.item_name,
        requestedQuantity: item.requested_quantity || item.quantity,
        acceptedQuantity: item.accepted_quantity !== null && item.accepted_quantity !== undefined ? item.accepted_quantity : item.quantity,
        unitPrice: parseFloat(item.unit_price),
        total: parseFloat(item.total),
        subtotal: parseFloat(item.total),
        status: item.item_status || 'ACCEPTED',
        rejectionReason: item.rejection_reason || null,
        size: item.customizations || null
      });
    }

    const formattedOrders = orders.map(o => ({
      id: o.id,
      _id: o.id,
      orderNumber: o.order_number,
      status: o.order_status,
      subtotal: parseFloat(o.subtotal),
      items: itemsByOrder.get(o.id) || [],
      createdAt: o.createdat
    }));

    res.status(200).json({
      success: true,
      data: {
        visitId: session.visit.id,
        tableId: session.tableId,
        orderStatus: session.visit.order_status,
        orders: formattedOrders
      }
    });
  } catch (error) {
    next(error);
  }
};

