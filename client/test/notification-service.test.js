import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import api from '../src/services/api.js';
import { notificationService } from '../src/services/notificationService.js';
import { eventService } from '../src/services/eventService.js';

describe('Notification and event activity services', () => {
  const originalGet = api.get;
  const originalPatch = api.patch;
  let requests;

  beforeEach(() => {
    requests = [];
    api.get = async (url, config) => {
      requests.push({ method: 'GET', url, config });
      if (url.endsWith('/unread-count')) return { data: { success: true, data: { count: 4 } } };
      return { data: { success: true, data: [], pagination: { total: 0, page: 1, pages: 1, limit: 20 } } };
    };
    api.patch = async (url) => {
      requests.push({ method: 'PATCH', url });
      return { data: { success: true, data: { modifiedCount: 1 } } };
    };
  });

  afterEach(() => {
    api.get = originalGet;
    api.patch = originalPatch;
  });

  test('lists notifications with pagination and requests the authenticated unread count', async () => {
    const result = await notificationService.getNotifications({ page: 2, limit: 10, unread: true });
    const count = await notificationService.getUnreadCount();

    assert.equal(result.success, true);
    assert.equal(requests[0].url, '/notifications');
    assert.deepEqual(requests[0].config.params, { page: 2, limit: 10, unread: true });
    assert.equal(requests[1].url, '/notifications/unread-count');
    assert.equal(count, 4);
  });

  test('marks one and all notifications read through the authenticated endpoints', async () => {
    await notificationService.markRead('notification-id');
    await notificationService.markAllRead();
    assert.deepEqual(requests, [
      { method: 'PATCH', url: '/notifications/notification-id/read' },
      { method: 'PATCH', url: '/notifications/read-all' }
    ]);
  });

  test('retrieves protected event activity with pagination parameters', async () => {
    await eventService.getEventActivity('event-id', { page: 1, limit: 15 });
    assert.equal(requests[0].url, '/events/event-id/activity');
    assert.deepEqual(requests[0].config.params, { page: 1, limit: 15 });
  });
});
