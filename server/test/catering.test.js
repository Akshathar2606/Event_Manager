const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const app = require('../src/app');
const { CateringService } = require('../src/models/CateringService');
const { request } = require('./testHelper');
const { signToken } = require('../src/utils/token');

describe('EventFlow Catering Vendor & Discovery Test Suite', () => {
  let vendor1User, vendor1Token;
  let vendor2User, vendor2Token;
  let organizerUser, organizerToken;
  let participantUser, participantToken;

  beforeEach(() => {
    // Reset test stores before each test
    app.locals.mockUserStore = new Map();
    app.locals.mockVenueStore = new Map();
    app.locals.mockCateringStore = new Map();

    // 1. Vendor 1
    vendor1User = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Chef Mario',
      email: 'mario@italiancater.com',
      role: 'vendor',
      phone: '111-222-3333',
      organization: 'Mario Catering Co.',
      isActive: true
    };
    app.locals.mockUserStore.set(vendor1User.id, vendor1User);
    vendor1Token = signToken(vendor1User);

    // 2. Vendor 2 (For ownership isolation checks)
    vendor2User = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Chef Luigi',
      email: 'luigi@pizzapasta.com',
      role: 'vendor',
      phone: '444-555-6666',
      organization: 'Luigi Delights',
      isActive: true
    };
    app.locals.mockUserStore.set(vendor2User.id, vendor2User);
    vendor2Token = signToken(vendor2User);

    // 3. Organizer
    organizerUser = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Emma Organizer',
      email: 'emma@campus.edu',
      role: 'organizer',
      isActive: true
    };
    app.locals.mockUserStore.set(organizerUser.id, organizerUser);
    organizerToken = signToken(organizerUser);

    // 4. Participant
    participantUser = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Peter Participant',
      email: 'peter@campus.edu',
      role: 'participant',
      isActive: true
    };
    app.locals.mockUserStore.set(participantUser.id, participantUser);
    participantToken = signToken(participantUser);
  });

  describe('Catering Profile Creation & RBAC', () => {
    const validProfile = {
      businessName: 'Gourmet Campus Kitchen',
      description: 'Artisanal catering for collegiate seminars and conferences.',
      serviceArea: 'Central Campus & East Quad',
      cuisineTypes: ['Continental', 'Mediterranean'],
      contactPhone: '555-123-4567'
    };

    test('Catering model permits legacy profiles without coordinates and declares a 2dsphere index', async () => {
      const legacyProfile = new CateringService({
        vendorId: new mongoose.Types.ObjectId(),
        businessName: 'Legacy Catering Profile',
        serviceArea: 'Campus'
      });
      await legacyProfile.validate();
      assert.equal(legacyProfile.location, undefined);
      assert.ok(CateringService.schema.indexes().some(([fields]) => fields.location === '2dsphere'));
    });

    test('1. Profile creation requires vendor role (403 for organizer & participant)', async () => {
      // Organizer attempt
      const orgRes = await request(app, {
        method: 'POST',
        url: '/api/catering',
        body: validProfile,
        headers: { authorization: `Bearer ${organizerToken}` }
      });
      assert.equal(orgRes.statusCode, 403);
      assert.match(orgRes.body.message, /Forbidden.*Role 'organizer'/i);

      // Participant attempt
      const partRes = await request(app, {
        method: 'POST',
        url: '/api/catering',
        body: validProfile,
        headers: { authorization: `Bearer ${participantToken}` }
      });
      assert.equal(partRes.statusCode, 403);
    });

    test('2. Vendor successfully creates profile; vendorId is authoritatively derived', async () => {
      const spoofedPayload = {
        ...validProfile,
        vendorId: 'spoofed_id_should_be_ignored'
      };

      const res = await request(app, {
        method: 'POST',
        url: '/api/catering',
        body: spoofedPayload,
        headers: { authorization: `Bearer ${vendor1Token}` }
      });

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.businessName, 'Gourmet Campus Kitchen');
      assert.equal(res.body.data.isAvailable, true);
      assert.equal(res.body.data.vendorId.id, vendor1User.id);
      assert.equal(res.body.data.location, undefined);
      assert.equal(res.body.data.city, '');
    });

    test('3. Duplicate profile creation by the same vendor is rejected with 409 Conflict', async () => {
      // First creation
      const first = await request(app, {
        method: 'POST',
        url: '/api/catering',
        body: validProfile,
        headers: { authorization: `Bearer ${vendor1Token}` }
      });
      assert.equal(first.statusCode, 201);

      // Duplicate attempt
      const second = await request(app, {
        method: 'POST',
        url: '/api/catering',
        body: validProfile,
        headers: { authorization: `Bearer ${vendor1Token}` }
      });
      assert.equal(second.statusCode, 409);
      assert.match(second.body.message, /already exists/i);
    });

    test('4. Profile validation rejects missing required fields', async () => {
      const res = await request(app, {
        method: 'POST',
        url: '/api/catering',
        body: { businessName: '' },
        headers: { authorization: `Bearer ${vendor1Token}` }
      });
      assert.equal(res.statusCode, 400);
      assert.equal(res.body.success, false);
    });

    test('Location validation accepts optional GeoJSON points and rejects malformed or out-of-range coordinates', async () => {
      const validRes = await request(app, {
        method: 'POST',
        url: '/api/catering',
        body: {
          ...validProfile,
          city: 'Tumakuru',
          locality: 'Siddaganga',
          fullAddress: 'Illustrative address',
          location: { type: 'Point', coordinates: [77.1, 13.34] }
        },
        headers: { authorization: `Bearer ${vendor1Token}` }
      });
      assert.equal(validRes.statusCode, 201);
      assert.deepEqual(validRes.body.data.location, {
        type: 'Point',
        coordinates: [77.1, 13.34]
      });

      for (const location of [
        { type: 'Point', coordinates: [77.1] },
        { type: 'Point', coordinates: [181, 13.34] },
        { type: 'Point', coordinates: [77.1, -91] },
        { type: 'LineString', coordinates: [77.1, 13.34] }
      ]) {
        const invalidRes = await request(app, {
          method: 'POST',
          url: '/api/catering',
          body: { ...validProfile, location },
          headers: { authorization: `Bearer ${vendor1Token}` }
        });
        assert.equal(invalidRes.statusCode, 400);
        assert.match(invalidRes.body.errors.join(' '), /GeoJSON Point/i);
      }
    });
  });

  describe('Vendor Profile Updates & Availability', () => {
    beforeEach(async () => {
      // Initialize vendor 1 profile
      await request(app, {
        method: 'POST',
        url: '/api/catering',
        body: {
          businessName: 'Original Bakery',
          serviceArea: 'West Campus',
          cuisineTypes: ['Pastries']
        },
        headers: { authorization: `Bearer ${vendor1Token}` }
      });
    });

    test('5. Vendor can retrieve and update their own profile', async () => {
      // Get my profile
      const getRes = await request(app, {
        method: 'GET',
        url: '/api/catering/my-profile',
        headers: { authorization: `Bearer ${vendor1Token}` }
      });
      assert.equal(getRes.statusCode, 200);
      assert.equal(getRes.body.data.businessName, 'Original Bakery');

      // Update my profile
      const updateRes = await request(app, {
        method: 'PUT',
        url: '/api/catering/my-profile',
        body: {
          businessName: 'Upgraded Artisan Bakery',
          serviceArea: 'All Campus'
        },
        headers: { authorization: `Bearer ${vendor1Token}` }
      });
      assert.equal(updateRes.statusCode, 200);
      assert.equal(updateRes.body.data.businessName, 'Upgraded Artisan Bakery');
      assert.equal(updateRes.body.data.serviceArea, 'All Campus');
    });

    test('6. Vendor can toggle service availability (available/unavailable)', async () => {
      const res = await request(app, {
        method: 'PATCH',
        url: '/api/catering/my-profile/availability',
        body: { isAvailable: false },
        headers: { authorization: `Bearer ${vendor1Token}` }
      });
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.data.isAvailable, false);
    });
  });

  describe('Package Management & Ownership Isolation', () => {
    let vendor1ServiceId;

    beforeEach(async () => {
      const res1 = await request(app, {
        method: 'POST',
        url: '/api/catering',
        body: {
          businessName: 'Vendor 1 Kitchen',
          serviceArea: 'Campus',
          cuisineTypes: ['Italian']
        },
        headers: { authorization: `Bearer ${vendor1Token}` }
      });
      vendor1ServiceId = res1.body.data.id;

      await request(app, {
        method: 'POST',
        url: '/api/catering',
        body: {
          businessName: 'Vendor 2 Kitchen',
          serviceArea: 'Downtown',
          cuisineTypes: ['Mexican']
        },
        headers: { authorization: `Bearer ${vendor2Token}` }
      });
    });

    test('7. Vendor adds package with validation (rejects negative price, minOrder < 1)', async () => {
      // Negative price
      const negRes = await request(app, {
        method: 'POST',
        url: '/api/catering/my-profile/packages',
        body: {
          name: 'Executive Lunch',
          pricePerPlate: -5
        },
        headers: { authorization: `Bearer ${vendor1Token}` }
      });
      assert.equal(negRes.statusCode, 400);

      // Valid package
      const validRes = await request(app, {
        method: 'POST',
        url: '/api/catering/my-profile/packages',
        body: {
          name: 'Classic Buffet',
          description: 'Three course meal with dessert',
          pricePerPlate: 22.5,
          minOrder: 15,
          menuItems: ['Garden Salad', 'Lasagna', 'Tiramisu'],
          dietaryOptions: ['Vegetarian']
        },
        headers: { authorization: `Bearer ${vendor1Token}` }
      });

      assert.equal(validRes.statusCode, 201);
      assert.equal(validRes.body.data.name, 'Classic Buffet');
      assert.equal(validRes.body.data.pricePerPlate, 22.5);
      assert.equal(validRes.body.data.minOrder, 15);
    });

    test('Package maximum capacity must be a positive integer no lower than minOrder', async () => {
      for (const maxGuests of [0, 15.5, 14]) {
        const invalidRes = await request(app, {
          method: 'POST',
          url: '/api/catering/my-profile/packages',
          body: {
            name: 'Capacity Package',
            pricePerPlate: 20,
            minOrder: 15,
            maxGuests
          },
          headers: { authorization: `Bearer ${vendor1Token}` }
        });
        assert.equal(invalidRes.statusCode, 400);
      }

      const validRes = await request(app, {
        method: 'POST',
        url: '/api/catering/my-profile/packages',
        body: {
          name: 'Capacity Package',
          pricePerPlate: 20,
          minOrder: 15,
          maxGuests: 100
        },
        headers: { authorization: `Bearer ${vendor1Token}` }
      });
      assert.equal(validRes.statusCode, 201);
      assert.equal(validRes.body.data.maxGuests, 100);

      const updateRes = await request(app, {
        method: 'PUT',
        url: `/api/catering/my-profile/packages/${validRes.body.data.id}`,
        body: { minOrder: 101 },
        headers: { authorization: `Bearer ${vendor1Token}` }
      });
      assert.equal(updateRes.statusCode, 400);
      assert.match(updateRes.body.errors.join(' '), /greater than or equal/i);
    });

    test('8. Vendor can update and archive an existing package', async () => {
      // Add package first
      const addRes = await request(app, {
        method: 'POST',
        url: '/api/catering/my-profile/packages',
        body: {
          name: 'Bronze Package',
          pricePerPlate: 12
        },
        headers: { authorization: `Bearer ${vendor1Token}` }
      });
      const packageId = addRes.body.data.id;

      // Update package
      const updateRes = await request(app, {
        method: 'PUT',
        url: `/api/catering/my-profile/packages/${packageId}`,
        body: {
          pricePerPlate: 14,
          description: 'Updated rate with beverage'
        },
        headers: { authorization: `Bearer ${vendor1Token}` }
      });
      assert.equal(updateRes.statusCode, 200);
      assert.equal(updateRes.body.data.pricePerPlate, 14);

      // Archive package
      const archiveRes = await request(app, {
        method: 'DELETE',
        url: `/api/catering/my-profile/packages/${packageId}`,
        headers: { authorization: `Bearer ${vendor1Token}` }
      });
      assert.equal(archiveRes.statusCode, 200);
      assert.match(archiveRes.body.message, /archived successfully/i);
    });

    test('9. Ownership Isolation: Vendor 2 cannot update or delete Vendor 1 package', async () => {
      const addRes = await request(app, {
        method: 'POST',
        url: '/api/catering/my-profile/packages',
        body: {
          name: 'Vendor 1 Secret Sauce Package',
          pricePerPlate: 20
        },
        headers: { authorization: `Bearer ${vendor1Token}` }
      });
      const v1PkgId = addRes.body.data.id;

      // Vendor 2 attempts to update Vendor 1's package
      const hijackUpdate = await request(app, {
        method: 'PUT',
        url: `/api/catering/my-profile/packages/${v1PkgId}`,
        body: { name: 'Hacked Package' },
        headers: { authorization: `Bearer ${vendor2Token}` }
      });
      assert.equal(hijackUpdate.statusCode, 404); // Vendor 2's profile doesn't own this package

      // Vendor 2 attempts to delete Vendor 1's package
      const hijackDelete = await request(app, {
        method: 'DELETE',
        url: `/api/catering/my-profile/packages/${v1PkgId}`,
        headers: { authorization: `Bearer ${vendor2Token}` }
      });
      assert.equal(hijackDelete.statusCode, 404);
    });
  });

  describe('GET /api/catering (Discovery & Filters)', () => {
    beforeEach(async () => {
      // Seed 2 vendor profiles with packages
      const p1 = await request(app, {
        method: 'POST',
        url: '/api/catering',
        body: {
          businessName: 'Green Bowl Organics',
          serviceArea: 'North Campus',
          city: 'Tumakuru',
          locality: 'Siddaganga',
          location: { type: 'Point', coordinates: [77.1, 13.34] },
          cuisineTypes: ['Salads', 'Healthy']
        },
        headers: { authorization: `Bearer ${vendor1Token}` }
      });
      await request(app, {
        method: 'POST',
        url: '/api/catering/my-profile/packages',
        body: {
          name: 'Vegan Harvest',
          pricePerPlate: 18,
          minOrder: 20,
          maxGuests: 120,
          dietaryOptions: ['Vegan', 'Gluten-Free']
        },
        headers: { authorization: `Bearer ${vendor1Token}` }
      });

      const p2 = await request(app, {
        method: 'POST',
        url: '/api/catering',
        body: {
          businessName: 'Royal Feast Catering',
          serviceArea: 'South Campus',
          city: 'Tumakuru',
          locality: 'Gubbi Road',
          cuisineTypes: ['BBQ']
        },
        headers: { authorization: `Bearer ${vendor2Token}` }
      });
      await request(app, {
        method: 'POST',
        url: '/api/catering/my-profile/packages',
        body: {
          name: 'Carnivore Special',
          pricePerPlate: 35,
          maxGuests: 500,
          dietaryOptions: ['Halal']
        },
        headers: { authorization: `Bearer ${vendor2Token}` }
      });
      const greenService = app.locals.mockCateringStore.get(p1.body.data.id);
      greenService.packages.push({
        id: new mongoose.Types.ObjectId().toString(),
        name: 'Archived Demo Package',
        pricePerPlate: 1,
        minOrder: 1,
        maxGuests: 1000,
        dietaryOptions: ['Kosher'],
        isArchived: true
      });
    });

    test('10. Organizers can browse active catering services', async () => {
      const res = await request(app, {
        method: 'GET',
        url: '/api/catering',
        headers: { authorization: `Bearer ${organizerToken}` }
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.count, 2);
    });

    test('11. Search by keyword filters services by business name or location', async () => {
      const res = await request(app, {
        method: 'GET',
        url: '/api/catering?search=Green',
        headers: { authorization: `Bearer ${organizerToken}` }
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.count, 1);
      assert.equal(res.body.data[0].businessName, 'Green Bowl Organics');
    });

    test('12. Filter by dietary requirement restricts results to matching vendors', async () => {
      const res = await request(app, {
        method: 'GET',
        url: '/api/catering?dietary=Vegan',
        headers: { authorization: `Bearer ${organizerToken}` }
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.count, 1);
      assert.equal(res.body.data[0].businessName, 'Green Bowl Organics');
    });

    test('13. Filter by maximum price per plate', async () => {
      const res = await request(app, {
        method: 'GET',
        url: '/api/catering?maxPrice=20',
        headers: { authorization: `Bearer ${organizerToken}` }
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.count, 1);
      assert.equal(res.body.data[0].businessName, 'Green Bowl Organics');
    });

    test('City and locality filters are case-insensitive and legacy profiles remain discoverable', async () => {
      const res = await request(app, {
        method: 'GET',
        url: '/api/catering?city=tUmaKuRu&locality=sIdDaGaNgA',
        headers: { authorization: `Bearer ${organizerToken}` }
      });
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.count, 1);
      assert.equal(res.body.data[0].businessName, 'Green Bowl Organics');

      const cityRes = await request(app, {
        method: 'GET',
        url: '/api/catering?city=TUMAKURU',
        headers: { authorization: `Bearer ${organizerToken}` }
      });
      assert.equal(cityRes.body.count, 2);
      assert.equal(cityRes.body.data.find((service) => service.businessName === 'Royal Feast Catering').location, undefined);
    });

    test('Distance filtering returns nearby geocoded vendors and preserves normal searches for legacy profiles', async () => {
      const nearbyRes = await request(app, {
        method: 'GET',
        url: '/api/catering?latitude=13.34&longitude=77.1&radiusKm=1',
        headers: { authorization: `Bearer ${organizerToken}` }
      });
      assert.equal(nearbyRes.statusCode, 200);
      assert.equal(nearbyRes.body.count, 1);
      assert.equal(nearbyRes.body.data[0].businessName, 'Green Bowl Organics');
      assert.equal(nearbyRes.body.data[0].distanceKm, 0);

      const cityRes = await request(app, {
        method: 'GET',
        url: '/api/catering?city=Tumakuru',
        headers: { authorization: `Bearer ${organizerToken}` }
      });
      assert.equal(cityRes.body.count, 2);
    });

    test('Guest capacity, price, and dietary filters apply to the same active package only', async () => {
      const royalService = Array.from(app.locals.mockCateringStore.values())
        .find((service) => service.businessName === 'Royal Feast Catering');
      royalService.packages.push(
        {
          id: new mongoose.Types.ObjectId().toString(),
          name: 'Expensive Vegan Package',
          pricePerPlate: 40,
          minOrder: 20,
          maxGuests: 500,
          dietaryOptions: ['Vegan'],
          isArchived: false
        },
        {
          id: new mongoose.Types.ObjectId().toString(),
          name: 'Low-Cost Halal Package',
          pricePerPlate: 10,
          minOrder: 20,
          maxGuests: 500,
          dietaryOptions: ['Halal'],
          isArchived: false
        }
      );

      const capable = await request(app, {
        method: 'GET',
        url: '/api/catering?cuisine=Salads&guestCount=100&maxPrice=20&dietary=Vegan',
        headers: { authorization: `Bearer ${organizerToken}` }
      });
      assert.equal(capable.body.count, 1);
      assert.equal(capable.body.data[0].packages.length, 1);
      assert.equal(capable.body.data[0].packages[0].name, 'Vegan Harvest');

      const separatePackageCriteria = await request(app, {
        method: 'GET',
        url: '/api/catering?cuisine=BBQ&dietary=Vegan&maxPrice=20&guestCount=100',
        headers: { authorization: `Bearer ${organizerToken}` }
      });
      assert.equal(separatePackageCriteria.body.count, 0);

      const overCapacity = await request(app, {
        method: 'GET',
        url: '/api/catering?cuisine=Salads&guestCount=121',
        headers: { authorization: `Bearer ${organizerToken}` }
      });
      assert.equal(overCapacity.body.count, 0);

      const archivedOnly = await request(app, {
        method: 'GET',
        url: '/api/catering?dietary=Kosher&maxPrice=2&guestCount=50',
        headers: { authorization: `Bearer ${organizerToken}` }
      });
      assert.equal(archivedOnly.body.count, 0);
    });

    test('Pagination returns stable pages and public discovery omits contact details', async () => {
      const firstPage = await request(app, {
        method: 'GET',
        url: '/api/catering?page=1&limit=1',
        headers: { authorization: `Bearer ${organizerToken}` }
      });
      const secondPage = await request(app, {
        method: 'GET',
        url: '/api/catering?page=2&limit=1',
        headers: { authorization: `Bearer ${organizerToken}` }
      });
      assert.equal(firstPage.body.pagination.total, 2);
      assert.equal(firstPage.body.pagination.pages, 2);
      assert.equal(firstPage.body.count, 1);
      assert.equal(secondPage.body.count, 1);
      assert.notEqual(firstPage.body.data[0].id, secondPage.body.data[0].id);
      assert.equal(firstPage.body.data[0].contactEmail, undefined);
      assert.equal(firstPage.body.data[0].contactPhone, undefined);

      const detailRes = await request(app, {
        method: 'GET',
        url: `/api/catering/${firstPage.body.data[0].id}`,
        headers: { authorization: `Bearer ${organizerToken}` }
      });
      assert.equal(detailRes.body.data.contactEmail, undefined);
      assert.equal(detailRes.body.data.contactPhone, undefined);
    });
  });
});
