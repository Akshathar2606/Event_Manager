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
  getEventAttendees,
  getEventAttendeeIds,
  updateEventAttendance,
  getWhatsAppGroupLink
} = require('../controllers/registrationController');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { getEventActivity } = require('../controllers/notificationController');

const router = express.Router();

// Read operations: Accessible to authenticated users (role-based scoping handled in controller)
router.get('/', verifyToken, getEvents);
router.get('/:id/whatsapp-group', verifyToken, authorizeRoles('participant'), getWhatsAppGroupLink);
router.get('/:id/activity', verifyToken, authorizeRoles('organizer', 'administrator'), getEventActivity);
router.get('/:id/attendees/ids', verifyToken, authorizeRoles('organizer', 'administrator'), getEventAttendeeIds);
router.get('/:id', verifyToken, getEventById);

// Participant event registration endpoint
router.post('/:id/register', verifyToken, authorizeRoles('participant'), registerForEvent);

// Organizer & Administrator attendee management endpoint
router.get('/:id/attendees', verifyToken, authorizeRoles('organizer', 'administrator'), getEventAttendees);
router.patch('/:id/attendees/attendance', verifyToken, authorizeRoles('organizer', 'administrator'), updateEventAttendance);

// Mutation operations: Strictly restricted to 'organizer' and 'administrator' roles
router.post('/', verifyToken, authorizeRoles('organizer', 'administrator'), createEvent);
router.put('/:id', verifyToken, authorizeRoles('organizer', 'administrator'), updateEvent);
router.patch('/:id/status', verifyToken, authorizeRoles('organizer', 'administrator'), updateEventStatus);
router.delete('/:id', verifyToken, authorizeRoles('organizer', 'administrator'), deleteEvent);

module.exports = router;
