const mongoose = require('mongoose');
const { Event, EVENT_STATUS } = require('../models/Event');
const { Venue } = require('../models/Venue');
const { User } = require('../models/User');
const { Booking } = require('../models/Booking');
const {
  recordEventActivity,
  notifyRegisteredParticipants
} = require('../services/workflowService');
const {
  isValidObjectId,
  validateEventInput
} = require('../utils/eventValidation');
const {
  DERIVED_EVENT_STATUSES,
  getEventLifecycleStatus,
  getEventLifecycleQuery
} = require('../utils/eventLifecycle');

/**
 * Accesses mock event store during in-memory automated tests.
 * Hardened to strictly return null in production environments.
 */
const getStore = (req) => {
  if (process.env.NODE_ENV === 'production') return null;
  return req.app && req.app.locals && req.app.locals.mockEventStore
    ? req.app.locals.mockEventStore
    : null;
};

const getVenueStore = (req) => {
  if (process.env.NODE_ENV === 'production') return null;
  return req.app && req.app.locals && req.app.locals.mockVenueStore
    ? req.app.locals.mockVenueStore
    : null;
};

const getUserStore = (req) => {
  if (process.env.NODE_ENV === 'production') return null;
  return req.app && req.app.locals && req.app.locals.mockUserStore
    ? req.app.locals.mockUserStore
    : null;
};

const getBookingStore = (req) => {
  if (process.env.NODE_ENV === 'production') return null;
  return req.app && req.app.locals && req.app.locals.mockBookingStore
    ? req.app.locals.mockBookingStore
    : null;
};

const getReferenceId = (reference) => {
  if (reference === null || reference === undefined) return '';
  if (typeof reference === 'string') return reference;
  if (typeof reference.toHexString === 'function') return reference.toHexString();
  if (typeof reference === 'object') {
    return getReferenceId(reference._id !== undefined ? reference._id : reference.id);
  }
  return String(reference);
};

const eventForReadResponse = (event, user) => {
  const serialized = event && typeof event.toObject === 'function'
    ? event.toObject()
    : { ...event };
  serialized.lifecycleStatus = getEventLifecycleStatus(serialized);
  const isOwnerOrganizer =
    user &&
    user.role === 'organizer' &&
    getReferenceId(event.organizer) === user.id;
  if (!user || (user.role !== 'administrator' && !isOwnerOrganizer)) {
    delete serialized.whatsappGroupUrl;
  }
  return serialized;
};

const recordCompletionIfDetected = async (req, event) => {
  if (!event || getEventLifecycleStatus(event) !== 'completed') return;
  const eventId = getReferenceId(event);
  await recordEventActivity(req, {
    eventId,
    actorId: null,
    action: 'event_completed',
    description: `Event "${event.title}" reached its scheduled completion time.`,
    dedupeKey: `event-completed:${eventId}`
  });
};

/**
 * Verifies whether an approved, non-archived venue booking exists for an event
 * that covers the event's complete time interval (bookingStart <= eventStart && bookingEnd >= eventEnd).
 */
const hasApprovedVenueBooking = async ({ eventId, venueId, startDateTime, endDateTime, req }) => {
  if (!eventId || !venueId || !startDateTime || !endDateTime) return false;

  const eventStart = new Date(startDateTime);
  const eventEnd = new Date(endDateTime);
  const bookingStore = getBookingStore(req);

  if (bookingStore) {
    for (const booking of bookingStore.values()) {
      const bEventId = typeof booking.event === 'object' && booking.event ? (booking.event.id || booking.event._id) : booking.event;
      const bVenueId = typeof booking.venue === 'object' && booking.venue ? (booking.venue.id || booking.venue._id) : booking.venue;

      if (
        String(bEventId) === String(eventId) &&
        String(bVenueId) === String(venueId) &&
        booking.status === 'approved' &&
        !booking.isArchived
      ) {
        const bStart = new Date(booking.startDateTime);
        const bEnd = new Date(booking.endDateTime);
        if (bStart <= eventStart && bEnd >= eventEnd) {
          return true;
        }
      }
    }
    return false;
  }

  if (mongoose.connection.readyState === 1) {
    const booking = await Booking.findOne({
      event: eventId,
      venue: venueId,
      status: 'approved',
      isArchived: false,
      startDateTime: { $lte: eventStart },
      endDateTime: { $gte: eventEnd }
    });
    return !!booking;
  }

  return false;
};

