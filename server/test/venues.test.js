const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const app = require('../src/app');
const { request } = require('./testHelper');
const { signToken } = require('../src/utils/token');

describe('EventFlow Venue Management Test Suite', () => {
  let adminUser;
  let adminToken;
  let organizerUser;
  let organizerToken;
  let participantUser;
  let participantToken;

  beforeEach(() => {
    // Reset test in-memory stores before each test
    app.locals.mockUserStore = new Map();
    app.locals.mockVenueStore = new Map();

    // 1. Seed Administrator
    adminUser = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Campus Admin',
      email: 'admin@campus.edu',
      role: 'administrator',
      isActive: true
    };
    app.locals.mockUserStore.set(adminUser.id, adminUser);
    adminToken = signToken(adminUser);

    // 2. Seed Organizer
    organizerUser = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Event Organizer',
      email: 'organizer@campus.edu',
      role: 'organizer',
      isActive: true
    };
    app.locals.mockUserStore.set(organizerUser.id, organizerUser);
    organizerToken = signToken(organizerUser);

    // 3. Seed Participant
    participantUser = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Student Attendee',
      email: 'student@campus.edu',
      role: 'participant',
      isActive: true
    };
    app.locals.mockUserStore.set(participantUser.id, participantUser);
    participantToken = signToken(participantUser);
  });

  describe('POST /api/venues (Creation & RBAC)', () => {
    const validVenuePayload = {
      name: 'Main Auditorium',
      description: 'Central campus auditorium with tiered seating and full AV setup.',
      location: 'Block A, 1st Floor',
      capacity: 500,
      facilities: ['Projector', 'Sound System', 'AC', 'Wi-Fi'],
      hourlyRate: 50,
      status: 'available'
    };

    test('1. Creation requires authentication (401 if missing token)', async () => {
      const res = await request(app, {
        method: 'POST',
        url: '/api/venues',
        body: validVenuePayload
      });

      assert.equal(res.statusCode, 401);
      assert.equal(res.body.success, false);
    });

    test('2. Only administrator can create venues (403 for organizer & participant)', async () => {
      // Organizer attempt
      const orgRes = await request(app, {
        method: 'POST',
        url: '/api/venues',
        body: validVenuePayload,
        headers: { authorization: `Bearer ${organizerToken}` }
      });
      assert.equal(orgRes.statusCode, 403);
      assert.match(orgRes.body.message, /Forbidden.*Role 'organizer'/i);

      // Participant attempt
      const partRes = await request(app, {
        method: 'POST',
        url: '/api/venues',
        body: validVenuePayload,
        headers: { authorization: `Bearer ${participantToken}` }
      });
      assert.equal(partRes.statusCode, 403);
      assert.match(partRes.body.message, /Forbidden.*Role 'participant'/i);
    });

    test('3. Missing or invalid input is rejected with 400 Bad Request', async () => {
      // Missing name
      const resMissingName = await request(app, {
        method: 'POST',
        url: '/api/venues',
        body: { ...validVenuePayload, name: '' },
        headers: { authorization: `Bearer ${adminToken}` }
      });
      assert.equal(resMissingName.statusCode, 400);
      assert.equal(resMissingName.body.success, false);

      // Invalid negative capacity
      const resNegCap = await request(app, {
        method: 'POST',
        url: '/api/venues',
        body: { ...validVenuePayload, capacity: -10 },
        headers: { authorization: `Bearer ${adminToken}` }
      });
      assert.equal(resNegCap.statusCode, 400);

      // Non-integer capacity
      const resFloatCap = await request(app, {
        method: 'POST',
        url: '/api/venues',
        body: { ...validVenuePayload, capacity: 50.5 },
        headers: { authorization: `Bearer ${adminToken}` }
      });
      assert.equal(resFloatCap.statusCode, 400);

      // Invalid status
      const resBadStatus = await request(app, {
        method: 'POST',
        url: '/api/venues',
        body: { ...validVenuePayload, status: 'invalid_status' },
        headers: { authorization: `Bearer ${adminToken}` }
      });
      assert.equal(resBadStatus.statusCode, 400);
    });

    test('4. Administrator successfully creates venue; createdBy is set authoritatively', async () => {
      const spoofedPayload = {
        ...validVenuePayload,
        createdBy: 'spoofed_id_should_be_ignored'
      };

      const res = await request(app, {
        method: 'POST',
        url: '/api/venues',
        body: spoofedPayload,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.name, 'Main Auditorium');
      assert.equal(res.body.data.capacity, 500);
      assert.equal(res.body.data.status, 'available');
      assert.equal(res.body.data.isArchived, false);
      // Verify createdBy matches authenticated admin
      assert.equal(res.body.data.createdBy.id, adminUser.id);
    });
  });

  describe('GET /api/venues (Listing, Search, Filter & Pagination)', () => {
    beforeEach(async () => {
      // Seed 3 sample venues
      const v1 = {
        name: 'Great Hall',
        description: 'Large banquet hall',
        location: 'Campus Center, Wing A',
        capacity: 300,
        facilities: ['Projector', 'AC', 'Wi-Fi'],
        hourlyRate: 40,
        status: 'available'
      };
      const v2 = {
        name: 'Seminar Room 101',
        description: 'Academic workshop space',
        location: 'Science Complex, 2nd Floor',
        capacity: 60,
        facilities: ['Whiteboard', 'Projector', 'Wi-Fi'],
        hourlyRate: 15,
        status: 'available'
      };
      const v3 = {
        name: 'Old Gymnasium',
        description: 'Athletic facility under renovation',
        location: 'Sports Zone',
        capacity: 200,
        facilities: ['Sound System'],
        hourlyRate: 25,
        status: 'maintenance'
      };

      for (const v of [v1, v2, v3]) {
        await request(app, {
          method: 'POST',
          url: '/api/venues',
          body: v,
          headers: { authorization: `Bearer ${adminToken}` }
        });
      }
    });

    test('5. Requires authentication to browse venues', async () => {
      const res = await request(app, {
        method: 'GET',
        url: '/api/venues'
      });
      assert.equal(res.statusCode, 401);
    });

    test('6. Organizers can list venues; maintenance venues are automatically excluded for non-admins', async () => {
      const res = await request(app, {
        method: 'GET',
        url: '/api/venues',
        headers: { authorization: `Bearer ${organizerToken}` }
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.count, 2); // Only Great Hall and Seminar Room 101 are available
      assert.ok(res.body.data.every((v) => v.status === 'available'));
    });

    test('7. Search by text matches venue name and location', async () => {
      // Search for Science
      const res = await request(app, {
        method: 'GET',
        url: '/api/venues?search=Science',
        headers: { authorization: `Bearer ${organizerToken}` }
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.count, 1);
      assert.equal(res.body.data[0].name, 'Seminar Room 101');
    });

    test('8. Filter by minimum capacity restricts results', async () => {
      const res = await request(app, {
        method: 'GET',
        url: '/api/venues?minCapacity=100',
        headers: { authorization: `Bearer ${organizerToken}` }
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.count, 1);
      assert.equal(res.body.data[0].name, 'Great Hall');
    });

    test('9. Filter by facilities requires all matching tags', async () => {
      const res = await request(app, {
        method: 'GET',
        url: '/api/venues?facilities=Whiteboard,Projector',
        headers: { authorization: `Bearer ${organizerToken}` }
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.count, 1);
      assert.equal(res.body.data[0].name, 'Seminar Room 101');
    });

    test('10. Administrator can view maintenance inventory via status filter', async () => {
      const res = await request(app, {
        method: 'GET',
        url: '/api/venues?status=maintenance',
        headers: { authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.count, 1);
      assert.equal(res.body.data[0].name, 'Old Gymnasium');
    });
  });

  describe('GET /api/venues/:id (Details)', () => {
    let createdVenueId;

    beforeEach(async () => {
      const res = await request(app, {
        method: 'POST',
        url: '/api/venues',
        body: {
          name: 'Conference Center',
          location: 'Executive Tower',
          capacity: 150,
          status: 'available'
        },
        headers: { authorization: `Bearer ${adminToken}` }
      });
      createdVenueId = res.body.data.id;
    });

    test('11. Rejects invalid ObjectId format with 400 Bad Request', async () => {
      const res = await request(app, {
        method: 'GET',
        url: '/api/venues/invalid-id-123',
        headers: { authorization: `Bearer ${organizerToken}` }
      });

      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /Invalid venue ID format/i);
    });

    test('12. Returns 404 for non-existent venue ID', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app, {
        method: 'GET',
        url: `/api/venues/${fakeId}`,
        headers: { authorization: `Bearer ${organizerToken}` }
      });

      assert.equal(res.statusCode, 404);
      assert.match(res.body.message, /Venue not found/i);
    });

    test('13. Authenticated user can view venue details', async () => {
      const res = await request(app, {
        method: 'GET',
        url: `/api/venues/${createdVenueId}`,
        headers: { authorization: `Bearer ${participantToken}` }
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.name, 'Conference Center');
      assert.equal(res.body.data.capacity, 150);
    });
  });

  describe('PUT & PATCH & DELETE (Mutations & Safe Archival)', () => {
    let testVenueId;

    beforeEach(async () => {
      const res = await request(app, {
        method: 'POST',
        url: '/api/venues',
        body: {
          name: 'Innovation Lab',
          location: 'Tech Hub, Room 302',
          capacity: 45,
          status: 'available'
        },
        headers: { authorization: `Bearer ${adminToken}` }
      });
      testVenueId = res.body.data.id;
    });

    test('14. PUT: Updates venue details (Admin only)', async () => {
      // Non-admin denied
      const nonAdminRes = await request(app, {
        method: 'PUT',
        url: `/api/venues/${testVenueId}`,
        body: { capacity: 60 },
        headers: { authorization: `Bearer ${organizerToken}` }
      });
      assert.equal(nonAdminRes.statusCode, 403);

      // Admin allowed
      const adminRes = await request(app, {
        method: 'PUT',
        url: `/api/venues/${testVenueId}`,
        body: {
          capacity: 60,
          description: 'Expanded capacity with upgraded seating'
        },
        headers: { authorization: `Bearer ${adminToken}` }
      });

      assert.equal(adminRes.statusCode, 200);
      assert.equal(adminRes.body.data.capacity, 60);
      assert.equal(adminRes.body.data.description, 'Expanded capacity with upgraded seating');
    });

    test('15. PATCH /status: Changes status between available and maintenance', async () => {
      const res = await request(app, {
        method: 'PATCH',
        url: `/api/venues/${testVenueId}/status`,
        body: { status: 'maintenance' },
        headers: { authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.data.status, 'maintenance');

      // Verify non-admins no longer see this venue in public listing
      const listRes = await request(app, {
        method: 'GET',
        url: '/api/venues',
        headers: { authorization: `Bearer ${organizerToken}` }
      });
      assert.equal(listRes.body.count, 0);
    });

    test('16. DELETE: Performs safe archival to preserve historical booking references', async () => {
      // Non-admin denied
      const denyRes = await request(app, {
        method: 'DELETE',
        url: `/api/venues/${testVenueId}`,
        headers: { authorization: `Bearer ${organizerToken}` }
      });
      assert.equal(denyRes.statusCode, 403);

      // Admin deletes (archives)
      const deleteRes = await request(app, {
        method: 'DELETE',
        url: `/api/venues/${testVenueId}`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      assert.equal(deleteRes.statusCode, 200);
      assert.match(deleteRes.body.message, /archived successfully/i);

      // Non-admin query for this venue returns 404
      const getRes = await request(app, {
        method: 'GET',
        url: `/api/venues/${testVenueId}`,
        headers: { authorization: `Bearer ${organizerToken}` }
      });
      assert.equal(getRes.statusCode, 404);
    });
  });
});
