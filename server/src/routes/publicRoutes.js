const express = require('express');
const publicController = require('../controllers/publicController');
const rateLimit = require('express-rate-limit');
const { checkSubscription } = require('../middlewares/subscriptionMiddleware');

const router = express.Router();

// Strict rate limit for order creation (anti-spam)
const orderLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  message: { success: false, message: 'Too many orders placed. Please wait a moment.' }
});

// Rate limit for table allocation & verification attempts
const allocationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many table allocation attempts. Please wait a moment.' }
});

// QR resolution & Table Occupation
router.get('/qr/:qrToken', publicController.getTableByQR);
router.get('/table/:tableNumber', publicController.getTableByNumber);
router.post('/tables/verify-location', allocationLimiter, publicController.verifyTableLocation);
router.post('/tables/start-session', allocationLimiter, publicController.startTableSession);

// Active Dining Visit Bill & Orders
router.get('/visit/bill', publicController.getVisitBill);
router.get('/visit/orders', publicController.getVisitOrders);

// Menu (subdomain-based) - check subscription
router.get('/menu', checkSubscription, publicController.getMenu);

// Legacy: menu by slug - check subscription
router.get('/restaurant/:slug/menu', checkSubscription, publicController.getRestaurantMenu);

// Orders - check subscription
router.post('/orders', orderLimiter, checkSubscription, publicController.createOrder);

// Allow customer to fetch their orders (live + past) by orderIds or tableId
router.get('/orders', publicController.getCustomerOrders);

// Allow fetching an existing order even if expired, since customers may need to see their bill
router.get('/orders/:orderId', publicController.getOrder);

// Customer Service Requests (Call waiter, water, bill, cutlery)
router.post('/service-requests', checkSubscription, publicController.createServiceRequest);

// Public active subscription plans
router.get('/plans', (req, res) => {
  const { getPublicPlans } = require('../config/plans');
  res.status(200).json({ success: true, data: { plans: getPublicPlans() } });
});

// Advertisement Inquiry
router.post('/advertise', publicController.createAdInquiry);

// Public Menu Banners / Ads
router.get('/banners', publicController.getBanners);
router.get('/ads', publicController.getBanners);

module.exports = router;