/**
 * Helper to populate organizer and venue in mock objects for test consistency
 */
const populateMockEvent = (event, req) => {
  const userStore = getUserStore(req);
  const venueStore = getVenueStore(req);

  const populated = { ...event };

  if (typeof populated.organizer === 'string' && userStore) {
    const user = userStore.get(populated.organizer);
    if (user) {
      populated.organizer = {
        id: user.id || user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        organization: user.organization || ''
      };
    }
  }

  if (typeof populated.venue === 'string' && venueStore) {
    const venue = venueStore.get(populated.venue);
    if (venue) {
      populated.venue = {
        id: venue.id || venue._id,
        name: venue.name,
        location: venue.location,
        capacity: venue.capacity,
        facilities: venue.facilities || [],
        hourlyRate: venue.hourlyRate || 0,
        status: venue.status
      };
    }
  }

  return populated;
};

/**
 * Constructs a secure MongoDB query filter ensuring access-control visibility
 * is combined using $and so it is never overwritten or weakened by search or attribute filters.
 *
 * @param {Object} params
 * @param {Object} params.user - Authenticated user context
 * @param {string} [params.search] - Text search keyword
 * @param {string} [params.category] - Event category
 * @param {string} [params.status] - Event status filter
 * @param {string} [params.venue] - Venue ObjectId
 * @param {string} [params.organizer] - 'me' or specific organizer ObjectId
 * @param {string|Date} [params.startDate] - Start date filter
 * @param {string|Date} [params.endDate] - End date filter
 * @returns {Object} MongoDB query object
 */
const buildEventQuery = ({
  user,
  search,
  category,
  status,
  venue,
  organizer,
  startDate,
  endDate,
  now
}) => {
  const conditions = [{ isArchived: false }];
  const isAdmin = user && user.role === 'administrator';
  const isOrganizer = user && user.role === 'organizer';

  // 1. Role-based visibility scoping
  if (isAdmin) {
    // Administrator visibility is unrestricted apart from the requested filters.
  } else if (isOrganizer) {
    if (organizer === 'me') {
      conditions.push({ organizer: user.id });
    } else {
      // Organizer general browse: published events OR own events
      conditions.push({
        $or: [{ status: 'published' }, { organizer: user.id }]
      });
    }
  } else {
    // Participant, vendor, or other roles: strictly published events
    conditions.push({ status: 'published' });
  }

  if (status) {
    conditions.push(
      DERIVED_EVENT_STATUSES.includes(status)
        ? getEventLifecycleQuery(status, now)
        : { status }
    );
  }

  // 2. Specific organizer filter if provided by admin or filtered by user
  if (organizer && organizer !== 'me') {
    if (isValidObjectId(organizer)) {
      conditions.push({ organizer });
    }
  }

  // 3. Keyword search across title, description, or tags (escaped for regex safety)
  if (search && search.trim()) {
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    conditions.push({
      $or: [
        { title: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
        { tags: { $regex: escaped, $options: 'i' } }
      ]
    });
  }

  // 4. Category filter
  if (category && category.trim()) {
    conditions.push({ category: category.trim().toLowerCase() });
  }

  // 5. Venue filter
  if (venue && isValidObjectId(venue)) {
    conditions.push({ venue });
  }

  // 6. Date range filters on startDateTime
  if (startDate || endDate) {
    const dateCond = {};
    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) dateCond.$gte = start;
    }
    if (endDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) dateCond.$lte = end;
    }
    if (Object.keys(dateCond).length > 0) {
      conditions.push({ startDateTime: dateCond });
    }
  }

  return conditions.length === 1 ? conditions[0] : { $and: conditions };
};

