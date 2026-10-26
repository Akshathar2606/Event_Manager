const express = require('express');
const {
  getVenues,
  getVenueById,
  createVenue,
  updateVenue,
  updateVenueStatus,
  deleteVenue
} = require('../controllers/venueController');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

// Read routes: Accessible to any authenticated user (Admin, Organizer, Participant, Vendor)
router.get('/', verifyToken, getVenues);
router.get('/:id', verifyToken, getVenueById);

// Administrative mutation routes: Strictly restricted to Administrator
router.post('/', verifyToken, authorizeRoles('administrator'), createVenue);
router.put('/:id', verifyToken, authorizeRoles('administrator'), updateVenue);
router.patch('/:id/status', verifyToken, authorizeRoles('administrator'), updateVenueStatus);
router.delete('/:id', verifyToken, authorizeRoles('administrator'), deleteVenue);

module.exports = router;
