const { CATERING_REQUEST_STATUS } = require('../models/CateringRequest');

/**
 * Validates 24-character hexadecimal MongoDB ObjectId string.
 * @param {*} id
 * @returns {boolean}
 */
const isValidObjectId = (id) => {
  if (typeof id !== 'string') return false;
  return /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * Validates request payload for creating a catering request.
 *
 * @param {Object} body
 * @returns {{ isValid: boolean, errors: string[], sanitized: Object }}
 */
const validateCreateCateringRequestInput = (body = {}) => {
  const errors = [];
  const sanitized = {};

  // 1. Event ID
  const eventId = body.eventId || body.event;
  if (!eventId) {
    errors.push('Event reference ID is required.');
  } else if (typeof eventId !== 'string' || (!isValidObjectId(eventId) && !eventId.startsWith('evt_'))) {
    errors.push('Event reference ID format is invalid.');
  } else {
    sanitized.eventId = eventId.trim();
  }

  // 2. Catering Service ID
  const cateringServiceId = body.cateringServiceId || body.cateringService;
  if (!cateringServiceId) {
    errors.push('Catering service reference ID is required.');
  } else if (typeof cateringServiceId !== 'string' || (!isValidObjectId(cateringServiceId) && !cateringServiceId.startsWith('cat_'))) {
    errors.push('Catering service reference ID format is invalid.');
  } else {
    sanitized.cateringServiceId = cateringServiceId.trim();
  }

  // 3. Package ID
  const packageId = body.packageId || body.package;
  if (!packageId) {
    errors.push('Selected package ID is required.');
  } else if (typeof packageId !== 'string' && typeof packageId !== 'object') {
    errors.push('Selected package ID format is invalid.');
  } else {
    sanitized.packageId = String(packageId).trim();
  }

  // 4. Guest Count
  const guestCount = Number(body.guestCount);
  if (body.guestCount === undefined || body.guestCount === null || body.guestCount === '') {
    errors.push('Guest count is required.');
  } else if (!Number.isInteger(guestCount) || guestCount < 1) {
    errors.push('Guest count must be an integer of at least 1 person.');
  } else {
    sanitized.guestCount = guestCount;
  }

  // 5. Service Date Time (Optional, defaults to event start time)
  if (body.serviceDateTime !== undefined && body.serviceDateTime !== null && body.serviceDateTime !== '') {
    const parsedDate = new Date(body.serviceDateTime);
    if (isNaN(parsedDate.getTime())) {
      errors.push('Service date and time is not a valid date.');
    } else {
      sanitized.serviceDateTime = parsedDate;
    }
  } else {
    sanitized.serviceDateTime = null;
  }

  // 6. Notes
  if (body.notes !== undefined && body.notes !== null) {
    if (typeof body.notes !== 'string') {
      errors.push('Notes must be a string.');
    } else if (body.notes.length > 1000) {
      errors.push('Notes cannot exceed 1000 characters.');
    } else {
      sanitized.notes = body.notes.trim();
    }
  } else {
    sanitized.notes = '';
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  };
};

/**
 * Validates vendor rejection payload.
 *
 * @param {Object} body
 * @returns {{ isValid: boolean, errors: string[], sanitized: Object }}
 */
const validateRejectionInput = (body = {}) => {
  const errors = [];
  const sanitized = {};

  const reason = body.rejectionReason || body.reason;
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    errors.push('Rejection reason is required.');
  } else if (reason.trim().length > 1000) {
    errors.push('Rejection reason cannot exceed 1000 characters.');
  } else {
    sanitized.rejectionReason = reason.trim();
  }

  const vendorNotes = body.vendorNotes || body.notes;
  if (vendorNotes !== undefined && vendorNotes !== null) {
    if (typeof vendorNotes !== 'string') {
      errors.push('Vendor notes must be a string.');
    } else if (vendorNotes.length > 1000) {
      errors.push('Vendor notes cannot exceed 1000 characters.');
    } else {
      sanitized.vendorNotes = vendorNotes.trim();
    }
  } else {
    sanitized.vendorNotes = '';
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  };
};

/**
 * Validates organizer cancellation payload.
 *
 * @param {Object} body
 * @returns {{ isValid: boolean, errors: string[], sanitized: Object }}
 */
const validateCancellationInput = (body = {}) => {
  const errors = [];
  const sanitized = {};

  const reason = body.cancellationReason || body.reason;
  if (reason !== undefined && reason !== null && reason !== '') {
    if (typeof reason !== 'string') {
      errors.push('Cancellation reason must be a string.');
    } else if (reason.length > 1000) {
      errors.push('Cancellation reason cannot exceed 1000 characters.');
    } else {
      sanitized.cancellationReason = reason.trim();
    }
  } else {
    sanitized.cancellationReason = '';
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  };
};

/**
 * Validates pagination and filter query parameters for request listings.
 *
 * @param {Object} query
 * @returns {{ page: number, limit: number, status: string|null, eventId: string|null }}
 */
const validateCateringRequestQuery = (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));

  let status = null;
  if (query.status && typeof query.status === 'string') {
    const s = query.status.trim().toLowerCase();
    if (CATERING_REQUEST_STATUS.includes(s)) {
      status = s;
    }
  }

  const eventId = query.eventId && typeof query.eventId === 'string' ? query.eventId.trim() : null;

  return { page, limit, status, eventId };
};

module.exports = {
  isValidObjectId,
  validateCreateCateringRequestInput,
  validateRejectionInput,
  validateCancellationInput,
  validateCateringRequestQuery
};
