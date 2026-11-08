import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPostLoginPath,
  getRoleHomePath,
  hasAllowedRole
} from '../src/utils/roles.js';
import { authService, extractErrorMessage } from '../src/services/authService.js';
import api, { getStoredToken, setStoredToken, clearStoredToken } from '../src/services/api.js';
import {
  isThemePreference,
  readThemePreference,
  resolveTheme,
  writeThemePreference
} from '../src/utils/theme.js';

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

    test('routes pending and rejected vendors to application status instead of vendor tools', () => {
      for (const status of ['pending', 'rejected']) {
        assert.equal(getRoleHomePath('vendor', status), '/vendor/application-status');
        assert.equal(
          getPostLoginPath('vendor', '/vendor/profile', status),
          '/vendor/application-status'
        );
      }
      assert.equal(getRoleHomePath('vendor', 'approved'), '/vendor');
    });

    test('login destination selects each authenticated role dashboard', () => {
      for (const [role, destination] of [
        ['organizer', '/organizer'],
        ['participant', '/participant'],
        ['administrator', '/admin'],
        ['vendor', '/vendor']
      ]) {
        assert.equal(getPostLoginPath(role, undefined), destination);
      }
    });

    test('login preserves a protected destination, including a forbidden one that remains role-guarded', () => {
      assert.equal(getPostLoginPath('organizer', '/organizer/events'), '/organizer/events');
      assert.equal(getPostLoginPath('organizer', '/participant'), '/participant');
      assert.equal(
        hasAllowedRole('organizer', ['participant', 'administrator']),
        false
      );
    });

    test('dashboard and access checks normalize role casing without changing role grants', () => {
      assert.equal(getRoleHomePath(' Organizer '), '/organizer');
      assert.equal(hasAllowedRole('ORGANIZER', ['organizer']), true);
      assert.equal(hasAllowedRole('ORGANIZER', ['participant']), false);
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

    describe('Theme preferences', () => {
      test('supports light, dark, and system preference resolution', () => {
        assert.equal(resolveTheme('light', true), 'light');
        assert.equal(resolveTheme('dark', false), 'dark');
        assert.equal(resolveTheme('system', true), 'dark');
        assert.equal(resolveTheme('system', false), 'light');
        assert.equal(isThemePreference('system'), true);
        assert.equal(isThemePreference('sepia'), false);
      });

      test('persists and restores a valid theme preference', () => {
        const themeStorage = new Map();
        const storage = {
          getItem: (key) => themeStorage.get(key) ?? null,
          setItem: (key, value) => themeStorage.set(key, value)
        };

        writeThemePreference(storage, 'dark');
        assert.equal(themeStorage.get('eventflow_theme'), 'dark');
        assert.equal(readThemePreference(storage), 'dark');
        themeStorage.set('eventflow_theme', 'invalid');
        assert.equal(readThemePreference(storage), 'system');
      });
    });

    test('updates only the current authenticated profile endpoint', async () => {
      let request = null;
      api.patch = async (url, data) => {
        request = { url, data };
        return { data: { success: true, user: { id: 'user-1', name: 'Jordan Lee' } } };
      };

      const profileData = { firstName: 'Jordan', lastName: 'Lee', interests: ['Design'] };
      const user = await authService.updateMyProfile(profileData);
      assert.deepEqual(request, { url: '/auth/me', data: profileData });
      assert.equal(user.name, 'Jordan Lee');
    });

    test('registration submits vendor business information through the existing auth endpoint', async () => {
      const originalPost = api.post;
      let request = null;
      const vendorApplication = {
        businessName: 'Campus Kitchen',
        businessCategory: 'Catering',
        businessDescription: 'Fresh meals for campus events and gatherings.',
        contactNumber: '5551234567',
        city: 'Springfield',
        locality: 'Downtown',
        servicesOffered: ['Catering']
      };
      api.post = async (url, data) => {
        request = { url, data };
        return {
          data: {
            token: 'vendor-token',
            user: { id: 'vendor-1', role: 'vendor', vendorApplicationStatus: 'pending' }
          }
        };
      };

      try {
        const result = await authService.register({
          name: 'Taylor Vendor',
          email: 'vendor@example.com',
          password: 'VendorPassword123',
          role: 'vendor',
          vendorApplication
        });
        assert.equal(result.user.vendorApplicationStatus, 'pending');
        assert.deepEqual(request, {
          url: '/auth/register',
          data: {
            name: 'Taylor Vendor',
            email: 'vendor@example.com',
            password: 'VendorPassword123',
            role: 'vendor',
            phone: undefined,
            organization: undefined,
            vendorApplication
          }
        });
      } finally {
        api.post = originalPost;
      }
    });
  });
});
