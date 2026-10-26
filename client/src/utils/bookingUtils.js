/**
 * Converts an ISO date string to HTML datetime-local input format (YYYY-MM-DDTHH:mm).
 * @param {string|Date} isoString
 * @returns {string}
 */
export const toDatetimeLocal = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

/**
 * Formats an ISO date string for user-facing display.
 * @param {string|Date} isoString
 * @returns {string}
 */
export const formatDisplayDate = (isoString) => {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Checks whether the booking interval fully covers the event interval.
 * Rule: bookingStart <= eventStart && bookingEnd >= eventEnd
 *
 * @param {string|Date|number} bookingStart
 * @param {string|Date|number} bookingEnd
 * @param {string|Date|number} eventStart
 * @param {string|Date|number} eventEnd
 * @returns {boolean}
 */
export const doesBookingCoverEvent = (bookingStart, bookingEnd, eventStart, eventEnd) => {
  if (!bookingStart || !bookingEnd || !eventStart || !eventEnd) return false;
  const bS = new Date(bookingStart).getTime();
  const bE = new Date(bookingEnd).getTime();
  const eS = new Date(eventStart).getTime();
  const eE = new Date(eventEnd).getTime();
  if (isNaN(bS) || isNaN(bE) || isNaN(eS) || isNaN(eE)) return false;
  return bS <= eS && bE >= eE;
};

/**
 * Evaluates whether an event can be selected for booking a given venue.
 *
 * @param {Object} event
 * @param {string} targetVenueId
 * @returns {{ isEligible: boolean, hasDifferentVenue: boolean, isCapacityExceeded: boolean }}
 */
export const evaluateBookingEligibility = (event, targetVenueId, venueCapacity) => {
  if (!event || event.status === 'cancelled') {
    return { isEligible: false, hasDifferentVenue: false, isCapacityExceeded: false };
  }

  const assignedVenueId = event.venue
    ? typeof event.venue === 'object'
      ? (event.venue.id || event.venue._id)
      : event.venue
    : null;

  const hasDifferentVenue = Boolean(
    assignedVenueId && targetVenueId && String(assignedVenueId) !== String(targetVenueId)
  );

  const isCapacityExceeded = Boolean(
    venueCapacity && event.capacity && Number(event.capacity) > Number(venueCapacity)
  );

  return {
    isEligible: !hasDifferentVenue,
    hasDifferentVenue,
    isCapacityExceeded
  };
};

/**
 * Checks if a booking status allows cancellation.
 * Only pending and approved bookings may be cancelled by organizers.
 *
 * @param {string} status
 * @returns {boolean}
 */
export const isBookingCancellable = (status) => {
  return status === 'pending' || status === 'approved';
};

/**
 * Checks if two date-time intervals overlap.
 * Rule: startA < endB && endA > startB.
 * Adjacent intervals (e.g. 10:00-11:00 and 11:00-12:00) do NOT overlap.
 *
 * @param {Date|string|number} startA
 * @param {Date|string|number} endA
 * @param {Date|string|number} startB
 * @param {Date|string|number} endB
 * @returns {boolean}
 */
export const areIntervalsConflicting = (startA, endA, startB, endB) => {
  if (!startA || !endA || !startB || !endB) return false;
  const sA = new Date(startA).getTime();
  const eA = new Date(endA).getTime();
  const sB = new Date(startB).getTime();
  const eB = new Date(endB).getTime();
  if (isNaN(sA) || isNaN(eA) || isNaN(sB) || isNaN(eB)) return false;
  return sA < eB && eA > sB;
};

/**
 * Detects advisory schedule conflicts for a target booking against a collection of bookings.
 *
 * Distinguishes between:
 * - Approved bookings that actively block approval
 * - Other pending bookings that require administrative comparison
 * - Cancelled or rejected bookings (ignored)
 *
 * Excludes the target booking itself so an approved booking is not marked as conflicting with itself.
 *
 * @param {Object} targetBooking
 * @param {Array<Object>} allBookings
 * @returns {{
 *   hasApprovedConflict: boolean,
 *   hasPendingConflict: boolean,
 *   approvedConflicts: Array<Object>,
 *   pendingConflicts: Array<Object>
 * }}
 */
export const detectBookingConflicts = (targetBooking, allBookings = []) => {
  if (!targetBooking || !Array.isArray(allBookings) || allBookings.length === 0) {
    return {
      hasApprovedConflict: false,
      hasPendingConflict: false,
      approvedConflicts: [],
      pendingConflicts: []
    };
  }

  const targetId = targetBooking.id || targetBooking._id;
  const targetVenueId = targetBooking.venue
    ? typeof targetBooking.venue === 'object'
      ? (targetBooking.venue.id || targetBooking.venue._id)
      : targetBooking.venue
    : null;

  if (!targetVenueId || !targetBooking.startDateTime || !targetBooking.endDateTime) {
    return {
      hasApprovedConflict: false,
      hasPendingConflict: false,
      approvedConflicts: [],
      pendingConflicts: []
    };
  }

  const approvedConflicts = [];
  const pendingConflicts = [];

  for (const other of allBookings) {
    if (!other || other.isArchived) continue;

    const otherId = other.id || other._id;
    // Rule: Avoid falsely marking a booking as conflicting with itself
    if (targetId && otherId && String(targetId) === String(otherId)) {
      continue;
    }

    const otherVenueId = other.venue
      ? typeof other.venue === 'object'
        ? (other.venue.id || other.venue._id)
        : other.venue
      : null;

    // Must be for the exact same venue
    if (!otherVenueId || String(otherVenueId) !== String(targetVenueId)) {
      continue;
    }

    // Only approved and pending statuses represent potential or active conflicts
    // Cancelled and rejected bookings are never treated as conflicts
    if (other.status !== 'approved' && other.status !== 'pending') {
      continue;
    }

    // Interval overlap test: startA < endB && endA > startB
    if (areIntervalsConflicting(
      targetBooking.startDateTime,
      targetBooking.endDateTime,
      other.startDateTime,
      other.endDateTime
    )) {
      if (other.status === 'approved') {
        approvedConflicts.push(other);
      } else if (other.status === 'pending') {
        pendingConflicts.push(other);
      }
    }
  }

  return {
    hasApprovedConflict: approvedConflicts.length > 0,
    hasPendingConflict: pendingConflicts.length > 0,
    approvedConflicts,
    pendingConflicts
  };
};

/**
 * Validates an administrator's booking rejection reason.
 * Requires a non-empty reason and enforces a maximum of 1000 characters.
 *
 * @param {string} reason
 * @returns {{ isValid: boolean, error: string|null, sanitized: string }}
 */
export const validateRejectionReason = (reason) => {
  if (typeof reason !== 'string') {
    return { isValid: false, error: 'Rejection reason is required.', sanitized: '' };
  }

  const trimmed = reason.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Rejection reason cannot be empty.', sanitized: '' };
  }

  if (trimmed.length > 1000) {
    return {
      isValid: false,
      error: `Rejection reason cannot exceed 1000 characters (currently ${trimmed.length}).`,
      sanitized: trimmed
    };
  }

  return { isValid: true, error: null, sanitized: trimmed };
};
