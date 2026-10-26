import api from './api.js';
import { extractErrorMessage } from './authService.js';

export { extractErrorMessage };

export const EVENT_CATEGORIES = [
  'academic',
  'cultural',
  'sports',
  'technical',
  'workshop',
  'seminar',
  'social',
  'conference',
  'other'
];

export const EVENT_STATUS = ['draft', 'published', 'cancelled'];

export const eventService = {
  /**
   * List and filter events with role-aware scoping and pagination.
   * @param {Object} params - { search, category, status, venue, organizer, startDate, endDate, page, limit }
   * @returns {Promise<{ success: boolean, count: number, pagination: Object, data: Array }>}
   */
  async getEvents(params = {}) {
    const queryParams = { ...params };

    // Format tags if passed as array
    if (Array.isArray(queryParams.tags)) {
      queryParams.tags = queryParams.tags.join(',');
    }

    // Clean empty values
    Object.keys(queryParams).forEach((key) => {
      if (queryParams[key] === undefined || queryParams[key] === null || queryParams[key] === '') {
        delete queryParams[key];
      }
    });

    const response = await api.get('/events', { params: queryParams });
    return response.data;
  },

  /**
   * Fetch details of a single event by ID.
   * @param {string} id - Event ObjectId
   * @returns {Promise<Object>} Event detail object
   */
  async getEventById(id) {
    const response = await api.get(`/events/${id}`);
    return response.data.data;
  },

  /**
   * Create a new draft event (Organizer/Admin only).
   * @param {Object} eventData - Event fields
   * @returns {Promise<{ success: boolean, message: string, data: Object }>}
   */
  async createEvent(eventData) {
    const response = await api.post('/events', eventData);
    return response.data;
  },

  /**
   * Update an existing event (Owner organizer or Admin only).
   * @param {string} id - Event ObjectId
   * @param {Object} eventData - Fields to update
   * @returns {Promise<{ success: boolean, message: string, data: Object }>}
   */
  async updateEvent(id, eventData) {
    const response = await api.put(`/events/${id}`, eventData);
    return response.data;
  },

  /**
   * Update event lifecycle status ('draft', 'published', 'cancelled').
   * @param {string} id - Event ObjectId
   * @param {string} status - New status
   * @returns {Promise<{ success: boolean, message: string, data: Object }>}
   */
  async updateEventStatus(id, status) {
    const response = await api.patch(`/events/${id}/status`, { status });
    return response.data;
  },

  /**
   * Soft archive an event (Owner organizer or Admin only).
   * @param {string} id - Event ObjectId
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async deleteEvent(id) {
    const response = await api.delete(`/events/${id}`);
    return response.data;
  }
};
