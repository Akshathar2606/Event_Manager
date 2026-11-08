const mongoose = require('mongoose');
const { Registration, ATTENDANCE_STATUS } = require('../models/Registration');
const { Event } = require('../models/Event');
const {
  deliverNotification,
  recordEventActivity
} = require('../services/workflowService');
const { User } = require('../models/User');
const { Venue } = require('../models/Venue');
const { getEventLifecycleStatus } = require('../utils/eventLifecycle');
const {
  isValidObjectId,
  STUDENT_YEARS,
  validateRegistrationInput,
  validateCancellationInput,
  validateRegistrationQuery
} = require('../utils/registrationValidation');

/**
 * Accesses mock registration store during in-memory automated tests.
 * Hardened to strictly return null in production environments.
 */
const getStore = (req) => {
  if (process.env.NODE_ENV === 'production') return null;
  return req.app && req.app.locals && req.app.locals.mockRegistrationStore
    ? req.app.locals.mockRegistrationStore
    : null;
};

const getEventStore = (req) => {
  if (process.env.NODE_ENV === 'production') return null;
  return req.app && req.app.locals && req.app.locals.mockEventStore
    ? req.app.locals.mockEventStore
    : null;
};

const getUserStore = (req) => {
  if (process.env.NODE_ENV === 'production') return null;
  return req.app && req.app.locals && req.app.locals.mockUserStore
    ? req.app.locals.mockUserStore
    : null;
};

const getVenueStore = (req) => {
  if (process.env.NODE_ENV === 'production') return null;
  return req.app && req.app.locals && req.app.locals.mockVenueStore
    ? req.app.locals.mockVenueStore
    : null;
};

