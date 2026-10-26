const express = require('express');
const {
  createBooking,
  getBookings,
  getBookingById,
  approveBooking,
  rejectBooking,
  cancelBooking
} = require('../controllers/bookingController');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

// List & Detail routes: Accessible to Organizers and Administrators
router.get('/', verifyToken, authorizeRoles('organizer', 'administrator'), getBookings);
router.get('/:id', verifyToken, authorizeRoles('organizer', 'administrator'), getBookingById);

// Create route: Accessible to Organizers (and Administrators)
router.post('/', verifyToken, authorizeRoles('organizer', 'administrator'), createBooking);

// Review routes: Strictly restricted to Administrators
router.patch('/:id/approve', verifyToken, authorizeRoles('administrator'), approveBooking);
router.patch('/:id/reject', verifyToken, authorizeRoles('administrator'), rejectBooking);

// Cancel route: Accessible to the Booking's Organizer owner or Administrator
router.patch('/:id/cancel', verifyToken, authorizeRoles('organizer', 'administrator'), cancelBooking);

module.exports = router;
