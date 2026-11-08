const crypto = require('crypto');
const mongoose = require('mongoose');
const { Event } = require('../models/Event');
const { Registration } = require('../models/Registration');
const { Booking } = require('../models/Booking');
const { CateringRequest } = require('../models/CateringRequest');
const { VendorApplication } = require('../models/VendorApplication');
const { User } = require('../models/User');
const { ReminderJob } = require('../models/ReminderJob');
const {
  getEventLifecycleStatus,
  getEventLifecycleQuery
} = require('../utils/eventLifecycle');
const { persistNotification, persistActivity } = require('./workflowService');

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const TICK_INTERVAL = 60 * 1000;
const LOCK_DURATION = 60 * 1000;
const MAX_ATTEMPTS = 5;
const EVENT_REMINDER_LATE_GRACE = 5 * 60 * 1000;

const EVENT_REMINDERS = [
  { type: 'event_organizer_7_day', audience: 'organizer', offset: 7 * DAY },
  { type: 'event_organizer_24_hour', audience: 'organizer', offset: DAY },
  { type: 'event_participant_24_hour', audience: 'participants', offset: DAY },
  { type: 'event_participant_1_hour', audience: 'participants', offset: HOUR }
];

const getId = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value.toHexString === 'function') return value.toHexString();
  if (typeof value === 'object') {
    const nested = value._id !== undefined ? value._id : value.id;
    return nested === value ? null : getId(nested);
  }
  return String(value);
};

const validDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isMockMode = (app) => process.env.NODE_ENV !== 'production' &&
  app?.locals?.mockReminderJobStore instanceof Map;

const readMockValues = (app, name) => {
  const store = app?.locals?.[name];
  return store instanceof Map ? Array.from(store.values()) : [];
};

const createMockStores = (app) => {
  if (!app?.locals) throw new Error('Mock scheduler requires an Express app.');
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
  ]) {
    if (!(app.locals[name] instanceof Map)) app.locals[name] = new Map();
  }
  return app.locals.mockReminderJobStore;
};

const toJob = (payload, now) => ({
  ...payload,
  id: new mongoose.Types.ObjectId().toString(),
  status: 'pending',
  attempts: 0,
  maxAttempts: MAX_ATTEMPTS,
  nextAttemptAt: payload.scheduledAt,
  lockToken: null,
  lockedUntil: null,
  lastErrorCode: null,
  deliveredAt: null,
  cancelledAt: null,
  createdAt: now,
  updatedAt: now
});

