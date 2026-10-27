const express = require('express');
const {
  createCateringRequest,
  getOrganizerCateringRequests,
  getVendorCateringRequests,
  getCateringRequestById,
  acceptCateringRequest,
  rejectCateringRequest,
  cancelCateringRequest
} = require('../controllers/cateringRequestController');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

// 1. Create Catering Request: Strictly restricted to Event Organizer
router.post('/', verifyToken, authorizeRoles('organizer'), createCateringRequest);

// 2. Organizer Personal Requests Listing (Organizers view own; Administrators can inspect)
router.get('/', verifyToken, authorizeRoles('organizer', 'administrator'), getOrganizerCateringRequests);

// 3. Vendor Incoming Requests Listing (Vendors view own; Administrators can inspect)
router.get('/incoming', verifyToken, authorizeRoles('vendor', 'administrator'), getVendorCateringRequests);

// 4. Single Request Detail: Accessible by the request organizer, recipient vendor, or admin
router.get('/:id', verifyToken, getCateringRequestById);

// 5. Vendor Decisions: Strictly restricted to assigned Vendor (Administrators cannot decide)
router.patch('/:id/accept', verifyToken, authorizeRoles('vendor'), acceptCateringRequest);
router.patch('/:id/reject', verifyToken, authorizeRoles('vendor'), rejectCateringRequest);

// 6. Organizer Cancellation: Strictly restricted to Event Organizer
router.patch('/:id/cancel', verifyToken, authorizeRoles('organizer'), cancelCateringRequest);

module.exports = router;