/**
 * GET /api/events
 * Browse events with search, category, status, organizer, venue, and date filters.
 */
const getEvents = async (req, res, next) => {
  try {
    const {
      search,
      category,
      status,
      venue,
      organizer,
      startDate,
      endDate,
      page = 1,
      limit = 10
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const user = req.user;
    const isAdmin = user && user.role === 'administrator';
    const isOrganizer = user && user.role === 'organizer';
    const mockStore = getStore(req);
    const now = new Date();

    // In-memory test store path
    if (mockStore) {
      let list = Array.from(mockStore.values());

      // Filter out archived unless admin explicitly queries
      list = list.filter((e) => !e.isArchived);

      // Access control filtering
      if (!isAdmin) {
        if (isOrganizer) {
          if (organizer === 'me') {
            list = list.filter((e) => {
              const orgId = typeof e.organizer === 'object' ? (e.organizer.id || e.organizer._id) : e.organizer;
              return String(orgId) === user.id;
            });
          } else {
            // General browse: published events + own events
            list = list.filter((e) => {
              const orgId = typeof e.organizer === 'object' ? (e.organizer.id || e.organizer._id) : e.organizer;
              return e.status === 'published' || String(orgId) === user.id;
            });
          }
        } else {
          // Participant, vendor, or other roles: strictly published events
          list = list.filter((e) => e.status === 'published');
        }
      }

      if (status) {
        list = list.filter((event) => (
          DERIVED_EVENT_STATUSES.includes(status)
            ? getEventLifecycleStatus(event, now) === status
            : event.status === status
        ));
      }

      // Keyword search
      if (search && search.trim()) {
        const query = search.trim().toLowerCase();
        list = list.filter(
          (e) =>
            e.title.toLowerCase().includes(query) ||
            e.description.toLowerCase().includes(query) ||
            (Array.isArray(e.tags) && e.tags.some((t) => t.toLowerCase().includes(query)))
        );
      }

      // Category filter
      if (category && category.trim()) {
        list = list.filter((e) => e.category === category.trim().toLowerCase());
      }

      // Venue filter
      if (venue && venue.trim()) {
        list = list.filter((e) => {
          const vId = typeof e.venue === 'object' && e.venue ? (e.venue.id || e.venue._id) : e.venue;
          return String(vId) === venue.trim();
        });
      }

      // Date range filter
      if (startDate) {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) {
          list = list.filter((e) => new Date(e.startDateTime) >= start);
        }
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
          list = list.filter((e) => new Date(e.startDateTime) <= end);
        }
      }

      // Sort by startDateTime ascending
      list.sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime));

      const total = list.length;
      const paginated = list
        .slice(skip, skip + limitNum)
        .map((event) => eventForReadResponse(populateMockEvent(event, req), user));

      return res.status(200).json({
        success: true,
        count: paginated.length,
        pagination: {
          total,
          page: pageNum,
          pages: Math.ceil(total / limitNum) || 1,
          limit: limitNum
        },
        data: paginated
      });
    }

    // Database Mongoose Path
    const query = buildEventQuery({
      user,
      search,
      category,
      status,
      venue,
      organizer,
      startDate,
      endDate
    });

    const total = await Event.countDocuments(query);
    const events = await Event.find(query)
      .sort({ startDateTime: 1 })
      .skip(skip)
      .limit(limitNum)
      .populate('organizer', 'name email organization role phone')
      .populate('venue', 'name location capacity facilities hourlyRate status');

    return res.status(200).json({
      success: true,
      count: events.length,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum) || 1,
        limit: limitNum
      },
      data: events.map((event) => eventForReadResponse(event, user))
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/events/:id
 * Get single event details with populated organizer and venue.
 */
