const bcrypt = require('bcrypt');
const { db, schema } = require('../db/client');
const { eq, and, or, sql } = require('drizzle-orm');
const { users, restaurants, plans, audit_log, tables_assignment } = schema;
const { createSendToken } = require('../utils/jwt');
const { getPlan } = require('../config/plans');

exports.registerRestaurantOwner = async (req, res, next) => {
  try {
    const { name, ownerName, email, ownerPhone, selectedPlan, subdomain, address, password } = req.body;
    
    if (!name?.trim() || !ownerName?.trim() || (!email?.trim() && !ownerPhone?.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant name, owner name, and at least email or phone number are required.'
      });
    }

    const userEmail = (email || `${ownerPhone}@dynease.in`).toLowerCase().trim();
    const cleanPhone = ownerPhone ? ownerPhone.trim() : null;

    let finalSlug;
    if (subdomain) {
      finalSlug = subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '');
    } else {
      let baseSlug = (name || 'restaurant').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      finalSlug = baseSlug;
    }

    if (!finalSlug) {
      return res.status(400).json({ success: false, message: 'Valid subdomain or restaurant name is required.' });
    }

    // Check duplicate active domain in PostgreSQL
    const [existingDomain] = await db.select().from(restaurants).where(
      and(
        eq(sql`LOWER(${restaurants.domain})`, finalSlug),
        eq(restaurants.is_deleted, false)
      )
    ).limit(1);

    if (existingDomain) {
      return res.status(409).json({ success: false, message: 'This restaurant domain is already registered. Please choose another.' });
    }

    // Check duplicate active email in users
    const [existingEmail] = await db.select().from(users).where(
      and(
        eq(sql`LOWER(${users.email})`, userEmail),
        eq(users.is_deleted, false)
      )
    ).limit(1);

    if (existingEmail) {
      return res.status(409).json({ success: false, message: 'An account with this email address already exists.' });
    }

    // Check duplicate active phone number in users if phone provided
    if (cleanPhone) {
      const [existingPhone] = await db.select().from(users).where(
        and(
          eq(users.phone_number, cleanPhone),
          eq(users.is_deleted, false)
        )
      ).limit(1);

      if (existingPhone) {
        return res.status(409).json({ success: false, message: 'An account with this phone number already exists.' });
      }
    }

    // Validate and resolve requested plan from DB
    let planId = null;
    const requestedCanonical = getPlan(selectedPlan) || getPlan('STARTER');
    if (requestedCanonical) {
      const [dbPlan] = await db.select().from(plans).where(
        and(
          or(
            eq(sql`UPPER(${plans.name})`, requestedCanonical.name.toUpperCase()),
            eq(sql`UPPER(${plans.name})`, requestedCanonical.planId.toUpperCase()),
            eq(sql`LOWER(${plans.configuration}->>'planId')`, requestedCanonical.planId.toLowerCase())
          ),
          eq(plans.is_deleted, false)
        )
      ).limit(1);
      if (dbPlan) planId = dbPlan.id;
    }

    // If still no planId, fallback to first active plan in DB
    if (!planId) {
      const [fallbackPlan] = await db.select().from(plans).where(
        and(eq(plans.plan_status, 'ACTIVE'), eq(plans.is_deleted, false))
      ).limit(1);
      if (fallbackPlan) planId = fallbackPlan.id;
    }

    // Hash password
    const rawPassword = password || ('Welcome' + Math.floor(1000 + Math.random() * 9000) + '!');
    const hashedPassword = await bcrypt.hash(rawPassword, 12);

    // Create both records atomically in a single PostgreSQL transaction
    await db.transaction(async (tx) => {
      // 1. Create restaurant with status PENDING
      const [newRestaurant] = await tx.insert(restaurants).values({
        name: name.trim(),
        restaurant_name: name.trim(),
        domain: finalSlug,
        address: address ? String(address).trim() : null,
        phone_number: cleanPhone,
        restaurant_status: 'PENDING',
        plan_id: planId,
        table_allocation_mode: 'MANUAL',
        is_deleted: false
      }).returning();

      // 2. Create owner user with status INACTIVE
      const [newOwner] = await tx.insert(users).values({
        name: ownerName.trim(),
        email: userEmail,
        phone_number: cleanPhone,
        password_hash: hashedPassword,
        restaurant_id: newRestaurant.id,
        user_type: 'ADMIN',
        user_status: 'INACTIVE',
        sessionVersion: 0,
        is_deleted: false
      }).returning();

      // 3. Record in audit_log
      await tx.insert(audit_log).values({
        restaurant_id: newRestaurant.id,
        user_id: newOwner.id,
        action: 'REGISTRATION_SUBMITTED',
        entity_type: 'RESTAURANT',
        entity_id: newRestaurant.id,
        details: {
          restaurantName: newRestaurant.name,
          domain: finalSlug,
          ownerName: newOwner.name,
          email: userEmail,
          phone: cleanPhone,
          requestedPlan: requestedCanonical?.planId || 'STARTER',
          planId
        }
      });
    });

    res.status(201).json({
      success: true,
      message: 'Registration request submitted! Please wait for system admin approval.'
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email/phone and password' });
    }

    const queryTerm = email.toLowerCase().trim();

    // Query user by email or phone from Supabase PostgreSQL
    const [userRow] = await db.select().from(users).where(
      and(
        eq(users.is_deleted, false),
        or(
          eq(sql`LOWER(${users.email})`, queryTerm),
          eq(users.phone_number, queryTerm)
        )
      )
    ).limit(1);

    if (!userRow) {
      return res.status(401).json({ success: false, message: 'Incorrect email or password' });
    }

    const isMatch = await bcrypt.compare(password, userRow.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect email or password' });
    }

    // Role mapping
    const role = userRow.user_type === 'SYSTEM_ADMIN' 
      ? 'SUPER_ADMIN' 
      : (userRow.user_type === 'ADMIN' ? 'RESTAURANT_OWNER' : 'RESTAURANT_STAFF');

    let user = {
      ...userRow,
      _id: userRow.id,
      id: userRow.id,
      role,
      userType: userRow.user_type,
      isActive: userRow.user_status === 'ACTIVE'
    };

    if (role !== 'SUPER_ADMIN') {
      if (user.restaurant_id) {
        const [rest] = await db.select().from(restaurants).where(eq(restaurants.id, user.restaurant_id)).limit(1);
        if (rest) {
          if (rest.restaurant_status === 'PENDING') {
            return res.status(403).json({
              success: false,
              message: 'Your restaurant registration request is pending system admin approval.'
            });
          }
          if (rest.restaurant_status === 'REJECTED') {
            return res.status(403).json({
              success: false,
              message: `Your restaurant registration was not approved.${rest.rejection_reason ? ' Reason: ' + rest.rejection_reason : ''}`
            });
          }
          if (rest.restaurant_status === 'PAUSED' || rest.restaurant_status === 'INACTIVE') {
            return res.status(403).json({
              success: false,
              message: 'Your restaurant account is currently paused or inactive. Please contact support.'
            });
          }

          user.restaurantId = {
            ...rest,
            _id: rest.id,
            id: rest.id,
            subdomain: rest.domain,
            slug: rest.domain
          };
        }
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Your account is inactive. Please contact your restaurant administrator.'
        });
      }
    }

    createSendToken(user, 200, res);
  } catch (error) {
    next(error);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const [userRow] = await db.select().from(users).where(
      and(eq(users.id, req.user.id), eq(users.is_deleted, false))
    ).limit(1);

    if (!userRow) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const role = userRow.user_type === 'SYSTEM_ADMIN' 
      ? 'SUPER_ADMIN' 
      : (userRow.user_type === 'ADMIN' ? 'RESTAURANT_OWNER' : 'RESTAURANT_STAFF');

    let user = {
      ...userRow,
      _id: userRow.id,
      id: userRow.id,
      role,
      userType: userRow.user_type,
      isActive: userRow.user_status === 'ACTIVE'
    };

    if (user.restaurant_id) {
      const [rest] = await db.select().from(restaurants).where(eq(restaurants.id, user.restaurant_id)).limit(1);
      if (rest) {
        user.restaurantId = {
          ...rest,
          _id: rest.id,
          id: rest.id,
          subdomain: rest.domain,
          slug: rest.domain
        };
      }
    }

    if (user.user_type === 'STAFF') {
      const assignments = await db.select().from(tables_assignment).where(
        and(
          eq(tables_assignment.staff_id, user.id),
          eq(tables_assignment.assignment_status, 'ASSIGNED')
        )
      );
      user.assignedTables = assignments.map(a => ({
        _id: a.table_id,
        id: a.table_id
      }));
    }

    delete user.password_hash;

    res.status(200).json({
      success: true,
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password is required.'
      });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.'
      });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirmation do not match.'
      });
    }

    const [user] = await db.select().from(users).where(
      and(eq(users.id, req.user.id), eq(users.is_deleted, false))
    ).limit(1);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    const newSessionVersion = (user.sessionVersion || 0) + 1;

    await db.update(users).set({
      password_hash: hash,
      sessionVersion: newSessionVersion,
      updatedat: new Date()
    }).where(eq(users.id, req.user.id));

    // Log password change in audit_log
    await db.insert(audit_log).values({
      restaurant_id: user.restaurant_id,
      user_id: user.id,
      action: 'PASSWORD_CHANGED',
      entity_type: 'USER',
      entity_id: user.id,
      details: { changedAt: new Date() }
    });

    res.status(200).json({
      success: true,
      message: 'Password has been updated successfully.'
    });
  } catch (error) {
    next(error);
  }
};
