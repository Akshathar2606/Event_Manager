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
