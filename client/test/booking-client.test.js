import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  bookingService,
  BOOKING_STATUS,
  extractErrorMessage
} from '../src/services/bookingService.js';
import api from '../src/services/api.js';

describe('Frontend Booking Service & Parameter Serialization Tests', () => {
  let interceptedRequest = null;

  // Preserve original API methods to guarantee test isolation
  const originalGet = api.get;
  const originalPost = api.post;
  const originalPut = api.put;
  const originalPatch = api.patch;
  const originalDelete = api.delete;

  beforeEach(() => {
    interceptedRequest = null;

    api.get = async (url, config) => {
      interceptedRequest = { method: 'GET', url, config };
      if (url.startsWith('/bookings/')) {
        const id = url.replace('/bookings/', '');
        return {
          data: {
            success: true,
            data: {
              id,
              status: 'pending',
              event: { id: 'evt_101', title: 'Campus Hackathon' },
              venue: { id: 'ven_202', name: 'Main Auditorium' },
              startDateTime: '2026-11-01T09:00:00.000Z',
              endDateTime: '2026-11-01T17:00:00.000Z'
            }
          }
        };
      }
      return {
        data: {
          success: true,
          count: 1,
          pagination: { total: 1, page: 1, pages: 1, limit: 20 },
          data: [
            {
              id: 'bkg_1',
              status: 'pending',
              event: { id: 'evt_101', title: 'Campus Hackathon' },
              venue: { id: 'ven_202', name: 'Main Auditorium' }
            }
          ]
        }
      };
    };

    api.post = async (url, data) => {
      interceptedRequest = { method: 'POST', url, data };
      return {
        data: {
          success: true,
          message: 'Venue booking request submitted successfully.',
          data: { id: 'bkg_new', ...data, status: 'pending' }
        }
      };
    };

    api.patch = async (url, data) => {
      interceptedRequest = { method: 'PATCH', url, data };
      if (url.endsWith('/approve')) {
        return {
          data: {
            success: true,
            message: 'Venue booking request approved successfully.',
            data: { id: 'bkg_app', status: 'approved' }
          }
        };
      }
      if (url.endsWith('/reject')) {
        return {
          data: {
            success: true,
            message: 'Venue booking request rejected.',
            data: { id: 'bkg_rej', status: 'rejected', ...(data || {}) }
          }
        };
      }
      if (url.endsWith('/cancel')) {
        return {
          data: {
            success: true,
            message: 'Venue booking cancelled successfully.',
            data: { id: 'bkg_can', status: 'cancelled' }
          }
        };
      }
      return { data: { success: true, message: 'Status updated' } };
    };
  });

  afterEach(() => {
    // Restore original API methods to prevent any state leakage
    api.get = originalGet;
    api.post = originalPost;
    api.put = originalPut;
    api.patch = originalPatch;
    api.delete = originalDelete;
  });

  test('1. BOOKING_STATUS constant exports required lifecycle states', () => {
    assert.ok(Array.isArray(BOOKING_STATUS), 'BOOKING_STATUS must be an array');
    assert.deepEqual(BOOKING_STATUS, ['pending', 'approved', 'rejected', 'cancelled']);
  });

  test('2. getBookings lists bookings with query parameters', async () => {
    const params = {
      status: 'pending',
      venue: 'ven_202',
      event: 'evt_101',
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2026-11-01T23:59:59.000Z',
      page: 2,
      limit: 25
    };

    const res = await bookingService.getBookings(params);

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.method, 'GET');
    assert.equal(interceptedRequest.url, '/bookings');
    assert.deepEqual(interceptedRequest.config.params, params);
    assert.equal(res.success, true);
    assert.equal(res.count, 1);
    assert.ok(Array.isArray(res.data));
  });

  test('3. getBookings cleans empty and undefined parameters without removing valid falsy values', async () => {
    await bookingService.getBookings({
      status: 'approved',
      emptyParam: '',
      nullParam: null,
      undefinedParam: undefined,
      page: 1,
      limit: 10
    });

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.method, 'GET');
    assert.equal(interceptedRequest.url, '/bookings');
    const p = interceptedRequest.config.params;
    assert.equal(p.status, 'approved');
    assert.equal(p.page, 1);
    assert.equal(p.limit, 10);
    assert.equal(Object.prototype.hasOwnProperty.call(p, 'emptyParam'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(p, 'nullParam'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(p, 'undefinedParam'), false);
  });

  test('4. getBookingById fetches details of a single booking by ID', async () => {
    const bookingId = '671e0f1234567890abcdef99';
    const booking = await bookingService.getBookingById(bookingId);

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.method, 'GET');
    assert.equal(interceptedRequest.url, `/bookings/${bookingId}`);
    assert.equal(booking.id, bookingId);
    assert.equal(booking.status, 'pending');
    assert.equal(booking.venue.name, 'Main Auditorium');
  });

  test('5. createBooking sends POST request with correct payload', async () => {
    const payload = {
      event: 'evt_101',
      venue: 'ven_202',
      startDateTime: '2026-11-01T08:00:00.000Z',
      endDateTime: '2026-11-01T18:00:00.000Z',
      purpose: 'Annual Hackathon Keynote',
      notes: 'Requires audio setup'
    };

    const res = await bookingService.createBooking(payload);

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.method, 'POST');
    assert.equal(interceptedRequest.url, '/bookings');
    assert.deepEqual(interceptedRequest.data, payload);
    assert.equal(res.success, true);
    assert.equal(res.data.id, 'bkg_new');
    assert.equal(res.data.purpose, 'Annual Hackathon Keynote');
  });

  test('6. approveBooking sends PATCH request to /bookings/:id/approve', async () => {
    const bookingId = 'bkg_to_approve';
    const res = await bookingService.approveBooking(bookingId);

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.method, 'PATCH');
    assert.equal(interceptedRequest.url, `/bookings/${bookingId}/approve`);
    assert.equal(res.success, true);
    assert.equal(res.data.status, 'approved');
  });

  test('7a. rejectBooking sends PATCH request with rejectionReason string', async () => {
    const bookingId = 'bkg_to_reject';
    const reason = 'Campus auditorium is reserved for academic convocation.';

    const res = await bookingService.rejectBooking(bookingId, reason);

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.method, 'PATCH');
    assert.equal(interceptedRequest.url, `/bookings/${bookingId}/reject`);
    assert.deepEqual(interceptedRequest.data, { rejectionReason: reason });
    assert.equal(res.success, true);
    assert.equal(res.data.status, 'rejected');
  });

  test('7b. rejectBooking handles rejectionReason object payload', async () => {
    const bookingId = 'bkg_to_reject_obj';
    const payload = { rejectionReason: 'Facility undergoing maintenance' };

    const res = await bookingService.rejectBooking(bookingId, payload);

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.method, 'PATCH');
    assert.equal(interceptedRequest.url, `/bookings/${bookingId}/reject`);
    assert.deepEqual(interceptedRequest.data, payload);
    assert.equal(res.success, true);
    assert.equal(res.data.status, 'rejected');
  });

  test('8. cancelBooking sends PATCH request to /bookings/:id/cancel', async () => {
    const bookingId = 'bkg_to_cancel';
    const res = await bookingService.cancelBooking(bookingId);

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.method, 'PATCH');
    assert.equal(interceptedRequest.url, `/bookings/${bookingId}/cancel`);
    assert.equal(res.success, true);
    assert.equal(res.data.status, 'cancelled');
  });

  test('9. extractErrorMessage handles HTTP 409 booking conflict error', () => {
    const conflictMessage =
      'Double-booking conflict: This venue already has an approved booking overlapping this time interval (Conflicting Booking ID: bkg_conflict_77).';

    const conflictError = {
      response: {
        status: 409,
        data: {
          success: false,
          message: conflictMessage
        }
      }
    };

    const extracted = extractErrorMessage(conflictError, 'Failed to process booking.');
    assert.equal(extracted, conflictMessage);
  });

  test('10. extractErrorMessage falls back to default message or network error', () => {
    const networkError = new Error('Network Error');
    const networkMsg = extractErrorMessage(networkError);
    assert.match(networkMsg, /unable to connect to the server/i);

    const fallbackMsg = extractErrorMessage(null, 'Custom default failure message.');
    assert.equal(fallbackMsg, 'Custom default failure message.');
  });
});
