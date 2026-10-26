import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  doesBookingCoverEvent,
  toDatetimeLocal,
  formatDisplayDate,
  evaluateBookingEligibility,
  isBookingCancellable
} from '../src/utils/bookingUtils.js';

describe('Organizer Venue Booking Workflow Unit Tests', () => {
  describe('1. Booking Schedule Interval Coverage (doesBookingCoverEvent)', () => {
    const eventStart = '2026-11-15T10:00:00.000Z';
    const eventEnd = '2026-11-15T16:00:00.000Z';

    test('exact matching interval covers the event', () => {
      assert.equal(
        doesBookingCoverEvent(eventStart, eventEnd, eventStart, eventEnd),
        true
      );
    });

    test('wider booking window with early setup and late teardown covers the event', () => {
      const bookingStart = '2026-11-15T09:00:00.000Z'; // 1 hr earlier
      const bookingEnd = '2026-11-15T17:00:00.000Z';   // 1 hr later
      assert.equal(
        doesBookingCoverEvent(bookingStart, bookingEnd, eventStart, eventEnd),
        true
      );
    });

    test('booking starting after event start does not cover the event', () => {
      const lateStart = '2026-11-15T10:30:00.000Z';
      assert.equal(
        doesBookingCoverEvent(lateStart, eventEnd, eventStart, eventEnd),
        false
      );
    });

    test('booking ending before event end does not cover the event', () => {
      const earlyEnd = '2026-11-15T15:30:00.000Z';
      assert.equal(
        doesBookingCoverEvent(eventStart, earlyEnd, eventStart, eventEnd),
        false
      );
    });

    test('missing or invalid date inputs return false', () => {
      assert.equal(doesBookingCoverEvent(null, eventEnd, eventStart, eventEnd), false);
      assert.equal(doesBookingCoverEvent(eventStart, undefined, eventStart, eventEnd), false);
      assert.equal(doesBookingCoverEvent('invalid-date', eventEnd, eventStart, eventEnd), false);
    });
  });

  describe('2. Datetime Local Formatter (toDatetimeLocal)', () => {
    test('converts ISO timestamp to YYYY-MM-DDTHH:mm format', () => {
      const iso = '2026-11-15T14:30:00.000Z';
      const formatted = toDatetimeLocal(iso);
      assert.match(formatted, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });

    test('returns empty string for null, undefined, or invalid date input', () => {
      assert.equal(toDatetimeLocal(null), '');
      assert.equal(toDatetimeLocal(undefined), '');
      assert.equal(toDatetimeLocal('not-a-date'), '');
    });
  });

  describe('3. Display Date Formatter (formatDisplayDate)', () => {
    test('formats valid ISO date string into readable text', () => {
      const iso = '2026-11-15T10:00:00.000Z';
      const formatted = formatDisplayDate(iso);
      assert.ok(formatted.includes('2026'));
      assert.ok(formatted.includes('Nov') || formatted.includes('11'));
    });

    test('returns em dash for null or invalid date', () => {
      assert.equal(formatDisplayDate(null), '—');
      assert.equal(formatDisplayDate(''), '—');
      assert.equal(formatDisplayDate('invalid'), '—');
    });
  });

  describe('4. Organizer Booking Eligibility & Capacity Rules (evaluateBookingEligibility)', () => {
    const venue = { id: 'ven_1', name: 'Main Hall', capacity: 200 };

    test('excludes cancelled events from eligibility', () => {
      const cancelledEvent = { id: 'e3', title: 'Old Seminar', status: 'cancelled', capacity: 50 };
      const res = evaluateBookingEligibility(cancelledEvent, venue.id, venue.capacity);
      assert.equal(res.isEligible, false);
    });

    test('identifies when event has no venue assigned yet (eligible for auto-assignment)', () => {
      const eventWithNoVenue = { id: 'e1', title: 'Hackathon', status: 'draft', venue: null, capacity: 150 };
      const res = evaluateBookingEligibility(eventWithNoVenue, venue.id, venue.capacity);
      assert.equal(res.isEligible, true);
      assert.equal(res.hasDifferentVenue, false);
      assert.equal(res.isCapacityExceeded, false);
    });

    test('identifies when event is already assigned to the target venue', () => {
      const eventWithSameVenue = { id: 'e2', title: 'Tech Talk', status: 'published', venue: 'ven_1', capacity: 80 };
      const res = evaluateBookingEligibility(eventWithSameVenue, venue.id, venue.capacity);
      assert.equal(res.isEligible, true);
      assert.equal(res.hasDifferentVenue, false);
    });

    test('flags when an event is assigned to a different venue', () => {
      const eventWithDifferentVenue = { id: 'e4', title: 'Symposium', status: 'draft', venue: 'ven_99', capacity: 100 };
      const res = evaluateBookingEligibility(eventWithDifferentVenue, venue.id, venue.capacity);
      assert.equal(res.isEligible, false);
      assert.equal(res.hasDifferentVenue, true);
    });

    test('detects when event capacity exceeds venue capacity', () => {
      const largeEvent = { id: 'e5', title: 'Mass Gathering', status: 'draft', venue: null, capacity: 350 };
      const res = evaluateBookingEligibility(largeEvent, venue.id, venue.capacity);
      assert.equal(res.isCapacityExceeded, true);
    });
  });

  describe('5. Organizer Booking Cancellation Permissions (isBookingCancellable)', () => {
    test('allows cancellation only for pending and approved bookings', () => {
      assert.equal(isBookingCancellable('pending'), true);
      assert.equal(isBookingCancellable('approved'), true);
      assert.equal(isBookingCancellable('rejected'), false);
      assert.equal(isBookingCancellable('cancelled'), false);
      assert.equal(isBookingCancellable('unknown'), false);
    });

    test('detects approved booking for published event requiring demote-to-draft warning', () => {
      const bkg1 = { status: 'approved', event: { status: 'published', title: 'AI Summit' } };
      const bkg2 = { status: 'approved', event: { status: 'draft', title: 'Workshop' } };
      const bkg3 = { status: 'pending', event: { status: 'draft', title: 'Orientation' } };

      const needsDraftWarning = (b) => b.status === 'approved' && b.event?.status === 'published';

      assert.equal(needsDraftWarning(bkg1), true);
      assert.equal(needsDraftWarning(bkg2), false);
      assert.equal(needsDraftWarning(bkg3), false);
    });
  });
});
