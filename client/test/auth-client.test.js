import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getRoleHomePath } from '../src/utils/roles.js';
import { extractErrorMessage } from '../src/services/authService.js';
import { getStoredToken, setStoredToken, clearStoredToken } from '../src/services/api.js';

// Setup mock sessionStorage for Node.js test environment
const mockStorage = new Map();
global.sessionStorage = {
  getItem: (key) => (mockStorage.has(key) ? mockStorage.get(key) : null),
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
};

describe('Client-Side Auth & Navigation Unit Tests', () => {
  beforeEach(() => {
    global.sessionStorage.clear();
    clearStoredToken();
  });

  describe('Role-based navigation path resolver (getRoleHomePath)', () => {
    test('resolves administrator to /admin', () => {
      assert.equal(getRoleHomePath('administrator'), '/admin');
    });

    test('resolves organizer to /organizer', () => {
      assert.equal(getRoleHomePath('organizer'), '/organizer');
    });

    test('resolves participant to /participant', () => {
      assert.equal(getRoleHomePath('participant'), '/participant');
    });

    test('resolves vendor to /vendor', () => {
      assert.equal(getRoleHomePath('vendor'), '/vendor');
    });

    test('defaults unknown or null role to /participant', () => {
      assert.equal(getRoleHomePath(null), '/participant');
      assert.equal(getRoleHomePath(undefined), '/participant');
      assert.equal(getRoleHomePath('unknown_role'), '/participant');
    });
  });

  describe('Token storage & session isolation', () => {
    test('stores and retrieves token from memory and sessionStorage', () => {
      const mockJwt = 'mock.jwt.token';
      setStoredToken(mockJwt);
      assert.equal(getStoredToken(), mockJwt);
      assert.equal(global.sessionStorage.getItem('eventflow_auth_token'), mockJwt);
    });

    test('clears token from memory and sessionStorage on logout', () => {
      setStoredToken('sample.token');
      assert.equal(getStoredToken(), 'sample.token');

      clearStoredToken();
      assert.equal(getStoredToken(), null);
      assert.equal(global.sessionStorage.getItem('eventflow_auth_token'), null);
    });
  });

  describe('API error extractor (extractErrorMessage)', () => {
    test('extracts server response error message', () => {
      const err = { response: { data: { message: 'Invalid credentials provided' } } };
      assert.equal(extractErrorMessage(err), 'Invalid credentials provided');
    });

    test('extracts validation error from errors array', () => {
      const err = { response: { data: { errors: ['Password must be at least 8 characters'] } } };
      assert.equal(extractErrorMessage(err), 'Password must be at least 8 characters');
    });

    test('handles network disconnection gracefully', () => {
      const err = new Error('Network Error');
      assert.match(extractErrorMessage(err), /Unable to connect to the server/i);
    });

    test('falls back to default message if no error response', () => {
      assert.equal(extractErrorMessage(null, 'Custom fallback'), 'Custom fallback');
    });
  });
});
