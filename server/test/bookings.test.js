const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const app = require('../src/app');
const { request } = require('./testHelper');
const { signToken } = require('../src/utils/token');
const { BOOKING_STATUS } = require('../src/models/Booking');

describe('EventFlow Venue Booking Management Test Suite', () => {
  let adminUser, adminToken;
  let organizer1User, organizer1Token;
  let organizer2User, organizer2Token;
  let participantUser, participantToken;
  let vendorUser, vendorToken;

  let activeVenue;
  let maintenanceVenue;
  let archivedVenue;

  let validEvent1;
  let validEvent2;
  let cancelledEvent;
  let archivedEvent;

  beforeEach(() => {
    // Reset in-memory test stores
    app.locals.mockUserStore = new Map();
    app.locals.mockVenueStore = new Map();
    app.locals.mockEventStore = new Map();
    app.locals.mockBookingStore = new Map();

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
      organization: 'Art Society',
      isActive: true
    };
    app.locals.mockUserStore.set(organizer2User.id, organizer2User);
    organizer2Token = signToken(organizer2User);

    participantUser = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Charlie Student',
      email: 'charlie@student.edu',
      role: 'participant',
      isActive: true
    };
    app.locals.mockUserStore.set(participantUser.id, participantUser);
    participantToken = signToken(participantUser);

    vendorUser = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Vinnie Vendor',
      email: 'vinnie@catering.com',
      role: 'vendor',
      isActive: true
    };
    app.locals.mockUserStore.set(vendorUser.id, vendorUser);
    vendorToken = signToken(vendorUser);

    // 2. Venues
    activeVenue = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Campus Main Auditorium',
      location: 'Building A, 1st Floor',
      capacity: 400,
      facilities: ['Stage', 'Projector', 'Wi-Fi'],
      hourlyRate: 75,
      status: 'available',
      isArchived: false,
      createdBy: adminUser.id
    };
    app.locals.mockVenueStore.set(activeVenue.id, activeVenue);

    maintenanceVenue = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'North Lecture Hall',
      location: 'Building B, 2nd Floor',
      capacity: 150,
      facilities: ['Whiteboard'],
      hourlyRate: 30,
      status: 'maintenance',
      isArchived: false,
      createdBy: adminUser.id
    };
    app.locals.mockVenueStore.set(maintenanceVenue.id, maintenanceVenue);

    archivedVenue = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Old Annex Pavilion',
      location: 'South Campus',
      capacity: 50,
      facilities: [],
      hourlyRate: 10,
      status: 'available',
      isArchived: true,
      createdBy: adminUser.id
    };
    app.locals.mockVenueStore.set(archivedVenue.id, archivedVenue);

    // 3. Events
    validEvent1 = {
      id: new mongoose.Types.ObjectId().toString(),
      title: 'Robotics Showcase 2026',
      description: 'Annual robotics competition and engineering showcase.',
      category: 'technical',
      organizer: organizer1User.id,
      venue: activeVenue.id,
      startDateTime: new Date('2026-11-20T10:00:00.000Z'),
      endDateTime: new Date('2026-11-20T16:00:00.000Z'),
      capacity: 200,
      status: 'draft',
      isArchived: false
    };
    app.locals.mockEventStore.set(validEvent1.id, validEvent1);

    validEvent2 = {
      id: new mongoose.Types.ObjectId().toString(),
      title: 'Autumn Arts Gala',
      description: 'An evening gala celebrating collegiate fine arts.',
      category: 'cultural',
      organizer: organizer2User.id,
      venue: activeVenue.id,
      startDateTime: new Date('2026-11-20T14:00:00.000Z'),
      endDateTime: new Date('2026-11-20T18:00:00.000Z'),
      capacity: 150,
      status: 'draft',
      isArchived: false
    };
    app.locals.mockEventStore.set(validEvent2.id, validEvent2);

    cancelledEvent = {
      id: new mongoose.Types.ObjectId().toString(),
      title: 'Cancelled Hackathon',
      description: 'Event that was cancelled.',
      category: 'technical',
      organizer: organizer1User.id,
      venue: activeVenue.id,
      startDateTime: new Date('2026-11-22T09:00:00.000Z'),
      endDateTime: new Date('2026-11-22T17:00:00.000Z'),
      capacity: 100,
      status: 'cancelled',
      isArchived: false
    };
    app.locals.mockEventStore.set(cancelledEvent.id, cancelledEvent);

    archivedEvent = {
      id: new mongoose.Types.ObjectId().toString(),
      title: 'Archived Seminar',
      description: 'Event that was deleted/archived.',
      category: 'academic',
      organizer: organizer1User.id,
      venue: activeVenue.id,
      startDateTime: new Date('2026-11-23T09:00:00.000Z'),
      endDateTime: new Date('2026-11-23T17:00:00.000Z'),
      capacity: 100,
      status: 'draft',
      isArchived: true
    };
    app.locals.mockEventStore.set(archivedEvent.id, archivedEvent);
  });

  describe('1. Booking Model & Schema Definitions', () => {
    test('BOOKING_STATUS constants export standard lifecycle states', () => {
      assert.ok(Array.isArray(BOOKING_STATUS));
      assert.ok(BOOKING_STATUS.includes('pending'));
      assert.ok(BOOKING_STATUS.includes('approved'));
      assert.ok(BOOKING_STATUS.includes('rejected'));
      assert.ok(BOOKING_STATUS.includes('cancelled'));
    });
  });

  describe('2. Booking Creation & Role-Based Authorization (POST /api/bookings)', () => {
    test('Creation requires authentication (401 without JWT)', async () => {
      const res = await request(app, {
        method: 'POST',
        url: '/api/bookings',
        body: {
          event: validEvent1.id,
          venue: activeVenue.id
        }
      });
      assert.equal(res.status, 401);
    });

    test('Participants and vendors cannot create venue bookings (403 Forbidden)', async () => {
      const participantRes = await request(app, {
        method: 'POST',
        url: '/api/bookings',
        headers: { authorization: `Bearer ${participantToken}` },
        body: { event: validEvent1.id, venue: activeVenue.id }
      });
      assert.equal(participantRes.status, 403);

      const vendorRes = await request(app, {
        method: 'POST',
        url: '/api/bookings',
        headers: { authorization: `Bearer ${vendorToken}` },
        body: { event: validEvent1.id, venue: activeVenue.id }
      });
      assert.equal(vendorRes.status, 403);
    });

    test('Organizer can request booking for their own event (201, pending, authoritative organizer)', async () => {
      const res = await request(app, {
        method: 'POST',
        url: '/api/bookings',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          event: validEvent1.id,
          venue: activeVenue.id,
          purpose: 'Auditorium booking for annual robotics presentation',
          // Malicious attempt to spoof organizer or status should be ignored
          organizer: adminUser.id,
          status: 'approved'
        }
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'pending');
      assert.equal(res.body.data.organizer.id, organizer1User.id);
      assert.equal(res.body.data.venue.id, activeVenue.id);
      assert.equal(res.body.data.event.id, validEvent1.id);
      assert.equal(res.body.data.purpose, 'Auditorium booking for annual robotics presentation');
    });

    test('Organizer cannot request booking for another organizer\'s event (403 Forbidden)', async () => {
      // Bob attempts to book venue for Alice's event
      const res = await request(app, {
        method: 'POST',
        url: '/api/bookings',
        headers: { authorization: `Bearer ${organizer2Token}` },
        body: {
          event: validEvent1.id,
          venue: activeVenue.id
        }
      });

      assert.equal(res.status, 403);
      assert.match(res.body.message, /only request venue bookings for events you organize/i);
    });

    test('Reject booking for non-existent or invalid event reference ID (400 or 404)', async () => {
      const invalidIdRes = await request(app, {
        method: 'POST',
        url: '/api/bookings',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: { event: 'invalid-id-format', venue: activeVenue.id }
      });
      assert.equal(invalidIdRes.status, 400);

      const nonExistentRes = await request(app, {
        method: 'POST',
        url: '/api/bookings',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: { event: new mongoose.Types.ObjectId().toString(), venue: activeVenue.id }
      });
      assert.equal(nonExistentRes.status, 404);
    });

    test('Reject booking for cancelled or archived event (400 or 404)', async () => {
      const cancelledRes = await request(app, {
        method: 'POST',
        url: '/api/bookings',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: { event: cancelledEvent.id, venue: activeVenue.id }
      });
      assert.equal(cancelledRes.status, 400);
      assert.match(cancelledRes.body.message, /cancelled event/i);

      const archivedRes = await request(app, {
        method: 'POST',
        url: '/api/bookings',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: { event: archivedEvent.id, venue: activeVenue.id }
      });
      assert.equal(archivedRes.status, 404);
    });

    test('Reject booking for venue under maintenance or archived venue (400 or 404)', async () => {
      const maintenanceRes = await request(app, {
        method: 'POST',
        url: '/api/bookings',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: { event: validEvent1.id, venue: maintenanceVenue.id }
      });
      assert.equal(maintenanceRes.status, 400);
      assert.match(maintenanceRes.body.message, /under maintenance/i);

      const archivedVenueRes = await request(app, {
        method: 'POST',
        url: '/api/bookings',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: { event: validEvent1.id, venue: archivedVenue.id }
      });
      assert.equal(archivedVenueRes.status, 404);
    });

    test('Reject booking if booking dates do not cover full event duration (400 Bad Request)', async () => {
      // validEvent1 runs 10:00 to 16:00
      // Requesting 11:00 to 15:00 fails to cover the entire event
      const res = await request(app, {
        method: 'POST',
        url: '/api/bookings',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          event: validEvent1.id,
          venue: activeVenue.id,
          startDateTime: '2026-11-20T11:00:00.000Z',
          endDateTime: '2026-11-20T15:00:00.000Z'
        }
      });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /must cover the full event duration/i);
    });

    test('Reject booking if endDateTime is not after startDateTime (400 Bad Request)', async () => {
      const res = await request(app, {
        method: 'POST',
        url: '/api/bookings',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          event: validEvent1.id,
          venue: activeVenue.id,
          startDateTime: '2026-11-20T16:00:00.000Z',
          endDateTime: '2026-11-20T10:00:00.000Z'
        }
      });

      assert.equal(res.status, 400);
      assert.ok(res.body.errors.some((e) => /must be after the start date and time/i.test(e)));
    });
  });

  describe('3. Booking Browsing & Scoped Permissions (GET /api/bookings)', () => {
    let booking1, booking2;

    beforeEach(() => {
      booking1 = {
        id: new mongoose.Types.ObjectId().toString(),
        event: validEvent1.id,
        venue: activeVenue.id,
        organizer: organizer1User.id,
        startDateTime: validEvent1.startDateTime,
        endDateTime: validEvent1.endDateTime,
        status: 'pending',
        isArchived: false,
        createdAt: new Date('2026-10-20T10:00:00Z')
      };
      app.locals.mockBookingStore.set(booking1.id, booking1);

      booking2 = {
        id: new mongoose.Types.ObjectId().toString(),
        event: validEvent2.id,
        venue: activeVenue.id,
        organizer: organizer2User.id,
        startDateTime: validEvent2.startDateTime,
        endDateTime: validEvent2.endDateTime,
        status: 'approved',
        reviewedBy: adminUser.id,
        reviewedAt: new Date('2026-10-21T10:00:00Z'),
        isArchived: false,
        createdAt: new Date('2026-10-21T09:00:00Z')
      };
      app.locals.mockBookingStore.set(booking2.id, booking2);
    });

    test('Participants and vendors cannot access booking catalog (403 Forbidden)', async () => {
      const pRes = await request(app, {
        method: 'GET',
        url: '/api/bookings',
        headers: { authorization: `Bearer ${participantToken}` }
      });
      assert.equal(pRes.status, 403);

      const vRes = await request(app, {
        method: 'GET',
        url: '/api/bookings',
        headers: { authorization: `Bearer ${vendorToken}` }
      });
      assert.equal(vRes.status, 403);
    });

    test('Organizer querying GET /api/bookings receives only their own bookings', async () => {
      const res = await request(app, {
        method: 'GET',
        url: '/api/bookings',
        headers: { authorization: `Bearer ${organizer1Token}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.count, 1);
      assert.equal(res.body.data[0].id, booking1.id);
      assert.equal(res.body.data[0].organizer.id, organizer1User.id);
    });

    test('Administrator querying GET /api/bookings views all bookings across organizers', async () => {
      const res = await request(app, {
        method: 'GET',
        url: '/api/bookings',
        headers: { authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.count, 2);
    });

    test('Administrator can filter bookings by status', async () => {
      const res = await request(app, {
        method: 'GET',
        url: '/api/bookings?status=pending',
        headers: { authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.count, 1);
      assert.equal(res.body.data[0].status, 'pending');
    });

    test('GET /api/bookings/:id allows owner organizer and administrator, rejects others', async () => {
      // Owner Organizer 1
      const ownerRes = await request(app, {
        method: 'GET',
        url: `/api/bookings/${booking1.id}`,
        headers: { authorization: `Bearer ${organizer1Token}` }
      });
      assert.equal(ownerRes.status, 200);
      assert.equal(ownerRes.body.data.id, booking1.id);

      // Admin
      const adminRes = await request(app, {
        method: 'GET',
        url: `/api/bookings/${booking1.id}`,
        headers: { authorization: `Bearer ${adminToken}` }
      });
      assert.equal(adminRes.status, 200);

      // Organizer 2 attempting to view Organizer 1's booking
      const otherRes = await request(app, {
        method: 'GET',
        url: `/api/bookings/${booking1.id}`,
        headers: { authorization: `Bearer ${organizer2Token}` }
      });
      assert.equal(otherRes.status, 403);
    });
  });

  describe('4. Review Actions & Double-Booking Protection (PATCH /approve & /reject)', () => {
    let pendingBooking1;
    let pendingBooking2;

    beforeEach(() => {
      // Booking 1: 10:00 to 16:00 on 2026-11-20
      pendingBooking1 = {
        id: new mongoose.Types.ObjectId().toString(),
        event: validEvent1.id,
        venue: activeVenue.id,
        organizer: organizer1User.id,
        startDateTime: new Date('2026-11-20T10:00:00.000Z'),
        endDateTime: new Date('2026-11-20T16:00:00.000Z'),
        status: 'pending',
        isArchived: false,
        createdAt: new Date()
      };
      app.locals.mockBookingStore.set(pendingBooking1.id, pendingBooking1);

      // Booking 2: 14:00 to 18:00 on 2026-11-20 (Conflicts with Booking 1 from 14:00 to 16:00)
      pendingBooking2 = {
        id: new mongoose.Types.ObjectId().toString(),
        event: validEvent2.id,
        venue: activeVenue.id,
        organizer: organizer2User.id,
        startDateTime: new Date('2026-11-20T14:00:00.000Z'),
        endDateTime: new Date('2026-11-20T18:00:00.000Z'),
        status: 'pending',
        isArchived: false,
        createdAt: new Date()
      };
      app.locals.mockBookingStore.set(pendingBooking2.id, pendingBooking2);
    });

    test('Non-administrators cannot approve or reject venue bookings (403 Forbidden)', async () => {
      const orgApproveRes = await request(app, {
        method: 'PATCH',
        url: `/api/bookings/${pendingBooking1.id}/approve`,
        headers: { authorization: `Bearer ${organizer1Token}` }
      });
      assert.equal(orgApproveRes.status, 403);

      const orgRejectRes = await request(app, {
        method: 'PATCH',
        url: `/api/bookings/${pendingBooking1.id}/reject`,
        headers: { authorization: `Bearer ${organizer1Token}` }
      });
      assert.equal(orgRejectRes.status, 403);
    });

    test('Overlapping pending requests do not count as conflicts until one is approved', async () => {
      // Both exist simultaneously in pending state
      assert.equal(pendingBooking1.status, 'pending');
      assert.equal(pendingBooking2.status, 'pending');

      const getPendingRes = await request(app, {
        method: 'GET',
        url: '/api/bookings?status=pending',
        headers: { authorization: `Bearer ${adminToken}` }
      });
      assert.equal(getPendingRes.status, 200);
      assert.equal(getPendingRes.body.count, 2);
    });

    test('Admin successfully approves a pending booking (200 OK, sets status approved, reviewer, reviewedAt)', async () => {
      const res = await request(app, {
        method: 'PATCH',
        url: `/api/bookings/${pendingBooking1.id}/approve`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'approved');
      assert.equal(res.body.data.reviewedBy.id, adminUser.id);
      assert.ok(res.body.data.reviewedAt);
    });

    test('Double-booking protection: Approving conflicting overlapping booking is rejected with 409 Conflict', async () => {
      // 1. Approve Booking 1 (10:00 - 16:00)
      const approveRes1 = await request(app, {
        method: 'PATCH',
        url: `/api/bookings/${pendingBooking1.id}/approve`,
        headers: { authorization: `Bearer ${adminToken}` }
      });
      assert.equal(approveRes1.status, 200);

      // 2. Attempt to approve Booking 2 (14:00 - 18:00) -> Conflicts!
      const approveRes2 = await request(app, {
        method: 'PATCH',
        url: `/api/bookings/${pendingBooking2.id}/approve`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      assert.equal(approveRes2.status, 409);
      assert.equal(approveRes2.body.success, false);
      assert.match(approveRes2.body.message, /Double-booking conflict/i);
      assert.equal(approveRes2.body.conflict.bookingId, pendingBooking1.id);
    });

    test('Adjacent non-overlapping bookings are permitted and successfully approved', async () => {
      // 1. Approve Booking 1 (10:00 - 16:00)
      const approve1 = await request(app, {
        method: 'PATCH',
        url: `/api/bookings/${pendingBooking1.id}/approve`,
        headers: { authorization: `Bearer ${adminToken}` }
      });
      assert.equal(approve1.status, 200);

      // 2. Create adjacent Booking 3 (starts exactly at 16:00: 16:00 - 20:00)
      const adjacentEvent = {
        id: new mongoose.Types.ObjectId().toString(),
        title: 'Evening Film Screening',
        description: 'Collegiate film review',
        category: 'cultural',
        organizer: organizer2User.id,
        venue: activeVenue.id,
        startDateTime: new Date('2026-11-20T16:00:00.000Z'),
        endDateTime: new Date('2026-11-20T20:00:00.000Z'),
        capacity: 100,
        status: 'draft',
        isArchived: false
      };
      app.locals.mockEventStore.set(adjacentEvent.id, adjacentEvent);

      const adjacentBooking = {
        id: new mongoose.Types.ObjectId().toString(),
        event: adjacentEvent.id,
        venue: activeVenue.id,
        organizer: organizer2User.id,
        startDateTime: new Date('2026-11-20T16:00:00.000Z'),
        endDateTime: new Date('2026-11-20T20:00:00.000Z'),
        status: 'pending',
        isArchived: false,
        createdAt: new Date()
      };
      app.locals.mockBookingStore.set(adjacentBooking.id, adjacentBooking);

      // 3. Approve adjacent booking -> Must succeed!
      const approveAdjacent = await request(app, {
        method: 'PATCH',
        url: `/api/bookings/${adjacentBooking.id}/approve`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      assert.equal(approveAdjacent.status, 200);
      assert.equal(approveAdjacent.body.data.status, 'approved');
    });

    test('Non-pending bookings cannot be reviewed again (400 Bad Request)', async () => {
      // Approve Booking 1
      await request(app, {
        method: 'PATCH',
        url: `/api/bookings/${pendingBooking1.id}/approve`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      // Attempt to approve again
      const reApprove = await request(app, {
        method: 'PATCH',
        url: `/api/bookings/${pendingBooking1.id}/approve`,
        headers: { authorization: `Bearer ${adminToken}` }
      });
      assert.equal(reApprove.status, 400);
      assert.match(reApprove.body.message, /Only pending bookings can be approved/i);

      // Attempt to reject approved booking
      const reReject = await request(app, {
        method: 'PATCH',
        url: `/api/bookings/${pendingBooking1.id}/reject`,
        headers: { authorization: `Bearer ${adminToken}` }
      });
      assert.equal(reReject.status, 400);
      assert.match(reReject.body.message, /Only pending bookings can be rejected/i);
    });

    test('Admin can reject pending booking with reason (200 OK)', async () => {
      const res = await request(app, {
        method: 'PATCH',
        url: `/api/bookings/${pendingBooking1.id}/reject`,
        headers: { authorization: `Bearer ${adminToken}` },
        body: { rejectionReason: 'Auditorium reserved for university convocation.' }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'rejected');
      assert.equal(res.body.data.rejectionReason, 'Auditorium reserved for university convocation.');
      assert.equal(res.body.data.reviewedBy.id, adminUser.id);
    });
  });

  describe('5. Cancellation Workflow (PATCH /api/bookings/:id/cancel)', () => {
    let pendingBooking, approvedBooking;

    beforeEach(() => {
      pendingBooking = {
        id: new mongoose.Types.ObjectId().toString(),
        event: validEvent1.id,
        venue: activeVenue.id,
        organizer: organizer1User.id,
        startDateTime: validEvent1.startDateTime,
        endDateTime: validEvent1.endDateTime,
        status: 'pending',
        isArchived: false,
        createdAt: new Date()
      };
      app.locals.mockBookingStore.set(pendingBooking.id, pendingBooking);

      approvedBooking = {
        id: new mongoose.Types.ObjectId().toString(),
        event: validEvent2.id,
        venue: activeVenue.id,
        organizer: organizer2User.id,
        startDateTime: validEvent2.startDateTime,
        endDateTime: validEvent2.endDateTime,
        status: 'approved',
        reviewedBy: adminUser.id,
        reviewedAt: new Date(),
        isArchived: false,
        createdAt: new Date()
      };
      app.locals.mockBookingStore.set(approvedBooking.id, approvedBooking);
    });

    test('Organizer can cancel their own pending booking', async () => {
      const res = await request(app, {
        method: 'PATCH',
        url: `/api/bookings/${pendingBooking.id}/cancel`,
        headers: { authorization: `Bearer ${organizer1Token}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'cancelled');
    });

    test('Organizer can cancel their own approved booking', async () => {
      const res = await request(app, {
        method: 'PATCH',
        url: `/api/bookings/${approvedBooking.id}/cancel`,
        headers: { authorization: `Bearer ${organizer2Token}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'cancelled');
    });

    test('Organizer cannot cancel another organizer\'s booking (403 Forbidden)', async () => {
      const res = await request(app, {
        method: 'PATCH',
        url: `/api/bookings/${approvedBooking.id}/cancel`,
        headers: { authorization: `Bearer ${organizer1Token}` }
      });

      assert.equal(res.status, 403);
      assert.match(res.body.message, /cannot cancel another organizer/i);
    });

    test('Administrator can cancel any booking', async () => {
      const res = await request(app, {
        method: 'PATCH',
        url: `/api/bookings/${approvedBooking.id}/cancel`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'cancelled');
    });

    test('Cannot cancel an already cancelled booking (400 Bad Request)', async () => {
      await request(app, {
        method: 'PATCH',
        url: `/api/bookings/${pendingBooking.id}/cancel`,
        headers: { authorization: `Bearer ${organizer1Token}` }
      });

      const reCancel = await request(app, {
        method: 'PATCH',
        url: `/api/bookings/${pendingBooking.id}/cancel`,
        headers: { authorization: `Bearer ${organizer1Token}` }
      });

      assert.equal(reCancel.status, 400);
      assert.match(reCancel.body.message, /already cancelled/i);
    });
  });

  describe('6. Event Publishing Integration & Venue Booking Enforcement', () => {
    test('Draft event creation is permitted without a venue booking', async () => {
      const res = await request(app, {
        method: 'POST',
        url: '/api/events',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          title: 'Draft Science Fair',
          description: 'A showcase of science experiments by undergraduates.',
          category: 'academic',
          venue: activeVenue.id,
          startDateTime: '2026-11-25T09:00:00.000Z',
          endDateTime: '2026-11-25T17:00:00.000Z',
          capacity: 100
        }
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.status, 'draft');
    });

    test('Publishing an event with assigned venue is rejected without an approved booking (400 Bad Request)', async () => {
      // validEvent1 has activeVenue assigned and status draft, but NO booking
      const res = await request(app, {
        method: 'PATCH',
        url: `/api/events/${validEvent1.id}/status`,
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: { status: 'published' }
      });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /approved venue booking.*required before publishing/i);
    });

    test('Publishing is rejected when venue booking is pending, rejected, or cancelled (400 Bad Request)', async () => {
      // 1. Pending booking
      const booking = {
        id: new mongoose.Types.ObjectId().toString(),
        event: validEvent1.id,
        venue: activeVenue.id,
        organizer: organizer1User.id,
        startDateTime: validEvent1.startDateTime,
        endDateTime: validEvent1.endDateTime,
        status: 'pending',
        isArchived: false
      };
      app.locals.mockBookingStore.set(booking.id, booking);

      const pendingPublish = await request(app, {
        method: 'PATCH',
        url: `/api/events/${validEvent1.id}/status`,
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: { status: 'published' }
      });
      assert.equal(pendingPublish.status, 400);

      // 2. Rejected booking
      booking.status = 'rejected';
      const rejectedPublish = await request(app, {
        method: 'PATCH',
        url: `/api/events/${validEvent1.id}/status`,
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: { status: 'published' }
      });
      assert.equal(rejectedPublish.status, 400);

      // 3. Cancelled booking
      booking.status = 'cancelled';
      const cancelledPublish = await request(app, {
        method: 'PATCH',
        url: `/api/events/${validEvent1.id}/status`,
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: { status: 'published' }
      });
      assert.equal(cancelledPublish.status, 400);
    });

    test('Publishing is rejected if approved booking interval does not cover the complete event interval', async () => {
      // Event: 10:00 to 16:00
      // Booking: 10:00 to 15:00 (ends 1 hour before event finishes)
      const booking = {
        id: new mongoose.Types.ObjectId().toString(),
        event: validEvent1.id,
        venue: activeVenue.id,
        organizer: organizer1User.id,
        startDateTime: new Date('2026-11-20T10:00:00.000Z'),
        endDateTime: new Date('2026-11-20T15:00:00.000Z'),
        status: 'approved',
        isArchived: false
      };
      app.locals.mockBookingStore.set(booking.id, booking);

      const res = await request(app, {
        method: 'PATCH',
        url: `/api/events/${validEvent1.id}/status`,
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: { status: 'published' }
      });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /approved venue booking covering the complete event duration is required/i);
    });

    test('Publishing is rejected if approved booking is archived', async () => {
      const booking = {
        id: new mongoose.Types.ObjectId().toString(),
        event: validEvent1.id,
        venue: activeVenue.id,
        organizer: organizer1User.id,
        startDateTime: validEvent1.startDateTime,
        endDateTime: validEvent1.endDateTime,
        status: 'approved',
        isArchived: true // soft-deleted
      };
      app.locals.mockBookingStore.set(booking.id, booking);

      const res = await request(app, {
        method: 'PATCH',
        url: `/api/events/${validEvent1.id}/status`,
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: { status: 'published' }
      });

      assert.equal(res.status, 400);
    });

    test('Publishing succeeds when a valid approved booking covers the complete event interval (200 OK)', async () => {
      const booking = {
        id: new mongoose.Types.ObjectId().toString(),
        event: validEvent1.id,
        venue: activeVenue.id,
        organizer: organizer1User.id,
        startDateTime: new Date('2026-11-20T09:30:00.000Z'), // starts 30m before
        endDateTime: new Date('2026-11-20T16:30:00.000Z'),   // ends 30m after
        status: 'approved',
        isArchived: false,
        reviewedBy: adminUser.id,
        reviewedAt: new Date()
      };
      app.locals.mockBookingStore.set(booking.id, booking);

      const res = await request(app, {
        method: 'PATCH',
        url: `/api/events/${validEvent1.id}/status`,
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: { status: 'published' }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'published');
    });

    test('Updating an event directly with status=published is rejected without approved booking', async () => {
      const res = await request(app, {
        method: 'PUT',
        url: `/api/events/${validEvent1.id}`,
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          status: 'published'
        }
      });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /approved venue booking/i);
    });

    test('Venue version key (__v) is updated as a serialization lock upon approval', async () => {
      const initialVersion = activeVenue.__v || 0;

      const pendingBooking = {
        id: new mongoose.Types.ObjectId().toString(),
        event: validEvent1.id,
        venue: activeVenue.id,
        organizer: organizer1User.id,
        startDateTime: validEvent1.startDateTime,
        endDateTime: validEvent1.endDateTime,
        status: 'pending',
        isArchived: false,
        createdAt: new Date()
      };
      app.locals.mockBookingStore.set(pendingBooking.id, pendingBooking);

      const res = await request(app, {
        method: 'PATCH',
        url: `/api/bookings/${pendingBooking.id}/approve`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.status, 200);
      const updatedVenue = app.locals.mockVenueStore.get(activeVenue.id);
      assert.equal(updatedVenue.__v, initialVersion + 1, 'Venue __v must be incremented to serialize concurrent approvals');
    });

    test('Overlapping approval attempt returns 409 Conflict with full conflict details', async () => {
      // 1. Approved booking 1 covering validEvent1 (10:00 to 16:00)
      const approvedBooking = {
        id: new mongoose.Types.ObjectId().toString(),
        event: validEvent1.id,
        venue: activeVenue.id,
        organizer: organizer1User.id,
        startDateTime: new Date('2026-11-20T10:00:00.000Z'),
        endDateTime: new Date('2026-11-20T16:00:00.000Z'),
        status: 'approved',
        isArchived: false
      };
      app.locals.mockBookingStore.set(approvedBooking.id, approvedBooking);

      // 2. Pending booking 2 covering validEvent2 (14:00 to 18:00), which overlaps with booking 1 (14:00 to 16:00)
      const overlappingBooking = {
        id: new mongoose.Types.ObjectId().toString(),
        event: validEvent2.id,
        venue: activeVenue.id,
        organizer: organizer2User.id,
        startDateTime: new Date('2026-11-20T14:00:00.000Z'),
        endDateTime: new Date('2026-11-20T18:00:00.000Z'),
        status: 'pending',
        isArchived: false
      };
      app.locals.mockBookingStore.set(overlappingBooking.id, overlappingBooking);

      const res = await request(app, {
        method: 'PATCH',
        url: `/api/bookings/${overlappingBooking.id}/approve`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.status, 409);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /Double-booking conflict/i);
      assert.equal(res.body.conflict.bookingId, approvedBooking.id);
    });
  });
});
