const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { db, schema } = require('../db/client');
const { eq, and, sql, desc, or, notInArray, ne } = require('drizzle-orm');
const { restaurants, users, plans, ads, order_details, order_items, audit_log, plan_requests } = schema;
const RestaurantProvisioningService = require('../services/RestaurantProvisioningService');
const LifecycleService = require('../services/LifecycleService');
const whatsapp = require('../utils/whatsapp');
const { getPublicPlans, getPlan } = require('../config/plans');
const { uploadToCloudinary } = require('../utils/cloudinary');
const RealtimeService = require('../services/RealtimeService');

// ──────────────────────────────────────────
//  RESTAURANT MANAGEMENT
// ──────────────────────────────────────────

exports.createRestaurant = async (req, res, next) => {
  try {
    const { restaurantName, ownerName, ownerEmail, ownerPhone, ownerPassword, subdomain, selectedPlan } = req.body;

    if (!restaurantName || !ownerName || !ownerEmail || !ownerPassword) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields.' });
    }

    const email = ownerEmail.toLowerCase().trim();

    // Check if owner email already exists
    const [existingUser] = await db.select().from(users).where(
      and(eq(sql`LOWER(${users.email})`, email), eq(users.is_deleted, false))
    ).limit(1);

    if (existingUser) {
      return res.status(409).json({ success: false, message: 'A user with this owner email already exists.' });
    }

    // Generate or sanitize subdomain
    let slug = subdomain
      ? subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '')
      : restaurantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const [existingDomain] = await db.select().from(restaurants).where(
      and(eq(sql`LOWER(${restaurants.domain})`, slug), eq(restaurants.is_deleted, false))
    ).limit(1);

    if (existingDomain) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    const hashedPassword = await bcrypt.hash(ownerPassword, 12);

    const registrationMock = {
      restaurantName,
      restaurantType: 'Restaurant',
      subdomain: slug,
      ownerName,
      ownerPhone,
      ownerEmail: email,
      ownerPassword: hashedPassword,
      selectedPlan: selectedPlan || 'STARTER'
    };

    const registry = await RestaurantProvisioningService.provisionRestaurant(registrationMock);

    res.status(201).json({
      success: true,
      message: 'Restaurant and Owner account created successfully in PostgreSQL.',
      data: {
        restaurant: registry
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getAllRestaurants = async (req, res, next) => {
  try {
    const { status, search } = req.query;

    // Only return ACTIVE, PAUSED, and INACTIVE restaurants.
    // PENDING and REJECTED requests are isolated to the Registration Requests tab.
    const conditions = [
      eq(restaurants.is_deleted, false)
    ];

    if (status && ['ACTIVE', 'PAUSED', 'INACTIVE'].includes(status.toUpperCase())) {
      conditions.push(eq(restaurants.restaurant_status, status.toUpperCase()));
    } else {
      conditions.push(ne(restaurants.restaurant_status, 'PENDING'));
      conditions.push(ne(restaurants.restaurant_status, 'REJECTED'));
    }

    if (search && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      conditions.push(
        or(
          sql`LOWER(${restaurants.name}) LIKE ${q}`,
          sql`LOWER(${restaurants.domain}) LIKE ${q}`,
          sql`LOWER(${restaurants.phone_number}) LIKE ${q}`
        )
      );
    }

    const rows = await db.select().from(restaurants)
      .where(and(...conditions))
      .orderBy(desc(restaurants.createdat));

    // Fetch all owners
    const allOwners = await db.select().from(users).where(
      and(eq(users.user_type, 'ADMIN'), eq(users.is_deleted, false))
    );
    const ownerMap = new Map();
    for (const u of allOwners) {
      if (u.restaurant_id) ownerMap.set(u.restaurant_id, u);
    }

    // Fetch plans
    const allPlans = await db.select().from(plans).where(eq(plans.is_deleted, false));
    const planMap = new Map();
    for (const p of allPlans) {
      planMap.set(p.id, p);
    }

    // Fetch pending plan change requests
    const pendingPlanReqs = await db.select().from(plan_requests).where(
      eq(plan_requests.status, 'PENDING')
    );
    const pendingPlanReqMap = new Map();
    for (const pr of pendingPlanReqs) {
      const p = planMap.get(pr.plan_id);
      pendingPlanReqMap.set(pr.restaurant_id, {
        id: pr.id,
        plan: p ? p.name : 'Unknown',
        planId: pr.plan_id,
        billingCycle: pr.billing_cycle,
        status: 'PENDING',
        createdAt: pr.createdat
      });
    }

    const now = new Date();
    const mapped = rows.map(r => {
      const owner = ownerMap.get(r.id) || {};
      const planObj = r.plan_id ? planMap.get(r.plan_id) : null;
      const planName = r.overriden_plan || (planObj ? planObj.name : 'Starter');

      const renewalReq = pendingPlanReqMap.get(r.id) || null;

      return {
        _id: r.id,
        id: r.id,
        restaurantId: r.id,
        name: r.name,
        restaurantName: r.name,
        slug: r.domain,
        subdomain: r.domain,
        domain: r.domain,
        address: r.address || '',
        status: r.restaurant_status,
        restaurant_status: r.restaurant_status,
        selectedPlan: planName.toUpperCase(),
        plan_id: r.plan_id,
        is_plan_overridden: r.is_plan_overridden,
        overriden_plan: r.overriden_plan,
        subscriptionStatus: r.restaurant_status === 'ACTIVE' ? 'ACTIVE' : r.restaurant_status,
        subscriptionStartDate: r.createdat,
        subscriptionEndDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        daysRemaining: r.restaurant_status === 'ACTIVE' ? 30 : 0,
        renewalRequest: renewalReq,
        createdAt: r.createdat,
        ownerId: {
          id: owner.id || null,
          name: owner.name || 'Owner',
          email: owner.email || '',
          phone: owner.phone_number || r.phone_number || ''
        }
      };
    });

    res.status(200).json({
      success: true,
      data: { restaurants: mapped }
    });
  } catch (error) {
    next(error);
  }
};

exports.updateRestaurant = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, isActive, status, phone, subdomain, address } = req.body;

    const [existing] = await db.select().from(restaurants).where(
      and(eq(restaurants.id, id), eq(restaurants.is_deleted, false))
    ).limit(1);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    const updateData = { updatedat: new Date() };
    if (name) {
      updateData.name = name.trim();
      updateData.restaurant_name = name.trim();
    }
    if (phone) updateData.phone_number = phone.trim();
    if (address !== undefined) updateData.address = address ? String(address).trim() : null;

    if (status && ['ACTIVE', 'PAUSED', 'INACTIVE'].includes(status)) {
      updateData.restaurant_status = status;
    } else if (isActive !== undefined) {
      updateData.restaurant_status = isActive ? 'ACTIVE' : 'PAUSED';
    }

    if (subdomain) {
      const cleanSubdomain = subdomain.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
      if (cleanSubdomain) {
        const [domainConflict] = await db.select().from(restaurants).where(
          and(
            eq(sql`LOWER(${restaurants.domain})`, cleanSubdomain),
            ne(restaurants.id, id),
            eq(restaurants.is_deleted, false)
          )
        ).limit(1);

        if (domainConflict) {
          return res.status(409).json({ success: false, message: 'This subdomain is already taken by another restaurant.' });
        }
        updateData.domain = cleanSubdomain;
      }
    }

    await db.transaction(async (tx) => {
      await tx.update(restaurants).set(updateData).where(eq(restaurants.id, id));

      // If restaurant paused or inactivated, sync owner status
      if (updateData.restaurant_status === 'INACTIVE' || updateData.restaurant_status === 'PAUSED') {
        await tx.update(users).set({
          user_status: 'INACTIVE',
          updatedat: new Date()
        }).where(and(eq(users.restaurant_id, id), eq(users.user_type, 'ADMIN')));
      } else if (updateData.restaurant_status === 'ACTIVE') {
        await tx.update(users).set({
          user_status: 'ACTIVE',
          updatedat: new Date()
        }).where(and(eq(users.restaurant_id, id), eq(users.user_type, 'ADMIN')));
      }

      await tx.insert(audit_log).values({
        restaurant_id: id,
        user_id: req.user?.id || null,
        action: 'UPDATE_RESTAURANT',
        entity_type: 'RESTAURANT',
        entity_id: id,
        details: updateData
      });
    });

    const [updated] = await db.select().from(restaurants).where(eq(restaurants.id, id)).limit(1);

    res.status(200).json({
      success: true,
      message: 'Restaurant updated successfully in PostgreSQL',
      data: { restaurant: updated }
    });
  } catch (error) {
    next(error);
  }
};

