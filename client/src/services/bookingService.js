import api from './api.js';
import { extractErrorMessage } from './authService.js';

export { extractErrorMessage };

export const BOOKING_STATUS = ['pending', 'approved', 'rejected', 'cancelled'];

export const bookingService = {
  /**
   * List and filter bookings with role-aware scoping and pagination.
   * @param {Object} params - { status, venue, event, organizer, startDate, endDate, page, limit }
   * @returns {Promise<{ success: boolean, count: number, pagination: Object, data: Array }>}
   */
  async getBookings(params = {}) {
    const queryParams = { ...params };

    // Clean undefined and empty string values without removing valid falsy values like 0 or false
    Object.keys(queryParams).forEach((key) => {
      if (queryParams[key] === undefined || queryParams[key] === null || queryParams[key] === '') {
        delete queryParams[key];
      }
    });

    const response = await api.get('/bookings', { params: queryParams });
    return response.data;
  },

  /**
   * Fetch details of a single booking by ID.
   * @param {string} id - Booking ObjectId
   * @returns {Promise<Object>} Booking detail object
   */
  async getBookingById(id) {
    const response = await api.get(`/bookings/${id}`);
    return response.data.data;
  },

  /**
   * Create a new venue booking request (Organizer or Administrator).
   * @param {Object} data - { event, venue, startDateTime, endDateTime, purpose, notes }
   * @returns {Promise<{ success: boolean, message: string, data: Object }>}
   */
  async createBooking(data) {
    const response = await api.post('/bookings', data);
    return response.data;
  },

  /**
   * Approve a pending venue booking request (Administrator only).
   * @param {string} id - Booking ObjectId
   * @returns {Promise<{ success: boolean, message: string, data: Object }>}
   */
  async approveBooking(id) {
    const response = await api.patch(`/bookings/${id}/approve`);
    return response.data;
  },

  /**
   * Reject a pending venue booking request with a rejection reason (Administrator only).
   * @param {string} id - Booking ObjectId
   * @param {string|Object} rejectionReason - Rejection explanation string or object { rejectionReason }
   * @returns {Promise<{ success: boolean, message: string, data: Object }>}
   */
  async rejectBooking(id, rejectionReason) {
    const payload = typeof rejectionReason === 'string'
      ? { rejectionReason }
      : (rejectionReason || {});

    const response = await api.patch(`/bookings/${id}/reject`, payload);
    return response.data;
  },

  /**
   * Cancel an eligible pending or approved booking (Booking owner or Administrator).
   * @param {string} id - Booking ObjectId
   * @returns {Promise<{ success: boolean, message: string, data: Object }>}
   */
  async cancelBooking(id) {
    const response = await api.patch(`/bookings/${id}/cancel`);
    return response.data;
  }
};

export default bookingService;
