const crypto = require('crypto');
const { db, schema } = require('../db/client');
const { eq, and, sql, desc } = require('drizzle-orm');
const { tables, tables_assignment, users, restaurants } = schema;
const TableAssignmentService = require('../services/TableAssignmentService');
const SubscriptionService = require('../services/SubscriptionService');

exports.getTables = async (req, res, next) => {
  try {
    const restaurantId = req.user.restaurantId;

    const tableRows = await db.select().from(tables).where(
      and(
        eq(tables.restaurant_id, restaurantId),
        eq(tables.is_deleted, false)
      )
    ).orderBy(desc(tables.createdat));

    // Fetch active assignments for these tables
    const assignments = await db.select().from(tables_assignment).where(
      and(
        eq(tables_assignment.restaurant_id, restaurantId),
        eq(tables_assignment.assignment_status, 'ASSIGNED')
      )
    );

    // Fetch staff
    const staffRows = await db.select().from(users).where(
      and(
        eq(users.restaurant_id, restaurantId),
        eq(users.is_deleted, false)
      )
    );
    const staffMap = new Map();
    for (const s of staffRows) {
      staffMap.set(s.id, {
        _id: s.id,
        id: s.id,
        name: s.name,
        email: s.email,
        phone: s.phone_number,
        shiftStatus: 'ON_SHIFT',
        availabilityStatus: s.user_status === 'ACTIVE' ? 'AVAILABLE' : 'OFFLINE',
        acceptingOrders: s.user_status === 'ACTIVE',
        workloadCapacity: 5
      });
    }

    const assignmentMap = new Map();
    for (const a of assignments) {
      assignmentMap.set(a.table_id, staffMap.get(a.staff_id) || null);
    }

    const domain = req.tenantRegistry?.subdomain || 'app';
    const baseUrl = process.env.NODE_ENV === 'production'
      ? `https://${domain}.dynease.in`
      : `http://${domain}.localhost:5173`;

    const mappedTables = tableRows.map(t => {
      const primaryWaiter = assignmentMap.get(t.id) || null;
      return {
        _id: t.id,
        id: t.id,
        restaurantId: t.restaurant_id,
        tableNumber: t.table_code,
        tableName: `Table ${t.table_code}`,
        capacity: 4,
        section: 'Main Area',
        status: t.table_status,
        table_status: t.table_status,
        qrToken: t.qr_token,
        qrCodeUrl: `${baseUrl}/menu/${t.qr_token}`,
        primaryWaiterId: primaryWaiter,
        assignmentMode: 'HYBRID',
        assignmentStatus: primaryWaiter ? 'ASSIGNED' : 'UNASSIGNED',
        createdAt: t.createdat,
        updatedAt: t.updatedat
      };
    });

    res.status(200).json({ success: true, data: { tables: mappedTables } });
  } catch (error) {
    next(error);
  }
};

exports.getTable = async (req, res, next) => {
  try {
    const restaurantId = req.user.restaurantId;
    const tableId = req.params.id;

    const [tableRow] = await db.select().from(tables).where(
      and(
        eq(tables.id, tableId),
        eq(tables.restaurant_id, restaurantId),
        eq(tables.is_deleted, false)
      )
    ).limit(1);

    if (!tableRow) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }

    // Active assignment
    const [assignment] = await db.select().from(tables_assignment).where(
      and(
        eq(tables_assignment.table_id, tableId),
        eq(tables_assignment.assignment_status, 'ASSIGNED')
      )
    ).limit(1);

    let primaryWaiter = null;
    if (assignment) {
      const [staff] = await db.select().from(users).where(eq(users.id, assignment.staff_id)).limit(1);
      if (staff) {
        primaryWaiter = {
          _id: staff.id,
          id: staff.id,
          name: staff.name,
          email: staff.email,
          phone: staff.phone_number
        };
      }
    }

    const domain = req.tenantRegistry?.subdomain || 'app';
    const baseUrl = process.env.NODE_ENV === 'production'
      ? `https://${domain}.dynease.in`
      : `http://${domain}.localhost:5173`;

    const formattedTable = {
      _id: tableRow.id,
      id: tableRow.id,
      restaurantId: tableRow.restaurant_id,
      tableNumber: tableRow.table_code,
      tableName: `Table ${tableRow.table_code}`,
      capacity: 4,
      section: 'Main Area',
      status: tableRow.table_status,
      table_status: tableRow.table_status,
      qrToken: tableRow.qr_token,
      qrCodeUrl: `${baseUrl}/menu/${tableRow.qr_token}`,
      primaryWaiterId: primaryWaiter,
      createdAt: tableRow.createdat,
      updatedAt: tableRow.updatedat
    };

    res.status(200).json({ success: true, data: { table: formattedTable } });
  } catch (error) {
    next(error);
  }
};

