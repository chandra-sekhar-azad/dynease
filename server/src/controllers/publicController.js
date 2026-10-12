const RestaurantRegistry = require('../models/platform/RestaurantRegistry');
const TenantDatabaseManager = require('../services/TenantDatabaseManager');

// Helper: get tenant DB from req (already resolved by tenantResolver middleware)
const requireTenantDb = (req, res) => {
  if (!req.tenantDb || !req.tenantRegistry) {
    res.status(404).json({ success: false, message: 'Restaurant not found or not active.' });
    return null;
  }
  return { tenantDb: req.tenantDb, registry: req.tenantRegistry };
};

const inferCategoryType = (name, explicitType) => {
  if (explicitType && explicitType !== 'all') return explicitType.toLowerCase();
  const lower = (name || '').toLowerCase();
  if (lower.includes('non-veg') || lower.includes('non veg') || lower.includes('nonveg')) return 'non-veg';
  if (lower.includes('vegan')) return 'vegan';
  if (lower.includes('veg')) return 'veg';
  return explicitType || 'all';
};

/**
 * GET /api/public/qr/:token
 * Resolves a QR token → restaurant + table info
 */
exports.getTableByQR = async (req, res, next) => {
  try {
    const { qrToken } = req.params;
    
    const info = requireTenantDb(req, res);
    if (!info) return;
    const { tenantDb, registry } = info;

    const Table = tenantDb.model('Table');
    const table = await Table.findOne({ qrToken, status: 'ACTIVE' });
    if (!table) {
      return res.status(404).json({ 
        success: false, 
        code: 'INVALID_QR',
        message: 'This table QR code is invalid or inactive.' 
      });
    }

    const RestaurantProfile = tenantDb.model('RestaurantProfile');
    const profile = await RestaurantProfile.findOne({ restaurantId: registry.restaurantId });
    
    if (!profile || !profile.isActive) {
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
          id: registry.restaurantId,
          name: profile.name,
          slug: registry.subdomain,
          logo: profile.logo?.secure_url || null,
          taxPercent: profile.taxInfo?.taxPercentage || 0,
          googleReviewLink: profile.googleReviewLink || null
        },
        table: { 
          id: table._id, 
          tableNumber: table.tableNumber, 
          tableName: table.tableName || null
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
    
    const info = requireTenantDb(req, res);
    if (!info) return;
    const { tenantDb, registry } = info;

    const Table = tenantDb.model('Table');
    const table = await Table.findOne({ tableNumber, status: 'ACTIVE' });
    if (!table) {
      return res.status(404).json({ 
        success: false, 
        code: 'INVALID_TABLE',
        message: 'This table number is invalid or inactive.' 
      });
    }

    const RestaurantProfile = tenantDb.model('RestaurantProfile');
    const profile = await RestaurantProfile.findOne({ restaurantId: registry.restaurantId });
    
    if (!profile || !profile.isActive) {
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
          id: registry.restaurantId,
          name: profile.name,
          subtitle: profile.subtitle || null,
          slug: registry.subdomain,
          logo: profile.logo?.secure_url || null,
          taxPercent: profile.taxInfo?.taxPercentage || 0,
          googleReviewLink: profile.googleReviewLink || null
        },
        table: { 
          id: table._id, 
          tableNumber: table.tableNumber, 
          tableName: table.tableName || null
        },
        session: { qrToken: table.qrToken || tableNumber } // fallback to tableNumber if no qrToken
      } 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/public/menu
 * Returns the restaurant menu grouped by category
 */
exports.getMenu = async (req, res, next) => {
  try {
    const info = requireTenantDb(req, res);
    if (!info) return;
    const { tenantDb, registry } = info;

    const RestaurantProfile = tenantDb.model('RestaurantProfile');
    const profile = await RestaurantProfile.findOne({ restaurantId: registry.restaurantId });
    
    if (!profile || !profile.isActive) {
      return res.status(404).json({ success: false, message: 'Restaurant not found or inactive.' });
    }

    const MenuItem = tenantDb.model('MenuItem');
    const menuItems = await MenuItem.find({ isAvailable: true }).sort({ category: 1, name: 1 });
    
    const Category = tenantDb.model('Category');
    const categoryDocs = await Category.find({ isActive: true }).sort({ displayOrder: 1, name: 1 });
    
    // Create base categories list
    const categories = categoryDocs.map(c => ({
      name: c.name,
      type: inferCategoryType(c.name, c.type),
      image: c.image?.secure_url || null,
      items: []
    }));
    
    // Add items to categories, also handle items that might not have a category document
    for (const item of menuItems) {
      let targetCat = categories.find(c => c.name === item.category);
      if (!targetCat) {
        targetCat = { name: item.category, type: inferCategoryType(item.category, 'all'), items: [] };
        categories.push(targetCat);
      }
      targetCat.items.push({
        id: item._id,
        name: item.name,
        description: item.description,
        price: item.price,
        imageUrl: item.image?.secure_url || null,
        isAvailable: item.isAvailable,
        dietaryPreference: item.dietaryPreference,
        preparationTime: item.preparationTime
      });
    }

    res.status(200).json({
      success: true,
      data: {
        restaurant: {
          id: registry.restaurantId,
          name: profile.name,
          subtitle: profile.subtitle || null,
          slug: registry.subdomain,
          logo: profile.logo?.secure_url || null,
          taxPercent: profile.taxInfo?.taxPercentage || 0,
          googleReviewLink: profile.googleReviewLink || null
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
    
    let tenantDb = req.tenantDb;
    let registry = req.tenantRegistry;

    // If not resolved via subdomain, try resolving via slug
    if (!tenantDb) {
      registry = await RestaurantRegistry.findOne({ subdomain: slug, status: 'ACTIVE' });
      if (!registry) {
        return res.status(404).json({ success: false, message: 'Restaurant not found or inactive.' });
      }
      tenantDb = await TenantDatabaseManager.getConnection(registry.databaseName);
    }

    const RestaurantProfile = tenantDb.model('RestaurantProfile');
    const profile = await RestaurantProfile.findOne({ restaurantId: registry.restaurantId });
    
    if (!profile || !profile.isActive) {
      return res.status(404).json({ success: false, message: 'Restaurant not found or inactive.' });
    }

    const MenuItem = tenantDb.model('MenuItem');
    const menuItems = await MenuItem.find({ isAvailable: true }).sort({ category: 1, name: 1 });
    
    const Category = tenantDb.model('Category');
    const categoryDocs = await Category.find({ isActive: true }).sort({ displayOrder: 1, name: 1 });
    
    // Create base categories list
    const categories = categoryDocs.map(c => ({
      name: c.name,
      type: inferCategoryType(c.name, c.type),
      image: c.image?.secure_url || null,
      items: []
    }));
    
    // Add items to categories, also handle items that might not have a category document
    for (const item of menuItems) {
      let targetCat = categories.find(c => c.name === item.category);
      if (!targetCat) {
        targetCat = { name: item.category, type: inferCategoryType(item.category, 'all'), items: [] };
        categories.push(targetCat);
      }
      targetCat.items.push({
        id: item._id,
        name: item.name,
        description: item.description,
        price: item.price,
        imageUrl: item.image?.secure_url || null,
        isAvailable: item.isAvailable,
        dietaryPreference: item.dietaryPreference,
        preparationTime: item.preparationTime
      });
    }

    res.status(200).json({
      success: true,
      data: {
        restaurant: {
          id: registry.restaurantId,
          name: profile.name,
          subtitle: profile.subtitle || null,
          slug: registry.subdomain,
          logo: profile.logo?.secure_url || null,
          taxPercent: profile.taxInfo?.taxPercentage || 0,
          googleReviewLink: profile.googleReviewLink || null
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
 * Create a customer order - NEVER trusts frontend prices
 */
exports.createOrder = async (req, res, next) => {
  try {
    const info = requireTenantDb(req, res);
    if (!info) return;
    const { tenantDb, registry } = info;

    const { tableId, customerName, customerPhone, items } = req.body;

    // --- Validation ---
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

    // --- Validate table ---
    const Table = tenantDb.model('Table');
    const table = await Table.findById(tableId);
    if (!table || table.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Invalid or inactive table.' });
    }

    // --- Validate menu items and compute prices server-side ---
    const MenuItem = tenantDb.model('MenuItem');
    const orderItems = [];
    let subtotal = 0;

    for (const reqItem of items) {
      const menuItem = await MenuItem.findById(reqItem.menuItemId);
      if (!menuItem) {
        return res.status(400).json({ success: false, message: `Menu item not found: ${reqItem.menuItemId}` });
      }
      if (!menuItem.isAvailable) {
        return res.status(400).json({ success: false, message: `Item is currently unavailable: ${menuItem.name}` });
      }
      const qty = parseInt(reqItem.quantity, 10);
      if (isNaN(qty) || qty < 1 || qty > 50) {
        return res.status(400).json({ success: false, message: `Invalid quantity for ${menuItem.name}` });
      }
      const lineSubtotal = parseFloat((menuItem.price * qty).toFixed(2));
      subtotal += lineSubtotal;
      orderItems.push({
        menuItemId: menuItem._id,
        itemName: menuItem.name,       // snapshot
        unitPrice: menuItem.price,     // snapshot
        quantity: qty,
        subtotal: lineSubtotal
      });
    }

    subtotal = parseFloat(subtotal.toFixed(2));

    // Get restaurant tax rate
    const RestaurantProfile = tenantDb.model('RestaurantProfile');
    const profile = await RestaurantProfile.findOne({ restaurantId: registry.restaurantId });
    const taxPercent = profile?.taxInfo?.taxPercentage || 0;
    const taxAmount = parseFloat(((subtotal * taxPercent) / 100).toFixed(2));
    const total = parseFloat((subtotal + taxAmount).toFixed(2));

    // --- Generate order number ---
    const Order = tenantDb.model('Order');
    const orderCount = await Order.countDocuments({ restaurantId: registry.restaurantId });
    const orderNumber = `ORD-${String(orderCount + 1001).padStart(4, '0')}`;

    // --- Create order ---
    const order = await Order.create({
      orderNumber,
      restaurantId: registry.restaurantId,
      tableId: table._id,
      tableNumber: table.tableNumber,
      customerName: customerName?.trim() || 'Guest',
      customerPhone: customerPhone?.trim() || null,
      items: orderItems,
      subtotal,
      taxPercent,
      taxAmount,
      discount: 0,
      total,
      status: 'PENDING',
      paymentStatus: 'PENDING'
    });

    // --- Dynamic Waiter Assignment ---
    const WaiterAssignmentService = require('../services/waiterAssignmentService');
    const assignment = await WaiterAssignmentService.assignWaiterForOrder(
      tenantDb,
      registry.restaurantId,
      table,
      order._id
    );

    order.assignedWaiterId = assignment.assignedWaiterId;
    order.assignmentType = assignment.assignmentType;
    order.assignmentStatus = assignment.assignmentStatus;
    order.assignedAt = assignment.assignedAt;
    order.assignmentTimeoutAt = assignment.assignmentTimeoutAt;
    await order.save();

    // Mark table as occupied
    await Table.findByIdAndUpdate(table._id, {
      isOccupied: true,
      lastOrderId: order._id
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant:${registry.restaurantId}`).emit('table_updated', {
        tableId: table._id,
        isOccupied: true,
        lastOrderId: order._id,
        primaryWaiterId: table.primaryWaiterId
      });

      const payload = {
        id: order._id,
        _id: order._id,
        orderNumber: order.orderNumber,
        tableId: order.tableId,
        tableNumber: order.tableNumber,
        items: order.items,
        total: order.total,
        status: order.status,
        assignedWaiterId: order.assignedWaiterId,
        assignmentType: order.assignmentType,
        assignmentStatus: order.assignmentStatus,
        assignmentTimeoutAt: order.assignmentTimeoutAt,
        createdAt: order.createdAt
      };

      // Emit to kitchen
      io.to(`kitchen:${registry.restaurantId}`).emit('new_order', payload);

      // Emit to restaurant admin/manager
      io.to(`restaurant:${registry.restaurantId}`).emit('new_order', payload);

      // Emit to all waiters
      io.to(`waiter:${registry.restaurantId}`).emit('new_order', payload);

      // Emit directly to assigned waiter room
      if (order.assignedWaiterId) {
        io.to(`waiter_user:${order.assignedWaiterId.toString()}`).emit('assigned_order', payload);
      } else {
        // Notify managers if order is unassigned
        io.to(`restaurant:${registry.restaurantId}`).emit('unassigned_order_alert', {
          orderNumber: order.orderNumber,
          tableNumber: order.tableNumber,
          reason: assignment.reason
        });
      }
    }

    res.status(201).json({
      success: true,
      data: {
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          tableNumber: order.tableNumber,
          items: order.items,
          subtotal: order.subtotal,
          taxAmount: order.taxAmount,
          total: order.total,
          status: order.status,
          createdAt: order.createdAt
        }
      }
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
    const info = requireTenantDb(req, res);
    if (!info) return;
    const { tenantDb } = info;

    const Order = tenantDb.model('Order');
    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    res.status(200).json({ success: true, data: { order } });
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
    const info = requireTenantDb(req, res);
    if (!info) return;
    const { tenantDb, registry } = info;

    const { tableId, type, note } = req.body;
    if (!tableId) {
      return res.status(400).json({ success: false, message: 'tableId is required.' });
    }

    const Table = tenantDb.model('Table');
    const table = await Table.findById(tableId);
    if (!table || table.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Invalid or inactive table.' });
    }

    const ServiceRequest = tenantDb.model('ServiceRequest');
    const serviceRequest = await ServiceRequest.create({
      restaurantId: registry.restaurantId,
      tableId: table._id,
      tableNumber: table.tableNumber,
      type: type || 'CALL_WAITER',
      note: note || '',
      status: 'OPEN',
      assignedWaiterId: table.primaryWaiterId || null
    });

    const io = req.app.get('io');
    if (io) {
      const payload = {
        id: serviceRequest._id,
        _id: serviceRequest._id,
        tableId: table._id,
        tableNumber: table.tableNumber,
        type: serviceRequest.type,
        note: serviceRequest.note,
        status: serviceRequest.status,
        assignedWaiterId: serviceRequest.assignedWaiterId,
        createdAt: serviceRequest.createdAt
      };

      io.to(`restaurant:${registry.restaurantId}`).emit('new_service_request', payload);
      io.to(`waiter:${registry.restaurantId}`).emit('new_service_request', payload);
      if (serviceRequest.assignedWaiterId) {
        io.to(`waiter_user:${serviceRequest.assignedWaiterId.toString()}`).emit('assigned_service_request', payload);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Service request created successfully',
      data: { serviceRequest }
    });
  } catch (error) {
    next(error);
  }
};

const Ad = require('../models/platform/Ad');

exports.getBanners = async (req, res, next) => {
  try {
    const banners = await Ad.find({ status: 'Active' }).sort('-createdAt');
    res.status(200).json({ success: true, data: { banners } });
  } catch (error) {
    next(error);
  }
};