const upsertJob = async (payload, { app, mock, now }) => {
  if (mock) {
    const jobs = app.locals.mockReminderJobStore;
    const existing = Array.from(jobs.values()).find((job) => job.dedupeKey === payload.dedupeKey);
    if (!existing) {
      const job = toJob(payload, now);
      jobs.set(job.id, job);
      return job;
    }
    if (existing.status === 'cancelled') {
      Object.assign(existing, toJob({ ...payload, id: existing.id }, now), {
        id: existing.id,
        createdAt: existing.createdAt
      });
    }
    return existing;
  }
  const inserted = await ReminderJob.findOneAndUpdate(
    { dedupeKey: payload.dedupeKey },
    { $setOnInsert: payload },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  if (inserted.status === 'cancelled') {
    return ReminderJob.findOneAndUpdate(
      { _id: inserted._id, status: 'cancelled' },
      {
        $set: {
          ...payload,
          status: 'pending',
          attempts: 0,
          nextAttemptAt: payload.scheduledAt,
          lockToken: null,
          lockedUntil: null,
          lastErrorCode: null,
          deliveredAt: null,
          cancelledAt: null
        }
      },
      { new: true }
    );
  }
  return inserted;
};

const activeJobs = async ({ app, mock }) => mock
  ? Array.from(app.locals.mockReminderJobStore.values())
    .filter((job) => ['pending', 'retry', 'processing'].includes(job.status))
  : ReminderJob.find({ status: { $in: ['pending', 'retry', 'processing'] } }).lean();

const cancelJob = async (job, { app, mock, now, status = 'cancelled' }) => {
  if (mock) {
    job.status = status;
    job.cancelledAt = now;
    job.lockToken = null;
    job.lockedUntil = null;
    job.updatedAt = now;
    return;
  }
  await ReminderJob.updateOne(
    { _id: job._id, status: { $in: ['pending', 'retry', 'processing'] } },
    {
      $set: {
        status,
        cancelledAt: now,
        lockToken: null,
        lockedUntil: null
      }
    }
  );
};

const databaseList = async (Model, query) => Model.find(query).lean();

const getSources = async ({ app, mock, now }) => {
  if (mock) {
    return {
      events: readMockValues(app, 'mockEventStore'),
      registrations: readMockValues(app, 'mockRegistrationStore'),
      bookings: readMockValues(app, 'mockBookingStore'),
      cateringRequests: readMockValues(app, 'mockCateringRequestStore'),
      applications: readMockValues(app, 'mockVendorApplicationStore'),
      users: readMockValues(app, 'mockUserStore')
    };
  }
  const [events, registrations, bookings, cateringRequests, applications] = await Promise.all([
    databaseList(Event, { status: 'published', isArchived: false, startDateTime: { $gt: now } }),
    databaseList(Registration, { status: 'registered', isArchived: false }),
    databaseList(Booking, { status: 'pending', isArchived: false }),
    databaseList(CateringRequest, { status: 'pending', isArchived: false }),
    databaseList(VendorApplication, { status: 'pending' })
  ]);
  return { events, registrations, bookings, cateringRequests, applications, users: null };
};

const ensureJob = async (payload, context) => {
  if (!payload.scheduledAt || payload.scheduledAt <= context.now) return;
  await upsertJob({
    ...payload,
    maxAttempts: MAX_ATTEMPTS,
    attempts: 0,
    status: 'pending',
    nextAttemptAt: payload.scheduledAt
  }, context);
};

const reconcileReminderJobs = async ({ app, now = new Date() }) => {
  const mock = isMockMode(app);
  if (!mock && mongoose.connection.readyState !== 1) return 0;
  const context = { app, mock, now };
  const sources = await getSources(context);
  const desiredEventKeys = new Set();
  let scheduled = 0;

  for (const event of sources.events) {
    const eventId = getId(event._id || event.id);
    const startAt = validDate(event.startDateTime);
    const organizerId = getId(event.organizer);
    if (!eventId || !startAt || startAt <= now || !organizerId || event.status !== 'published' || event.isArchived) continue;

    for (const reminder of EVENT_REMINDERS) {
      const scheduledAt = new Date(startAt.getTime() - reminder.offset);
      const key = `event-reminder:${eventId}:${startAt.getTime()}:${reminder.type}`;
      desiredEventKeys.add(key);
      if (scheduledAt.getTime() + EVENT_REMINDER_LATE_GRACE < now.getTime()) {
        await upsertJob({
          dedupeKey: key,
          type: reminder.type,
          entityType: 'event',
          entityId: eventId,
          scheduledAt,
          eventStartAt: startAt,
          intervalNumber: null
        }, context);
        const missed = mock
          ? Array.from(app.locals.mockReminderJobStore.values()).find((job) => job.dedupeKey === key)
          : null;
        if (missed && ['pending', 'retry'].includes(missed.status)) {
          await cancelJob(missed, { ...context, status: 'missed' });
        } else if (!mock) await ReminderJob.updateOne(
          { dedupeKey: key, status: { $in: ['pending', 'retry'] } },
          { $set: { status: 'missed', cancelledAt: now } }
        );
        continue;
      }
      const previous = await upsertJob({
        dedupeKey: key,
        type: reminder.type,
        entityType: 'event',
        entityId: eventId,
        scheduledAt,
        eventStartAt: startAt,
        intervalNumber: null
      }, context);
      if (previous?.createdAt?.getTime?.() === now.getTime()) scheduled += 1;
    }
  }

  const pendingReminders = [
    { entityType: 'booking', type: 'booking_pending_24_hour', collection: sources.bookings, interval: DAY },
    { entityType: 'cateringRequest', type: 'catering_pending_24_hour', collection: sources.cateringRequests, interval: DAY },
    { entityType: 'vendorApplication', type: 'vendor_application_pending_48_hour', collection: sources.applications, interval: 2 * DAY }
  ];
  const desiredPendingKeys = new Set();
  for (const definition of pendingReminders) {
    for (const entity of definition.collection) {
      if (entity.status !== 'pending' || entity.isArchived) continue;
      const entityId = getId(entity._id || entity.id);
      const createdAt = validDate(entity.createdAt);
      if (!entityId || !createdAt) continue;
      const elapsedIntervals = Math.floor((now.getTime() - createdAt.getTime()) / definition.interval);
      if (elapsedIntervals < 1) continue;
      const intervalNumber = elapsedIntervals;
      const scheduledAt = new Date(createdAt.getTime() + intervalNumber * definition.interval);
      const key = `pending-reminder:${definition.entityType}:${entityId}:${intervalNumber}`;
      desiredPendingKeys.add(key);
      const job = await upsertJob({
        dedupeKey: key,
        type: definition.type,
        entityType: definition.entityType,
        entityId,
        scheduledAt,
        eventStartAt: null,
        intervalNumber
      }, context);
      if (job?.attempts === 0 && job?.status === 'pending') scheduled += 1;
    }
  }

  const jobs = await activeJobs(context);
  for (const job of jobs) {
    if (job.entityType === 'event' && !desiredEventKeys.has(job.dedupeKey)) {
      await cancelJob(job, context);
    } else if (job.entityType !== 'event' && !desiredPendingKeys.has(job.dedupeKey)) {
      await cancelJob(job, context);
    }
  }

  return scheduled;
};

const getEntity = async (job, { app, mock }) => {
  if (mock) {
    const stores = {
      event: 'mockEventStore',
      booking: 'mockBookingStore',
      cateringRequest: 'mockCateringRequestStore',
      vendorApplication: 'mockVendorApplicationStore'
    };
    const store = app.locals[stores[job.entityType]];
    if (!(store instanceof Map)) return null;
    return Array.from(store.values()).find((item) =>
      getId(item._id || item.id) === getId(job.entityId) ||
      (job.entityType === 'vendorApplication' && getId(item.vendorId) === getId(job.entityId))
    ) || null;
  }
  const models = {
    event: Event,
    booking: Booking,
    cateringRequest: CateringRequest,
    vendorApplication: VendorApplication
  };
  const Model = models[job.entityType];
  if (!Model) return null;
  return Model.findById(job.entityId).lean();
};

const activeUser = async (id, { app, mock }) => {
  if (!id) return null;
  if (mock) {
    const user = app.locals.mockUserStore?.get(getId(id));
    return user && user.isActive !== false ? user : null;
  }
  return User.findOne({ _id: id, isActive: true }).select('_id role').lean();
};

const getEventRecipients = async (event, job, { app, mock }) => {
  if (job.type.startsWith('event_organizer_')) {
    const user = await activeUser(event.organizer, { app, mock });
    return user ? [user] : [];
  }
  let registrations;
  if (mock) {
    registrations = readMockValues(app, 'mockRegistrationStore').filter((registration) =>
      getId(registration.event) === getId(event._id || event.id) &&
      registration.status === 'registered' && !registration.isArchived
    );
  } else {
    registrations = await Registration.find({
      event: event._id,
      status: 'registered',
      isArchived: false
    }).select('participant').lean();
  }
  const ids = [...new Set(registrations.map((registration) => getId(registration.participant)).filter(Boolean))];
  if (mock) {
    return ids.map((id) => app.locals.mockUserStore?.get(id))
      .filter((user) => user && user.isActive !== false && user.role === 'participant');
  }
  return User.find({ _id: { $in: ids }, role: 'participant', isActive: true }).select('_id role').lean();
};

const getAdministratorRecipients = async ({ app, mock }) => mock
  ? readMockValues(app, 'mockUserStore').filter((user) => user.role === 'administrator' && user.isActive !== false)
  : User.find({ role: 'administrator', isActive: true }).select('_id role').lean();

const getRecipients = async (job, entity, context) => {
  if (job.entityType === 'event') return getEventRecipients(entity, job, context);
  if (job.entityType === 'booking' || job.entityType === 'vendorApplication') {
    return getAdministratorRecipients(context);
  }
  if (job.entityType === 'cateringRequest') {
    const vendor = await activeUser(entity.vendor, context);
    return vendor ? [vendor] : [];
  }
  return [];
};

const notificationFor = (job, entity) => {
  const eventTitle = entity.title || 'your event';
  const descriptions = {
    event_organizer_7_day: [`Event in 7 days: ${eventTitle}`, `"${eventTitle}" starts in 7 days.`],
    event_organizer_24_hour: [`Event tomorrow: ${eventTitle}`, `"${eventTitle}" starts in 24 hours.`],
    event_participant_24_hour: [`Event tomorrow: ${eventTitle}`, `"${eventTitle}" starts in 24 hours.`],
    event_participant_1_hour: [`Event starting soon: ${eventTitle}`, `"${eventTitle}" starts in 1 hour.`],
    booking_pending_24_hour: ['Booking request awaiting review', 'A venue booking request has been pending for 24 hours.'],
    catering_pending_24_hour: ['Catering request awaiting response', 'A catering request has been unanswered for 24 hours.'],
    vendor_application_pending_48_hour: ['Vendor application awaiting review', 'A vendor application has been pending for 48 hours.']
  };
  const [title, message] = descriptions[job.type] || ['Scheduled reminder', 'A scheduled reminder is due.'];
  return {
    type: job.type.startsWith('event_') ? 'event_reminder' :
      job.entityType === 'booking' ? 'booking_pending_reminder' :
      job.entityType === 'cateringRequest' ? 'catering_pending_reminder' :
      'vendor_application_pending_reminder',
    title,
    message,
    entityType: job.entityType,
    entityId: getId(job.entityId)
  };
};

const isEligible = (job, entity, now) => {
  if (!entity || entity.isArchived) return false;
  if (job.entityType === 'event') {
    const startAt = validDate(entity.startDateTime);
    return entity.status === 'published' &&
      startAt &&
      startAt > now &&
      startAt.getTime() === new Date(job.eventStartAt).getTime() &&
      getEventLifecycleStatus(entity, now) !== 'completed';
  }
  return entity.status === 'pending';
};

const claimJob = async ({ app, mock, now, workerId }) => {
  const lockToken = `${workerId}:${crypto.randomUUID()}`;
  if (mock) {
    const job = Array.from(app.locals.mockReminderJobStore.values())
      .filter((candidate) =>
        (['pending', 'retry'].includes(candidate.status) ||
          (candidate.status === 'processing' && candidate.lockedUntil && new Date(candidate.lockedUntil) <= now)) &&
        new Date(candidate.nextAttemptAt) <= now &&
        (candidate.status === 'processing' || new Date(candidate.scheduledAt) <= now) &&
        candidate.attempts < candidate.maxAttempts
      )
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))[0];
    if (!job) return null;
    job.status = 'processing';
    job.attempts += 1;
    job.lockToken = lockToken;
    job.lockedUntil = new Date(now.getTime() + LOCK_DURATION);
    return job;
  }
  return ReminderJob.findOneAndUpdate(
    {
      $or: [
        {
          status: { $in: ['pending', 'retry'] },
          scheduledAt: { $lte: now },
          nextAttemptAt: { $lte: now }
        },
        { status: 'processing', lockedUntil: { $lte: now } }
      ],
      $expr: { $lt: ['$attempts', '$maxAttempts'] }
    },
    {
      $set: { status: 'processing', lockToken, lockedUntil: new Date(now.getTime() + LOCK_DURATION) },
      $inc: { attempts: 1 }
    },
    { new: true, sort: { scheduledAt: 1 } }
  );
};

