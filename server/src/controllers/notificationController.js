const mongoose = require('mongoose');
const { Event } = require('../models/Event');
const { EventActivity } = require('../models/EventActivity');
const { Notification } = require('../models/Notification');
const { getMockStore, asObjectId } = require('../services/workflowService');

const getReferenceId = (value, seen = new Set()) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value !== 'object') return null;

  if (typeof value.toHexString === 'function') {
    try {
      return value.toHexString();
    } catch {
      return null;
    }
  }

  if (seen.has(value)) return null;
  seen.add(value);

  const nestedId = value._id;
  if (nestedId !== value) {
    const resolvedId = getReferenceId(nestedId, seen);
    if (resolvedId !== null) return resolvedId;
  }

  const plainId = value.id;
  if (plainId !== value && (typeof plainId === 'string' || typeof plainId === 'number')) {
    return String(plainId);
  }
  return null;
};

const serializeNotification = (notification, userStore) => {
  const item = typeof notification.toObject === 'function' ? notification.toObject() : notification;
  const actorId = getReferenceId(item.actorId);
  const actor = userStore?.get(actorId);
  const populatedActor = item.actorId && typeof item.actorId === 'object' && item.actorId.name
    ? { id: actorId, name: item.actorId.name }
    : actor ? { id: actorId, name: actor.name } : null;
  return {
    id: getReferenceId(item._id || item.id),
    actor: populatedActor,
    type: item.type,
    title: item.title,
    message: item.message,
    entityType: item.entityType,
    entityId: getReferenceId(item.entityId),
    readAt: item.readAt || null,
    createdAt: item.createdAt
  };
};

const getNotifications = async (req, res, next) => {
  try {
    const page = req.query.page === undefined ? 1 : Number(req.query.page);
    const limit = req.query.limit === undefined ? 20 : Number(req.query.limit);
    if (!Number.isInteger(page) || !Number.isInteger(limit) || page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({ success: false, message: 'Page must be positive and limit must be between 1 and 100.' });
    }
    if (req.query.unread !== undefined && !['true', 'false'].includes(req.query.unread)) {
      return res.status(400).json({ success: false, message: 'Unread filter must be true or false.' });
    }
    const unread = req.query.unread === 'true';
    const mockStore = getMockStore(req, 'Notification');
    let rows;
    let total;
    if (mockStore) {
      rows = Array.from(mockStore.values()).filter((item) =>
        String(item.recipientId) === req.user.id &&
        (req.query.unread === undefined || (unread ? !item.readAt : Boolean(item.readAt)))
      );
      rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt) || String(b.id).localeCompare(String(a.id)));
      total = rows.length;
      rows = rows.slice((page - 1) * limit, page * limit);
    } else {
      const filter = {
        recipientId: req.user.id,
        ...(req.query.unread !== undefined ? { readAt: unread ? null : { $ne: null } } : {})
      };
      [rows, total] = await Promise.all([
        Notification.find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('actorId', 'name')
          .lean(),
        Notification.countDocuments(filter)
      ]);
    }
    const userStore = req.app?.locals?.mockUserStore;
    return res.status(200).json({
      success: true,
      data: rows.map((item) => serializeNotification(item, userStore)),
      pagination: { total, page, pages: Math.ceil(total / limit) || 1, limit }
    });
  } catch (error) {
    next(error);
  }
};

const getUnreadCount = async (req, res, next) => {
  try {
    const mockStore = getMockStore(req, 'Notification');
    const count = mockStore
      ? Array.from(mockStore.values()).filter((item) =>
        String(item.recipientId) === req.user.id && !item.readAt
      ).length
      : await Notification.countDocuments({ recipientId: req.user.id, readAt: null });
    return res.status(200).json({ success: true, data: { count } });
  } catch (error) {
    next(error);
  }
};

