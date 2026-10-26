import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { cateringService, DIETARY_OPTIONS } from '../src/services/cateringService.js';
import api from '../src/services/api.js';

describe('Frontend Catering Service & Parameter Serialization Tests', () => {
  let interceptedRequest = null;

  beforeEach(() => {
    interceptedRequest = null;

    api.get = async (url, config) => {
      interceptedRequest = { method: 'GET', url, config };
      if (url === '/catering/my-profile') {
        return {
          data: {
            success: true,
            data: { id: 'svc_123', businessName: 'Gourmet Campus', isAvailable: true, packages: [] }
          }
        };
      }
      if (url.startsWith('/catering/')) {
        return {
          data: {
            success: true,
            data: { id: 'svc_123', businessName: 'Gourmet Campus', packages: [] }
          }
        };
      }
      return {
        data: {
          success: true,
          count: 1,
          pagination: { total: 1, page: 1, pages: 1, limit: 9 },
          data: [{ id: 'svc_123', businessName: 'Gourmet Campus', packages: [] }]
        }
      };
    };

    api.post = async (url, data) => {
      interceptedRequest = { method: 'POST', url, data };
      return { data: { success: true, message: 'Created', data } };
    };

    api.put = async (url, data) => {
      interceptedRequest = { method: 'PUT', url, data };
      return { data: { success: true, message: 'Updated', data } };
    };

    api.patch = async (url, data) => {
      interceptedRequest = { method: 'PATCH', url, data };
      return { data: { success: true, message: 'Status updated', data } };
    };

    api.delete = async (url) => {
      interceptedRequest = { method: 'DELETE', url };
      return { data: { success: true, message: 'Archived' } };
    };
  });

  test('1. DIETARY_OPTIONS contains standard dietary choices', () => {
    assert.ok(Array.isArray(DIETARY_OPTIONS));
    assert.ok(DIETARY_OPTIONS.includes('Vegetarian'));
    assert.ok(DIETARY_OPTIONS.includes('Vegan'));
    assert.ok(DIETARY_OPTIONS.includes('Gluten-Free'));
    assert.ok(DIETARY_OPTIONS.includes('Halal'));
  });

  test('2. browseCateringServices formats dietary/cuisine arrays and strips empty params', async () => {
    await cateringService.browseCateringServices({
      search: 'Gourmet',
      dietary: ['Vegetarian', 'Vegan'],
      cuisine: ['Continental', 'Italian'],
      maxPrice: 35,
      page: 1,
      emptyString: '',
      nullValue: null,
      undefValue: undefined
    });

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.method, 'GET');
    assert.equal(interceptedRequest.url, '/catering');
    const params = interceptedRequest.config.params;
    assert.equal(params.search, 'Gourmet');
    assert.equal(params.dietary, 'Vegetarian,Vegan');
    assert.equal(params.cuisine, 'Continental,Italian');
    assert.equal(params.maxPrice, 35);
    assert.equal(params.page, 1);
    assert.equal(params.emptyString, undefined);
    assert.equal(params.nullValue, undefined);
    assert.equal(params.undefValue, undefined);
  });

  test('3. getCateringServiceById requests correct URL endpoint', async () => {
    const serviceId = '671d0e1234567890abcdef99';
    const res = await cateringService.getCateringServiceById(serviceId);

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.method, 'GET');
    assert.equal(interceptedRequest.url, `/catering/${serviceId}`);
    assert.equal(res.id, 'svc_123');
  });

  test('4. getMyProfile retrieves current vendor commercial profile', async () => {
    const res = await cateringService.getMyProfile();

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.method, 'GET');
    assert.equal(interceptedRequest.url, '/catering/my-profile');
    assert.equal(res.businessName, 'Gourmet Campus');
  });

  test('5. createProfile sends POST /catering payload', async () => {
    const payload = {
      businessName: 'Royal Treats',
      description: 'Campus catering specialist',
      contactEmail: 'royal@treats.com',
      contactPhone: '+1-555-0199',
      serviceArea: 'East Campus',
      cuisineTypes: ['Asian', 'Mediterranean']
    };

    const res = await cateringService.createProfile(payload);

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.method, 'POST');
    assert.equal(interceptedRequest.url, '/catering');
    assert.deepEqual(interceptedRequest.data, payload);
    assert.equal(res.success, true);
  });

  test('6. updateMyProfile sends PUT /catering/my-profile payload', async () => {
    const payload = {
      businessName: 'Royal Treats Updated',
      serviceArea: 'All Campuses'
    };

    const res = await cateringService.updateMyProfile(payload);

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.method, 'PUT');
    assert.equal(interceptedRequest.url, '/catering/my-profile');
    assert.deepEqual(interceptedRequest.data, payload);
    assert.equal(res.success, true);
  });

  test('7. updateAvailability sends PATCH /catering/my-profile/availability payload', async () => {
    const res = await cateringService.updateAvailability(false);

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.method, 'PATCH');
    assert.equal(interceptedRequest.url, '/catering/my-profile/availability');
    assert.deepEqual(interceptedRequest.data, { isAvailable: false });
    assert.equal(res.success, true);
  });

  test('8. addPackage sends POST /catering/my-profile/packages payload', async () => {
    const newPackage = {
      name: 'Deluxe Lunch Buffet',
      description: 'Full spread with sides and dessert',
      pricePerPlate: 28.5,
      minOrder: 25,
      menuItems: ['Salad', 'Main', 'Dessert'],
      dietaryOptions: ['Vegetarian', 'Gluten-Free']
    };

    const res = await cateringService.addPackage(newPackage);

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.method, 'POST');
    assert.equal(interceptedRequest.url, '/catering/my-profile/packages');
    assert.deepEqual(interceptedRequest.data, newPackage);
    assert.equal(res.success, true);
  });

  test('9. updatePackage sends PUT /catering/my-profile/packages/:packageId payload', async () => {
    const packageId = 'pkg_456';
    const updatedPackage = {
      name: 'Deluxe Lunch Buffet Rev 2',
      pricePerPlate: 30
    };

    const res = await cateringService.updatePackage(packageId, updatedPackage);

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.method, 'PUT');
    assert.equal(interceptedRequest.url, `/catering/my-profile/packages/${packageId}`);
    assert.deepEqual(interceptedRequest.data, updatedPackage);
    assert.equal(res.success, true);
  });

  test('10. archivePackage sends DELETE /catering/my-profile/packages/:packageId', async () => {
    const packageId = 'pkg_456';
    const res = await cateringService.archivePackage(packageId);

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.method, 'DELETE');
    assert.equal(interceptedRequest.url, `/catering/my-profile/packages/${packageId}`);
    assert.equal(res.success, true);
  });
});
