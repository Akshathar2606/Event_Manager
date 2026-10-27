const mongoose = require('mongoose');
const { REGISTRATION_STATUS } = require('../models/Registration');

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
  const { event, eventId } = input || {};

  const effectiveEventId = event || eventId;

  if (!effectiveEventId) {
    errors.push('Event reference ID is required.');
  } else if (!isValidObjectId(effectiveEventId)) {
    errors.push('Invalid event reference ID format.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      event: effectiveEventId ? String(effectiveEventId) : null
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

  return { page, limit, status };
};

module.exports = {
  isValidObjectId,
  validateRegistrationInput,
  validateCancellationInput,
  validateRegistrationQuery
};
