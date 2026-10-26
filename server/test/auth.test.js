const { test, describe, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const app = require('../src/app');
const { request } = require('./testHelper');
const { signToken } = require('../src/utils/token');

describe('EventFlow Authentication & RBAC Test Suite', () => {
  beforeEach(() => {
    // Reset mock store before each test so tests remain strictly isolated
    app.locals.mockUserStore = new Map();
  });

  describe('Registration (POST /api/auth/register)', () => {
    test('1. Successful participant registration returns 201, valid token, and safe user without passwordHash', async () => {
      const payload = {
        name: 'Jane Doe',
        email: 'jane.participant@example.com',
        password: 'Password123!',
        role: 'participant',
        phone: '1234567890'
      };

      const res = await request(app, {
        method: 'POST',
        url: '/api/auth/register',
        body: payload
      });

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.token, 'Token must be issued');
      assert.equal(res.body.user.email, 'jane.participant@example.com');
      assert.equal(res.body.user.role, 'participant');
      assert.equal(res.body.user.passwordHash, undefined, 'passwordHash must never be exposed');
    });

    test('2. Successful organizer registration returns 201 and organizer role', async () => {
      const payload = {
        name: 'Alex Organizer',
        email: 'alex.organizer@example.com',
        password: 'SecureOrganizerPass1',
        role: 'organizer',
        organization: 'Tech Club'
      };

      const res = await request(app, {
        method: 'POST',
        url: '/api/auth/register',
        body: payload
      });

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.user.role, 'organizer');
      assert.equal(res.body.user.organization, 'Tech Club');
    });

    test('3. Duplicate email registration is rejected with 409 Conflict', async () => {
      const payload = {
        name: 'Original User',
        email: 'duplicate@example.com',
        password: 'ValidPassword1',
        role: 'participant'
      };

      // First registration
      const firstRes = await request(app, {
        method: 'POST',
        url: '/api/auth/register',
        body: payload
      });
      assert.equal(firstRes.statusCode, 201);

      // Attempt second registration with same email
      const secondRes = await request(app, {
        method: 'POST',
        url: '/api/auth/register',
        body: payload
      });

      assert.equal(secondRes.statusCode, 409);
      assert.equal(secondRes.body.success, false);
      assert.match(secondRes.body.message, /already registered/i);
    });

    test('4. Missing or invalid input is rejected with 400 Bad Request', async () => {
      // Invalid email
      const resBadEmail = await request(app, {
        method: 'POST',
        url: '/api/auth/register',
        body: {
          name: 'Bob',
          email: 'not-an-email',
          password: 'Password123'
        }
      });
      assert.equal(resBadEmail.statusCode, 400);

      // Weak password (< 8 chars)
      const resShortPass = await request(app, {
        method: 'POST',
        url: '/api/auth/register',
        body: {
          name: 'Bob',
          email: 'bob@example.com',
          password: 'Pass1'
        }
      });
      assert.equal(resShortPass.statusCode, 400);

      // Password missing numbers
      const resNoNumPass = await request(app, {
        method: 'POST',
        url: '/api/auth/register',
        body: {
          name: 'Bob',
          email: 'bob@example.com',
          password: 'PasswordWithoutNumbers'
        }
      });
      assert.equal(resNoNumPass.statusCode, 400);
    });

    test('5. Self-registration as administrator or vendor is strictly rejected with 403 Forbidden', async () => {
      // Administrator attempt
      const adminRes = await request(app, {
        method: 'POST',
        url: '/api/auth/register',
        body: {
          name: 'Attacker Admin',
          email: 'attacker.admin@example.com',
          password: 'HackerPassword1',
          role: 'administrator'
        }
      });
      assert.equal(adminRes.statusCode, 403);
      assert.match(adminRes.body.message, /Self-registration as 'administrator' is strictly forbidden/i);

      // Vendor attempt
      const vendorRes = await request(app, {
        method: 'POST',
        url: '/api/auth/register',
        body: {
          name: 'Attacker Vendor',
          email: 'attacker.vendor@example.com',
          password: 'HackerPassword1',
          role: 'vendor'
        }
      });
      assert.equal(vendorRes.statusCode, 403);
      assert.match(vendorRes.body.message, /Self-registration as 'vendor' is strictly forbidden/i);
    });
  });

  describe('Login (POST /api/auth/login)', () => {
    beforeEach(async () => {
      // Seed a test participant
      await request(app, {
        method: 'POST',
        url: '/api/auth/register',
        body: {
          name: 'Login Test User',
          email: 'login.test@example.com',
          password: 'CorrectPassword1',
          role: 'participant'
        }
      });
    });

    test('6. Successful login returns 200, JWT token, and safe user profile', async () => {
      const res = await request(app, {
        method: 'POST',
        url: '/api/auth/login',
        body: {
          email: 'login.test@example.com',
          password: 'CorrectPassword1'
        }
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.token, 'Token should be returned');
      assert.equal(res.body.user.email, 'login.test@example.com');
      assert.equal(res.body.user.passwordHash, undefined);
    });

    test('7. Incorrect password is rejected with 401 Unauthorized', async () => {
      const res = await request(app, {
        method: 'POST',
        url: '/api/auth/login',
        body: {
          email: 'login.test@example.com',
          password: 'WrongPassword999'
        }
      });

      assert.equal(res.statusCode, 401);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /Invalid email or password/i);
    });

    test('7b. Non-existent email is rejected with generic 401 Unauthorized', async () => {
      const res = await request(app, {
        method: 'POST',
        url: '/api/auth/login',
        body: {
          email: 'doesnotexist@example.com',
          password: 'SomePassword1'
        }
      });

      assert.equal(res.statusCode, 401);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /Invalid email or password/i);
    });
  });

  describe('Token Verification & Current-User (GET /api/auth/me)', () => {
    let validToken;
    let registeredUser;

    beforeEach(async () => {
      const reg = await request(app, {
        method: 'POST',
        url: '/api/auth/register',
        body: {
          name: 'Token User',
          email: 'token.user@example.com',
          password: 'TokenPassword1',
          role: 'participant'
        }
      });
      validToken = reg.body.token;
      registeredUser = reg.body.user;
    });

    test('8. Missing, malformed, or invalid JWT is rejected with 401 Unauthorized', async () => {
      // Missing header
      const missingRes = await request(app, {
        method: 'GET',
        url: '/api/auth/me'
      });
      assert.equal(missingRes.statusCode, 401);

      // Malformed header (missing Bearer prefix)
      const malformedRes = await request(app, {
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: 'Basic 123456' }
      });
      assert.equal(malformedRes.statusCode, 401);

      // Tampered token
      const tamperedRes = await request(app, {
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${validToken}tampered` }
      });
      assert.equal(tamperedRes.statusCode, 401);
    });

    test('9. Successful authenticated /api/auth/me request returns current user profile', async () => {
      const res = await request(app, {
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${validToken}` }
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.user.email, 'token.user@example.com');
      assert.equal(res.body.user.role, 'participant');
    });
  });

  describe('Role-Based Authorization Enforcement (RBAC)', () => {
    let participantToken;
    let organizerToken;
    let adminToken;

    beforeEach(async () => {
      // 1. Participant
      const pRes = await request(app, {
        method: 'POST',
        url: '/api/auth/register',
        body: {
          name: 'Pat Participant',
          email: 'pat@example.com',
          password: 'Password123',
          role: 'participant'
        }
      });
      participantToken = pRes.body.token;

      // 2. Organizer
      const oRes = await request(app, {
        method: 'POST',
        url: '/api/auth/register',
        body: {
          name: 'Olivia Organizer',
          email: 'olivia@example.com',
          password: 'Password123',
          role: 'organizer'
        }
      });
      organizerToken = oRes.body.token;

      // 3. Administrator (Provisioned securely via backend mock store / system seed)
      const adminUser = {
        id: new mongoose.Types.ObjectId().toString(),
        name: 'System Admin',
        email: 'admin@eventflow.college.edu',
        passwordHash: 'hash',
        role: 'administrator',
        isActive: true
      };
      app.locals.mockUserStore.set(adminUser.id, adminUser);
      adminToken = signToken(adminUser);
    });

    test('10a. Only administrator can access administrator-only route (/admin-check)', async () => {
      // Participant denied
      const pDeny = await request(app, {
        method: 'GET',
        url: '/api/auth/admin-check',
        headers: { authorization: `Bearer ${participantToken}` }
      });
      assert.equal(pDeny.statusCode, 403);
      assert.match(pDeny.body.message, /Forbidden.*Role 'participant'/i);

      // Organizer denied
      const oDeny = await request(app, {
        method: 'GET',
        url: '/api/auth/admin-check',
        headers: { authorization: `Bearer ${organizerToken}` }
      });
      assert.equal(oDeny.statusCode, 403);
      assert.match(oDeny.body.message, /Forbidden.*Role 'organizer'/i);

      // Administrator allowed
      const aAllow = await request(app, {
        method: 'GET',
        url: '/api/auth/admin-check',
        headers: { authorization: `Bearer ${adminToken}` }
      });
      assert.equal(aAllow.statusCode, 200);
      assert.equal(aAllow.body.success, true);
    });

    test('10b. Participants cannot access organizer-only route (/organizer-check)', async () => {
      // Participant denied
      const pDeny = await request(app, {
        method: 'GET',
        url: '/api/auth/organizer-check',
        headers: { authorization: `Bearer ${participantToken}` }
      });
      assert.equal(pDeny.statusCode, 403);
      assert.match(pDeny.body.message, /Forbidden.*Role 'participant'/i);

      // Organizer allowed
      const oAllow = await request(app, {
        method: 'GET',
        url: '/api/auth/organizer-check',
        headers: { authorization: `Bearer ${organizerToken}` }
      });
      assert.equal(oAllow.statusCode, 200);
      assert.equal(oAllow.body.success, true);

      // Administrator allowed (has supervisory permission on organizer routes)
      const aAllow = await request(app, {
        method: 'GET',
        url: '/api/auth/organizer-check',
        headers: { authorization: `Bearer ${adminToken}` }
      });
      assert.equal(aAllow.statusCode, 200);
      assert.equal(aAllow.body.success, true);
    });
  });
});
