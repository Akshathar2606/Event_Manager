const mongoose = require('mongoose');
const { REGISTRATION_STATUS, ATTENDANCE_STATUS } = require('../models/Registration');
const { STUDENT_YEARS } = require('../models/Event');

/**
 * Checks if a string is a valid MongoDB ObjectId.
 * @param {string} id
 * @returns {boolean}
 */
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === String(id);
};

/**
 * Validates registration creation payload.
 *
 * @param {Object} input - Registration input payload
 * @returns {{ isValid: boolean, errors: string[], sanitized: Object }}
 */
const validateRegistrationInput = (input) => {
  const errors = [];
  const { event, eventId, academicYear } = input || {};

  const effectiveEventId = event || eventId;

  if (!effectiveEventId) {
    errors.push('Event reference ID is required.');
  } else if (!isValidObjectId(effectiveEventId)) {
    errors.push('Invalid event reference ID format.');
  }

  if (typeof academicYear !== 'string' || !STUDENT_YEARS.includes(academicYear)) {
    errors.push(`Current academic year is required and must be one of: ${STUDENT_YEARS.join(', ')}.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      event: effectiveEventId ? String(effectiveEventId) : null,
      academicYear: typeof academicYear === 'string' && STUDENT_YEARS.includes(academicYear)
        ? academicYear
        : undefined
    }
  };
};

/**
 * Validates registration cancellation payload.
 *
 * @param {Object} input - Cancellation payload
 * @returns {{ isValid: boolean, errors: string[], sanitized: Object }}
 */
const validateCancellationInput = (input) => {
  const errors = [];
  const { reason } = input || {};

  let sanitizedReason = '';
  if (reason !== undefined && reason !== null) {
    if (typeof reason !== 'string') {
      errors.push('Cancellation reason must be a string.');
    } else if (reason.trim().length > 500) {
      errors.push('Cancellation reason cannot exceed 500 characters.');
    } else {
      sanitizedReason = reason.trim();
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      reason: sanitizedReason
    }
  };
};

/**
 * Validates pagination and filter query parameters for registrations.
 *
 * @param {Object} query - Express req.query
 * @returns {{ page: number, limit: number, status?: string }}
 */
const validateRegistrationQuery = (query = {}) => {
  let page = parseInt(query.page, 10);
  if (isNaN(page) || page < 1) {
    page = 1;
  }

  let limit = parseInt(query.limit, 10);
  if (isNaN(limit) || limit < 1) {
    limit = 10;
  } else if (limit > 100) {
    limit = 100;
  }

  let status = undefined;
  if (query.status && typeof query.status === 'string') {
    const cleanStatus = query.status.trim().toLowerCase();
    if (REGISTRATION_STATUS.includes(cleanStatus)) {
      status = cleanStatus;
    }
  }

  const attendanceStatus = typeof query.attendanceStatus === 'string' &&
    ATTENDANCE_STATUS.includes(query.attendanceStatus.trim().toLowerCase())
    ? query.attendanceStatus.trim().toLowerCase()
    : undefined;
  const sortFields = new Set([
    'registeredAt',
    'name',
    'email',
    'organization',
    'status',
    'attendanceStatus',
    'academicYear'
  ]);
  const requestedSort = typeof query.sortBy === 'string' ? query.sortBy.trim() : '';
  const sortBy = sortFields.has(requestedSort) ? requestedSort : 'registeredAt';
  const sortOrder = String(query.sortOrder || '').toLowerCase() === 'asc' ? 'asc' : 'desc';
  const cleanText = (value) => typeof value === 'string' ? value.trim().slice(0, 100) : '';
  const dateFrom = cleanText(query.dateFrom);
  const dateTo = cleanText(query.dateTo);
  const validFrom = dateFrom && !Number.isNaN(Date.parse(dateFrom)) ? new Date(dateFrom) : undefined;
  const parsedTo = dateTo && !Number.isNaN(Date.parse(dateTo)) ? new Date(dateTo) : undefined;
  const validTo = parsedTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)
    ? new Date(`${dateTo}T23:59:59.999Z`)
    : parsedTo;

  return {
    page,
    limit,
    status,
    attendanceStatus,
    search: cleanText(query.search),
    department: cleanText(query.department),
    dateFrom: validFrom,
    dateTo: validTo,
    sortBy,
    sortOrder,
    idsOnly: query.idsOnly === 'true'
  };
};

module.exports = {
  isValidObjectId,
  STUDENT_YEARS,
  validateRegistrationInput,
  validateCancellationInput,
  validateRegistrationQuery
};
