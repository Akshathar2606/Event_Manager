export const USER_ROLES = ['administrator', 'organizer', 'participant', 'vendor'];
export const PUBLIC_ROLES = ['participant', 'organizer'];

/**
 * Maps a user's role to their designated default landing route.
 * @param {string} role - The user's role
 * @returns {string} - The path to the role home
 */
export const getRoleHomePath = (role) => {
  switch (role) {
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
