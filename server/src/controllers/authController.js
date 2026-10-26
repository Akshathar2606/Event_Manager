const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, PUBLIC_ALLOWED_ROLES } = require('../models/User');
const { validateRegistrationInput, validateLoginInput } = require('../utils/validation');
const { signToken } = require('../utils/token');

/**
 * Helper to get the active user repository (MongoDB Mongoose model or test store)
 */
const getStore = (req) => {
  return req.app && req.app.locals && req.app.locals.mockUserStore
    ? req.app.locals.mockUserStore
    : null;
};

/**
 * POST /api/auth/register
 * Public registration endpoint for 'participant' and 'organizer' roles only.
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, organization } = req.body;

    // Validate inputs
    const validation = validateRegistrationInput({ name, email, password, role, phone, organization });

    if (!validation.isValid) {
      // If client attempted to self-assign administrator or vendor, return 403 Forbidden
      const targetRole = role ? String(role).trim().toLowerCase() : '';
      if (['administrator', 'vendor'].includes(targetRole)) {
        return res.status(403).json({
          success: false,
          message: `Self-registration as '${targetRole}' is strictly forbidden. Administrator and vendor accounts must be provisioned through administrative onboarding.`,
          errors: validation.errors
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors: validation.errors
      });
    }

    const { sanitized } = validation;
    const mockStore = getStore(req);

    // Check for duplicate email
    if (mockStore) {
      const existing = Array.from(mockStore.values()).find((u) => u.email === sanitized.email);
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Email is already registered.'
        });
      }

      const passwordHash = await bcrypt.hash(sanitized.password, 10);
      const newUser = {
        id: new mongoose.Types.ObjectId().toString(),
        name: sanitized.name,
        email: sanitized.email,
        passwordHash,
        role: sanitized.role,
        phone: sanitized.phone,
        organization: sanitized.organization,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mockStore.set(newUser.id, newUser);

      const token = signToken(newUser);
      const { passwordHash: _, ...safeUser } = newUser;

      return res.status(201).json({
        success: true,
        message: 'User registered successfully.',
        token,
        user: safeUser
      });
    }

    // Standard MongoDB path
    const existingUser = await User.findOne({ email: sanitized.email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email is already registered.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(sanitized.password, salt);

    const user = await User.create({
      name: sanitized.name,
      email: sanitized.email,
      passwordHash,
      role: sanitized.role,
      phone: sanitized.phone,
      organization: sanitized.organization,
      isActive: true
    });

    const token = signToken(user);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      token,
      user: user.toSafeObject()
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Email is already registered.'
      });
    }
    next(error);
  }
};

/**
 * POST /api/auth/login
 * User login endpoint verifying credentials and issuing JWT.
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const validation = validateLoginInput({ email, password });
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors: validation.errors
      });
    }

    const { sanitized } = validation;
    const mockStore = getStore(req);

    if (mockStore) {
      const user = Array.from(mockStore.values()).find((u) => u.email === sanitized.email);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.'
        });
      }

      const isMatch = await bcrypt.compare(sanitized.password, user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.'
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Account has been deactivated. Please contact an administrator.'
        });
      }

      const token = signToken(user);
      const { passwordHash: _, ...safeUser } = user;

      return res.status(200).json({
        success: true,
        message: 'Login successful.',
        token,
        user: safeUser
      });
    }

    // Standard MongoDB path
    const user = await User.findOne({ email: sanitized.email }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const isMatch = await user.comparePassword(sanitized.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated. Please contact an administrator.'
      });
    }

    const token = signToken(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: user.toSafeObject()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 * Retrieves current authenticated user profile.
 */
const getMe = async (req, res, next) => {
  try {
    // req.user is guaranteed to be set by verifyToken middleware
    return res.status(200).json({
      success: true,
      user: req.user
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe
};
