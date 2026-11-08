const express = require('express');
const {
  browseCateringServices,
  getCateringServiceById,
  getMyCateringProfile,
  createCateringProfile,
  updateMyCateringProfile,
  updateMyAvailability,
  addPackage,
  updatePackage,
  archivePackage
} = require('../controllers/cateringController');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { requireApprovedVendor } = require('../middleware/vendorApprovalMiddleware');

const router = express.Router();

// Public / Authenticated Discovery
router.get('/', verifyToken, browseCateringServices);

// Vendor Self-Management (Owner-only endpoints restricted to 'vendor' role)
router.get('/my-profile', verifyToken, authorizeRoles('vendor'), requireApprovedVendor, getMyCateringProfile);
router.post('/', verifyToken, authorizeRoles('vendor'), requireApprovedVendor, createCateringProfile);
router.put('/my-profile', verifyToken, authorizeRoles('vendor'), requireApprovedVendor, updateMyCateringProfile);
router.patch('/my-profile/availability', verifyToken, authorizeRoles('vendor'), requireApprovedVendor, updateMyAvailability);

// Package Management (Vendor only)
router.post('/my-profile/packages', verifyToken, authorizeRoles('vendor'), requireApprovedVendor, addPackage);
router.put('/my-profile/packages/:packageId', verifyToken, authorizeRoles('vendor'), requireApprovedVendor, updatePackage);
router.delete('/my-profile/packages/:packageId', verifyToken, authorizeRoles('vendor'), requireApprovedVendor, archivePackage);

// Single Service View (Placed after /my-profile so literal string route matches first)
router.get('/:id', verifyToken, getCateringServiceById);

module.exports = router;
