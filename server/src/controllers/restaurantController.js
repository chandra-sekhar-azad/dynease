const { uploadToCloudinary } = require('../utils/cloudinary');

// ──────────────────────────────────────────
//  CATEGORY CRUD
// ──────────────────────────────────────────

exports.getCategories = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const Category = req.tenantDb.model('Category');
    const categories = await Category.find({ restaurantId }).sort({ displayOrder: 1, name: 1 });
    res.status(200).json({ success: true, data: { categories } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { name, description, displayOrder } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required.' });
    }
    const Category = req.tenantDb.model('Category');
    const existing = await Category.findOne({ restaurantId, name: name.trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A category with this name already exists.' });
    }

    let image = null;
    if (req.file) {
      try {
        const uploadResult = await uploadToCloudinary(req.file.buffer, `dynease/categories/${restaurantId}`);
        image = {
          public_id: uploadResult.public_id,
          secure_url: uploadResult.secure_url
        };
      } catch (uploadError) {
        console.error("Cloudinary Upload Error:", uploadError);
      }
    }

    const category = await Category.create({
      restaurantId,
      name: name.trim(),
      description: description?.trim() || '',
      displayOrder: displayOrder || 0,
      type: (req.body.type || 'all').toLowerCase(),
      image
    });
    res.status(201).json({ success: true, data: { category } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;
    const { name, description, displayOrder, isActive, type } = req.body;
    
    let updateData = { name: name?.trim(), description: description?.trim(), displayOrder, isActive };
    if (type !== undefined) {
      updateData.type = String(type).toLowerCase();
    }

    if (req.file) {
      try {
        const uploadResult = await uploadToCloudinary(req.file.buffer, `dynease/categories/${restaurantId}`);
        updateData.image = {
          public_id: uploadResult.public_id,
          secure_url: uploadResult.secure_url
        };
      } catch (uploadError) {
        console.error("Cloudinary Upload Error:", uploadError);
      }
    }

    const Category = req.tenantDb.model('Category');
    const category = await Category.findOneAndUpdate(
      { _id: id, restaurantId },
      updateData,
      { new: true, runValidators: true }
    );
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }
    res.status(200).json({ success: true, data: { category } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;
    const Category = req.tenantDb.model('Category');
    // Check if any menu items use this category
    const MenuItem = req.tenantDb.model('MenuItem');
    const category = await Category.findOne({ _id: id, restaurantId });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }
    const itemCount = await MenuItem.countDocuments({ restaurantId, category: category.name });
    if (itemCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete: ${itemCount} menu item(s) use this category. Reassign them first.`
      });
    }
    await Category.deleteOne({ _id: id, restaurantId });
    res.status(200).json({ success: true, message: 'Category deleted.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ──────────────────────────────────────────
//  MENU ITEM CRUD
// ──────────────────────────────────────────

exports.createMenuItem = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { category, name, description, price, isAvailable, dietaryPreference, preparationTime, quantities } = req.body;

    let image = null;
    if (req.file) {
      try {
        const uploadResult = await uploadToCloudinary(req.file.buffer, `dynease/menu/${restaurantId}`);
        image = {
          public_id: uploadResult.public_id,
          secure_url: uploadResult.secure_url
        };
      } catch (uploadError) {
        console.error("Cloudinary Upload Error:", uploadError);
      }
    }

    // Parse quantities if it's a string
    let parsedQuantities = [];
    if (quantities) {
      try {
        parsedQuantities = typeof quantities === 'string' ? JSON.parse(quantities) : quantities;
        // Filter out invalid entries
        parsedQuantities = parsedQuantities.filter(q => q.size && q.price);
      } catch (parseError) {
        console.error("Error parsing quantities:", parseError);
      }
    }

    const MenuItem = req.tenantDb.model('MenuItem');
    const menuItem = await MenuItem.create({
      restaurantId,
      category,
      name,
      description,
      price,
      isAvailable: isAvailable !== undefined ? isAvailable : true,
      dietaryPreference,
      preparationTime,
      image,
      quantities: parsedQuantities
    });

    res.status(201).json({ success: true, data: { menuItem } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.updateMenuItem = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;
    const { category, name, description, price, isAvailable, dietaryPreference, preparationTime, quantities } = req.body;

    let image = null;
    if (req.file) {
      try {
        const uploadResult = await uploadToCloudinary(req.file.buffer, `dynease/menu/${restaurantId}`);
        image = {
          public_id: uploadResult.public_id,
          secure_url: uploadResult.secure_url
        };
      } catch (uploadError) {
        console.error("Cloudinary Upload Error:", uploadError);
      }
    }

    // Parse quantities if it's a string
    let parsedQuantities = [];
    if (quantities) {
      try {
        parsedQuantities = typeof quantities === 'string' ? JSON.parse(quantities) : quantities;
        // Filter out invalid entries
        parsedQuantities = parsedQuantities.filter(q => q.size && q.price);
      } catch (parseError) {
        console.error("Error parsing quantities:", parseError);
      }
    }

    const MenuItem = req.tenantDb.model('MenuItem');
    const updateData = {
      category,
      name,
      description,
      price,
      isAvailable,
      dietaryPreference,
      preparationTime,
      quantities: parsedQuantities
    };

    if (image) updateData.image = image;

    const menuItem = await MenuItem.findOneAndUpdate(
      { _id: id, restaurantId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!menuItem) {
      return res.status(404).json({ success: false, message: 'Menu item not found.' });
    }

    res.status(200).json({ success: true, data: { menuItem } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.getMenu = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const MenuItem = req.tenantDb.model('MenuItem');
    const { category, type } = req.query;

    const filter = { restaurantId };
    if (category) filter.category = category;
    if (type) filter.dietaryPreference = type;

    const menuItems = await MenuItem.find(filter).sort({ category: 1, name: 1 });
    res.status(200).json({ success: true, data: { menuItems } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.deleteMenuItem = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;
    const MenuItem = req.tenantDb.model('MenuItem');
    const item = await MenuItem.findOneAndDelete({ _id: id, restaurantId });
    if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });
    res.status(200).json({ success: true, message: 'Menu item deleted.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.toggleMenuItemStatus = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;
    const { isAvailable } = req.body;
    const MenuItem = req.tenantDb.model('MenuItem');
    const item = await MenuItem.findOneAndUpdate(
      { _id: id, restaurantId },
      { isAvailable },
      { new: true }
    );
    if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });
    res.status(200).json({ success: true, data: { menuItem: item } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ──────────────────────────────────────────
//  ORDER MANAGEMENT
// ──────────────────────────────────────────

exports.getOrders = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const Order = req.tenantDb.model('Order');
    const { waiterId, status, unassignedOnly } = req.query;

    const query = { restaurantId };
    if (waiterId) {
      query.assignedWaiterId = waiterId;
    }
    if (status) {
      query.status = status;
    }
    if (unassignedOnly === 'true') {
      query.$or = [
        { assignedWaiterId: null },
        { assignmentStatus: 'UNASSIGNED' }
      ];
    }
    
    const orders = await Order.find(query)
      .populate('assignedWaiterId', 'name email phone shiftStatus availabilityStatus')
      .populate('tableId', 'tableNumber tableName section isOccupied primaryWaiterId')
      .sort({ createdAt: -1 })
      .limit(100);
    
    res.status(200).json({ success: true, data: { orders } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;
    const { status, paymentStatus, isReadByWaiter } = req.body;
    
    const Order = req.tenantDb.model('Order');
    const Table = req.tenantDb.model('Table');

    const updateData = {};
    if (status) updateData.status = status;
    if (paymentStatus) updateData.paymentStatus = paymentStatus;
    if (isReadByWaiter !== undefined) {
      updateData.isReadByWaiter = isReadByWaiter;
    } else if (status === 'READ') {
      updateData.isReadByWaiter = true;
    }
    
    const order = await Order.findOneAndUpdate(
      { _id: id, restaurantId },
      updateData,
      { new: true }
    );
    
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    
    let tableUpdated = null;
    // When order is COMPLETED or CANCELLED, free up the table if no other active orders exist on that table
    if (status === 'COMPLETED' || status === 'CANCELLED') {
      const activeOrdersCount = await Order.countDocuments({
        restaurantId,
        tableId: order.tableId,
        _id: { $ne: order._id },
        status: { $nin: ['COMPLETED', 'CANCELLED', 'PAID'] }
      });

      if (activeOrdersCount === 0) {
        tableUpdated = await Table.findByIdAndUpdate(
          order.tableId,
          { isOccupied: false, lastOrderId: null },
          { new: true }
        );
      }
    } else if (status === 'READ' || status === 'PREPARING' || status === 'CONFIRMED') {
      // Ensure table is marked occupied while order is active
      tableUpdated = await Table.findByIdAndUpdate(
        order.tableId,
        { isOccupied: true, lastOrderId: order._id },
        { new: true }
      );
    }

    // Emit socket event for order update
    const io = req.app.get('io');
    if (io) {
      io.to(`kitchen:${restaurantId}`).emit('order_updated', order);
      io.to(`waiter:${restaurantId}`).emit('order_updated', order);
      io.to(`restaurant:${restaurantId}`).emit('order_updated', order);
      io.to(`order:${order._id.toString()}`).emit('order_updated', order);

      if (tableUpdated) {
        io.to(`restaurant:${restaurantId}`).emit('table_updated', tableUpdated);
        io.to(`waiter:${restaurantId}`).emit('table_updated', tableUpdated);
      }
    }
    
    res.status(200).json({ success: true, data: { order, table: tableUpdated } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * PATCH /api/restaurant/orders/:id/accept
 * Waiter accepts assigned order
 */
exports.acceptOrder = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;
    const WaiterAssignmentService = require('../services/waiterAssignmentService');

    const order = await WaiterAssignmentService.acceptOrder(
      req.tenantDb,
      restaurantId,
      id,
      req.user._id
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant:${restaurantId}`).emit('order_updated', order);
      io.to(`waiter:${restaurantId}`).emit('order_updated', order);
      io.to(`order:${order._id.toString()}`).emit('order_updated', order);
    }

    res.status(200).json({ success: true, message: 'Order accepted successfully', data: { order } });
  } catch (error) {
    console.error(error);
    res.status(400).json({ success: false, message: error.message || 'Failed to accept order' });
  }
};

/**
 * PATCH /api/restaurant/orders/:id/reject
 * Waiter rejects assigned order (triggers auto-reassign or escalation)
 */
exports.rejectOrder = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;
    const { reason } = req.body;
    const WaiterAssignmentService = require('../services/waiterAssignmentService');

    const result = await WaiterAssignmentService.rejectOrder(
      req.tenantDb,
      restaurantId,
      id,
      req.user._id,
      reason || 'Waiter rejected'
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant:${restaurantId}`).emit('order_updated', result.order);
      io.to(`waiter:${restaurantId}`).emit('order_updated', result.order);

      if (result.reassignedTo) {
        io.to(`waiter_user:${result.reassignedTo._id.toString()}`).emit('assigned_order', {
          id: result.order._id,
          orderNumber: result.order.orderNumber,
          tableNumber: result.order.tableNumber,
          items: result.order.items,
          total: result.order.total,
          assignmentType: 'OVERFLOW',
          assignmentStatus: 'PENDING_ACCEPTANCE'
        });
      } else {
        io.to(`restaurant:${restaurantId}`).emit('unassigned_order_alert', {
          orderNumber: result.order.orderNumber,
          tableNumber: result.order.tableNumber,
          reason: 'All waiters rejected or unavailable'
        });
      }
    }

    res.status(200).json({ success: true, message: 'Order rejected and processed', data: result });
  } catch (error) {
    console.error(error);
    res.status(400).json({ success: false, message: error.message || 'Failed to reject order' });
  }
};

/**
 * PATCH /api/restaurant/orders/:id/reassign
 * Manager or Admin manually reassigns order to a waiter
 */
exports.reassignOrder = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;
    const { waiterId, reason } = req.body;

    const Order = req.tenantDb.model('Order');
    const User = req.tenantDb.model('User');
    const AssignmentEvent = req.tenantDb.model('AssignmentEvent');

    const order = await Order.findOne({ _id: id, restaurantId });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    let newWaiter = null;
    if (waiterId) {
      newWaiter = await User.findOne({ _id: waiterId, restaurantId, role: 'RESTAURANT_STAFF' });
      if (!newWaiter) return res.status(400).json({ success: false, message: 'Target waiter not found in this restaurant' });
    }

    const previousWaiterId = order.assignedWaiterId;
    order.assignedWaiterId = waiterId || null;
    order.assignmentType = 'MANUAL_REASSIGN';
    order.assignmentStatus = waiterId ? 'PENDING_ACCEPTANCE' : 'UNASSIGNED';
    order.assignedAt = waiterId ? new Date() : null;
    order.assignmentTimeoutAt = waiterId ? new Date(Date.now() + 3 * 60000) : null;
    await order.save();

    await AssignmentEvent.create({
      restaurantId,
      targetType: 'ORDER',
      targetId: order._id,
      tableId: order.tableId,
      tableNumber: order.tableNumber,
      previousWaiterId,
      newWaiterId: waiterId || null,
      assignmentMode: 'MANUAL',
      action: waiterId ? 'REASSIGNED' : 'UNASSIGNED',
      actorId: req.user._id,
      actorRole: req.user.role,
      reason: reason || 'Manager manual reassignment'
    }).catch(err => console.error(err));

    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant:${restaurantId}`).emit('order_updated', order);
      io.to(`waiter:${restaurantId}`).emit('order_updated', order);
      if (waiterId) {
        io.to(`waiter_user:${waiterId.toString()}`).emit('assigned_order', {
          id: order._id,
          orderNumber: order.orderNumber,
          tableNumber: order.tableNumber,
          items: order.items,
          total: order.total,
          assignmentType: 'MANUAL_REASSIGN',
          assignmentStatus: 'PENDING_ACCEPTANCE'
        });
      }
    }

    res.status(200).json({ success: true, message: 'Order reassigned successfully', data: { order } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * GET /api/restaurant/assignment/settings
 * Fetch restaurant assignment mode & scoring configurations
 */
exports.getAssignmentSettings = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const WaiterAssignmentService = require('../services/waiterAssignmentService');
    const settings = await WaiterAssignmentService.getSettings(req.tenantDb, restaurantId);
    res.status(200).json({ success: true, data: { settings } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * PUT /api/restaurant/assignment/settings
 * Update restaurant assignment configuration
 */
exports.updateAssignmentSettings = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const RestaurantProfile = req.tenantDb.model('RestaurantProfile');
    const profile = await RestaurantProfile.findOne({ restaurantId });
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    profile.assignmentSettings = {
      ...(profile.assignmentSettings || {}),
      ...req.body
    };
    await profile.save();

    res.status(200).json({ success: true, message: 'Assignment settings updated', data: { settings: profile.assignmentSettings } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * GET /api/restaurant/assignment/history
 * Audit log of all table and order assignment events
 */
exports.getAssignmentHistory = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const AssignmentEvent = req.tenantDb.model('AssignmentEvent');
    const events = await AssignmentEvent.find({ restaurantId })
      .populate('previousWaiterId', 'name')
      .populate('newWaiterId', 'name')
      .populate('actorId', 'name role')
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({ success: true, data: { events } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * GET /api/restaurant/service-requests
 * Fetch active and recent service requests
 */
exports.getServiceRequests = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const ServiceRequest = req.tenantDb.model('ServiceRequest');
    const requests = await ServiceRequest.find({ restaurantId })
      .populate('assignedWaiterId', 'name')
      .populate('tableId', 'tableNumber tableName section')
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({ success: true, data: { serviceRequests: requests } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * PATCH /api/restaurant/service-requests/:id/resolve
 * Mark a service request as acknowledged or resolved
 */
exports.resolveServiceRequest = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;
    const { status } = req.body; // 'ACKNOWLEDGED' or 'RESOLVED'

    const ServiceRequest = req.tenantDb.model('ServiceRequest');
    const request = await ServiceRequest.findOne({ _id: id, restaurantId });
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    request.status = status || 'RESOLVED';
    if (status === 'ACKNOWLEDGED') {
      request.acknowledgedAt = new Date();
    } else if (status === 'RESOLVED') {
      request.resolvedAt = new Date();
      request.resolvedBy = req.user._id;
    }
    await request.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant:${restaurantId}`).emit('service_request_updated', request);
      io.to(`waiter:${restaurantId}`).emit('service_request_updated', request);
    }

    res.status(200).json({ success: true, message: `Service request marked as ${request.status}`, data: { serviceRequest: request } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * GET /api/restaurant/waiters/workload
 * Admin & Waiter view of live waiter workloads, shifts, and capacities
 */
exports.getWaitersWorkload = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const User = req.tenantDb.model('User');
    const WaiterAssignmentService = require('../services/waiterAssignmentService');
    const settings = await WaiterAssignmentService.getSettings(req.tenantDb, restaurantId);

    const waiters = await User.find({
      restaurantId,
      role: 'RESTAURANT_STAFF'
    }).populate('assignedTables', 'tableNumber tableName section');

    const result = [];
    for (const w of waiters) {
      const { activeOrdersCount, activeRequestsCount, totalWorkload } = await WaiterAssignmentService.getWaiterWorkload(
        req.tenantDb,
        restaurantId,
        w._id
      );
      result.push({
        _id: w._id,
        id: w._id,
        name: w.name,
        email: w.email,
        phone: w.phone,
        shiftStatus: w.shiftStatus || 'ON_SHIFT',
        availabilityStatus: w.availabilityStatus || 'AVAILABLE',
        acceptingOrders: w.acceptingOrders !== false,
        workloadCapacity: w.workloadCapacity || settings.defaultCapacity || 5,
        sections: w.sections || [],
        assignedTables: w.assignedTables || [],
        lastAssignedAt: w.lastAssignedAt,
        activeOrdersCount,
        activeRequestsCount,
        totalWorkload
      });
    }

    res.status(200).json({ success: true, data: { waiters: result } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * PATCH /api/restaurant/waiters/my-availability
 * Allows a waiter to toggle their own shift or availability
 */
exports.updateMyAvailability = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const User = req.tenantDb.model('User');
    const { shiftStatus, availabilityStatus, acceptingOrders } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (shiftStatus !== undefined) user.shiftStatus = shiftStatus;
    if (availabilityStatus !== undefined) user.availabilityStatus = availabilityStatus;
    if (acceptingOrders !== undefined) user.acceptingOrders = acceptingOrders;
    await user.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant:${restaurantId}`).emit('waiter_status_updated', {
        waiterId: user._id,
        name: user.name,
        shiftStatus: user.shiftStatus,
        availabilityStatus: user.availabilityStatus,
        acceptingOrders: user.acceptingOrders
      });
    }

    res.status(200).json({ success: true, message: 'Availability updated', data: { user } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ──────────────────────────────────────────
//  PROFILE CRUD
// ──────────────────────────────────────────

exports.getProfile = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const RestaurantProfile = req.tenantDb.model('RestaurantProfile');
    const profile = await RestaurantProfile.findOne({ restaurantId });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }
    res.status(200).json({ success: true, data: { profile } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { name, subtitle, googleReviewLink } = req.body;
    const RestaurantProfile = req.tenantDb.model('RestaurantProfile');
    
    const profile = await RestaurantProfile.findOne({ restaurantId });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    if (name) profile.name = name.trim();
    if (subtitle !== undefined) profile.subtitle = subtitle.trim();
    if (googleReviewLink !== undefined) profile.googleReviewLink = googleReviewLink.trim();

    await profile.save();
    res.status(200).json({ success: true, data: { profile } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ──────────────────────────────────────────
//  STATS
// ──────────────────────────────────────────

exports.getStats = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const Order = req.tenantDb.model('Order');
    const Table = req.tenantDb.model('Table');

    // Get today's start and end date
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch today's orders
    const todaysOrders = await Order.find({
      restaurantId,
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    const todaysOrdersCount = todaysOrders.length;
    
    // Calculate Revenue
    const revenue = todaysOrders.reduce((sum, order) => {
      // Only count completed/paid orders if needed, for now let's sum all non-cancelled
      if (order.status !== 'CANCELLED') {
        return sum + (order.totalAmount || 0);
      }
      return sum;
    }, 0);

    // Get active tables
    const activeTablesCount = await Table.countDocuments({
      restaurantId,
      status: 'ACTIVE'
    });

    res.status(200).json({
      success: true,
      data: {
        todaysOrders: todaysOrdersCount,
        revenue: revenue,
        activeTables: activeTablesCount
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ──────────────────────────────────────────
//  SUBSCRIPTION
// ──────────────────────────────────────────

const RestaurantRegistry = require('../models/platform/RestaurantRegistry');

exports.getSubscription = async (req, res) => {
  try {
    const registry = req.tenantRegistry;
    if (!registry) return res.status(404).json({ success: false, message: 'Registry not found' });
    
    let remainingDays = 0;
    if (registry.subscriptionEndDate) {
      const diff = new Date(registry.subscriptionEndDate) - new Date();
      remainingDays = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    res.status(200).json({ 
      success: true, 
      data: {
        plan: registry.selectedPlan,
        status: registry.subscriptionStatus,
        startDate: registry.subscriptionStartDate,
        endDate: registry.subscriptionEndDate,
        remainingDays,
        lastPaymentAt: registry.lastPaymentAt,
        renewalHistory: registry.renewalHistory,
        renewalRequest: registry.renewalRequest
      } 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.renewSubscription = async (req, res) => {
  try {
    const { plan } = req.body;
    
    const registry = req.tenantRegistry;
    if (!registry) return res.status(404).json({ success: false, message: 'Registry not found' });

    // Validate plan
    if (!['GROWTH', 'PRO'].includes(plan)) {
      return res.status(400).json({ success: false, message: 'Invalid plan selected' });
    }

    if (registry.renewalRequest && registry.renewalRequest.status === 'PENDING') {
      return res.status(400).json({ success: false, message: 'A renewal request is already pending.' });
    }

    const now = new Date();
    registry.renewalRequest = {
      plan,
      status: 'PENDING',
      requestedAt: now
    };

    await registry.save();

    res.status(200).json({ 
      success: true, 
      message: 'Renewal request sent successfully. Pending admin approval.', 
      data: { renewalRequest: registry.renewalRequest }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
