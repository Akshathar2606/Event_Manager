import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  areIntervalsConflicting,
  detectBookingConflicts,
  validateRejectionReason,
  formatDisplayDate
} from '../src/utils/bookingUtils.js';
import { bookingService, extractErrorMessage } from '../src/services/bookingService.js';
import api from '../src/services/api.js';

describe('Administrator Venue Booking Dashboard Unit Tests', () => {
  describe('1. Interval Overlap & Double-Booking Logic (areIntervalsConflicting)', () => {
    const start = '2026-11-20T10:00:00.000Z';
    const end = '2026-11-20T14:00:00.000Z';

    test('detects overlapping intervals when startA < endB AND endA > startB', () => {
      // Overlap: 11:00 - 15:00
      const overlapStart = '2026-11-20T11:00:00.000Z';
      const overlapEnd = '2026-11-20T15:00:00.000Z';
      assert.equal(areIntervalsConflicting(start, end, overlapStart, overlapEnd), true);
    });

    test('detects enclosed intervals (one within another)', () => {
      // Inner: 11:00 - 13:00
      const innerStart = '2026-11-20T11:00:00.000Z';
      const innerEnd = '2026-11-20T13:00:00.000Z';
      assert.equal(areIntervalsConflicting(start, end, innerStart, innerEnd), true);
      assert.equal(areIntervalsConflicting(innerStart, innerEnd, start, end), true);
    });

    test('adjacent intervals do NOT conflict (10:00-14:00 and 14:00-18:00)', () => {
      const adjacentStart = '2026-11-20T14:00:00.000Z';
      const adjacentEnd = '2026-11-20T18:00:00.000Z';
      assert.equal(areIntervalsConflicting(start, end, adjacentStart, adjacentEnd), false);
      assert.equal(areIntervalsConflicting(adjacentStart, adjacentEnd, start, end), false);
    });

    test('completely separate time slots do NOT conflict', () => {
      const futureStart = '2026-11-21T10:00:00.000Z';
      const futureEnd = '2026-11-21T14:00:00.000Z';
      assert.equal(areIntervalsConflicting(start, end, futureStart, futureEnd), false);
    });

    test('invalid or missing dates return false safely', () => {
      assert.equal(areIntervalsConflicting(null, end, start, end), false);
      assert.equal(areIntervalsConflicting(start, undefined, start, end), false);
      assert.equal(areIntervalsConflicting(start, end, 'invalid', end), false);
    });
  });

  describe('2. Advisory Conflict Detection (detectBookingConflicts)', () => {
    const venueA = 'ven_auditorium_01';
    const venueB = 'ven_lab_02';

    const targetBooking = {
      id: 'bkg_target',
      venue: { id: venueA, name: 'Main Auditorium' },
      startDateTime: '2026-11-25T09:00:00.000Z',
      endDateTime: '2026-11-25T13:00:00.000Z',
      status: 'pending'
    };

    test('identifies approved booking conflict at same venue during overlapping time', () => {
      const allBookings = [
        targetBooking,
        {
          id: 'bkg_approved_conflict',
          venue: venueA,
          startDateTime: '2026-11-25T11:00:00.000Z',
          endDateTime: '2026-11-25T15:00:00.000Z',
          status: 'approved',
          event: { title: 'Robotics Workshop' }
        }
      ];

      const res = detectBookingConflicts(targetBooking, allBookings);
      assert.equal(res.hasApprovedConflict, true);
      assert.equal(res.approvedConflicts.length, 1);
      assert.equal(res.approvedConflicts[0].id, 'bkg_approved_conflict');
      assert.equal(res.hasPendingConflict, false);
    });

    test('identifies competing pending request at same venue during overlapping time', () => {
      const allBookings = [
        targetBooking,
        {
          id: 'bkg_pending_competing',
          venue: venueA,
          startDateTime: '2026-11-25T10:00:00.000Z',
          endDateTime: '2026-11-25T12:00:00.000Z',
          status: 'pending',
          event: { title: 'Guest Lecture' }
        }
      ];

      const res = detectBookingConflicts(targetBooking, allBookings);
      assert.equal(res.hasApprovedConflict, false);
      assert.equal(res.hasPendingConflict, true);
      assert.equal(res.pendingConflicts.length, 1);
      assert.equal(res.pendingConflicts[0].id, 'bkg_pending_competing');
    });

    test('ignores cancelled or rejected bookings from active conflicts', () => {
      const allBookings = [
        targetBooking,
        {
          id: 'bkg_cancelled',
          venue: venueA,
          startDateTime: '2026-11-25T09:00:00.000Z',
          endDateTime: '2026-11-25T13:00:00.000Z',
          status: 'cancelled',
          event: { title: 'Cancelled Seminar' }
        },
        {
          id: 'bkg_rejected',
          venue: venueA,
          startDateTime: '2026-11-25T09:00:00.000Z',
          endDateTime: '2026-11-25T13:00:00.000Z',
          status: 'rejected',
          event: { title: 'Rejected Gathering' }
        }
      ];

      const res = detectBookingConflicts(targetBooking, allBookings);
      assert.equal(res.hasApprovedConflict, false);
      assert.equal(res.hasPendingConflict, false);
      assert.equal(res.approvedConflicts.length, 0);
      assert.equal(res.pendingConflicts.length, 0);
    });

    test('avoids falsely marking a booking as conflicting with itself', () => {
      const approvedBooking = {
        id: 'bkg_self_approved',
        venue: venueA,
        startDateTime: '2026-11-25T09:00:00.000Z',
        endDateTime: '2026-11-25T13:00:00.000Z',
        status: 'approved'
      };

      const allBookings = [approvedBooking];
      const res = detectBookingConflicts(approvedBooking, allBookings);
      assert.equal(res.hasApprovedConflict, false);
      assert.equal(res.hasPendingConflict, false);
    });

    test('does not report conflict if times overlap but venues are different', () => {
      const otherVenueBooking = {
        id: 'bkg_diff_venue',
        venue: venueB, // Different venue!
        startDateTime: '2026-11-25T09:00:00.000Z',
        endDateTime: '2026-11-25T13:00:00.000Z',
        status: 'approved'
      };

      const allBookings = [targetBooking, otherVenueBooking];
      const res = detectBookingConflicts(targetBooking, allBookings);
      assert.equal(res.hasApprovedConflict, false);
      assert.equal(res.hasPendingConflict, false);
    });
  });

  describe('3. Rejection Reason Validation (validateRejectionReason)', () => {
    test('requires a non-empty string', () => {
      assert.equal(validateRejectionReason('').isValid, false);
      assert.equal(validateRejectionReason('   ').isValid, false);
      assert.equal(validateRejectionReason(null).isValid, false);
      assert.equal(validateRejectionReason(undefined).isValid, false);
    });

    test('accepts valid reason and trims extraneous surrounding whitespace', () => {
      const valid = '  Auditorium reserved for faculty convocation.  ';
      const res = validateRejectionReason(valid);
      assert.equal(res.isValid, true);
      assert.equal(res.sanitized, 'Auditorium reserved for faculty convocation.');
      assert.equal(res.error, null);
    });

    test('enforces maximum length of 1000 characters', () => {
      const longReason = 'A'.repeat(1001);
      const res = validateRejectionReason(longReason);
      assert.equal(res.isValid, false);
      assert.match(res.error, /cannot exceed 1000 characters/i);

      const maxReason = 'B'.repeat(1000);
      assert.equal(validateRejectionReason(maxReason).isValid, true);
    });
  });

  describe('4. Administrator Approval & Conflict API Workflow', () => {
    let interceptedRequest = null;
    const originalPatch = api.patch;
    const originalGet = api.get;

    beforeEach(() => {
      interceptedRequest = null;
    });

    afterEach(() => {
      api.patch = originalPatch;
      api.get = originalGet;
    });

    test('approveBooking sends PATCH to /bookings/:id/approve', async () => {
      api.patch = async (url) => {
        interceptedRequest = { method: 'PATCH', url };
        return {
          data: {
            success: true,
            message: 'Venue booking request approved successfully.',
            data: { id: 'bkg_123', status: 'approved' }
          }
        };
      };

      const res = await bookingService.approveBooking('bkg_123');
      assert.equal(interceptedRequest.method, 'PATCH');
      assert.equal(interceptedRequest.url, '/bookings/bkg_123/approve');
      assert.equal(res.success, true);
      assert.equal(res.data.status, 'approved');
    });

    test('extractErrorMessage extracts 409 double-booking conflict response', () => {
      const conflictMsg =
        'Double-booking conflict: The venue is already approved for another event during this time interval.';
      const conflictError = {
        response: {
          status: 409,
          data: {
            success: false,
            message: conflictMsg,
            conflict: {
              bookingId: 'bkg_competing',
              eventId: 'evt_competing',
              startDateTime: '2026-11-25T10:00:00.000Z',
              endDateTime: '2026-11-25T12:00:00.000Z'
            }
          }
        }
      };

      const extracted = extractErrorMessage(conflictError, 'Failed to approve booking.');
      assert.equal(extracted, conflictMsg);
    });

    test('rejectBooking sends PATCH to /bookings/:id/reject with rejectionReason payload', async () => {
      api.patch = async (url, payload) => {
        interceptedRequest = { method: 'PATCH', url, payload };
        return {
          data: {
            success: true,
            message: 'Venue booking request rejected.',
            data: { id: 'bkg_456', status: 'rejected', rejectionReason: payload.rejectionReason }
          }
        };
      };

      const reason = 'Maintenance scheduled on audio/video equipment.';
      const res = await bookingService.rejectBooking('bkg_456', reason);

      assert.equal(interceptedRequest.method, 'PATCH');
      assert.equal(interceptedRequest.url, '/bookings/bkg_456/reject');
      assert.deepEqual(interceptedRequest.payload, { rejectionReason: reason });
      assert.equal(res.success, true);
      assert.equal(res.data.status, 'rejected');
      assert.equal(res.data.rejectionReason, reason);
    });
  });

  describe('5. Administrator Dashboard Filter & Search Logic', () => {
    const mockBookings = [
      {
        id: 'b1',
        status: 'pending',
        event: { title: 'AI Symposium', category: 'technology' },
        venue: { name: 'Auditorium Alpha', location: 'North Campus' },
        organizer: { name: 'Dr. Sarah Connor', email: 'sarah@campus.edu', organization: 'Robotics Club' },
        purpose: 'Keynote and paper presentation'
      },
      {
        id: 'b2',
        status: 'approved',
        event: { title: 'Campus Hackathon', category: 'competition' },
        venue: { name: 'Innovation Lab', location: 'Tech Park' },
        organizer: { name: 'Alex Rivera', email: 'alex@campus.edu', organization: 'Developers Guild' },
        purpose: '24-hour programming hackathon'
      },
      {
        id: 'b3',
        status: 'rejected',
        event: { title: 'Rock Concert', category: 'cultural' },
        venue: { name: 'Auditorium Alpha', location: 'North Campus' },
        organizer: { name: 'John Matrix', email: 'john@campus.edu', organization: 'Music Society' },
        purpose: 'Band performance'
      },
      {
        id: 'b4',
        status: 'cancelled',
        event: { title: 'Chess Tournament', category: 'sports' },
        venue: { name: 'Student Lounge', location: 'Student Center' },
        organizer: { name: 'Beth Harmon', email: 'beth@campus.edu', organization: 'Chess Club' },
        purpose: 'Blitz championship'
      }
    ];

    test('filters bookings by status tab correctly', () => {
      const pendingOnly = mockBookings.filter((b) => b.status === 'pending');
      assert.equal(pendingOnly.length, 1);
      assert.equal(pendingOnly[0].id, 'b1');

      const approvedOnly = mockBookings.filter((b) => b.status === 'approved');
      assert.equal(approvedOnly.length, 1);
      assert.equal(approvedOnly[0].id, 'b2');

      const rejectedOnly = mockBookings.filter((b) => b.status === 'rejected');
      assert.equal(rejectedOnly.length, 1);
      assert.equal(rejectedOnly[0].id, 'b3');
    });

    test('calculates accurate status counts across all bookings', () => {
      const counts = {
        all: mockBookings.length,
        pending: mockBookings.filter((b) => b.status === 'pending').length,
        approved: mockBookings.filter((b) => b.status === 'approved').length,
        rejected: mockBookings.filter((b) => b.status === 'rejected').length,
        cancelled: mockBookings.filter((b) => b.status === 'cancelled').length
      };

      assert.equal(counts.all, 4);
      assert.equal(counts.pending, 1);
      assert.equal(counts.approved, 1);
      assert.equal(counts.rejected, 1);
      assert.equal(counts.cancelled, 1);
    });

    test('search query matches event title, venue name, organizer name, and location', () => {
      const search = (term) => {
        const t = term.toLowerCase();
        return mockBookings.filter((b) => {
          return (
            (b.event?.title || '').toLowerCase().includes(t) ||
            (b.venue?.name || '').toLowerCase().includes(t) ||
            (b.venue?.location || '').toLowerCase().includes(t) ||
            (b.organizer?.name || '').toLowerCase().includes(t) ||
            (b.organizer?.email || '').toLowerCase().includes(t) ||
            (b.organizer?.organization || '').toLowerCase().includes(t) ||
            (b.purpose || '').toLowerCase().includes(t)
          );
        });
      };

      // Match by event title
      assert.equal(search('Symposium').length, 1);
      assert.equal(search('Symposium')[0].id, 'b1');

      // Match by venue name
      assert.equal(search('Auditorium').length, 2); // b1 and b3

      // Match by venue location
      assert.equal(search('Tech Park').length, 1);
      assert.equal(search('Tech Park')[0].id, 'b2');

      // Match by organizer name
      assert.equal(search('Sarah').length, 1);
      assert.equal(search('Sarah')[0].id, 'b1');

      // Match by organizer email
      assert.equal(search('beth@campus.edu').length, 1);
      assert.equal(search('beth@campus.edu')[0].id, 'b4');

      // Match by purpose keyword
      assert.equal(search('hackathon').length, 1);
      assert.equal(search('hackathon')[0].id, 'b2');

      // Non-matching term
      assert.equal(search('nonexistent keyword').length, 0);
    });
  });

  describe('6. Administrator Queue Pagination & Total Count Integrity', () => {
    let interceptedRequest = null;
    const originalGet = api.get;

    beforeEach(() => {
      interceptedRequest = null;
    });

    afterEach(() => {
      api.get = originalGet;
    });

    test('getBookings sends page, limit, and status parameters to /bookings', async () => {
      api.get = async (url, config) => {
        interceptedRequest = { method: 'GET', url, config };
        return {
          data: {
            success: true,
            count: 10,
            pagination: { total: 45, page: 2, pages: 5, limit: 10 },
            data: []
          }
        };
      };

      const res = await bookingService.getBookings({ page: 2, limit: 10, status: 'pending' });

      assert.equal(interceptedRequest.method, 'GET');
      assert.equal(interceptedRequest.url, '/bookings');
      assert.deepEqual(interceptedRequest.config.params, {
        page: 2,
        limit: 10,
        status: 'pending'
      });
      assert.equal(res.pagination.total, 45);
      assert.equal(res.pagination.pages, 5);
      assert.equal(res.pagination.page, 2);
    });

    test('distinguishes database total from loaded page size', () => {
      const serverResponse = {
        success: true,
        count: 10, // records on current page
        pagination: { total: 125, page: 1, pages: 13, limit: 10 }, // total across database
        data: new Array(10).fill({ id: 'bkg' })
      };

      const pageCount = serverResponse.data.length;
      const databaseTotal = serverResponse.pagination.total;

      assert.equal(pageCount, 10);
      assert.equal(databaseTotal, 125);
      assert.notEqual(pageCount, databaseTotal);

      // Verify item range display calculation
      const page = serverResponse.pagination.page;
      const limit = serverResponse.pagination.limit;
      const startItem = (page - 1) * limit + 1;
      const endItem = Math.min(page * limit, databaseTotal);

      assert.equal(startItem, 1);
      assert.equal(endItem, 10);

      // Verify page 2 range
      const page2 = 2;
      const startItemP2 = (page2 - 1) * limit + 1;
      const endItemP2 = Math.min(page2 * limit, databaseTotal);

      assert.equal(startItemP2, 11);
      assert.equal(endItemP2, 20);

      // Verify final page range (page 13)
      const page13 = 13;
      const startItemP13 = (page13 - 1) * limit + 1;
      const endItemP13 = Math.min(page13 * limit, databaseTotal);

      assert.equal(startItemP13, 121);
      assert.equal(endItemP13, 125); // exactly 125, not 130!
    });

    test('advisory conflict detection checks across current page and cached approved bookings', () => {
      const venueId = 'ven_shared_arena';
      const pendingTarget = {
        id: 'bkg_page1_item',
        venue: venueId,
        startDateTime: '2026-12-01T10:00:00.000Z',
        endDateTime: '2026-12-01T14:00:00.000Z',
        status: 'pending'
      };

      // Current page only has pending items
      const currentPageBookings = [
        pendingTarget,
        {
          id: 'bkg_page1_item_2',
          venue: 'ven_other',
          startDateTime: '2026-12-01T10:00:00.000Z',
          endDateTime: '2026-12-01T14:00:00.000Z',
          status: 'pending'
        }
      ];

      // Cached approved bookings from the database
      const cachedApprovedBookings = [
        {
          id: 'bkg_approved_on_another_page',
          venue: venueId,
          startDateTime: '2026-12-01T12:00:00.000Z', // Overlaps 12:00-16:00
          endDateTime: '2026-12-01T16:00:00.000Z',
          status: 'approved',
          event: { title: 'Annual Esports Final' }
        }
      ];

      // Combined comparison list
      const comparisonList = [...currentPageBookings, ...cachedApprovedBookings];
      const conflicts = detectBookingConflicts(pendingTarget, comparisonList);

      assert.equal(conflicts.hasApprovedConflict, true);
      assert.equal(conflicts.approvedConflicts.length, 1);
      assert.equal(conflicts.approvedConflicts[0].id, 'bkg_approved_on_another_page');
    });
  });
});
