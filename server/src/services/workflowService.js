const mongoose = require('mongoose');
const { EventActivity, EVENT_ACTIVITY_ACTIONS } = require('../models/EventActivity');
const { Notification, NOTIFICATION_TYPES, ENTITY_TYPES } = require('../models/Notification');
const { Registration } = require('../models/Registration');
const { User } = require('../models/User');

const getMockStore = (req, key) => {
  if (process.env.NODE_ENV === 'production' || !req.app?.locals) return null;
  const storeName = `mock${key}Store`;
  if (req.app.locals[storeName]) return req.app.locals[storeName];
  const hasMockRepositories = Object.entries(req.app.locals).some(([name, store]) =>
    name.startsWith('mock') && name.endsWith('Store') && store instanceof Map
  );
  if (!hasMockRepositories || mongoose.connection.readyState === 1) return null;
  req.app.locals[storeName] = new Map();
  return req.app.locals[storeName];
};

const asObjectId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(String(id || ''))) {
    throw new Error('Invalid workflow entity reference.');
  }
  return new mongoose.Types.ObjectId(String(id));
};

const reportDeliveryError = (kind, error) => {
  console.error(`[${kind} delivery failed]`, {
    name: error?.name || 'Error',
    code: error?.code || 'UNKNOWN'
  });
};

const persistNotification = async (req, payload) => {
  if (!payload || !NOTIFICATION_TYPES.includes(payload.type) || !ENTITY_TYPES.includes(payload.entityType)) {
    throw new Error('Invalid notification type or entity type.');
  }
  if (typeof payload.title !== 'string' || typeof payload.message !== 'string' ||
      typeof payload.dedupeKey !== 'string' || payload.title.trim().length > 120 ||
      payload.message.trim().length > 300 || payload.dedupeKey.length > 240) {
    throw new Error('Invalid notification payload.');
  }
  const recipientId = asObjectId(payload.recipientId);
  const actorId = payload.actorId ? asObjectId(payload.actorId) : null;
  const entityId = asObjectId(payload.entityId);
  const store = getMockStore(req, 'Notification');
  if (store) {
    if (Array.from(store.values()).some((item) => item.dedupeKey === payload.dedupeKey)) return null;
    const item = {
      id: new mongoose.Types.ObjectId().toString(),
      recipientId: recipientId.toString(),
      actorId: actorId?.toString() || null,
      type: payload.type,
      title: payload.title.trim(),
      message: payload.message.trim(),
      entityType: payload.entityType,
      entityId: entityId.toString(),
      readAt: null,
      dedupeKey: payload.dedupeKey,
      createdAt: new Date()
    };
    store.set(item.id, item);
    return item;
  }
  if (mongoose.connection.readyState !== 1) throw new Error('Notification store is unavailable.');
  try {
    return await Notification.create({
      recipientId,
      actorId,
      type: payload.type,
      title: payload.title.trim(),
      message: payload.message.trim(),
      entityType: payload.entityType,
      entityId,
      dedupeKey: payload.dedupeKey
    });
  } catch (error) {
    if (error.code === 11000) return null;
    throw error;
  }
};