const updateClaimedJob = async (job, { app, mock, lockToken }, values) => {
  if (mock) {
    if (job.lockToken !== lockToken) return false;
    Object.assign(job, values, { lockToken: null, lockedUntil: null, updatedAt: new Date() });
    return true;
  }
  const result = await ReminderJob.updateOne(
    { _id: job._id, status: 'processing', lockToken },
    { $set: { ...values, lockToken: null, lockedUntil: null } }
  );
  return result.modifiedCount === 1;
};

const deliverJob = async (job, context) => {
  const entity = await getEntity(job, context);
  if (!isEligible(job, entity, context.now)) {
    await updateClaimedJob(job, context, { status: 'cancelled', cancelledAt: context.now });
    return 'cancelled';
  }

  const recipients = await getRecipients(job, entity, context);
  const baseNotification = notificationFor(job, entity);
  for (const recipient of recipients) {
    const recipientId = getId(recipient._id || recipient.id);
    if (!recipientId) continue;
    await persistNotification(context.app ? { app: context.app } : { app: { locals: {} } }, {
      ...baseNotification,
      recipientId,
      actorId: null,
      dedupeKey: `${job.dedupeKey}:${recipientId}`
    });
  }
  await updateClaimedJob(job, context, { status: 'delivered', deliveredAt: context.now, lastErrorCode: null });
  return 'delivered';
};