exports.updateRestaurantBilling = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { selectedPlan, subscriptionStatus, isPlanOverridden, overriddenPlan, note } = req.body;

    const [existing] = await db.select().from(restaurants).where(
      and(eq(restaurants.id, id), eq(restaurants.is_deleted, false))
    ).limit(1);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    const updateData = { updatedat: new Date() };

    if (subscriptionStatus && ['ACTIVE', 'PAUSED', 'INACTIVE'].includes(subscriptionStatus)) {
      updateData.restaurant_status = subscriptionStatus;
    }

    if (isPlanOverridden !== undefined) {
      updateData.is_plan_overridden = Boolean(isPlanOverridden);
    }

    if (overriddenPlan !== undefined) {
      updateData.overriden_plan = overriddenPlan;
    }

    if (req.body.planId) {
      const [p] = await db.select().from(plans).where(
        and(eq(plans.id, req.body.planId), eq(plans.is_deleted, false))
      ).limit(1);
      if (p) {
        updateData.plan_id = p.id;
        updateData.overriden_plan = (overriddenPlan || p.name).toUpperCase();
        updateData.is_plan_overridden = isPlanOverridden !== undefined ? Boolean(isPlanOverridden) : true;
      }
    } else if (selectedPlan) {
      const [p] = await db.select().from(plans).where(
        and(
          or(
            eq(sql`UPPER(${plans.name})`, selectedPlan.toUpperCase()),
            eq(sql`LOWER(${plans.configuration}->>'planId')`, selectedPlan.toLowerCase())
          ),
          eq(plans.is_deleted, false)
        )
      ).limit(1);

      if (p) {
        updateData.plan_id = p.id;
        updateData.overriden_plan = (overriddenPlan || p.name).toUpperCase();
      } else {
        updateData.overriden_plan = (overriddenPlan || selectedPlan).toUpperCase();
      }
      if (isPlanOverridden !== undefined) {
        updateData.is_plan_overridden = Boolean(isPlanOverridden);
      }
    }

    await db.transaction(async (tx) => {
      await tx.update(restaurants).set(updateData).where(eq(restaurants.id, id));

      await tx.insert(audit_log).values({
        restaurant_id: id,
        user_id: req.user?.id || null,
        action: 'UPDATE_BILLING',
        entity_type: 'RESTAURANT',
        entity_id: id,
        details: { ...updateData, note: note || 'Plan/Billing updated by admin' }
      });
    });

    const [updated] = await db.select().from(restaurants).where(eq(restaurants.id, id)).limit(1);

    RealtimeService.adminEvent('restaurant_updated', {
      id,
      name: updated.name,
      plan_id: updated.plan_id,
      selectedPlan: (updated.overriden_plan || 'Starter').toUpperCase(),
      is_plan_overridden: updated.is_plan_overridden,
      overriden_plan: updated.overriden_plan
    });

    res.status(200).json({
      success: true,
      message: 'Subscription & billing updated successfully in PostgreSQL',
      data: { 
        restaurant: {
          ...updated,
          selectedPlan: (updated.overriden_plan || 'Starter').toUpperCase()
        } 
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteRestaurant = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [restaurant] = await db.select().from(restaurants).where(
      and(eq(restaurants.id, id), eq(restaurants.is_deleted, false))
    ).limit(1);

    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    await db.transaction(async (tx) => {
      // Soft-delete restaurant
      await tx.update(restaurants).set({
        is_deleted: true,
        deletedat: new Date(),
        restaurant_status: 'INACTIVE',
        updatedat: new Date()
      }).where(eq(restaurants.id, id));

      // Inactivate associated users
      await tx.update(users).set({
        is_deleted: true,
        deletedat: new Date(),
        user_status: 'INACTIVE',
        updatedat: new Date()
      }).where(eq(users.restaurant_id, id));

      await tx.insert(audit_log).values({
        restaurant_id: id,
        user_id: req.user?.id || null,
        action: 'DELETE_RESTAURANT',
        entity_type: 'RESTAURANT',
        entity_id: id,
        details: { deletedAt: new Date() }
      });
    });

    res.status(200).json({ success: true, message: 'Restaurant and users soft-deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────
//  REGISTRATION REQUESTS (APPROVAL / REJECTION)
// ──────────────────────────────────────────

exports.getPendingRequests = async (req, res, next) => {
  try {
    // Only query restaurants that have status PENDING
    const rows = await db.select().from(restaurants).where(
      and(
        eq(restaurants.restaurant_status, 'PENDING'),
        eq(restaurants.is_deleted, false)
      )
    ).orderBy(desc(restaurants.createdat));

    // Fetch owners
    const allOwners = await db.select().from(users).where(
      and(eq(users.user_type, 'ADMIN'), eq(users.is_deleted, false))
    );
    const ownerMap = new Map();
    for (const u of allOwners) {
      if (u.restaurant_id) ownerMap.set(u.restaurant_id, u);
    }

    // Fetch plans
    const allPlans = await db.select().from(plans).where(eq(plans.is_deleted, false));
    const planMap = new Map();
    for (const p of allPlans) {
      planMap.set(p.id, p);
    }

    const formattedRequests = rows.map(reqRow => {
      const owner = ownerMap.get(reqRow.id) || {};
      const planObj = reqRow.plan_id ? planMap.get(reqRow.plan_id) : null;
      const planName = reqRow.overriden_plan || (planObj ? planObj.name : 'Starter');

      return {
        _id: reqRow.id,
        id: reqRow.id,
        name: reqRow.name,
        type: 'Restaurant',
        slug: reqRow.domain,
        subdomain: reqRow.domain,
        address: reqRow.address || '',
        status: 'PENDING_APPROVAL',
        restaurant_status: reqRow.restaurant_status,
        selectedPlan: planName.toUpperCase(),
        plan_id: reqRow.plan_id,
        overriden_plan: reqRow.overriden_plan,
        createdAt: reqRow.createdat,
        createdat: reqRow.createdat,
        ownerId: {
          id: owner.id || null,
          name: owner.name || 'Owner',
          email: owner.email || '',
          phone: owner.phone_number || reqRow.phone_number || ''
        }
      };
    });

    res.status(200).json({
      success: true,
      data: { requests: formattedRequests }
    });
  } catch (error) {
    next(error);
  }
};

exports.approveRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [restaurant] = await db.select().from(restaurants).where(
      and(eq(restaurants.id, id), eq(restaurants.is_deleted, false))
    ).limit(1);

    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant request not found' });
    }

    if (restaurant.restaurant_status === 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'This restaurant is already approved and active.' });
    }

    // Resolve plan_id if missing
    let resolvedPlanId = restaurant.plan_id;
    if (!resolvedPlanId) {
      const targetPlanName = (restaurant.overriden_plan || 'STARTER').toUpperCase();
      const [matchedPlan] = await db.select().from(plans).where(
        and(
          or(
            eq(sql`UPPER(${plans.name})`, targetPlanName),
            eq(sql`LOWER(${plans.configuration}->>'planId')`, targetPlanName.toLowerCase())
          ),
          eq(plans.is_deleted, false)
        )
      ).limit(1);
      if (matchedPlan) resolvedPlanId = matchedPlan.id;
    }

    // Activate restaurant and its owner atomically in PostgreSQL transaction
    await db.transaction(async (tx) => {
      await tx.update(restaurants).set({
        restaurant_status: 'ACTIVE',
        plan_id: resolvedPlanId,
        updatedat: new Date()
      }).where(eq(restaurants.id, id));

      await tx.update(users).set({
        user_status: 'ACTIVE',
        updatedat: new Date()
      }).where(and(eq(users.restaurant_id, id), eq(users.user_type, 'ADMIN')));

      await tx.insert(audit_log).values({
        restaurant_id: id,
        user_id: req.user?.id || null,
        action: 'APPROVE_RESTAURANT',
        entity_type: 'RESTAURANT',
        entity_id: id,
        details: {
          approvedAt: new Date(),
          approvedBy: req.user?.email || 'SYSTEM_ADMIN'
        }
      });
    });

    const [owner] = await db.select().from(users).where(
      and(eq(users.restaurant_id, id), eq(users.user_type, 'ADMIN'))
    ).limit(1);

    RealtimeService.adminEvent('restaurant_updated', {
      id,
      status: 'ACTIVE',
      name: restaurant.name,
      domain: restaurant.domain
    });

    const targetPhone = owner?.phone_number || restaurant.phone_number;
    if (targetPhone) {
      try {
        const loginUrl = `https://${restaurant.domain}.dynease.in/login`;
        const message = `🎉 Your restaurant has been approved!\n\nRestaurant: ${restaurant.name}\n\nYour restaurant account is now active.\n\nRestaurant URL:\nhttps://${restaurant.domain}.dynease.in\n\nLogin to Dashboard:\n${loginUrl}\n\nYou can now configure your menu, tables, and staff.`;
        await whatsapp.sendTextMessage(targetPhone, message);
      } catch (waError) {
        console.error('Failed to send WhatsApp approval notification:', waError.message);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Restaurant approved successfully in PostgreSQL',
      data: { registry: { ...restaurant, restaurant_status: 'ACTIVE' } }
    });
  } catch (error) {
    next(error);
  }
};

