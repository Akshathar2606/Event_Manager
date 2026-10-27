const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const app = require('../src/app');
const { request } = require('./testHelper');
const { signToken } = require('../src/utils/token');
const { CATERING_REQUEST_STATUS } = require('../src/models/CateringRequest');

describe('EventFlow Catering Request Workflow Test Suite', () => {
  let adminUser, adminToken;
  let organizer1User, organizer1Token;
  let organizer2User, organizer2Token;
  let vendor1User, vendor1Token;
  let vendor2User, vendor2Token;
  let participantUser, participantToken;

  let activeEvent;
  let cancelledEvent;
  let archivedEvent;
  let otherOrganizerEvent;

  let activeCateringService;
  let unavailableCateringService;
  let standardPackage;
  let archivedPackage;

  beforeEach(() => {
    // Reset in-memory test stores before each test
    app.locals.mockUserStore = new Map();
    app.locals.mockVenueStore = new Map();
    app.locals.mockEventStore = new Map();
    app.locals.mockCateringStore = new Map();
    app.locals.mockCateringRequestStore = new Map();

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
      name: 'Emma Organizer',
      email: 'emma@eventflow.edu',
      role: 'organizer',
      organization: 'Science Society',
      phone: '555-101-2020',
      isActive: true
    };
    app.locals.mockUserStore.set(organizer1User.id, organizer1User);
    organizer1Token = signToken(organizer1User);

    organizer2User = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Oliver Other Organizer',
      email: 'oliver@eventflow.edu',
      role: 'organizer',
      organization: 'Debate Club',
      phone: '555-303-4040',
      isActive: true
    };
    app.locals.mockUserStore.set(organizer2User.id, organizer2User);
    organizer2Token = signToken(organizer2User);

    vendor1User = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Chef Mario',
      email: 'mario@italiankitchen.com',
      role: 'vendor',
      organization: 'Mario Catering Co.',
      phone: '555-909-8080',
      isActive: true
    };
    app.locals.mockUserStore.set(vendor1User.id, vendor1User);
    vendor1Token = signToken(vendor1User);

    vendor2User = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Chef Luigi',
      email: 'luigi@bakerystudio.com',
      role: 'vendor',
      organization: 'Luigi Sweets',
      phone: '555-707-6060',
      isActive: true
    };
    app.locals.mockUserStore.set(vendor2User.id, vendor2User);
    vendor2Token = signToken(vendor2User);

    participantUser = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Peter Participant',
      email: 'peter@eventflow.edu',
      role: 'participant',
      isActive: true
    };
    app.locals.mockUserStore.set(participantUser.id, participantUser);
    participantToken = signToken(participantUser);

    // 2. Events
    activeEvent = {
      id: new mongoose.Types.ObjectId().toString(),
      title: 'Annual AI & Robotics Summit',
      description: 'Collegiate technology conference and symposium.',
      category: 'technical',
      organizer: organizer1User.id,
      capacity: 150,
      startDateTime: new Date(Date.now() + 86400000 * 5).toISOString(),
      endDateTime: new Date(Date.now() + 86400000 * 5 + 3600000 * 8).toISOString(),
      status: 'published',
      isArchived: false
    };
    app.locals.mockEventStore.set(activeEvent.id, activeEvent);

    cancelledEvent = {
      id: new mongoose.Types.ObjectId().toString(),
      title: 'Cancelled Hackathon',
      description: 'This event was cancelled due to campus maintenance.',
      category: 'technical',
      organizer: organizer1User.id,
      capacity: 100,
      startDateTime: new Date(Date.now() + 86400000 * 3).toISOString(),
      endDateTime: new Date(Date.now() + 86400000 * 3 + 3600000 * 4).toISOString(),
      status: 'cancelled',
      isArchived: false
    };
    app.locals.mockEventStore.set(cancelledEvent.id, cancelledEvent);

    archivedEvent = {
      id: new mongoose.Types.ObjectId().toString(),
      title: 'Archived Seminar',
      description: 'Historical seminar archived.',
      category: 'academic',
      organizer: organizer1User.id,
      capacity: 80,
      startDateTime: new Date(Date.now() + 86400000 * 4).toISOString(),
      endDateTime: new Date(Date.now() + 86400000 * 4 + 3600000 * 2).toISOString(),
      status: 'published',
      isArchived: true
    };
    app.locals.mockEventStore.set(archivedEvent.id, archivedEvent);

    otherOrganizerEvent = {
      id: new mongoose.Types.ObjectId().toString(),
      title: 'Debate Championship',
      description: 'Intercollegiate parliamentary debate.',
      category: 'academic',
      organizer: organizer2User.id,
      capacity: 120,
      startDateTime: new Date(Date.now() + 86400000 * 6).toISOString(),
      endDateTime: new Date(Date.now() + 86400000 * 6 + 3600000 * 6).toISOString(),
      status: 'published',
      isArchived: false
    };
    app.locals.mockEventStore.set(otherOrganizerEvent.id, otherOrganizerEvent);

    // 3. Catering Packages
    standardPackage = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Deluxe Executive Buffet',
      description: 'Three-course hot buffet with salads and dessert.',
      pricePerPlate: 25.50,
      minOrder: 20,
      menuItems: ['Roast Herb Chicken', 'Wild Rice Pilaf', 'Caesar Salad', 'Tiramisu'],
      dietaryOptions: ['Halal', 'Nut-Free'],
      isArchived: false
    };

    archivedPackage = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Retired Box Lunch',
      description: 'Old discontinued sandwich box.',
      pricePerPlate: 12.00,
      minOrder: 10,
      menuItems: ['Turkey Sandwich', 'Apple', 'Chips'],
      dietaryOptions: [],
      isArchived: true
    };

    // 4. Catering Services
    activeCateringService = {
      id: new mongoose.Types.ObjectId().toString(),
      vendorId: vendor1User.id,
      businessName: 'Gourmet Campus Kitchen',
      description: 'Premier culinary services for university functions.',
      serviceArea: 'All Campus Sectors',
      cuisineTypes: ['Continental', 'Mediterranean'],
      contactEmail: 'orders@italiankitchen.com',
      contactPhone: '555-909-8080',
      packages: [standardPackage, archivedPackage],
      isAvailable: true,
      isArchived: false
    };
    app.locals.mockCateringStore.set(activeCateringService.id, activeCateringService);

    unavailableCateringService = {
      id: new mongoose.Types.ObjectId().toString(),
      vendorId: vendor2User.id,
      businessName: 'Luigi Sweets & Bakery',
      description: 'Pastries and dessert platters.',
      serviceArea: 'West Quad',
      packages: [
        {
          id: new mongoose.Types.ObjectId().toString(),
          name: 'Pastry Assortment',
          pricePerPlate: 8.00,
          minOrder: 15,
          isArchived: false
        }
      ],
      isAvailable: false, // Marked unavailable
      isArchived: false
    };
    app.locals.mockCateringStore.set(unavailableCateringService.id, unavailableCateringService);
  });

  describe('1. Model & Status Definitions', () => {
    test('CATERING_REQUEST_STATUS exports standard lifecycle states', () => {
      assert.deepEqual(CATERING_REQUEST_STATUS, ['pending', 'accepted', 'rejected', 'cancelled']);
    });
  });

  describe('2. Catering Request Creation (POST /api/catering-requests)', () => {
    test('Creation requires authentication (401 without JWT)', async () => {
      const res = await request(app, {
        method: 'POST',
        url: '/api/catering-requests',
        body: {
          eventId: activeEvent.id,
          cateringServiceId: activeCateringService.id,
          packageId: standardPackage.id,
          guestCount: 50
        }
      });

      assert.equal(res.statusCode, 401);
      assert.equal(res.body.success, false);
    });

    test('Creation strictly restricted to organizers (403 for administrator, vendor, & participant)', async () => {
      // Administrator attempt
      const adminRes = await request(app, {
        method: 'POST',
        url: '/api/catering-requests',
        headers: { authorization: `Bearer ${adminToken}` },
        body: {
          eventId: activeEvent.id,
          cateringServiceId: activeCateringService.id,
          packageId: standardPackage.id,
          guestCount: 50
        }
      });
      assert.equal(adminRes.statusCode, 403);
      assert.equal(adminRes.body.success, false);

      // Participant attempt
      const partRes = await request(app, {
        method: 'POST',
        url: '/api/catering-requests',
        headers: { authorization: `Bearer ${participantToken}` },
        body: {
          eventId: activeEvent.id,
          cateringServiceId: activeCateringService.id,
          packageId: standardPackage.id,
          guestCount: 50
        }
      });
      assert.equal(partRes.statusCode, 403);
      assert.equal(partRes.body.success, false);

      // Vendor attempt
      const venRes = await request(app, {
        method: 'POST',
        url: '/api/catering-requests',
        headers: { authorization: `Bearer ${vendor1Token}` },
        body: {
          eventId: activeEvent.id,
          cateringServiceId: activeCateringService.id,
          packageId: standardPackage.id,
          guestCount: 50
        }
      });
      assert.equal(venRes.statusCode, 403);
      assert.equal(venRes.body.success, false);
    });

    test('Organizer cannot request catering for an event owned by another organizer (403 Forbidden)', async () => {
      const res = await request(app, {
        method: 'POST',
        url: '/api/catering-requests',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          eventId: otherOrganizerEvent.id, // Owned by organizer2
          cateringServiceId: activeCateringService.id,
          packageId: standardPackage.id,
          guestCount: 40
        }
      });

      assert.equal(res.statusCode, 403);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /Forbidden.*only request catering for events you organize/i);
    });

    test('Creation rejected if event is non-existent (404 Not Found)', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app, {
        method: 'POST',
        url: '/api/catering-requests',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          eventId: nonExistentId,
          cateringServiceId: activeCateringService.id,
          packageId: standardPackage.id,
          guestCount: 30
        }
      });

      assert.equal(res.statusCode, 404);
      assert.match(res.body.message, /Event not found/i);
    });

    test('Creation rejected if event is cancelled or archived (400 Bad Request / 404)', async () => {
      // Cancelled event
      const cancelRes = await request(app, {
        method: 'POST',
        url: '/api/catering-requests',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          eventId: cancelledEvent.id,
          cateringServiceId: activeCateringService.id,
          packageId: standardPackage.id,
          guestCount: 30
        }
      });
      assert.equal(cancelRes.statusCode, 400);
      assert.match(cancelRes.body.message, /cancelled event/i);

      // Archived event
      const archRes = await request(app, {
        method: 'POST',
        url: '/api/catering-requests',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          eventId: archivedEvent.id,
          cateringServiceId: activeCateringService.id,
          packageId: standardPackage.id,
          guestCount: 30
        }
      });
      assert.equal(archRes.statusCode, 404);
    });

    test('Creation rejected if catering service is unavailable or inactive (400 Bad Request)', async () => {
      const res = await request(app, {
        method: 'POST',
        url: '/api/catering-requests',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          eventId: activeEvent.id,
          cateringServiceId: unavailableCateringService.id,
          packageId: unavailableCateringService.packages[0].id,
          guestCount: 25
        }
      });

      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /marked as unavailable/i);
    });

    test('Creation rejected if package does not exist or is archived (400 Bad Request)', async () => {
      // Archived package
      const resArch = await request(app, {
        method: 'POST',
        url: '/api/catering-requests',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          eventId: activeEvent.id,
          cateringServiceId: activeCateringService.id,
          packageId: archivedPackage.id,
          guestCount: 25
        }
      });
      assert.equal(resArch.statusCode, 400);
      assert.match(resArch.body.message, /does not exist or has been archived/i);

      // Random non-existent package
      const resBogus = await request(app, {
        method: 'POST',
        url: '/api/catering-requests',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          eventId: activeEvent.id,
          cateringServiceId: activeCateringService.id,
          packageId: new mongoose.Types.ObjectId().toString(),
          guestCount: 25
        }
      });
      assert.equal(resBogus.statusCode, 400);
      assert.match(resBogus.body.message, /does not exist or has been archived/i);
    });

    test('Creation rejected if guest count is below package minimum order (400 Bad Request)', async () => {
      // standardPackage.minOrder is 20
      const res = await request(app, {
        method: 'POST',
        url: '/api/catering-requests',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          eventId: activeEvent.id,
          cateringServiceId: activeCateringService.id,
          packageId: standardPackage.id,
          guestCount: 15 // below 20
        }
      });

      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /below the package minimum order of 20/i);
    });

    test('Creation rejected if guest count exceeds event capacity (400 Bad Request)', async () => {
      // activeEvent.capacity is 150
      const res = await request(app, {
        method: 'POST',
        url: '/api/catering-requests',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          eventId: activeEvent.id,
          cateringServiceId: activeCateringService.id,
          packageId: standardPackage.id,
          guestCount: 200 // exceeds 150
        }
      });

      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /exceeds event capacity of 150/i);
    });

    test('Calculates price estimates on the server; client-supplied quote tampering is ignored', async () => {
      // standardPackage.pricePerPlate = 25.50. For 40 guests: 40 * 25.50 = 1020.00
      const res = await request(app, {
        method: 'POST',
        url: '/api/catering-requests',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          eventId: activeEvent.id,
          cateringServiceId: activeCateringService.id,
          packageId: standardPackage.id,
          guestCount: 40,
          notes: 'Special VIP seating setup near the podium.',
          // Malicious spoof attempts:
          quotedPrice: 1.00,
          pricePerPlate: 0.10,
          vendorId: organizer2User.id,
          organizer: organizer2User.id,
          status: 'accepted'
        }
      });

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.success, true);
      const reqDoc = res.body.data;

      // Server calculates accurate quote
      assert.equal(reqDoc.pricePerPlate, 25.50);
      assert.equal(reqDoc.quotedPrice, 1020.00);

      // Identity is authoritatively derived
      assert.equal(reqDoc.organizer.id, organizer1User.id);
      assert.equal(reqDoc.vendor.id, vendor1User.id);

      // Status initialized to pending
      assert.equal(reqDoc.status, 'pending');

      // Package snapshot preserves historical specifications
      assert.equal(reqDoc.selectedPackage.name, 'Deluxe Executive Buffet');
      assert.equal(reqDoc.selectedPackage.pricePerPlate, 25.50);
      assert.deepEqual(reqDoc.selectedPackage.dietaryOptions, ['Halal', 'Nut-Free']);
      assert.equal(reqDoc.notes, 'Special VIP seating setup near the podium.');
    });

    test('Mounted alias endpoint /api/catering/requests works identically', async () => {
      const res = await request(app, {
        method: 'POST',
        url: '/api/catering/requests',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          eventId: activeEvent.id,
          cateringServiceId: activeCateringService.id,
          packageId: standardPackage.id,
          guestCount: 30
        }
      });

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.quotedPrice, 765.00); // 30 * 25.50
    });
  });

  describe('3. Organizer Request Listing (GET /api/catering-requests)', () => {
    let req1, req2, reqOther;

    beforeEach(() => {
      // Seed requests
      req1 = {
        id: new mongoose.Types.ObjectId().toString(),
        event: activeEvent.id,
        organizer: organizer1User.id,
        cateringService: activeCateringService.id,
        vendor: vendor1User.id,
        selectedPackage: standardPackage,
        guestCount: 30,
        pricePerPlate: 25.50,
        quotedPrice: 765.00,
        status: 'pending',
        isArchived: false,
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
      };
      app.locals.mockCateringRequestStore.set(req1.id, req1);

      req2 = {
        id: new mongoose.Types.ObjectId().toString(),
        event: activeEvent.id,
        organizer: organizer1User.id,
        cateringService: activeCateringService.id,
        vendor: vendor1User.id,
        selectedPackage: standardPackage,
        guestCount: 50,
        pricePerPlate: 25.50,
        quotedPrice: 1275.00,
        status: 'accepted',
        isArchived: false,
        createdAt: new Date(Date.now() - 3600000).toISOString()
      };
      app.locals.mockCateringRequestStore.set(req2.id, req2);

      reqOther = {
        id: new mongoose.Types.ObjectId().toString(),
        event: otherOrganizerEvent.id,
        organizer: organizer2User.id,
        cateringService: activeCateringService.id,
        vendor: vendor1User.id,
        selectedPackage: standardPackage,
        guestCount: 40,
        pricePerPlate: 25.50,
        quotedPrice: 1020.00,
        status: 'pending',
        isArchived: false,
        createdAt: new Date().toISOString()
      };
      app.locals.mockCateringRequestStore.set(reqOther.id, reqOther);
    });

    test('Organizer listing returns only requests belonging to authenticated organizer', async () => {
      const res = await request(app, {
        method: 'GET',
        url: '/api/catering-requests',
        headers: { authorization: `Bearer ${organizer1Token}` }
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.count, 2);
      assert.equal(res.body.pagination.total, 2);

      const returnedIds = res.body.data.map((r) => r.id);
      assert.ok(returnedIds.includes(req1.id));
      assert.ok(returnedIds.includes(req2.id));
      assert.ok(!returnedIds.includes(reqOther.id)); // Must not leak organizer2's request
    });

    test('Organizer listing supports status filtering', async () => {
      const res = await request(app, {
        method: 'GET',
        url: '/api/catering-requests?status=accepted',
        headers: { authorization: `Bearer ${organizer1Token}` }
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.count, 1);
      assert.equal(res.body.data[0].id, req2.id);
      assert.equal(res.body.data[0].status, 'accepted');
    });

    test('Participant is denied access to organizer requests (403 Forbidden)', async () => {
      const res = await request(app, {
        method: 'GET',
        url: '/api/catering-requests',
        headers: { authorization: `Bearer ${participantToken}` }
      });

      assert.equal(res.statusCode, 403);
    });

    test('Administrator can inspect all organizer requests across the platform', async () => {
      const res = await request(app, {
        method: 'GET',
        url: '/api/catering-requests',
        headers: { authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.count, 3); // includes req1, req2, reqOther
      assert.equal(res.body.pagination.total, 3);
    });
  });

  describe('4. Vendor Incoming Requests (GET /api/catering-requests/incoming)', () => {
    let reqVendor1, reqVendor2;

    beforeEach(() => {
      reqVendor1 = {
        id: new mongoose.Types.ObjectId().toString(),
        event: activeEvent.id,
        organizer: organizer1User.id,
        cateringService: activeCateringService.id,
        vendor: vendor1User.id,
        selectedPackage: standardPackage,
        guestCount: 35,
        pricePerPlate: 25.50,
        quotedPrice: 892.50,
        status: 'pending',
        isArchived: false,
        createdAt: new Date().toISOString()
      };
      app.locals.mockCateringRequestStore.set(reqVendor1.id, reqVendor1);

      reqVendor2 = {
        id: new mongoose.Types.ObjectId().toString(),
        event: activeEvent.id,
        organizer: organizer1User.id,
        cateringService: unavailableCateringService.id,
        vendor: vendor2User.id,
        selectedPackage: unavailableCateringService.packages[0],
        guestCount: 20,
        pricePerPlate: 8.00,
        quotedPrice: 160.00,
        status: 'pending',
        isArchived: false,
        createdAt: new Date().toISOString()
      };
      app.locals.mockCateringRequestStore.set(reqVendor2.id, reqVendor2);
    });

    test('Vendor incoming endpoint returns only requests directed to that vendor', async () => {
      const res = await request(app, {
        method: 'GET',
        url: '/api/catering-requests/incoming',
        headers: { authorization: `Bearer ${vendor1Token}` }
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.count, 1);
      assert.equal(res.body.data[0].id, reqVendor1.id);

      // Must not leak vendor 2's request
      const ids = res.body.data.map((r) => r.id);
      assert.ok(!ids.includes(reqVendor2.id));
    });

    test('Vendor cannot view another vendor\'s incoming requests by altering query parameters', async () => {
      const res = await request(app, {
        method: 'GET',
        url: `/api/catering-requests/incoming?vendor=${vendor2User.id}`,
        headers: { authorization: `Bearer ${vendor1Token}` }
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.count, 1);
      assert.equal(res.body.data[0].id, reqVendor1.id);
    });

    test('Populated organizer info does not leak password hashes or sensitive fields', async () => {
      const res = await request(app, {
        method: 'GET',
        url: '/api/catering-requests/incoming',
        headers: { authorization: `Bearer ${vendor1Token}` }
      });

      assert.equal(res.statusCode, 200);
      const reqItem = res.body.data[0];
      assert.ok(reqItem.organizer);
      assert.equal(reqItem.organizer.name, organizer1User.name);
      assert.equal(reqItem.organizer.passwordHash, undefined);
      assert.equal(reqItem.organizer.token, undefined);
    });

    test('Administrator can inspect incoming requests across all vendors', async () => {
      const res = await request(app, {
        method: 'GET',
        url: '/api/catering-requests/incoming',
        headers: { authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.count, 2); // includes reqVendor1 and reqVendor2
      assert.equal(res.body.pagination.total, 2);
    });
  });

  describe('5. Single Request Details (GET /api/catering-requests/:id)', () => {
    let testReq;

    beforeEach(() => {
      testReq = {
        id: new mongoose.Types.ObjectId().toString(),
        event: activeEvent.id,
        organizer: organizer1User.id,
        cateringService: activeCateringService.id,
        vendor: vendor1User.id,
        selectedPackage: standardPackage,
        guestCount: 45,
        pricePerPlate: 25.50,
        quotedPrice: 1147.50,
        status: 'pending',
        isArchived: false,
        createdAt: new Date().toISOString()
      };
      app.locals.mockCateringRequestStore.set(testReq.id, testReq);
    });

    test('Owning organizer and assigned vendor can view details', async () => {
      // Organizer view
      const orgRes = await request(app, {
        method: 'GET',
        url: `/api/catering-requests/${testReq.id}`,
        headers: { authorization: `Bearer ${organizer1Token}` }
      });
      assert.equal(orgRes.statusCode, 200);
      assert.equal(orgRes.body.data.id, testReq.id);

      // Vendor view
      const venRes = await request(app, {
        method: 'GET',
        url: `/api/catering-requests/${testReq.id}`,
        headers: { authorization: `Bearer ${vendor1Token}` }
      });
      assert.equal(venRes.statusCode, 200);
      assert.equal(venRes.body.data.id, testReq.id);
    });

    test('Unrelated organizer or vendor is forbidden from viewing request (403 Forbidden)', async () => {
      // Unrelated organizer
      const resOrg2 = await request(app, {
        method: 'GET',
        url: `/api/catering-requests/${testReq.id}`,
        headers: { authorization: `Bearer ${organizer2Token}` }
      });
      assert.equal(resOrg2.statusCode, 403);

      // Unrelated vendor
      const resVen2 = await request(app, {
        method: 'GET',
        url: `/api/catering-requests/${testReq.id}`,
        headers: { authorization: `Bearer ${vendor2Token}` }
      });
      assert.equal(resVen2.statusCode, 403);
    });

    test('Administrator can inspect single request details for supervisory auditing', async () => {
      const res = await request(app, {
        method: 'GET',
        url: `/api/catering-requests/${testReq.id}`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.id, testReq.id);
    });
  });

  describe('6. Accept & Reject Workflow (PATCH /:id/accept & PATCH /:id/reject)', () => {
    let pendingReq;

    beforeEach(() => {
      pendingReq = {
        id: new mongoose.Types.ObjectId().toString(),
        event: activeEvent.id,
        organizer: organizer1User.id,
        cateringService: activeCateringService.id,
        vendor: vendor1User.id,
        selectedPackage: standardPackage,
        guestCount: 60,
        pricePerPlate: 25.50,
        quotedPrice: 1530.00,
        status: 'pending',
        isArchived: false,
        createdAt: new Date().toISOString()
      };
      app.locals.mockCateringRequestStore.set(pendingReq.id, pendingReq);
    });

    test('Vendor can accept a pending catering request', async () => {
      const res = await request(app, {
        method: 'PATCH',
        url: `/api/catering-requests/${pendingReq.id}/accept`,
        headers: { authorization: `Bearer ${vendor1Token}` },
        body: { notes: 'Confirmed. We will arrive at 08:00 AM for banquet setup.' }
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'accepted');
      assert.ok(res.body.data.respondedAt);
      assert.equal(res.body.data.vendorNotes, 'Confirmed. We will arrive at 08:00 AM for banquet setup.');
    });

    test('Unassigned vendor cannot accept or reject the request (403 Forbidden)', async () => {
      // Vendor 2 attempt
      const res = await request(app, {
        method: 'PATCH',
        url: `/api/catering-requests/${pendingReq.id}/accept`,
        headers: { authorization: `Bearer ${vendor2Token}` },
        body: { notes: 'Unauthorized accept' }
      });

      assert.equal(res.statusCode, 403);
      assert.match(res.body.message, /not authorized to respond/i);
    });

    test('Rejecting a request requires a non-empty rejectionReason', async () => {
      // Empty reason
      const resEmpty = await request(app, {
        method: 'PATCH',
        url: `/api/catering-requests/${pendingReq.id}/reject`,
        headers: { authorization: `Bearer ${vendor1Token}` },
        body: { rejectionReason: '' }
      });
      assert.equal(resEmpty.statusCode, 400);
      assert.match(resEmpty.body.message, /Validation failed/i);

      // Whitespace-only reason
      const resWhite = await request(app, {
        method: 'PATCH',
        url: `/api/catering-requests/${pendingReq.id}/reject`,
        headers: { authorization: `Bearer ${vendor1Token}` },
        body: { rejectionReason: '   ' }
      });
      assert.equal(resWhite.statusCode, 400);
    });

    test('Vendor successfully rejects a pending request with valid reason', async () => {
      const res = await request(app, {
        method: 'PATCH',
        url: `/api/catering-requests/${pendingReq.id}/reject`,
        headers: { authorization: `Bearer ${vendor1Token}` },
        body: {
          rejectionReason: 'Already fully booked for private off-campus gala on this date.'
        }
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'rejected');
      assert.equal(res.body.data.rejectionReason, 'Already fully booked for private off-campus gala on this date.');
      assert.ok(res.body.data.respondedAt);
    });

    test('Cannot accept or reject a request that is no longer pending (400 Bad Request)', async () => {
      // 1. Accept first
      await request(app, {
        method: 'PATCH',
        url: `/api/catering-requests/${pendingReq.id}/accept`,
        headers: { authorization: `Bearer ${vendor1Token}` }
      });

      // 2. Attempt duplicate accept
      const resDupAccept = await request(app, {
        method: 'PATCH',
        url: `/api/catering-requests/${pendingReq.id}/accept`,
        headers: { authorization: `Bearer ${vendor1Token}` }
      });
      assert.equal(resDupAccept.statusCode, 400);
      assert.match(resDupAccept.body.message, /already accepted/i);

      // 3. Attempt contradictory reject on accepted request
      const resContraReject = await request(app, {
        method: 'PATCH',
        url: `/api/catering-requests/${pendingReq.id}/reject`,
        headers: { authorization: `Bearer ${vendor1Token}` },
        body: { rejectionReason: 'Changing our mind' }
      });
      assert.equal(resContraReject.statusCode, 400);
      assert.match(resContraReject.body.message, /Cannot reject a request with status 'accepted'/i);
    });

    test('Administrator cannot accept or reject a catering request (403 Forbidden; vendor decision strictly reserved)', async () => {
      // Administrator accept attempt
      const acceptRes = await request(app, {
        method: 'PATCH',
        url: `/api/catering-requests/${pendingReq.id}/accept`,
        headers: { authorization: `Bearer ${adminToken}` },
        body: { notes: 'Admin override accept' }
      });
      assert.equal(acceptRes.statusCode, 403);
      assert.match(acceptRes.body.message, /Forbidden.*Role 'administrator' is not authorized/i);

      // Administrator reject attempt
      const rejectRes = await request(app, {
        method: 'PATCH',
        url: `/api/catering-requests/${pendingReq.id}/reject`,
        headers: { authorization: `Bearer ${adminToken}` },
        body: { rejectionReason: 'Admin override reject' }
      });
      assert.equal(rejectRes.statusCode, 403);
      assert.match(rejectRes.body.message, /Forbidden.*Role 'administrator' is not authorized/i);
    });

    test('Organizer cannot accept or reject a catering request (403 Forbidden)', async () => {
      const res = await request(app, {
        method: 'PATCH',
        url: `/api/catering-requests/${pendingReq.id}/accept`,
        headers: { authorization: `Bearer ${organizer1Token}` }
      });
      assert.equal(res.statusCode, 403);
      assert.match(res.body.message, /Forbidden.*Role 'organizer' is not authorized/i);
    });
  });

  describe('7. Cancellation Workflow (PATCH /:id/cancel)', () => {
    let pendingReq, acceptedReq, pastEventReq;

    beforeEach(() => {
      pendingReq = {
        id: new mongoose.Types.ObjectId().toString(),
        event: activeEvent.id,
        organizer: organizer1User.id,
        cateringService: activeCateringService.id,
        vendor: vendor1User.id,
        selectedPackage: standardPackage,
        guestCount: 50,
        pricePerPlate: 25.50,
        quotedPrice: 1275.00,
        status: 'pending',
        isArchived: false,
        createdAt: new Date().toISOString()
      };
      app.locals.mockCateringRequestStore.set(pendingReq.id, pendingReq);

      acceptedReq = {
        id: new mongoose.Types.ObjectId().toString(),
        event: activeEvent.id,
        organizer: organizer1User.id,
        cateringService: activeCateringService.id,
        vendor: vendor1User.id,
        selectedPackage: standardPackage,
        guestCount: 50,
        pricePerPlate: 25.50,
        quotedPrice: 1275.00,
        status: 'accepted',
        isArchived: false,
        createdAt: new Date().toISOString()
      };
      app.locals.mockCateringRequestStore.set(acceptedReq.id, acceptedReq);

      // Event that has already started
      const pastEvent = {
        id: new mongoose.Types.ObjectId().toString(),
        title: 'Ongoing Conference',
        organizer: organizer1User.id,
        startDateTime: new Date(Date.now() - 3600000 * 2).toISOString(),
        endDateTime: new Date(Date.now() + 3600000 * 4).toISOString(),
        status: 'published'
      };
      app.locals.mockEventStore.set(pastEvent.id, pastEvent);

      pastEventReq = {
        id: new mongoose.Types.ObjectId().toString(),
        event: pastEvent.id,
        organizer: organizer1User.id,
        cateringService: activeCateringService.id,
        vendor: vendor1User.id,
        selectedPackage: standardPackage,
        guestCount: 50,
        pricePerPlate: 25.50,
        quotedPrice: 1275.00,
        status: 'accepted',
        isArchived: false,
        createdAt: new Date().toISOString()
      };
      app.locals.mockCateringRequestStore.set(pastEventReq.id, pastEventReq);
    });

    test('Organizer can cancel their pending catering request', async () => {
      const res = await request(app, {
        method: 'PATCH',
        url: `/api/catering-requests/${pendingReq.id}/cancel`,
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: { cancellationReason: 'Sponsor dinner will be hosted off-campus instead.' }
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'cancelled');
      assert.ok(res.body.data.cancelledAt);
      assert.equal(res.body.data.cancellationReason, 'Sponsor dinner will be hosted off-campus instead.');
    });

    test('Vendor cannot cancel request on behalf of organizer (403 Forbidden)', async () => {
      const res = await request(app, {
        method: 'PATCH',
        url: `/api/catering-requests/${pendingReq.id}/cancel`,
        headers: { authorization: `Bearer ${vendor1Token}` }
      });

      assert.equal(res.statusCode, 403);
      assert.match(res.body.message, /Forbidden.*Role 'vendor' is not authorized/i);
    });

    test('Organizer can cancel an accepted request before the event starts', async () => {
      const res = await request(app, {
        method: 'PATCH',
        url: `/api/catering-requests/${acceptedReq.id}/cancel`,
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: { cancellationReason: 'Budget constraints.' }
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.data.status, 'cancelled');
    });

    test('Cannot cancel catering request if event has already started (400 Bad Request)', async () => {
      const res = await request(app, {
        method: 'PATCH',
        url: `/api/catering-requests/${pastEventReq.id}/cancel`,
        headers: { authorization: `Bearer ${organizer1Token}` }
      });

      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /event that has already started/i);
    });

    test('Cannot cancel a request that is already rejected or cancelled', async () => {
      // 1. Cancel once
      await request(app, {
        method: 'PATCH',
        url: `/api/catering-requests/${pendingReq.id}/cancel`,
        headers: { authorization: `Bearer ${organizer1Token}` }
      });

      // 2. Try cancelling again
      const resAgain = await request(app, {
        method: 'PATCH',
        url: `/api/catering-requests/${pendingReq.id}/cancel`,
        headers: { authorization: `Bearer ${organizer1Token}` }
      });
      assert.equal(resAgain.statusCode, 400);
      assert.match(resAgain.body.message, /already cancelled/i);

      // 3. Try cancelling an already rejected request
      const rejectedReq = {
        ...pendingReq,
        id: new mongoose.Types.ObjectId().toString(),
        status: 'rejected'
      };
      app.locals.mockCateringRequestStore.set(rejectedReq.id, rejectedReq);

      const resRejected = await request(app, {
        method: 'PATCH',
        url: `/api/catering-requests/${rejectedReq.id}/cancel`,
        headers: { authorization: `Bearer ${organizer1Token}` }
      });
      assert.equal(resRejected.statusCode, 400);
      assert.match(resRejected.body.message, /Cannot cancel a request that has already been rejected/i);
    });

    test('Administrator cannot cancel a catering request (403 Forbidden; cancellation reserved to organizer)', async () => {
      const res = await request(app, {
        method: 'PATCH',
        url: `/api/catering-requests/${pendingReq.id}/cancel`,
        headers: { authorization: `Bearer ${adminToken}` },
        body: { cancellationReason: 'Admin cancellation' }
      });

      assert.equal(res.statusCode, 403);
      assert.match(res.body.message, /Forbidden.*Role 'administrator' is not authorized/i);
    });

    test('Another organizer cannot cancel a catering request for an event they do not organize (403 Forbidden)', async () => {
      const res = await request(app, {
        method: 'PATCH',
        url: `/api/catering-requests/${pendingReq.id}/cancel`,
        headers: { authorization: `Bearer ${organizer2Token}` },
        body: { cancellationReason: 'Unauthorized cancel' }
      });

      assert.equal(res.statusCode, 403);
      assert.match(res.body.message, /Forbidden.*only cancel catering requests for your own events/i);
    });
  });

  describe('8. Package Archival & Historical Snapshot Integrity', () => {
    test('Historical request details remain intact even after vendor archives the package', async () => {
      // 1. Create request
      const createRes = await request(app, {
        method: 'POST',
        url: '/api/catering-requests',
        headers: { authorization: `Bearer ${organizer1Token}` },
        body: {
          eventId: activeEvent.id,
          cateringServiceId: activeCateringService.id,
          packageId: standardPackage.id,
          guestCount: 50
        }
      });
      assert.equal(createRes.statusCode, 201);
      const reqId = createRes.body.data.id;

      // 2. Vendor subsequently archives the package in the catering service profile
      standardPackage.isArchived = true;
      standardPackage.name = 'Renamed Modified Package';
      standardPackage.pricePerPlate = 99.99; // Alter price in package

      // 3. Inspect existing request
      const detailRes = await request(app, {
        method: 'GET',
        url: `/api/catering-requests/${reqId}`,
        headers: { authorization: `Bearer ${organizer1Token}` }
      });

      assert.equal(detailRes.statusCode, 200);
      const snap = detailRes.body.data.selectedPackage;

      // Historical snapshot unchanged
      assert.equal(snap.name, 'Deluxe Executive Buffet');
      assert.equal(snap.pricePerPlate, 25.50);
      assert.equal(detailRes.body.data.quotedPrice, 1275.00); // 50 * 25.50
    });
  });
});