const markNotificationRead = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid notification ID.' });
    }
    const mockStore = getMockStore(req, 'Notification');
    if (mockStore) {
      const notification = mockStore.get(req.params.id);
      if (!notification || String(notification.recipientId) !== req.user.id) {
        return res.status(404).json({ success: false, message: 'Notification not found.' });
      }
      if (!notification.readAt) notification.readAt = new Date();
      return res.status(200).json({ success: true, data: serializeNotification(notification, req.app?.locals?.mockUserStore) });
    }
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.user.id, readAt: null },
      { $set: { readAt: new Date() } },
      { new: true }
    ).populate('actorId', 'name');
    if (notification) {
      return res.status(200).json({ success: true, data: serializeNotification(notification) });
    }
    const existing = await Notification.exists({ _id: req.params.id, recipientId: req.user.id });
    if (!existing) return res.status(404).json({ success: false, message: 'Notification not found.' });
    const alreadyRead = await Notification.findOne({ _id: req.params.id, recipientId: req.user.id })
      .populate('actorId', 'name')
      .lean();
    return res.status(200).json({ success: true, data: serializeNotification(alreadyRead) });
  } catch (error) {
    next(error);
  }
};

const markAllNotificationsRead = async (req, res, next) => {
  try {
    const mockStore = getMockStore(req, 'Notification');
    const readAt = new Date();
    let modifiedCount;
    if (mockStore) {
      modifiedCount = 0;
      for (const notification of mockStore.values()) {
        if (String(notification.recipientId) === req.user.id && !notification.readAt) {
          notification.readAt = readAt;
          modifiedCount += 1;
        }
      }
    } else {
      const result = await Notification.updateMany(
        { recipientId: req.user.id, readAt: null },
        { $set: { readAt } }
      );
      modifiedCount = result.modifiedCount;
    }
    return res.status(200).json({ success: true, data: { modifiedCount } });
  } catch (error) {
    next(error);
  }
};

const getEventActivity = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID.' });
    }
    const eventStore = getMockStore(req, 'Event');
    const event = eventStore
      ? eventStore.get(id)
      : await Event.findOne({ _id: id, isArchived: false }).select('organizer status isArchived');
    if (!event || event.isArchived) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }
    if (req.user.role !== 'administrator' && getReferenceId(event.organizer) !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You are not authorized to view this event activity.' });
    }

    const page = req.query.page === undefined ? 1 : Number(req.query.page);
    const limit = req.query.limit === undefined ? 20 : Number(req.query.limit);
    if (!Number.isInteger(page) || !Number.isInteger(limit) || page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({ success: false, message: 'Page must be positive and limit must be between 1 and 100.' });
    }
    const mockStore = getMockStore(req, 'EventActivity');
    let rows;
    let total;
    if (mockStore) {
      rows = Array.from(mockStore.values())
        .filter((item) => String(item.eventId) === id)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt) || String(a.id).localeCompare(String(b.id)));
      total = rows.length;
      rows = rows.slice((page - 1) * limit, page * limit);
      const users = req.app?.locals?.mockUserStore;
      rows = rows.map((item) => ({
        ...item,
        actor: users?.get(String(item.actorId))
          ? { id: String(item.actorId), name: users.get(String(item.actorId)).name }
          : null
      }));
    } else {
      const filter = { eventId: asObjectId(id) };
      [rows, total] = await Promise.all([
        EventActivity.find(filter)
          .sort({ createdAt: 1, _id: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('actorId', 'name')
          .lean(),
        EventActivity.countDocuments(filter)
      ]);
      rows = rows.map((item) => ({
        id: getReferenceId(item._id),
        action: item.action,
        description: item.description,
        actor: item.actorId ? { id: getReferenceId(item.actorId), name: item.actorId.name } : null,
        metadata: item.metadata,
        createdAt: item.createdAt
      }));
    }
    const data = rows.map((item) => ({
      id: item.id || getReferenceId(item._id),
      action: item.action,
      description: item.description,
      actor: item.actor || null,
      metadata: item.metadata || {},
      createdAt: item.createdAt
    }));
    return res.status(200).json({
      success: true,
      data,
      pagination: { total, page, pages: Math.ceil(total / limit) || 1, limit }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getReferenceId,
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  getEventActivity
};
