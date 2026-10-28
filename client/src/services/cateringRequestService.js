import api from './api.js';
import { extractErrorMessage } from './authService.js';
import { CATERING_REQUEST_STATUS } from '../utils/cateringRequestUtils.js';

export { extractErrorMessage, CATERING_REQUEST_STATUS };

/**
 * Service client for EventFlow Catering Request APIs.
 * Supports organizer submissions/cancellations and vendor decision workflows.
 */
export const cateringRequestService = {
  /**
   * Submit a new catering request for an organizer's event.
   *
   * @param {Object} data
   * @param {string} data.eventId - Event ObjectId
   * @param {string} data.cateringServiceId - CateringService ObjectId
   * @param {string} data.packageId - Selected food package ID
   * @param {number} data.guestCount - Integer headcount >= 1
   * @param {string|null} [data.serviceDateTime] - Optional service delivery ISO date
   * @param {string} [data.notes] - Optional requirements or setup notes
   * @returns {Promise<{ success: boolean, message: string, data: Object }>}
   */
  async createCateringRequest(data) {
    const response = await api.post('/catering-requests', data);
    return response.data;
  },

  /**
   * Retrieve catering requests submitted by the authenticated organizer.
   *
   * @param {Object} [params] - Query parameters
   * @param {number} [params.page=1]
   * @param {number} [params.limit=10]
   * @param {string} [params.status] - 'pending' | 'accepted' | 'rejected' | 'cancelled'
   * @param {string} [params.eventId]
   * @returns {Promise<{ success: boolean, count: number, pagination: Object, data: Array }>}
   */
  async getOrganizerCateringRequests(params = {}) {
    const queryParams = { ...params };

    // Strip undefined, null, or empty string values
    Object.keys(queryParams).forEach((key) => {
      if (queryParams[key] === undefined || queryParams[key] === null || queryParams[key] === '') {
        delete queryParams[key];
      }
    });

    const response = await api.get('/catering-requests', { params: queryParams });
    return response.data;
  },

  /**
   * Retrieve incoming catering requests directed to the authenticated vendor.
   *
   * @param {Object} [params] - Query parameters
   * @param {number} [params.page=1]
   * @param {number} [params.limit=10]
   * @param {string} [params.status] - 'pending' | 'accepted' | 'rejected' | 'cancelled'
   * @param {string} [params.eventId]
   * @returns {Promise<{ success: boolean, count: number, pagination: Object, data: Array }>}
   */
  async getVendorCateringRequests(params = {}) {
    const queryParams = { ...params };

    Object.keys(queryParams).forEach((key) => {
      if (queryParams[key] === undefined || queryParams[key] === null || queryParams[key] === '') {
        delete queryParams[key];
      }
    });

    const response = await api.get('/catering-requests/incoming', { params: queryParams });
    return response.data;
  },

  /**
   * Retrieve single catering request detail by ID.
   *
   * @param {string} id - CateringRequest ObjectId
   * @returns {Promise<Object>} Request detail document
   */
  async getCateringRequestById(id) {
    const response = await api.get(`/catering-requests/${id}`);
    return response.data.data;
  },

  /**
   * Vendor accepts a pending catering request.
   *
   * @param {string} id - CateringRequest ObjectId
   * @param {string|Object} [notes=''] - Optional vendor response notes
   * @returns {Promise<{ success: boolean, message: string, data: Object }>}
   */
  async acceptCateringRequest(id, notes = '') {
    const payload = typeof notes === 'object' && notes !== null
      ? notes
      : (typeof notes === 'string' && notes.trim() ? { notes: notes.trim() } : {});

    const response = await api.patch(`/catering-requests/${id}/accept`, payload);
    return response.data;
  },

  /**
   * Vendor rejects a pending catering request with a required non-empty explanation.
   *
   * @param {string} id - CateringRequest ObjectId
   * @param {string|Object} rejectionReason - Required explanation string or payload object
   * @param {string} [notes=''] - Optional additional vendor notes
   * @returns {Promise<{ success: boolean, message: string, data: Object }>}
   */
  async rejectCateringRequest(id, rejectionReason, notes = '') {
    let payload;
    if (typeof rejectionReason === 'object' && rejectionReason !== null) {
      payload = rejectionReason;
    } else {
      payload = {
        rejectionReason: typeof rejectionReason === 'string' ? rejectionReason.trim() : rejectionReason,
        ...(notes && typeof notes === 'string' && notes.trim() ? { vendorNotes: notes.trim() } : {})
      };
    }

    const response = await api.patch(`/catering-requests/${id}/reject`, payload);
    return response.data;
  },

  /**
   * Organizer cancels their catering request (prior to event start if accepted).
   *
   * @param {string} id - CateringRequest ObjectId
   * @param {string|Object} [cancellationReason=''] - Optional cancellation explanation
   * @returns {Promise<{ success: boolean, message: string, data: Object }>}
   */
  async cancelCateringRequest(id, cancellationReason = '') {
    let payload = {};
    if (typeof cancellationReason === 'object' && cancellationReason !== null) {
      payload = cancellationReason;
    } else if (typeof cancellationReason === 'string' && cancellationReason.trim()) {
      payload = { cancellationReason: cancellationReason.trim() };
    }

    const response = await api.patch(`/catering-requests/${id}/cancel`, payload);
    return response.data;
  }
};

export default cateringRequestService;