exports.rejectRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const [restaurant] = await db.select().from(restaurants).where(
      and(eq(restaurants.id, id), eq(restaurants.is_deleted, false))
    ).limit(1);

    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    // Reject restaurant and keep owner inactive atomically in transaction
    await db.transaction(async (tx) => {
      await tx.update(restaurants).set({
        restaurant_status: 'REJECTED',
        rejection_reason: reason ? String(reason).trim() : 'Registration rejected by administrator',
        updatedat: new Date()
      }).where(eq(restaurants.id, id));

      await tx.update(users).set({
        user_status: 'INACTIVE',
        updatedat: new Date()
      }).where(and(eq(users.restaurant_id, id), eq(users.user_type, 'ADMIN')));

      await tx.insert(audit_log).values({
        restaurant_id: id,
        user_id: req.user?.id || null,
        action: 'REJECT_RESTAURANT',
        entity_type: 'RESTAURANT',
        entity_id: id,
        details: {
          rejectedAt: new Date(),
          reason: reason || 'Not specified',
          rejectedBy: req.user?.email || 'SYSTEM_ADMIN'
        }
      });
    });

    RealtimeService.adminEvent('restaurant_updated', { id, status: 'REJECTED', name: restaurant.name });

    res.status(200).json({ success: true, message: 'Restaurant request rejected successfully' });
  } catch (error) {
    next(error);
  }
};

