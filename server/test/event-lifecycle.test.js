const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  DAY_IN_MILLISECONDS,
  getEventEndDateTime,
  getEventLifecycleStatus,
  getEventLifecycleQuery
} = require('../src/utils/eventLifecycle');
const { Event } = require('../src/models/Event');
const { validateEventInput } = require('../src/utils/eventValidation');

describe('Event lifecycle calculation', () => {
  const now = new Date('2026-11-05T12:00:00.000Z');

  test('classifies future published events as upcoming', () => {
    assert.equal(getEventLifecycleStatus({
      status: 'published',
      startDateTime: '2026-11-06T09:00:00.000Z',
      endDateTime: '2026-11-06T10:00:00.000Z'
    }, now), 'upcoming');
  });

  test('classifies events in progress and events ending at the current instant as ongoing', () => {
    assert.equal(getEventLifecycleStatus({
      status: 'published',
      startDateTime: '2026-11-05T11:00:00.000Z',
      endDateTime: '2026-11-05T13:00:00.000Z'
    }, now), 'ongoing');
    assert.equal(getEventLifecycleStatus({
      status: 'published',
      startDateTime: '2026-11-05T11:00:00.000Z',
      endDateTime: now
    }, now), 'ongoing');
  });

  test('classifies events ending earlier today as completed, not by registration deadline', () => {
    assert.equal(getEventLifecycleStatus({
      status: 'published',
      startDateTime: '2026-11-05T08:00:00.000Z',
      endDateTime: '2026-11-05T10:00:00.000Z',
      registrationDeadline: '2026-11-04T10:00:00.000Z'
    }, now), 'completed');
  });

  test('uses the 24-hour fallback when an event has no explicit end timestamp', () => {
    const event = {
      status: 'published',
      startDateTime: '2026-11-04T12:00:00.000Z'
    };
    assert.equal(getEventEndDateTime(event).toISOString(), '2026-11-05T12:00:00.000Z');
    assert.equal(getEventLifecycleStatus(event, new Date(now.getTime() - 1)), 'ongoing');
    assert.equal(getEventLifecycleStatus(event, now), 'ongoing');
    assert.equal(getEventLifecycleStatus(event, new Date(now.getTime() + 1)), 'completed');
    assert.equal(DAY_IN_MILLISECONDS, 24 * 60 * 60 * 1000);
  });

  test('allows an event without a stored end time and leaves lifecycle to the fallback rule', () => {
    const input = {
      title: 'Single Day Event',
      description: 'An event with no separate end time.',
      category: 'academic',
      startDateTime: '2026-11-05T09:00:00.000Z',
      capacity: 40
    };
    const validation = validateEventInput(input);
    assert.equal(validation.isValid, true, validation.errors.join(', '));

    const event = new Event({
      ...input,
      organizer: '671e0f1234567890abcdef77'
    });
    assert.equal(event.validateSync(), undefined);
  });

  test('preserves explicit draft and cancelled states regardless of schedule', () => {
    for (const status of ['draft', 'cancelled']) {
      assert.equal(getEventLifecycleStatus({
        status,
        startDateTime: '2026-11-01T10:00:00.000Z',
        endDateTime: '2026-11-01T11:00:00.000Z'
      }, now), status);
    }
  });

  test('compares timezone-offset timestamps as absolute instants across daylight-saving boundaries', () => {
    assert.equal(getEventLifecycleStatus({
      status: 'published',
      startDateTime: '2026-11-01T01:15:00-04:00',
      endDateTime: '2026-11-01T01:45:00-04:00'
    }, new Date('2026-11-01T05:30:00.000Z')), 'ongoing');
    assert.equal(getEventLifecycleStatus({
      status: 'published',
      startDateTime: '2026-11-01T01:15:00-05:00',
      endDateTime: '2026-11-01T01:45:00-05:00'
    }, new Date('2026-11-01T05:30:00.000Z')), 'upcoming');
  });

  test('builds filters for each derived lifecycle state', () => {
    assert.deepEqual(getEventLifecycleQuery('upcoming', now), {
      status: 'published',
      startDateTime: { $gt: now }
    });
    const ongoing = getEventLifecycleQuery('ongoing', now);
    assert.ok(ongoing.$and.some((condition) => condition.status === 'published'));
    const completed = getEventLifecycleQuery('completed', now);
    assert.ok(completed.$and.some((condition) => condition.status === 'published'));
  });
});
