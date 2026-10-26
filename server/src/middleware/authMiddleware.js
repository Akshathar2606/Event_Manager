const mongoose = require('mongoose');
const { User } = require('../models/User');
const { verifyTokenPayload } = require('../utils/token');

/**
 * Middleware to authenticate requests using JWT Bearer tokens.
 * Verifies token integrity, checks user status in database, and attaches safe user profile to req.user.
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Authorization header is missing. Access denied.'
      });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authorization format. Expected format: Bearer <token>.'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token || token.trim() === '') {
      return res.status(401).json({
        success: false,
        message: 'Bearer token is missing.'
      });
    }

    // Verify token payload
    let decoded;
    try {
      decoded = verifyTokenPayload(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Authorization token has expired. Please log in again.'
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid authorization token.'
      });
    }

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: 'Token payload is invalid.'
      });
    }

    // Look up user in database if DB is connected
    let user = null;
    if (mongoose.connection.readyState === 1) {
      try {
        user = await User.findById(decoded.id);
      } catch (dbErr) {
        console.warn('[Auth Middleware Warning] Database lookup failed:', dbErr.message);
      }
    }

    if (user) {
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Account has been deactivated. Access denied.'
        });
      }

      // Attach authoritative server-side user data (never trust client-supplied headers/body)
      req.user = {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role, // Sourced directly from verified database record
        phone: user.phone || '',
        organization: user.organization || '',
        isActive: user.isActive
      };
    } else {
      // Fallback: If DB query returned null but token was signed with secret (or test mode)
      // If we are in test mode or DB returned null for valid token:
      if (req.app.locals.mockUserStore && req.app.locals.mockUserStore.has(decoded.id)) {
        const mockUser = req.app.locals.mockUserStore.get(decoded.id);
        if (!mockUser.isActive) {
          return res.status(403).json({
            success: false,
            message: 'Account has been deactivated. Access denied.'
          });
        }
        req.user = {
          id: mockUser.id,
          name: mockUser.name,
          email: mockUser.email,
          role: mockUser.role,
          phone: mockUser.phone || '',
          organization: mockUser.organization || '',
          isActive: mockUser.isActive
        };
      } else {
        // If DB is connected and user was deleted:
        return res.status(401).json({
          success: false,
          message: 'User belonging to this token no longer exists.'
        });
      }
    }

    next();
  } catch (error) {
    console.error('[Auth Middleware Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.'
    });
  }
};

module.exports = {
  verifyToken
};