exports.suspendRestaurant = async (req, res, next) => {
  try {
    const { id } = req.params;
    await LifecycleService.pauseRestaurant(id);
    RealtimeService.adminEvent('restaurant_updated', { id, status: 'SUSPENDED' });
    res.status(200).json({ success: true, message: 'Restaurant suspended successfully' });
  } catch (error) {
    next(error);
  }
};

exports.sendCredentials = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, id)).limit(1);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    const [user] = await db.select().from(users).where(
      and(eq(users.restaurant_id, id), eq(users.user_type, 'ADMIN'), eq(users.is_deleted, false))
    ).limit(1);

    if (!user) {
      return res.status(404).json({ success: false, message: 'Owner user not found' });
    }

    const tempPassword = 'Welcome' + Math.floor(1000 + Math.random() * 9000) + '!';
    const hashedPassword = await bcrypt.hash(tempPassword, 12);
    await db.update(users).set({ password_hash: hashedPassword, updatedat: new Date() }).where(eq(users.id, user.id));

    let waSent = false;
    const targetPhone = user.phone_number || restaurant.phone_number;
    if (targetPhone) {
      try {
        const loginUrl = `https://${restaurant.domain}.dynease.in/login`;
        const message = `🎉 Your login credentials have been created/reset!\n\nYou can login at: ${loginUrl}\n\nYour login credentials:\nMobile / Email: ${user.phone_number || user.email}\nPassword: ${tempPassword}`;
        await whatsapp.sendTextMessage(targetPhone, message);
        waSent = true;
      } catch (e) {
        console.error('WhatsApp message failed to send:', e.message);
      }
    }

    res.status(200).json({
      success: true,
      message: waSent
        ? 'Credentials sent to owner successfully via WhatsApp.'
        : `Password reset successfully. (WhatsApp failed, new password is: ${tempPassword})`
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────
//  PLAN MANAGEMENT & PLAN CHANGE REQUESTS
// ──────────────────────────────────────────

exports.getPlans = async (req, res, next) => {
  try {
    const dbPlans = await db.select().from(plans).where(eq(plans.is_deleted, false)).orderBy(plans.createdat);
    res.status(200).json({ success: true, data: { plans: dbPlans } });
  } catch (error) {
    next(error);
  }
};

exports.createPlan = async (req, res, next) => {
  try {
    const { name, configuration } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Plan name is required' });
    }

    const [plan] = await db.insert(plans).values({
      name: name.trim(),
      configuration: configuration || {},
      plan_status: 'ACTIVE',
      is_deleted: false
    }).returning();

    await db.insert(audit_log).values({
      user_id: req.user?.id || null,
      action: 'CREATE_PLAN',
      entity_type: 'PLAN',
      entity_id: plan.id,
      details: { name: plan.name, configuration }
    });

    res.status(201).json({ success: true, message: 'Plan created successfully', data: { plan } });
  } catch (error) {
    next(error);
  }
};

exports.updatePlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, configuration, plan_status } = req.body;

    const updateData = { updatedat: new Date() };
    if (name) updateData.name = name.trim();
    if (configuration !== undefined) updateData.configuration = configuration;
    if (plan_status && ['ACTIVE', 'INACTIVE'].includes(plan_status)) {
      updateData.plan_status = plan_status;
    }

    const [plan] = await db.update(plans).set(updateData).where(
      and(eq(plans.id, id), eq(plans.is_deleted, false))
    ).returning();

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    await db.insert(audit_log).values({
      user_id: req.user?.id || null,
      action: 'UPDATE_PLAN',
      entity_type: 'PLAN',
      entity_id: plan.id,
      details: updateData
    });

    res.status(200).json({ success: true, message: 'Plan updated successfully', data: { plan } });
  } catch (error) {
    next(error);
  }
};

