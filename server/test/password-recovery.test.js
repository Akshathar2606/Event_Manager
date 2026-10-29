const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { request } = require('./testHelper');

describe('Password recovery', () => {
  let deliveries;

  beforeEach(() => {
    app.locals.mockUserStore = new Map();
    app.locals.mockRecoveryRateLimitStore = new Map();
    deliveries = [];
    app.locals.mockEmailSender = async (message) => deliveries.push(message);
  });

  const registerUser = async (overrides = {}) =>
    request(app, {
      method: 'POST',
      url: '/api/auth/register',
      body: {
        name: 'Recovery User',
        email: 'recovery@example.com',
        password: 'OriginalPassword1',
        role: 'organizer',
        ...overrides
      }
    });

  const requestReset = (email = 'recovery@example.com') =>
    request(app, {
      method: 'POST',
      url: '/api/auth/forgot-password',
      body: { email }
    });

  const deliverReset = async () => {
    const response = await requestReset();
    assert.equal(response.statusCode, 200);
    assert.equal(deliveries.length, 1);
    return deliveries[0].token;
  };

  const resetPassword = (token, newPassword = 'ChangedPassword2') =>
    request(app, {
      method: 'POST',
      url: '/api/auth/reset-password',
      body: { token, newPassword }
    });

  test('validates missing, malformed, and non-object forgot-password requests', async () => {
    for (const body of [undefined, null, {}, { email: 'invalid' }]) {
      const response = await request(app, {
        method: 'POST',
        url: '/api/auth/forgot-password',
        body
      });
      assert.equal(response.statusCode, 400);
      assert.equal(response.body.success, false);
    }
    assert.equal(deliveries.length, 0);
  });

  test('unknown and known addresses receive the same generic response', async () => {
    await registerUser();
    const known = await requestReset();
    const unknown = await requestReset('unknown@example.com');

    assert.equal(known.statusCode, 200);
    assert.equal(unknown.statusCode, 200);
    assert.deepEqual(known.body, unknown.body);
    assert.equal(deliveries.length, 1);
  });

  test('fails closed with an account-neutral response when SMTP configuration is missing', async () => {
    await registerUser();
    app.locals.mockEmailSender = undefined;
    const configKeys = [
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_SECURE',
      'SMTP_USER',
      'SMTP_PASS',
      'EMAIL_FROM',
      'CLIENT_BASE_URL'
    ];
    const previousValues = new Map(configKeys.map((key) => [key, process.env[key]]));
    for (const key of configKeys) delete process.env[key];

    try {
      const response = await requestReset();
      assert.equal(response.statusCode, 503);
      assert.equal(response.body.success, false);
      assert.match(response.body.message, /temporarily unavailable/i);
      assert.equal(deliveries.length, 0);
    } finally {
      for (const [key, value] of previousValues) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  test('generates a high-entropy token, stores only its hash, and sends it to the account', async () => {
    await registerUser();
    const response = await requestReset(' RECOVERY@example.com ');
    const [email] = deliveries;
    const account = Array.from(app.locals.mockUserStore.values())[0];

    assert.equal(response.statusCode, 200);
    assert.equal(email.email, 'recovery@example.com');
    assert.equal(email.token.length, 64);
    assert.match(email.token, /^[a-f0-9]{64}$/);
    assert.equal(
      account.passwordResetTokenHash,
      crypto.createHash('sha256').update(email.token).digest('hex')
    );
    assert.notEqual(account.passwordResetTokenHash, email.token);
    assert.equal(account.passwordResetExpires.getTime() - Date.now() <= 15 * 60 * 1000, true);
  });

  test('rejects invalid token formats and weak passwords without changing the account', async () => {
    await registerUser();
    const original = Array.from(app.locals.mockUserStore.values())[0].passwordHash;
    const malformed = await resetPassword('not-a-token', 'Weak1');
    const weak = await resetPassword(crypto.randomBytes(32).toString('hex'), 'short');

    assert.equal(malformed.statusCode, 400);
    assert.equal(weak.statusCode, 400);
    assert.equal(Array.from(app.locals.mockUserStore.values())[0].passwordHash, original);
  });

  test('rejects invalid and expired reset tokens with safe token states', async () => {
    await registerUser();
    const invalid = await resetPassword(crypto.randomBytes(32).toString('hex'));
    assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.body.code, 'RESET_TOKEN_INVALID');

    const token = await deliverReset();
    const account = Array.from(app.locals.mockUserStore.values())[0];
    account.passwordResetExpires = new Date(Date.now() - 1);
    const expired = await resetPassword(token);
    assert.equal(expired.statusCode, 410);
    assert.equal(expired.body.code, 'RESET_TOKEN_EXPIRED');
  });

  test('a newer recovery request invalidates the previously issued token', async () => {
    await registerUser();
    const firstToken = await deliverReset();
    const secondRequest = await requestReset();
    const secondToken = deliveries[1].token;
    const firstReset = await resetPassword(firstToken);
    const secondReset = await resetPassword(secondToken);

    assert.equal(secondRequest.statusCode, 200);
    assert.equal(firstReset.statusCode, 400);
    assert.equal(secondReset.statusCode, 200);
  });

  test('consumes a token once, hashes the new password, preserves role and status, and revokes existing JWTs', async () => {
    const registration = await registerUser();
    const token = await deliverReset();
    const account = Array.from(app.locals.mockUserStore.values())[0];
    const originalRole = account.role;
    const originalStatus = account.isActive;

    const first = await resetPassword(token);
    const second = await resetPassword(token);
    const oldSession = await request(app, {
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${registration.body.token}` }
    });

    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 400);
    assert.equal(account.passwordHash === 'ChangedPassword2', false);
    assert.equal(await bcrypt.compare('ChangedPassword2', account.passwordHash), true);
    assert.equal(account.passwordResetTokenHash, undefined);
    assert.equal(account.passwordResetExpires, undefined);
    assert.equal(account.role, originalRole);
    assert.equal(account.isActive, originalStatus);
    assert.equal(account.authVersion, 1);
    assert.equal(oldSession.statusCode, 401);
  });

  test('allows only one concurrent reset request to consume a token in the mock store', async () => {
    await registerUser();
    const token = await deliverReset();
    const results = await Promise.all([
      resetPassword(token, 'ConcurrentPassword1'),
      resetPassword(token, 'ConcurrentPassword2')
    ]);

    assert.deepEqual(results.map((result) => result.statusCode).sort(), [200, 400]);
  });

  test('email delivery failure invalidates the issued token and keeps response account-neutral', async () => {
    await registerUser();
    app.locals.mockEmailSender = async () => {
      throw new Error('transport failure');
    };

    const response = await requestReset();
    const account = Array.from(app.locals.mockUserStore.values())[0];
    assert.equal(response.statusCode, 200);
    assert.match(response.body.message, /If an active account matches/i);
    assert.equal(account.passwordResetTokenHash, undefined);
    assert.equal(account.passwordResetExpires, undefined);
  });

  test('limits password-recovery requests by client and endpoint', async () => {
    const results = [];
    for (let index = 0; index < 6; index += 1) {
      results.push(await requestReset('unknown@example.com'));
    }
    assert.deepEqual(results.slice(0, 5).map((result) => result.statusCode), [200, 200, 200, 200, 200]);
    assert.equal(results[5].statusCode, 429);
    assert.equal(results[5].body.code, 'RATE_LIMITED');
  });
});
