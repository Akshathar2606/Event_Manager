import api from './api.js';

export const vendorApplicationService = {
  async list(params = {}) {
    const response = await api.get('/vendor-applications', { params });
    return response.data;
  },

  async approve(id) {
    const response = await api.patch(`/vendor-applications/${id}/approve`);
    return response.data;
  },

  async reject(id, reason) {
    const response = await api.patch(`/vendor-applications/${id}/reject`, { reason });
    return response.data;
  },
};

export default vendorApplicationService;
