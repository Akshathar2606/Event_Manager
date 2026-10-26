import api from './api.js';
import { extractErrorMessage } from './authService.js';

export { extractErrorMessage };

export const venueService = {
  /**
   * Fetches venues with optional search, filtering, and pagination.
   * @param {Object} params - { search, minCapacity, facilities, status, includeArchived, page, limit }
   * @returns {Promise<{ success: boolean, count: number, pagination: Object, data: Array }>}
   */
  async getVenues(params = {}) {
    // If facilities is an array, join into comma-separated string for query param
    const queryParams = { ...params };
    if (Array.isArray(queryParams.facilities)) {
      queryParams.facilities = queryParams.facilities.join(',');
    }
    // Remove undefined/empty filters
    Object.keys(queryParams).forEach((key) => {
      if (queryParams[key] === undefined || queryParams[key] === null || queryParams[key] === '') {
        delete queryParams[key];
      }
    });

    const response = await api.get('/venues', { params: queryParams });
    return response.data;
  },

  /**
   * Fetches details of a single venue by ID.
   * @param {string} id - Venue ObjectId
   * @returns {Promise<Object>} - Venue details object
   */
  async getVenueById(id) {
    const response = await api.get(`/venues/${id}`);
    return response.data.data;
  },

  /**
   * Creates a new venue (Administrator only).
   * @param {Object} venueData - { name, description, location, capacity, facilities, hourlyRate, status }
   * @returns {Promise<{ success: boolean, message: string, data: Object }>}
   */
  async createVenue(venueData) {
    const response = await api.post('/venues', venueData);
    return response.data;
  },

  /**
   * Updates an existing venue (Administrator only).
   * @param {string} id - Venue ObjectId
   * @param {Object} venueData - Partial or full venue update object
   * @returns {Promise<{ success: boolean, message: string, data: Object }>}
   */
  async updateVenue(id, venueData) {
    const response = await api.put(`/venues/${id}`, venueData);
    return response.data;
  },

  /**
   * Updates venue status between available and maintenance (Administrator only).
   * @param {string} id - Venue ObjectId
   * @param {'available' | 'maintenance'} status
   * @returns {Promise<{ success: boolean, message: string, data: Object }>}
   */
  async updateVenueStatus(id, status) {
    const response = await api.patch(`/venues/${id}/status`, { status });
    return response.data;
  },

  /**
   * Safely archives a venue to preserve booking integrity (Administrator only).
   * @param {string} id - Venue ObjectId
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async archiveVenue(id) {
    const response = await api.delete(`/venues/${id}`);
    return response.data;
  },
};
