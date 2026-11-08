const mongoose = require('mongoose');
const { User } = require('../models/User');
const { VendorApplication } = require('../models/VendorApplication');
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
        user = await User.findById(decoded.id).select('+authVersion');
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

      if ((decoded.authVersion || 0) !== (user.authVersion || 0)) {
        return res.status(401).json({
          success: false,
          message: 'Authorization token has been revoked. Please log in again.'
        });
      }

      const vendorApplication = user.role === 'vendor'
        ? await VendorApplication.findOne({ vendorId: user._id }).select('status rejectionReason').lean()
        : null;

      // Attach authoritative server-side user data (never trust client-supplied headers/body)
      req.user = {
        id: user._id.toString(),
        name: user.name,
        firstName: user.firstName || user.name.split(/\s+/)[0] || '',
        lastName: user.lastName || user.name.split(/\s+/).slice(1).join(' '),
        email: user.email,
        role: user.role, // Sourced directly from verified database record
        phone: user.phone || '',
        organization: user.organization || '',
        location: user.location || '',
        bio: user.bio || '',
        interests: user.interests || [],
        socialLinks: user.socialLinks || [],
        ...(user.role === 'vendor' && {
          vendorApplicationStatus: vendorApplication?.status || 'approved',
          vendorRejectionReason: vendorApplication?.status === 'rejected'
            ? vendorApplication.rejectionReason || ''
            : ''
        }),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
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
        if ((decoded.authVersion || 0) !== (mockUser.authVersion || 0)) {
          return res.status(401).json({
            success: false,
            message: 'Authorization token has been revoked. Please log in again.'
          });
        }
        const application = mockUser.role === 'vendor'
          ? req.app.locals.mockVendorApplicationStore?.get(mockUser.id)
          : null;
        req.user = {
          id: mockUser.id,
          name: mockUser.name,
          firstName: mockUser.firstName || mockUser.name.split(/\s+/)[0] || '',
          lastName: mockUser.lastName || mockUser.name.split(/\s+/).slice(1).join(' '),
          email: mockUser.email,
          role: mockUser.role,
          phone: mockUser.phone || '',
          organization: mockUser.organization || '',
          location: mockUser.location || '',
          bio: mockUser.bio || '',
          interests: mockUser.interests || [],
          socialLinks: mockUser.socialLinks || [],
          ...(mockUser.role === 'vendor' && {
            vendorApplicationStatus: application?.status || 'approved',
            vendorRejectionReason: application?.status === 'rejected'
              ? application.rejectionReason || ''
              : ''
          }),
          createdAt: mockUser.createdAt,
          updatedAt: mockUser.updatedAt,
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
