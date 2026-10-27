const express = require('express');
const {
  registerForEvent,
  getMyRegistrations,
  getRegistrationById,
  cancelRegistration,
  getEventAttendees
} = require('../controllers/registrationController');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

// 1. Participant-specific routes
router.post('/', verifyToken, authorizeRoles('participant'), registerForEvent);
router.get('/me', verifyToken, authorizeRoles('participant'), getMyRegistrations);
router.get('/', verifyToken, authorizeRoles('participant'), getMyRegistrations);

// 2. Organizer & Admin event attendee inspection route
router.get('/event/:id', verifyToken, authorizeRoles('organizer', 'administrator'), getEventAttendees);

// 3. Single registration operations (parameterized routes placed after static routes)
router.get('/:id', verifyToken, getRegistrationById);
router.patch('/:id/cancel', verifyToken, cancelRegistration);

module.exports = router;
