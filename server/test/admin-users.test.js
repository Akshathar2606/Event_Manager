const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { User } = require('../src/models/User');
const { request } = require('./testHelper');
const { signToken } = require('../src/utils/token');
const { updateUserStatus } = require('../src/controllers/adminUserController');

const makeUser = (overrides = {}) => {
  const id = overrides.id || new mongoose.Types.ObjectId().toString();
  return {
    id,
    name: 'Test User',
    email: `${id}@example.com`,
    passwordHash: 'secret-hash',
    role: 'participant',
    phone: '555-0100',
    organization: 'EventFlow',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
};

const addUser = (overrides) => {
  const user = makeUser(overrides);
  app.locals.mockUserStore.set(user.id, user);
  return user;
};

const createMockResponse = () => ({
  statusCode: 200,
  status(statusCode) {
    this.statusCode = statusCode;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  }
});

const tokenFor = (user) => signToken(user);
const authHeader = (token) => ({ authorization: `Bearer ${token}` });

describe('Administrator user management API (mock-store tests; not MongoDB concurrency integration tests)', () => {
  let admin;
  let adminToken;

  beforeEach(() => {
    app.locals.mockUserStore = new Map();
    admin = addUser({ name: 'System Admin', role: 'administrator' });
    adminToken = tokenFor(admin);
  });

  test('requires authentication and administrator role to list or update users', async () => {
    const unauthenticated = await request(app, { method: 'GET', url: '/api/users' });
    assert.equal(unauthenticated.statusCode, 401);

    const participant = addUser({ name: 'Pat Participant', role: 'participant' });
    const forbiddenList = await request(app, {
      method: 'GET',
      url: '/api/users',
      headers: authHeader(tokenFor(participant))
    });
    assert.equal(forbiddenList.statusCode, 403);

    const forbiddenUpdate = await request(app, {
      method: 'PATCH',
      url: `/api/users/${admin.id}/status`,
      headers: authHeader(tokenFor(participant)),
      body: { isActive: false }
    });
    assert.equal(forbiddenUpdate.statusCode, 403);
    assert.equal(admin.isActive, true);
  });

  test('searches by name or email and returns server-side pagination metadata', async () => {
    addUser({ name: 'Morgan Search', email: 'morgan.one@example.com', createdAt: '2025-01-01' });
    addUser({ name: 'Morgan Search', email: 'morgan.two@example.com', createdAt: '2025-01-02' });
    addUser({ name: 'Other User', email: 'unique.search@example.com', createdAt: '2025-01-03' });
    addUser({ name: 'Unrelated', email: 'unrelated@example.com', createdAt: '2025-01-04' });

    const byName = await request(app, {
      method: 'GET',
      url: '/api/users?search=Morgan&page=2&limit=1',
      headers: authHeader(adminToken)
    });
    assert.equal(byName.statusCode, 200);
    assert.equal(byName.body.pagination.total, 2);
    assert.equal(byName.body.pagination.page, 2);
    assert.equal(byName.body.pagination.limit, 1);
    assert.equal(byName.body.pagination.pages, 2);
    assert.equal(byName.body.count, 1);
    assert.equal(byName.body.data[0].email, 'morgan.one@example.com');

    const byEmail = await request(app, {
      method: 'GET',
      url: '/api/users?search=unique.search%40example.com',
      headers: authHeader(adminToken)
    });
    assert.equal(byEmail.statusCode, 200);
    assert.equal(byEmail.body.pagination.total, 1);
    assert.equal(byEmail.body.data[0].name, 'Other User');
  });

  test('filters by role and active status and excludes sensitive or unknown fields', async () => {
    addUser({ name: 'Inactive Organizer', role: 'organizer', isActive: false });
    addUser({ name: 'Active Organizer', role: 'organizer', isActive: true });
    addUser({ name: 'Inactive Vendor', role: 'vendor', isActive: false });

    const result = await request(app, {
      method: 'GET',
      url: '/api/users?role=organizer&isActive=false',
      headers: authHeader(adminToken)
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.pagination.total, 1);
    assert.equal(result.body.data[0].name, 'Inactive Organizer');
    assert.deepEqual(Object.keys(result.body.data[0]).sort(), [
      'createdAt',
      'email',
      'id',
      'isActive',
      'name',
      'organization',
      'phone',
      'role',
      'updatedAt'
    ]);
    assert.equal(JSON.stringify(result.body).includes('passwordHash'), false);
    assert.equal(JSON.stringify(result.body).includes('secret-hash'), false);
    assert.equal(result.body.data[0].token, undefined);
  });

  test('rejects invalid role and active-status filters', async () => {
    for (const url of ['/api/users?role=superuser', '/api/users?isActive=yes']) {
      const result = await request(app, {
        method: 'GET',
        url,
        headers: authHeader(adminToken)
      });
      assert.equal(result.statusCode, 400);
    }
  });

  test('activates and deactivates an account without changing its role', async () => {
    const target = addUser({ name: 'Managed Organizer', role: 'organizer', isActive: false });

    const activated = await request(app, {
      method: 'PATCH',
      url: `/api/users/${target.id}/status`,
      headers: authHeader(adminToken),
      body: { isActive: true, role: 'administrator' }
    });
    assert.equal(activated.statusCode, 200);
    assert.equal(activated.body.user.isActive, true);
    assert.equal(activated.body.user.role, 'organizer');

    const deactivated = await request(app, {
      method: 'PATCH',
      url: `/api/users/${target.id}/status`,
      headers: authHeader(adminToken),
      body: { isActive: false }
    });
    assert.equal(deactivated.statusCode, 200);
    assert.equal(deactivated.body.user.isActive, false);
    assert.equal(deactivated.body.user.role, 'organizer');
    assert.equal(target.passwordHash, 'secret-hash');
  });

  test('rejects invalid IDs, missing users, and non-boolean status values', async () => {
    const invalidId = await request(app, {
      method: 'PATCH',
      url: '/api/users/not-an-object-id/status',
      headers: authHeader(adminToken),
      body: { isActive: false }
    });
    assert.equal(invalidId.statusCode, 400);

    const missingUserId = new mongoose.Types.ObjectId().toString();
    const missing = await request(app, {
      method: 'PATCH',
      url: `/api/users/${missingUserId}/status`,
      headers: authHeader(adminToken),
      body: { isActive: false }
    });
    assert.equal(missing.statusCode, 404);

    const target = addUser();
    for (const body of [{ isActive: 'false' }, null]) {
      const invalidStatus = await request(app, {
        method: 'PATCH',
        url: `/api/users/${target.id}/status`,
        headers: authHeader(adminToken),
        body
      });
      assert.equal(invalidStatus.statusCode, 400);
    }
    assert.equal(target.isActive, true);
  });

  test('prevents self-deactivation and deactivation of the last active administrator', async () => {
    const selfDeactivation = await request(app, {
      method: 'PATCH',
      url: `/api/users/${admin.id}/status`,
      headers: authHeader(adminToken),
      body: { isActive: false }
    });
    assert.equal(selfDeactivation.statusCode, 400);

    const otherAdmin = addUser({ name: 'Second Admin', role: 'administrator' });
    const firstDeactivation = await request(app, {
      method: 'PATCH',
      url: `/api/users/${otherAdmin.id}/status`,
      headers: authHeader(adminToken),
      body: { isActive: false }
    });
    assert.equal(firstDeactivation.statusCode, 200);

    const soleActiveAdmin = makeUser({ role: 'administrator' });
    const response = {
      statusCode: 200,
      status(statusCode) {
        this.statusCode = statusCode;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      }
    };
    await updateUserStatus(
      {
        params: { id: soleActiveAdmin.id },
        body: { isActive: false },
        user: { id: otherAdmin.id },
        app: { locals: { mockUserStore: new Map([[soleActiveAdmin.id, soleActiveAdmin]]) } }
      },
      response,
      (error) => {
        throw error;
      }
    );

    assert.equal(response.statusCode, 409);
    assert.match(response.body.message, /last active administrator/i);
    assert.equal(soleActiveAdmin.isActive, true);
  });

  test('rejects an inactive user login after administrator deactivation', async () => {
    const inactiveUser = addUser({
      name: 'Inactive Account',
      email: 'inactive@example.com',
      role: 'participant',
      passwordHash: await bcrypt.hash('ValidPassword123', 4)
    });
    const userToken = tokenFor(inactiveUser);

    const deactivation = await request(app, {
      method: 'PATCH',
      url: `/api/users/${inactiveUser.id}/status`,
      headers: authHeader(adminToken),
      body: { isActive: false }
    });
    assert.equal(deactivation.statusCode, 200);

    const login = await request(app, {
      method: 'POST',
      url: '/api/auth/login',
      body: { email: inactiveUser.email, password: 'ValidPassword123' }
    });
    assert.equal(login.statusCode, 403);
    assert.match(login.body.message, /deactivated/i);

    const authenticatedRequest = await request(app, {
      method: 'GET',
      url: '/api/auth/me',
      headers: authHeader(userToken)
    });
    assert.equal(authenticatedRequest.statusCode, 403);
    assert.match(authenticatedRequest.body.message, /deactivated/i);
  });
});

describe('Administrator deactivation transaction wiring (stubbed Mongo models; not a concurrency integration test)', () => {
  test('serializes admin deactivation before counting active administrators in the transaction', async () => {
    const target = makeUser({ role: 'administrator' });
    const updatedUser = { ...target, isActive: false };
    const operations = [];
    const session = {
      startTransaction() {
        operations.push('start');
      },
      async commitTransaction() {
        operations.push('commit');
      },
      async abortTransaction() {
        operations.push('abort');
      },
      async endSession() {
        operations.push('end');
      }
    };

    const originalClient = mongoose.connection.client;
    const originalStartSession = mongoose.startSession;
    const originalFindById = User.findById;
    const originalFindOneAndUpdate = User.findOneAndUpdate;
    const originalCountDocuments = User.countDocuments;

    try {
      mongoose.connection.client = {
        topology: { description: { type: 'ReplicaSetWithPrimary' } }
      };
      mongoose.startSession = async () => session;
      User.findById = () => ({
        session: async (activeSession) => {
          assert.equal(activeSession, session);
          operations.push('read-target');
          return target;
        }
      });
      User.findOneAndUpdate = async (filter, update, options) => {
        assert.equal(options.session, session);
        if (update.$inc && update.$inc.__v === 1) {
          operations.push('serialize-admin');
          assert.deepEqual(filter, { role: 'administrator', isActive: true });
          assert.deepEqual(options.sort, { _id: 1 });
          assert.equal(options.timestamps, false);
          return target;
        }
        operations.push('deactivate-target');
        assert.equal(filter._id, target.id);
        assert.equal(filter.isActive, true);
        assert.deepEqual(update, { $set: { isActive: false } });
        return updatedUser;
      };
      User.countDocuments = (filter) => ({
        session: async (activeSession) => {
          assert.equal(activeSession, session);
          assert.deepEqual(filter, { role: 'administrator', isActive: true });
          operations.push('count-admins');
          return 2;
        }
      });

      const response = createMockResponse();
      await updateUserStatus(
        {
          params: { id: target.id },
          body: { isActive: false },
          user: { id: new mongoose.Types.ObjectId().toString() },
          app: { locals: {} }
        },
        response,
        (error) => {
          throw error;
        }
      );

      assert.equal(response.statusCode, 200);
      assert.equal(response.body.user.isActive, false);
      assert.ok(
        operations.indexOf('serialize-admin') < operations.indexOf('count-admins'),
        'The shared serialization write must happen before the active-admin count.'
      );
      assert.ok(
        operations.indexOf('count-admins') < operations.indexOf('deactivate-target'),
        'The target may be deactivated only after the transactional count check.'
      );
      assert.deepEqual(operations.slice(-2), ['commit', 'end']);
    } finally {
      mongoose.connection.client = originalClient;
      mongoose.startSession = originalStartSession;
      User.findById = originalFindById;
      User.findOneAndUpdate = originalFindOneAndUpdate;
      User.countDocuments = originalCountDocuments;
    }
  });
});
