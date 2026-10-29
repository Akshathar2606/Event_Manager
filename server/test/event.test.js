const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const app = require('../src/app');
const { request } = require('./testHelper');
const { signToken } = require('../src/utils/token');
const { buildEventQuery, getStore } = require('../src/controllers/eventController');
const { Event } = require('../src/models/Event');
const { validateEventInput } = require('../src/utils/eventValidation');

describe('EventFlow Event Management Test Suite', () => {
  let adminUser, adminToken;
  let organizer1User, organizer1Token;
  let organizer2User, organizer2Token;
  let participantUser, participantToken;
  let vendorUser, vendorToken;
  let testVenue;

  test('Event schema applies backward-compatible feature defaults', () => {
    const event = new Event({
      title: 'Default Features Event',
      description: 'An event using schema defaults.',
      category: 'academic',
      organizer: new mongoose.Types.ObjectId(),
      startDateTime: new Date('2026-11-15T09:00:00.000Z'),
      endDateTime: new Date('2026-11-15T10:00:00.000Z'),
      capacity: 100
    });

    assert.equal(event.aictePointsAvailable, false);
    assert.equal(event.attendanceProvided, false);
    assert.deepEqual(event.eligibleYears, ['first', 'second', 'third', 'fourth']);
    assert.deepEqual(event.contacts, []);
    assert.equal(event.websiteUrl, '');
    assert.equal(event.instagramUrl, '');
    assert.equal(event.whatsappGroupUrl, '');
  });

  test('Event validation requires booleans and known, non-empty eligible year arrays', () => {
    const baseEvent = {
      title: 'Validated Event',
      description: 'Event fields are validated.',
      category: 'academic',
      startDateTime: '2026-11-15T09:00:00.000Z',
      endDateTime: '2026-11-15T10:00:00.000Z',
      capacity: 100
    };

    for (const invalidPayload of [
      { aictePointsAvailable: 'yes' },
      { attendanceProvided: 1 },
      { eligibleYears: 'first,second' },
      { eligibleYears: ['fifth'] },
      { eligibleYears: [] }
    ]) {
      const validation = validateEventInput({ ...baseEvent, ...invalidPayload });
      assert.equal(validation.isValid, false, JSON.stringify(invalidPayload));
    }

    const valid = validateEventInput({
      ...baseEvent,
      aictePointsAvailable: true,
      attendanceProvided: false,
      eligibleYears: ['first', 'second', 'first']
    });
    assert.equal(valid.isValid, true);
    assert.deepEqual(valid.sanitized.eligibleYears, ['first', 'second']);
  });

  test('Event contact and link validation normalizes safe values and rejects malformed input', () => {
    const baseEvent = {
      title: 'Contact Validation Event',
      description: 'Validate contact and event link data.',
      category: 'academic',
      startDateTime: '2026-11-15T09:00:00.000Z',
      endDateTime: '2026-11-15T10:00:00.000Z',
      capacity: 100
    };
    const valid = validateEventInput({
      ...baseEvent,
      contacts: [
        {
          name: '  Alex Example ',
          role: ' Event Coordinator ',
          email: '  ALEX@EXAMPLE.EDU ',
          phone: '+1 (555) 123-4567'
        },
        { name: 'Sam Example', email: 'sam@example.edu', phone: '' }
      ],
      websiteUrl: ' https://events.example.edu/placement ',
      instagramUrl: 'https://www.instagram.com/eventflow/'
    });

    assert.equal(valid.isValid, true, valid.errors.join(', '));
    assert.deepEqual(valid.sanitized.contacts, [
      {
        name: 'Alex Example',
        role: 'Event Coordinator',
        email: 'alex@example.edu',
        phone: '+1 (555) 123-4567'
      },
      { name: 'Sam Example', role: '', email: 'sam@example.edu', phone: '' }
    ]);
    assert.equal(valid.sanitized.websiteUrl, 'https://events.example.edu/placement');
    assert.equal(valid.sanitized.instagramUrl, 'https://www.instagram.com/eventflow/');

    const invalidPayloads = [
      { contacts: [{ name: '', email: 'contact@example.edu' }] },
      { contacts: [{ name: 'Valid Name', email: 'not-an-email' }] },
      { contacts: [{ name: 'Valid Name', email: 'contact@example.edu', phone: '12' }] },
      { contacts: [{ name: 'Valid Name', email: 'contact@example.edu', admin: true }] },
      { contacts: { name: 'Valid Name', email: 'contact@example.edu' } },
      { websiteUrl: 'javascript:alert(1)' },
      { websiteUrl: 'data:text/html,unsafe' },
      { websiteUrl: 'ftp://example.edu/resource' },
      { instagramUrl: 'https://example.com/not-instagram' }
    ];
    for (const invalidFields of invalidPayloads) {
      const result = validateEventInput({ ...baseEvent, ...invalidFields });
      assert.equal(result.isValid, false, JSON.stringify(invalidFields));
    }

    const emptyOptionalFields = validateEventInput(baseEvent);
    assert.equal(emptyOptionalFields.isValid, true);
    assert.deepEqual(emptyOptionalFields.sanitized.contacts, []);
    assert.equal(emptyOptionalFields.sanitized.websiteUrl, '');
    assert.equal(emptyOptionalFields.sanitized.instagramUrl, '');
  });

  beforeEach(() => {
    // Reset test in-memory stores before each test
    app.locals.mockUserStore = new Map();
    app.locals.mockVenueStore = new Map();
    app.locals.mockCateringStore = new Map();
    app.locals.mockEventStore = new Map();
    app.locals.mockBookingStore = new Map();

    // 1. Administrator
    adminUser = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Admin User',
      email: 'admin@eventflow.edu',
      role: 'administrator',
      isActive: true
    };
    app.locals.mockUserStore.set(adminUser.id, adminUser);
    adminToken = signToken(adminUser);

    // 2. Organizer 1 (Primary)
    organizer1User = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Alice Organizer',
      email: 'alice@campus.edu',
      role: 'organizer',
      organization: 'Tech Club',
      isActive: true
    };
    app.locals.mockUserStore.set(organizer1User.id, organizer1User);
    organizer1Token = signToken(organizer1User);

    // 3. Organizer 2 (For ownership isolation checks)
    organizer2User = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Bob Organizer',
      email: 'bob@campus.edu',
      role: 'organizer',
      organization: 'Drama Society',
      isActive: true
    };
    app.locals.mockUserStore.set(organizer2User.id, organizer2User);
    organizer2Token = signToken(organizer2User);

    // 4. Participant
    participantUser = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Charlie Participant',
      email: 'charlie@student.edu',
      role: 'participant',
      isActive: true
    };
    app.locals.mockUserStore.set(participantUser.id, participantUser);
    participantToken = signToken(participantUser);

    // 5. Vendor
    vendorUser = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Vinnie Vendor',
      email: 'vinnie@catering.com',
      role: 'vendor',
      isActive: true
    };
    app.locals.mockUserStore.set(vendorUser.id, vendorUser);
    vendorToken = signToken(vendorUser);

    // 6. Test Venue
    testVenue = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Campus Grand Hall',
      location: 'Student Center 2nd Floor',
      capacity: 350,
      facilities: ['Projector', 'Sound System', 'Wi-Fi'],
      hourlyRate: 50,
      status: 'available',
      isArchived: false,
      createdBy: adminUser.id
    };
    app.locals.mockVenueStore.set(testVenue.id, testVenue);
  });

  describe('Event Creation & Role-Based Authorization', () => {
    const validEventPayload = {
      title: 'Annual Campus Hackathon 2026',
      description: 'A 24-hour collaborative coding and design marathon for all university students.',
      category: 'technical',
      startDateTime: '2026-11-15T09:00:00.000Z',
      endDateTime: '2026-11-16T09:00:00.000Z',
      registrationDeadline: '2026-11-10T23:59:59.000Z',
      capacity: 150,
      tags: ['coding', 'hackathon', 'innovation'],
      budget: 2500
    };

    test('1. Creation requires authentication (401 when missing token)', async () => {
      const res = await request(app, {
        method: 'POST',
        url: '/api/events',
        body: validEventPayload
      });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes('missing'));
    });

    test('2. Only organizer and administrator can create events (403 for participant & vendor)', async () => {
      const participantRes = await request(app, {
        method: 'POST',
        url: '/api/events',
        headers: { authorization: `Bearer ${participantToken}` },
        body: validEventPayload
      });
      assert.equal(participantRes.status, 403);
      assert.equal(participantRes.body.success, false);

      const vendorRes = await request(app, {
        method: 'POST',
        url: '/api/events',
        headers: { authorization: `Bearer ${vendorToken}` },
        body: validEventPayload
      });
      assert.equal(vendorRes.status, 403);
      assert.equal(vendorRes.body.success, false);
    });

    test('3. Organizer successfully creates event with default status draft and authoritative organizer ID', async () => {
      const res = await request(app, {
        method: 'POST',
        url: '/api/events',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          ...validEventPayload,
          organizer: 'attempted_fake_organizer_id', // Should be ignored in favor of authenticated user
          venue: testVenue.id
        }
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.id);
      assert.equal(res.body.data.title, 'Annual Campus Hackathon 2026');
      assert.equal(res.body.data.status, 'draft');
      assert.equal(res.body.data.capacity, 150);
      assert.equal(res.body.data.category, 'technical');
      // Organizer must be authoritatively bound to organizer1User
      const orgId = typeof res.body.data.organizer === 'object' ? res.body.data.organizer.id : res.body.data.organizer;
      assert.equal(orgId, organizer1User.id);
    });

    test('Organizer event creation persists independent benefit flags and eligible years', async () => {
      const res = await request(app, {
        method: 'POST',
        url: '/api/events',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          ...validEventPayload,
          aictePointsAvailable: true,
          attendanceProvided: false,
          eligibleYears: ['first', 'third']
        }
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.aictePointsAvailable, true);
      assert.equal(res.body.data.attendanceProvided, false);
      assert.deepEqual(res.body.data.eligibleYears, ['first', 'third']);
    });

    test('Event creation applies backward-compatible defaults when feature fields are omitted', async () => {
      const res = await request(app, {
        method: 'POST',
        url: '/api/events',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: validEventPayload
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.aictePointsAvailable, false);
      assert.equal(res.body.data.attendanceProvided, false);
      assert.deepEqual(res.body.data.eligibleYears, ['first', 'second', 'third', 'fourth']);
    });

    test('Organizer can create an event with multiple contacts and official links', async () => {
      const res = await request(app, {
        method: 'POST',
        url: '/api/events',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          ...validEventPayload,
          contacts: [
            { name: 'Jordan Lee', role: 'Event Coordinator', email: 'JORDAN@EXAMPLE.EDU', phone: '+1 555 123 4567' },
            { name: 'Morgan Ray', email: 'morgan@example.edu' }
          ],
          websiteUrl: 'https://events.example.edu/placement-iq',
          instagramUrl: 'https://instagram.com/placementiq'
        }
      });

      assert.equal(res.status, 201);
      assert.deepEqual(res.body.data.contacts, [
        { name: 'Jordan Lee', role: 'Event Coordinator', email: 'jordan@example.edu', phone: '+1 555 123 4567' },
        { name: 'Morgan Ray', role: '', email: 'morgan@example.edu', phone: '' }
      ]);
      assert.equal(res.body.data.websiteUrl, 'https://events.example.edu/placement-iq');
      assert.equal(res.body.data.instagramUrl, 'https://instagram.com/placementiq');
    });

    test('Organizer can create event with a valid WhatsApp group invite URL', async () => {
      const res = await request(app, {
        method: 'POST',
        url: '/api/events',
        headers: { authorization: 'Bearer ' + organizer1Token },
        body: {
          ...validEventPayload,
          whatsappGroupUrl: 'https://chat.whatsapp.com/InviteCode'
        }
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.whatsappGroupUrl, 'https://chat.whatsapp.com/InviteCode');
    });

    test('Event creation rejects unsafe, malformed, and unrelated WhatsApp URLs', async () => {
      for (const whatsappGroupUrl of [
        'http://chat.whatsapp.com/InviteCode',
        'javascript:alert(1)',
        'https://example.com/group',
        'https://chat.whatsapp.com.evil.example/InviteCode',
        'https://chat.whatsapp.com:8443/InviteCode',
        'https://chat.whatsapp.com/'
      ]) {
        const res = await request(app, {
          method: 'POST',
          url: '/api/events',
          headers: { authorization: 'Bearer ' + organizer1Token },
          body: { ...validEventPayload, whatsappGroupUrl }
        });

        assert.equal(res.status, 400, `Expected rejection for ${whatsappGroupUrl}`);
        assert.ok(res.body.errors.some((error) => /WhatsApp group invite URL/i.test(error)));
      }
    });

    test('Event creation rejects invalid feature values and arbitrary student years', async () => {
      const res = await request(app, {
        method: 'POST',
        url: '/api/events',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          ...validEventPayload,
          aictePointsAvailable: 'Yes',
          attendanceProvided: true,
          eligibleYears: ['first', 'graduate']
        }
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.errors.some((error) => /must be a boolean/i.test(error)));
      assert.ok(res.body.errors.some((error) => /selected from/i.test(error)));
    });

    test('4. Input validation rejects invalid dates (endDateTime <= startDateTime)', async () => {
      const invalidPayload = {
        ...validEventPayload,
        startDateTime: '2026-11-20T10:00:00.000Z',
        endDateTime: '2026-11-20T08:00:00.000Z' // End before start
      };

      const res = await request(app, {
        method: 'POST',
        url: '/api/events',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: invalidPayload
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.errors.some((e) => e.includes('Event end date and time must be after')));
    });

    test('5. Input validation rejects registration deadline after start date', async () => {
      const invalidPayload = {
        ...validEventPayload,
        startDateTime: '2026-11-20T10:00:00.000Z',
        endDateTime: '2026-11-20T18:00:00.000Z',
        registrationDeadline: '2026-11-21T00:00:00.000Z' // After start
      };

      const res = await request(app, {
        method: 'POST',
        url: '/api/events',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: invalidPayload
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.errors.some((e) => e.includes('Registration deadline cannot be after')));
    });

    test('6. Input validation rejects missing title or capacity <= 0', async () => {
      const invalidPayload = {
        ...validEventPayload,
        title: '',
        capacity: -5
      };

      const res = await request(app, {
        method: 'POST',
        url: '/api/events',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: invalidPayload
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.errors.length >= 2);
    });

    test('7. Fails when referencing non-existent venue ID', async () => {
      const res = await request(app, {
        method: 'POST',
        url: '/api/events',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          ...validEventPayload,
          venue: new mongoose.Types.ObjectId().toString()
        }
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes('venue does not exist'));
    });
  });

  describe('Event Browsing & Role-Aware Scoping (GET /api/events)', () => {
    let publishedEvent, draftEvent, cancelledEvent;

    beforeEach(() => {
      // 1. Published event by Organizer 1
      publishedEvent = {
        id: new mongoose.Types.ObjectId().toString(),
        title: 'Spring Music Festival',
        description: 'Live student bands on the quadrangle.',
        category: 'cultural',
        organizer: organizer1User.id,
        venue: testVenue.id,
        startDateTime: new Date('2026-12-01T14:00:00Z'),
        endDateTime: new Date('2026-12-01T20:00:00Z'),
        capacity: 500,
        status: 'published',
        tags: ['music', 'festival', 'live'],
        isArchived: false
      };
      app.locals.mockEventStore.set(publishedEvent.id, publishedEvent);

      // 2. Draft event by Organizer 1
      draftEvent = {
        id: new mongoose.Types.ObjectId().toString(),
        title: 'Draft Robotics Showcase',
        description: 'Internal planning for competitive robotics exhibition.',
        category: 'technical',
        organizer: organizer1User.id,
        venue: testVenue.id,
        startDateTime: new Date('2026-12-05T10:00:00Z'),
        endDateTime: new Date('2026-12-05T16:00:00Z'),
        capacity: 80,
        status: 'draft',
        tags: ['robotics'],
        isArchived: false
      };
      app.locals.mockEventStore.set(draftEvent.id, draftEvent);

      // 3. Cancelled event by Organizer 2
      cancelledEvent = {
        id: new mongoose.Types.ObjectId().toString(),
        title: 'Cancelled Theater Play',
        description: 'Postponed drama rehearsal.',
        category: 'cultural',
        organizer: organizer2User.id,
        venue: testVenue.id,
        startDateTime: new Date('2026-12-10T18:00:00Z'),
        endDateTime: new Date('2026-12-10T21:00:00Z'),
        capacity: 100,
        status: 'cancelled',
        tags: ['drama'],
        isArchived: false
      };
      app.locals.mockEventStore.set(cancelledEvent.id, cancelledEvent);
    });

    test('8. Participants can only see published events (drafts and cancelled are hidden)', async () => {
      const res = await request(app, {
        method: 'GET',
        url: '/api/events',
        headers: { authorization: `Bearer ${participantToken}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.count, 1);
      assert.equal(res.body.data[0].id, publishedEvent.id);
      assert.equal(res.body.data[0].status, 'published');
    });

    test('9. Organizers see published events plus their own drafts', async () => {
      const res = await request(app, {
        method: 'GET',
        url: '/api/events',
        headers: { authorization: `Bearer ${organizer1Token}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.count, 2); // Published + own draft (Organizer 2's cancelled event is not visible)
      const ids = res.body.data.map((e) => e.id);
      assert.ok(ids.includes(publishedEvent.id));
      assert.ok(ids.includes(draftEvent.id));
      assert.ok(!ids.includes(cancelledEvent.id));
    });

    test('10. Organizer querying organizer=me retrieves all their events across statuses', async () => {
      const res = await request(app, {
        method: 'GET',
        url: '/api/events?organizer=me',
        headers: { authorization: `Bearer ${organizer1Token}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.count, 2);
      res.body.data.forEach((e) => {
        const orgId = typeof e.organizer === 'object' ? e.organizer.id : e.organizer;
        assert.equal(orgId, organizer1User.id);
      });
    });

    test('11. Text search filters events by keyword', async () => {
      const res = await request(app, {
        method: 'GET',
        url: '/api/events?search=Music',
        headers: { authorization: `Bearer ${participantToken}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.count, 1);
      assert.equal(res.body.data[0].title, 'Spring Music Festival');
    });

    test('12. Category filter restricts event listing', async () => {
      const res = await request(app, {
        method: 'GET',
        url: '/api/events?category=cultural',
        headers: { authorization: `Bearer ${participantToken}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.count, 1);
      assert.equal(res.body.data[0].category, 'cultural');
    });
  });

  describe('Event Details & Access Control (GET /api/events/:id)', () => {
    let publishedEvent, draftEvent;

    beforeEach(() => {
      publishedEvent = {
        id: new mongoose.Types.ObjectId().toString(),
        title: 'Open Campus Tech Talk',
        description: 'AI and cloud computing developments.',
        category: 'seminar',
        organizer: organizer1User.id,
        venue: testVenue.id,
        startDateTime: new Date('2026-11-25T11:00:00Z'),
        endDateTime: new Date('2026-11-25T13:00:00Z'),
        capacity: 200,
        status: 'published',
        isArchived: false
      };
      app.locals.mockEventStore.set(publishedEvent.id, publishedEvent);

      draftEvent = {
        id: new mongoose.Types.ObjectId().toString(),
        title: 'Confidential Executive Meeting',
        description: 'Private planning event.',
        category: 'academic',
        organizer: organizer1User.id,
        venue: null,
        startDateTime: new Date('2026-11-26T14:00:00Z'),
        endDateTime: new Date('2026-11-26T16:00:00Z'),
        capacity: 30,
        status: 'draft',
        isArchived: false
      };
      app.locals.mockEventStore.set(draftEvent.id, draftEvent);
    });

    test('13. Participants can view published event details', async () => {
      publishedEvent.whatsappGroupUrl = 'https://chat.whatsapp.com/SecretInvite';
      const res = await request(app, {
        method: 'GET',
        url: `/api/events/${publishedEvent.id}`,
        headers: { authorization: `Bearer ${participantToken}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.id, publishedEvent.id);
      assert.equal(res.body.data.title, 'Open Campus Tech Talk');
      assert.equal(res.body.data.whatsappGroupUrl, undefined);
    });

    test('Public event listings do not expose WhatsApp invitation URLs', async () => {
      publishedEvent.whatsappGroupUrl = 'https://chat.whatsapp.com/SecretInvite';
      const res = await request(app, {
        method: 'GET',
        url: '/api/events',
        headers: { authorization: 'Bearer ' + participantToken }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data[0].whatsappGroupUrl, undefined);
    });

    test('14. Participants are forbidden from viewing unpublished draft events (403)', async () => {
      const res = await request(app, {
        method: 'GET',
        url: `/api/events/${draftEvent.id}`,
        headers: { authorization: `Bearer ${participantToken}` }
      });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes('permission'));
    });

    test('15. Owner organizer and administrator can view draft events', async () => {
      // Owner organizer
      const ownerRes = await request(app, {
        method: 'GET',
        url: `/api/events/${draftEvent.id}`,
        headers: { authorization: `Bearer ${organizer1Token}` }
      });
      assert.equal(ownerRes.status, 200);
      assert.equal(ownerRes.body.data.id, draftEvent.id);

      // Administrator
      const adminRes = await request(app, {
        method: 'GET',
        url: `/api/events/${draftEvent.id}`,
        headers: { authorization: `Bearer ${adminToken}` }
      });
      assert.equal(adminRes.status, 200);
      assert.equal(adminRes.body.data.id, draftEvent.id);
    });
  });

  describe('Event Mutations, Ownership Checks & Lifecycle', () => {
    let event1;

    beforeEach(() => {
      event1 = {
        id: new mongoose.Types.ObjectId().toString(),
        title: 'Original Title',
        description: 'Original description of the event.',
        category: 'academic',
        organizer: organizer1User.id,
        venue: testVenue.id,
        startDateTime: new Date('2026-11-28T09:00:00Z'),
        endDateTime: new Date('2026-11-28T17:00:00Z'),
        capacity: 100,
        status: 'draft',
        isArchived: false
      };
      app.locals.mockEventStore.set(event1.id, event1);

      const approvedBooking = {
        id: new mongoose.Types.ObjectId().toString(),
        event: event1.id,
        venue: testVenue.id,
        organizer: organizer1User.id,
        startDateTime: event1.startDateTime,
        endDateTime: event1.endDateTime,
        status: 'approved',
        isArchived: false,
        reviewedBy: adminUser.id,
        reviewedAt: new Date()
      };
      app.locals.mockBookingStore.set(approvedBooking.id, approvedBooking);
    });

    test('16. Organizer A cannot update Organizer B\'s event (403 Forbidden)', async () => {
      const res = await request(app, {
        method: 'PUT',
        url: `/api/events/${event1.id}`,
        headers: { authorization: `Bearer ${organizer2Token}` }, // Bob attempting to edit Alice's event
        body: {
          title: 'Malicious Hijacked Title'
        }
      });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes('not authorized'));
    });

    test('17. Owner organizer can update event details', async () => {
      const res = await request(app, {
        method: 'PUT',
        url: `/api/events/${event1.id}`,
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          title: 'Updated Science Symposium',
          capacity: 120
        }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.title, 'Updated Science Symposium');
      assert.equal(res.body.data.capacity, 120);
    });

    test('Owner organizer can update feature values; another organizer cannot', async () => {
      event1.organizer = new mongoose.Types.ObjectId(organizer1User.id);
      const ownerUpdate = await request(app, {
        method: 'PUT',
        url: `/api/events/${event1.id}`,
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          aictePointsAvailable: false,
          attendanceProvided: true,
          eligibleYears: ['second', 'fourth']
        }
      });

      assert.equal(ownerUpdate.status, 200);
      assert.equal(ownerUpdate.body.data.aictePointsAvailable, false);
      assert.equal(ownerUpdate.body.data.attendanceProvided, true);
      assert.deepEqual(ownerUpdate.body.data.eligibleYears, ['second', 'fourth']);

      const unauthorizedUpdate = await request(app, {
        method: 'PUT',
        url: `/api/events/${event1.id}`,
        headers: { authorization: `Bearer ${organizer2Token}` },
        body: { eligibleYears: ['first'] }
      });

      assert.equal(unauthorizedUpdate.status, 403);
      assert.equal(unauthorizedUpdate.body.success, false);
    });

    test('Owner organizer can edit contacts and remove them by submitting an empty array', async () => {
      const addContacts = await request(app, {
        method: 'PUT',
        url: `/api/events/${event1.id}`,
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          contacts: [
            { name: 'Taylor Chen', role: 'Technical Coordinator', email: 'TAYLOR@EXAMPLE.EDU', phone: '(555) 321-7654' },
            { name: 'Jamie Park', email: 'jamie@example.edu' }
          ],
          websiteUrl: 'https://placement.example.edu',
          instagramUrl: 'https://www.instagram.com/placement/'
        }
      });
      assert.equal(addContacts.status, 200);
      assert.deepEqual(addContacts.body.data.contacts.map((contact) => contact.email), [
        'taylor@example.edu',
        'jamie@example.edu'
      ]);
      assert.equal(addContacts.body.data.websiteUrl, 'https://placement.example.edu/');
      assert.equal(addContacts.body.data.instagramUrl, 'https://www.instagram.com/placement/');

      const removeContacts = await request(app, {
        method: 'PUT',
        url: `/api/events/${event1.id}`,
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: { contacts: [], websiteUrl: '', instagramUrl: '' }
      });
      assert.equal(removeContacts.status, 200);
      assert.deepEqual(removeContacts.body.data.contacts, []);
      assert.equal(removeContacts.body.data.websiteUrl, '');
      assert.equal(removeContacts.body.data.instagramUrl, '');
    });

    test('Owner organizer can update or clear the WhatsApp group invite URL', async () => {
      const setLink = await request(app, {
        method: 'PUT',
        url: `/api/events/${event1.id}`,
        headers: { authorization: 'Bearer ' + organizer1Token },
        body: { whatsappGroupUrl: 'https://chat.whatsapp.com/InviteCode' }
      });
      assert.equal(setLink.status, 200);
      assert.equal(setLink.body.data.whatsappGroupUrl, 'https://chat.whatsapp.com/InviteCode');

      const clearLink = await request(app, {
        method: 'PUT',
        url: `/api/events/${event1.id}`,
        headers: { authorization: 'Bearer ' + organizer1Token },
        body: { whatsappGroupUrl: '' }
      });
      assert.equal(clearLink.status, 200);
      assert.equal(clearLink.body.data.whatsappGroupUrl, '');

      const unauthorizedUpdate = await request(app, {
        method: 'PUT',
        url: `/api/events/${event1.id}`,
        headers: { authorization: 'Bearer ' + organizer2Token },
        body: { whatsappGroupUrl: 'https://chat.whatsapp.com/OtherInvite' }
      });
      assert.equal(unauthorizedUpdate.status, 403);
      assert.equal(app.locals.mockEventStore.get(event1.id).whatsappGroupUrl, '');
    });

    test('Owner organizer can publish and cancel an event with an unpopulated BSON ObjectId owner', async () => {
      event1.organizer = new mongoose.Types.ObjectId(organizer1User.id);
      event1.aictePointsAvailable = true;
      event1.attendanceProvided = false;
      event1.eligibleYears = ['first', 'third'];

      // 1. Publish
      const publishRes = await request(app, {
        method: 'PATCH',
        url: `/api/events/${event1.id}/status`,
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: { status: 'published' }
      });
      assert.equal(publishRes.status, 200);
      assert.equal(publishRes.body.data.status, 'published');
      assert.equal(publishRes.body.data.aictePointsAvailable, true);
      assert.equal(publishRes.body.data.attendanceProvided, false);
      assert.deepEqual(publishRes.body.data.eligibleYears, ['first', 'third']);

      // 2. Cancel
      const cancelRes = await request(app, {
        method: 'PATCH',
        url: `/api/events/${event1.id}/status`,
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: { status: 'cancelled' }
      });
      assert.equal(cancelRes.status, 200);
      assert.equal(cancelRes.body.data.status, 'cancelled');
    });

    test('Another organizer cannot publish or cancel an event with a BSON ObjectId owner', async () => {
      event1.organizer = new mongoose.Types.ObjectId(organizer1User.id);

      for (const status of ['published', 'cancelled']) {
        const res = await request(app, {
          method: 'PATCH',
          url: `/api/events/${event1.id}/status`,
          headers: { authorization: `Bearer ${organizer2Token}` },
          body: { status }
        });

        assert.equal(res.status, 403);
        assert.equal(res.body.success, false);
        assert.match(res.body.message, /not authorized to update this event/i);
      }

      assert.equal(event1.status, 'draft');
    });

    test('Event update and status endpoints reject invalid and unknown event IDs', async () => {
      const invalidUpdate = await request(app, {
        method: 'PUT',
        url: '/api/events/not-an-object-id',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: { title: 'Updated Title' }
      });
      assert.equal(invalidUpdate.status, 400);
      assert.match(invalidUpdate.body.message, /invalid event id/i);

      const missingUpdate = await request(app, {
        method: 'PUT',
        url: `/api/events/${new mongoose.Types.ObjectId()}`,
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: { title: 'Updated Title' }
      });
      assert.equal(missingUpdate.status, 404);
      assert.match(missingUpdate.body.message, /event not found/i);

      const invalidStatus = await request(app, {
        method: 'PATCH',
        url: '/api/events/not-an-object-id/status',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: { status: 'published' }
      });
      assert.equal(invalidStatus.status, 400);
      assert.match(invalidStatus.body.message, /invalid event id/i);

      const missingStatus = await request(app, {
        method: 'PATCH',
        url: `/api/events/${new mongoose.Types.ObjectId()}/status`,
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: { status: 'published' }
      });
      assert.equal(missingStatus.status, 404);
      assert.match(missingStatus.body.message, /event not found/i);
    });

    test('19. Safe archival: DELETE sets isArchived to true', async () => {
      const res = await request(app, {
        method: 'DELETE',
        url: `/api/events/${event1.id}`,
        headers: { authorization: `Bearer ${organizer1Token}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      // Verify event is now inaccessible via GET
      const getRes = await request(app, {
        method: 'GET',
        url: `/api/events/${event1.id}`,
        headers: { authorization: `Bearer ${organizer1Token}` }
      });
      assert.equal(getRes.status, 404);
    });
  });

  describe('Day 6 Regression Suite: Query Overwrites, Production Hardening, Date Consistency & Publishing', () => {
    test('20. buildEventQuery combines role visibility and search keyword using $and without overwriting', () => {
      const query = buildEventQuery({
        user: organizer1User,
        search: 'hackathon',
        status: null
      });

      assert.ok(query.$and, 'Query must use $and array to prevent property overwrite');
      assert.ok(Array.isArray(query.$and));

      // 1. Non-archived constraint must be present
      const archiveCond = query.$and.find((c) => c.isArchived === false);
      assert.ok(archiveCond, 'Archive condition must be preserved');

      // 2. Organizer visibility constraint must be present in $and
      const visibilityCond = query.$and.find(
        (c) => c.$or && c.$or.some((o) => o.status === 'published') && c.$or.some((o) => o.organizer === organizer1User.id)
      );
      assert.ok(visibilityCond, 'Organizer visibility $or must not be overwritten by search $or');

      // 3. Search regex condition must be present in $and
      const searchCond = query.$and.find(
        (c) => c.$or && c.$or.some((o) => o.title && o.title.$regex === 'hackathon')
      );
      assert.ok(searchCond, 'Keyword search $or condition must be preserved in $and');
    });

    test('21. buildEventQuery enforces strict participant visibility even when searching', () => {
      const query = buildEventQuery({
        user: participantUser,
        search: 'science',
        category: 'academic'
      });

      assert.ok(query.$and);
      const statusCond = query.$and.find((c) => c.status === 'published');
      assert.ok(statusCond, 'Participant must strictly be restricted to published events');

      const categoryCond = query.$and.find((c) => c.category === 'academic');
      assert.ok(categoryCond, 'Category filter must be present');

      const searchCond = query.$and.find(
        (c) => c.$or && c.$or.some((o) => o.title && o.title.$regex === 'science')
      );
      assert.ok(searchCond, 'Search condition must be combined with status constraint');
    });

    test('22. buildEventQuery safely escapes regex metacharacters in search text', () => {
      const dangerousSearch = 'Event (2026) [Tech]+*?';
      const query = buildEventQuery({
        user: organizer1User,
        search: dangerousSearch
      });

      const searchCond = query.$and.find((c) => c.$or && c.$or.some((o) => o.title));
      assert.ok(searchCond);
      const titleRegexPattern = searchCond.$or.find((o) => o.title).title.$regex;
      const compiledRegex = new RegExp(titleRegexPattern, 'i');
      // Regex should match literal metacharacters without throwing error
      assert.ok(compiledRegex.test('Event (2026) [Tech]+*?'));
      assert.ok(!compiledRegex.test('Event 2026 Tech'));
    });

    test('23. Production Hardening: mock store helper strictly returns null when NODE_ENV is production', () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        const mockReq = { app: { locals: { mockEventStore: new Map([['test_1', { id: 'test_1' }]]) } } };
        assert.equal(getStore(mockReq), null, 'getStore must strictly return null when NODE_ENV is production');

        process.env.NODE_ENV = 'test';
        assert.equal(getStore(mockReq), mockReq.app.locals.mockEventStore, 'getStore returns mock store when NODE_ENV is not production');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    test('24. Partial Date Update: Moving startDateTime earlier than existing registrationDeadline fails with 400', async () => {
      // Create existing event with start date and deadline
      const existingId = new mongoose.Types.ObjectId().toString();
      const existing = {
        id: existingId,
        title: 'Cybersecurity Workshop',
        description: 'Hands-on ethical hacking seminar.',
        category: 'technical',
        organizer: organizer1User.id,
        venue: testVenue.id,
        startDateTime: new Date('2026-11-20T10:00:00Z'),
        endDateTime: new Date('2026-11-20T18:00:00Z'),
        registrationDeadline: new Date('2026-11-15T10:00:00Z'),
        capacity: 60,
        status: 'draft',
        isArchived: false
      };
      app.locals.mockEventStore.set(existingId, existing);

      // Attempt to update startDateTime to 2026-11-12 without passing registrationDeadline
      const updateRes = await request(app, {
        method: 'PUT',
        url: `/api/events/${existingId}`,
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          startDateTime: '2026-11-12T10:00:00Z' // Earlier than registrationDeadline 2026-11-15!
        }
      });

      assert.equal(updateRes.status, 400);
      assert.equal(updateRes.body.success, false);
      assert.ok(updateRes.body.errors.some((e) => e.includes('Registration deadline cannot be after')));
    });

    test('25. Partial Date Update: Moving startDateTime later than existing endDateTime fails with 400', async () => {
      const existingId = new mongoose.Types.ObjectId().toString();
      const existing = {
        id: existingId,
        title: 'Robotics Workshop',
        description: 'Autonomous navigation seminar.',
        category: 'technical',
        organizer: organizer1User.id,
        venue: testVenue.id,
        startDateTime: new Date('2026-11-20T10:00:00Z'),
        endDateTime: new Date('2026-11-20T18:00:00Z'),
        capacity: 40,
        status: 'draft',
        isArchived: false
      };
      app.locals.mockEventStore.set(existingId, existing);

      // Attempt to move startDateTime after endDateTime (without supplying endDateTime)
      const updateRes = await request(app, {
        method: 'PUT',
        url: `/api/events/${existingId}`,
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          startDateTime: '2026-11-20T19:00:00Z' // Later than endDateTime 2026-11-20T18:00:00Z!
        }
      });

      assert.equal(updateRes.status, 400);
      assert.equal(updateRes.body.success, false);
      assert.ok(updateRes.body.errors.some((e) => e.includes('Event end date and time must be after')));
    });

    test('26. Publishing requires an assigned venue', async () => {
      const noVenueEventId = new mongoose.Types.ObjectId().toString();
      const noVenueEvent = {
        id: noVenueEventId,
        title: 'Virtual Hackathon',
        description: 'Online competition without physical venue.',
        category: 'technical',
        organizer: organizer1User.id,
        venue: null, // No venue assigned
        startDateTime: new Date('2026-12-01T10:00:00Z'),
        endDateTime: new Date('2026-12-01T18:00:00Z'),
        capacity: 50,
        status: 'draft',
        isArchived: false
      };
      app.locals.mockEventStore.set(noVenueEventId, noVenueEvent);

      const publishRes = await request(app, {
        method: 'PATCH',
        url: `/api/events/${noVenueEventId}/status`,
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: { status: 'published' }
      });

      assert.equal(publishRes.status, 400);
      assert.equal(publishRes.body.success, false);
      assert.ok(publishRes.body.message.includes('assigned venue'));
    });

    test('27. Draft event update does not require an approved venue booking merely to remain draft', async () => {
      const draftEventId = new mongoose.Types.ObjectId().toString();
      const draftEvent = {
        id: draftEventId,
        title: 'Draft Science Workshop',
        description: 'Workshop draft before venue approval.',
        category: 'academic',
        organizer: organizer1User.id,
        venue: testVenue.id,
        startDateTime: new Date('2026-12-05T09:00:00Z'),
        endDateTime: new Date('2026-12-05T17:00:00Z'),
        capacity: 40,
        status: 'draft',
        isArchived: false
      };
      app.locals.mockEventStore.set(draftEventId, draftEvent);

      // Update dates without any booking in mockBookingStore
      const updateRes = await request(app, {
        method: 'PUT',
        url: `/api/events/${draftEventId}`,
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          startDateTime: '2026-12-06T10:00:00Z',
          endDateTime: '2026-12-06T18:00:00Z'
        }
      });

      assert.equal(updateRes.status, 200);
      assert.equal(updateRes.body.data.status, 'draft');
    });

    test('28. Published event date update is rejected when omitting status and no approved booking covers new dates', async () => {
      const publishedEventId = new mongoose.Types.ObjectId().toString();
      const publishedEvent = {
        id: publishedEventId,
        title: 'Published Annual Symposium',
        description: 'Approved symposium event.',
        category: 'academic',
        organizer: organizer1User.id,
        venue: testVenue.id,
        startDateTime: new Date('2026-12-10T09:00:00Z'),
        endDateTime: new Date('2026-12-10T17:00:00Z'),
        capacity: 100,
        status: 'published',
        isArchived: false
      };
      app.locals.mockEventStore.set(publishedEventId, publishedEvent);

      // Seed approved booking covering only original dates (Dec 10)
      const booking = {
        id: new mongoose.Types.ObjectId().toString(),
        event: publishedEventId,
        venue: testVenue.id,
        organizer: organizer1User.id,
        startDateTime: new Date('2026-12-10T09:00:00Z'),
        endDateTime: new Date('2026-12-10T17:00:00Z'),
        status: 'approved',
        isArchived: false
      };
      app.locals.mockBookingStore.set(booking.id, booking);

      // Update dates to Dec 11 omitting status
      const updateRes = await request(app, {
        method: 'PUT',
        url: `/api/events/${publishedEventId}`,
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          startDateTime: '2026-12-11T09:00:00Z',
          endDateTime: '2026-12-11T17:00:00Z'
        }
      });

      assert.equal(updateRes.status, 400);
      assert.match(updateRes.body.message, /approved venue booking covering the complete event duration is required/i);
    });

    test('29. Published event date update succeeds when omitting status and matching approved booking exists', async () => {
      const publishedEventId = new mongoose.Types.ObjectId().toString();
      const publishedEvent = {
        id: publishedEventId,
        title: 'Published Music Festival',
        description: 'Approved music event.',
        category: 'cultural',
        organizer: organizer1User.id,
        venue: testVenue.id,
        startDateTime: new Date('2026-12-12T10:00:00Z'),
        endDateTime: new Date('2026-12-12T16:00:00Z'),
        capacity: 250,
        status: 'published',
        isArchived: false
      };
      app.locals.mockEventStore.set(publishedEventId, publishedEvent);

      // Seed approved booking covering a wide window (09:00 to 18:00)
      const booking = {
        id: new mongoose.Types.ObjectId().toString(),
        event: publishedEventId,
        venue: testVenue.id,
        organizer: organizer1User.id,
        startDateTime: new Date('2026-12-12T09:00:00Z'),
        endDateTime: new Date('2026-12-12T18:00:00Z'),
        status: 'approved',
        isArchived: false
      };
      app.locals.mockBookingStore.set(booking.id, booking);

      // Update dates within the booking window (10:30 to 15:30) omitting status
      const updateRes = await request(app, {
        method: 'PUT',
        url: `/api/events/${publishedEventId}`,
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          startDateTime: '2026-12-12T10:30:00Z',
          endDateTime: '2026-12-12T15:30:00Z'
        }
      });

      assert.equal(updateRes.status, 200);
      assert.equal(updateRes.body.data.status, 'published');
    });

    test('30. Published event venue change is rejected when new venue has no approved booking', async () => {
      const publishedEventId = new mongoose.Types.ObjectId().toString();
      const publishedEvent = {
        id: publishedEventId,
        title: 'Published Tech Conference',
        description: 'Approved tech conference.',
        category: 'technical',
        organizer: organizer1User.id,
        venue: testVenue.id,
        startDateTime: new Date('2026-12-15T09:00:00Z'),
        endDateTime: new Date('2026-12-15T17:00:00Z'),
        capacity: 100,
        status: 'published',
        isArchived: false
      };
      app.locals.mockEventStore.set(publishedEventId, publishedEvent);

      // Booking only exists for testVenue, not venue2
      const booking = {
        id: new mongoose.Types.ObjectId().toString(),
        event: publishedEventId,
        venue: testVenue.id,
        organizer: organizer1User.id,
        startDateTime: new Date('2026-12-15T09:00:00Z'),
        endDateTime: new Date('2026-12-15T17:00:00Z'),
        status: 'approved',
        isArchived: false
      };
      app.locals.mockBookingStore.set(booking.id, booking);

      const venue2 = {
        id: new mongoose.Types.ObjectId().toString(),
        name: 'Secondary Auditorium',
        location: 'Building C',
        capacity: 200,
        facilities: [],
        hourlyRate: 40,
        status: 'available',
        isArchived: false,
        createdBy: adminUser.id
      };
      app.locals.mockVenueStore.set(venue2.id, venue2);

      // Attempt to switch venue to venue2 without a booking for venue2
      const updateRes = await request(app, {
        method: 'PUT',
        url: `/api/events/${publishedEventId}`,
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          venue: venue2.id
        }
      });

      assert.equal(updateRes.status, 400);
      assert.match(updateRes.body.message, /approved venue booking covering the complete event duration is required/i);
    });

    test('31. Published event venue change succeeds when new venue has an approved booking covering event', async () => {
      const publishedEventId = new mongoose.Types.ObjectId().toString();
      const publishedEvent = {
        id: publishedEventId,
        title: 'Published Esports Finals',
        description: 'Gaming finals.',
        category: 'sports',
        organizer: organizer1User.id,
        venue: testVenue.id,
        startDateTime: new Date('2026-12-20T10:00:00Z'),
        endDateTime: new Date('2026-12-20T18:00:00Z'),
        capacity: 100,
        status: 'published',
        isArchived: false
      };
      app.locals.mockEventStore.set(publishedEventId, publishedEvent);

      const venue2 = {
        id: new mongoose.Types.ObjectId().toString(),
        name: 'Esports Arena',
        location: 'Student Center Arena',
        capacity: 300,
        facilities: ['Gigabit LAN'],
        hourlyRate: 80,
        status: 'available',
        isArchived: false,
        createdBy: adminUser.id
      };
      app.locals.mockVenueStore.set(venue2.id, venue2);

      // Seed approved booking for venue2
      const booking2 = {
        id: new mongoose.Types.ObjectId().toString(),
        event: publishedEventId,
        venue: venue2.id,
        organizer: organizer1User.id,
        startDateTime: new Date('2026-12-20T10:00:00Z'),
        endDateTime: new Date('2026-12-20T18:00:00Z'),
        status: 'approved',
        isArchived: false
      };
      app.locals.mockBookingStore.set(booking2.id, booking2);

      const updateRes = await request(app, {
        method: 'PUT',
        url: `/api/events/${publishedEventId}`,
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          venue: venue2.id
        }
      });

      assert.equal(updateRes.status, 200);
      assert.equal(updateRes.body.data.status, 'published');
    });

    test('32. Published event non-date/venue update (e.g. title) succeeds when omitting status', async () => {
      const publishedEventId = new mongoose.Types.ObjectId().toString();
      const publishedEvent = {
        id: publishedEventId,
        title: 'Original Title',
        description: 'Description',
        category: 'academic',
        organizer: organizer1User.id,
        venue: testVenue.id,
        startDateTime: new Date('2026-12-22T09:00:00Z'),
        endDateTime: new Date('2026-12-22T17:00:00Z'),
        capacity: 100,
        status: 'published',
        isArchived: false
      };
      app.locals.mockEventStore.set(publishedEventId, publishedEvent);

      const updateRes = await request(app, {
        method: 'PUT',
        url: `/api/events/${publishedEventId}`,
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          title: 'Polished Professional Title'
        }
      });

      assert.equal(updateRes.status, 200);
      assert.equal(updateRes.body.data.title, 'Polished Professional Title');
      assert.equal(updateRes.body.data.status, 'published');
    });
  });
});
