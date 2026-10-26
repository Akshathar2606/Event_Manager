const mongoose = require('mongoose');
const { BOOKING_STATUS } = require('../models/Booking');

/**
 * Checks if a string is a valid MongoDB ObjectId.
 * @param {string} id
 * @returns {boolean}
 */
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === String(id);
};

/**
 * Checks if two date-time intervals conflict.
 * Two intervals conflict when:
 * startA < endB AND endA > startB.
 * Adjacent intervals (such as 10:00-11:00 and 11:00-12:00) do NOT conflict.
 *
 * @param {Date|string|number} startA
 * @param {Date|string|number} endA
 * @param {Date|string|number} startB
 * @param {Date|string|number} endB
 * @returns {boolean}
 */
const areIntervalsConflicting = (startA, endA, startB, endB) => {
  const sA = new Date(startA).getTime();
  const eA = new Date(endA).getTime();
  const sB = new Date(startB).getTime();
  const eB = new Date(endB).getTime();

  return sA < eB && eA > sB;
};

/**
 * Checks if a booking time interval covers the full event duration.
 * Rule: bookingStart <= eventStart AND bookingEnd >= eventEnd.
 *
 * @param {Date|string|number} bookingStart
 * @param {Date|string|number} bookingEnd
 * @param {Date|string|number} eventStart
 * @param {Date|string|number} eventEnd
 * @returns {boolean}
 */
const doesIntervalCover = (bookingStart, bookingEnd, eventStart, eventEnd) => {
  const bStart = new Date(bookingStart).getTime();
  const bEnd = new Date(bookingEnd).getTime();
  const eStart = new Date(eventStart).getTime();
  const eEnd = new Date(eventEnd).getTime();

  return bStart <= eStart && bEnd >= eEnd;
};

/**
 * Validates booking creation or update payload.
 *
 * @param {Object} input - Booking input payload
 * @returns {{ isValid: boolean, errors: string[], sanitized: Object }}
 */
const validateBookingInput = (input) => {
  const errors = [];
  const {
    event,
    eventId,
    venue,
    venueId,
    startDateTime,
    endDateTime,
    purpose,
    notes
  } = input || {};

  const effectiveEventId = event || eventId;
  const effectiveVenueId = venue || venueId;

  // Event ID validation
  if (!effectiveEventId) {
    errors.push('Event reference ID is required.');
  } else if (!isValidObjectId(effectiveEventId)) {
    errors.push('Invalid event reference ID format.');
  }

  // Venue ID validation
  if (!effectiveVenueId) {
    errors.push('Venue reference ID is required.');
  } else if (!isValidObjectId(effectiveVenueId)) {
    errors.push('Invalid venue reference ID format.');
  }

  // Start Date validation if provided
  let parsedStart = null;
  if (startDateTime !== undefined && startDateTime !== null && startDateTime !== '') {
    parsedStart = new Date(startDateTime);
    if (isNaN(parsedStart.getTime())) {
      errors.push('Invalid booking start date and time format.');
    }
  }

  // End Date validation if provided
  let parsedEnd = null;
  if (endDateTime !== undefined && endDateTime !== null && endDateTime !== '') {
    parsedEnd = new Date(endDateTime);
    if (isNaN(parsedEnd.getTime())) {
      errors.push('Invalid booking end date and time format.');
    }
  }

  if (parsedStart && parsedEnd && !isNaN(parsedStart.getTime()) && !isNaN(parsedEnd.getTime())) {
    if (parsedEnd <= parsedStart) {
      errors.push('Booking end date and time must be after the start date and time.');
    }
  }

  // Purpose / notes validation
  const effectivePurpose = (purpose !== undefined ? purpose : notes) || '';
  if (typeof effectivePurpose === 'string' && effectivePurpose.trim().length > 1000) {
    errors.push('Purpose/notes cannot exceed 1000 characters.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      event: effectiveEventId ? String(effectiveEventId) : null,
      venue: effectiveVenueId ? String(effectiveVenueId) : null,
      startDateTime: parsedStart,
      endDateTime: parsedEnd,
      purpose: typeof effectivePurpose === 'string' ? effectivePurpose.trim() : '',
      notes: typeof effectivePurpose === 'string' ? effectivePurpose.trim() : ''
    }
  };
};

module.exports = {
  isValidObjectId,
  areIntervalsConflicting,
  doesIntervalCover,
  validateBookingInput
};
