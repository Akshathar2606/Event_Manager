const mongoose = require('mongoose');
const { Booking, BOOKING_STATUS } = require('../models/Booking');
const { Event } = require('../models/Event');
const { Venue } = require('../models/Venue');
const { User } = require('../models/User');
const {
  isValidObjectId,
  areIntervalsConflicting,
  doesIntervalCover,
  validateBookingInput
} = require('../utils/bookingValidation');

/**
 * Accesses mock booking store during in-memory automated tests.
 * Hardened to strictly return null in production environments.
 */
const getStore = (req) => {
  if (process.env.NODE_ENV === 'production') return null;
  return req.app && req.app.locals && req.app.locals.mockBookingStore
    ? req.app.locals.mockBookingStore
    : null;
};

const getEventStore = (req) => {
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
 * Helper to populate event, venue, organizer, and reviewedBy in mock objects for test consistency
 */
const populateMockBooking = (booking, req) => {
  const eventStore = getEventStore(req);
  const venueStore = getVenueStore(req);
  const userStore = getUserStore(req);

  const populated = { ...booking };

  const eventId = typeof populated.event === 'object' && populated.event ? (populated.event.id || populated.event._id) : populated.event;
  if (typeof eventId === 'string' && eventStore) {
    const event = eventStore.get(eventId);
    if (event) {
      populated.event = {
        id: event.id || event._id,
        title: event.title,
        startDateTime: event.startDateTime,
        endDateTime: event.endDateTime,
        capacity: event.capacity,
        status: event.status,
        category: event.category
      };
    }
  }

  const venueId = typeof populated.venue === 'object' && populated.venue ? (populated.venue.id || populated.venue._id) : populated.venue;
  if (typeof venueId === 'string' && venueStore) {
    const venue = venueStore.get(venueId);
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

  const organizerId = typeof populated.organizer === 'object' && populated.organizer ? (populated.organizer.id || populated.organizer._id) : populated.organizer;
  if (typeof organizerId === 'string' && userStore) {
    const organizer = userStore.get(organizerId);
    if (organizer) {
      populated.organizer = {
        id: organizer.id || organizer._id,
        name: organizer.name,
        email: organizer.email,
        organization: organizer.organization || '',
        phone: organizer.phone || ''
      };
    }
  }

  if (populated.reviewedBy) {
    const reviewerId = typeof populated.reviewedBy === 'object' ? (populated.reviewedBy.id || populated.reviewedBy._id) : populated.reviewedBy;
    if (typeof reviewerId === 'string' && userStore) {
      const reviewer = userStore.get(reviewerId);
      if (reviewer) {
        populated.reviewedBy = {
          id: reviewer.id || reviewer._id,
          name: reviewer.name,
          email: reviewer.email,
          role: reviewer.role
        };
      }
    }
  }

  return populated;
};

/**
 * POST /api/bookings
 * Create a new venue booking request.
 * Organizers can request bookings for their own events.
 */
const createBooking = async (req, res, next) => {
  try {
    const { isValid, errors, sanitized } = validateBookingInput(req.body);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed. Please correct the highlighted errors.',
        errors
      });
    }

    const mockStore = getStore(req);
    const eventStore = getEventStore(req);
    const venueStore = getVenueStore(req);
    const organizerId = req.user.id; // Authoritative assignment from JWT

    // 1. Verify Event existence and ownership
    let event = null;
    if (eventStore) {
      event = eventStore.get(sanitized.event);
    } else {
      event = await Event.findOne({ _id: sanitized.event, isArchived: false });
    }

    if (!event || event.isArchived) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or has been archived.'
      });
    }

    if (event.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot request a venue booking for a cancelled event.'
      });
    }

    const eventOrgId = typeof event.organizer === 'object' && event.organizer
      ? (event.organizer.id || event.organizer._id)
      : event.organizer;

    if (req.user.role !== 'administrator' && String(eventOrgId) !== organizerId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You can only request venue bookings for events you organize.'
      });
    }

    // 2. Verify Venue existence and availability status
    let venue = null;
    if (venueStore) {
      venue = venueStore.get(sanitized.venue);
    } else {
      venue = await Venue.findOne({ _id: sanitized.venue, isArchived: false });
    }

    if (!venue || venue.isArchived) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found or has been archived.'
      });
    }

    if (venue.status === 'maintenance') {
      return res.status(400).json({
        success: false,
        message: 'Cannot book a venue that is currently under maintenance.'
      });
    }

    // 3. Resolve and validate Booking times
    // Default to event's startDateTime and endDateTime if not explicitly supplied
    const effectiveStart = sanitized.startDateTime || new Date(event.startDateTime);
    const effectiveEnd = sanitized.endDateTime || new Date(event.endDateTime);

    if (isNaN(effectiveStart.getTime()) || isNaN(effectiveEnd.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking date and time.'
      });
    }

    if (effectiveEnd <= effectiveStart) {
      return res.status(400).json({
        success: false,
        message: 'Booking end date and time must be after the start date and time.'
      });
    }

    // Enforce consistency rule: Booking window must cover the full event duration
    const eventStart = new Date(event.startDateTime);
    const eventEnd = new Date(event.endDateTime);

    if (!doesIntervalCover(effectiveStart, effectiveEnd, eventStart, eventEnd)) {
      return res.status(400).json({
        success: false,
        message: `Booking dates must cover the full event duration (from ${eventStart.toISOString()} to ${eventEnd.toISOString()}).`
      });
    }

    // Check consistency with event's assigned venue if already set
    const assignedVenueId = typeof event.venue === 'object' && event.venue
      ? (event.venue.id || event.venue._id)
      : event.venue;

    if (assignedVenueId && String(assignedVenueId) !== String(sanitized.venue)) {
      return res.status(400).json({
        success: false,
        message: 'Requested venue does not match the venue currently assigned to the event.'
      });
    }

    // If event does not yet have a venue assigned, assign this venue to the event
    if (!assignedVenueId) {
      if (eventStore) {
        event.venue = sanitized.venue;
        eventStore.set(event.id || event._id, event);
      } else {
        event.venue = sanitized.venue;
        await event.save();
      }
    }

    // 4. Mock Store creation path
    if (mockStore) {
      const newId = new mongoose.Types.ObjectId().toString();
      const newBooking = {
        id: newId,
        _id: newId,
        event: sanitized.event,
        venue: sanitized.venue,
        organizer: organizerId,
        startDateTime: effectiveStart,
        endDateTime: effectiveEnd,
        purpose: sanitized.purpose,
        notes: sanitized.notes,
        status: 'pending',
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: '',
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockStore.set(newId, newBooking);

      return res.status(201).json({
        success: true,
        message: 'Venue booking request submitted successfully.',
        data: populateMockBooking(newBooking, req)
      });
    }

    // 5. Database creation path
    const booking = new Booking({
      event: sanitized.event,
      venue: sanitized.venue,
      organizer: organizerId,
      startDateTime: effectiveStart,
      endDateTime: effectiveEnd,
      purpose: sanitized.purpose,
      notes: sanitized.notes,
      status: 'pending'
    });

    await booking.save();

    await booking.populate('event', 'title startDateTime endDateTime capacity status category');
    await booking.populate('venue', 'name location capacity facilities hourlyRate status');
    await booking.populate('organizer', 'name email organization phone');

    return res.status(201).json({
      success: true,
      message: 'Venue booking request submitted successfully.',
      data: booking
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/bookings
 * Browse bookings.
 * Administrators can view all bookings.
 * Organizers can view only their own bookings.
 * Participants and vendors are forbidden.
 */
const getBookings = async (req, res, next) => {
  try {
    const {
      status,
      venue,
      event,
      organizer,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = req.query;

    const isAdmin = req.user && req.user.role === 'administrator';
    const isOrganizer = req.user && req.user.role === 'organizer';

    if (!isAdmin && !isOrganizer) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to browse venue bookings.'
      });
    }

    const mockStore = getStore(req);

    // Mock store retrieval path
    if (mockStore) {
      let list = Array.from(mockStore.values()).filter((b) => !b.isArchived);

      // Access control filtering
      if (!isAdmin) {
        list = list.filter((b) => {
          const orgId = typeof b.organizer === 'object' && b.organizer
            ? (b.organizer.id || b.organizer._id)
            : b.organizer;
          return String(orgId) === req.user.id;
        });
      } else if (organizer && isValidObjectId(organizer)) {
        list = list.filter((b) => {
          const orgId = typeof b.organizer === 'object' && b.organizer
            ? (b.organizer.id || b.organizer._id)
            : b.organizer;
          return String(orgId) === String(organizer);
        });
      }

      // Status filter
      if (status && BOOKING_STATUS.includes(String(status).toLowerCase())) {
        list = list.filter((b) => b.status === String(status).toLowerCase());
      }

      // Venue filter
      if (venue && isValidObjectId(venue)) {
        list = list.filter((b) => {
          const vId = typeof b.venue === 'object' && b.venue ? (b.venue.id || b.venue._id) : b.venue;
          return String(vId) === String(venue);
        });
      }

      // Event filter
      if (event && isValidObjectId(event)) {
        list = list.filter((b) => {
          const eId = typeof b.event === 'object' && b.event ? (b.event.id || b.event._id) : b.event;
          return String(eId) === String(event);
        });
      }

      // Date range filters
      if (startDate) {
        const s = new Date(startDate);
        if (!isNaN(s.getTime())) {
          list = list.filter((b) => new Date(b.startDateTime) >= s);
        }
      }

      if (endDate) {
        const e = new Date(endDate);
        if (!isNaN(e.getTime())) {
          list = list.filter((b) => new Date(b.endDateTime) <= e);
        }
      }

      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      const total = list.length;
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
      const pages = Math.ceil(total / limitNum) || 1;
      const paginated = list.slice((pageNum - 1) * limitNum, pageNum * limitNum);

      return res.status(200).json({
        success: true,
        count: paginated.length,
        pagination: {
          total,
          page: pageNum,
          pages,
          limit: limitNum
        },
        data: paginated.map((b) => populateMockBooking(b, req))
      });
    }

    // Database retrieval path
    const query = { isArchived: false };

    // Access control filtering
    if (!isAdmin) {
      query.organizer = req.user.id;
    } else if (organizer && isValidObjectId(organizer)) {
      query.organizer = organizer;
    }

    if (status && BOOKING_STATUS.includes(String(status).toLowerCase())) {
      query.status = String(status).toLowerCase();
    }

    if (venue && isValidObjectId(venue)) {
      query.venue = venue;
    }

    if (event && isValidObjectId(event)) {
      query.event = event;
    }

    if (startDate) {
      const s = new Date(startDate);
      if (!isNaN(s.getTime())) {
        query.startDateTime = { $gte: s };
      }
    }

    if (endDate) {
      const e = new Date(endDate);
      if (!isNaN(e.getTime())) {
        query.endDateTime = { ...(query.endDateTime || {}), $lte: e };
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [total, bookings] = await Promise.all([
      Booking.countDocuments(query),
      Booking.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('event', 'title startDateTime endDateTime capacity status category')
        .populate('venue', 'name location capacity facilities hourlyRate status')
        .populate('organizer', 'name email organization phone')
        .populate('reviewedBy', 'name email role')
    ]);

    const pages = Math.ceil(total / limitNum) || 1;

    return res.status(200).json({
      success: true,
      count: bookings.length,
      pagination: {
        total,
        page: pageNum,
        pages,
        limit: limitNum
      },
      data: bookings
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/bookings/:id
 * Retrieve booking details by ID.
 * Accessible to Administrators and the Booking's Organizer.
 */
const getBookingById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format.'
      });
    }

    const mockStore = getStore(req);
    const isAdmin = req.user && req.user.role === 'administrator';

    let booking = null;
    if (mockStore) {
      booking = mockStore.get(id);
    } else {
      booking = await Booking.findOne({ _id: id, isArchived: false })
        .populate('event', 'title startDateTime endDateTime capacity status category')
        .populate('venue', 'name location capacity facilities hourlyRate status')
        .populate('organizer', 'name email organization phone')
        .populate('reviewedBy', 'name email role');
    }

    if (!booking || booking.isArchived) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.'
      });
    }

    const orgId = typeof booking.organizer === 'object' && booking.organizer
      ? (booking.organizer.id || booking.organizer._id)
      : booking.organizer;

    if (!isAdmin && String(orgId) !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to view this booking.'
      });
    }

    const responseData = mockStore ? populateMockBooking(booking, req) : booking;

    return res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/bookings/:id/approve
 * Review action: Approve pending venue booking.
 * Strictly restricted to Administrators.
 * Enforces venue availability, active event status, and double-booking conflict prevention.
 */
