import api from './api.js';
import { extractErrorMessage } from './authService.js';

export { extractErrorMessage };

export const adminUserService = {
  /**
   * Lists users with server-side search, filters, and pagination.
   * @param {Object} params - { search, role, isActive, page, limit }
   * @returns {Promise<{ success: boolean, count: number, pagination: Object, data: Array }>}
   */
  async getUsers(params = {}) {
    const queryParams = { ...params };
    Object.keys(queryParams).forEach((key) => {
      if (queryParams[key] === undefined || queryParams[key] === null || queryParams[key] === '') {
        delete queryParams[key];
      }
    });

    const response = await api.get('/users', { params: queryParams });
    return response.data;
  },

  /**
   * Activates or deactivates an account without changing its role.
   * @param {string} id - User ObjectId
   * @param {boolean} isActive
   * @returns {Promise<{ success: boolean, message: string, user: Object }>}
   */
  async updateUserStatus(id, isActive) {
    const response = await api.patch(`/users/${id}/status`, { isActive });
    return response.data;
  }
};

export default adminUserService;