const getEventById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID format.'
      });
    }

    const user = req.user;
    const isAdmin = user && user.role === 'administrator';
    const mockStore = getStore(req);

    let event = null;

    if (mockStore) {
      event = mockStore.get(id);
      if (!event || event.isArchived) {
        return res.status(404).json({
          success: false,
          message: 'Event not found.'
        });
      }

      // Check access permission for draft/cancelled events
      if (event.status !== 'published') {
        const orgId = typeof event.organizer === 'object' ? (event.organizer.id || event.organizer._id) : event.organizer;
        const isOwner = user && String(orgId) === user.id;

        if (!isAdmin && !isOwner) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. You do not have permission to view this unpublished event.'
          });
        }
      }

      return res.status(200).json({
        success: true,
        data: eventForReadResponse(populateMockEvent(event, req), user)
      });
    }

    // Database path
    event = await Event.findOne({ _id: id, isArchived: false })
      .populate('organizer', 'name email organization role phone')
      .populate('venue', 'name location capacity facilities hourlyRate status');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found.'
      });
    }

    // Access check for non-published events
    if (event.status !== 'published') {
      const orgId = event.organizer._id ? event.organizer._id.toString() : event.organizer.toString();
      const isOwner = user && orgId === user.id;

      if (!isAdmin && !isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You do not have permission to view this unpublished event.'
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: eventForReadResponse(event, user)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/events
 * Create new event (Restricted to organizer and administrator).
 */
const createEvent = async (req, res, next) => {
  try {
    const { isValid, errors, sanitized } = validateEventInput(req.body, false);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed. Please correct the highlighted errors.',
        errors
      });
    }

    // Authoritative organizer derivation: organizer role can only create for self
    const organizerId = req.user.role === 'administrator' && req.body.organizer && isValidObjectId(req.body.organizer)
      ? req.body.organizer
      : req.user.id;

    const mockStore = getStore(req);

    // Verify venue if specified
    if (sanitized.venue) {
      const venueStore = getVenueStore(req);
      if (venueStore) {
        const v = venueStore.get(sanitized.venue);
        if (!v || v.isArchived) {
          return res.status(400).json({
            success: false,
            message: 'Referenced venue does not exist or is no longer available.'
          });
        }
      } else if (mongoose.connection.readyState === 1) {
        const venueDoc = await Venue.findOne({ _id: sanitized.venue, isArchived: false });
        if (!venueDoc) {
          return res.status(400).json({
            success: false,
            message: 'Referenced venue does not exist or is no longer available.'
          });
        }
      }
    }

    if (sanitized.status === 'published') {
      return res.status(400).json({
        success: false,
        message: 'Cannot create an event directly as published. Please create a draft and obtain an approved venue booking first.'
      });
    }

    // Mock store creation path
    if (mockStore) {
      const newId = new mongoose.Types.ObjectId().toString();
      const newEvent = {
        id: newId,
        _id: newId,
        ...sanitized,
        organizer: organizerId,
        status: sanitized.status || 'draft',
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockStore.set(newId, newEvent);
      await recordEventActivity(req, {
        eventId: newId,
        actorId: req.user.id,
        action: 'event_created',
        description: `Event "${newEvent.title}" was created.`,
        dedupeKey: `event-created:${newId}`
      });

      return res.status(201).json({
        success: true,
        message: 'Event created successfully.',
        data: eventForReadResponse(populateMockEvent(newEvent, req), req.user)
      });
    }

    // Database path
    const event = new Event({
      ...sanitized,
      organizer: organizerId,
      status: sanitized.status || 'draft'
    });

    await event.save();
    await event.populate('organizer', 'name email organization role phone');
    if (event.venue) {
      await event.populate('venue', 'name location capacity facilities hourlyRate status');
    }
    await recordEventActivity(req, {
      eventId: event._id,
      actorId: req.user.id,
      action: 'event_created',
      description: `Event "${event.title}" was created.`,
      dedupeKey: `event-created:${event._id}`
    });

    return res.status(201).json({
      success: true,
      message: 'Event created successfully.',
      data: eventForReadResponse(event, req.user)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/events/:id
 * Update event details (Owner organizer or administrator only).
 */
const updateEvent = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID format.'
      });
    }

    const mockStore = getStore(req);
    const isAdmin = req.user && req.user.role === 'administrator';

    let existingEvent = null;

    if (mockStore) {
      existingEvent = mockStore.get(id);
    } else {
      existingEvent = await Event.findOne({ _id: id, isArchived: false });
    }

    if (!existingEvent || existingEvent.isArchived) {
      return res.status(404).json({
        success: false,
        message: 'Event not found.'
      });
    }

    // Ownership check
    const orgId = getReferenceId(existingEvent.organizer);

    if (!isAdmin && orgId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You are not authorized to update this event.'
      });
    }

    // Validate update fields against existing record
    const { isValid, errors, sanitized } = validateEventInput(req.body, true, existingEvent);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed. Please correct the highlighted errors.',
        errors
      });
    }

    const importantFields = ['title', 'description', 'category', 'startDateTime', 'endDateTime', 'venue'];
    const changedImportantFields = importantFields.filter((field) =>
      sanitized[field] !== undefined &&
      String(getReferenceId(sanitized[field])) !== String(getReferenceId(existingEvent[field]))
    );
    const previousStatus = existingEvent.status;
    const completedSnapshot = getEventLifecycleStatus(existingEvent) === 'completed'
      ? (typeof existingEvent.toObject === 'function' ? existingEvent.toObject() : { ...existingEvent })
      : null;

    if (
      getEventLifecycleStatus(existingEvent) === 'completed' &&
      (sanitized.startDateTime !== undefined || sanitized.endDateTime !== undefined)
    ) {
      return res.status(400).json({
        success: false,
        message: 'The schedule of a completed event cannot be changed.'
      });
    }

    // Verify venue if changed
    if (sanitized.venue !== undefined && sanitized.venue !== null) {
      const venueStore = getVenueStore(req);
      if (venueStore) {
        const v = venueStore.get(sanitized.venue);
        if (!v || v.isArchived) {
          return res.status(400).json({
            success: false,
            message: 'Referenced venue does not exist or is no longer available.'
          });
        }
      } else if (mongoose.connection.readyState === 1) {
        const venueDoc = await Venue.findOne({ _id: sanitized.venue, isArchived: false });
        if (!venueDoc) {
          return res.status(400).json({
            success: false,
            message: 'Referenced venue does not exist or is no longer available.'
          });
        }
      }
    }

    // Calculate effective event status, venue, and dates
    const effectiveStatus = sanitized.status !== undefined ? sanitized.status : existingEvent.status;
    const effectiveVenue = sanitized.venue !== undefined ? sanitized.venue : existingEvent.venue;
    const effectiveStart = sanitized.startDateTime !== undefined ? sanitized.startDateTime : existingEvent.startDateTime;
    const effectiveEnd = sanitized.endDateTime !== undefined ? sanitized.endDateTime : existingEvent.endDateTime;

    if (effectiveStatus === 'published') {
      const venueId = typeof effectiveVenue === 'object' && effectiveVenue
        ? (effectiveVenue.id || effectiveVenue._id)
        : effectiveVenue;

      if (!venueId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot maintain or set published status for an event without an assigned venue. Please select a venue first.'
        });
      }

      // Check if any publishing, venue, or scheduling details are changing or being set to published
      const isPublishTransition = sanitized.status === 'published' && existingEvent.status !== 'published';
      const isVenueChanged = sanitized.venue !== undefined;
      const isDateChanged = sanitized.startDateTime !== undefined || sanitized.endDateTime !== undefined;

      // If transitioning to published OR if already published and changing venue or dates:
      if (isPublishTransition || isVenueChanged || isDateChanged) {
        const hasApproval = await hasApprovedVenueBooking({
          eventId: id,
          venueId,
          startDateTime: effectiveStart,
          endDateTime: effectiveEnd,
          req
        });

        if (!hasApproval) {
          return res.status(400).json({
            success: false,
            message: 'Cannot update event. An approved venue booking covering the complete event duration is required for published events.'
          });
        }
      }
    }

    // Mock store update path
    if (mockStore) {
      const updated = {
        ...existingEvent,
        ...sanitized,
        updatedAt: new Date()
      };
      mockStore.set(id, updated);
      const eventVersion = new Date(updated.updatedAt).getTime();
      if (changedImportantFields.length > 0) {
        await recordEventActivity(req, {
          eventId: id,
          actorId: req.user.id,
          action: 'event_updated',
          description: `Event "${updated.title}" was updated.`,
          dedupeKey: `event-updated:${id}:${eventVersion}`
        });
        await notifyRegisteredParticipants(req, id, {
          actorId: req.user.id,
          type: 'event_updated',
          title: 'Event updated',
          message: `"${updated.title}" has important updates.`,
          entityType: 'event',
          entityId: id,
          dedupeKey: `event-updated:${id}:${eventVersion}`
        });
      }
      if (previousStatus !== 'published' && updated.status === 'published') {
        await recordEventActivity(req, {
          eventId: id,
          actorId: req.user.id,
          action: 'event_published',
          description: `Event "${updated.title}" was published.`,
          metadata: { status: 'published' },
          dedupeKey: `event-published:${id}:${eventVersion}`
        });
        await notifyRegisteredParticipants(req, id, {
          actorId: req.user.id,
          type: 'event_published',
          title: 'Event published',
          message: `"${updated.title}" is now published.`,
          entityType: 'event',
          entityId: id,
          dedupeKey: `event-published:${id}:${eventVersion}`
        });
      }
      if (previousStatus !== 'cancelled' && updated.status === 'cancelled') {
        await recordEventActivity(req, {
          eventId: id,
          actorId: req.user.id,
          action: 'event_cancelled',
          description: `Event "${updated.title}" was cancelled.`,
          metadata: { status: 'cancelled' },
          dedupeKey: `event-cancelled:${id}:${eventVersion}`
        });
        await notifyRegisteredParticipants(req, id, {
          actorId: req.user.id,
          type: 'event_cancelled',
          title: 'Event cancelled',
          message: `"${updated.title}" has been cancelled.`,
          entityType: 'event',
          entityId: id,
          dedupeKey: `event-cancelled:${id}:${eventVersion}`
        });
      }
      await recordCompletionIfDetected(req, completedSnapshot || updated);

      return res.status(200).json({
        success: true,
        message: 'Event updated successfully.',
        data: eventForReadResponse(populateMockEvent(updated, req), req.user)
      });
    }

    // Database path
    Object.assign(existingEvent, sanitized);
    await existingEvent.save();

    await existingEvent.populate('organizer', 'name email organization role phone');
    if (existingEvent.venue) {
      await existingEvent.populate('venue', 'name location capacity facilities hourlyRate status');
    }
    const eventVersion = new Date(existingEvent.updatedAt || Date.now()).getTime();
    if (changedImportantFields.length > 0) {
      await recordEventActivity(req, {
        eventId: id,
        actorId: req.user.id,
        action: 'event_updated',
        description: `Event "${existingEvent.title}" was updated.`,
        dedupeKey: `event-updated:${id}:${eventVersion}`
      });
      await notifyRegisteredParticipants(req, id, {
        actorId: req.user.id,
        type: 'event_updated',
        title: 'Event updated',
        message: `"${existingEvent.title}" has important updates.`,
        entityType: 'event',
        entityId: id,
        dedupeKey: `event-updated:${id}:${eventVersion}`
      });
    }
    if (previousStatus !== 'published' && existingEvent.status === 'published') {
      await recordEventActivity(req, {
        eventId: id,
        actorId: req.user.id,
        action: 'event_published',
        description: `Event "${existingEvent.title}" was published.`,
        metadata: { status: 'published' },
        dedupeKey: `event-published:${id}:${eventVersion}`
      });
      await notifyRegisteredParticipants(req, id, {
        actorId: req.user.id,
        type: 'event_published',
        title: 'Event published',
        message: `"${existingEvent.title}" is now published.`,
        entityType: 'event',
        entityId: id,
        dedupeKey: `event-published:${id}:${eventVersion}`
      });
    }
    if (previousStatus !== 'cancelled' && existingEvent.status === 'cancelled') {
      await recordEventActivity(req, {
        eventId: id,
        actorId: req.user.id,
        action: 'event_cancelled',
        description: `Event "${existingEvent.title}" was cancelled.`,
        metadata: { status: 'cancelled' },
        dedupeKey: `event-cancelled:${id}:${eventVersion}`
      });
      await notifyRegisteredParticipants(req, id, {
        actorId: req.user.id,
        type: 'event_cancelled',
        title: 'Event cancelled',
        message: `"${existingEvent.title}" has been cancelled.`,
        entityType: 'event',
        entityId: id,
        dedupeKey: `event-cancelled:${id}:${eventVersion}`
      });
    }
    await recordCompletionIfDetected(req, completedSnapshot || existingEvent);

    return res.status(200).json({
      success: true,
      message: 'Event updated successfully.',
      data: eventForReadResponse(existingEvent, req.user)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/events/:id/status
 * Update event lifecycle status ('draft', 'published', 'cancelled').
 */
const updateEventStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID format.'
      });
    }

    if (!status || !EVENT_STATUS.includes(String(status).trim().toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid event status. Allowed values: ${EVENT_STATUS.join(', ')}.`
      });
    }

    const cleanStatus = String(status).trim().toLowerCase();
    const mockStore = getStore(req);
    const isAdmin = req.user && req.user.role === 'administrator';

    let existingEvent = null;
    if (mockStore) {
      existingEvent = mockStore.get(id);
    } else {
      existingEvent = await Event.findOne({ _id: id, isArchived: false });
    }

    if (!existingEvent || existingEvent.isArchived) {
      return res.status(404).json({
        success: false,
        message: 'Event not found.'
      });
    }
    const previousStatus = existingEvent.status;
    const completedSnapshot = getEventLifecycleStatus(existingEvent) === 'completed'
      ? (typeof existingEvent.toObject === 'function' ? existingEvent.toObject() : { ...existingEvent })
      : null;

    // Ownership check
    const orgId = getReferenceId(existingEvent.organizer);

    if (!isAdmin && String(orgId) !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You are not authorized to update this event.'
      });
    }

    // If publishing, ensure core fields and an assigned venue are present
    if (cleanStatus === 'published') {
      if (!existingEvent.title || !existingEvent.startDateTime || !existingEvent.endDateTime || !existingEvent.capacity) {
        return res.status(400).json({
          success: false,
          message: 'Cannot publish event. Missing required details: title, dates, or capacity.'
        });
      }

      const venueId = getReferenceId(existingEvent.venue);

      if (!venueId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot publish event without an assigned venue. Please select a venue first.'
        });
      }

      // Venue Booking Approval Enforcement:
      // An event with an assigned venue cannot be published unless an approved, non-archived booking exists
      // for this event and venue that covers the event's complete time interval.
      const hasApproval = await hasApprovedVenueBooking({
        eventId: id,
        venueId,
        startDateTime: existingEvent.startDateTime,
        endDateTime: existingEvent.endDateTime,
        req
      });

      if (!hasApproval) {
        return res.status(400).json({
          success: false,
          message: 'Cannot publish event. An approved venue booking covering the complete event duration is required before publishing.'
        });
      }
    }

    // Mock store update
    if (mockStore) {
      existingEvent.status = cleanStatus;
      existingEvent.updatedAt = new Date();
      mockStore.set(id, existingEvent);
      if (previousStatus !== cleanStatus) {
        const eventVersion = new Date(existingEvent.updatedAt).getTime();
        const action = cleanStatus === 'published' ? 'event_published' :
          cleanStatus === 'cancelled' ? 'event_cancelled' : 'event_updated';
        await recordEventActivity(req, {
          eventId: id,
          actorId: req.user.id,
          action,
          description: `Event "${existingEvent.title}" was ${cleanStatus === 'published' ? 'published' : cleanStatus === 'cancelled' ? 'cancelled' : 'returned to draft'}.`,
          metadata: { status: cleanStatus },
          dedupeKey: `event-status:${id}:${eventVersion}:${cleanStatus}`
        });
        if (cleanStatus === 'published' || cleanStatus === 'cancelled') {
          await notifyRegisteredParticipants(req, id, {
            actorId: req.user.id,
            type: cleanStatus === 'published' ? 'event_published' : 'event_cancelled',
            title: cleanStatus === 'published' ? 'Event published' : 'Event cancelled',
            message: cleanStatus === 'published'
              ? `"${existingEvent.title}" is now published.`
              : `"${existingEvent.title}" has been cancelled.`,
            entityType: 'event',
            entityId: id,
            dedupeKey: `event-status:${id}:${eventVersion}:${cleanStatus}`
          });
        }
      }
      await recordCompletionIfDetected(req, completedSnapshot || existingEvent);

      return res.status(200).json({
        success: true,
        message: `Event status successfully changed to '${cleanStatus}'.`,
        data: eventForReadResponse(populateMockEvent(existingEvent, req), req.user)
      });
    }

    // Database update
    existingEvent.status = cleanStatus;
    await existingEvent.save();

    await existingEvent.populate('organizer', 'name email organization role phone');
    if (existingEvent.venue) {
      await existingEvent.populate('venue', 'name location capacity facilities hourlyRate status');
    }
    if (previousStatus !== cleanStatus) {
      const eventVersion = new Date(existingEvent.updatedAt || Date.now()).getTime();
      const action = cleanStatus === 'published' ? 'event_published' :
        cleanStatus === 'cancelled' ? 'event_cancelled' : 'event_updated';
      await recordEventActivity(req, {
        eventId: id,
        actorId: req.user.id,
        action,
        description: `Event "${existingEvent.title}" was ${cleanStatus === 'published' ? 'published' : cleanStatus === 'cancelled' ? 'cancelled' : 'returned to draft'}.`,
        metadata: { status: cleanStatus },
        dedupeKey: `event-status:${id}:${eventVersion}:${cleanStatus}`
      });
      if (cleanStatus === 'published' || cleanStatus === 'cancelled') {
        await notifyRegisteredParticipants(req, id, {
          actorId: req.user.id,
          type: cleanStatus === 'published' ? 'event_published' : 'event_cancelled',
          title: cleanStatus === 'published' ? 'Event published' : 'Event cancelled',
          message: cleanStatus === 'published'
            ? `"${existingEvent.title}" is now published.`
            : `"${existingEvent.title}" has been cancelled.`,
          entityType: 'event',
          entityId: id,
          dedupeKey: `event-status:${id}:${eventVersion}:${cleanStatus}`
        });
      }
    }
    await recordCompletionIfDetected(req, completedSnapshot || existingEvent);

    return res.status(200).json({
      success: true,
      message: `Event status successfully changed to '${cleanStatus}'.`,
      data: eventForReadResponse(existingEvent, req.user)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/events/:id
 * Soft archive an event (Owner organizer or administrator only).
 */
const deleteEvent = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID format.'
      });
    }

    const mockStore = getStore(req);
    const isAdmin = req.user && req.user.role === 'administrator';

    let existingEvent = null;
    if (mockStore) {
      existingEvent = mockStore.get(id);
    } else {
      existingEvent = await Event.findOne({ _id: id, isArchived: false });
    }

    if (!existingEvent || existingEvent.isArchived) {
      return res.status(404).json({
        success: false,
        message: 'Event not found.'
      });
    }

    // Ownership check
    const orgId = getReferenceId(existingEvent.organizer);

    if (!isAdmin && String(orgId) !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You are not authorized to delete this event.'
      });
    }

    // Soft archive
    if (mockStore) {
      existingEvent.isArchived = true;
      existingEvent.updatedAt = new Date();
      mockStore.set(id, existingEvent);

      return res.status(200).json({
        success: true,
        message: 'Event archived successfully.'
      });
    }

    existingEvent.isArchived = true;
    await existingEvent.save();

    return res.status(200).json({
      success: true,
      message: 'Event archived successfully.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  buildEventQuery,
  getStore,
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  updateEventStatus,
  deleteEvent
};
