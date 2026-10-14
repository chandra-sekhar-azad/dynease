const User = require('../models/User'); // Platform admin users
const Restaurant = require('../models/Restaurant'); // Keep for backward compat for now
const RestaurantRegistration = require('../models/platform/RestaurantRegistration');
const RestaurantRegistry = require('../models/platform/RestaurantRegistry');
const RestaurantProvisioningService = require('../services/RestaurantProvisioningService');
const Order = require('../models/Order');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const whatsapp = require('../utils/whatsapp');
const TenantDatabaseManager = require('../services/TenantDatabaseManager');
const bcrypt = require('bcrypt');

exports.createRestaurant = async (req, res, next) => {
  try {
    const { restaurantName, ownerName, ownerEmail, ownerPhone, ownerPassword } = req.body;

    if (!restaurantName || !ownerName || !ownerEmail || !ownerPassword) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields.' });
    }

    // Check if the owner email is already taken in the global registry
    const existingRegistry = await RestaurantRegistry.findOne({ ownerEmail });
    if (existingRegistry) {
      return res.status(409).json({ success: false, message: 'A restaurant with this owner email already exists.' });
    }

    // Generate a unique subdomain
    let baseSlug = restaurantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    let slug = baseSlug;
    let slugExists = await RestaurantRegistry.findOne({ subdomain: slug });
    let counter = 1;
    
    while (slugExists) {
      slug = `${baseSlug}-${counter}`;
      slugExists = await RestaurantRegistry.findOne({ subdomain: slug });
      counter++;
    }
    
    const hashedPassword = await bcrypt.hash(ownerPassword, 12);

    const registrationMock = {
      restaurantName,
      restaurantType: 'Restaurant',
      subdomain: slug,
      ownerName,
      ownerPhone,
      ownerEmail,
      ownerPassword: hashedPassword,
      selectedPlan: 'FREE'
    };

    const registry = await RestaurantProvisioningService.provisionRestaurant(registrationMock);

    res.status(201).json({
      success: true,
      message: 'Restaurant and Owner account created successfully.',
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
    const restaurants = await RestaurantRegistry.find().sort({ createdAt: -1 });
    const now = new Date();
    // Map to expected format to not break the frontend and include billing details
    const mapped = restaurants.map(r => {
      let daysRemaining = 0;
      if (r.subscriptionEndDate) {
        const diff = new Date(r.subscriptionEndDate) - now;
        daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
      }

      return {
        _id: r.restaurantId,
        name: r.restaurantName,
        slug: r.slug,
        subdomain: r.subdomain,
        databaseName: r.databaseName,
        status: r.status,
        selectedPlan: r.selectedPlan,
        subscriptionStatus: r.subscriptionStatus,
        subscriptionStartDate: r.subscriptionStartDate,
        subscriptionEndDate: r.subscriptionEndDate,
        daysRemaining,
        lastPaymentAt: r.lastPaymentAt,
        paymentStatus: r.paymentStatus,
        renewalHistory: r.renewalHistory || [],
        renewalRequest: r.renewalRequest,
        googleReviewLink: r.googleReviewLink || '',
        createdAt: r.createdAt,
        ownerId: {
          name: r.ownerName || 'Owner', 
          email: r.ownerEmail,
          phone: r.ownerPhone
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

exports.getPendingRequests = async (req, res, next) => {
  try {
    const requests = await RestaurantRegistration.find({ status: 'PENDING_APPROVAL' });
    // Map to frontend expected format
    const formattedRequests = requests.map(req => ({
      _id: req._id,
      name: req.restaurantName,
      type: req.restaurantType,
      slug: req.subdomain,
      status: req.status,
      selectedPlan: req.selectedPlan,
      createdAt: req.createdAt,
      ownerId: {
        name: req.ownerName,
        email: req.ownerEmail,
        phone: req.ownerPhone
      }
    }));
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
    
    const registration = await RestaurantRegistration.findById(id);
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration request not found' });
    }

    if (registration.status === 'APPROVED') {
      return res.status(400).json({ success: false, message: 'Registration is already approved' });
    }

    // Provision Tenant Database
    const registry = await RestaurantProvisioningService.provisionRestaurant(registration);

    // Remove from requests collection once approved and moved to details
    await RestaurantRegistration.findByIdAndDelete(id);

    if (registration.ownerPhone) {
      try {
        const loginUrl = `https://${registry.subdomain}.dynease.in/login`;
        const message = `🎉 Your restaurant has been approved!\n\nRestaurant: ${registry.restaurantName}\nPlan: ${registry.selectedPlan}\n\nYour restaurant account is now active.\n\nRestaurant URL:\nhttps://${registry.subdomain}.dynease.in\n\nLogin to Dashboard:\n${loginUrl}\n\nYou can now configure your menu, tables and QR codes.`;
        await whatsapp.sendTextMessage(registration.ownerPhone, message);
      } catch (waError) {
        console.error('Failed to send WhatsApp approval notification:', waError.message);
      }
    }

    res.status(200).json({ success: true, message: 'Restaurant approved and database provisioned successfully', data: { registry } });
  } catch (error) {
    next(error);
  }
};

exports.rejectRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user ? req.user.id : null;

    const registration = await RestaurantRegistration.findByIdAndUpdate(id, { 
      status: 'REJECTED', 
    }, { new: true });
    
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    res.status(200).json({ success: true, message: 'Restaurant rejected successfully' });
  } catch (error) {
    next(error);
  }
};

exports.suspendRestaurant = async (req, res, next) => {
  try {
    const { id } = req.params;
    const restaurant = await RestaurantRegistry.findOneAndUpdate({ restaurantId: id }, { status: 'SUSPENDED' }, { new: true });
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }
    
    // Also update tenant DB
    try {
      const tenantDb = await TenantDatabaseManager.getConnection(restaurant.databaseName);
      const RestaurantProfile = tenantDb.model('RestaurantProfile');
      await RestaurantProfile.findOneAndUpdate({ restaurantId: id }, { isActive: false });
    } catch (e) {
      console.error('Failed to suspend tenant DB profile:', e);
    }
    
    res.status(200).json({ success: true, message: 'Restaurant suspended successfully' });
  } catch (error) {
    next(error);
  }
};

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
    const users = await User.find().populate('restaurantId', 'name');
    res.status(200).json({ success: true, data: { users } });
  } catch (error) {
    next(error);
  }
};

exports.getAnalytics = async (req, res, next) => {
  try {
    const totalRestaurants = await RestaurantRegistry.countDocuments();
    const activeRestaurants = await RestaurantRegistry.countDocuments({ status: 'ACTIVE' });
    
    // We don't have a global User count anymore since staff is split. Just counting registries for now.
    const totalUsers = activeRestaurants; 
    
    // Calculate total revenue and total orders by querying all active tenant DBs
    let totalRevenue = 0;
    let totalOrders = 0;

    const activeRegistries = await RestaurantRegistry.find({ status: 'ACTIVE' });
    for (const registry of activeRegistries) {
      try {
        const tenantDb = await TenantDatabaseManager.getConnection(registry.databaseName);
        const Order = tenantDb.model('Order');
        const orders = await Order.find({ paymentStatus: 'PAID' });
        totalRevenue += orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
        totalOrders += await Order.countDocuments();
      } catch (err) {
        console.error(`Failed to get analytics for tenant ${registry.databaseName}:`, err);
      }
    }

    // Calculate recorded subscription revenue from invoices and renewal histories
    const PlatformInvoice = require('../models/platform/PlatformInvoice');
    const invoices = await PlatformInvoice.find({ status: 'PAID' });
    const invoiceRevenue = invoices.reduce((sum, inv) => sum + (inv.amountRupees || 0), 0);

    // Also include history records from registries as fallback
    let historyRevenue = 0;
    const allRegistries = await RestaurantRegistry.find();
    allRegistries.forEach(r => {
      (r.renewalHistory || []).forEach(h => {
        if (h.amount && typeof h.amount === 'number') {
          historyRevenue += h.amount;
        }
      });
    });
    const subscriptionRevenue = Math.max(invoiceRevenue, historyRevenue);

    res.status(200).json({
      success: true,
      data: {
        totalRestaurants,
        activeRestaurants,
        totalUsers,
        totalRevenue,
        totalOrders,
        subscriptionRevenue,
        monthlyRecurringRevenue: activeRestaurants * 1999 // Estimated run-rate
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.updateRestaurant = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      subscriptionPlan, 
      isActive, 
      ownerEmail, 
      ownerName, 
      ownerPhone, 
      subdomain, 
      googleReviewLink,
      billingDaysRemaining,
      daysRemaining,
      subscriptionEndDate,
      subscriptionStartDate,
      subscriptionStatus
    } = req.body;
    
    const existingRestaurant = await RestaurantRegistry.findOne({ restaurantId: id });
    if (!existingRestaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    const status = isActive !== undefined ? (isActive ? 'ACTIVE' : 'SUSPENDED') : existingRestaurant.status;
    const updateData = {};
    if (name) updateData.restaurantName = name;
    if (subscriptionPlan) updateData.selectedPlan = subscriptionPlan;
    if (status) updateData.status = status;
    if (googleReviewLink !== undefined) updateData.googleReviewLink = googleReviewLink;
    
    // Reset subscription dates and status if the admin changes the plan OR approves a renewal request
    const hasPendingRenewal = existingRestaurant.renewalRequest && existingRestaurant.renewalRequest.status === 'PENDING';
    const isPlanChanged = subscriptionPlan && subscriptionPlan !== existingRestaurant.selectedPlan;

    if (isPlanChanged || hasPendingRenewal) {
      const targetPlan = subscriptionPlan || existingRestaurant.renewalRequest?.plan || existingRestaurant.selectedPlan;
      updateData.selectedPlan = targetPlan;
      const now = new Date();
      updateData.subscriptionStartDate = now;
      
      const newEnd = new Date(now);
      if (targetPlan === 'FREE') {
        newEnd.setDate(newEnd.getDate() + 14);
        updateData.subscriptionStatus = 'TRIAL';
      } else {
        newEnd.setDate(newEnd.getDate() + 30);
        updateData.subscriptionStatus = 'ACTIVE';
      }
      updateData.subscriptionEndDate = newEnd;
      updateData.remindersSent = {
        sevenDay: false,
        threeDay: false,
        oneDay: false,
        expired: false
      };
      
      const newHistoryItem = {
        plan: targetPlan,
        amount: targetPlan === 'GROWTH' ? 1499 : targetPlan === 'PRO' ? 2499 : 0,
        date: now,
        transactionId: hasPendingRenewal ? 'RENEWAL_APPROVED' : 'ADMIN_MANUAL_UPDATE'
      };

      if (!existingRestaurant.renewalHistory) {
        existingRestaurant.renewalHistory = [];
      }
      existingRestaurant.renewalHistory.push(newHistoryItem);
      updateData.renewalHistory = existingRestaurant.renewalHistory;
      updateData.$unset = { renewalRequest: 1 };
    }

    // Handle manual billing days remaining override
    const effectiveDays = billingDaysRemaining !== undefined ? billingDaysRemaining : daysRemaining;
    if (effectiveDays !== undefined && effectiveDays !== null && effectiveDays !== '') {
      const days = parseInt(effectiveDays, 10);
      if (!isNaN(days)) {
        const newEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        updateData.subscriptionEndDate = newEnd;
        if (!updateData.subscriptionStartDate && !existingRestaurant.subscriptionStartDate) {
          updateData.subscriptionStartDate = new Date();
        }
        if (days > 0) {
          if (!subscriptionStatus && (existingRestaurant.subscriptionStatus === 'EXPIRED' || existingRestaurant.subscriptionStatus === 'PENDING')) {
            updateData.subscriptionStatus = (updateData.selectedPlan || existingRestaurant.selectedPlan) === 'FREE' ? 'TRIAL' : 'ACTIVE';
          }
        } else {
          if (!subscriptionStatus) {
            updateData.subscriptionStatus = 'EXPIRED';
          }
        }
        updateData.remindersSent = { sevenDay: false, threeDay: false, oneDay: false, expired: false };
      }
    } else if (subscriptionEndDate) {
      const parsedEnd = new Date(subscriptionEndDate);
      if (!isNaN(parsedEnd.getTime())) {
        updateData.subscriptionEndDate = parsedEnd;
        updateData.remindersSent = { sevenDay: false, threeDay: false, oneDay: false, expired: false };
      }
    }

    if (subscriptionStatus && ['PENDING', 'TRIAL', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED'].includes(subscriptionStatus)) {
      updateData.subscriptionStatus = subscriptionStatus;
    }

    if (subscriptionStartDate) {
      const parsedStart = new Date(subscriptionStartDate);
      if (!isNaN(parsedStart.getTime())) {
        updateData.subscriptionStartDate = parsedStart;
      }
    }

    if (ownerEmail) updateData.ownerEmail = ownerEmail;
    if (ownerName) updateData.ownerName = ownerName;
    if (ownerPhone) updateData.ownerPhone = ownerPhone;
    
    if (subdomain) {
      const existing = await RestaurantRegistry.findOne({ subdomain, restaurantId: { $ne: id } });
      if (existing) {
        return res.status(409).json({ success: false, message: 'This subdomain is already taken.' });
      }
      updateData.subdomain = subdomain;
      updateData.slug = subdomain;
    }

    const restaurant = await RestaurantRegistry.findOneAndUpdate(
      { restaurantId: id },
      updateData,
      { new: true, runValidators: true }
    );
    
    // Update tenant DB
    try {
      const tenantDb = await TenantDatabaseManager.getConnection(restaurant.databaseName);
      const RestaurantProfile = tenantDb.model('RestaurantProfile');
      const profileUpdateData = {};
      if (name) profileUpdateData.name = name;
      if (isActive !== undefined) profileUpdateData.isActive = isActive;
      if (subdomain) profileUpdateData.slug = subdomain;
      if (googleReviewLink !== undefined) profileUpdateData.googleReviewLink = googleReviewLink;
      if (Object.keys(profileUpdateData).length > 0) {
        await RestaurantProfile.findOneAndUpdate({ restaurantId: id }, profileUpdateData);
      }

      if (ownerEmail || ownerName || ownerPhone) {
        const TenantUser = tenantDb.model('User');
        const userUpdateData = {};
        if (ownerEmail) userUpdateData.email = ownerEmail;
        if (ownerName) userUpdateData.name = ownerName;
        if (ownerPhone) userUpdateData.phone = ownerPhone;
        await TenantUser.findOneAndUpdate({ role: 'RESTAURANT_OWNER' }, userUpdateData);
      }
    } catch (e) {
      console.error('Failed to update tenant DB profile:', e);
    }
    
    let calculatedDaysRemaining = 0;
    if (restaurant.subscriptionEndDate) {
      const diff = new Date(restaurant.subscriptionEndDate) - new Date();
      calculatedDaysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    res.status(200).json({ 
      success: true, 
      message: 'Restaurant updated successfully', 
      data: { 
        restaurant: {
          ...restaurant.toObject(),
          daysRemaining: calculatedDaysRemaining
        }
      } 
    });
  } catch (error) {
    next(error);
  }
};

exports.updateRestaurantBilling = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { daysRemaining, subscriptionEndDate, subscriptionStatus, selectedPlan, note, amount } = req.body;
    
    const registry = await RestaurantRegistry.findOne({ restaurantId: id });
    if (!registry) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    const now = new Date();
    const updateData = {};

    if (selectedPlan) {
      const { getPlan } = require('../config/plans');
      const resolved = getPlan(selectedPlan);
      if (resolved) {
        updateData.selectedPlan = resolved.planId;
      }
    }

    if (daysRemaining !== undefined && daysRemaining !== null && daysRemaining !== '') {
      const days = parseInt(daysRemaining, 10);
      if (!isNaN(days)) {
        const newEndDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        updateData.subscriptionEndDate = newEndDate;
        if (!registry.subscriptionStartDate) {
          updateData.subscriptionStartDate = now;
        }
        if (days > 0) {
          if (!subscriptionStatus && (registry.subscriptionStatus === 'EXPIRED' || registry.subscriptionStatus === 'PENDING')) {
            updateData.subscriptionStatus = (updateData.selectedPlan || registry.selectedPlan) === 'FREE' ? 'TRIAL' : 'ACTIVE';
          }
        } else {
          if (!subscriptionStatus) {
            updateData.subscriptionStatus = 'EXPIRED';
          }
        }
      }
    } else if (subscriptionEndDate) {
      const parsedEnd = new Date(subscriptionEndDate);
      if (!isNaN(parsedEnd.getTime())) {
        updateData.subscriptionEndDate = parsedEnd;
        if (parsedEnd > now && (registry.subscriptionStatus === 'EXPIRED' || registry.subscriptionStatus === 'PENDING')) {
          if (!subscriptionStatus) {
            updateData.subscriptionStatus = (updateData.selectedPlan || registry.selectedPlan) === 'FREE' ? 'TRIAL' : 'ACTIVE';
          }
        }
      }
    }

    if (subscriptionStatus && ['PENDING', 'TRIAL', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED'].includes(subscriptionStatus)) {
      updateData.subscriptionStatus = subscriptionStatus;
    }

    updateData.remindersSent = {
      sevenDay: false,
      threeDay: false,
      oneDay: false,
      expired: false
    };

    // Record in renewalHistory
    const historyItem = {
      plan: updateData.selectedPlan || registry.selectedPlan,
      amount: amount || (updateData.selectedPlan === 'GROWTH' ? 1499 : updateData.selectedPlan === 'PRO' ? 2499 : 0),
      date: now,
      transactionId: note || `ADMIN_BILLING_ADJUSTMENT_${daysRemaining !== undefined ? daysRemaining + 'D' : 'DATE'}`
    };

    if (!registry.renewalHistory) registry.renewalHistory = [];
    registry.renewalHistory.push(historyItem);
    updateData.renewalHistory = registry.renewalHistory;
    updateData.$unset = { renewalRequest: 1 };

    const updated = await RestaurantRegistry.findOneAndUpdate(
      { restaurantId: id },
      updateData,
      { new: true }
    );

    let calculatedDaysRemaining = 0;
    if (updated.subscriptionEndDate) {
      const diff = new Date(updated.subscriptionEndDate) - new Date();
      calculatedDaysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    res.status(200).json({
      success: true,
      message: 'Subscription & billing updated successfully',
      data: {
        restaurant: {
          ...updated.toObject(),
          daysRemaining: calculatedDaysRemaining
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
    const restaurant = await RestaurantRegistry.findOneAndDelete({ restaurantId: id });
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }
    // Note: To completely delete, we'd drop the tenant DB. For now, removing the registry entry disables access.
    try {
       const tenantDb = await TenantDatabaseManager.getConnection(restaurant.databaseName);
       if (tenantDb) await tenantDb.dropDatabase();
    } catch (e) {
       console.error('Failed to drop tenant database:', e);
    }

    res.status(200).json({ success: true, message: 'Restaurant deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.sendCredentials = async (req, res, next) => {
  try {
    const { id } = req.params;
    const registry = await RestaurantRegistry.findOne({ restaurantId: id });
    if (!registry || !registry.ownerEmail) {
      return res.status(404).json({ success: false, message: 'Restaurant or owner not found' });
    }

    const tenantDb = await TenantDatabaseManager.getConnection(registry.databaseName);
    const TenantUser = tenantDb.model('User');
    const user = await TenantUser.findOne({ email: registry.ownerEmail });
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'Owner user not found in tenant database' });
    }

    const tempPassword = 'Welcome' + Math.floor(1000 + Math.random() * 9000) + '!';
    user.password = tempPassword;
    await user.save();

    let waSent = false;
    if (user.phone) {
      try {
        const loginUrl = `https://${registry.subdomain}.dynease.in/login`;
        const message = `🎉 Your login credentials have been created/reset!\n\nYou can login at: ${loginUrl}\n\nYour login credentials:\nMobile Number: ${user.phone}\nPassword: ${tempPassword}`;
        await whatsapp.sendTextMessage(user.phone, message);
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

exports.getPlans = async (req, res, next) => {
  try {
    const { getPublicPlans } = require('../config/plans');
    const plans = getPublicPlans();
    res.status(200).json({ success: true, data: { plans } });
  } catch (error) {
    next(error);
  }
};

exports.createPlan = async (req, res, next) => {
  try {
    const { name, price, description, features } = req.body;
    const plan = await SubscriptionPlan.create({ name, price, description, features });
    res.status(201).json({ success: true, message: 'Plan created successfully', data: { plan } });
  } catch (error) {
    next(error);
  }
};

const Ad = require('../models/platform/Ad');

exports.getAds = async (req, res, next) => {
  try {
    const ads = await Ad.find().sort('-createdAt');
    res.status(200).json({ success: true, data: { ads } });
  } catch (error) {
    next(error);
  }
};

exports.createAd = async (req, res, next) => {
  try {
    const { title, subtitle, badge, buttonText, rightBadge, imageUrl, targetUrl, status, restaurantId } = req.body;
    const ad = await Ad.create({ title, subtitle, badge, buttonText, rightBadge, imageUrl, targetUrl, status, restaurantId });
    res.status(201).json({ success: true, message: 'Banner created successfully', data: { ad } });
  } catch (error) {
    next(error);
  }
};

exports.updateAd = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ad = await Ad.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!ad) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }
    res.status(200).json({ success: true, message: 'Ad updated successfully', data: { ad } });
  } catch (error) {
    next(error);
  }
};

exports.deleteAd = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ad = await Ad.findByIdAndDelete(id);
    if (!ad) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }
    res.status(200).json({ success: true, message: 'Ad deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const AdvertisementInquiry = require('../models/platform/AdvertisementInquiry');

exports.getAdInquiries = async (req, res, next) => {
  try {
    const inquiries = await AdvertisementInquiry.find().sort('-createdAt');
    res.status(200).json({ success: true, data: { inquiries } });
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

    const inquiry = await AdvertisementInquiry.create({
      name,
      mobileNumber,
      businessName,
      email: email || '',
      city: city || '',
      message: message || '',
      status: 'NEW'
    });

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
  try {
    const { id } = req.params;
    const { status } = req.body;
    const inquiry = await AdvertisementInquiry.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );
    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Inquiry not found' });
    }
    res.status(200).json({ success: true, message: 'Status updated successfully', data: { inquiry } });
  } catch (error) {
    next(error);
  }
};

exports.deleteAdInquiry = async (req, res, next) => {
  try {
    const { id } = req.params;
    const inquiry = await AdvertisementInquiry.findByIdAndDelete(id);
    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Inquiry not found' });
    }
    res.status(200).json({ success: true, message: 'Inquiry deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.changeAdminPassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'New password and confirmation do not match.' });
    }

    // Identify user from auth header or req.user
    let adminUser = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer')) {
      const token = authHeader.split(' ')[1];
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod');
        if (decoded && decoded.id) {
          adminUser = await User.findById(decoded.id).select('+password');
        }
      } catch (err) {
        // Token invalid or expired, continue to fallback
      }
    }

    if (!adminUser && req.user && (req.user.id || req.user._id)) {
      adminUser = await User.findById(req.user.id || req.user._id).select('+password');
    }

    // Fallback: locate Super Admin user
    if (!adminUser) {
      adminUser = await User.findOne({ role: 'SUPER_ADMIN' }).select('+password');
    }

    if (!adminUser) {
      return res.status(404).json({ success: false, message: 'Admin account not found in system.' });
    }

    // If current password provided, verify it
    if (currentPassword) {
      const isMatch = await adminUser.comparePassword(currentPassword, adminUser.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
      }
    }

    // Update password (Mongoose pre-save hook will hash it with bcrypt)
    adminUser.password = newPassword;
    await adminUser.save();

    // Also update PostgreSQL users table if pool is available
    try {
      const { pool } = require('../db/client');
      if (pool) {
        const bcrypt = require('bcrypt');
        const hash = await bcrypt.hash(newPassword, 12);
        await pool.query(
          `UPDATE users SET password = $1 WHERE LOWER(email) = LOWER($2) OR user_type = 'SYSTEM_ADMIN'`,
          [hash, adminUser.email]
        );
      }
    } catch (pgError) {
      console.warn('[ChangeAdminPassword] PostgreSQL sync skipped:', pgError.message);
    }

    res.status(200).json({
      success: true,
      message: 'Password has been updated successfully.'
    });
  } catch (error) {
    next(error);
  }
};

