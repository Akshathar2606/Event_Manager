import api from './api.js';
import { extractErrorMessage } from './authService.js';
import { REGISTRATION_STATUS } from '../utils/registrationUtils.js';

export { extractErrorMessage, REGISTRATION_STATUS };

export const registrationService = {
  /**
   * Register the authenticated participant for an event.
   * @param {string} eventId - Event ObjectId
   * @returns {Promise<{ success: boolean, message: string, data: Object }>}
   */
  async registerForEvent(eventId) {
    const response = await api.post(`/events/${eventId}/register`);
    return response.data;
  },

  /**
   * Retrieve registrations belonging to the authenticated participant with pagination and filters.
   * @param {Object} [params] - { page, limit, status }
   * @returns {Promise<{ success: boolean, count: number, pagination: Object, data: Array }>}
   */
  async getMyRegistrations(params = {}) {
    const queryParams = { ...params };

    // Clean undefined, null, or empty string values
    Object.keys(queryParams).forEach((key) => {
      if (queryParams[key] === undefined || queryParams[key] === null || queryParams[key] === '') {
        delete queryParams[key];
      }
    });

    const response = await api.get('/registrations/me', { params: queryParams });
    return response.data;
  },

  /**
   * Retrieve a single registration detail by ID (Owner participant or Administrator).
   * @param {string} id - Registration ObjectId
   * @returns {Promise<Object>} Registration document
   */
  async getRegistrationById(id) {
    const response = await api.get(`/registrations/${id}`);
    return response.data.data;
  },

  /**
   * Cancel an active registration (Participant owner or Administrator).
   * @param {string} id - Registration ObjectId
   * @param {string|Object} [reason] - Optional cancellation reason string or payload
   * @returns {Promise<{ success: boolean, message: string, data: Object }>}
   */
  async cancelRegistration(id, reason = '') {
    const payload = typeof reason === 'string'
      ? (reason.trim() ? { reason: reason.trim() } : {})
      : (reason || {});

    const response = await api.patch(`/registrations/${id}/cancel`, payload);
    return response.data;
  },

  /**
   * Retrieve attendee roster for an event (Event owner organizer or Administrator).
   * @param {string} eventId - Event ObjectId
   * @param {Object} [params] - { page, limit, status }
   * @returns {Promise<{ success: boolean, count: number, summary: Object, pagination: Object, data: Array }>}
   */
  async getEventAttendees(eventId, params = {}) {
    const queryParams = { ...params };

    Object.keys(queryParams).forEach((key) => {
      if (queryParams[key] === undefined || queryParams[key] === null || queryParams[key] === '') {
        delete queryParams[key];
      }
    });

    const response = await api.get(`/events/${eventId}/attendees`, { params: queryParams });
    return response.data;
  }
};

export default registrationService;
