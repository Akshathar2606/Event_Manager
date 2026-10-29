const express = require('express');
const { register, login, forgotPassword, resetPassword, getMe } = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { passwordRecoveryRateLimit } = require('../middleware/passwordRecoveryRateLimit');

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', passwordRecoveryRateLimit, forgotPassword);
router.post('/reset-password', passwordRecoveryRateLimit, resetPassword);

// Authenticated current-user profile
router.get('/me', verifyToken, getMe);

// Role verification test routes (used for access control validation)
router.get(
  '/admin-check',
  verifyToken,
  authorizeRoles('administrator'),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Administrator authorization confirmed.',
      user: req.user
    });
  }
);

router.get(
  '/organizer-check',
  verifyToken,
  authorizeRoles('organizer', 'administrator'),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Organizer authorization confirmed.',
      user: req.user
    });
  }
);

module.exports = router;