const retryDelay = (attempts) => Math.min(15 * 60 * 1000, 15 * 1000 * (2 ** Math.max(0, attempts - 1)));

const processDueReminders = async ({ app, now = new Date(), workerId = `worker-${process.pid}` }) => {
  const mock = isMockMode(app);
  if (!mock && mongoose.connection.readyState !== 1) return { claimed: 0, delivered: 0, cancelled: 0, retried: 0, failed: 0 };
  const context = { app, mock, now, workerId };
  const result = { claimed: 0, delivered: 0, cancelled: 0, retried: 0, failed: 0 };
  if (mock) {
    for (const job of app.locals.mockReminderJobStore.values()) {
      if (job.status === 'processing' && job.lockedUntil &&
          new Date(job.lockedUntil) <= now && job.attempts >= job.maxAttempts) {
        job.status = 'failed';
        job.lockToken = null;
        job.lockedUntil = null;
        job.lastErrorCode = job.lastErrorCode || 'LEASE_EXPIRED';
      }
    }
  } else {
    await ReminderJob.updateMany(
      { status: 'processing', lockedUntil: { $lte: now }, $expr: { $gte: ['$attempts', '$maxAttempts'] } },
      { $set: { status: 'failed', lockToken: null, lockedUntil: null, lastErrorCode: 'LEASE_EXPIRED' } }
    );
  }
  for (;;) {
    const job = await claimJob(context);
    if (!job) break;
    result.claimed += 1;
    context.lockToken = job.lockToken;
    try {
      const status = await deliverJob(job, context);
      result[status] += 1;
    } catch (error) {
      const code = String(error.code || error.name || 'DELIVERY_ERROR').slice(0, 80);
      const terminal = job.attempts >= job.maxAttempts;
      const values = terminal
        ? { status: 'failed', lastErrorCode: code }
        : {
          status: 'retry',
          nextAttemptAt: new Date(now.getTime() + retryDelay(job.attempts)),
          lastErrorCode: code
        };
      await updateClaimedJob(job, context, values);
      result[terminal ? 'failed' : 'retried'] += 1;
      console.error('[Reminder scheduler delivery failed]', { type: job.type, code, attempt: job.attempts });
    }
  }
  return result;
};

