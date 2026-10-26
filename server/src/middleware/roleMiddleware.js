/**
 * Middleware factory for Role-Based Access Control (RBAC).
 * Enforces that req.user has one of the required roles.
 *
 * @param  {...string} allowedRoles - List of authorized roles (e.g., 'administrator', 'organizer')
 * @returns {Function} Express middleware function
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    // Ensure authentication middleware ran first
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. No user context found.'
      });
    }

    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. Role '${userRole}' is not authorized to access this resource. Required role(s): ${allowedRoles.join(', ')}.`
      });
    }

    next();
  };
};

module.exports = {
  authorizeRoles
};
