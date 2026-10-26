import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { eventService, EVENT_CATEGORIES, EVENT_STATUS } from '../src/services/eventService.js';
import api from '../src/services/api.js';

describe('Frontend Event Service & Parameter Serialization Tests', () => {
  let interceptedRequest = null;

  beforeEach(() => {
    interceptedRequest = null;

    api.get = async (url, config) => {
      interceptedRequest = { method: 'GET', url, config };
      if (url.startsWith('/events/')) {
        return {
          data: {
            success: true,
            data: { id: 'evt_101', title: 'Campus Hackathon', capacity: 150, status: 'published' }
          }
        };
      }
      return {
        data: {
          success: true,
          count: 1,
          pagination: { total: 1, page: 1, pages: 1, limit: 10 },
          data: [{ id: 'evt_101', title: 'Campus Hackathon', capacity: 150, status: 'published' }]
        }
      };
    };

    api.post = async (url, data) => {
      interceptedRequest = { method: 'POST', url, data };
      return { data: { success: true, message: 'Event created successfully.', data } };
    };

    api.put = async (url, data) => {
      interceptedRequest = { method: 'PUT', url, data };
      return { data: { success: true, message: 'Event updated successfully.', data } };
    };

    api.patch = async (url, data) => {
      interceptedRequest = { method: 'PATCH', url, data };
      return { data: { success: true, message: 'Status updated', data } };
    };

    api.delete = async (url) => {
      interceptedRequest = { method: 'DELETE', url };
      return { data: { success: true, message: 'Event archived successfully.' } };
    };
  });

  test('1. EVENT_CATEGORIES and EVENT_STATUS export expected collegiate standards', () => {
    assert.ok(Array.isArray(EVENT_CATEGORIES));
    assert.ok(EVENT_CATEGORIES.includes('academic'));
    assert.ok(EVENT_CATEGORIES.includes('cultural'));
    assert.ok(EVENT_CATEGORIES.includes('technical'));
    assert.ok(EVENT_CATEGORIES.includes('workshop'));

    assert.ok(Array.isArray(EVENT_STATUS));
    assert.ok(EVENT_STATUS.includes('draft'));
    assert.ok(EVENT_STATUS.includes('published'));
    assert.ok(EVENT_STATUS.includes('cancelled'));
  });

  test('2. getEvents cleans empty parameters and serializes tags array', async () => {
    await eventService.getEvents({
      search: 'Hackathon',
      category: 'technical',
      status: 'draft',
      organizer: 'me',
      tags: ['coding', 'ai'],
      emptyParam: '',
      nullParam: null,
      undefinedParam: undefined
    });

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.method, 'GET');
    assert.equal(interceptedRequest.url, '/events');
    const params = interceptedRequest.config.params;
    assert.equal(params.search, 'Hackathon');
    assert.equal(params.category, 'technical');
    assert.equal(params.status, 'draft');
    assert.equal(params.organizer, 'me');
    assert.equal(params.tags, 'coding,ai');
    assert.equal(params.emptyParam, undefined);
    assert.equal(params.nullParam, undefined);
    assert.equal(params.undefinedParam, undefined);
  });

  test('3. getEventById requests correct URL endpoint with ID', async () => {
    const eventId = '671e0f1234567890abcdef77';
    const res = await eventService.getEventById(eventId);

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.method, 'GET');
    assert.equal(interceptedRequest.url, `/events/${eventId}`);
    assert.equal(res.id, 'evt_101');
  });

  test('4. createEvent sends payload to POST /events', async () => {
    const payload = {
      title: 'Spring Tech Symposium',
      description: 'Annual research gathering',
      category: 'academic',
      startDateTime: '2026-11-20T09:00:00Z',
      endDateTime: '2026-11-20T17:00:00Z',
      capacity: 120
    };

    const res = await eventService.createEvent(payload);

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.method, 'POST');
    assert.equal(interceptedRequest.url, '/events');
    assert.deepEqual(interceptedRequest.data, payload);
    assert.equal(res.success, true);
  });

  test('5. updateEvent sends payload to PUT /events/:id', async () => {
    const eventId = 'evt_101';
    const payload = {
      title: 'Updated Tech Symposium',
      capacity: 150
    };

    const res = await eventService.updateEvent(eventId, payload);

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.method, 'PUT');
    assert.equal(interceptedRequest.url, `/events/${eventId}`);
    assert.deepEqual(interceptedRequest.data, payload);
    assert.equal(res.success, true);
  });

  test('6. updateEventStatus sends status payload to PATCH /events/:id/status', async () => {
    const eventId = 'evt_101';
    const res = await eventService.updateEventStatus(eventId, 'published');

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.method, 'PATCH');
    assert.equal(interceptedRequest.url, `/events/${eventId}/status`);
    assert.deepEqual(interceptedRequest.data, { status: 'published' });
    assert.equal(res.success, true);
  });

  test('7. deleteEvent calls DELETE /events/:id for safe archival', async () => {
    const eventId = 'evt_101';
    const res = await eventService.deleteEvent(eventId);

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.method, 'DELETE');
    assert.equal(interceptedRequest.url, `/events/${eventId}`);
    assert.equal(res.success, true);
  });
});
