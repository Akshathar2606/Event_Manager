import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  registrationService,
  REGISTRATION_STATUS,
  extractErrorMessage
} from '../src/services/registrationService.js';
import {
  isEventStarted,
  isRegistrationDeadlinePassed,
  isEventFull,
  evaluateRegistrationEligibility,
  isRegistrationCancellable,
  getRegistrationStatusBadge,
  ACADEMIC_YEAR_OPTIONS,
  formatAcademicYear,
  formatDisplayDate,
  formatDisplayTime
} from '../src/utils/registrationUtils.js';
import api from '../src/services/api.js';

describe('Participant Registration & Attendee Workflow Tests', () => {
  describe('1. Registration Utilities & Business Rules', () => {
    test('academic years have the four supported labels and legacy registrations are labeled safely', () => {
      assert.deepEqual(ACADEMIC_YEAR_OPTIONS, [
        { value: 'first', label: 'First Year' },
        { value: 'second', label: 'Second Year' },
        { value: 'third', label: 'Third Year' },
        { value: 'fourth', label: 'Fourth Year' }
      ]);
      assert.equal(formatAcademicYear('second'), 'Second Year');
      assert.equal(formatAcademicYear(undefined), 'Not provided');
      assert.equal(formatAcademicYear('graduate'), 'Not provided');
    });

    test('isEventStarted detects whether an event has started', () => {
      const now = new Date('2026-11-01T12:00:00.000Z');

      // Past event
      assert.equal(isEventStarted('2026-11-01T10:00:00.000Z', now), true);
      // Exact same time
      assert.equal(isEventStarted('2026-11-01T12:00:00.000Z', now), true);
      // Future event
      assert.equal(isEventStarted('2026-11-01T14:00:00.000Z', now), false);
      // Missing or invalid
      assert.equal(isEventStarted(null, now), false);
      assert.equal(isEventStarted('invalid-date', now), false);
    });

    test('isRegistrationDeadlinePassed checks deadline expiration', () => {
      const now = new Date('2026-11-01T12:00:00.000Z');

      // Deadline in past
      assert.equal(isRegistrationDeadlinePassed('2026-11-01T10:00:00.000Z', now), true);
      // Deadline in future
      assert.equal(isRegistrationDeadlinePassed('2026-11-01T14:00:00.000Z', now), false);
      // No deadline set
      assert.equal(isRegistrationDeadlinePassed(null, now), false);
      assert.equal(isRegistrationDeadlinePassed(undefined, now), false);
      assert.equal(isRegistrationDeadlinePassed('invalid', now), false);
    });

    test('isEventFull detects capacity limit reached', () => {
      assert.equal(isEventFull(100, 100), true);
      assert.equal(isEventFull(100, 101), true);
      assert.equal(isEventFull(100, 99), false);
      assert.equal(isEventFull(100, 0), false);
      assert.equal(isEventFull(null, 10), false);
    });

    test('evaluateRegistrationEligibility evaluates all gating conditions', () => {
      const now = new Date('2026-11-01T12:00:00.000Z');

      const validEvent = {
        id: 'evt_1',
        title: 'Tech Symposium',
        status: 'published',
        startDateTime: '2026-11-02T10:00:00.000Z',
        endDateTime: '2026-11-02T18:00:00.000Z',
        registrationDeadline: '2026-11-01T23:59:59.000Z',
        capacity: 100,
        registeredCount: 50
      };

      // Fully eligible
      const res1 = evaluateRegistrationEligibility(validEvent, null, now);
      assert.equal(res1.eligible, true);
      assert.equal(res1.reason, null);

      // Null event
      const res2 = evaluateRegistrationEligibility(null, null, now);
      assert.equal(res2.eligible, false);
      assert.equal(res2.code, 'NOT_FOUND');

      // Draft event
      const res3 = evaluateRegistrationEligibility({ ...validEvent, status: 'draft' }, null, now);
      assert.equal(res3.eligible, false);
      assert.equal(res3.code, 'NOT_PUBLISHED');

      // Event already started
      const res4 = evaluateRegistrationEligibility(
        { ...validEvent, startDateTime: '2026-11-01T11:00:00.000Z' },
        null,
        now
      );
      assert.equal(res4.eligible, false);
      assert.equal(res4.code, 'EVENT_STARTED');

      // Deadline passed
      const res5 = evaluateRegistrationEligibility(
        { ...validEvent, registrationDeadline: '2026-11-01T08:00:00.000Z' },
        null,
        now
      );
      assert.equal(res5.eligible, false);
      assert.equal(res5.code, 'DEADLINE_PASSED');

      // Already registered actively
      const res6 = evaluateRegistrationEligibility(validEvent, { status: 'registered' }, now);
      assert.equal(res6.eligible, false);
      assert.equal(res6.code, 'ALREADY_REGISTERED');

      // Previously registered but cancelled (eligible to re-register)
      const res7 = evaluateRegistrationEligibility(validEvent, { status: 'cancelled' }, now);
      assert.equal(res7.eligible, true);

      // Event full
      const res8 = evaluateRegistrationEligibility(
        { ...validEvent, registeredCount: 100 },
        null,
        now
      );
      assert.equal(res8.eligible, false);
      assert.equal(res8.code, 'CAPACITY_FULL');
    });

    test('isRegistrationCancellable enforces lifecycle and start-time rules', () => {
      const now = new Date('2026-11-01T12:00:00.000Z');

      const futureEvent = { startDateTime: '2026-11-02T10:00:00.000Z' };
      const startedEvent = { startDateTime: '2026-11-01T10:00:00.000Z' };

      // Valid active registration for future event
      const c1 = isRegistrationCancellable({ status: 'registered' }, futureEvent, now);
      assert.equal(c1.cancellable, true);
      assert.equal(c1.reason, null);

      // Missing record
      const c2 = isRegistrationCancellable(null, futureEvent, now);
      assert.equal(c2.cancellable, false);

      // Already cancelled
      const c3 = isRegistrationCancellable({ status: 'cancelled' }, futureEvent, now);
      assert.equal(c3.cancellable, false);
      assert.match(c3.reason, /already cancelled/i);

      // Event already started
      const c4 = isRegistrationCancellable({ status: 'registered' }, startedEvent, now);
      assert.equal(c4.cancellable, false);
      assert.match(c4.reason, /already started/i);

      // Embedded event start time in registration
      const c5 = isRegistrationCancellable(
        { status: 'registered', event: startedEvent },
        null,
        now
      );
      assert.equal(c5.cancellable, false);
      assert.match(c5.reason, /already started/i);
    });

    test('getRegistrationStatusBadge provides consistent status presentation', () => {
      const regBadge = getRegistrationStatusBadge('registered');
      assert.equal(regBadge.label, 'Registered');
      assert.match(regBadge.classes, /emerald/i);

      const canBadge = getRegistrationStatusBadge('cancelled');
      assert.equal(canBadge.label, 'Cancelled');
      assert.match(canBadge.classes, /rose/i);

      const defBadge = getRegistrationStatusBadge('pending');
      assert.equal(defBadge.label, 'pending');

      const nullBadge = getRegistrationStatusBadge(null);
      assert.equal(nullBadge.label, 'Unknown');
    });

    test('formatDisplayDate and formatDisplayTime format safely', () => {
      assert.equal(formatDisplayDate(null), '—');
      assert.equal(formatDisplayDate('invalid'), '—');
      assert.equal(typeof formatDisplayDate('2026-11-01T12:00:00.000Z'), 'string');

      assert.equal(formatDisplayTime(null), '');
      assert.equal(formatDisplayTime('invalid'), '');
      assert.equal(typeof formatDisplayTime('2026-11-01T12:00:00.000Z'), 'string');
    });
  });

  describe('2. Frontend Registration Service (registrationService)', () => {
    let interceptedRequest = null;

    const originalGet = api.get;
    const originalPost = api.post;
    const originalPatch = api.patch;

    beforeEach(() => {
      interceptedRequest = null;

      api.get = async (url, config) => {
        interceptedRequest = { method: 'GET', url, config };

        if (url === '/registrations/me') {
          return {
            data: {
              success: true,
              count: 2,
              pagination: { total: 2, page: 1, limit: 10, pages: 1 },
              data: [
                {
                  _id: 'reg_1',
                  status: 'registered',
                  event: { _id: 'evt_1', title: 'Campus Hackathon', capacity: 100 }
                },
                {
                  _id: 'reg_2',
                  status: 'cancelled',
                  event: { _id: 'evt_2', title: 'Music Night', capacity: 200 }
                }
              ]
            }
          };
        }

        if (url.endsWith('/whatsapp-group')) {
          return {
            data: {
              success: true,
              data: { whatsappGroupUrl: 'https://chat.whatsapp.com/InviteCode' }
            }
          };
        }

        if (url.startsWith('/registrations/')) {
          const id = url.replace('/registrations/', '');
          return {
            data: {
              success: true,
              data: {
                _id: id,
                status: 'registered',
                event: { _id: 'evt_1', title: 'Campus Hackathon' }
              }
            }
          };
        }

        if (url.includes('/attendees')) {
          return {
            data: {
              success: true,
              count: 1,
              summary: { totalAll: 3, activeCount: 2, cancelledCount: 1 },
              pagination: { total: 1, page: 1, limit: 15, pages: 1 },
              data: [
                {
                  _id: 'reg_1',
                  status: 'registered',
                  participant: {
                    _id: 'usr_p1',
                    name: 'Alex Participant',
                    email: 'alex@campus.edu'
                  }
                }
              ]
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
            message: 'Successfully registered for event',
            data: {
              _id: 'reg_new',
              event: 'evt_101',
              status: 'registered'
            }
          }
        };
      };

      api.patch = async (url, data) => {
        interceptedRequest = { method: 'PATCH', url, data };
        return {
          data: {
            success: true,
            message: 'Registration successfully cancelled',
            data: {
              _id: url.split('/')[2],
              status: 'cancelled',
              cancellationReason: data?.reason || null
            }
          }
        };
      };
    });

    afterEach(() => {
      api.get = originalGet;
      api.post = originalPost;
      api.patch = originalPatch;
    });

    test('registerForEvent sends POST to /events/:id/register', async () => {
      const res = await registrationService.registerForEvent('evt_101', 'second');

      assert.equal(interceptedRequest.method, 'POST');
      assert.equal(interceptedRequest.url, '/events/evt_101/register');
      assert.deepEqual(interceptedRequest.data, { academicYear: 'second' });
      assert.equal(res.success, true);
      assert.equal(res.data.status, 'registered');
    });

    test('getMyRegistrations cleans params and sends GET to /registrations/me', async () => {
      const res = await registrationService.getMyRegistrations({
        page: 2,
        limit: 10,
        status: 'registered',
        emptyField: '',
        nullField: null,
        undefinedField: undefined
      });

      assert.equal(interceptedRequest.method, 'GET');
      assert.equal(interceptedRequest.url, '/registrations/me');
      assert.deepEqual(interceptedRequest.config.params, {
        page: 2,
        limit: 10,
        status: 'registered'
      });
      assert.equal(res.count, 2);
      assert.equal(res.pagination.total, 2);
      assert.equal(res.data.length, 2);
    });

    test('getWhatsAppGroupLink requests the protected event-specific endpoint', async () => {
      const response = await registrationService.getWhatsAppGroupLink('event_123');
      assert.equal(interceptedRequest.method, 'GET');
      assert.equal(interceptedRequest.url, '/events/event_123/whatsapp-group');
      assert.equal(response.data.whatsappGroupUrl, 'https://chat.whatsapp.com/InviteCode');
    });

    test('getRegistrationById requests /registrations/:id and unwraps data', async () => {
      const data = await registrationService.getRegistrationById('reg_456');

      assert.equal(interceptedRequest.method, 'GET');
      assert.equal(interceptedRequest.url, '/registrations/reg_456');
      assert.equal(data._id, 'reg_456');
      assert.equal(data.status, 'registered');
    });

    test('cancelRegistration sends PATCH with reason payload', async () => {
      // With string reason
      const res1 = await registrationService.cancelRegistration('reg_789', 'Schedule conflict');
      assert.equal(interceptedRequest.method, 'PATCH');
      assert.equal(interceptedRequest.url, '/registrations/reg_789/cancel');
      assert.deepEqual(interceptedRequest.data, { reason: 'Schedule conflict' });
      assert.equal(res1.success, true);
      assert.equal(res1.data.status, 'cancelled');

      // Without reason (empty string)
      const res2 = await registrationService.cancelRegistration('reg_789', '');
      assert.deepEqual(interceptedRequest.data, {});
      assert.equal(res2.success, true);
    });

    test('getEventAttendees sends GET to /events/:id/attendees with filters', async () => {
      const res = await registrationService.getEventAttendees('evt_999', {
        page: 1,
        limit: 15,
        status: 'registered'
      });

      assert.equal(interceptedRequest.method, 'GET');
      assert.equal(interceptedRequest.url, '/events/evt_999/attendees');
      assert.deepEqual(interceptedRequest.config.params, {
        page: 1,
        limit: 15,
        status: 'registered'
      });
      assert.equal(res.summary.totalAll, 3);
      assert.equal(res.summary.activeCount, 2);
      assert.equal(res.summary.cancelledCount, 1);
      assert.equal(res.data[0].participant.name, 'Alex Participant');
    });
  });

  describe('3. API Error Handling & Guardrails', () => {
    test('extractErrorMessage parses 409 duplicate registration response', () => {
      const err = {
        response: {
          status: 409,
          data: {
            message: 'You are already registered for this event'
          }
        }
      };

      const message = extractErrorMessage(err);
      assert.equal(message, 'You are already registered for this event');
    });

    test('extractErrorMessage parses 400 capacity full response', () => {
      const err = {
        response: {
          status: 400,
          data: {
            message: 'Event is already at full capacity'
          }
        }
      };

      const message = extractErrorMessage(err);
      assert.equal(message, 'Event is already at full capacity');
    });

    test('extractErrorMessage parses 400 event already started cancellation error', () => {
      const err = {
        response: {
          status: 400,
          data: {
            message: 'Cannot cancel registration for an event that has already started'
          }
        }
      };

      const message = extractErrorMessage(err);
      assert.equal(message, 'Cannot cancel registration for an event that has already started');
    });

    test('extractErrorMessage parses 403 non-owner attendee access rejection', () => {
      const err = {
        response: {
          status: 403,
          data: {
            message: 'Not authorized to view attendee roster for this event'
          }
        }
      };

      const message = extractErrorMessage(err);
      assert.equal(message, 'Not authorized to view attendee roster for this event');
    });

    test('extractErrorMessage falls back to default message when response is empty', () => {
      const message = extractErrorMessage(new Error('Network disconnected'), 'Fallback default error');
      assert.equal(message, 'Network disconnected');

      const message2 = extractErrorMessage({}, 'Fallback default error');
      assert.equal(message2, 'Fallback default error');
    });
  });
});
