export const USER_ROLES = ['administrator', 'organizer', 'participant', 'vendor'];
export const PUBLIC_ROLES = ['participant', 'organizer'];

export const normalizeRole = (role) =>
  typeof role === 'string' ? role.trim().toLowerCase() : '';

/**
 * Maps a user's role to their designated default landing route.
 * @param {string} role - The user's role
 * @returns {string} - The path to the role home
 */
export const getRoleHomePath = (role) => {
  switch (normalizeRole(role)) {
    case 'administrator':
      return '/admin';
    case 'organizer':
      return '/organizer';
    case 'vendor':
      return '/vendor';
    case 'participant':
    default:
      return '/participant';
  }
};

export const hasAllowedRole = (role, allowedRoles) => {
  const normalizedRole = normalizeRole(role);
  return Array.isArray(allowedRoles) &&
    allowedRoles.some((allowedRole) => normalizeRole(allowedRole) === normalizedRole);
};

export const getPostLoginPath = (role, intendedPath) => {
  if (
    typeof intendedPath === 'string' &&
    intendedPath.startsWith('/') &&
    !intendedPath.startsWith('//')
  ) {
    return intendedPath;
  }
  return getRoleHomePath(role);
};
