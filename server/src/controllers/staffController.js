const bcrypt = require('bcrypt');
const { db, schema } = require('../db/client');
const { eq, and, sql, desc } = require('drizzle-orm');
const { users, tables_assignment, tables } = schema;
const SubscriptionService = require('../services/SubscriptionService');
const TableAssignmentService = require('../services/TableAssignmentService');

exports.getStaff = async (req, res, next) => {
  try {
    const restaurantId = req.user.restaurantId;

    const staffRows = await db.select().from(users).where(
      and(
        eq(users.restaurant_id, restaurantId),
        eq(users.is_deleted, false)
      )
    ).orderBy(desc(users.createdat));

    const activeAssignments = await db.select().from(tables_assignment).where(
      and(
        eq(tables_assignment.restaurant_id, restaurantId),
        eq(tables_assignment.assignment_status, 'ASSIGNED')
      )
    );
    const assignedMap = new Map();
    for (const a of activeAssignments) {
      if (!assignedMap.has(a.staff_id)) assignedMap.set(a.staff_id, []);
      assignedMap.get(a.staff_id).push(a.table_id);
    }

    const mappedStaff = staffRows.map(u => ({
      _id: u.id,
      id: u.id,
      restaurantId: u.restaurant_id,
      name: u.name,
      email: u.email,
      phone: u.phone_number,
      role: u.user_type === 'ADMIN' ? 'RESTAURANT_OWNER' : 'RESTAURANT_STAFF',
      userType: u.user_type,
      isActive: u.user_status === 'ACTIVE',
      shiftStatus: 'ON_SHIFT',
      availabilityStatus: u.user_status === 'ACTIVE' ? 'AVAILABLE' : 'OFFLINE',
      acceptingOrders: u.user_status === 'ACTIVE',
      workloadCapacity: 5,
      assignedTables: assignedMap.get(u.id) || [],
      createdAt: u.createdat
    }));

    res.status(200).json({ success: true, data: { staff: mappedStaff } });
  } catch (error) {
    next(error);
  }
};

exports.createStaff = async (req, res, next) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { name, email, password, role, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide name, email, and password.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check duplicate email
    const [existing] = await db.select().from(users).where(
      and(eq(sql`LOWER(${users.email})`, cleanEmail), eq(users.is_deleted, false))
    ).limit(1);

    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already exists.' });
    }

    // Check staff account limit
    await SubscriptionService.checkResourceLimit(null, { restaurantId }, 'staff', 1);

    const hashedPassword = await bcrypt.hash(password, 12);
    const userType = role === 'RESTAURANT_OWNER' ? 'ADMIN' : 'STAFF';

    const [newStaff] = await db.insert(users).values({
      name,
      email: cleanEmail,
      phone_number: phone || null,
      password_hash: hashedPassword,
      restaurant_id: restaurantId,
      user_type: userType,
      user_status: 'ACTIVE',
      sessionVersion: 0,
      is_deleted: false
    }).returning();

    let assigned = [];
    if (req.body.assignedTables && Array.isArray(req.body.assignedTables)) {
      for (const tableId of req.body.assignedTables) {
        if (!tableId) continue;
        const [tbl] = await db.select().from(tables).where(
          and(eq(tables.id, tableId), eq(tables.restaurant_id, restaurantId), eq(tables.is_deleted, false))
        ).limit(1);
        if (tbl) {
          await TableAssignmentService.assignWaiterManually({
            restaurantId,
            tableId,
            staffId: newStaff.id,
            actorId: req.user.id
          }).catch(err => console.warn('[CreateStaff] Table assignment failed:', err.message));
          assigned.push(tableId);
        }
      }
    }

    const formattedStaff = {
      _id: newStaff.id,
      id: newStaff.id,
      restaurantId: newStaff.restaurant_id,
      name: newStaff.name,
      email: newStaff.email,
      phone: newStaff.phone_number,
      role: newStaff.user_type === 'ADMIN' ? 'RESTAURANT_OWNER' : 'RESTAURANT_STAFF',
      userType: newStaff.user_type,
      isActive: newStaff.user_status === 'ACTIVE',
      shiftStatus: 'ON_SHIFT',
      availabilityStatus: 'AVAILABLE',
      acceptingOrders: true,
      workloadCapacity: 5,
      assignedTables: assigned
    };

    res.status(201).json({ success: true, message: 'Staff member created in PostgreSQL.', data: { staff: formattedStaff } });
  } catch (error) {
    next(error);
  }
};