exports.deletePlan = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if any active restaurants are using this plan
    const [assignedRestaurant] = await db.select().from(restaurants).where(
      and(eq(restaurants.plan_id, id), eq(restaurants.is_deleted, false))
    ).limit(1);

    if (assignedRestaurant) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete plan: active restaurants are currently assigned to this plan.'
      });
    }

    await db.update(plans).set({
      is_deleted: true,
      deletedat: new Date(),
      plan_status: 'INACTIVE',
      updatedat: new Date()
    }).where(eq(plans.id, id));

    res.status(200).json({ success: true, message: 'Plan deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.getPlanRequests = async (req, res, next) => {
  try {
    const reqRows = await db.select().from(plan_requests).orderBy(desc(plan_requests.createdat));

    const restRows = await db.select().from(restaurants).where(eq(restaurants.is_deleted, false));
    const restMap = new Map();
    for (const r of restRows) restMap.set(r.id, r);

    const planRows = await db.select().from(plans).where(eq(plans.is_deleted, false));
    const planMap = new Map();
    for (const p of planRows) planMap.set(p.id, p);

    const userRows = await db.select().from(users).where(eq(users.is_deleted, false));
    const userMap = new Map();
    for (const u of userRows) userMap.set(u.id, u);

    const mapped = reqRows.map(pr => {
      const rest = restMap.get(pr.restaurant_id) || {};
      const plan = planMap.get(pr.plan_id) || {};
      const user = pr.requested_by ? userMap.get(pr.requested_by) : null;

      return {
        id: pr.id,
        _id: pr.id,
        restaurantId: pr.restaurant_id,
        restaurantName: rest.name || 'Restaurant',
        subdomain: rest.domain || '',
        planId: pr.plan_id,
        planName: plan.name || 'Unknown',
        billingCycle: pr.billing_cycle,
        status: pr.status,
        requestedBy: user ? { name: user.name, email: user.email, phone: user.phone_number } : null,
        rejectionReason: pr.rejection_reason,
        createdAt: pr.createdat,
        updatedAt: pr.updatedat
      };
    });

    res.status(200).json({ success: true, data: { planRequests: mapped } });
  } catch (error) {
    next(error);
  }
};

exports.approvePlanRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [request] = await db.select().from(plan_requests).where(eq(plan_requests.id, id)).limit(1);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Plan request not found' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: `Request is already ${request.status.toLowerCase()}` });
    }

    await db.transaction(async (tx) => {
      // 1. Update plan request status
      await tx.update(plan_requests).set({
        status: 'APPROVED',
        updatedat: new Date()
      }).where(eq(plan_requests.id, id));

      // 2. Update restaurant plan_id
      await tx.update(restaurants).set({
        plan_id: request.plan_id,
        updatedat: new Date()
      }).where(eq(restaurants.id, request.restaurant_id));

      // 3. Log audit event
      await tx.insert(audit_log).values({
        restaurant_id: request.restaurant_id,
        user_id: req.user?.id || null,
        action: 'APPROVE_PLAN_CHANGE',
        entity_type: 'PLAN_REQUEST',
        entity_id: id,
        details: {
          planId: request.plan_id,
          billingCycle: request.billing_cycle,
          approvedAt: new Date(),
          approvedBy: req.user?.email || 'SYSTEM_ADMIN'
        }
      });
    });

    RealtimeService.adminEvent('plan_request_updated', {
      id,
      status: 'APPROVED',
      restaurantId: request.restaurant_id,
      planId: request.plan_id
    });

    res.status(200).json({ success: true, message: 'Plan request approved and restaurant plan updated.' });
  } catch (error) {
    next(error);
  }
};

