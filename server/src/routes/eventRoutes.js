const express = require('express');
const {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  updateEventStatus,
  deleteEvent
} = require('../controllers/eventController');
const {
  registerForEvent,
  getEventAttendees
} = require('../controllers/registrationController');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

// Read operations: Accessible to authenticated users (role-based scoping handled in controller)
router.get('/', verifyToken, getEvents);
router.get('/:id', verifyToken, getEventById);

// Participant event registration endpoint
router.post('/:id/register', verifyToken, authorizeRoles('participant'), registerForEvent);

// Organizer & Administrator attendee management endpoint
router.get('/:id/attendees', verifyToken, authorizeRoles('organizer', 'administrator'), getEventAttendees);

// Mutation operations: Strictly restricted to 'organizer' and 'administrator' roles
router.post('/', verifyToken, authorizeRoles('organizer', 'administrator'), createEvent);
router.put('/:id', verifyToken, authorizeRoles('organizer', 'administrator'), updateEvent);
router.patch('/:id/status', verifyToken, authorizeRoles('organizer', 'administrator'), updateEventStatus);
router.delete('/:id', verifyToken, authorizeRoles('organizer', 'administrator'), deleteEvent);

module.exports = router;
