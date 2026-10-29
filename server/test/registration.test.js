const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const app = require('../src/app');
const { request: dispatchRequest } = require('./testHelper');
const { signToken } = require('../src/utils/token');
const { Registration, REGISTRATION_STATUS } = require('../src/models/Registration');
const { Event } = require('../src/models/Event');

const request = (appInstance, options) => {
  const isRegistrationRequest =
    options.method === 'POST' &&
    (options.url === '/api/registrations' || options.url.endsWith('/register'));
  if (!isRegistrationRequest) return dispatchRequest(appInstance, options);

  return dispatchRequest(appInstance, {
    ...options,
    body: {
      ...(options.body || {}),
      academicYear: options.body?.academicYear ?? 'first'
    }
  });
};

describe('EventFlow Participant Event Registration Test Suite', () => {
  let adminUser, adminToken;
  let organizer1User, organizer1Token;
  let organizer2User, organizer2Token;
  let participant1User, participant1Token;
  let participant2User, participant2Token;
  let vendorUser, vendorToken;

  let publishedEvent;
  let fullCapacityEvent;
  let pastDeadlineEvent;
  let pastStartEvent;
  let draftEvent;
  let cancelledEvent;
  let archivedEvent;
  let activeVenue;

  beforeEach(() => {
    // Reset in-memory test stores
    app.locals.mockUserStore = new Map();
    app.locals.mockVenueStore = new Map();
    app.locals.mockEventStore = new Map();
    app.locals.mockRegistrationStore = new Map();

    // 1. Users
    adminUser = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'System Admin',
      email: 'admin@eventflow.edu',
      role: 'administrator',
      isActive: true
    };
    app.locals.mockUserStore.set(adminUser.id, adminUser);
    adminToken = signToken(adminUser);

    organizer1User = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Alice Organizer',
      email: 'alice@eventflow.edu',
      role: 'organizer',
      organization: 'Robotics Club',
      isActive: true
    };
    app.locals.mockUserStore.set(organizer1User.id, organizer1User);
    organizer1Token = signToken(organizer1User);

    organizer2User = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Bob Organizer',
      email: 'bob@eventflow.edu',
      role: 'organizer',
      organization: 'Drama Society',
      isActive: true
    };
    app.locals.mockUserStore.set(organizer2User.id, organizer2User);
    organizer2Token = signToken(organizer2User);

    participant1User = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Charlie Student',
      email: 'charlie@student.edu',
      role: 'participant',
      isActive: true
    };
    app.locals.mockUserStore.set(participant1User.id, participant1User);
    participant1Token = signToken(participant1User);

    participant2User = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Dana Scholar',
      email: 'dana@student.edu',
      role: 'participant',
      isActive: true
    };
    app.locals.mockUserStore.set(participant2User.id, participant2User);
    participant2Token = signToken(participant2User);

    vendorUser = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Chef Mario',
      email: 'mario@catering.com',
      role: 'vendor',
      isActive: true
    };
    app.locals.mockUserStore.set(vendorUser.id, vendorUser);
    vendorToken = signToken(vendorUser);

    // 2. Venue
    activeVenue = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Main Auditorium',
      location: 'Building A, Floor 1',
      capacity: 500,
      facilities: ['projector', 'sound_system'],
      hourlyRate: 50,
      status: 'available',
      isArchived: false
    };
    app.locals.mockVenueStore.set(activeVenue.id, activeVenue);

    // 3. Events
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    // Normal published event eligible for registration
    publishedEvent = {
      id: new mongoose.Types.ObjectId().toString(),
      title: 'Robotics Workshop 2026',
      description: 'Hands-on robotics workshop for students.',
      category: 'technical',
      organizer: organizer1User.id,
      venue: activeVenue.id,
      startDateTime: new Date(now + 5 * day).toISOString(),
      endDateTime: new Date(now + 5 * day + 3 * 3600000).toISOString(),
      registrationDeadline: new Date(now + 4 * day).toISOString(),
      capacity: 50,
      registeredCount: 0,
      status: 'published',
      isArchived: false
    };
    app.locals.mockEventStore.set(publishedEvent.id, publishedEvent);

    // Event with capacity 1 and registeredCount 1 (exhausted)
    fullCapacityEvent = {
      id: new mongoose.Types.ObjectId().toString(),
      title: 'Exclusive VIP Seminar',
      description: 'Single seat seminar.',
      category: 'seminar',
      organizer: organizer1User.id,
      venue: activeVenue.id,
      startDateTime: new Date(now + 6 * day).toISOString(),
      endDateTime: new Date(now + 6 * day + 2 * 3600000).toISOString(),
      registrationDeadline: new Date(now + 5 * day).toISOString(),
      capacity: 1,
      registeredCount: 1,
      status: 'published',
      isArchived: false
    };
    app.locals.mockEventStore.set(fullCapacityEvent.id, fullCapacityEvent);

    // Event with past registration deadline
    pastDeadlineEvent = {
      id: new mongoose.Types.ObjectId().toString(),
      title: 'Past Deadline Conference',
      description: 'Registration already closed.',
      category: 'conference',
      organizer: organizer1User.id,
      venue: activeVenue.id,
      startDateTime: new Date(now + 2 * day).toISOString(),
      endDateTime: new Date(now + 2 * day + 4 * 3600000).toISOString(),
      registrationDeadline: new Date(now - 1 * day).toISOString(), // Yesterday
      capacity: 100,
      registeredCount: 5,
      status: 'published',
      isArchived: false
    };
    app.locals.mockEventStore.set(pastDeadlineEvent.id, pastDeadlineEvent);

    // Event that has already started / completed
    pastStartEvent = {
      id: new mongoose.Types.ObjectId().toString(),
      title: 'Ongoing Hackathon',
      description: 'Hackathon already in progress.',
      category: 'technical',
      organizer: organizer1User.id,
      venue: activeVenue.id,
      startDateTime: new Date(now - 2 * 3600000).toISOString(), // 2 hours ago
      endDateTime: new Date(now + 24 * 3600000).toISOString(),
      registrationDeadline: new Date(now - 3 * 3600000).toISOString(),
      capacity: 80,
      registeredCount: 10,
      status: 'published',
      isArchived: false
    };
    app.locals.mockEventStore.set(pastStartEvent.id, pastStartEvent);

    // Draft event
    draftEvent = {
      id: new mongoose.Types.ObjectId().toString(),
      title: 'Draft Science Fair',
      description: 'Not published yet.',
      category: 'academic',
      organizer: organizer1User.id,
      venue: activeVenue.id,
      startDateTime: new Date(now + 7 * day).toISOString(),
      endDateTime: new Date(now + 7 * day + 4 * 3600000).toISOString(),
      capacity: 200,
      registeredCount: 0,
      status: 'draft',
      isArchived: false
    };
    app.locals.mockEventStore.set(draftEvent.id, draftEvent);

    // Cancelled event
    cancelledEvent = {
      id: new mongoose.Types.ObjectId().toString(),
      title: 'Cancelled Music Night',
      description: 'No longer taking place.',
      category: 'cultural',
      organizer: organizer1User.id,
      venue: activeVenue.id,
      startDateTime: new Date(now + 8 * day).toISOString(),
      endDateTime: new Date(now + 8 * day + 2 * 3600000).toISOString(),
      capacity: 150,
      registeredCount: 0,
      status: 'cancelled',
      isArchived: false
    };
    app.locals.mockEventStore.set(cancelledEvent.id, cancelledEvent);

    // Archived event
    archivedEvent = {
      id: new mongoose.Types.ObjectId().toString(),
      title: 'Archived Alumni Meetup',
      description: 'Archived record.',
      category: 'social',
      organizer: organizer1User.id,
      venue: activeVenue.id,
      startDateTime: new Date(now + 10 * day).toISOString(),
      endDateTime: new Date(now + 10 * day + 3 * 3600000).toISOString(),
      capacity: 50,
      registeredCount: 0,
      status: 'published',
      isArchived: true
    };
    app.locals.mockEventStore.set(archivedEvent.id, archivedEvent);
  });

  // =========================================================================
  // 1. MODEL & SCHEMA VALIDATION
  // =========================================================================
  describe('1. Registration Model & Schemas', () => {
    test('REGISTRATION_STATUS constants define standard lifecycle states', () => {
      assert.deepEqual(REGISTRATION_STATUS, ['registered', 'cancelled']);
    });

    test('Schema enforces required fields for event and participant', () => {
      const emptyDoc = new Registration({});
      const err = emptyDoc.validateSync();
      assert.ok(err);
      assert.ok(err.errors.event);
      assert.ok(err.errors.participant);
    });

    test('academicYear accepts only the four supported year values', () => {
      for (const academicYear of ['first', 'second', 'third', 'fourth']) {
        const registration = new Registration({
          event: new mongoose.Types.ObjectId(),
          participant: new mongoose.Types.ObjectId(),
          academicYear
        });
        assert.equal(registration.validateSync(), undefined);
      }

      const invalid = new Registration({
        event: new mongoose.Types.ObjectId(),
        participant: new mongoose.Types.ObjectId(),
        academicYear: 'graduate'
      });
      assert.ok(invalid.validateSync().errors.academicYear);
    });

    test('Default status is "registered" and timestamps default sensibly', () => {
      const reg = new Registration({
        event: new mongoose.Types.ObjectId(),
        participant: new mongoose.Types.ObjectId()
      });
      assert.equal(reg.status, 'registered');
      assert.equal(reg.academicYear, undefined);
      assert.ok(reg.registeredAt);
      assert.equal(reg.cancelledAt, null);
    });
  });

  // =========================================================================
  // 2. EVENT REGISTRATION ENDPOINTS (POST /api/events/:id/register & POST /api/registrations)
  // =========================================================================
  describe('2. Event Registration Authorization & Eligibility Enforcement', () => {
    test('Unauthenticated user is rejected with 401 Unauthorized', async () => {
      const res = await request(app, {
        method: 'POST',
        url: `/api/events/${publishedEvent.id}/register`
      });
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    test('Organizer role is rejected with 403 Forbidden', async () => {
      const res = await request(app, {
        method: 'POST',
        url: `/api/events/${publishedEvent.id}/register`,
        headers: { authorization: `Bearer ${organizer1Token}` }
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    });

    test('Vendor role is rejected with 403 Forbidden', async () => {
      const res = await request(app, {
        method: 'POST',
        url: `/api/events/${publishedEvent.id}/register`,
        headers: { authorization: `Bearer ${vendorToken}` }
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    });

    test('Administrator role is rejected with 403 Forbidden (participant only)', async () => {
      const res = await request(app, {
        method: 'POST',
        url: `/api/events/${publishedEvent.id}/register`,
        headers: { authorization: `Bearer ${adminToken}` }
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    });

    test('Invalid event ID format is rejected with 400 Bad Request', async () => {
      const res = await request(app, {
        method: 'POST',
        url: '/api/events/invalid-event-id/register',
        headers: { authorization: `Bearer ${participant1Token}` }
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    test('Non-existent event is rejected with 404 Not Found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app, {
        method: 'POST',
        url: `/api/events/${nonExistentId}/register`,
        headers: { authorization: `Bearer ${participant1Token}` }
      });
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });

    test('Archived event is rejected with 404 Not Found', async () => {
      const res = await request(app, {
        method: 'POST',
        url: `/api/events/${archivedEvent.id}/register`,
        headers: { authorization: `Bearer ${participant1Token}` }
      });
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });

    test('Draft event is rejected with 400 Bad Request', async () => {
      const res = await request(app, {
        method: 'POST',
        url: `/api/events/${draftEvent.id}/register`,
        headers: { authorization: `Bearer ${participant1Token}` }
      });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /not published/i);
    });

    test('Cancelled event is rejected with 400 Bad Request', async () => {
      const res = await request(app, {
        method: 'POST',
        url: `/api/events/${cancelledEvent.id}/register`,
        headers: { authorization: `Bearer ${participant1Token}` }
      });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /not published/i);
    });

    test('Event with expired registration deadline is rejected with 400 Bad Request', async () => {
      const res = await request(app, {
        method: 'POST',
        url: `/api/events/${pastDeadlineEvent.id}/register`,
        headers: { authorization: `Bearer ${participant1Token}` }
      });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /deadline.*passed/i);
    });

    test('Event that has already started is rejected with 400 Bad Request', async () => {
      const res = await request(app, {
        method: 'POST',
        url: `/api/events/${pastStartEvent.id}/register`,
        headers: { authorization: `Bearer ${participant1Token}` }
      });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /already started/i);
    });

    test('Event at maximum capacity is rejected with 400 Bad Request', async () => {
      const res = await request(app, {
        method: 'POST',
        url: `/api/events/${fullCapacityEvent.id}/register`,
        headers: { authorization: `Bearer ${participant1Token}` }
      });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /maximum capacity/i);
    });

    test('New registration rejects a missing academic year', async () => {
      const res = await dispatchRequest(app, {
        method: 'POST',
        url: `/api/events/${publishedEvent.id}/register`,
        headers: { authorization: 'Bearer ' + participant1Token }
      });

      assert.equal(res.status, 400);
      assert.ok(res.body.errors.some((error) => /academic year is required/i.test(error)));
      assert.equal(publishedEvent.registeredCount, 0);
    });

    test('New registration rejects an invalid academic year', async () => {
      const res = await request(app, {
        method: 'POST',
        url: `/api/events/${publishedEvent.id}/register`,
        headers: { authorization: 'Bearer ' + participant1Token },
        body: { academicYear: 'graduate' }
      });

      assert.equal(res.status, 400);
      assert.ok(res.body.errors.some((error) => /academic year is required/i.test(error)));
      assert.equal(publishedEvent.registeredCount, 0);
    });

    test('All four academic years may register when the event is eligible for all four', async () => {
      publishedEvent.eligibleYears = ['first', 'second', 'third', 'fourth'];
      const cases = [
        ['first', participant1User],
        ['second', participant2User],
        ['third', {
          id: new mongoose.Types.ObjectId().toString(),
          name: 'Third Year Student',
          role: 'participant',
          isActive: true
        }],
        ['fourth', {
          id: new mongoose.Types.ObjectId().toString(),
          name: 'Fourth Year Student',
          role: 'participant',
          isActive: true
        }]
      ];

      for (const [academicYear, user] of cases) {
        app.locals.mockUserStore.set(user.id, user);
        const res = await request(app, {
          method: 'POST',
          url: `/api/events/${publishedEvent.id}/register`,
          headers: { authorization: 'Bearer ' + signToken(user) },
          body: { academicYear }
        });
        assert.equal(res.status, 201, `${academicYear} registration should succeed`);
        assert.equal(res.body.data.academicYear, academicYear);
      }
      assert.equal(publishedEvent.registeredCount, 4);
    });

    test('First Year may join a First Year event; Third Year is denied by event eligibility', async () => {
      publishedEvent.eligibleYears = ['first'];
      const firstYearRes = await request(app, {
        method: 'POST',
        url: `/api/events/${publishedEvent.id}/register`,
        headers: { authorization: 'Bearer ' + participant1Token },
        body: { academicYear: 'first' }
      });
      assert.equal(firstYearRes.status, 201);

      const thirdYearUser = {
        id: new mongoose.Types.ObjectId().toString(),
        name: 'Third Year Student',
        role: 'participant',
        isActive: true
      };
      app.locals.mockUserStore.set(thirdYearUser.id, thirdYearUser);
      const thirdYearRes = await request(app, {
        method: 'POST',
        url: `/api/events/${publishedEvent.id}/register`,
        headers: { authorization: 'Bearer ' + signToken(thirdYearUser) },
        body: { academicYear: 'third' }
      });

      assert.equal(thirdYearRes.status, 400);
      assert.match(thirdYearRes.body.message, /academic year is not eligible/i);
      assert.equal(publishedEvent.registeredCount, 1);
    });

    test('Legacy events without eligibleYears allow registration for any valid year', async () => {
      delete publishedEvent.eligibleYears;
      const res = await request(app, {
        method: 'POST',
        url: `/api/events/${publishedEvent.id}/register`,
        headers: { authorization: 'Bearer ' + participant1Token },
        body: { academicYear: 'third' }
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.academicYear, 'third');
    });

    test('Participant successfully registers via POST /api/events/:id/register and increments registeredCount', async () => {
      assert.equal(publishedEvent.registeredCount, 0);

      const res = await request(app, {
        method: 'POST',
        url: `/api/events/${publishedEvent.id}/register`,
        headers: { authorization: `Bearer ${participant1Token}` }
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'registered');
      assert.equal(res.body.data.participant.email, participant1User.email);
      assert.equal(publishedEvent.registeredCount, 1);
    });

    test('Participant successfully registers via POST /api/registrations with eventId in body', async () => {
      const res = await request(app, {
        method: 'POST',
        url: '/api/registrations',
        headers: { authorization: `Bearer ${participant2Token}` },
        body: { eventId: publishedEvent.id }
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.participant.email, participant2User.email);
      assert.equal(publishedEvent.registeredCount, 1);
    });

    test('Duplicate active registration is rejected with 409 Conflict', async () => {
      // First registration
      const res1 = await request(app, {
        method: 'POST',
        url: `/api/events/${publishedEvent.id}/register`,
        headers: { authorization: `Bearer ${participant1Token}` }
      });
      assert.equal(res1.status, 201);
      assert.equal(publishedEvent.registeredCount, 1);

      // Duplicate attempt
      const res2 = await request(app, {
        method: 'POST',
        url: `/api/events/${publishedEvent.id}/register`,
        headers: { authorization: `Bearer ${participant1Token}` }
      });
      assert.equal(res2.status, 409);
      assert.equal(res2.body.success, false);
      assert.match(res2.body.message, /already registered/i);
      // Ensure counter was not incremented
      assert.equal(publishedEvent.registeredCount, 1);
    });
  });

  describe('WhatsApp Group Invite Access', () => {
    const seedActiveRegistration = ({
      eventId = publishedEvent.id,
      participantId = participant1User.id,
      status = 'registered',
      isArchived = false
    } = {}) => {
      const registrationId = new mongoose.Types.ObjectId().toString();
      app.locals.mockRegistrationStore.set(registrationId, {
        id: registrationId,
        _id: registrationId,
        event: new mongoose.Types.ObjectId(eventId),
        participant: new mongoose.Types.ObjectId(participantId),
        status,
        isArchived
      });
      return registrationId;
    };

    test('An actively registered participant can retrieve the event WhatsApp link', async () => {
      publishedEvent.whatsappGroupUrl = 'https://chat.whatsapp.com/ActiveInvite';
      seedActiveRegistration();

      const res = await request(app, {
        method: 'GET',
        url: `/api/events/${publishedEvent.id}/whatsapp-group`,
        headers: { authorization: 'Bearer ' + participant1Token }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.whatsappGroupUrl, publishedEvent.whatsappGroupUrl);
    });

    test('An unregistered or different participant cannot retrieve the link', async () => {
      publishedEvent.whatsappGroupUrl = 'https://chat.whatsapp.com/ActiveInvite';
      seedActiveRegistration();

      const unregisteredRes = await request(app, {
        method: 'GET',
        url: `/api/events/${publishedEvent.id}/whatsapp-group`,
        headers: { authorization: 'Bearer ' + participant2Token }
      });
      assert.equal(unregisteredRes.status, 403);

      app.locals.mockRegistrationStore.clear();
      seedActiveRegistration({ participantId: participant2User.id });
      const otherParticipantRes = await request(app, {
        method: 'GET',
        url: `/api/events/${publishedEvent.id}/whatsapp-group`,
        headers: { authorization: 'Bearer ' + participant1Token }
      });
      assert.equal(otherParticipantRes.status, 403);
    });

    test('Cancelled and archived registrations do not grant access', async () => {
      publishedEvent.whatsappGroupUrl = 'https://chat.whatsapp.com/ActiveInvite';
      seedActiveRegistration({ status: 'cancelled' });

      let res = await request(app, {
        method: 'GET',
        url: `/api/events/${publishedEvent.id}/whatsapp-group`,
        headers: { authorization: 'Bearer ' + participant1Token }
      });
      assert.equal(res.status, 403);

      app.locals.mockRegistrationStore.clear();
      seedActiveRegistration({ isArchived: true });
      res = await request(app, {
        method: 'GET',
        url: `/api/events/${publishedEvent.id}/whatsapp-group`,
        headers: { authorization: 'Bearer ' + participant1Token }
      });
      assert.equal(res.status, 403);
    });

    test('Events without a group link, invalid event IDs, and missing events are handled safely', async () => {
      seedActiveRegistration();
      const noLinkRes = await request(app, {
        method: 'GET',
        url: `/api/events/${publishedEvent.id}/whatsapp-group`,
        headers: { authorization: 'Bearer ' + participant1Token }
      });
      assert.equal(noLinkRes.status, 404);
      assert.match(noLinkRes.body.message, /no WhatsApp group/i);

      const invalidIdRes = await request(app, {
        method: 'GET',
        url: '/api/events/not-an-object-id/whatsapp-group',
        headers: { authorization: 'Bearer ' + participant1Token }
      });
      assert.equal(invalidIdRes.status, 400);

      const missingEventRes = await request(app, {
        method: 'GET',
        url: `/api/events/${new mongoose.Types.ObjectId()}/whatsapp-group`,
        headers: { authorization: 'Bearer ' + participant1Token }
      });
      assert.equal(missingEventRes.status, 404);
    });

    test('Only authenticated participants may use the protected link endpoint', async () => {
      const noToken = await request(app, {
        method: 'GET',
        url: `/api/events/${publishedEvent.id}/whatsapp-group`
      });
      assert.equal(noToken.status, 401);

      const organizerRes = await request(app, {
        method: 'GET',
        url: `/api/events/${publishedEvent.id}/whatsapp-group`,
        headers: { authorization: 'Bearer ' + organizer1Token }
      });
      assert.equal(organizerRes.status, 403);
    });
  });

  // =========================================================================
  // 3. CANCELLATION & RE-REGISTRATION LIFECYCLE
  // =========================================================================
  describe('3. Registration Cancellation & Re-Registration Lifecycle', () => {
    let regId;

    beforeEach(async () => {
      const res = await request(app, {
        method: 'POST',
        url: `/api/events/${publishedEvent.id}/register`,
        headers: { authorization: `Bearer ${participant1Token}` }
      });
      regId = res.body.data.id;
    });

    test('Unauthenticated cancellation request is rejected with 401', async () => {
      const res = await request(app, {
        method: 'PATCH',
        url: `/api/registrations/${regId}/cancel`,
        body: { reason: 'Schedule conflict' }
      });
      assert.equal(res.status, 401);
    });

    test('Another participant cannot cancel someone else\'s registration (403 Forbidden)', async () => {
      const res = await request(app, {
        method: 'PATCH',
        url: `/api/registrations/${regId}/cancel`,
        headers: { authorization: `Bearer ${participant2Token}` },
        body: { reason: 'Unauthorized attempt' }
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    });

    test('Participant successfully cancels own registration and restores event capacity', async () => {
      assert.equal(publishedEvent.registeredCount, 1);

      const res = await request(app, {
        method: 'PATCH',
        url: `/api/registrations/${regId}/cancel`,
        headers: { authorization: `Bearer ${participant1Token}` },
        body: { reason: 'Class timetable conflict' }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'cancelled');
      assert.equal(res.body.data.cancellationReason, 'Class timetable conflict');
      assert.ok(res.body.data.cancelledAt);
      // Capacity restored
      assert.equal(publishedEvent.registeredCount, 0);
    });

    test('Cancelling an already cancelled registration is rejected with 400 Bad Request', async () => {
      // First cancellation
      await request(app, {
        method: 'PATCH',
        url: `/api/registrations/${regId}/cancel`,
        headers: { authorization: `Bearer ${participant1Token}` }
      });
      assert.equal(publishedEvent.registeredCount, 0);

      // Repeated cancellation attempt
      const res = await request(app, {
        method: 'PATCH',
        url: `/api/registrations/${regId}/cancel`,
        headers: { authorization: `Bearer ${participant1Token}` }
      });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /already cancelled/i);
      // Ensure counter does not decrement below 0
      assert.equal(publishedEvent.registeredCount, 0);
    });

    test('Cannot cancel registration if event has already started (400 Bad Request)', async () => {
      // Register for an event whose start date will be set to the past
      const pastEvent = {
        id: new mongoose.Types.ObjectId().toString(),
        title: 'Starting Event',
        description: 'About to begin.',
        category: 'academic',
        organizer: organizer1User.id,
        venue: activeVenue.id,
        startDateTime: new Date(Date.now() + 100000).toISOString(),
        endDateTime: new Date(Date.now() + 500000).toISOString(),
        capacity: 10,
        registeredCount: 0,
        status: 'published',
        isArchived: false
      };
      app.locals.mockEventStore.set(pastEvent.id, pastEvent);

      const regRes = await request(app, {
        method: 'POST',
        url: `/api/events/${pastEvent.id}/register`,
        headers: { authorization: `Bearer ${participant1Token}` }
      });
      const ongoingRegId = regRes.body.data.id;

      // Event starts now
      pastEvent.startDateTime = new Date(Date.now() - 60000).toISOString();

      const cancelRes = await request(app, {
        method: 'PATCH',
        url: `/api/registrations/${ongoingRegId}/cancel`,
        headers: { authorization: `Bearer ${participant1Token}` }
      });
      assert.equal(cancelRes.status, 400);
      assert.match(cancelRes.body.message, /already started/i);
    });

    test('Administrator can cancel participant registration with administrative authority', async () => {
      const res = await request(app, {
        method: 'PATCH',
        url: `/api/registrations/${regId}/cancel`,
        headers: { authorization: `Bearer ${adminToken}` },
        body: { reason: 'Administrative cancellation by dean' }
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'cancelled');
      assert.equal(publishedEvent.registeredCount, 0);
    });

    test('Cancelled participant can safely re-register without creating duplicate records', async () => {
      // 1. Cancel initial registration
      await request(app, {
        method: 'PATCH',
        url: `/api/registrations/${regId}/cancel`,
        headers: { authorization: `Bearer ${participant1Token}` }
      });
      assert.equal(publishedEvent.registeredCount, 0);
      assert.equal(app.locals.mockRegistrationStore.size, 1);

      // 2. Re-register for the same event
      const reRegRes = await request(app, {
        method: 'POST',
        url: `/api/events/${publishedEvent.id}/register`,
        headers: { authorization: `Bearer ${participant1Token}` }
      });

      assert.equal(reRegRes.status, 200);
      assert.equal(reRegRes.body.success, true);
      assert.equal(reRegRes.body.data.status, 'registered');
      assert.equal(reRegRes.body.data.cancelledAt, null);
      assert.equal(reRegRes.body.data.academicYear, 'first');
      assert.equal(publishedEvent.registeredCount, 1);
      // Critical check: Exactly 1 record remains in store (no duplicates created)
      assert.equal(app.locals.mockRegistrationStore.size, 1);
      assert.equal(reRegRes.body.data.id, regId);
    });

    test('Re-registration is blocked if event reaches capacity while user was cancelled', async () => {
      // 1. Cancel
      await request(app, {
        method: 'PATCH',
        url: `/api/registrations/${regId}/cancel`,
        headers: { authorization: `Bearer ${participant1Token}` }
      });
      assert.equal(publishedEvent.registeredCount, 0);

      // 2. Simulate capacity fill by other participants
      publishedEvent.capacity = 1;
      publishedEvent.registeredCount = 1;

      // 3. Attempt re-registration
      const reRegRes = await request(app, {
        method: 'POST',
        url: `/api/events/${publishedEvent.id}/register`,
        headers: { authorization: `Bearer ${participant1Token}` }
      });

      assert.equal(reRegRes.status, 400);
      assert.match(reRegRes.body.message, /maximum capacity/i);
    });
  });

  // =========================================================================
  // 4. PARTICIPANT REGISTRATION LISTING & ISOLATION
  // =========================================================================
  describe('4. Participant Registration Listing (GET /api/registrations/me)', () => {
    let reg1, reg2;

    beforeEach(async () => {
      // Participant 1 registers for publishedEvent
      const r1 = await request(app, {
        method: 'POST',
        url: `/api/events/${publishedEvent.id}/register`,
        headers: { authorization: `Bearer ${participant1Token}` }
      });
      reg1 = r1.body.data;

      // Create a second published event
      const secondEvent = {
        id: new mongoose.Types.ObjectId().toString(),
        title: 'Career Bootcamp 2026',
        description: 'Mock interviews and resume reviews.',
        category: 'workshop',
        organizer: organizer2User.id,
        venue: activeVenue.id,
        startDateTime: new Date(Date.now() + 10 * 86400000).toISOString(),
        endDateTime: new Date(Date.now() + 10 * 86400000 + 7200000).toISOString(),
        registrationDeadline: new Date(Date.now() + 9 * 86400000).toISOString(),
        capacity: 100,
        registeredCount: 0,
        status: 'published',
        isArchived: false
      };
      app.locals.mockEventStore.set(secondEvent.id, secondEvent);

      // Participant 2 registers for secondEvent
      const r2 = await request(app, {
        method: 'POST',
        url: `/api/events/${secondEvent.id}/register`,
        headers: { authorization: `Bearer ${participant2Token}` }
      });
      reg2 = r2.body.data;
    });

    test('Unauthenticated request to list registrations is rejected with 401', async () => {
      const res = await request(app, {
        method: 'GET',
        url: '/api/registrations/me'
      });
      assert.equal(res.status, 401);
    });

    test('Non-participant roles cannot query participant personal registration feed (403 Forbidden)', async () => {
      const res1 = await request(app, {
        method: 'GET',
        url: '/api/registrations/me',
        headers: { authorization: `Bearer ${organizer1Token}` }
      });
      assert.equal(res1.status, 403);

      const res2 = await request(app, {
        method: 'GET',
        url: '/api/registrations/me',
        headers: { authorization: `Bearer ${vendorToken}` }
      });
      assert.equal(res2.status, 403);
    });

    test('Participant 1 strictly views only their own registrations (data isolation)', async () => {
      const res = await request(app, {
        method: 'GET',
        url: '/api/registrations/me',
        headers: { authorization: `Bearer ${participant1Token}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.count, 1);
      assert.equal(res.body.pagination.total, 1);
      assert.equal(res.body.data[0].id, reg1.id);
      assert.equal(res.body.data[0].event.title, publishedEvent.title);
      assert.ok(res.body.data[0].event.venue);
      assert.equal(res.body.data[0].event.venue.name, activeVenue.name);
    });

    test('Participant 2 strictly views only their own registrations (data isolation)', async () => {
      const res = await request(app, {
        method: 'GET',
        url: '/api/registrations/me',
        headers: { authorization: `Bearer ${participant2Token}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.count, 1);
      assert.equal(res.body.pagination.total, 1);
      assert.equal(res.body.data[0].id, reg2.id);
      assert.equal(res.body.data[0].event.title, 'Career Bootcamp 2026');
    });

    test('Participant can filter personal registrations by status', async () => {
      // Cancel registration for Participant 1
      await request(app, {
        method: 'PATCH',
        url: `/api/registrations/${reg1.id}/cancel`,
        headers: { authorization: `Bearer ${participant1Token}` }
      });

      // Filter by active 'registered' -> should be 0
      const activeRes = await request(app, {
        method: 'GET',
        url: '/api/registrations/me?status=registered',
        headers: { authorization: `Bearer ${participant1Token}` }
      });
      assert.equal(activeRes.status, 200);
      assert.equal(activeRes.body.count, 0);

      // Filter by 'cancelled' -> should be 1
      const cancelledRes = await request(app, {
        method: 'GET',
        url: '/api/registrations/me?status=cancelled',
        headers: { authorization: `Bearer ${participant1Token}` }
      });
      assert.equal(cancelledRes.status, 200);
      assert.equal(cancelledRes.body.count, 1);
      assert.equal(cancelledRes.body.data[0].status, 'cancelled');
    });

    test('Participant can view single registration detail by ID (GET /api/registrations/:id)', async () => {
      const res = await request(app, {
        method: 'GET',
        url: `/api/registrations/${reg1.id}`,
        headers: { authorization: `Bearer ${participant1Token}` }
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.id, reg1.id);
    });

    test('Another participant cannot view private registration detail by ID (403 Forbidden)', async () => {
      const res = await request(app, {
        method: 'GET',
        url: `/api/registrations/${reg1.id}`,
        headers: { authorization: `Bearer ${participant2Token}` }
      });
      assert.equal(res.status, 403);
    });

    test('Administrator can inspect any registration detail by ID', async () => {
      const res = await request(app, {
        method: 'GET',
        url: `/api/registrations/${reg1.id}`,
        headers: { authorization: `Bearer ${adminToken}` }
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.id, reg1.id);
    });
  });

  // =========================================================================
  // 5. ORGANIZER & ADMIN ATTENDEE LISTING (GET /api/events/:id/attendees)
  // =========================================================================
  describe('5. Organizer Attendee Listing & Permission Enforcement', () => {
    let reg1, reg2;

    beforeEach(async () => {
      const r1 = await request(app, {
        method: 'POST',
        url: `/api/events/${publishedEvent.id}/register`,
        headers: { authorization: `Bearer ${participant1Token}` }
      });
      reg1 = r1.body.data;

      const r2 = await request(app, {
        method: 'POST',
        url: `/api/events/${publishedEvent.id}/register`,
        headers: { authorization: `Bearer ${participant2Token}` }
      });
      reg2 = r2.body.data;
    });

    test('Unauthenticated user cannot view event attendees (401 Unauthorized)', async () => {
      const res = await request(app, {
        method: 'GET',
        url: `/api/events/${publishedEvent.id}/attendees`
      });
      assert.equal(res.status, 401);
    });

    test('Participants and vendors cannot view attendee lists (403 Forbidden)', async () => {
      const pRes = await request(app, {
        method: 'GET',
        url: `/api/events/${publishedEvent.id}/attendees`,
        headers: { authorization: `Bearer ${participant1Token}` }
      });
      assert.equal(pRes.status, 403);

      const vRes = await request(app, {
        method: 'GET',
        url: `/api/events/${publishedEvent.id}/attendees`,
        headers: { authorization: `Bearer ${vendorToken}` }
      });
      assert.equal(vRes.status, 403);
    });

    test('Non-owner organizer is forbidden from viewing attendees of other organizers (403 Forbidden)', async () => {
      // organizer2 does not own publishedEvent (owned by organizer1)
      const res = await request(app, {
        method: 'GET',
        url: `/api/events/${publishedEvent.id}/attendees`,
        headers: { authorization: `Bearer ${organizer2Token}` }
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /not authorized/i);
    });

    test('Owner organizer successfully views event attendee list with status summary', async () => {
      const res = await request(app, {
        method: 'GET',
        url: `/api/events/${publishedEvent.id}/attendees`,
        headers: { authorization: `Bearer ${organizer1Token}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.count, 2);
      assert.equal(res.body.summary.activeCount, 2);
      assert.equal(res.body.summary.cancelledCount, 0);

      // Verify participant profile returned without leaking credentials
      const attendee = res.body.data[0];
      assert.ok(attendee.participant);
      assert.ok(attendee.participant.name);
      assert.ok(attendee.participant.email);
      assert.equal(attendee.participant.passwordHash, undefined);
      assert.equal(attendee.participant.password, undefined);
    });

    test('Organizer attendee view includes the saved academic year and tolerates legacy registrations', async () => {
      const registrations = Array.from(app.locals.mockRegistrationStore.values());
      const legacyRegistration = registrations[0];
      delete legacyRegistration.academicYear;

      const res = await request(app, {
        method: 'GET',
        url: `/api/events/${publishedEvent.id}/attendees`,
        headers: { authorization: 'Bearer ' + organizer1Token }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.find((registration) => registration.id === legacyRegistration.id).academicYear, undefined);
      assert.ok(res.body.data.some((registration) => registration.academicYear === 'first'));
    });

    test('Administrator can view attendee list for any event', async () => {
      const res = await request(app, {
        method: 'GET',
        url: `/api/events/${publishedEvent.id}/attendees`,
        headers: { authorization: `Bearer ${adminToken}` }
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.count, 2);
    });

    test('Attendee list supports pagination and status filtering', async () => {
      // Cancel participant 1
      await request(app, {
        method: 'PATCH',
        url: `/api/registrations/${reg1.id}/cancel`,
        headers: { authorization: `Bearer ${participant1Token}` }
      });

      // Filter by active registered attendees only
      const activeRes = await request(app, {
        method: 'GET',
        url: `/api/events/${publishedEvent.id}/attendees?status=registered`,
        headers: { authorization: `Bearer ${organizer1Token}` }
      });
      assert.equal(activeRes.status, 200);
      assert.equal(activeRes.body.count, 1);
      assert.equal(activeRes.body.data[0].participant.email, participant2User.email);
      assert.equal(activeRes.body.summary.activeCount, 1);
      assert.equal(activeRes.body.summary.cancelledCount, 1);

      // Pagination check (limit 1, page 1)
      const pageRes = await request(app, {
        method: 'GET',
        url: `/api/events/${publishedEvent.id}/attendees?limit=1&page=1`,
        headers: { authorization: `Bearer ${organizer1Token}` }
      });
      assert.equal(pageRes.status, 200);
      assert.equal(pageRes.body.count, 1);
      assert.equal(pageRes.body.pagination.pages, 2);
    });

    test('Alternative route GET /api/registrations/event/:id works identically for owner organizer', async () => {
      const res = await request(app, {
        method: 'GET',
        url: `/api/registrations/event/${publishedEvent.id}`,
        headers: { authorization: `Bearer ${organizer1Token}` }
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.count, 2);
    });
  });

  // =========================================================================
  // 6. CAPACITY SAFEGUARDS & CONCURRENCY SIMULATION
  // =========================================================================
  describe('6. Capacity Constraints & Concurrency Protections', () => {
    test('Cannot reduce event capacity below active participant registration count in PUT /api/events/:id', async () => {
      // Register 2 participants
      await request(app, {
        method: 'POST',
        url: `/api/events/${publishedEvent.id}/register`,
        headers: { authorization: `Bearer ${participant1Token}` }
      });
      await request(app, {
        method: 'POST',
        url: `/api/events/${publishedEvent.id}/register`,
        headers: { authorization: `Bearer ${participant2Token}` }
      });
      assert.equal(publishedEvent.registeredCount, 2);

      // Attempt to lower capacity from 50 to 1 (which is less than registeredCount 2)
      const updateRes = await request(app, {
        method: 'PUT',
        url: `/api/events/${publishedEvent.id}`,
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: { capacity: 1 }
      });

      assert.equal(updateRes.status, 400);
      assert.equal(updateRes.body.success, false);
      assert.match(updateRes.body.errors[0], /Cannot reduce event capacity.*active participant registrations/i);
    });

    test('Simultaneous registrations for a 1-seat event: exactly one succeeds and one is rejected (Capacity limit enforcement)', async () => {
      // Event with capacity = 1 and registeredCount = 0
      const singleSeatEvent = {
        id: new mongoose.Types.ObjectId().toString(),
        title: 'Single Seat Masterclass',
        description: 'Only 1 seat available.',
        category: 'workshop',
        organizer: organizer1User.id,
        venue: activeVenue.id,
        startDateTime: new Date(Date.now() + 5 * 86400000).toISOString(),
        endDateTime: new Date(Date.now() + 5 * 86400000 + 7200000).toISOString(),
        registrationDeadline: new Date(Date.now() + 4 * 86400000).toISOString(),
        capacity: 1,
        registeredCount: 0,
        status: 'published',
        isArchived: false
      };
      app.locals.mockEventStore.set(singleSeatEvent.id, singleSeatEvent);

      // Fire two registration requests concurrently
      const [res1, res2] = await Promise.all([
        request(app, {
          method: 'POST',
          url: `/api/events/${singleSeatEvent.id}/register`,
          headers: { authorization: `Bearer ${participant1Token}` }
        }),
        request(app, {
          method: 'POST',
          url: `/api/events/${singleSeatEvent.id}/register`,
          headers: { authorization: `Bearer ${participant2Token}` }
        })
      ]);

      const statuses = [res1.status, res2.status];
      // One must be 201 Created and one must be 400 Bad Request (capacity reached)
      assert.ok(statuses.includes(201), 'One request must succeed with 201');
      assert.ok(statuses.includes(400), 'Second request must be rejected with 400 capacity reached');
      assert.equal(singleSeatEvent.registeredCount, 1, 'Final registered count must equal capacity (1)');
    });

    test('Legacy event without registeredCount field seamlessly initializes to 1 on first registration', async () => {
      const legacyEvent = {
        id: new mongoose.Types.ObjectId().toString(),
        title: 'Legacy Workshop Without Counter',
        description: 'Simulates events created before registeredCount schema introduction.',
        category: 'academic',
        organizer: organizer1User.id,
        venue: activeVenue.id,
        startDateTime: new Date(Date.now() + 5 * 86400000).toISOString(),
        endDateTime: new Date(Date.now() + 5 * 86400000 + 7200000).toISOString(),
        registrationDeadline: new Date(Date.now() + 4 * 86400000).toISOString(),
        capacity: 25,
        // registeredCount deliberately omitted
        status: 'published',
        isArchived: false
      };
      app.locals.mockEventStore.set(legacyEvent.id, legacyEvent);

      const res = await request(app, {
        method: 'POST',
        url: `/api/events/${legacyEvent.id}/register`,
        headers: { authorization: `Bearer ${participant1Token}` }
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(legacyEvent.registeredCount, 1);
    });

    test('Concurrent duplicate registration requests from same participant: exactly one succeeds and one returns 409', async () => {
      // Fire two identical registration requests for participant 1 concurrently
      const [res1, res2] = await Promise.all([
        request(app, {
          method: 'POST',
          url: `/api/events/${publishedEvent.id}/register`,
          headers: { authorization: `Bearer ${participant1Token}` }
        }),
        request(app, {
          method: 'POST',
          url: `/api/events/${publishedEvent.id}/register`,
          headers: { authorization: `Bearer ${participant1Token}` }
        })
      ]);

      const statuses = [res1.status, res2.status];
      assert.ok(statuses.includes(201), 'First concurrent registration request must succeed with 201');
      assert.ok(statuses.includes(409), 'Duplicate concurrent registration request must be rejected with 409 Conflict');
      assert.equal(publishedEvent.registeredCount, 1, 'Event registeredCount must only be incremented once');
      assert.equal(app.locals.mockRegistrationStore.size, 1, 'Mock store must hold exactly one registration document');
    });

    test('Concurrent cancellation requests: exactly one succeeds and capacity is decremented only once', async () => {
      // First, register participant 1
      const regRes = await request(app, {
        method: 'POST',
        url: `/api/events/${publishedEvent.id}/register`,
        headers: { authorization: `Bearer ${participant1Token}` }
      });
      const regId = regRes.body.data.id;
      assert.equal(publishedEvent.registeredCount, 1);

      // Fire two cancellation requests concurrently for the same registration
      const [cancel1, cancel2] = await Promise.all([
        request(app, {
          method: 'PATCH',
          url: `/api/registrations/${regId}/cancel`,
          headers: { authorization: `Bearer ${participant1Token}` },
          body: { reason: 'Cancelling request A' }
        }),
        request(app, {
          method: 'PATCH',
          url: `/api/registrations/${regId}/cancel`,
          headers: { authorization: `Bearer ${participant1Token}` },
          body: { reason: 'Cancelling request B' }
        })
      ]);

      const statuses = [cancel1.status, cancel2.status];
      assert.ok(statuses.includes(200), 'One cancellation request must succeed with 200');
      assert.ok(statuses.includes(400), 'Second concurrent cancellation must be rejected with 400 (already cancelled)');
      assert.equal(publishedEvent.registeredCount, 0, 'Event capacity counter must be decremented exactly once, never twice');
    });
  });

  // =========================================================================
  // 7. TRANSACTION-UNAVAILABLE TOPOLOGY DEFENSE (REAL MONGODB PATH SIMULATION)
  // =========================================================================
  describe('7. Transaction-Unavailable Topology Defense', () => {
    test('Registration is rejected with 503 before writes when database topology does not support multi-document transactions', async () => {
      // 1. Temporarily disable the mock registration store to force execution into the real MongoDB path
      const originalStore = app.locals.mockRegistrationStore;
      app.locals.mockRegistrationStore = null;

      // Ensure Event.findOneAndUpdate and Registration.create are monitored to verify 0 writes occur
      let eventWriteCount = 0;
      let registrationWriteCount = 0;
      const originalEventFindOneAndUpdate = Event.findOneAndUpdate;
      const originalRegistrationCreate = Registration.create;

      Event.findOneAndUpdate = (...args) => {
        eventWriteCount++;
        return originalEventFindOneAndUpdate.apply(Event, args);
      };
      Registration.create = (...args) => {
        registrationWriteCount++;
        return originalRegistrationCreate.apply(Registration, args);
      };

      try {
        const initialCount = publishedEvent.registeredCount;

        // Ensure mongoose.connection.client topology simulates standalone MongoDB (Single)
        const originalClient = mongoose.connection.client;
        mongoose.connection.client = {
          topology: {
            description: {
              type: 'Single' // Non-replica set standalone MongoDB
            }
          }
        };

        const res = await request(app, {
          method: 'POST',
          url: `/api/events/${publishedEvent.id}/register`,
          headers: { authorization: `Bearer ${participant1Token}` }
        });

        // Restore client immediately
        mongoose.connection.client = originalClient;

        // Verify rejected with 503 and clear descriptive message
        assert.equal(res.status, 503);
        assert.equal(res.body.success, false);
        assert.match(res.body.message, /transactions are unavailable/i);

        // Verify ZERO writes occurred
        assert.equal(eventWriteCount, 0, 'No event write should occur when transactions are unavailable');
        assert.equal(registrationWriteCount, 0, 'No registration write should occur when transactions are unavailable');
        assert.equal(publishedEvent.registeredCount, initialCount, 'Event capacity counter must not change');
      } finally {
        // Cleanup all stubs and restore mock store
        Event.findOneAndUpdate = originalEventFindOneAndUpdate;
        Registration.create = originalRegistrationCreate;
        app.locals.mockRegistrationStore = originalStore;
      }
    });

    test('Cancellation is rejected with 503 before writes when database topology does not support multi-document transactions', async () => {
      // Setup active registration
      const regId = new mongoose.Types.ObjectId().toString();
      const mockRegDoc = {
        id: regId,
        _id: regId,
        event: publishedEvent.id,
        participant: participant1User.id,
        status: 'registered',
        isArchived: false,
        registeredAt: new Date()
      };

      // Disable mock store for cancellation update path, but stub Registration.findOne to provide the active document
      const originalStore = app.locals.mockRegistrationStore;
      app.locals.mockRegistrationStore = null;

      let eventWriteCount = 0;
      let registrationWriteCount = 0;
      const originalRegistrationFindOne = Registration.findOne;
      const originalRegistrationFindOneAndUpdate = Registration.findOneAndUpdate;
      const originalEventFindOneAndUpdate = Event.findOneAndUpdate;

      Registration.findOne = async () => mockRegDoc;
      Registration.findOneAndUpdate = (...args) => {
        registrationWriteCount++;
        return originalRegistrationFindOneAndUpdate.apply(Registration, args);
      };
      Event.findOneAndUpdate = (...args) => {
        eventWriteCount++;
        return originalEventFindOneAndUpdate.apply(Event, args);
      };

      const originalClient = mongoose.connection.client;
      mongoose.connection.client = {
        topology: {
          description: {
            type: 'Single' // Standalone
          }
        }
      };

      Object.defineProperty(mongoose.connection, 'readyState', {
        value: 1,
        configurable: true
      });

      try {
        const initialCount = publishedEvent.registeredCount;

        const res = await request(app, {
          method: 'PATCH',
          url: `/api/registrations/${regId}/cancel`,
          headers: { authorization: `Bearer ${participant1Token}` },
          body: { reason: 'Test cancel topology defense' }
        });

        // Verify rejected with 503 and clear descriptive message
        assert.equal(res.status, 503);
        assert.equal(res.body.success, false);
        assert.match(res.body.message, /transactions are unavailable/i);

        // Verify ZERO writes occurred
        assert.equal(registrationWriteCount, 0, 'No registration write should occur when transactions are unavailable');
        assert.equal(eventWriteCount, 0, 'No event write should occur when transactions are unavailable');
        assert.equal(publishedEvent.registeredCount, initialCount, 'Event capacity counter must not change');
      } finally {
        Object.defineProperty(mongoose.connection, 'readyState', {
          value: 0,
          configurable: true
        });
        mongoose.connection.client = originalClient;
        Registration.findOne = originalRegistrationFindOne;
        Registration.findOneAndUpdate = originalRegistrationFindOneAndUpdate;
        Event.findOneAndUpdate = originalEventFindOneAndUpdate;
        app.locals.mockRegistrationStore = originalStore;
      }
    });
  });
});
