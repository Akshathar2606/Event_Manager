const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { request } = require('./testHelper');
const { signToken } = require('../src/utils/token');

const vendorPayload = (email = 'vendor@example.com') => ({
  name: 'Taylor Vendor',
  email,
  password: 'VendorPassword123',
  role: 'vendor',
  vendorApplication: {
    businessName: 'Taylor Catering',
    businessCategory: 'Catering',
    businessDescription: 'Fresh catering for campus events and community gatherings.',
    contactNumber: '+1 (555) 123-4567',
    city: 'Springfield',
    locality: 'Downtown',
    servicesOffered: ['Catering', 'Custom menus']
  }
});

const authHeader = (token) => ({ authorization: `Bearer ${token}` });

describe('Vendor registration and approval workflow (mock-store tests; no MongoDB integration)', () => {
  let admin;
  let adminToken;

  beforeEach(() => {
    app.locals.mockUserStore = new Map();
    app.locals.mockVendorApplicationStore = new Map();
    app.locals.mockCateringStore = new Map();
    app.locals.mockCateringRequestStore = new Map();
    admin = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'EventFlow Administrator',
      email: 'admin@eventflow.example',
      role: 'administrator',
      isActive: true
    };
    app.locals.mockUserStore.set(admin.id, admin);
    adminToken = signToken(admin);
  });

  test('vendor registration creates an authenticated pending application without a catering profile', async () => {
    const response = await request(app, {
      method: 'POST',
      url: '/api/auth/register',
      body: vendorPayload()
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.user.role, 'vendor');
    assert.equal(response.body.user.vendorApplicationStatus, 'pending');
    assert.equal(response.body.application.status, 'pending');
    assert.ok(response.body.token);
    assert.equal(response.body.user.passwordHash, undefined);
    assert.equal(app.locals.mockVendorApplicationStore.size, 1);
    assert.equal(app.locals.mockCateringStore.size, 0);
    const application = Array.from(app.locals.mockVendorApplicationStore.values())[0];
    assert.equal(application.vendorId, response.body.user.id);
    assert.equal(application.businessName, 'Taylor Catering');
  });

  test('vendor registration rejects missing or invalid business information', async () => {
    const payload = vendorPayload();
    payload.vendorApplication.city = '';
    payload.vendorApplication.servicesOffered = [];
    const response = await request(app, {
      method: 'POST',
      url: '/api/auth/register',
      body: payload
    });

    assert.equal(response.statusCode, 400);
    assert.match(response.body.errors.join(' '), /City must be between/);
    assert.match(response.body.errors.join(' '), /services offered/i);
    assert.equal(app.locals.mockUserStore.size, 1);
    assert.equal(app.locals.mockVendorApplicationStore.size, 0);
  });

  test('duplicate registration does not create a second vendor application', async () => {
    const payload = vendorPayload();
    const first = await request(app, { method: 'POST', url: '/api/auth/register', body: payload });
    const second = await request(app, { method: 'POST', url: '/api/auth/register', body: payload });

    assert.equal(first.statusCode, 201);
    assert.equal(second.statusCode, 409);
    assert.equal(app.locals.mockVendorApplicationStore.size, 1);
  });

  test('pending vendor can log in but is denied vendor-only profile and request APIs', async () => {
    const registration = await request(app, {
      method: 'POST',
      url: '/api/auth/register',
      body: vendorPayload()
    });
    const login = await request(app, {
      method: 'POST',
      url: '/api/auth/login',
      body: { email: 'vendor@example.com', password: 'VendorPassword123' }
    });

    assert.equal(login.statusCode, 200);
    assert.equal(login.body.user.vendorApplicationStatus, 'pending');
    const currentUser = await request(app, {
      method: 'GET',
      url: '/api/auth/me',
      headers: authHeader(registration.body.token)
    });
    assert.equal(currentUser.statusCode, 200);
    assert.equal(currentUser.body.user.vendorApplicationStatus, 'pending');

    const profile = await request(app, {
      method: 'GET',
      url: '/api/catering/my-profile',
      headers: authHeader(registration.body.token)
    });
    assert.equal(profile.statusCode, 403);
    assert.equal(profile.body.code, 'VENDOR_APPLICATION_PENDING');

    const packageRequest = await request(app, {
      method: 'POST',
      url: '/api/catering/my-profile/packages',
      headers: authHeader(registration.body.token),
      body: { name: 'Blocked package' }
    });
    assert.equal(packageRequest.statusCode, 403);
    assert.equal(packageRequest.body.code, 'VENDOR_APPLICATION_PENDING');

    const incoming = await request(app, {
      method: 'GET',
      url: '/api/catering-requests/incoming',
      headers: authHeader(registration.body.token)
    });
    assert.equal(incoming.statusCode, 403);
    assert.equal(incoming.body.code, 'VENDOR_APPLICATION_PENDING');
  });

  test('administrator can inspect and approve a pending application; approved vendor can create a profile', async () => {
    const registration = await request(app, {
      method: 'POST',
      url: '/api/auth/register',
      body: vendorPayload()
    });
    const [application] = Array.from(app.locals.mockVendorApplicationStore.values());
    const listed = await request(app, {
      method: 'GET',
      url: '/api/vendor-applications?status=pending',
      headers: authHeader(adminToken)
    });

    assert.equal(listed.statusCode, 200);
    assert.equal(listed.body.data.length, 1);
    assert.equal(listed.body.data[0].vendor.email, 'vendor@example.com');
    assert.equal(JSON.stringify(listed.body).includes('passwordHash'), false);

    const approval = await request(app, {
      method: 'PATCH',
      url: `/api/vendor-applications/${application.id}/approve`,
      headers: authHeader(adminToken)
    });
    assert.equal(approval.statusCode, 200);
    assert.equal(approval.body.data.status, 'approved');
    assert.equal(app.locals.mockCateringStore.size, 0);

    const login = await request(app, {
      method: 'POST',
      url: '/api/auth/login',
      body: { email: 'vendor@example.com', password: 'VendorPassword123' }
    });
    assert.equal(login.body.user.vendorApplicationStatus, 'approved');

    const profile = await request(app, {
      method: 'POST',
      url: '/api/catering',
      headers: authHeader(registration.body.token),
      body: { businessName: 'Taylor Catering', serviceArea: 'Springfield' }
    });
    assert.equal(profile.statusCode, 201);
    assert.equal(profile.body.data.vendorId.id, registration.body.user.id);
    assert.equal(app.locals.mockCateringStore.size, 1);
  });

  test('administrator can reject with a reason and the vendor receives rejection feedback', async () => {
    const registration = await request(app, {
      method: 'POST',
      url: '/api/auth/register',
      body: vendorPayload()
    });
    const [application] = Array.from(app.locals.mockVendorApplicationStore.values());
    const rejected = await request(app, {
      method: 'PATCH',
      url: `/api/vendor-applications/${application.id}/reject`,
      headers: authHeader(adminToken),
      body: { reason: 'Please provide current business licensing details.' }
    });

    assert.equal(rejected.statusCode, 200);
    assert.equal(rejected.body.data.status, 'rejected');
    assert.equal(rejected.body.data.rejectionReason, 'Please provide current business licensing details.');

    const login = await request(app, {
      method: 'POST',
      url: '/api/auth/login',
      body: { email: 'vendor@example.com', password: 'VendorPassword123' }
    });
    assert.equal(login.statusCode, 200);
    assert.equal(login.body.user.vendorApplicationStatus, 'rejected');
    assert.equal(login.body.user.vendorRejectionReason, 'Please provide current business licensing details.');

    const access = await request(app, {
      method: 'GET',
      url: '/api/catering/my-profile',
      headers: authHeader(registration.body.token)
    });
    assert.equal(access.statusCode, 403);
    assert.equal(access.body.code, 'VENDOR_APPLICATION_REJECTED');
    assert.equal(access.body.rejectionReason, 'Please provide current business licensing details.');
  });

  test('approval and rejection require administrator authorization and valid rejection reasons', async () => {
    const registration = await request(app, {
      method: 'POST',
      url: '/api/auth/register',
      body: vendorPayload()
    });
    const [application] = Array.from(app.locals.mockVendorApplicationStore.values());
    const participant = {
      id: new mongoose.Types.ObjectId().toString(),
      name: 'Participant',
      email: 'participant@example.com',
      passwordHash: await bcrypt.hash('Participant123', 4),
      role: 'participant',
      isActive: true
    };
    app.locals.mockUserStore.set(participant.id, participant);
    const participantToken = signToken(participant);
    const approveUrl = `/api/vendor-applications/${application.id}/approve`;

    const unauthenticated = await request(app, { method: 'PATCH', url: approveUrl });
    assert.equal(unauthenticated.statusCode, 401);

    const unauthorized = await request(app, {
      method: 'PATCH',
      url: approveUrl,
      headers: authHeader(participantToken)
    });
    assert.equal(unauthorized.statusCode, 403);

    const selfApproval = await request(app, {
      method: 'PATCH',
      url: approveUrl,
      headers: authHeader(registration.body.token)
    });
    assert.equal(selfApproval.statusCode, 403);

    const missingReason = await request(app, {
      method: 'PATCH',
      url: `/api/vendor-applications/${application.id}/reject`,
      headers: authHeader(adminToken),
      body: { reason: 'no' }
    });
    assert.equal(missingReason.statusCode, 400);
    assert.equal(application.status, 'pending');
  });

  test('reviewed applications remain visible in approved and rejected views without repeat review', async () => {
    await request(app, {
      method: 'POST',
      url: '/api/auth/register',
      body: vendorPayload()
    });
    const [application] = Array.from(app.locals.mockVendorApplicationStore.values());
    const reviewed = await request(app, {
      method: 'PATCH',
      url: `/api/vendor-applications/${application.id}/approve`,
      headers: authHeader(adminToken)
    });
    assert.equal(reviewed.statusCode, 200);

    const approved = await request(app, {
      method: 'GET',
      url: '/api/vendor-applications?status=approved',
      headers: authHeader(adminToken)
    });
    const rejected = await request(app, {
      method: 'GET',
      url: '/api/vendor-applications?status=rejected',
      headers: authHeader(adminToken)
    });
    assert.equal(approved.body.data.length, 1);
    assert.equal(rejected.body.data.length, 0);

    const repeat = await request(app, {
      method: 'PATCH',
      url: `/api/vendor-applications/${application.id}/approve`,
      headers: authHeader(adminToken)
    });
    assert.equal(repeat.statusCode, 409);
  });

  test('public role registration preserves participant and organizer account creation', async () => {
    for (const [role, email] of [
      ['participant', 'participant-register@example.com'],
      ['organizer', 'organizer-register@example.com']
    ]) {
      const response = await request(app, {
        method: 'POST',
        url: '/api/auth/register',
        body: { name: 'EventFlow Member', email, password: 'MemberPassword123', role }
      });
      assert.equal(response.statusCode, 201);
      assert.equal(response.body.user.role, role);
    }
  });
});
