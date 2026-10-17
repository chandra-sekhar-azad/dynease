const express = require('express');
const rosterController = require('../controllers/rosterController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
// Restaurant owners and staff can view; only owners can modify (enforced per-route)
router.use(restrictTo('RESTAURANT_OWNER', 'RESTAURANT_STAFF'));

router.get('/', rosterController.getRosters);
router.post('/', restrictTo('RESTAURANT_OWNER'), rosterController.upsertRoster);
router.delete('/:id', restrictTo('RESTAURANT_OWNER'), rosterController.deleteRoster);

module.exports = router;
