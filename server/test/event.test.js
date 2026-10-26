const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const app = require('../src/app');
const { request } = require('./testHelper');
const { signToken } = require('../src/utils/token');
const { buildEventQuery, getStore } = require('../src/controllers/eventController');

describe('EventFlow Event Management Test Suite', () => {
  let adminUser, adminToken;
  let organizer1User, organizer1Token;
  let organizer2User, organizer2Token;
  let participantUser, participantToken;
  let vendorUser, vendorToken;
  let testVenue;

  beforeEach(() => {
    // Reset test in-memory stores before each test
    app.locals.mockUserStore = new Map();
    app.locals.mockVenueStore = new Map();
    app.locals.mockCateringStore = new Map();
    app.locals.mockEventStore = new Map();

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
      const res = await request(app, {
        method: 'GET',
        url: `/api/events/${publishedEvent.id}`,
        headers: { authorization: `Bearer ${participantToken}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.id, publishedEvent.id);
      assert.equal(res.body.data.title, 'Open Campus Tech Talk');
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

    test('18. Status update: Owner organizer can publish and cancel event', async () => {
      // 1. Publish
      const publishRes = await request(app, {
        method: 'PATCH',
        url: `/api/events/${event1.id}/status`,
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: { status: 'published' }
      });
      assert.equal(publishRes.status, 200);
      assert.equal(publishRes.body.data.status, 'published');

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
  });
});