const persistActivity = async (req, payload) => {
  if (!payload || !EVENT_ACTIVITY_ACTIONS.includes(payload.action) ||
      typeof payload.description !== 'string' || payload.description.trim().length > 300 ||
      typeof payload.dedupeKey !== 'string' || payload.dedupeKey.length > 240) {
    throw new Error('Invalid event activity payload.');
  }
  const eventId = asObjectId(payload.eventId);
  const actorId = payload.actorId ? asObjectId(payload.actorId) : null;
  const metadata = payload.metadata || {};
  const allowedMetadata = ['registrationId', 'bookingId', 'requestId', 'status'];
  if (Object.keys(metadata).some((key) => !allowedMetadata.includes(key))) {
    throw new Error('Invalid event activity metadata.');
  }
  const safeMetadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    safeMetadata[key] = key === 'status' ? String(value).slice(0, 30) : asObjectId(value);
  }
  const store = getMockStore(req, 'EventActivity');
  if (store) {
    if (Array.from(store.values()).some((item) => item.dedupeKey === payload.dedupeKey)) return null;
    const item = {
      id: new mongoose.Types.ObjectId().toString(),
      eventId: eventId.toString(),
      actorId: actorId?.toString() || null,
      action: payload.action,
      description: payload.description.trim(),
      metadata: Object.fromEntries(Object.entries(safeMetadata).map(([key, value]) => [
        key,
        value instanceof mongoose.Types.ObjectId ? value.toString() : value
      ])),
      dedupeKey: payload.dedupeKey,
      createdAt: new Date()
    };
    store.set(item.id, item);
    return item;
  }
  if (mongoose.connection.readyState !== 1) throw new Error('Event activity store is unavailable.');
  try {
    return await EventActivity.create({
      eventId,
      actorId,
      action: payload.action,
      description: payload.description.trim(),
      metadata: safeMetadata,
      dedupeKey: payload.dedupeKey
    });
  } catch (error) {
    if (error.code === 11000) return null;
    throw error;
  }
};

const deliverNotification = async (req, payload) => {
  try {
    await persistNotification(req, payload);
  } catch (error) {
    reportDeliveryError('Notification', error);
  }
};

const recordEventActivity = async (req, payload) => {
  try {
    await persistActivity(req, payload);
  } catch (error) {
    reportDeliveryError('Event activity', error);
  }
};

const getAdministratorIds = async (req) => {
  const users = !req.app?.locals ? null : req.app.locals.mockUserStore;
  if (process.env.NODE_ENV !== 'production' && users) {
    return Array.from(users.values())
      .filter((user) => user.role === 'administrator' && user.isActive !== false)
      .map((user) => String(user.id || user._id));
  }
  if (mongoose.connection.readyState !== 1) return [];
  const administrators = await User.find({ role: 'administrator', isActive: true }).select('_id').lean();
  return administrators.map((user) => user._id.toString());
};

const getRegisteredParticipantIds = async (req, eventId) => {
  const registrations = !req.app?.locals ? null : req.app.locals.mockRegistrationStore;
  if (process.env.NODE_ENV !== 'production' && registrations) {
    return Array.from(new Set(Array.from(registrations.values())
      .filter((item) => String(item.event?._id || item.event?.id || item.event) === String(eventId) &&
        item.status === 'registered' && !item.isArchived)
      .map((item) => String(item.participant?._id || item.participant?.id || item.participant))));
  }
  if (mongoose.connection.readyState !== 1) return [];
  const registered = await Registration.find({
    event: eventId,
    status: 'registered',
    isArchived: false
  }).distinct('participant');
  return registered.map((id) => id.toString());
};

const notifyAdministrators = async (req, notification) => {
  try {
    const recipientIds = await getAdministratorIds(req);
    await Promise.all(recipientIds.map((recipientId) => deliverNotification(req, {
      ...notification,
      recipientId,
      dedupeKey: `${notification.dedupeKey}:${recipientId}`
    })));
  } catch (error) {
    reportDeliveryError('Notification', error);
  }
};

const notifyRegisteredParticipants = async (req, eventId, notification) => {
  try {
    const recipientIds = await getRegisteredParticipantIds(req, eventId);
    await Promise.all(recipientIds.map((recipientId) => deliverNotification(req, {
      ...notification,
      recipientId,
      dedupeKey: `${notification.dedupeKey}:${recipientId}`
    })));
  } catch (error) {
    reportDeliveryError('Notification', error);
  }
};

module.exports = {
  persistNotification,
  persistActivity,
  deliverNotification,
  recordEventActivity,
  notifyAdministrators,
  notifyRegisteredParticipants,
  getMockStore,
  asObjectId
};
