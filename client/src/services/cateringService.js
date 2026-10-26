import api from './api.js';
import { extractErrorMessage } from './authService.js';

export { extractErrorMessage };

export const DIETARY_OPTIONS = [
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Halal',
  'Kosher',
  'Nut-Free',
  'Dairy-Free'
];

export const cateringService = {
  /**
   * Browse active catering services with optional search, dietary, cuisine, and price filters.
   * @param {Object} params - { search, dietary, cuisine, maxPrice, page, limit }
   */
  async browseCateringServices(params = {}) {
    const queryParams = { ...params };
    if (Array.isArray(queryParams.dietary)) {
      queryParams.dietary = queryParams.dietary.join(',');
    }
    if (Array.isArray(queryParams.cuisine)) {
      queryParams.cuisine = queryParams.cuisine.join(',');
    }
    // Clean empty values
    Object.keys(queryParams).forEach((key) => {
      if (queryParams[key] === undefined || queryParams[key] === null || queryParams[key] === '') {
        delete queryParams[key];
      }
    });

    const response = await api.get('/catering', { params: queryParams });
    return response.data;
  },

  /**
   * Get single catering service and active packages by ID.
   * @param {string} id - CateringService ObjectId
   */
  async getCateringServiceById(id) {
    const response = await api.get(`/catering/${id}`);
    return response.data.data;
  },

  /**
   * Get authenticated vendor's own profile.
   */
  async getMyProfile() {
    const response = await api.get('/catering/my-profile');
    return response.data.data;
  },

  /**
   * Create authenticated vendor's profile.
   * @param {Object} profileData - { businessName, description, contactEmail, contactPhone, serviceArea, cuisineTypes }
   */
  async createProfile(profileData) {
    const response = await api.post('/catering', profileData);
    return response.data;
  },

  /**
   * Update authenticated vendor's profile.
   * @param {Object} profileData - Updated profile fields
   */
  async updateMyProfile(profileData) {
    const response = await api.put('/catering/my-profile', profileData);
    return response.data;
  },

  /**
   * Update service availability.
   * @param {boolean} isAvailable
   */
  async updateAvailability(isAvailable) {
    const response = await api.patch('/catering/my-profile/availability', { isAvailable });
    return response.data;
  },

  /**
   * Add a package to authenticated vendor's profile.
   * @param {Object} packageData - { name, description, pricePerPlate, minOrder, menuItems, dietaryOptions }
   */
  async addPackage(packageData) {
    const response = await api.post('/catering/my-profile/packages', packageData);
    return response.data;
  },

  /**
   * Update an existing package.
   * @param {string} packageId
   * @param {Object} packageData
   */
  async updatePackage(packageId, packageData) {
    const response = await api.put(`/catering/my-profile/packages/${packageId}`, packageData);
    return response.data;
  },

  /**
   * Safely archive an existing package.
   * @param {string} packageId
   */
  async archivePackage(packageId) {
    const response = await api.delete(`/catering/my-profile/packages/${packageId}`);
    return response.data;
  }
};
