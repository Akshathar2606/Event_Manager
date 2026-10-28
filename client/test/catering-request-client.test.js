import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  cateringRequestService,
  CATERING_REQUEST_STATUS,
  extractErrorMessage
} from '../src/services/cateringRequestService.js';
import {
  isEventStarted,
  isCateringRequestCancellable,
  getCateringRequestStatusBadge,
  calculateEstimatedQuote,
  validateRejectionReason,
  validateCateringRequestForm,
  formatDisplayDate,
  formatDisplayDateTime
} from '../src/utils/cateringRequestUtils.js';
import api from '../src/services/api.js';

describe('EventFlow Catering Request Frontend Service & Workflow Unit Tests', () => {
  let interceptedRequest = null;
  const originalGet = api.get;
  const originalPost = api.post;
  const originalPatch = api.patch;

  afterEach(() => {
    api.get = originalGet;
    api.post = originalPost;
    api.patch = originalPatch;
  });

  beforeEach(() => {
    interceptedRequest = null;

    api.get = async (url, config) => {
      interceptedRequest = { method: 'GET', url, config };
      if (url.startsWith('/catering-requests/incoming')) {
        return {
          data: {
            success: true,
            count: 1,
            pagination: { total: 1, page: 1, pages: 1, limit: 10 },
            data: [
              {
                id: 'req_vendor_1',
                guestCount: 50,
                pricePerPlate: 25.5,
                quotedPrice: 1275,
                status: 'pending'
              }
            ]
          }
        };
      }
      if (url === '/catering-requests') {
        return {
          data: {
            success: true,
            count: 2,
            pagination: { total: 2, page: 1, pages: 1, limit: 10 },
            data: [
              {
                id: 'req_org_1',
                guestCount: 30,
                pricePerPlate: 20,
                quotedPrice: 600,
                status: 'pending'
              },
              {
                id: 'req_org_2',
                guestCount: 40,
                pricePerPlate: 25.5,
                quotedPrice: 1020,
                status: 'accepted'
              }
            ]
          }
        };
      }
      if (url.startsWith('/catering-requests/')) {
        const id = url.split('/').pop();
        return {
          data: {
            success: true,
            data: {
              id,
              guestCount: 45,
              pricePerPlate: 22,
              quotedPrice: 990,
              status: 'pending'
            }
          }
        };
      }
      return { data: { success: true, data: [] } };
    };

    api.post = async (url, data) => {
      interceptedRequest = { method: 'POST', url, data };
      return {
        data: {
          success: true,
          message: 'Catering request submitted successfully.',
          data: {
            id: 'req_new_1',
            ...data,
            pricePerPlate: 25.5,
            quotedPrice: Math.round(25.5 * Number(data.guestCount) * 100) / 100,
            status: 'pending',
            createdAt: new Date().toISOString()
          }
        }
      };
    };

    api.patch = async (url, data) => {
      interceptedRequest = { method: 'PATCH', url, data };
      return {
        data: {
          success: true,
          message: 'Status updated successfully.',
          data: {
            id: url.split('/')[2],
            ...data
          }
        }
      };
    };
  });

  describe('1. Business Rules & Helper Utilities (cateringRequestUtils)', () => {
    test('CATERING_REQUEST_STATUS contains all 4 standard lifecycle states', () => {
      assert.deepEqual(CATERING_REQUEST_STATUS, ['pending', 'accepted', 'rejected', 'cancelled']);
    });

    test('isEventStarted detects past, current, and future start timestamps', () => {
      const now = new Date('2026-11-01T12:00:00.000Z');

      assert.equal(isEventStarted('2026-11-01T10:00:00.000Z', now), true);
      assert.equal(isEventStarted('2026-11-01T12:00:00.000Z', now), true);
      assert.equal(isEventStarted('2026-11-01T14:00:00.000Z', now), false);
      assert.equal(isEventStarted(null, now), false);
      assert.equal(isEventStarted('invalid', now), false);
    });

    test('isCateringRequestCancellable enforces cancellation policy', () => {
      const now = new Date('2026-11-01T12:00:00.000Z');

      // 1. Pending request is always cancellable
      const pendingReq = { status: 'pending', event: { startDateTime: '2026-11-05T10:00:00.000Z' } };
      assert.equal(isCateringRequestCancellable(pendingReq, null, now).cancellable, true);

      // 2. Accepted request before event start is cancellable
      const acceptedFutureReq = {
        status: 'accepted',
        event: { startDateTime: '2026-11-02T10:00:00.000Z' }
      };
      assert.equal(isCateringRequestCancellable(acceptedFutureReq, null, now).cancellable, true);

      // 3. Accepted request after event has started is NOT cancellable
      const acceptedPastReq = {
        status: 'accepted',
        event: { startDateTime: '2026-11-01T10:00:00.000Z' }
      };
      const pastResult = isCateringRequestCancellable(acceptedPastReq, null, now);
      assert.equal(pastResult.cancellable, false);
      assert.match(pastResult.reason, /already started/i);

      // 4. Cancelled request cannot be cancelled again
      const cancelledReq = { status: 'cancelled' };
      const cancelResult = isCateringRequestCancellable(cancelledReq, null, now);
      assert.equal(cancelResult.cancellable, false);
      assert.match(cancelResult.reason, /already cancelled/i);

      // 5. Rejected request cannot be cancelled
      const rejectedReq = { status: 'rejected' };
      const rejectResult = isCateringRequestCancellable(rejectedReq, null, now);
      assert.equal(rejectResult.cancellable, false);
      assert.match(rejectResult.reason, /already been rejected/i);

      // 6. Missing request handles gracefully
      assert.equal(isCateringRequestCancellable(null).cancellable, false);
    });

    test('getCateringRequestStatusBadge returns distinct presentation attributes', () => {
      const pendingBadge = getCateringRequestStatusBadge('pending');
      assert.equal(pendingBadge.label, 'Pending Review');
      assert.match(pendingBadge.classes, /amber/);

      const acceptedBadge = getCateringRequestStatusBadge('accepted');
      assert.equal(acceptedBadge.label, 'Accepted');
      assert.match(acceptedBadge.classes, /emerald/);

      const rejectedBadge = getCateringRequestStatusBadge('rejected');
      assert.equal(rejectedBadge.label, 'Rejected');
      assert.match(rejectedBadge.classes, /rose/);

      const cancelledBadge = getCateringRequestStatusBadge('cancelled');
      assert.equal(cancelledBadge.label, 'Cancelled');
      assert.match(cancelledBadge.classes, /slate/);

      const unknownBadge = getCateringRequestStatusBadge('unknown');
      assert.equal(unknownBadge.label, 'unknown');
    });

    test('calculateEstimatedQuote calculates rounded non-authoritative client total', () => {
      assert.equal(calculateEstimatedQuote(25.5, 40), 1020);
      assert.equal(calculateEstimatedQuote(12.333, 3), 37);
      assert.equal(calculateEstimatedQuote(0, 50), 0);
      assert.equal(calculateEstimatedQuote(-10, 50), 0);
      assert.equal(calculateEstimatedQuote(25, 0), 0);
      assert.equal(calculateEstimatedQuote('invalid', 50), 0);
    });

    test('validateRejectionReason validates mandatory explanation and enforces 1000 char cap', () => {
      // Empty reason
      const empty1 = validateRejectionReason('');
      assert.equal(empty1.isValid, false);
      assert.match(empty1.error, /required/i);

      // Whitespace only
      const empty2 = validateRejectionReason('   ');
      assert.equal(empty2.isValid, false);

      // Non-string
      const empty3 = validateRejectionReason(null);
      assert.equal(empty3.isValid, false);

      // Valid reason trims whitespace
      const valid = validateRejectionReason('  Kitchen fully booked on this day.  ');
      assert.equal(valid.isValid, true);
      assert.equal(valid.sanitized, 'Kitchen fully booked on this day.');
      assert.equal(valid.error, null);

      // Over 1000 chars rejected
      const longText = 'a'.repeat(1005);
      const invalidLong = validateRejectionReason(longText);
      assert.equal(invalidLong.isValid, false);
      assert.match(invalidLong.error, /cannot exceed 1000 characters/i);
    });

    test('validateCateringRequestForm validates required fields, package minOrder, and venue capacity', () => {
      const basePackage = { id: 'pkg_1', name: 'Buffet', minOrder: 25 };
      const baseEvent = { id: 'evt_1', title: 'Tech Expo', capacity: 100 };

      // 1. Valid input
      const resValid = validateCateringRequestForm({
        eventId: baseEvent.id,
        cateringServiceId: 'cat_1',
        packageId: basePackage.id,
        guestCount: 50,
        selectedPackage: basePackage,
        selectedEvent: baseEvent
      });
      assert.equal(resValid.isValid, true);
      assert.equal(resValid.errors.length, 0);

      // 2. Missing event
      const resNoEvent = validateCateringRequestForm({
        eventId: '',
        cateringServiceId: 'cat_1',
        packageId: basePackage.id,
        guestCount: 50,
        selectedPackage: basePackage
      });
      assert.equal(resNoEvent.isValid, false);
      assert.ok(resNoEvent.errors.some((e) => /select an event/i.test(e)));

      // 3. Guest count below package minimum order
      const resBelowMin = validateCateringRequestForm({
        eventId: baseEvent.id,
        cateringServiceId: 'cat_1',
        packageId: basePackage.id,
        guestCount: 15,
        selectedPackage: basePackage,
        selectedEvent: baseEvent
      });
      assert.equal(resBelowMin.isValid, false);
      assert.ok(resBelowMin.errors.some((e) => /below the package minimum order of 25/i.test(e)));

      // 4. Guest count exceeds event capacity
      const resOverCap = validateCateringRequestForm({
        eventId: baseEvent.id,
        cateringServiceId: 'cat_1',
        packageId: basePackage.id,
        guestCount: 150,
        selectedPackage: basePackage,
        selectedEvent: baseEvent
      });
      assert.equal(resOverCap.isValid, false);
      assert.ok(resOverCap.errors.some((e) => /exceeds event venue capacity of 100/i.test(e)));

      // 5. Invalid guest count formats
      const resInvalidCount = validateCateringRequestForm({
        eventId: baseEvent.id,
        cateringServiceId: 'cat_1',
        packageId: basePackage.id,
        guestCount: 'not-a-number'
      });
      assert.equal(resInvalidCount.isValid, false);
      assert.ok(resInvalidCount.errors.some((e) => /Guest count is required/i.test(e)));
    });

    test('formatDisplayDate and formatDisplayDateTime format safe fallback strings', () => {
      assert.equal(formatDisplayDate(null), '—');
      assert.equal(formatDisplayDate('invalid'), '—');
      assert.ok(formatDisplayDate('2026-11-05T10:00:00.000Z').includes('2026'));

      assert.equal(formatDisplayDateTime(null), '—');
      assert.equal(formatDisplayDateTime('invalid'), '—');
      assert.ok(formatDisplayDateTime('2026-11-05T10:00:00.000Z').includes('2026'));
    });
  });

  describe('2. Frontend Catering Request Service (cateringRequestService)', () => {
    test('createCateringRequest sends POST to /catering-requests with valid payload', async () => {
      const payload = {
        eventId: '671d00000000000000000001',
        cateringServiceId: '671d00000000000000000002',
        packageId: '671d00000000000000000003',
        guestCount: 40,
        notes: 'VIP podium setup'
      };

      const res = await cateringRequestService.createCateringRequest(payload);

      assert.ok(interceptedRequest);
      assert.equal(interceptedRequest.method, 'POST');
      assert.equal(interceptedRequest.url, '/catering-requests');
      assert.deepEqual(interceptedRequest.data, payload);

      assert.equal(res.success, true);
      assert.equal(res.data.guestCount, 40);
      assert.equal(res.data.quotedPrice, 1020); // 25.5 * 40
      assert.equal(res.data.status, 'pending');
    });

    test('getOrganizerCateringRequests cleans empty params and requests /catering-requests', async () => {
      const res = await cateringRequestService.getOrganizerCateringRequests({
        page: 2,
        limit: 10,
        status: 'pending',
        eventId: '',
        nullVal: null,
        undefVal: undefined
      });

      assert.ok(interceptedRequest);
      assert.equal(interceptedRequest.method, 'GET');
      assert.equal(interceptedRequest.url, '/catering-requests');

      const params = interceptedRequest.config.params;
      assert.equal(params.page, 2);
      assert.equal(params.limit, 10);
      assert.equal(params.status, 'pending');
      assert.equal(params.eventId, undefined);
      assert.equal(params.nullVal, undefined);
      assert.equal(params.undefVal, undefined);

      assert.equal(res.success, true);
      assert.equal(res.count, 2);
      assert.equal(res.pagination.total, 2);
      assert.equal(res.data.length, 2);
    });

    test('getVendorCateringRequests cleans empty params and requests /catering-requests/incoming', async () => {
      const res = await cateringRequestService.getVendorCateringRequests({
        page: 1,
        limit: 10,
        status: 'pending',
        emptyFilter: ''
      });

      assert.ok(interceptedRequest);
      assert.equal(interceptedRequest.method, 'GET');
      assert.equal(interceptedRequest.url, '/catering-requests/incoming');

      const params = interceptedRequest.config.params;
      assert.equal(params.page, 1);
      assert.equal(params.status, 'pending');
      assert.equal(params.emptyFilter, undefined);

      assert.equal(res.success, true);
      assert.equal(res.count, 1);
      assert.equal(res.pagination.total, 1);
      assert.equal(res.data[0].id, 'req_vendor_1');
    });

    test('getCateringRequestById requests /catering-requests/:id and unwraps data document', async () => {
      const reqId = '671d00000000000000000009';
      const data = await cateringRequestService.getCateringRequestById(reqId);

      assert.ok(interceptedRequest);
      assert.equal(interceptedRequest.method, 'GET');
      assert.equal(interceptedRequest.url, `/catering-requests/${reqId}`);
      assert.equal(data.id, reqId);
      assert.equal(data.quotedPrice, 990);
    });

    test('acceptCateringRequest sends PATCH to /catering-requests/:id/accept with vendor notes', async () => {
      const reqId = '671d00000000000000000010';
      const res = await cateringRequestService.acceptCateringRequest(reqId, 'Arriving at 08:00 AM');

      assert.ok(interceptedRequest);
      assert.equal(interceptedRequest.method, 'PATCH');
      assert.equal(interceptedRequest.url, `/catering-requests/${reqId}/accept`);
      assert.deepEqual(interceptedRequest.data, { notes: 'Arriving at 08:00 AM' });
      assert.equal(res.success, true);
    });

    test('rejectCateringRequest sends PATCH to /catering-requests/:id/reject with rejectionReason', async () => {
      const reqId = '671d00000000000000000011';
      const res = await cateringRequestService.rejectCateringRequest(
        reqId,
        'Kitchen fully committed',
        'Suggest contacting Mario Catering'
      );

      assert.ok(interceptedRequest);
      assert.equal(interceptedRequest.method, 'PATCH');
      assert.equal(interceptedRequest.url, `/catering-requests/${reqId}/reject`);
      assert.deepEqual(interceptedRequest.data, {
        rejectionReason: 'Kitchen fully committed',
        vendorNotes: 'Suggest contacting Mario Catering'
      });
      assert.equal(res.success, true);
    });

    test('cancelCateringRequest sends PATCH to /catering-requests/:id/cancel with optional reason', async () => {
      const reqId = '671d00000000000000000012';
      const res = await cateringRequestService.cancelCateringRequest(
        reqId,
        'Budget constraints'
      );

      assert.ok(interceptedRequest);
      assert.equal(interceptedRequest.method, 'PATCH');
      assert.equal(interceptedRequest.url, `/catering-requests/${reqId}/cancel`);
      assert.deepEqual(interceptedRequest.data, { cancellationReason: 'Budget constraints' });
      assert.equal(res.success, true);
    });
  });

  describe('3. API Error Handling & Guardrails', () => {
    test('extractErrorMessage parses validation error lists', () => {
      const err = {
        response: {
          data: {
            errors: ['Guest count is required.', 'Package ID is invalid.']
          }
        }
      };
      const msg = extractErrorMessage(err);
      assert.match(msg, /Guest count is required/i);
    });

    test('extractErrorMessage parses 403 Forbidden role rejection', () => {
      const err = {
        response: {
          status: 403,
          data: {
            message: 'Forbidden. You are not authorized to respond to this catering request.'
          }
        }
      };
      const msg = extractErrorMessage(err);
      assert.match(msg, /Forbidden.*not authorized/i);
    });

    test('extractErrorMessage parses event already started cancellation error', () => {
      const err = {
        response: {
          status: 400,
          data: {
            message: 'Cannot cancel catering request for an event that has already started.'
          }
        }
      };
      const msg = extractErrorMessage(err);
      assert.match(msg, /already started/i);
    });

    test('extractErrorMessage falls back safely when response is empty', () => {
      const msg1 = extractErrorMessage(new Error('Network Error'));
      assert.match(msg1, /Unable to connect to the server/i);

      const msg2 = extractErrorMessage({}, 'Failed to process catering request.');
      assert.equal(msg2, 'Failed to process catering request.');
    });
  });
});
