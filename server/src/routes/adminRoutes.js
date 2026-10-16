const express = require('express');
const adminController = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// Public routes (ad inquiries submission from website)
router.post('/ad-inquiries', adminController.createAdInquiry);

// Protected system admin routes
router.use(protect);
router.use(restrictTo('SUPER_ADMIN', 'SYSTEM_ADMIN'));

// Admin Profile & Settings
router.get('/profile', adminController.getAdminProfile);
router.put('/profile', adminController.updateAdminProfile);
router.put('/change-password', adminController.changeAdminPassword);

// Restaurants Management
router.post('/restaurants', adminController.createRestaurant);
router.get('/restaurants', adminController.getAllRestaurants);
router.put('/restaurants/:id', adminController.updateRestaurant);
router.put('/restaurants/:id/billing', adminController.updateRestaurantBilling);
router.delete('/restaurants/:id', adminController.deleteRestaurant);

// Registration Requests
router.get('/requests', adminController.getPendingRequests);
router.post('/requests/:id/approve', adminController.approveRequest);
router.post('/requests/:id/reject', adminController.rejectRequest);
router.post('/requests/:id/suspend', adminController.suspendRestaurant);

// Send login credentials to restaurant owner via WhatsApp
router.post('/restaurants/:id/send-credentials', adminController.sendCredentials);

// Subscription Plans
router.get('/plans', adminController.getPlans);
router.post('/plans', adminController.createPlan);
router.put('/plans/:id', adminController.updatePlan);
router.delete('/plans/:id', adminController.deletePlan);

// Plan Change Requests
router.get('/plan-requests', adminController.getPlanRequests);
router.post('/plan-requests/:id/approve', adminController.approvePlanRequest);
router.post('/plan-requests/:id/reject', adminController.rejectPlanRequest);

// Ads Management
router.get('/ads', adminController.getAds);
router.post('/ads', adminController.createAd);
router.put('/ads/:id', adminController.updateAd);
router.delete('/ads/:id', adminController.deleteAd);

// Advertisement Inquiries
router.get('/ad-inquiries', adminController.getAdInquiries);
router.patch('/ad-inquiries/:id', adminController.updateAdInquiryStatus);
router.delete('/ad-inquiries/:id', adminController.deleteAdInquiry);

// Custom WhatsApp message
router.post('/whatsapp/send', adminController.sendCustomMessage);

// Users & Analytics
router.get('/users', adminController.getAllUsers);
router.get('/users/:id/orders', adminController.getUserOrders);
router.get('/analytics', adminController.getAnalytics);

module.exports = router;
