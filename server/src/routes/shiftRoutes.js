const express = require('express');
const rosterController = require('../controllers/rosterController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
// Viewing shifts is allowed for all restaurant users; editing is owner-only
router.get('/', restrictTo('RESTAURANT_OWNER', 'RESTAURANT_STAFF'), rosterController.getShifts);
router.post('/', restrictTo('RESTAURANT_OWNER'), rosterController.createShift);
router.put('/:id', restrictTo('RESTAURANT_OWNER'), rosterController.updateShift);
router.delete('/:id', restrictTo('RESTAURANT_OWNER'), rosterController.deleteShift);

module.exports = router;
