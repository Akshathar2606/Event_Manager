import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import api from '../src/services/api.js';
import { adminUserService } from '../src/services/adminUserService.js';
import {
  buildUserDirectoryParams,
  executeUserStatusChange,
  formatUserCreationDate,
  getUserDirectoryNavigation,
  getUserDirectoryView,
  isCurrentAdminAccount
} from '../src/utils/adminUserUtils.js';

describe('Administrator user service and page behavior helpers', () => {
  let interceptedRequest;
  let originalGet;
  let originalPatch;

  beforeEach(() => {
    interceptedRequest = null;
    originalGet = api.get;
    originalPatch = api.patch;
  });

  afterEach(() => {
    api.get = originalGet;
    api.patch = originalPatch;
  });

  test('lists users using the backend filters and preserves pagination metadata', async () => {
    const pagination = { total: 27, page: 2, pages: 3, limit: 10 };
    const data = [{ id: 'user-11', name: 'Jordan User', role: 'participant', isActive: true }];
    api.get = async (url, config) => {
      interceptedRequest = { method: 'GET', url, config };
      return { data: { success: true, count: 1, pagination, data } };
    };

    const result = await adminUserService.getUsers({
      search: 'Jordan',
      role: 'participant',
      isActive: 'true',
      page: 2,
      limit: 10,
      emptyFilter: '',
      unused: undefined
    });

    assert.equal(interceptedRequest.url, '/users');
    assert.deepEqual(interceptedRequest.config.params, {
      search: 'Jordan',
      role: 'participant',
      isActive: 'true',
      page: 2,
      limit: 10
    });
    assert.equal(result.pagination, pagination);
    assert.equal(result.data, data);
  });

  test('updates only account active status at the existing status endpoint', async () => {
    const responseBody = {
      success: true,
      message: 'User account deactivated successfully.',
      user: { id: 'user-1', role: 'organizer', isActive: false }
    };
    api.patch = async (url, data) => {
      interceptedRequest = { method: 'PATCH', url, data };
      return { data: responseBody };
    };

    const result = await adminUserService.updateUserStatus('user-1', false);

    assert.deepEqual(interceptedRequest, {
      method: 'PATCH',
      url: '/users/user-1/status',
      data: { isActive: false }
    });
    assert.equal(result, responseBody);
  });

  test('propagates API errors unchanged for the shared error-message convention', async () => {
    const apiError = { response: { data: { message: 'The last active administrator cannot be deactivated.' } } };
    api.patch = async () => {
      throw apiError;
    };

    await assert.rejects(adminUserService.updateUserStatus('admin-2', false), (error) => {
      assert.equal(error, apiError);
      return true;
    });
  });

  test('identifies the signed-in administrator case-insensitively and formats supplied dates safely', () => {
    assert.equal(
      isCurrentAdminAccount({ id: 'ABCDEF0123456789ABCDEF01' }, { id: 'abcdef0123456789abcdef01' }),
      true
    );
    assert.equal(isCurrentAdminAccount({ id: 'another-user' }, { id: 'current-admin' }), false);
    assert.equal(formatUserCreationDate(null), '—');
    assert.equal(formatUserCreationDate('not-a-date'), '—');
    assert.notEqual(formatUserCreationDate('2026-01-15T12:00:00.000Z'), '—');
  });

  test('builds search/filter parameters and clamps server-backed pagination controls', () => {
    assert.deepEqual(
      buildUserDirectoryParams({
        page: 2,
        limit: 10,
        search: '  Riley  ',
        role: 'organizer',
        isActive: 'false'
      }),
      { page: 2, limit: 10, search: 'Riley', role: 'organizer', isActive: 'false' }
    );
    assert.deepEqual(getUserDirectoryNavigation({ page: 1, pages: 4 }), {
      previousPage: 1,
      nextPage: 2
    });
    assert.deepEqual(getUserDirectoryNavigation({ page: 4, pages: 4 }), {
      previousPage: 3,
      nextPage: 4
    });
  });

  test('selects loading, error, empty, and list states in priority order', () => {
    assert.equal(getUserDirectoryView({ loading: true, error: 'failed', users: [] }), 'loading');
    assert.equal(getUserDirectoryView({ loading: false, error: 'failed', users: [] }), 'error');
    assert.equal(getUserDirectoryView({ loading: false, error: null, users: [] }), 'empty');
    assert.equal(getUserDirectoryView({ loading: false, error: null, users: [{ id: 'u1' }] }), 'list');
  });

  test('activates and deactivates using the server response, then releases the action lock', async () => {
    const inProgress = { current: false };
    const updates = [];
    const successes = [];
    let finished = 0;
    const onSuccess = async (response) => successes.push(response);
    const updateStatus = async (id, isActive) => {
      updates.push({ id, isActive });
      return { success: true, user: { id, isActive, role: 'participant' } };
    };

    const activation = await executeUserStatusChange({
      account: { id: 'user-1' },
      isActive: true,
      inProgress,
      updateStatus,
      onSuccess,
      onError: assert.fail,
      onFinally: () => { finished += 1; }
    });
    const deactivation = await executeUserStatusChange({
      account: { id: 'user-1' },
      isActive: false,
      inProgress,
      updateStatus,
      onSuccess,
      onError: assert.fail,
      onFinally: () => { finished += 1; }
    });

    assert.equal(activation, true);
    assert.equal(deactivation, true);
    assert.deepEqual(updates, [
      { id: 'user-1', isActive: true },
      { id: 'user-1', isActive: false }
    ]);
    assert.deepEqual(successes.map((item) => item.user.isActive), [true, false]);
    assert.equal(finished, 2);
    assert.equal(inProgress.current, false);
  });

  test('surfaces failed status updates and does not report success', async () => {
    const inProgress = { current: false };
    const expectedError = new Error('The last active administrator cannot be deactivated.');
    let reportedError;
    let successCalled = false;
    let finished = false;

    const result = await executeUserStatusChange({
      account: { id: 'admin-2' },
      isActive: false,
      inProgress,
      updateStatus: async () => { throw expectedError; },
      onSuccess: () => { successCalled = true; },
      onError: (error) => { reportedError = error; },
      onFinally: () => { finished = true; }
    });

    assert.equal(result, false);
    assert.equal(reportedError, expectedError);
    assert.equal(successCalled, false);
    assert.equal(finished, true);
    assert.equal(inProgress.current, false);
  });

  test('prevents duplicate submissions while a status update is pending', async () => {
    const inProgress = { current: false };
    let resolveUpdate;
    let calls = 0;
    const pending = new Promise((resolve) => { resolveUpdate = resolve; });
    const options = {
      account: { id: 'user-1' },
      isActive: false,
      inProgress,
      updateStatus: async () => {
        calls += 1;
        return pending;
      },
      onSuccess: async () => {},
      onError: assert.fail
    };

    const firstSubmission = executeUserStatusChange(options);
    const duplicateSubmission = await executeUserStatusChange(options);
    assert.equal(duplicateSubmission, false);
    assert.equal(calls, 1);
    assert.equal(inProgress.current, true);

    resolveUpdate({ success: true, user: { id: 'user-1', isActive: false } });
    assert.equal(await firstSubmission, true);
    assert.equal(inProgress.current, false);
  });
});