exports.createTable = async (req, res, next) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { tableNumber, capacity, section, primaryWaiterId, assignmentMode } = req.body;

    if (!tableNumber) {
      return res.status(400).json({ success: false, message: 'Table number is required' });
    }

    // Check duplicate
    const [existingTable] = await db.select().from(tables).where(
      and(
        eq(tables.restaurant_id, restaurantId),
        eq(tables.table_code, String(tableNumber).trim()),
        eq(tables.is_deleted, false)
      )
    ).limit(1);

    if (existingTable) {
      return res.status(409).json({ success: false, message: 'Table number already exists in your restaurant' });
    }

    // Check subscription plan table limit
    await SubscriptionService.checkResourceLimit(null, { restaurantId }, 'tables', 1);

    const qrToken = 'qr_' + crypto.randomBytes(16).toString('hex');
    const domain = req.tenantRegistry?.subdomain || 'app';
    const baseUrl = process.env.NODE_ENV === 'production'
      ? `https://${domain}.dynease.in`
      : `http://${domain}.localhost:5173`;

    const [newTable] = await db.insert(tables).values({
      restaurant_id: restaurantId,
      table_code: String(tableNumber).trim(),
      qr_token: qrToken,
      table_status: 'ACTIVE',
      is_deleted: false
    }).returning();

    if (primaryWaiterId) {
      await TableAssignmentService.assignWaiterManually({
        restaurantId,
        tableId: newTable.id,
        staffId: primaryWaiterId,
        actorId: req.user.id
      }).catch((err) => console.warn('[CreateTable] Assignment warning:', err.message));
    }

    const formattedTable = {
      _id: newTable.id,
      id: newTable.id,
      restaurantId: newTable.restaurant_id,
      tableNumber: newTable.table_code,
      tableName: `Table ${newTable.table_code}`,
      capacity: capacity || 4,
      section: section || 'Main Area',
      primaryWaiterId: primaryWaiterId || null,
      assignmentMode: assignmentMode || 'HYBRID',
      assignmentStatus: primaryWaiterId ? 'ASSIGNED' : 'UNASSIGNED',
      status: newTable.table_status,
      qrToken: newTable.qr_token,
      qrCodeUrl: `${baseUrl}/menu/${newTable.qr_token}`
    };

    res.status(201).json({ success: true, data: { table: formattedTable } });
  } catch (error) {
    next(error);
  }
};

exports.updateTable = async (req, res, next) => {
  try {
    const restaurantId = req.user.restaurantId;
    const tableId = req.params.id;
    const { tableNumber, status, primaryWaiterId } = req.body;

    const [existing] = await db.select().from(tables).where(
      and(
        eq(tables.id, tableId),
        eq(tables.restaurant_id, restaurantId),
        eq(tables.is_deleted, false)
      )
    ).limit(1);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }

    const updateData = { updatedat: new Date() };
    if (tableNumber) updateData.table_code = String(tableNumber).trim();
    if (status && (status === 'ACTIVE' || status === 'INACTIVE')) updateData.table_status = status;

    const [updatedTable] = await db.update(tables).set(updateData).where(eq(tables.id, tableId)).returning();

    if (primaryWaiterId !== undefined) {
      if (primaryWaiterId) {
        await TableAssignmentService.assignWaiterManually({
          restaurantId,
          tableId,
          staffId: primaryWaiterId,
          actorId: req.user.id
        }).catch((err) => console.warn('[UpdateTable] Assignment warning:', err.message));
      } else {
        await TableAssignmentService.releaseAssignment({
          restaurantId,
          tableId,
          actorId: req.user.id
        }).catch((err) => console.warn('[UpdateTable] Release warning:', err.message));
      }
    }

    const domain = req.tenantRegistry?.subdomain || 'app';
    const baseUrl = process.env.NODE_ENV === 'production'
      ? `https://${domain}.dynease.in`
      : `http://${domain}.localhost:5173`;

    const formattedTable = {
      _id: updatedTable.id,
      id: updatedTable.id,
      restaurantId: updatedTable.restaurant_id,
      tableNumber: updatedTable.table_code,
      tableName: `Table ${updatedTable.table_code}`,
      status: updatedTable.table_status,
      qrToken: updatedTable.qr_token,
      qrCodeUrl: `${baseUrl}/menu/${updatedTable.qr_token}`,
      primaryWaiterId: primaryWaiterId || null
    };

    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant:${restaurantId}`).emit('table_updated', formattedTable);
      io.to(`waiter:${restaurantId}`).emit('table_updated', formattedTable);
    }

    res.status(200).json({ success: true, data: { table: formattedTable } });
  } catch (error) {
    next(error);
  }
};

exports.deleteTable = async (req, res, next) => {
  try {
    const restaurantId = req.user.restaurantId;
    const tableId = req.params.id;

    const [deleted] = await db.update(tables).set({
      is_deleted: true,
      deletedat: new Date(),
      table_status: 'INACTIVE',
      updatedat: new Date()
    }).where(
      and(
        eq(tables.id, tableId),
        eq(tables.restaurant_id, restaurantId)
      )
    ).returning();

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }

    res.status(200).json({ success: true, message: 'Table deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.regenerateQR = async (req, res, next) => {
  try {
    const restaurantId = req.user.restaurantId;
    const tableId = req.params.id;

    const newToken = 'qr_' + crypto.randomBytes(16).toString('hex');
    const [updated] = await db.update(tables).set({
      qr_token: newToken,
      updatedat: new Date()
    }).where(
      and(
        eq(tables.id, tableId),
        eq(tables.restaurant_id, restaurantId),
        eq(tables.is_deleted, false)
      )
    ).returning();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }

    const domain = req.tenantRegistry?.subdomain || 'app';
    const baseUrl = process.env.NODE_ENV === 'production'
      ? `https://${domain}.dynease.in`
      : `http://${domain}.localhost:5173`;

    const formattedTable = {
      _id: updated.id,
      id: updated.id,
      restaurantId: updated.restaurant_id,
      tableNumber: updated.table_code,
      qrToken: updated.qr_token,
      qrCodeUrl: `${baseUrl}/menu/${updated.qr_token}`
    };

    res.status(200).json({ success: true, data: { table: formattedTable } });
  } catch (error) {
    next(error);
  }
};