const approveBooking = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format.'
      });
    }

    const mockStore = getStore(req);
    const eventStore = getEventStore(req);
    const venueStore = getVenueStore(req);

    let booking = null;
    if (mockStore) {
      booking = mockStore.get(id);
    } else {
      booking = await Booking.findOne({ _id: id, isArchived: false });
    }

    if (!booking || booking.isArchived) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.'
      });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Only pending bookings can be approved. Current status: '${booking.status}'.`
      });
    }

    // 1. Data consistency: Validate associated Event
    const eventId = typeof booking.event === 'object' && booking.event ? (booking.event.id || booking.event._id) : booking.event;
    let event = null;
    if (eventStore) {
      event = eventStore.get(eventId);
    } else {
      event = await Event.findOne({ _id: eventId, isArchived: false });
    }

    if (!event || event.isArchived) {
      return res.status(400).json({
        success: false,
        message: 'Associated event no longer exists or has been archived.'
      });
    }

    if (event.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot approve booking for a cancelled event.'
      });
    }

    // 2. Data consistency: Validate associated Venue
    const venueId = typeof booking.venue === 'object' && booking.venue ? (booking.venue.id || booking.venue._id) : booking.venue;
    let venue = null;
    if (venueStore) {
      venue = venueStore.get(venueId);
    } else {
      venue = await Venue.findOne({ _id: venueId, isArchived: false });
    }

    if (!venue || venue.isArchived) {
      return res.status(400).json({
        success: false,
        message: 'Associated venue no longer exists or has been archived.'
      });
    }

    if (venue.status === 'maintenance') {
      return res.status(400).json({
        success: false,
        message: 'Cannot approve booking for a venue currently under maintenance.'
      });
    }

    // 3. Date consistency: Booking must still cover the event duration
    const reqStart = new Date(booking.startDateTime);
    const reqEnd = new Date(booking.endDateTime);
    const eventStart = new Date(event.startDateTime);
    const eventEnd = new Date(event.endDateTime);

    if (!doesIntervalCover(reqStart, reqEnd, eventStart, eventEnd)) {
      return res.status(400).json({
        success: false,
        message: 'Booking time interval no longer covers the associated event duration.'
      });
    }

    // 4. Double-Booking Protection:
    // Check for conflicting approved bookings for the same venue where:
    // existing.startDateTime < requested.endDateTime AND existing.endDateTime > requested.startDateTime
    if (mockStore) {
      for (const other of mockStore.values()) {
        const otherId = other.id || other._id;
        const otherVenueId = typeof other.venue === 'object' && other.venue ? (other.venue.id || other.venue._id) : other.venue;

        if (
          String(otherId) !== String(id) &&
          String(otherVenueId) === String(venueId) &&
          other.status === 'approved' &&
          !other.isArchived
        ) {
          if (areIntervalsConflicting(other.startDateTime, other.endDateTime, reqStart, reqEnd)) {
            return res.status(409).json({
              success: false,
              message: 'Double-booking conflict: The venue is already approved for another event during this time interval.',
              conflict: {
                bookingId: otherId,
                eventId: other.event,
                startDateTime: other.startDateTime,
                endDateTime: other.endDateTime
              }
            });
          }
        }
      }

      // Mark approved
      booking.status = 'approved';
      booking.reviewedBy = req.user.id;
      booking.reviewedAt = new Date();
      booking.rejectionReason = '';
      booking.updatedAt = new Date();
      mockStore.set(id, booking);

      // Serialize venue write in mock store
      if (venueStore) {
        const v = venueStore.get(venueId);
        if (v) {
          v.__v = (v.__v || 0) + 1;
          v.updatedAt = new Date();
          venueStore.set(venueId, v);
        }
      }

      // Ensure event venue is synchronized
      if (eventStore) {
        event.venue = venueId;
        eventStore.set(eventId, event);
      }

      return res.status(200).json({
        success: true,
        message: 'Venue booking request approved successfully.',
        data: populateMockBooking(booking, req)
      });
    }

    // Database path: Multi-document Transaction if MongoDB replica set is available.
    // NOTE ON DATABASE CONCURRENCY SAFETY:
    // Concurrency safety against overlapping approvals requires a MongoDB replica set deployment
    // supporting multi-document ACID transactions with snapshot isolation.
    // On standalone MongoDB deployments (without a replica set), transactions cannot be initiated,
    // so absolute race-condition serialization cannot be guaranteed at the database engine level.
    const client = mongoose.connection.client;
    const isReplicaSet = client && client.topology && (
      client.topology.description.type === 'ReplicaSetWithPrimary' ||
      client.topology.description.type === 'Sharded'
    );

    const MAX_TX_RETRIES = 3;
    let attempt = 0;
    let session = null;

    if (isReplicaSet) {
      session = await mongoose.startSession();
    }

    try {
      while (attempt < MAX_TX_RETRIES) {
        attempt++;
        if (session) {
          session.startTransaction();
        }

        try {
          // STEP 1: Venue-Level Serialization Write.
          // By executing a real write to the shared Venue document (__v increment) inside the transaction
          // BEFORE running the conflict check, WiredTiger places an exclusive write lock on the Venue document.
          // Any competing concurrent approval transaction for the same venue will block or abort with a
          // TransientTransactionError / WriteConflict. Once this transaction commits, the competing transaction's
          // retry will see the newly approved booking in its refreshed snapshot, serializing the approvals.
          const lockedVenue = await Venue.findOneAndUpdate(
            { _id: venue._id, isArchived: false, status: { $ne: 'maintenance' } },
            { $inc: { __v: 1 } },
            { session: session || undefined, new: true }
          );

          if (!lockedVenue) {
            if (session) await session.abortTransaction();
            return res.status(400).json({
              success: false,
              message: 'Associated venue no longer exists, is archived, or is currently under maintenance.'
            });
          }

          // STEP 2: Conflict Query running AFTER acquiring the venue serialization write
          const conflictQuery = {
            _id: { $ne: booking._id },
            venue: venue._id,
            status: 'approved',
            isArchived: false,
            startDateTime: { $lt: reqEnd },
            endDateTime: { $gt: reqStart }
          };

          const conflict = await Booking.findOne(conflictQuery).session(session || null);
          if (conflict) {
            if (session) await session.abortTransaction();
            return res.status(409).json({
              success: false,
              message: 'Double-booking conflict: The venue is already approved for another event during this time interval.',
              conflict: {
                bookingId: conflict._id.toString(),
                eventId: conflict.event,
                startDateTime: conflict.startDateTime,
                endDateTime: conflict.endDateTime
              }
            });
          }

          // STEP 3: Approve booking and synchronize event venue
          booking.status = 'approved';
          booking.reviewedBy = req.user.id;
          booking.reviewedAt = new Date();
          booking.rejectionReason = '';
          await booking.save({ session: session || undefined });

          event.venue = venue._id;
          await event.save({ session: session || undefined });

          if (session) {
            await session.commitTransaction();
          }

          // Success - break out of the retry loop
          break;
        } catch (innerErr) {
          if (session) {
            try {
              await session.abortTransaction();
            } catch (abortErr) {
              // Ignore abort error if transaction was already aborted
            }
          }

          const isTransient = innerErr.hasErrorLabel && innerErr.hasErrorLabel('TransientTransactionError');
          const isWriteConflict = innerErr.code === 112 || (innerErr.message && innerErr.message.includes('WriteConflict'));

          // If transient error and retries remain, rerun the full transaction and its conflict check
          if ((isTransient || isWriteConflict) && attempt < MAX_TX_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, attempt * 50));
            continue;
          }

          throw innerErr;
        }
      }
    } finally {
      if (session) {
        await session.endSession();
      }
    }

    await booking.populate('event', 'title startDateTime endDateTime capacity status category');
    await booking.populate('venue', 'name location capacity facilities hourlyRate status');
    await booking.populate('organizer', 'name email organization phone');
    await booking.populate('reviewedBy', 'name email role');

    return res.status(200).json({
      success: true,
      message: 'Venue booking request approved successfully.',
      data: booking
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/bookings/:id/reject
 * Review action: Reject pending venue booking with optional reason.
 * Strictly restricted to Administrators.
 */
const rejectBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body || {};

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format.'
      });
    }

    const mockStore = getStore(req);

    let booking = null;
    if (mockStore) {
      booking = mockStore.get(id);
    } else {
      booking = await Booking.findOne({ _id: id, isArchived: false });
    }

    if (!booking || booking.isArchived) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.'
      });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Only pending bookings can be rejected. Current status: '${booking.status}'.`
      });
    }

    const reason = (rejectionReason && String(rejectionReason).trim()) || 'Booking request rejected by administrator.';

    if (mockStore) {
      booking.status = 'rejected';
      booking.reviewedBy = req.user.id;
      booking.reviewedAt = new Date();
      booking.rejectionReason = reason;
      booking.updatedAt = new Date();
      mockStore.set(id, booking);

      return res.status(200).json({
        success: true,
        message: 'Venue booking request rejected.',
        data: populateMockBooking(booking, req)
      });
    }

    booking.status = 'rejected';
    booking.reviewedBy = req.user.id;
    booking.reviewedAt = new Date();
    booking.rejectionReason = reason;
    await booking.save();

    await booking.populate('event', 'title startDateTime endDateTime capacity status category');
    await booking.populate('venue', 'name location capacity facilities hourlyRate status');
    await booking.populate('organizer', 'name email organization phone');
    await booking.populate('reviewedBy', 'name email role');

    return res.status(200).json({
      success: true,
      message: 'Venue booking request rejected.',
      data: booking
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/bookings/:id/cancel
 * Cancel a pending or approved booking.
 * Accessible to the Organizer owner or Administrator.
 */
const cancelBooking = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format.'
      });
    }

    const mockStore = getStore(req);
    const isAdmin = req.user && req.user.role === 'administrator';

    let booking = null;
    if (mockStore) {
      booking = mockStore.get(id);
    } else {
      booking = await Booking.findOne({ _id: id, isArchived: false });
    }

    if (!booking || booking.isArchived) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.'
      });
    }

    const orgId = typeof booking.organizer === 'object' && booking.organizer
      ? (booking.organizer.id || booking.organizer._id)
      : booking.organizer;

    if (!isAdmin && String(orgId) !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You cannot cancel another organizer\'s booking.'
      });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Booking is already cancelled.'
      });
    }

    if (booking.status === 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a rejected booking.'
      });
    }

    if (mockStore) {
      booking.status = 'cancelled';
      booking.updatedAt = new Date();
      mockStore.set(id, booking);

      return res.status(200).json({
        success: true,
        message: 'Venue booking cancelled successfully.',
        data: populateMockBooking(booking, req)
      });
    }

    booking.status = 'cancelled';
    await booking.save();

    await booking.populate('event', 'title startDateTime endDateTime capacity status category');
    await booking.populate('venue', 'name location capacity facilities hourlyRate status');
    await booking.populate('organizer', 'name email organization phone');
    if (booking.reviewedBy) {
      await booking.populate('reviewedBy', 'name email role');
    }

    return res.status(200).json({
      success: true,
      message: 'Venue booking cancelled successfully.',
      data: booking
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getStore,
  createBooking,
  getBookings,
  getBookingById,
  approveBooking,
  rejectBooking,
  cancelBooking
};
