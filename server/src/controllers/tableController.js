// Tenant DB models are retrieved dynamically via req.tenantDb
const crypto = require('crypto');

exports.getTables = async (req, res, next) => {
  try {
    const Table = req.tenantDb.model('Table');
    const restaurantId = req.user.restaurantId;
    const tables = await Table.find({ restaurantId })
      .populate('primaryWaiterId', 'name email phone shiftStatus availabilityStatus acceptingOrders workloadCapacity')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: { tables } });
  } catch (error) {
    next(error);
  }
};

exports.getTable = async (req, res, next) => {
  try {
    const Table = req.tenantDb.model('Table');
    const table = await Table.findOne({ _id: req.params.id, restaurantId: req.user.restaurantId })
      .populate('primaryWaiterId', 'name email phone shiftStatus availabilityStatus acceptingOrders workloadCapacity');
    if (!table) return res.status(404).json({ success: false, message: 'Table not found' });
    res.status(200).json({ success: true, data: { table } });
  } catch (error) {
    next(error);
  }
};

exports.createTable = async (req, res, next) => {
  try {
    const Table = req.tenantDb.model('Table');
    const restaurantId = req.user.restaurantId;
    const { tableNumber, tableName, capacity, section, primaryWaiterId, assignmentMode } = req.body;

    const existingTable = await Table.findOne({ restaurantId, tableNumber });
    if (existingTable) {
      return res.status(409).json({ success: false, message: 'Table number already exists in your restaurant' });
    }

    const qrToken = crypto.randomBytes(16).toString('hex');
    const domain = process.env.NODE_ENV === 'production' 
      ? `https://${req.tenantRegistry.subdomain}.dynease.in` 
      : `http://${req.tenantRegistry.subdomain}.localhost:5173`;
    
    const table = await Table.create({
      restaurantId,
      tableNumber,
      tableName,
      capacity: capacity || 4,
      section: section || 'Main Area',
      primaryWaiterId: primaryWaiterId || null,
      assignmentMode: assignmentMode || 'HYBRID',
      assignedAt: primaryWaiterId ? new Date() : null,
      assignedBy: primaryWaiterId ? req.user._id : null,
      assignmentStatus: primaryWaiterId ? 'ASSIGNED' : 'UNASSIGNED',
      qrToken,
      qrCodeUrl: `${domain}/menu/${qrToken}`
    });

    if (primaryWaiterId) {
      const User = req.tenantDb.model('User');
      await User.findByIdAndUpdate(primaryWaiterId, {
        $addToSet: { assignedTables: table._id }
      });
      const AssignmentEvent = req.tenantDb.model('AssignmentEvent');
      await AssignmentEvent.create({
        restaurantId,
        targetType: 'TABLE',
        targetId: table._id,
        tableId: table._id,
        tableNumber: table.tableNumber,
        newWaiterId: primaryWaiterId,
        assignmentMode: assignmentMode || 'MANUAL',
        action: 'ASSIGNED',
        actorId: req.user._id,
        actorRole: 'MANAGER',
        reason: 'Assigned during table creation'
      }).catch(err => console.error(err));
    }

    res.status(201).json({ success: true, data: { table } });
  } catch (error) {
    next(error);
  }
};

exports.updateTable = async (req, res, next) => {
  try {
    const Table = req.tenantDb.model('Table');
    const User = req.tenantDb.model('User');
    const AssignmentEvent = req.tenantDb.model('AssignmentEvent');
    const restaurantId = req.user.restaurantId;

    const { tableNumber, tableName, status, capacity, section, primaryWaiterId, assignmentMode } = req.body;
    const table = await Table.findOne({ _id: req.params.id, restaurantId });
    if (!table) return res.status(404).json({ success: false, message: 'Table not found' });

    const previousWaiterId = table.primaryWaiterId;

    if (tableNumber) table.tableNumber = tableNumber;
    if (tableName !== undefined) table.tableName = tableName;
    if (status) table.status = status;
    if (capacity) table.capacity = capacity;
    if (section !== undefined) table.section = section;
    if (assignmentMode) table.assignmentMode = assignmentMode;

    let waiterChanged = false;
    if (primaryWaiterId !== undefined) {
      const newWaiterIdStr = primaryWaiterId ? primaryWaiterId.toString() : null;
      const prevWaiterIdStr = previousWaiterId ? previousWaiterId.toString() : null;

      if (newWaiterIdStr !== prevWaiterIdStr) {
        waiterChanged = true;
        table.primaryWaiterId = primaryWaiterId || null;
        table.assignedAt = primaryWaiterId ? new Date() : null;
        table.assignedBy = primaryWaiterId ? req.user._id : null;
        table.assignmentStatus = primaryWaiterId ? 'ASSIGNED' : 'UNASSIGNED';

        if (prevWaiterIdStr) {
          await User.findByIdAndUpdate(prevWaiterIdStr, {
            $pull: { assignedTables: table._id }
          });
        }
        if (newWaiterIdStr) {
          await User.findByIdAndUpdate(newWaiterIdStr, {
            $addToSet: { assignedTables: table._id }
          });
        }

        await AssignmentEvent.create({
          restaurantId,
          targetType: 'TABLE',
          targetId: table._id,
          tableId: table._id,
          tableNumber: table.tableNumber,
          previousWaiterId: previousWaiterId || null,
          newWaiterId: primaryWaiterId || null,
          assignmentMode: table.assignmentMode || 'MANUAL',
          action: primaryWaiterId ? (previousWaiterId ? 'REASSIGNED' : 'ASSIGNED') : 'UNASSIGNED',
          actorId: req.user._id,
          actorRole: 'MANAGER',
          reason: primaryWaiterId ? 'Manager assigned/reassigned primary waiter' : 'Manager unassigned table'
        }).catch(err => console.error(err));
      }
    }

    await table.save();
    await table.populate('primaryWaiterId', 'name email phone shiftStatus availabilityStatus acceptingOrders workloadCapacity');

    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant:${restaurantId}`).emit('table_updated', table);
      io.to(`waiter:${restaurantId}`).emit('table_updated', table);
      if (waiterChanged && table.primaryWaiterId) {
        io.to(`waiter_user:${table.primaryWaiterId._id.toString()}`).emit('table_assigned', {
          tableId: table._id,
          tableNumber: table.tableNumber,
          tableName: table.tableName,
          section: table.section
        });
      }
    }

    res.status(200).json({ success: true, data: { table } });
  } catch (error) {
    next(error);
  }
};

exports.deleteTable = async (req, res, next) => {
  try {
    const Table = req.tenantDb.model('Table');
    const table = await Table.findOneAndDelete({ _id: req.params.id, restaurantId: req.user.restaurantId });
    if (!table) return res.status(404).json({ success: false, message: 'Table not found' });
    res.status(200).json({ success: true, message: 'Table deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.regenerateQR = async (req, res, next) => {
  try {
    const Table = req.tenantDb.model('Table');
    const table = await Table.findOne({ _id: req.params.id, restaurantId: req.user.restaurantId });
    if (!table) return res.status(404).json({ success: false, message: 'Table not found' });
    
    const qrToken = crypto.randomBytes(16).toString('hex');
    table.qrToken = qrToken;
    const domain = process.env.NODE_ENV === 'production' 
      ? `https://${req.tenantRegistry.subdomain}.dynease.in` 
      : `http://${req.tenantRegistry.subdomain}.localhost:5173`;
    table.qrCodeUrl = `${domain}/menu/${qrToken}`;
    await table.save();
    
    res.status(200).json({ success: true, data: { table } });
  } catch (error) {
    next(error);
  }
};
