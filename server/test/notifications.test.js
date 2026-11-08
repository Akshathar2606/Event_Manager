const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const app = require('../src/app');
const { request } = require('./testHelper');
const { signToken } = require('../src/utils/token');
const { persistNotification, persistActivity } = require('../src/services/workflowService');
const { User } = require('../src/models/User');
const { getReferenceId } = require('../src/controllers/notificationController');

const authHeader = (token) => ({ authorization: `Bearer ${token}` });
const objectId = () => new mongoose.Types.ObjectId().toString();

describe('Notification and event activity workflows (mock-store tests; no MongoDB integration)', () => {
  let admin;
  let organizer;
  let secondOrganizer;
  let participant;
  let vendor;
  let adminToken;
  let organizerToken;
  let secondOrganizerToken;
  let participantToken;
  let vendorToken;
  let event;
  let venue;

  beforeEach(() => {
    app.locals.mockUserStore = new Map();
    app.locals.mockEventStore = new Map();
    app.locals.mockVenueStore = new Map();
    app.locals.mockRegistrationStore = new Map();
    app.locals.mockBookingStore = new Map();
    app.locals.mockCateringStore = new Map();
    app.locals.mockCateringRequestStore = new Map();
    app.locals.mockVendorApplicationStore = new Map();
    app.locals.mockNotificationStore = new Map();
    app.locals.mockEventActivityStore = new Map();

    admin = { id: objectId(), name: 'Admin One', email: 'admin@example.test', role: 'administrator', isActive: true };
    organizer = { id: objectId(), name: 'Organizer One', email: 'organizer@example.test', role: 'organizer', isActive: true };
    secondOrganizer = { id: objectId(), name: 'Organizer Two', email: 'organizer2@example.test', role: 'organizer', isActive: true };
    participant = { id: objectId(), name: 'Participant One', email: 'participant@example.test', role: 'participant', isActive: true };
    vendor = { id: objectId(), name: 'Vendor One', email: 'vendor@example.test', role: 'vendor', isActive: true };
    for (const user of [admin, organizer, secondOrganizer, participant, vendor]) {
      app.locals.mockUserStore.set(user.id, user);
    }
    adminToken = signToken(admin);
    organizerToken = signToken(organizer);
    secondOrganizerToken = signToken(secondOrganizer);
    participantToken = signToken(participant);
    vendorToken = signToken(vendor);

    const startDateTime = new Date(Date.now() + 5 * 86400000);
    const endDateTime = new Date(startDateTime.getTime() + 3 * 3600000);
    event = {
      id: objectId(),
      title: 'Workflow Workshop',
      description: 'A practical workshop for participants.',
      category: 'technical',
      organizer: organizer.id,
      venue: null,
      startDateTime,
      endDateTime,
      registrationDeadline: new Date(startDateTime.getTime() - 86400000),
      capacity: 100,
      registeredCount: 0,
      eligibleYears: ['first', 'second', 'third', 'fourth'],
      status: 'published',
      isArchived: false
    };
    venue = {
      id: objectId(),
      name: 'Main Hall',
      location: 'Campus',
      capacity: 200,
      status: 'available',
      isArchived: false
    };
    app.locals.mockEventStore.set(event.id, event);
    app.locals.mockVenueStore.set(venue.id, venue);
  });

  test('reference ID resolver handles ObjectIds, documents, primitives and self-references', () => {
    const directId = new mongoose.Types.ObjectId();
    const nestedId = new mongoose.Types.ObjectId();
    const populatedUser = new User({
      name: 'Populated User',
      email: 'populated@example.test',
      passwordHash: 'not-a-real-password-hash',
      role: 'organizer'
    });
    const selfReference = {};
    selfReference._id = selfReference;

    assert.equal(getReferenceId(directId), directId.toHexString());
    assert.equal(getReferenceId({ _id: nestedId }), nestedId.toHexString());
    assert.equal(getReferenceId(populatedUser), populatedUser._id.toHexString());
    assert.equal(getReferenceId('plain-id'), 'plain-id');
    assert.equal(getReferenceId(42), '42');
    assert.equal(getReferenceId(null), null);
    assert.equal(getReferenceId(undefined), null);
    assert.equal(getReferenceId(selfReference), null);
    assert.equal(getReferenceId({ id: false }), null);
  });

  test('notification payload validation and dedupe prevent arbitrary or duplicate delivery', async () => {
    const payload = {
      recipientId: organizer.id,
      actorId: participant.id,
      type: 'registration_created',
      title: 'New registration',
      message: 'A participant registered for an event.',
      entityType: 'registration',
      entityId: objectId(),
      dedupeKey: 'registration:once'
    };
    const created = await persistNotification({ app }, payload);
    const duplicate = await persistNotification({ app }, payload);

    assert.ok(created);
    assert.equal(duplicate, null);
    assert.equal(app.locals.mockNotificationStore.size, 1);
    await assert.rejects(() => persistNotification({ app }, { ...payload, type: 'arbitrary' }));
    await assert.rejects(() => persistNotification({ app }, { ...payload, recipientId: 'not-an-id' }));
  });

  test('notification list is recipient-scoped, unread count, read actions and pagination work', async () => {
    for (let index = 0; index < 3; index += 1) {
      await persistNotification({ app }, {
        recipientId: organizer.id,
        type: 'event_updated',
        title: `Update ${index}`,
        message: 'An event has important updates.',
        entityType: 'event',
        entityId: event.id,
        dedupeKey: `notification:${index}`
      });

    }
    await persistNotification({ app }, {
      recipientId: participant.id,
      type: 'event_updated',
      title: 'Private update',
      message: 'This is for another user.',
      entityType: 'event',
      entityId: event.id,
      dedupeKey: 'notification:private'
    });

    const firstPage = await request(app, {
      url: '/api/notifications?page=1&limit=2',
      headers: authHeader(organizerToken)
    });
    assert.equal(firstPage.statusCode, 200);
    assert.equal(firstPage.body.data.length, 2);
    assert.equal(firstPage.body.pagination.total, 3);
    assert.equal(firstPage.body.data.some((item) => item.title === 'Private update'), false);

    const count = await request(app, {
      url: '/api/notifications/unread-count',
      headers: authHeader(organizerToken)
    });
    assert.deepEqual(count.body.data, { count: 3 });

    const firstNotificationId = firstPage.body.data[0].id;
    const marked = await request(app, {
      method: 'PATCH',
      url: `/api/notifications/${firstNotificationId}/read`,
      headers: authHeader(organizerToken)
    });
    assert.equal(marked.statusCode, 200);
    assert.ok(marked.body.data.readAt);

    const denied = await request(app, {
      method: 'PATCH',
      url: `/api/notifications/${firstNotificationId}/read`,
      headers: authHeader(participantToken)
    });
    assert.equal(denied.statusCode, 404);

    const allRead = await request(app, {
      method: 'PATCH',
      url: '/api/notifications/read-all',
      headers: authHeader(organizerToken)
    });
    assert.equal(allRead.statusCode, 200);
    assert.equal(allRead.body.data.modifiedCount, 2);
    const afterAllRead = await request(app, {
      url: '/api/notifications/unread-count',
      headers: authHeader(organizerToken)
    });
    assert.deepEqual(afterAllRead.body.data, { count: 0 });
  });

  test('GET /api/notifications serializes MongoDB ObjectIds without recursion', async () => {
    const notificationId = new mongoose.Types.ObjectId();
    const actorId = new mongoose.Types.ObjectId();
    const entityId = new mongoose.Types.ObjectId();
    app.locals.mockNotificationStore.set(notificationId.toHexString(), {
      _id: notificationId,
      recipientId: organizer.id,
      actorId: { _id: actorId, name: 'Workflow Actor' },
      type: 'event_updated',
      title: 'Event updated',
      message: 'An event has important updates.',
      entityType: 'event',
      entityId,
      readAt: null,
      createdAt: new Date()
    });

    const response = await request(app, {
      url: '/api/notifications?page=1&limit=10',
      headers: authHeader(organizerToken)
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(response.body.data[0].id, notificationId.toHexString());
    assert.equal(response.body.data[0].actor.id, actorId.toHexString());
    assert.equal(response.body.data[0].entityId, entityId.toHexString());
  });

  test('registration creates organizer notification and event activity with owner-only access', async () => {
    const registered = await request(app, {
      method: 'POST',
      url: '/api/registrations',
      headers: authHeader(participantToken),
      body: { event: event.id, academicYear: 'first' }
    });
    assert.equal(registered.statusCode, 201);
    assert.equal(app.locals.mockNotificationStore.size, 1);
    assert.equal(Array.from(app.locals.mockNotificationStore.values())[0].recipientId, organizer.id);
    assert.equal(Array.from(app.locals.mockEventActivityStore.values())[0].action, 'participant_registered');

    const history = await request(app, {
      url: `/api/events/${event.id}/activity`,
      headers: authHeader(organizerToken)
    });
    assert.equal(history.statusCode, 200);
    assert.equal(history.body.data.length, 1);
    assert.equal(history.body.data[0].actor.name, participant.name);

    const unrelated = await request(app, {
      url: `/api/events/${event.id}/activity`,
      headers: authHeader(secondOrganizerToken)
    });
    assert.equal(unrelated.statusCode, 403);
    const participantDenied = await request(app, {
      url: `/api/events/${event.id}/activity`,
      headers: authHeader(participantToken)
    });
    assert.equal(participantDenied.statusCode, 403);
  });

  test('new booking request notifies administrators and records event activity', async () => {
    const response = await request(app, {
      method: 'POST',
      url: '/api/bookings',
      headers: authHeader(organizerToken),
      body: { event: event.id, venue: venue.id }
    });
    assert.equal(response.statusCode, 201);
    const notification = Array.from(app.locals.mockNotificationStore.values())[0];
    assert.equal(notification.recipientId, admin.id);
    assert.equal(notification.type, 'booking_requested');
    assert.equal(Array.from(app.locals.mockEventActivityStore.values())[0].action, 'venue_booking_requested');

    const approved = await request(app, {
      method: 'PATCH',
      url: `/api/bookings/${response.body.data.id}/approve`,
      headers: authHeader(adminToken)
    });
    assert.equal(approved.statusCode, 200);
    assert.ok(Array.from(app.locals.mockNotificationStore.values())
      .some((item) => item.recipientId === organizer.id && item.type === 'booking_approved'));
    assert.ok(Array.from(app.locals.mockEventActivityStore.values())
      .some((item) => item.action === 'venue_booking_approved'));
  });

  test('catering request notifies its assigned vendor and records event activity', async () => {
    const serviceId = objectId();
    const packageId = objectId();
    app.locals.mockCateringStore.set(serviceId, {
      id: serviceId,
      vendorId: vendor.id,
      businessName: 'Campus Catering',
      serviceArea: 'Campus',
      isAvailable: true,
      packages: [{
        id: packageId,
        name: 'Standard',
        pricePerPlate: 12,
        minOrder: 10,
        maxGuests: 100,
        menuItems: [],
        dietaryOptions: []
      }]
    });
    const response = await request(app, {
      method: 'POST',
      url: '/api/catering-requests',
      headers: authHeader(organizerToken),
      body: { eventId: event.id, cateringServiceId: serviceId, packageId, guestCount: 30 }
    });
    assert.equal(response.statusCode, 201);
    const notification = Array.from(app.locals.mockNotificationStore.values())[0];
    assert.equal(notification.recipientId, vendor.id);
    assert.equal(notification.type, 'catering_requested');
    assert.equal(Array.from(app.locals.mockEventActivityStore.values())[0].action, 'catering_request_created');

    const accepted = await request(app, {
      method: 'PATCH',
      url: `/api/catering-requests/${response.body.data.id}/accept`,
      headers: authHeader(vendorToken),
      body: { notes: 'Confirmed for the event.' }
    });
    assert.equal(accepted.statusCode, 200);
    assert.ok(Array.from(app.locals.mockNotificationStore.values())
      .some((item) => item.recipientId === organizer.id && item.type === 'catering_accepted'));
    assert.ok(Array.from(app.locals.mockEventActivityStore.values())
      .some((item) => item.action === 'catering_request_accepted'));
  });

  test('vendor application approval notifies only the applicant', async () => {
    const applicationId = objectId();
    app.locals.mockVendorApplicationStore.set(vendor.id, {
      id: applicationId,
      vendorId: vendor.id,
      businessName: 'Vendor Business',
      businessCategory: 'Catering',
      businessDescription: 'Fresh meals prepared for campus events.',
      contactNumber: '5551234',
      city: 'Springfield',
      locality: 'Central',
      servicesOffered: ['Catering'],
      status: 'pending'
    });
    const response = await request(app, {
      method: 'PATCH',
      url: `/api/vendor-applications/${applicationId}/approve`,
      headers: authHeader(adminToken)
    });
    assert.equal(response.statusCode, 200);
    assert.equal(app.locals.mockNotificationStore.size, 1);
    const notification = Array.from(app.locals.mockNotificationStore.values())[0];
    assert.equal(notification.recipientId, vendor.id);
    assert.equal(notification.type, 'vendor_application_approved');
  });

  test('activity creation is idempotent and unauthenticated history access is rejected', async () => {
    const activity = {
      eventId: event.id,
      actorId: organizer.id,
      action: 'event_created',
      description: 'The event was created.',
      metadata: {},
      dedupeKey: `event-created:${event.id}`
    };
    await persistActivity({ app }, activity);
    await persistActivity({ app }, activity);
    assert.equal(app.locals.mockEventActivityStore.size, 1);
    const denied = await request(app, { url: `/api/events/${event.id}/activity` });
    assert.equal(denied.statusCode, 401);
  });

  test('a completed published event is recorded on the next successful event mutation, not on reads', async () => {
    event.startDateTime = new Date(Date.now() - 3 * 86400000);
    event.endDateTime = new Date(Date.now() - 2 * 86400000);
    event.registrationDeadline = new Date(Date.now() - 4 * 86400000);
    event.venue = venue.id;
    const read = await request(app, {
      url: `/api/events/${event.id}`,
      headers: authHeader(organizerToken)
    });
    assert.equal(read.statusCode, 200);
    assert.equal(app.locals.mockEventActivityStore.size, 0);

    const updated = await request(app, {
      method: 'PUT',
      url: `/api/events/${event.id}`,
      headers: authHeader(organizerToken),
      body: { description: 'The workshop has concluded.' }
    });
    assert.equal(updated.statusCode, 200, JSON.stringify(updated.body));
    assert.ok(Array.from(app.locals.mockEventActivityStore.values())
      .some((activity) => activity.action === 'event_completed'));
  });
});