const getReferenceId = (reference) => {
  if (reference === null || reference === undefined) return '';
  if (typeof reference === 'string') return reference;
  if (typeof reference.toHexString === 'function') return reference.toHexString();
  if (typeof reference === 'object') {
    const nested = reference._id !== undefined ? reference._id : reference.id;
    return nested === reference ? '' : getReferenceId(nested);
  }
  return String(reference);
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const matchesAttendeeFilters = (registration, filters, req) => {
  const participant = registration.participant || {};
  const search = filters.search.toLowerCase();
  const matchesSearch = !search ||
    String(participant.name || '').toLowerCase().includes(search) ||
    String(participant.email || '').toLowerCase().includes(search);
  const matchesDepartment = !filters.department ||
    String(participant.organization || '').toLowerCase().includes(filters.department.toLowerCase());
  const registeredAt = new Date(registration.registeredAt || registration.createdAt);
  const matchesFrom = !filters.dateFrom || registeredAt >= filters.dateFrom;
  const matchesTo = !filters.dateTo || registeredAt <= filters.dateTo;
  return matchesSearch && matchesDepartment && matchesFrom && matchesTo &&
    (!filters.status || registration.status === filters.status) &&
    (!filters.attendanceStatus ||
      (registration.attendanceStatus || 'not_marked') === filters.attendanceStatus);
};

const sortAttendees = (attendees, sortBy, sortOrder) => {
  const direction = sortOrder === 'asc' ? 1 : -1;
  const values = {
    registeredAt: (registration) => new Date(registration.registeredAt || registration.createdAt || 0).getTime(),
    name: (registration) => registration.participant?.name || '',
    email: (registration) => registration.participant?.email || '',
    organization: (registration) => registration.participant?.organization || '',
    status: (registration) => registration.status || '',
    attendanceStatus: (registration) => registration.attendanceStatus || 'not_marked',
    academicYear: (registration) => registration.academicYear || ''
  };
  const getValue = values[sortBy] || values.registeredAt;
  return attendees.sort((left, right) => {
    const a = getValue(left);
    const b = getValue(right);
    const compared = typeof a === 'number' && typeof b === 'number'
      ? a - b
      : String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
    return compared * direction ||
      String(left.id || left._id).localeCompare(String(right.id || right._id));
  });
};

const getAttendeeQueryFilter = async (filters, eventId) => {
  const query = {
    event: new mongoose.Types.ObjectId(eventId),
    isArchived: false
  };
  if (filters.status) query.status = filters.status;
  if (filters.attendanceStatus === 'not_marked') {
    query.$or = [
      { attendanceStatus: 'not_marked' },
      { attendanceStatus: { $exists: false } },
      { attendanceStatus: null }
    ];
  } else if (filters.attendanceStatus) {
    query.attendanceStatus = filters.attendanceStatus;
  }
  if (filters.dateFrom || filters.dateTo) {
    query.registeredAt = {};
    if (filters.dateFrom) query.registeredAt.$gte = filters.dateFrom;
    if (filters.dateTo) query.registeredAt.$lte = filters.dateTo;
  }
  if (filters.search || filters.department) {
    const userQuery = {};
    const conditions = [];
    if (filters.search) {
      const search = new RegExp(escapeRegex(filters.search), 'i');
      conditions.push({ $or: [{ name: search }, { email: search }] });
    }
    if (filters.department) {
      conditions.push({ organization: new RegExp(escapeRegex(filters.department), 'i') });
    }
    if (conditions.length === 1) Object.assign(userQuery, conditions[0]);
    else userQuery.$and = conditions;
    const participantIds = await User.find(userQuery).distinct('_id');
    query.participant = { $in: participantIds };
  }
  return query;
};

/**
 * Helper to populate event, venue, and participant in mock objects for test consistency
 */
const populateMockRegistration = (registration, req) => {
  const eventStore = getEventStore(req);
  const userStore = getUserStore(req);
  const venueStore = getVenueStore(req);

  const populated = { ...registration };

  // Populate Event
  const eventId = typeof populated.event === 'object' && populated.event
    ? (populated.event.id || populated.event._id)
    : populated.event;

  if (typeof eventId === 'string' && eventStore) {
    const event = eventStore.get(eventId);
    if (event) {
      const populatedEvent = {
        id: event.id || event._id,
        _id: event.id || event._id,
        title: event.title,
        category: event.category,
        startDateTime: event.startDateTime,
        endDateTime: event.endDateTime,
        registrationDeadline: event.registrationDeadline,
        capacity: event.capacity,
        registeredCount: event.registeredCount !== undefined ? event.registeredCount : 0,
        status: event.status,
        lifecycleStatus: getEventLifecycleStatus(event)
      };

      const venueId = typeof event.venue === 'object' && event.venue
        ? (event.venue.id || event.venue._id)
        : event.venue;

      if (typeof venueId === 'string' && venueStore) {
        const venue = venueStore.get(venueId);
        if (venue) {
          populatedEvent.venue = {
            id: venue.id || venue._id,
            _id: venue.id || venue._id,
            name: venue.name,
            location: venue.location,
            capacity: venue.capacity
          };
        }
      } else {
        populatedEvent.venue = event.venue;
      }

      populated.event = populatedEvent;
    }
  }

  // Populate Participant
  const participantId = typeof populated.participant === 'object' && populated.participant
    ? (populated.participant.id || populated.participant._id)
    : populated.participant;

  if (typeof participantId === 'string' && userStore) {
    const participant = userStore.get(participantId);
    if (participant) {
      populated.participant = {
        id: participant.id || participant._id,
        _id: participant.id || participant._id,
        name: participant.name,
        email: participant.email,
        role: participant.role,
        organization: participant.organization || '',
        phone: participant.phone || '',
        isActive: participant.isActive !== undefined ? participant.isActive : true
      };
    }
  }

  return populated;
};

/**
 * Helper to fetch event from mock or database
 */
const fetchEvent = async (eventId, req) => {
  const eventStore = getEventStore(req);
  if (eventStore) {
    return eventStore.get(eventId) || null;
  }
  if (mongoose.connection.readyState === 1) {
    return await Event.findOne({ _id: eventId, isArchived: false });
  }
  return null;
};

/**
 * POST /api/events/:id/register
 * POST /api/registrations
 * Register authenticated participant for an event.
 */
const registerForEvent = async (req, res, next) => {
  try {
    // 1. Role verification: Only participant role allowed
    if (!req.user || req.user.role !== 'participant') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. Only participants can register for events.'
      });
    }

    const participantId = req.user.id;
    const effectiveEventId = req.params.id || req.body.event || req.body.eventId;

    if (!effectiveEventId || !isValidObjectId(effectiveEventId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event reference ID format.'
      });
    }

    const mockStore = getStore(req);
    const eventStore = getEventStore(req);

    // 2. Fetch and validate event eligibility
    let event = null;
    if (eventStore) {
      event = eventStore.get(effectiveEventId);
    } else if (mongoose.connection.readyState === 1) {
      event = await Event.findOne({ _id: effectiveEventId, isArchived: false });
    }

    if (!event || event.isArchived) {
      return res.status(404).json({
        success: false,
        message: 'Event not found.'
      });
    }

    if (event.status !== 'published') {
      return res.status(400).json({
        success: false,
        message: 'Cannot register for an event that is not published.'
      });
    }

    const now = new Date();

    // Check if event has already started
    if (new Date(event.startDateTime) <= now) {
      return res.status(400).json({
        success: false,
        message: 'Cannot register for an event that has already started.'
      });
    }

    // Check registration deadline if specified
    if (event.registrationDeadline && new Date(event.registrationDeadline) < now) {
      return res.status(400).json({
        success: false,
        message: 'Registration deadline for this event has passed.'
      });
    }

    const registrationValidation = validateRegistrationInput({
      event: effectiveEventId,
      academicYear: req.body?.academicYear
    });
    if (!registrationValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors: registrationValidation.errors
      });
    }

    const academicYear = registrationValidation.sanitized.academicYear;
    const eventEligibleYears = Array.isArray(event.eligibleYears)
      ? event.eligibleYears
      : STUDENT_YEARS;
    if (!eventEligibleYears.includes(academicYear)) {
      return res.status(400).json({
        success: false,
        message: 'Your current academic year is not eligible for this event.'
      });
    }

    // 3. Handle registration in Mock Store environment
    if (mockStore) {
      // Find existing registration for participant and event
      let existingReg = null;
      for (const reg of mockStore.values()) {
        const regEventId = typeof reg.event === 'object' && reg.event ? (reg.event.id || reg.event._id) : reg.event;
        const regPartId = typeof reg.participant === 'object' && reg.participant ? (reg.participant.id || reg.participant._id) : reg.participant;

        if (String(regEventId) === String(effectiveEventId) && String(regPartId) === String(participantId)) {
          existingReg = reg;
          break;
        }
      }

      if (existingReg && existingReg.status === 'registered') {
        return res.status(409).json({
          success: false,
          message: 'You are already registered for this event.'
        });
      }

      const currentCount = event.registeredCount !== undefined ? event.registeredCount : 0;
      if (currentCount >= event.capacity) {
        return res.status(400).json({
          success: false,
          message: 'Event has reached maximum capacity.'
        });
      }

      // Re-registration of cancelled record
      if (existingReg && existingReg.status === 'cancelled') {
        existingReg.status = 'registered';
        existingReg.academicYear = academicYear;
        existingReg.registeredAt = new Date();
        existingReg.cancelledAt = null;
        existingReg.cancellationReason = '';
        existingReg.updatedAt = new Date();
        event.registeredCount = currentCount + 1;
        const eventTitle = event.title || 'Event';
        const actionVersion = new Date(existingReg.registeredAt).getTime();
        await recordEventActivity(req, {
          eventId: effectiveEventId,
          actorId: participantId,
          action: 'participant_registered',
          description: `${req.user.name || 'A participant'} registered for "${eventTitle}".`,
          metadata: { registrationId: existingReg.id || existingReg._id },
          dedupeKey: `registration-created:${existingReg.id || existingReg._id}:${actionVersion}`
        });
        await deliverNotification(req, {
          recipientId: getReferenceId(event.organizer),
          actorId: participantId,
          type: 'registration_created',
          title: 'New event registration',
          message: `A participant registered for "${eventTitle}".`,
          entityType: 'registration',
          entityId: existingReg.id || existingReg._id,
          dedupeKey: `registration-created:${existingReg.id || existingReg._id}:${actionVersion}`
        });

        return res.status(200).json({
          success: true,
          message: 'Re-registered for event successfully.',
          data: populateMockRegistration(existingReg, req)
        });
      }

      // New registration
      const newId = new mongoose.Types.ObjectId().toString();
      const newRegistration = {
        id: newId,
        _id: newId,
        event: effectiveEventId,
        participant: participantId,
        academicYear,
        status: 'registered',
        registeredAt: new Date(),
        cancelledAt: null,
        cancellationReason: '',
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockStore.set(newId, newRegistration);
      event.registeredCount = currentCount + 1;
      await recordEventActivity(req, {
        eventId: effectiveEventId,
        actorId: participantId,
        action: 'participant_registered',
        description: `${req.user.name || 'A participant'} registered for "${event.title}".`,
        metadata: { registrationId: newId },
        dedupeKey: `registration-created:${newId}`
      });
      await deliverNotification(req, {
        recipientId: getReferenceId(event.organizer),
        actorId: participantId,
        type: 'registration_created',
        title: 'New event registration',
        message: `A participant registered for "${event.title}".`,
        entityType: 'registration',
        entityId: newId,
        dedupeKey: `registration-created:${newId}`
      });

      return res.status(201).json({
        success: true,
        message: 'Registered for event successfully.',
        data: populateMockRegistration(newRegistration, req)
      });
    }

    // 4. Handle registration in MongoDB environment (ACID transactional with snapshot isolation)
    const client = mongoose.connection.client;
    const isReplicaSet = client && client.topology && (
      client.topology.description.type === 'ReplicaSetWithPrimary' ||
      client.topology.description.type === 'Sharded'
    );

    // If transactions are not supported by the deployment topology, reject before executing any writes
    if (!isReplicaSet) {
      return res.status(503).json({
        success: false,
        message: 'Database transactions are unavailable on the current deployment topology. Event registration requires a replica set or sharded MongoDB deployment to guarantee atomic capacity consistency.'
      });
    }

    const session = await mongoose.startSession();
    const MAX_TX_RETRIES = 3;
    let attempt = 0;
    let registrationDoc = null;
    let wasCancelled = false;

    try {
      while (attempt < MAX_TX_RETRIES) {
        attempt++;
        session.startTransaction();

        try {
          // Check if participant already has a registration record within this session
          const existingRegistration = await Registration.findOne({
            event: effectiveEventId,
            participant: participantId
          }).session(session);

          if (existingRegistration && existingRegistration.status === 'registered') {
            await session.abortTransaction();
            return res.status(409).json({
              success: false,
              message: 'You are already registered for this event.'
            });
          }

          // Atomically increment registeredCount only if registeredCount < capacity.
          // Uses $ifNull to seamlessly protect legacy records where registeredCount was not yet initialized.
          const updatedEvent = await Event.findOneAndUpdate(
            {
              _id: effectiveEventId,
              status: 'published',
              isArchived: false,
              $or: [
                { eligibleYears: academicYear },
                { eligibleYears: { $exists: false } }
              ],
              $expr: {
                $lt: [{ $ifNull: ['$registeredCount', 0] }, '$capacity']
              }
            },
            { $inc: { registeredCount: 1 } },
            { session, new: true }
          );

          if (!updatedEvent) {
            const currentEvent = await Event.findOne({
              _id: effectiveEventId,
              isArchived: false
            }).select('eligibleYears').session(session);
            const currentEligibleYears = currentEvent && Array.isArray(currentEvent.eligibleYears)
              ? currentEvent.eligibleYears
              : STUDENT_YEARS;
            if (currentEvent && !currentEligibleYears.includes(academicYear)) {
              await session.abortTransaction();
              return res.status(400).json({
                success: false,
                message: 'Your current academic year is not eligible for this event.'
              });
            }
            await session.abortTransaction();
            return res.status(400).json({
              success: false,
              message: 'Event has reached maximum capacity.'
            });
          }

          // Re-registration of previously cancelled record
          if (existingRegistration && existingRegistration.status === 'cancelled') {
            wasCancelled = true;
            existingRegistration.status = 'registered';
            existingRegistration.academicYear = academicYear;
            existingRegistration.registeredAt = new Date();
            existingRegistration.cancelledAt = null;
            existingRegistration.cancellationReason = '';
            await existingRegistration.save({ session });
            registrationDoc = existingRegistration;
          } else {
            // New registration document creation
            const [createdDoc] = await Registration.create(
              [
                {
                  event: effectiveEventId,
                  participant: participantId,
                  academicYear,
                  status: 'registered',
                  registeredAt: new Date()
                }
              ],
              { session }
            );
            registrationDoc = createdDoc;
          }

          await session.commitTransaction();

          // Successfully committed - break retry loop
          break;
        } catch (innerErr) {
          try {
            await session.abortTransaction();
          } catch (abortErr) {
            // Ignore error on abort if already aborted
          }

          const isTransient = innerErr.hasErrorLabel && innerErr.hasErrorLabel('TransientTransactionError');
          const isWriteConflict = innerErr.code === 112 || (innerErr.message && innerErr.message.includes('WriteConflict'));

          // Retry on transient transaction errors or write conflicts
          if ((isTransient || isWriteConflict) && attempt < MAX_TX_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, attempt * 50));
            continue;
          }

          if (innerErr.code === 11000) {
            return res.status(409).json({
              success: false,
              message: 'You are already registered for this event.'
            });
          }

          throw innerErr;
        }
      }
    } finally {
      await session.endSession();
    }

    await registrationDoc.populate({
      path: 'event',
      select: 'title category startDateTime endDateTime venue status registrationDeadline capacity registeredCount',
      populate: { path: 'venue', select: 'name location capacity' }
    });
    await registrationDoc.populate('participant', 'name email role organization phone isActive');
    const registrationId = registrationDoc._id.toString();
    const eventTitle = registrationDoc.event?.title || event.title || 'Event';
    const actionVersion = new Date(registrationDoc.registeredAt).getTime();
    await recordEventActivity(req, {
      eventId: effectiveEventId,
      actorId: participantId,
      action: 'participant_registered',
      description: `${req.user.name || 'A participant'} registered for "${eventTitle}".`,
      metadata: { registrationId },
      dedupeKey: `registration-created:${registrationId}:${actionVersion}`
    });
    await deliverNotification(req, {
      recipientId: getReferenceId(event.organizer),
      actorId: participantId,
      type: 'registration_created',
      title: 'New event registration',
      message: `A participant registered for "${eventTitle}".`,
      entityType: 'registration',
      entityId: registrationId,
      dedupeKey: `registration-created:${registrationId}:${actionVersion}`
    });

    return res.status(wasCancelled ? 200 : 201).json({
      success: true,
      message: wasCancelled ? 'Re-registered for event successfully.' : 'Registered for event successfully.',
      data: registrationDoc
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/registrations/me
 * GET /api/registrations
 * Retrieve registrations for current authenticated participant.
 */
const getMyRegistrations = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'participant') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. Only participants can access personal registrations.'
      });
    }

    const participantId = req.user.id;
    const { page, limit, status } = validateRegistrationQuery(req.query);
    const mockStore = getStore(req);

    if (mockStore) {
      let filtered = Array.from(mockStore.values()).filter((reg) => {
        const regPartId = typeof reg.participant === 'object' && reg.participant
          ? (reg.participant.id || reg.participant._id)
          : reg.participant;

        if (String(regPartId) !== String(participantId)) return false;
        if (status && reg.status !== status) return false;
        if (reg.isArchived) return false;
        return true;
      });

      // Sort by registeredAt descending
      filtered.sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt));

      const total = filtered.length;
      const pages = Math.ceil(total / limit) || 1;
      const skip = (page - 1) * limit;
      const paginated = filtered.slice(skip, skip + limit).map((reg) => populateMockRegistration(reg, req));

      return res.status(200).json({
        success: true,
        count: paginated.length,
        pagination: {
          total,
          page,
          limit,
          pages
        },
        data: paginated
      });
    }

    // Database query
    const query = {
      participant: participantId,
      isArchived: false
    };

    if (status) {
      query.status = status;
    }

    const total = await Registration.countDocuments(query);
    const pages = Math.ceil(total / limit) || 1;
    const skip = (page - 1) * limit;

    const registrations = await Registration.find(query)
      .sort({ registeredAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'event',
        select: 'title category startDateTime endDateTime venue status registrationDeadline capacity registeredCount',
        populate: { path: 'venue', select: 'name location capacity' }
      })
      .populate('participant', 'name email role organization phone isActive');
    const data = registrations.map((registration) => {
      const serialized = registration.toObject();
      if (serialized.event) {
        serialized.event.lifecycleStatus = getEventLifecycleStatus(serialized.event);
      }
      return serialized;
    });

    return res.status(200).json({
      success: true,
      count: registrations.length,
      pagination: {
        total,
        page,
        limit,
        pages
      },
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/registrations/:id
 * Retrieve a single registration by ID (Owner participant or Administrator).
 */
const getRegistrationById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid registration ID format.'
      });
    }

    const mockStore = getStore(req);
    const isAdmin = req.user && req.user.role === 'administrator';

    let registration = null;
    if (mockStore) {
      registration = mockStore.get(id);
    } else if (mongoose.connection.readyState === 1) {
      registration = await Registration.findOne({ _id: id, isArchived: false })
        .populate({
          path: 'event',
          select: 'title category startDateTime endDateTime venue status registrationDeadline capacity registeredCount',
          populate: { path: 'venue', select: 'name location capacity' }
        })
        .populate('participant', 'name email role organization phone isActive');
    }

    if (!registration || registration.isArchived) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found.'
      });
    }

    const participantId = typeof registration.participant === 'object' && registration.participant
      ? (registration.participant.id || registration.participant._id)
      : registration.participant;

    if (!isAdmin && String(participantId) !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You are not authorized to view this registration.'
      });
    }

    if (mockStore) {
      return res.status(200).json({
        success: true,
        data: populateMockRegistration(registration, req)
      });
    }

    return res.status(200).json({
      success: true,
      data: registration
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/registrations/:id/cancel
 * Cancel an active registration (Participant owner or Administrator only).
 */
const cancelRegistration = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid registration ID format.'
      });
    }

    const { isValid, errors, sanitized } = validateCancellationInput(req.body);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors
      });
    }

    const mockStore = getStore(req);
    const eventStore = getEventStore(req);
    const isAdmin = req.user && req.user.role === 'administrator';

    let registration = null;
    if (mockStore) {
      registration = mockStore.get(id);
    } else if (mongoose.connection.readyState === 1) {
      registration = await Registration.findOne({ _id: id, isArchived: false });
    }

    if (!registration || registration.isArchived) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found.'
      });
    }

    // Authorization check
    const participantId = typeof registration.participant === 'object' && registration.participant
      ? (registration.participant.id || registration.participant._id)
      : registration.participant;

    if (!isAdmin && String(participantId) !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You are not authorized to cancel this registration.'
      });
    }

    // Already cancelled check
    if (registration.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Registration is already cancelled.'
      });
    }

    // Event check: cannot cancel if event has already started
    const eventId = typeof registration.event === 'object' && registration.event
      ? (registration.event.id || registration.event._id)
      : registration.event;

    let event = null;
    if (eventStore) {
      event = eventStore.get(eventId);
    } else if (mongoose.connection.readyState === 1) {
      event = await Event.findById(eventId);
    }

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Associated event not found.'
      });
    }

    const now = new Date();
    if (new Date(event.startDateTime) <= now) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel registration for an event that has already started.'
      });
    }

    // Perform cancellation & capacity restoration
    if (mockStore) {
      registration.status = 'cancelled';
      registration.cancelledAt = new Date();
      registration.cancellationReason = sanitized.reason || 'Cancelled by participant';
      registration.updatedAt = new Date();

      if (event.registeredCount !== undefined && event.registeredCount > 0) {
        event.registeredCount = event.registeredCount - 1;
      }
      const cancellationId = registration.id || registration._id;
      await recordEventActivity(req, {
        eventId,
        actorId: req.user.id,
        action: 'registration_cancelled',
        description: `A registration for "${event.title || 'Event'}" was cancelled.`,
        metadata: { registrationId: cancellationId },
        dedupeKey: `registration-cancelled:${cancellationId}:${new Date(registration.cancelledAt).getTime()}`
      });
      await deliverNotification(req, {
        recipientId: getReferenceId(event.organizer),
        actorId: req.user.id,
        type: 'registration_cancelled',
        title: 'Event registration cancelled',
        message: `A registration for "${event.title || 'Event'}" was cancelled.`,
        entityType: 'registration',
        entityId: cancellationId,
        dedupeKey: `registration-cancelled:${cancellationId}:${new Date(registration.cancelledAt).getTime()}`
      });

      return res.status(200).json({
        success: true,
        message: 'Registration cancelled successfully.',
        data: populateMockRegistration(registration, req)
      });
    }

    // MongoDB path: atomic status transition and capacity decrement
    const client = mongoose.connection.client;
    const isReplicaSet = client && client.topology && (
      client.topology.description.type === 'ReplicaSetWithPrimary' ||
      client.topology.description.type === 'Sharded'
    );

    // If transactions are not supported by the deployment topology, reject before executing any writes
    if (!isReplicaSet) {
      return res.status(503).json({
        success: false,
        message: 'Database transactions are unavailable on the current deployment topology. Registration cancellation requires a replica set or sharded MongoDB deployment to guarantee atomic capacity restoration.'
      });
    }

    const session = await mongoose.startSession();
    const MAX_TX_RETRIES = 3;
    let attempt = 0;
    let cancelledReg = null;

    try {
      while (attempt < MAX_TX_RETRIES) {
        attempt++;
        session.startTransaction();

        try {
          // 1. Atomically transition registration status from 'registered' to 'cancelled'
          // This ensures that only ONE concurrent cancellation request can ever succeed,
          // guaranteeing idempotency and absolute prevention of duplicate counter decrement.
          cancelledReg = await Registration.findOneAndUpdate(
            {
              _id: id,
              status: 'registered',
              isArchived: false
            },
            {
              $set: {
                status: 'cancelled',
                cancelledAt: new Date(),
                cancellationReason: sanitized.reason || 'Cancelled by participant'
              }
            },
            { session, new: true }
          );

          if (!cancelledReg) {
            await session.abortTransaction();
            return res.status(400).json({
              success: false,
              message: 'Registration is already cancelled.'
            });
          }

          // 2. Decrement registeredCount on Event
          await Event.findOneAndUpdate(
            { _id: eventId, registeredCount: { $gt: 0 } },
            { $inc: { registeredCount: -1 } },
            { session }
          );

          await session.commitTransaction();

          // Successfully committed - break retry loop
          break;
        } catch (innerErr) {
          try {
            await session.abortTransaction();
          } catch (abortErr) {
            // Ignore error on abort
          }

          const isTransient = innerErr.hasErrorLabel && innerErr.hasErrorLabel('TransientTransactionError');
          const isWriteConflict = innerErr.code === 112 || (innerErr.message && innerErr.message.includes('WriteConflict'));

          if ((isTransient || isWriteConflict) && attempt < MAX_TX_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, attempt * 50));
            continue;
          }

          throw innerErr;
        }
      }
    } finally {
      await session.endSession();
    }

    await cancelledReg.populate({
      path: 'event',
      select: 'title category startDateTime endDateTime venue status registrationDeadline capacity registeredCount',
      populate: { path: 'venue', select: 'name location capacity' }
    });
    await cancelledReg.populate('participant', 'name email role organization phone isActive');
    const cancellationId = cancelledReg._id.toString();
    const eventTitle = cancelledReg.event?.title || event.title || 'Event';
    await recordEventActivity(req, {
      eventId,
      actorId: req.user.id,
      action: 'registration_cancelled',
      description: `A registration for "${eventTitle}" was cancelled.`,
      metadata: { registrationId: cancellationId },
      dedupeKey: `registration-cancelled:${cancellationId}:${new Date(cancelledReg.cancelledAt).getTime()}`
    });
    await deliverNotification(req, {
      recipientId: getReferenceId(event.organizer),
      actorId: req.user.id,
      type: 'registration_cancelled',
      title: 'Event registration cancelled',
      message: `A registration for "${eventTitle}" was cancelled.`,
      entityType: 'registration',
      entityId: cancellationId,
      dedupeKey: `registration-cancelled:${cancellationId}:${new Date(cancelledReg.cancelledAt).getTime()}`
    });

    return res.status(200).json({
      success: true,
      message: 'Registration cancelled successfully.',
      data: cancelledReg
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/events/:id/attendees
 * GET /api/registrations/event/:id
 * Retrieve attendees list for an event (Event owner organizer or Administrator only).
 */
const getEventAttendees = async (req, res, next) => {
  try {
    const eventId = req.params.id;

    if (!isValidObjectId(eventId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID format.'
      });
    }

    const mockStore = getStore(req);
    const eventStore = getEventStore(req);
    const isAdmin = req.user && req.user.role === 'administrator';

    let event = null;
    if (eventStore) {
      event = eventStore.get(eventId);
    } else if (mongoose.connection.readyState === 1) {
      event = await Event.findOne({ _id: eventId, isArchived: false });
    }

    if (!event || event.isArchived) {
      return res.status(404).json({
        success: false,
        message: 'Event not found.'
      });
    }

    // Ownership check: Administrator or owner organizer only
    const organizerId = getReferenceId(event.organizer);
    const requesterId = getReferenceId(req.user?.id);
    const isOrganizerOwner = req.user?.role === 'organizer' &&
      organizerId !== '' && organizerId === requesterId;

    if (!isAdmin && !isOrganizerOwner) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You are not authorized to view attendees for this event.'
      });
    }

    const filters = validateRegistrationQuery(req.query);
    if (req.attendeeIdsOnly) filters.idsOnly = true;

    if (mockStore) {
      const allForEvent = Array.from(mockStore.values()).filter((reg) => {
        const regEventId = typeof reg.event === 'object' && reg.event ? (reg.event.id || reg.event._id) : reg.event;
        return String(regEventId) === String(eventId) && !reg.isArchived;
      });

      const totalActive = allForEvent.filter((r) => r.status === 'registered').length;
      const totalCancelled = allForEvent.filter((r) => r.status === 'cancelled').length;
      const activeRegistrations = allForEvent.filter((registration) => registration.status === 'registered');
      const attendanceSummary = {
        presentCount: activeRegistrations.filter((registration) => registration.attendanceStatus === 'present').length,
        absentCount: activeRegistrations.filter((registration) => registration.attendanceStatus === 'absent').length,
        notMarkedCount: activeRegistrations.filter((registration) =>
          !registration.attendanceStatus || registration.attendanceStatus === 'not_marked').length
      };

      const populated = allForEvent.map((registration) => populateMockRegistration(registration, req));
      const filtered = sortAttendees(
        populated.filter((registration) => matchesAttendeeFilters(registration, filters, req)),
        filters.sortBy,
        filters.sortOrder
      );

      const total = filtered.length;
      const pages = Math.ceil(total / filters.limit) || 1;
      const skip = (filters.page - 1) * filters.limit;
      const paginated = filters.idsOnly
        ? filtered.map((registration) => String(registration.id || registration._id))
        : filtered.slice(skip, skip + filters.limit);

      return res.status(200).json({
        success: true,
        count: paginated.length,
        summary: {
          totalAll: allForEvent.length,
          activeCount: totalActive,
          cancelledCount: totalCancelled,
          ...attendanceSummary
        },
        pagination: {
          total,
          page: filters.page,
          limit: filters.limit,
          pages
        },
        data: paginated
      });
    }

    const [baseFilter, filter] = await Promise.all([
      getAttendeeQueryFilter({}, eventId),
      getAttendeeQueryFilter(filters, eventId)
    ]);
    const attendanceRows = await Registration.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: null,
          totalAll: { $sum: 1 },
          activeCount: { $sum: { $cond: [{ $eq: ['$status', 'registered'] }, 1, 0] } },
          cancelledCount: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          presentCount: {
            $sum: { $cond: [{ $and: [{ $eq: ['$status', 'registered'] }, { $eq: ['$attendanceStatus', 'present'] }] }, 1, 0] }
          },
          absentCount: {
            $sum: { $cond: [{ $and: [{ $eq: ['$status', 'registered'] }, { $eq: ['$attendanceStatus', 'absent'] }] }, 1, 0] }
          },
          notMarkedCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'registered'] },
                    { $in: [{ $ifNull: ['$attendanceStatus', 'not_marked'] }, ['not_marked']] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);
    const summary = attendanceRows[0] || {
      totalAll: 0,
      activeCount: 0,
      cancelledCount: 0,
      presentCount: 0,
      absentCount: 0,
      notMarkedCount: 0
    };
    const total = await Registration.countDocuments(filter);
    const pages = Math.ceil(total / filters.limit) || 1;
    const direction = filters.sortOrder === 'asc' ? 1 : -1;
    const sortFields = {
      registeredAt: 'registeredAt',
      name: 'participantProfile.name',
      email: 'participantProfile.email',
      organization: 'participantProfile.organization',
      status: 'status',
      attendanceStatus: 'attendanceStatus',
      academicYear: 'academicYear'
    };
    const sortField = sortFields[filters.sortBy] || 'registeredAt';
    const attendeePipeline = [
      { $match: filter },
      {
        $lookup: {
          from: User.collection.name,
          localField: 'participant',
          foreignField: '_id',
          as: 'participantProfile'
        }
      },
      { $unwind: { path: '$participantProfile', preserveNullAndEmptyArrays: true } },
      { $sort: { [sortField]: direction, _id: 1 } }
    ];
    if (!filters.idsOnly) {
      attendeePipeline.push({ $skip: (filters.page - 1) * filters.limit });
      attendeePipeline.push({ $limit: filters.limit });
    }
    attendeePipeline.push(filters.idsOnly
      ? { $project: { _id: { $toString: '$_id' } } }
      : {
        $project: {
          _id: 0,
          id: { $toString: '$_id' },
          event: { $toString: '$event' },
          participant: {
            id: { $toString: '$participantProfile._id' },
            name: '$participantProfile.name',
            email: '$participantProfile.email',
            role: '$participantProfile.role',
            organization: { $ifNull: ['$participantProfile.organization', ''] },
            phone: { $ifNull: ['$participantProfile.phone', ''] }
          },
          academicYear: 1,
          status: 1,
          attendanceStatus: { $ifNull: ['$attendanceStatus', 'not_marked'] },
          attendanceMarkedAt: 1,
          attendanceMarkedBy: { $toString: '$attendanceMarkedBy' },
          registeredAt: 1,
          createdAt: 1,
          cancelledAt: 1,
          cancellationReason: 1
        }
      });
    const attendees = await Registration.aggregate(attendeePipeline);

    return res.status(200).json({
      success: true,
      count: attendees.length,
      summary,
      pagination: {
        total,
        page: filters.page,
        limit: filters.limit,
        pages
      },
      data: filters.idsOnly ? attendees.map((registration) => registration._id) : attendees
    });
  } catch (error) {
    next(error);
  }
};