const recordCompletedEvents = async ({ app, now = new Date() }) => {
  const mock = isMockMode(app);
  if (!mock && mongoose.connection.readyState !== 1) return 0;
  const events = mock
    ? readMockValues(app, 'mockEventStore')
    : await Event.find({ ...getEventLifecycleQuery('completed', now), isArchived: false }).lean();
  let recorded = 0;
  for (const event of events) {
    if (!event || event.isArchived || event.status !== 'published' ||
        getEventLifecycleStatus(event, now) !== 'completed') continue;
    const eventId = getId(event._id || event.id);
    if (!eventId) continue;
    try {
      const activity = await persistActivity({ app }, {
        eventId,
        actorId: null,
        action: 'event_completed',
        description: `Event "${event.title}" reached its scheduled completion time.`,
        dedupeKey: `event-completed:${eventId}`
      });
      if (activity) recorded += 1;
    } catch (error) {
      console.error('[Event completion activity failed]', {
        eventId,
        code: error.code || error.name || 'ACTIVITY_ERROR'
      });
    }
  }
  return recorded;
};

const runSchedulerCycle = async ({ app, now = new Date() }) => {
  await reconcileReminderJobs({ app, now });
  const reminders = await processDueReminders({ app, now });
  const completedEvents = await recordCompletedEvents({ app, now });
  return { reminders, completedEvents };
};

const startReminderScheduler = ({ app, intervalMs = TICK_INTERVAL } = {}) => {
  if (process.env.NODE_ENV === 'test' || process.env.NODE_TEST_CONTEXT) return null;
  if (!app || mongoose.connection.readyState !== 1) {
    throw new Error('Reminder scheduler requires a connected database and Express app.');
  }
  let stopped = false;
  let running = false;
  let activeTick = Promise.resolve();
  const tick = async () => {
    if (stopped) return;
    if (running) return activeTick;
    running = true;
    activeTick = (async () => {
      try {
        await runSchedulerCycle({ app });
      } catch (error) {
        console.error('[Reminder scheduler cycle failed]', {
          name: error.name || 'Error',
          code: error.code || 'SCHEDULER_ERROR'
        });
      } finally {
        running = false;
      }
    })();
    return activeTick;
  };
  void ReminderJob.init().then(tick).catch((error) => {
    console.error('[Reminder scheduler startup failed]', {
      name: error.name || 'Error',
      code: error.code || 'SCHEDULER_START_ERROR'
    });
  });
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return {
    stop() {
      stopped = true;
      clearInterval(timer);
      return activeTick;
    },
    tick
  };
};

module.exports = {
  EVENT_REMINDERS,
  MAX_ATTEMPTS,
  createMockStores,
  reconcileReminderJobs,
  processDueReminders,
  recordCompletedEvents,
  runSchedulerCycle,
  startReminderScheduler
};