exports.updateStaff = async (req, res, next) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;
    const { name, email, phone, password, isActive } = req.body;

    const [user] = await db.select().from(users).where(
      and(eq(users.id, id), eq(users.restaurant_id, restaurantId), eq(users.is_deleted, false))
    ).limit(1);

    if (!user) {
      return res.status(404).json({ success: false, message: 'Staff not found.' });
    }

    const updateData = { updatedat: new Date() };
    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase().trim();
    if (phone) updateData.phone_number = phone;
    if (isActive !== undefined) {
      updateData.user_status = isActive ? 'ACTIVE' : 'INACTIVE';
    }
    if (password) {
      updateData.password_hash = await bcrypt.hash(password, 12);
    }

    const [updatedUser] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();

    let currentAssigned = [];
    if (req.body.assignedTables !== undefined && Array.isArray(req.body.assignedTables)) {
      const existingAssignments = await db.select().from(tables_assignment).where(
        and(
          eq(tables_assignment.restaurant_id, restaurantId),
          eq(tables_assignment.staff_id, updatedUser.id),
          eq(tables_assignment.assignment_status, 'ASSIGNED')
        )
      );
      const existingTableIds = existingAssignments.map(a => a.table_id);

      // Tables to release
      for (const tableId of existingTableIds) {
        if (!req.body.assignedTables.includes(tableId)) {
          await TableAssignmentService.releaseAssignment({
            restaurantId,
            tableId,
            actorId: req.user.id
          }).catch(err => console.warn('[UpdateStaff] Release failed:', err.message));
        }
      }

      // Tables to assign
      for (const tableId of req.body.assignedTables) {
        if (!tableId) continue;
        const [tbl] = await db.select().from(tables).where(
          and(eq(tables.id, tableId), eq(tables.restaurant_id, restaurantId), eq(tables.is_deleted, false))
        ).limit(1);
        if (tbl) {
          await TableAssignmentService.assignWaiterManually({
            restaurantId,
            tableId,
            staffId: updatedUser.id,
            actorId: req.user.id
          }).catch(err => console.warn('[UpdateStaff] Assignment failed:', err.message));
          currentAssigned.push(tableId);
        }
      }
    } else {
      const activeAssignments = await db.select().from(tables_assignment).where(
        and(
          eq(tables_assignment.restaurant_id, restaurantId),
          eq(tables_assignment.staff_id, updatedUser.id),
          eq(tables_assignment.assignment_status, 'ASSIGNED')
        )
      );
      currentAssigned = activeAssignments.map(a => a.table_id);
    }

    const formattedStaff = {
      _id: updatedUser.id,
      id: updatedUser.id,
      restaurantId: updatedUser.restaurant_id,
      name: updatedUser.name,
      email: updatedUser.email,
      phone: updatedUser.phone_number,
      role: updatedUser.user_type === 'ADMIN' ? 'RESTAURANT_OWNER' : 'RESTAURANT_STAFF',
      isActive: updatedUser.user_status === 'ACTIVE',
      shiftStatus: req.body.shiftStatus || 'ON_SHIFT',
      availabilityStatus: updatedUser.user_status === 'ACTIVE' ? 'AVAILABLE' : 'OFFLINE',
      acceptingOrders: req.body.acceptingOrders !== undefined ? req.body.acceptingOrders : true,
      workloadCapacity: req.body.workloadCapacity || 5,
      assignedTables: currentAssigned
    };

    // Emit waiter status update if waiter availability changed
    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant:${restaurantId}`).emit('waiter_status_updated', {
        waiterId: updatedUser.id,
        name: updatedUser.name,
        shiftStatus: formattedStaff.shiftStatus,
        availabilityStatus: formattedStaff.availabilityStatus,
        acceptingOrders: formattedStaff.acceptingOrders,
        workloadCapacity: formattedStaff.workloadCapacity
      });
    }

    res.status(200).json({ success: true, message: 'Staff updated in PostgreSQL.', data: { staff: formattedStaff } });
  } catch (error) {
    next(error);
  }
};

exports.deleteStaff = async (req, res, next) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;

    const [user] = await db.select().from(users).where(
      and(eq(users.id, id), eq(users.restaurant_id, restaurantId), eq(users.is_deleted, false))
    ).limit(1);

    if (!user) {
      return res.status(404).json({ success: false, message: 'Staff not found.' });
    }

    if (user.user_type === 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Cannot delete RESTAURANT_OWNER.' });
    }

    await db.update(users).set({
      is_deleted: true,
      deletedat: new Date(),
      user_status: 'INACTIVE',
      updatedat: new Date()
    }).where(eq(users.id, id));

    res.status(200).json({ success: true, message: 'Staff member deleted.' });
  } catch (error) {
    next(error);
  }
};