const getEventAttendeeIds = (req, res, next) => {
  req.attendeeIdsOnly = true;
  return getEventAttendees(req, res, next);
};

const updateEventAttendance = async (req, res, next) => {
  try {
    const eventId = req.params.id;
    if (!isValidObjectId(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID format.' });
    }
    const updates = req.body?.updates;
    if (!Array.isArray(updates) || updates.length < 1 || updates.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Provide between 1 and 100 attendance updates.'
      });
    }

    const eventStore = getEventStore(req);
    const mockStore = getStore(req);
    const event = eventStore
      ? eventStore.get(eventId)
      : await Event.findOne({ _id: eventId, isArchived: false }).select('organizer title isArchived');
    if (!event || event.isArchived) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }
    const organizerId = getReferenceId(event.organizer);
    const requesterId = getReferenceId(req.user.id);
    if (req.user.role !== 'administrator' &&
        (req.user.role !== 'organizer' || organizerId === '' || organizerId !== requesterId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update attendance for this event.'
      });
    }

    const normalized = [];
    const seenIds = new Set();
    for (const update of updates) {
      const registrationId = update?.registrationId;
      if (!isValidObjectId(registrationId)) {
        return res.status(400).json({ success: false, message: 'An attendance update has an invalid registration ID.' });
      }
      if (!ATTENDANCE_STATUS.includes(update.attendanceStatus)) {
        return res.status(400).json({ success: false, message: 'Attendance status must be present, absent, or not_marked.' });
      }
      if (seenIds.has(String(registrationId))) {
        return res.status(400).json({ success: false, message: 'A registration cannot appear more than once in an attendance update.' });
      }
      seenIds.add(String(registrationId));
      normalized.push({ registrationId: String(registrationId), attendanceStatus: update.attendanceStatus });
    }

    let changed = [];
    if (mockStore) {
      const registrations = normalized.map(({ registrationId }) => mockStore.get(registrationId));
      if (registrations.some((registration) => !registration ||
          getReferenceId(registration.event) !== eventId ||
          registration.status !== 'registered' ||
          registration.isArchived)) {
        return res.status(404).json({
          success: false,
          message: 'One or more active event registrations were not found.'
        });
      }
      const now = new Date();
      changed = normalized.flatMap((update, index) => {
        const registration = registrations[index];
        const previous = registration.attendanceStatus || 'not_marked';
        if (previous === update.attendanceStatus) return [];
        registration.attendanceStatus = update.attendanceStatus;
        registration.attendanceMarkedAt = update.attendanceStatus === 'not_marked' ? null : now;
        registration.attendanceMarkedBy = update.attendanceStatus === 'not_marked' ? null : req.user.id;
        registration.updatedAt = now;
        return [{ registration, previous, next: update.attendanceStatus }];
      });
    } else {
      const client = mongoose.connection.client;
      const isReplicaSet = client && client.topology && (
        client.topology.description.type === 'ReplicaSetWithPrimary' ||
        client.topology.description.type === 'Sharded'
      );
      if (!isReplicaSet) {
        return res.status(503).json({
          success: false,
          message: 'Database transactions are unavailable. Attendance updates require a replica set or sharded MongoDB deployment.'
        });
      }
      const session = await mongoose.startSession();
      const now = new Date();
      try {
        await session.withTransaction(async () => {
          const registrations = await Registration.find({
            _id: { $in: normalized.map((update) => update.registrationId) },
            event: eventId,
            status: 'registered',
            isArchived: false
          }).session(session);
          if (registrations.length !== normalized.length) {
            const error = new Error('One or more active event registrations were not found.');
            error.statusCode = 404;
            throw error;
          }
          const registrationById = new Map(registrations.map((registration) => [
            registration._id.toString(),
            registration
          ]));
          const operations = [];
          for (const update of normalized) {
            const registration = registrationById.get(update.registrationId);
            const previous = registration.attendanceStatus || 'not_marked';
            if (previous === update.attendanceStatus) continue;
            changed.push({ registrationId: update.registrationId, previous, next: update.attendanceStatus });
            operations.push({
              updateOne: {
                filter: { _id: registration._id, event: eventId, status: 'registered', isArchived: false },
                update: {
                  $set: {
                    attendanceStatus: update.attendanceStatus,
                    attendanceMarkedAt: update.attendanceStatus === 'not_marked' ? null : now,
                    attendanceMarkedBy: update.attendanceStatus === 'not_marked' ? null : req.user.id
                  }
                }
              }
            });
          }
          if (operations.length > 0) await Registration.bulkWrite(operations, { session });
        });
      } finally {
        await session.endSession();
      }
    }

    for (const change of changed) {
      const registrationId = change.registration?._id || change.registration?.id || change.registrationId;
      await recordEventActivity(req, {
        eventId,
        actorId: req.user.id,
        action: 'attendance_marked',
        description: change.next === 'not_marked'
          ? `Attendance was cleared for a participant at "${event.title}".`
          : `A participant was marked ${change.next} for "${event.title}".`,
        metadata: { registrationId, status: change.next },
        dedupeKey: `attendance:${registrationId}:${change.next}:${new mongoose.Types.ObjectId()}`
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Attendance updated.',
      data: { updatedCount: changed.length }
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const getWhatsAppGroupLink = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID format.'
      });
    }

    const eventStore = getEventStore(req);
    const registrationStore = getStore(req);
    let event;
    let activeRegistration;

    if (eventStore && registrationStore) {
      event = eventStore.get(id);
      if (!event || event.isArchived) {
        return res.status(404).json({ success: false, message: 'Event not found.' });
      }

      activeRegistration = Array.from(registrationStore.values()).find((registration) =>
        getReferenceId(registration.event) === id &&
        getReferenceId(registration.participant) === req.user.id &&
        registration.status === 'registered' &&
        registration.isArchived === false
      );
    } else {
      event = await Event.findOne({ _id: id, isArchived: false }).select('whatsappGroupUrl');
      if (!event) {
        return res.status(404).json({ success: false, message: 'Event not found.' });
      }

      activeRegistration = await Registration.findOne({
        event: id,
        participant: req.user.id,
        status: 'registered',
        isArchived: false
      }).select('_id');
    }

    if (!activeRegistration) {
      return res.status(403).json({
        success: false,
        message: 'An active registration is required to access this event group.'
      });
    }

    if (typeof event.whatsappGroupUrl !== 'string' || !event.whatsappGroupUrl) {
      return res.status(404).json({
        success: false,
        message: 'No WhatsApp group is available for this event.'
      });
    }

    return res.status(200).json({
      success: true,
      data: { whatsappGroupUrl: event.whatsappGroupUrl }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerForEvent,
  getMyRegistrations,
  getRegistrationById,
  cancelRegistration,
  getEventAttendees,
  getEventAttendeeIds,
  updateEventAttendance,
  getWhatsAppGroupLink
};