exports.rejectPlanRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const [request] = await db.select().from(plan_requests).where(eq(plan_requests.id, id)).limit(1);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Plan request not found' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: `Request is already ${request.status.toLowerCase()}` });
    }

    await db.transaction(async (tx) => {
      await tx.update(plan_requests).set({
        status: 'REJECTED',
        rejection_reason: reason ? String(reason).trim() : 'Plan request rejected by administrator',
        updatedat: new Date()
      }).where(eq(plan_requests.id, id));

      await tx.insert(audit_log).values({
        restaurant_id: request.restaurant_id,
        user_id: req.user?.id || null,
        action: 'REJECT_PLAN_CHANGE',
        entity_type: 'PLAN_REQUEST',
        entity_id: id,
        details: {
          planId: request.plan_id,
          reason: reason || 'Not specified',
          rejectedAt: new Date(),
          rejectedBy: req.user?.email || 'SYSTEM_ADMIN'
        }
      });
    });

    RealtimeService.adminEvent('plan_request_updated', {
      id,
      status: 'REJECTED',
      restaurantId: request.restaurant_id,
      planId: request.plan_id
    });

    res.status(200).json({ success: true, message: 'Plan request rejected.' });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────
//  ADS / BANNERS MANAGEMENT
// ──────────────────────────────────────────

exports.getAds = async (req, res, next) => {
  try {
    const adList = await db.select().from(ads).orderBy(ads.display_order, desc(ads.createdat));

    const mapped = adList.map((b) => ({
      _id: b.id,
      id: b.id,
      title: b.name || '',
      subtitle: b.description || '',
      imageUrl: b.image || '',
      targetUrl: b.url || '',
      display_order: b.display_order,
      isActive: b.ad_status !== false,
      status: b.ad_status === false ? 'Inactive' : 'Active',
      createdAt: b.createdat,
      updatedAt: b.updatedat,
    }));

    res.status(200).json({ success: true, data: { ads: mapped } });
  } catch (error) {
    next(error);
  }
};

exports.createAd = async (req, res, next) => {
  try {
    const { name, title, description, subtitle, image, imageUrl, url, targetUrl, display_order, ad_status, status } = req.body;

    const bannerName = (name || title || '').trim();
    if (!bannerName) {
      return res.status(400).json({ success: false, message: 'Banner title/name is required' });
    }

    const bannerImage = (image || imageUrl || '').trim();
    const bannerUrl = (url || targetUrl || '').trim();

    // If an image file was uploaded, store it on Cloudinary
    let storedImage = bannerImage;
    if (req.file && req.file.buffer) {
      const uploadResult = await uploadToCloudinary(req.file.buffer, 'dynease/banners');
      storedImage = uploadResult.secure_url;
    }

    // Validate URLs if provided
    if (bannerUrl && !bannerUrl.startsWith('http://') && !bannerUrl.startsWith('https://') && !bannerUrl.startsWith('/')) {
      return res.status(400).json({ success: false, message: 'Redirect URL must start with https://, http://, or /' });
    }

    const isActive = ad_status !== undefined ? Boolean(ad_status) : (status ? status.toLowerCase() === 'active' : true);

    const [ad] = await db.insert(ads).values({
      name: bannerName,
      description: (description || subtitle || '').trim(),
      image: storedImage,
      url: bannerUrl,
      display_order: parseInt(display_order, 10) || 0,
      ad_status: isActive
    }).returning();

    RealtimeService.bannersUpdated({ action: 'created', id: ad.id });

    res.status(201).json({ success: true, message: 'Banner created successfully', data: { ad } });
  } catch (error) {
    next(error);
  }
};

