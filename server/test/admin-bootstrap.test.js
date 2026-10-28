const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  BootstrapError,
  createInitialAdmin,
  validateBootstrapInput
} = require('../scripts/bootstrap-admin');

const validInput = {
  name: 'Initial Administrator',
  email: 'Admin@Example.com',
  password: 'StrongPass123'
};

const createSession = (operations) => ({
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
});

const createFindOneModel = (findOne) => ({
  findOne(filter) {
    return {
      session: async (session) => findOne(filter, session)
    };
  }
});

describe('Initial administrator bootstrap (mock-model tests; no MongoDB/Atlas access)', () => {
  test('normalizes email and validates name, email, and password without echoing credentials', () => {
    assert.deepEqual(validateBootstrapInput(validInput), {
      name: 'Initial Administrator',
      email: 'admin@example.com',
      password: 'StrongPass123'
    });
    assert.equal(
      validateBootstrapInput({ email: 'admin@example.com', password: 'StrongPass123' }).name,
      'EventFlow Administrator'
    );

    for (const input of [
      { ...validInput, email: 'not-an-email' },
      { ...validInput, password: 'short1' },
      { ...validInput, password: 'lettersOnly' },
      { ...validInput, password: `A1${'x'.repeat(71)}` }
    ]) {
      assert.throws(() => validateBootstrapInput(input), BootstrapError);
    }
  });

  test('refuses bootstrap when an active administrator already exists', async () => {
    const operations = [];
    const session = createSession(operations);
    const UserModel = createFindOneModel((filter) => {
      operations.push(filter.role ? 'check-admin' : 'check-email');
      return filter.role === 'administrator' ? { role: 'administrator' } : null;
    });
    const BootstrapStateModel = {
      async create(_documents, options) {
        assert.equal(options.session, session);
        operations.push('claim-bootstrap');
      }
    };

    await assert.rejects(
      createInitialAdmin({
        input: validInput,
        UserModel,
        BootstrapStateModel,
        startSession: async () => session
      }),
      { code: 'ACTIVE_ADMIN_EXISTS' }
    );
    assert.deepEqual(operations, ['start', 'claim-bootstrap', 'check-admin', 'abort', 'end']);
  });

  test('refuses duplicate email and rolls back the one-time marker', async () => {
    const operations = [];
    const session = createSession(operations);
    const UserModel = createFindOneModel((filter) => {
      operations.push(filter.role ? 'check-admin' : 'check-email');
      return filter.email ? { email: filter.email } : null;
    });
    const BootstrapStateModel = {
      async create() {
        operations.push('claim-bootstrap');
      }
    };

    await assert.rejects(
      createInitialAdmin({
        input: validInput,
        UserModel,
        BootstrapStateModel,
        startSession: async () => session
      }),
      { code: 'DUPLICATE_EMAIL' }
    );
    assert.deepEqual(operations, [
      'start',
      'claim-bootstrap',
      'check-admin',
      'check-email',
      'abort',
      'end'
    ]);
  });

  test('hashes the password and creates one administrator within the one-time transaction', async () => {
    const operations = [];
    const session = createSession(operations);
    let createdUser;
    let createdMarker;
    const UserModel = {
      ...createFindOneModel(() => {
        operations.push('check');
        return null;
      }),
      async create(documents, options) {
        assert.equal(options.session, session);
        createdUser = documents[0];
        operations.push('create-user');
      }
    };
    const BootstrapStateModel = {
      async create(documents, options) {
        assert.equal(options.session, session);
        createdMarker = documents[0];
        operations.push('claim-bootstrap');
      }
    };

    await createInitialAdmin({
      input: validInput,
      UserModel,
      BootstrapStateModel,
      startSession: async () => session,
      hashPassword: async (password) => {
        assert.equal(password, validInput.password);
        operations.push('hash-password');
        return 'test-hash-not-a-real-credential';
      }
    });

    assert.equal(createdMarker._id, 'initial-administrator-created');
    assert.equal(createdUser.name, validInput.name);
    assert.equal(createdUser.email, 'admin@example.com');
    assert.equal(createdUser.role, 'administrator');
    assert.equal(createdUser.isActive, true);
    assert.equal(createdUser.passwordHash, 'test-hash-not-a-real-credential');
    assert.deepEqual(operations, [
      'start',
      'claim-bootstrap',
      'check',
      'check',
      'hash-password',
      'create-user',
      'commit',
      'end'
    ]);
  });

  test('retries transient transaction failures and repeats bootstrap checks', async () => {
    const operations = [];
    let sessionAttempt = 0;
    let queryAttempt = 0;
    const session = {
      startTransaction() {
        sessionAttempt += 1;
        operations.push(`start-${sessionAttempt}`);
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
    const UserModel = {
      findOne(filter) {
        return {
          session: async () => {
            operations.push(filter.role ? `check-admin-${sessionAttempt}` : `check-email-${sessionAttempt}`);
            if (filter.email) queryAttempt += 1;
            if (filter.role && sessionAttempt === 1) {
              const error = new Error('transaction conflict');
              error.hasErrorLabel = (label) => label === 'TransientTransactionError';
              throw error;
            }
            return null;
          }
        };
      },
      async create(_documents, options) {
        assert.equal(options.session, session);
        operations.push('create-user');
      }
    };
    const BootstrapStateModel = {
      async create(_documents, options) {
        assert.equal(options.session, session);
        operations.push(`claim-bootstrap-${sessionAttempt}`);
      }
    };

    await createInitialAdmin({
      input: validInput,
      UserModel,
      BootstrapStateModel,
      startSession: async () => session,
      hashPassword: async () => 'test-hash-not-a-real-credential'
    });

    assert.equal(queryAttempt, 1);
    assert.ok(operations.includes('claim-bootstrap-2'));
    assert.ok(operations.includes('check-admin-2'));
    assert.ok(operations.includes('check-email-2'));
    assert.deepEqual(operations.slice(0, 7), [
      'start-1',
      'claim-bootstrap-1',
      'check-admin-1',
      'abort',
      'start-2',
      'claim-bootstrap-2',
      'check-admin-2'
    ]);
    assert.deepEqual(operations.slice(-3), ['create-user', 'commit', 'end']);
  });
});
