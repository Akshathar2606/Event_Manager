const jwt = require('jsonwebtoken');

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is strictly required in production.');
    }
    return 'eventflow_default_dev_secret_change_in_production_min32';
  }
  return secret;
};

const getJwtExpiresIn = () => {
  return process.env.JWT_EXPIRES_IN || '24h';
};

/**
 * Sign a JWT token with user identification payload.
 * @param {Object} user - User object containing _id/id, role, email, name
 * @returns {string} - Signed JWT
 */
const signToken = (user) => {
  const payload = {
    id: user._id ? user._id.toString() : user.id,
    role: user.role,
    email: user.email,
    name: user.name
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: getJwtExpiresIn()
  });
};

/**
 * Verify and decode a JWT token.
 * @param {string} token - Bearer JWT string
 * @returns {Object} - Decoded payload
 */
const verifyTokenPayload = (token) => {
  return jwt.verify(token, getJwtSecret());
};

module.exports = {
  getJwtSecret,
  getJwtExpiresIn,
  signToken,
  verifyTokenPayload
};