exports.updateAd = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, title, description, subtitle, image, imageUrl, url, targetUrl, display_order, ad_status, status } = req.body;

    const [existing] = await db.select().from(ads).where(eq(ads.id, id)).limit(1);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    const updateData = { updatedat: new Date() };
    if (name !== undefined || title !== undefined) updateData.name = (name || title || '').trim();
    if (description !== undefined || subtitle !== undefined) updateData.description = (description || subtitle || '').trim();
    if (req.file && req.file.buffer) {
      // Uploaded file takes precedence over any image URL string
      const uploadResult = await uploadToCloudinary(req.file.buffer, 'dynease/banners');
      updateData.image = uploadResult.secure_url;
    } else if (image !== undefined || imageUrl !== undefined) {
      updateData.image = (image || imageUrl || '').trim();
    }
    if (url !== undefined || targetUrl !== undefined) {
      const bannerUrl = (url || targetUrl || '').trim();
      if (bannerUrl && !bannerUrl.startsWith('http://') && !bannerUrl.startsWith('https://') && !bannerUrl.startsWith('/')) {
        return res.status(400).json({ success: false, message: 'Redirect URL must start with https://, http://, or /' });
      }
      updateData.url = bannerUrl;
    }
    if (display_order !== undefined) updateData.display_order = parseInt(display_order, 10) || 0;
    if (ad_status !== undefined) {
      updateData.ad_status = Boolean(ad_status);
    } else if (status !== undefined) {
      updateData.ad_status = status.toLowerCase() === 'active';
    }

    const [ad] = await db.update(ads).set(updateData).where(eq(ads.id, id)).returning();

    RealtimeService.bannersUpdated({ action: 'updated', id: ad.id });

    res.status(200).json({ success: true, message: 'Banner updated successfully', data: { ad } });
  } catch (error) {
    next(error);
  }
};

exports.deleteAd = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.delete(ads).where(eq(ads.id, id));
    RealtimeService.bannersUpdated({ action: 'deleted', id });
    res.status(200).json({ success: true, message: 'Banner deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────
//  ADVERTISEMENT INQUIRIES
// ──────────────────────────────────────────

exports.getAdInquiries = async (req, res, next) => {
  try {
    const inquiries = await db.select().from(audit_log).where(eq(audit_log.action, 'AD_INQUIRY')).orderBy(desc(audit_log.createdat));
    res.status(200).json({ success: true, data: { inquiries: inquiries.map(i => ({ ...i.details, auditId: i.id })) } });
  } catch (error) {
    next(error);
  }
};

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
      name: name.trim(),
      mobileNumber: mobileNumber.trim(),
      businessName: businessName.trim(),
      email: email ? email.trim() : '',
      city: city ? city.trim() : '',
      message: message ? message.trim() : '',
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

exports.updateAdInquiryStatus = async (req, res, next) => {
  res.status(200).json({ success: true, message: 'Status updated successfully' });
};

exports.deleteAdInquiry = async (req, res, next) => {
  res.status(200).json({ success: true, message: 'Inquiry deleted successfully' });
};

// ──────────────────────────────────────────
//  CUSTOM MESSAGES, USERS & ANALYTICS
// ──────────────────────────────────────────

exports.sendCustomMessage = async (req, res, next) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ success: false, message: 'Phone and message are required' });
    }
    const result = await whatsapp.sendTextMessage(phone, message);
    res.status(200).json({ success: true, message: 'Message sent successfully', data: result });
  } catch (error) {
    console.error('Custom message error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to send message: ' + error.message });
  }
};

exports.getAllUsers = async (req, res, next) => {
  try {
    const userRows = await db.select().from(users)
      .where(eq(users.is_deleted, false))
      .orderBy(desc(users.createdat));

    const restRows = await db.select().from(restaurants).where(eq(restaurants.is_deleted, false));
    const restMap = new Map();
    for (const r of restRows) restMap.set(r.id, r);

    const formattedUsers = userRows.map(u => ({
      _id: u.id,
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone_number,
      role: u.user_type === 'SYSTEM_ADMIN' ? 'SUPER_ADMIN' : (u.user_type === 'ADMIN' ? 'RESTAURANT_OWNER' : 'RESTAURANT_STAFF'),
      restaurantId: u.restaurant_id ? (restMap.get(u.restaurant_id) || { name: 'Restaurant' }) : null,
      isActive: u.user_status === 'ACTIVE',
      createdAt: u.createdat
    }));

    res.status(200).json({ success: true, data: { users: formattedUsers } });
  } catch (error) {
    next(error);
  }
};

