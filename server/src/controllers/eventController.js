const mongoose = require('mongoose');
const { Event, EVENT_STATUS } = require('../models/Event');
const { Venue } = require('../models/Venue');
const { User } = require('../models/User');
const {
  isValidObjectId,
  validateEventInput
} = require('../utils/eventValidation');

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
  endDate
}) => {
  const conditions = [{ isArchived: false }];
  const isAdmin = user && user.role === 'administrator';
  const isOrganizer = user && user.role === 'organizer';

  // 1. Role-based visibility scoping
  if (isAdmin) {
    if (status) {
      conditions.push({ status });
    }
  } else if (isOrganizer) {
    if (organizer === 'me') {
      conditions.push({ organizer: user.id });
      if (status) {
        conditions.push({ status });
      }
    } else {
      // Organizer general browse: published events OR own events
      conditions.push({
        $or: [{ status: 'published' }, { organizer: user.id }]
      });
      if (status) {
        conditions.push({ status });
      }
    }
  } else {
    // Participant, vendor, or other roles: strictly published events
    conditions.push({ status: 'published' });
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

    // In-memory test store path
    if (mockStore) {
      let list = Array.from(mockStore.values());

      // Filter out archived unless admin explicitly queries
      list = list.filter((e) => !e.isArchived);

      // Access control filtering
      if (isAdmin) {
        if (status) {
          list = list.filter((e) => e.status === status);
        }
      } else if (isOrganizer) {
        if (organizer === 'me') {
          list = list.filter((e) => {
            const orgId = typeof e.organizer === 'object' ? (e.organizer.id || e.organizer._id) : e.organizer;
            return String(orgId) === user.id;
          });
          if (status) {
            list = list.filter((e) => e.status === status);
          }
        } else {
          // General browse: published events + own events
          list = list.filter((e) => {
            const orgId = typeof e.organizer === 'object' ? (e.organizer.id || e.organizer._id) : e.organizer;
            return e.status === 'published' || String(orgId) === user.id;
          });
          if (status) {
            list = list.filter((e) => e.status === status);
          }
        }
      } else {
        // Participant, vendor, or other roles: strictly published events
        list = list.filter((e) => e.status === 'published');
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
      const paginated = list.slice(skip, skip + limitNum).map((e) => populateMockEvent(e, req));

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
      data: events
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
        data: populateMockEvent(event, req)
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
      data: event
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

      return res.status(201).json({
        success: true,
        message: 'Event created successfully.',
        data: populateMockEvent(newEvent, req)
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

    return res.status(201).json({
      success: true,
      message: 'Event created successfully.',
      data: event
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
    const orgId = typeof existingEvent.organizer === 'object'
      ? (existingEvent.organizer.id || existingEvent.organizer._id)
      : existingEvent.organizer;

    if (!isAdmin && String(orgId) !== req.user.id) {
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

    // Mock store update path
    if (mockStore) {
      const updated = {
        ...existingEvent,
        ...sanitized,
        updatedAt: new Date()
      };
      mockStore.set(id, updated);

      return res.status(200).json({
        success: true,
        message: 'Event updated successfully.',
        data: populateMockEvent(updated, req)
      });
    }

    // Database path
    Object.assign(existingEvent, sanitized);
    await existingEvent.save();

    await existingEvent.populate('organizer', 'name email organization role phone');
    if (existingEvent.venue) {
      await existingEvent.populate('venue', 'name location capacity facilities hourlyRate status');
    }

    return res.status(200).json({
      success: true,
      message: 'Event updated successfully.',
      data: existingEvent
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

    // Ownership check
    const orgId = typeof existingEvent.organizer === 'object'
      ? (existingEvent.organizer.id || existingEvent.organizer._id)
      : existingEvent.organizer;

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

      const venueId = typeof existingEvent.venue === 'object' && existingEvent.venue
        ? (existingEvent.venue.id || existingEvent.venue._id)
        : existingEvent.venue;

      if (!venueId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot publish event without an assigned venue. Please select a venue first.'
        });
      }

      // TODO: Venue Booking Approval Check
      // Once the Venue Booking model and administrator booking approval workflow are implemented
      // (scheduled for Day 7), verify here that a confirmed, approved venue booking exists for this event
      // covering the event's startDateTime and endDateTime before allowing transition to 'published'.
      // Currently, only venue presence and existence are validated; booking approval is not yet enforced.
    }

    // Mock store update
    if (mockStore) {
      existingEvent.status = cleanStatus;
      existingEvent.updatedAt = new Date();
      mockStore.set(id, existingEvent);

      return res.status(200).json({
        success: true,
        message: `Event status successfully changed to '${cleanStatus}'.`,
        data: populateMockEvent(existingEvent, req)
      });
    }

    // Database update
    existingEvent.status = cleanStatus;
    await existingEvent.save();

    await existingEvent.populate('organizer', 'name email organization role phone');
    if (existingEvent.venue) {
      await existingEvent.populate('venue', 'name location capacity facilities hourlyRate status');
    }

    return res.status(200).json({
      success: true,
      message: `Event status successfully changed to '${cleanStatus}'.`,
      data: existingEvent
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
    const orgId = typeof existingEvent.organizer === 'object'
      ? (existingEvent.organizer.id || existingEvent.organizer._id)
      : existingEvent.organizer;

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
