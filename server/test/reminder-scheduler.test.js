const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const app = require('../src/app');
const { persistNotification } = require('../src/services/workflowService');
const {
  createMockStores,
  reconcileReminderJobs,
  processDueReminders,
  recordCompletedEvents,
  runSchedulerCycle,
  startReminderScheduler
} = require('../src/services/reminderScheduler');

const objectId = () => new mongoose.Types.ObjectId().toString();
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

describe('Persistent smart reminder scheduler (mock-store tests; no MongoDB integration)', () => {
  let now;
  let organizer;
  let activeParticipant;
  let cancelledParticipant;
  let inactiveParticipant;
  let admin;
  let vendor;
  let event;

  beforeEach(() => {
    now = new Date('2026-11-07T04:00:00.000Z');
    createMockStores(app);
    for (const name of [
      'mockReminderJobStore',
      'mockEventStore',
      'mockRegistrationStore',
      'mockBookingStore',
      'mockCateringRequestStore',
      'mockVendorApplicationStore',
      'mockUserStore',
      'mockNotificationStore',
      'mockEventActivityStore'
    ]) app.locals[name].clear();
    organizer = { id: objectId(), role: 'organizer', name: 'Organizer', isActive: true };
    activeParticipant = { id: objectId(), role: 'participant', name: 'Active Participant', isActive: true };
    cancelledParticipant = { id: objectId(), role: 'participant', name: 'Cancelled Participant', isActive: true };
    inactiveParticipant = { id: objectId(), role: 'participant', name: 'Inactive Participant', isActive: false };
    admin = { id: objectId(), role: 'administrator', name: 'Administrator', isActive: true };
    vendor = { id: objectId(), role: 'vendor', name: 'Vendor', isActive: true };
    for (const user of [organizer, activeParticipant, cancelledParticipant, inactiveParticipant, admin, vendor]) {
      app.locals.mockUserStore.set(user.id, user);
    }
    event = {
      id: objectId(),
      title: 'Automation Conference',
      organizer: organizer.id,
      status: 'published',
      isArchived: false,
      startDateTime: new Date(now.getTime() + 10 * DAY),
      endDateTime: new Date(now.getTime() + 10 * DAY + 2 * HOUR)
    };
    app.locals.mockEventStore.set(event.id, event);
  });

  const addRegistration = (participant, status = 'registered') => {
    const registration = {
      id: objectId(),
      event: event.id,
      participant: participant.id,
      status,
      isArchived: false
    };
    app.locals.mockRegistrationStore.set(registration.id, registration);
    return registration;
  };

  test('schedules all event reminder intervals once and preserves jobs across scheduler recreation', async () => {
    const firstScheduled = await reconcileReminderJobs({ app, now });
    const jobsAfterFirstRun = app.locals.mockReminderJobStore.size;
    await reconcileReminderJobs({ app, now: new Date(now.getTime() + 30_000) });

    assert.equal(firstScheduled, 4);
    assert.equal(jobsAfterFirstRun, 4);
    assert.equal(app.locals.mockReminderJobStore.size, 4);
    assert.equal(Array.from(app.locals.mockReminderJobStore.values())
      .filter((job) => job.status === 'pending').length, 4);
  });

  test('due event reminders reach the organizer and only active registered participants', async () => {
    addRegistration(activeParticipant);
    addRegistration(cancelledParticipant, 'cancelled');
    addRegistration(inactiveParticipant);
    event.startDateTime = new Date(now.getTime() + DAY);
    event.endDateTime = new Date(event.startDateTime.getTime() + HOUR);

    const result = await runSchedulerCycle({ app, now });
    const notifications = Array.from(app.locals.mockNotificationStore.values());
    assert.equal(result.reminders.delivered, 2);
    assert.equal(notifications.length, 2);
    assert.ok(notifications.some((item) => item.recipientId === organizer.id));
    assert.ok(notifications.some((item) => item.recipientId === activeParticipant.id));
    assert.equal(notifications.some((item) => item.recipientId === cancelledParticipant.id), false);
    assert.equal(notifications.some((item) => item.recipientId === inactiveParticipant.id), false);
    assert.ok(notifications.every((item) => item.type === 'event_reminder'));
  });

  test('event date changes cancel old jobs and create reminders for the new date', async () => {
    await reconcileReminderJobs({ app, now });
    const oldKeys = new Set(Array.from(app.locals.mockReminderJobStore.values()).map((job) => job.dedupeKey));
    event.startDateTime = new Date(event.startDateTime.getTime() + DAY);
    event.endDateTime = new Date(event.endDateTime.getTime() + DAY);
    await reconcileReminderJobs({ app, now });

    const jobs = Array.from(app.locals.mockReminderJobStore.values());
    assert.equal(jobs.filter((job) => job.status === 'cancelled').length, 4);
    assert.equal(jobs.filter((job) => job.status === 'pending').length, 4);
    assert.ok(jobs.filter((job) => job.status === 'pending').every((job) => !oldKeys.has(job.dedupeKey)));
  });

  test('event cancellation cancels scheduled reminders without notifying', async () => {
    await reconcileReminderJobs({ app, now });
    event.status = 'cancelled';
    await reconcileReminderJobs({ app, now });
    const result = await processDueReminders({ app, now: new Date(now.getTime() + 20 * DAY) });

    assert.ok(Array.from(app.locals.mockReminderJobStore.values())
      .every((job) => job.status === 'cancelled'));
    assert.equal(result.delivered, 0);
    assert.equal(app.locals.mockNotificationStore.size, 0);
  });

  test('pending booking and catering reminders go only to administrators and assigned vendors', async () => {
    const bookingId = objectId();
    const requestId = objectId();
    app.locals.mockBookingStore.set(bookingId, {
      id: bookingId,
      event: event.id,
      organizer: organizer.id,
      status: 'pending',
      isArchived: false,
      createdAt: new Date(now.getTime() - DAY)
    });
    app.locals.mockCateringRequestStore.set(requestId, {
      id: requestId,
      event: event.id,
      organizer: organizer.id,
      vendor: vendor.id,
      status: 'pending',
      isArchived: false,
      createdAt: new Date(now.getTime() - DAY)
    });

    const result = await runSchedulerCycle({ app, now });
    const notifications = Array.from(app.locals.mockNotificationStore.values());
    assert.equal(result.reminders.delivered, 2);
    assert.equal(notifications.length, 2);
    assert.ok(notifications.some((item) =>
      item.entityType === 'booking' && item.recipientId === admin.id &&
      item.type === 'booking_pending_reminder'
    ));
    assert.ok(notifications.some((item) =>
      item.entityType === 'cateringRequest' && item.recipientId === vendor.id &&
      item.type === 'catering_pending_reminder'
    ));
  });

  test('resolved booking, catering request and vendor application are not reminded', async () => {
    const createdAt = new Date(now.getTime() - 3 * DAY);
    app.locals.mockBookingStore.set(objectId(), { id: objectId(), status: 'approved', createdAt, isArchived: false });
    app.locals.mockCateringRequestStore.set(objectId(), { id: objectId(), status: 'rejected', createdAt, isArchived: false });
    app.locals.mockVendorApplicationStore.set(objectId(), {
      id: objectId(), vendorId: vendor.id, status: 'approved', createdAt
    });

    const result = await runSchedulerCycle({ app, now });
    assert.equal(result.reminders.claimed, 0);
    assert.equal(app.locals.mockNotificationStore.size, 0);
  });

  test('pending vendor applications get a 48-hour administrator reminder', async () => {
    const applicationId = objectId();
    app.locals.mockVendorApplicationStore.set(applicationId, {
      id: applicationId,
      vendorId: vendor.id,
      status: 'pending',
      createdAt: new Date(now.getTime() - 2 * DAY)
    });
    await runSchedulerCycle({ app, now });

    const [notification] = Array.from(app.locals.mockNotificationStore.values());
    assert.equal(notification.recipientId, admin.id);
    assert.equal(notification.type, 'vendor_application_pending_reminder');
    assert.equal(notification.entityId, applicationId);
  });

  test('cancelled registrations do not receive participant reminders', async () => {
    addRegistration(cancelledParticipant, 'cancelled');
    event.startDateTime = new Date(now.getTime() + DAY);
    event.endDateTime = new Date(event.startDateTime.getTime() + HOUR);
    await runSchedulerCycle({ app, now });
    const notifications = Array.from(app.locals.mockNotificationStore.values());
    assert.equal(notifications.some((item) => item.recipientId === cancelledParticipant.id), false);
  });

  test('existing notification dedupe keys suppress duplicate reminder delivery', async () => {
    addRegistration(activeParticipant);
    event.startDateTime = new Date(now.getTime() + DAY);
    event.endDateTime = new Date(event.startDateTime.getTime() + HOUR);
    const participantJobKey = `event-reminder:${event.id}:${event.startDateTime.getTime()}:event_participant_24_hour`;
    await persistNotification({ app }, {
      recipientId: activeParticipant.id,
      actorId: null,
      type: 'event_reminder',
      title: 'Event tomorrow',
      message: 'Already sent.',
      entityType: 'event',
      entityId: event.id,
      dedupeKey: `${participantJobKey}:${activeParticipant.id}`
    });

    await runSchedulerCycle({ app, now });
    assert.equal(Array.from(app.locals.mockNotificationStore.values())
      .filter((item) => item.recipientId === activeParticipant.id).length, 1);
    assert.ok(Array.from(app.locals.mockReminderJobStore.values())
      .some((job) => job.dedupeKey === participantJobKey && job.status === 'delivered'));
  });

  test('transient reminder failures retry and succeed after recipient data is corrected', async () => {
    const malformedAdmin = { id: 'invalid-admin-id', role: 'administrator', isActive: true };
    app.locals.mockUserStore.set(malformedAdmin.id, malformedAdmin);
    const bookingId = objectId();
    app.locals.mockBookingStore.set(bookingId, {
      id: bookingId,
      status: 'pending',
      createdAt: new Date(now.getTime() - DAY),
      isArchived: false
    });
    await runSchedulerCycle({ app, now });

    const job = Array.from(app.locals.mockReminderJobStore.values())
      .find((item) => item.entityId === bookingId);
    assert.equal(job.status, 'retry');
    assert.equal(job.attempts, 1);
    assert.ok(job.nextAttemptAt > now);

    app.locals.mockUserStore.delete(malformedAdmin.id);
    job.nextAttemptAt = now;
    const result = await processDueReminders({ app, now: new Date(now.getTime() + 1_000) });
    assert.equal(result.delivered, 1);
    assert.equal(job.status, 'delivered');
    assert.ok(Array.from(app.locals.mockNotificationStore.values())
      .some((item) => item.recipientId === admin.id && item.entityId === bookingId));
  });

  test('reminder retries stop at the configured maximum', async () => {
    app.locals.mockUserStore.clear();
    const malformedAdmin = { id: 'invalid-admin-id', role: 'administrator', isActive: true };
    app.locals.mockUserStore.set(malformedAdmin.id, malformedAdmin);
    const bookingId = objectId();
    app.locals.mockBookingStore.set(bookingId, {
      id: bookingId,
      status: 'pending',
      createdAt: new Date(now.getTime() - DAY),
      isArchived: false
    });
    await reconcileReminderJobs({ app, now });
    const job = Array.from(app.locals.mockReminderJobStore.values())
      .find((item) => item.entityType === 'booking' && item.entityId === bookingId);
    for (let attempt = 0; attempt < job.maxAttempts; attempt += 1) {
      job.nextAttemptAt = now;
      await processDueReminders({ app, now: new Date(now.getTime() + attempt * 1_000) });
    }
    assert.equal(job.status, 'failed', JSON.stringify(job));
    assert.equal(job.attempts, job.maxAttempts, JSON.stringify(job));
  });

  test('expired worker leases are reclaimed and completion activity is idempotent', async () => {
    const expiredEvent = {
      ...event,
      id: objectId(),
      startDateTime: new Date(now.getTime() - 2 * DAY),
      endDateTime: new Date(now.getTime() - DAY)
    };
    app.locals.mockEventStore.set(expiredEvent.id, expiredEvent);
    const jobId = objectId();
    app.locals.mockReminderJobStore.set(jobId, {
      id: jobId,
      dedupeKey: `expired-job:${jobId}`,
      type: 'booking_pending_24_hour',
      entityType: 'booking',
      entityId: objectId(),
      status: 'processing',
      attempts: 1,
      maxAttempts: 5,
      scheduledAt: new Date(now.getTime() - DAY),
      nextAttemptAt: new Date(now.getTime() - DAY),
      lockedUntil: new Date(now.getTime() - 1_000),
      lockToken: 'stale-worker'
    });
    const first = await recordCompletedEvents({ app, now });
    const second = await recordCompletedEvents({ app, now });

    assert.equal(first, 1);
    assert.equal(second, 0);
    assert.equal(Array.from(app.locals.mockEventActivityStore.values())
      .filter((activity) => activity.action === 'event_completed').length, 1);
  });

  test('scheduler startup is explicitly excluded from automated test environments', () => {
    const previousEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    try {
      assert.equal(startReminderScheduler({ app }), null);
    } finally {
      if (previousEnvironment === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousEnvironment;
    }
  });
});
