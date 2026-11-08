const express = require('express');
const {
  listVendorApplications,
  approveVendorApplication,
  rejectVendorApplication
} = require('../controllers/vendorApplicationController');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(verifyToken, authorizeRoles('administrator'));
router.get('/', listVendorApplications);
router.patch('/:id/approve', approveVendorApplication);
router.patch('/:id/reject', rejectVendorApplication);

module.exports = router;
