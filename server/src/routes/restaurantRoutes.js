const express = require('express');
const multer = require('multer');
const restaurantController = require('../controllers/restaurantController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(protect);
router.use(restrictTo('RESTAURANT_OWNER', 'RESTAURANT_STAFF'));

// ── Category routes ──
router.get('/categories', restaurantController.getCategories);
router.post('/categories', upload.single('image'), restaurantController.createCategory);
router.put('/categories/:id', upload.single('image'), restaurantController.updateCategory);
router.delete('/categories/:id', restaurantController.deleteCategory);

// ── Menu item routes ──
router.post('/menu', upload.single('image'), restaurantController.createMenuItem);
router.put('/menu/:id', upload.single('image'), restaurantController.updateMenuItem);
router.get('/menu', restaurantController.getMenu);
router.delete('/menu/:id', restaurantController.deleteMenuItem);
router.patch('/menu/:id/status', restaurantController.toggleMenuItemStatus);

// ── Order routes ──
router.get('/orders', restaurantController.getOrders);
router.patch('/orders/:id/status', restaurantController.updateOrderStatus);
router.patch('/orders/:id/accept', restaurantController.acceptOrder);
router.patch('/orders/:id/reject', restaurantController.rejectOrder);
router.patch('/orders/:id/reassign', restrictTo('RESTAURANT_OWNER'), restaurantController.reassignOrder);
router.post('/orders/:id/items', restaurantController.addOrderItems);
router.patch('/orders/items/:id/quantity', restaurantController.updateOrderItemQuantity);
router.delete('/orders/items/:id', restaurantController.deleteOrderItem);
router.post('/tables/:tableId/cancel-allocation', restaurantController.cancelTableAllocation);
router.post('/visits/:id/complete', restaurantController.completeVisit);

// ── Assignment & Workload routes ──
router.get('/assignment/settings', restaurantController.getAssignmentSettings);
router.put('/assignment/settings', restrictTo('RESTAURANT_OWNER'), restaurantController.updateAssignmentSettings);
router.get('/assignment/history', restaurantController.getAssignmentHistory);
router.get('/waiters/workload', restaurantController.getWaitersWorkload);
router.patch('/waiters/my-availability', restaurantController.updateMyAvailability);

// ── Service Request routes ──
router.get('/service-requests', restaurantController.getServiceRequests);
router.patch('/service-requests/:id/resolve', restaurantController.resolveServiceRequest);

// ── Stats routes ──
router.get('/stats', restrictTo('RESTAURANT_OWNER'), restaurantController.getStats);

// ── Profile routes ──
router.get('/profile', restrictTo('RESTAURANT_OWNER'), restaurantController.getProfile);
router.put('/profile', restrictTo('RESTAURANT_OWNER'), restaurantController.updateProfile);

// ── Subscription routes ──
router.get('/subscription', restrictTo('RESTAURANT_OWNER'), restaurantController.getSubscription);
router.post('/subscription/renew', restrictTo('RESTAURANT_OWNER'), restaurantController.renewSubscription);

module.exports = router;
