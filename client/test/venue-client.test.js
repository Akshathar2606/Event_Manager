import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { venueService } from '../src/services/venueService.js';
import api from '../src/services/api.js';

describe('Frontend Venue Service & Parameter Serialization Tests', () => {
  let interceptedRequest = null;

  beforeEach(() => {
    interceptedRequest = null;
    // Mock api.get, post, put, patch, delete methods for unit testing
    api.get = async (url, config) => {
      interceptedRequest = { method: 'GET', url, config };
      if (url.includes('/venues/')) {
        return {
          data: {
            success: true,
            data: { id: 'mock_1', name: 'Mock Hall', capacity: 100 }
          }
        };
      }
      return {
        data: {
          success: true,
          count: 1,
          pagination: { total: 1, page: 1, pages: 1, limit: 10 },
          data: [{ id: 'mock_1', name: 'Mock Hall', capacity: 100 }]
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

  test('1. getVenues cleans empty parameters and serializes facilities array', async () => {
    await venueService.getVenues({
      search: 'Auditorium',
      minCapacity: 200,
      facilities: ['Projector', 'Wi-Fi'],
      status: 'available',
      emptyParam: '',
      nullParam: null,
      undefinedParam: undefined
    });

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.url, '/venues');
    const params = interceptedRequest.config.params;
    assert.equal(params.search, 'Auditorium');
    assert.equal(params.minCapacity, 200);
    assert.equal(params.facilities, 'Projector,Wi-Fi');
    assert.equal(params.status, 'available');
    assert.equal(params.emptyParam, undefined);
    assert.equal(params.nullParam, undefined);
    assert.equal(params.undefinedParam, undefined);
  });

  test('2. getVenueById requests correct URL endpoint with ID', async () => {
    const venueId = '671d0e1234567890abcdef12';
    const res = await venueService.getVenueById(venueId);

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.url, `/venues/${venueId}`);
    assert.equal(res.id, 'mock_1');
  });

  test('3. createVenue sends payload to POST /venues', async () => {
    const payload = {
      name: 'Lecture Hall 1',
      location: 'Block C',
      capacity: 120,
      facilities: ['Projector'],
      hourlyRate: 25,
      status: 'available'
    };

    const res = await venueService.createVenue(payload);

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.method, 'POST');
    assert.equal(interceptedRequest.url, '/venues');
    assert.equal(interceptedRequest.data.name, 'Lecture Hall 1');
    assert.equal(res.success, true);
  });

  test('4. updateVenue sends payload to PUT /venues/:id', async () => {
    const venueId = '671d0e1234567890abcdef12';
    const payload = { capacity: 150 };

    const res = await venueService.updateVenue(venueId, payload);

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.method, 'PUT');
    assert.equal(interceptedRequest.url, `/venues/${venueId}`);
    assert.equal(interceptedRequest.data.capacity, 150);
    assert.equal(res.success, true);
  });

  test('5. updateVenueStatus sends status to PATCH /venues/:id/status', async () => {
    const venueId = '671d0e1234567890abcdef12';
    const res = await venueService.updateVenueStatus(venueId, 'maintenance');

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.method, 'PATCH');
    assert.equal(interceptedRequest.url, `/venues/${venueId}/status`);
    assert.equal(interceptedRequest.data.status, 'maintenance');
    assert.equal(res.success, true);
  });

  test('6. archiveVenue calls DELETE /venues/:id for safe soft-deletion', async () => {
    const venueId = '671d0e1234567890abcdef12';
    const res = await venueService.archiveVenue(venueId);

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.method, 'DELETE');
    assert.equal(interceptedRequest.url, `/venues/${venueId}`);
    assert.equal(res.success, true);
  });
});
