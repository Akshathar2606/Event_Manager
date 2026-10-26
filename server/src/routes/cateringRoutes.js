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

const router = express.Router();

// Public / Authenticated Discovery
router.get('/', verifyToken, browseCateringServices);

// Vendor Self-Management (Owner-only endpoints restricted to 'vendor' role)
router.get('/my-profile', verifyToken, authorizeRoles('vendor'), getMyCateringProfile);
router.post('/', verifyToken, authorizeRoles('vendor'), createCateringProfile);
router.put('/my-profile', verifyToken, authorizeRoles('vendor'), updateMyCateringProfile);
router.patch('/my-profile/availability', verifyToken, authorizeRoles('vendor'), updateMyAvailability);

// Package Management (Vendor only)
router.post('/my-profile/packages', verifyToken, authorizeRoles('vendor'), addPackage);
router.put('/my-profile/packages/:packageId', verifyToken, authorizeRoles('vendor'), updatePackage);
router.delete('/my-profile/packages/:packageId', verifyToken, authorizeRoles('vendor'), archivePackage);

// Single Service View (Placed after /my-profile so literal string route matches first)
router.get('/:id', verifyToken, getCateringServiceById);

module.exports = router;
