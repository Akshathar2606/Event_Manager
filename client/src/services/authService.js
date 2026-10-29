import api, { setStoredToken, clearStoredToken } from './api.js';

/**
 * Extracts a user-friendly error message from an API error response.
 */
export const extractErrorMessage = (error, defaultMessage = 'An unexpected error occurred.') => {
  if (!error) return defaultMessage;
  if (error.response && error.response.data) {
    const data = error.response.data;
    if (data.message) return data.message;
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors[0];
    }
  }
  if (error.message === 'Network Error') {
    return 'Unable to connect to the server. Please check your connection or verify the backend is running.';
  }
  return error.message || defaultMessage;
};

export const authService = {
  /**
   * Logs a user in with email and password.
   */
  async login({ email, password }) {
    const response = await api.post('/auth/login', { email, password });
    const { token, user } = response.data;
    if (token) {
      setStoredToken(token);
    }
    return { token, user };
  },

  /**
   * Registers a new user (participant or organizer).
   */
  async register({ name, email, password, role, phone, organization }) {
    const response = await api.post('/auth/register', {
      name,
      email,
      password,
      role,
      phone,
      organization,
    });
    const { token, user } = response.data;
    if (token) {
      setStoredToken(token);
    }
    return { token, user };
  },

  /**
   * Fetches the current authenticated user profile using the active token.
   */
  async getCurrentUser() {
    const response = await api.get('/auth/me');
    return response.data.user;
  },

  /**
   * Requests password-recovery instructions without changing the active session.
   */
  async requestPasswordReset({ email }) {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  /**
   * Resets a password using a one-time token held only in the current page state.
   */
  async resetPassword({ token, newPassword }) {
    const response = await api.post('/auth/reset-password', { token, newPassword });
    return response.data;
  },

  /**
   * Clears the stored token from memory and sessionStorage.
   */
  logout() {
    clearStoredToken();
  },
};