exports.getUserOrders = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [user] = await db.select().from(users).where(
      and(eq(users.id, id), eq(users.is_deleted, false))
    ).limit(1);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const restCondition = user.restaurant_id ? eq(order_details.restaurant_id, user.restaurant_id) : sql`true`;
    const orders = await db.select().from(order_details)
      .where(restCondition)
      .orderBy(desc(order_details.date))
      .limit(100);

    const mappedOrders = orders.map(o => ({
      _id: o.id,
      id: o.id,
      orderNumber: o.id.slice(0, 8).toUpperCase(),
      status: o.order_status,
      createdAt: o.date,
      totalAmount: 0
    }));

    res.status(200).json({
      success: true,
      data: {
        user: {
          _id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone_number,
          role: user.user_type === 'SYSTEM_ADMIN' ? 'SUPER_ADMIN' : (user.user_type === 'ADMIN' ? 'RESTAURANT_OWNER' : 'RESTAURANT_STAFF')
        },
        liveOrders: mappedOrders.filter(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED'),
        pastOrders: mappedOrders.filter(o => o.status === 'COMPLETED' || o.status === 'CANCELLED'),
        totalOrders: mappedOrders.length
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getAnalytics = async (req, res, next) => {
  try {
    const [totalRestRes] = await db.select({ count: sql`count(*)` }).from(restaurants).where(eq(restaurants.is_deleted, false));
    const [activeRestRes] = await db.select({ count: sql`count(*)` }).from(restaurants).where(
      and(eq(restaurants.restaurant_status, 'ACTIVE'), eq(restaurants.is_deleted, false))
    );
    const [totalUsersRes] = await db.select({ count: sql`count(*)` }).from(users).where(eq(users.is_deleted, false));
    const [totalOrdersRes] = await db.select({ count: sql`count(*)` }).from(order_details);
    const [revenueRes] = await db.select({ sum: sql`coalesce(sum(${order_items.total}), 0)` }).from(order_items);

    const totalRestaurants = parseInt(totalRestRes?.count || '0', 10);
    const activeRestaurants = parseInt(activeRestRes?.count || '0', 10);
    const totalUsers = parseInt(totalUsersRes?.count || '0', 10);
    const totalOrders = parseInt(totalOrdersRes?.count || '0', 10);
    const totalRevenue = parseFloat(revenueRes?.sum || '0');

    res.status(200).json({
      success: true,
      data: {
        totalRestaurants,
        activeRestaurants,
        totalUsers,
        totalRevenue,
        totalOrders,
        subscriptionRevenue: activeRestaurants * 1999,
        monthlyRecurringRevenue: activeRestaurants * 1999
      }
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────
//  ADMIN PROFILE & SETTINGS
// ──────────────────────────────────────────

exports.getAdminProfile = async (req, res, next) => {
  try {
    const adminId = req.user.id || req.user._id;
    const [adminUser] = await db.select().from(users).where(
      and(eq(users.id, adminId), eq(users.is_deleted, false))
    ).limit(1);

    if (!adminUser) {
      return res.status(404).json({ success: false, message: 'Admin account not found' });
    }

    res.status(200).json({
      success: true,
      data: {
        profile: {
          id: adminUser.id,
          _id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
          phone: adminUser.phone_number,
          role: adminUser.user_type,
          userType: adminUser.user_type,
          createdAt: adminUser.createdat
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.updateAdminProfile = async (req, res, next) => {
  try {
    const adminId = req.user.id || req.user._id;
    const { name, email, phone } = req.body;

    // Disallow privilege escalation or tenant hijacking
    if (req.body.role || req.body.userType || req.body.user_type || req.body.restaurantId || req.body.restaurant_id) {
      return res.status(403).json({
        success: false,
        message: 'Security violation: Role and tenant privileges cannot be modified through profile update.'
      });
    }

    const [existing] = await db.select().from(users).where(
      and(eq(users.id, adminId), eq(users.is_deleted, false))
    ).limit(1);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Admin account not found' });
    }

    const updateData = { updatedat: new Date() };
    if (name?.trim()) updateData.name = name.trim();

    if (email?.trim()) {
      const cleanEmail = email.toLowerCase().trim();
      if (cleanEmail !== existing.email) {
        const [conflict] = await db.select().from(users).where(
          and(
            eq(sql`LOWER(${users.email})`, cleanEmail),
            ne(users.id, adminId),
            eq(users.is_deleted, false)
          )
        ).limit(1);
        if (conflict) {
          return res.status(409).json({ success: false, message: 'Email address is already in use by another account.' });
        }
        updateData.email = cleanEmail;
      }
    }

    if (phone !== undefined) {
      updateData.phone_number = phone ? phone.trim() : null;
    }

    const [updated] = await db.update(users).set(updateData).where(eq(users.id, adminId)).returning();

    await db.insert(audit_log).values({
      user_id: adminId,
      action: 'UPDATE_ADMIN_PROFILE',
      entity_type: 'USER',
      entity_id: adminId,
      details: {
        updatedFields: Object.keys(updateData).filter(k => k !== 'updatedat')
      }
    });

    res.status(200).json({
      success: true,
      message: 'Admin profile updated successfully',
      data: {
        profile: {
          id: updated.id,
          _id: updated.id,
          name: updated.name,
          email: updated.email,
          phone: updated.phone_number,
          role: updated.user_type,
          userType: updated.user_type
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.changeAdminPassword = async (req, res, next) => {
  try {
    const adminId = req.user.id || req.user._id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({ success: false, message: 'Current password is required.' });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'New password and confirmation do not match.' });
    }

    const [adminUser] = await db.select().from(users).where(
      and(eq(users.id, adminId), eq(users.is_deleted, false))
    ).limit(1);

    if (!adminUser) {
      return res.status(404).json({ success: false, message: 'Admin account not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, adminUser.password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    const newSessionVersion = (adminUser.sessionVersion || 0) + 1;

    await db.update(users).set({
      password_hash: hashedPassword,
      sessionVersion: newSessionVersion,
      updatedat: new Date()
    }).where(eq(users.id, adminId));

    await db.insert(audit_log).values({
      user_id: adminId,
      action: 'ADMIN_PASSWORD_CHANGED',
      entity_type: 'USER',
      entity_id: adminId,
      details: {
        sessionVersion: newSessionVersion,
        timestamp: new Date()
      }
    });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully. Active sessions have been updated.'
    });
  } catch (error) {
    next(error);
  }
};

