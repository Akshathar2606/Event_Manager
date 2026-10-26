const mongoose = require('mongoose');
const { VENUE_STATUS } = require('../models/Venue');

/**
 * Checks if a string is a valid MongoDB ObjectId.
 */
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
};

/**
 * Validates venue creation or update payload.
 * @param {Object} input - { name, description, location, capacity, facilities, images, hourlyRate, status }
 * @param {boolean} isUpdate - Whether this is a partial or full update
 * @returns {{ isValid: boolean, errors: string[], sanitized: Object }}
 */
const validateVenueInput = (input, isUpdate = false) => {
  const errors = [];
  const { name, description, location, capacity, facilities, images, hourlyRate, status } = input || {};

  // Name validation
  if (!isUpdate || name !== undefined) {
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      errors.push('Venue name is required and must be at least 2 characters long.');
    } else if (name.trim().length > 120) {
      errors.push('Venue name cannot exceed 120 characters.');
    }
  }

  // Location validation
  if (!isUpdate || location !== undefined) {
    if (!location || typeof location !== 'string' || location.trim().length < 2) {
      errors.push('Location is required and must be at least 2 characters long.');
    } else if (location.trim().length > 200) {
      errors.push('Location cannot exceed 200 characters.');
    }
  }

  // Capacity validation
  if (!isUpdate || capacity !== undefined) {
    const numCapacity = Number(capacity);
    if (capacity === undefined || capacity === null || capacity === '') {
      errors.push('Capacity is required.');
    } else if (isNaN(numCapacity) || !Number.isInteger(numCapacity) || numCapacity < 1) {
      errors.push('Capacity must be a positive whole number greater than 0.');
    }
  }

  // Hourly Rate validation
  if (hourlyRate !== undefined && hourlyRate !== null && hourlyRate !== '') {
    const numRate = Number(hourlyRate);
    if (isNaN(numRate) || numRate < 0) {
      errors.push('Hourly rate must be a non-negative number.');
    }
  }

  // Status validation
  if (status !== undefined) {
    const cleanStatus = String(status).trim().toLowerCase();
    if (!VENUE_STATUS.includes(cleanStatus)) {
      errors.push(`Invalid status '${status}'. Allowed statuses: ${VENUE_STATUS.join(', ')}.`);
    }
  }

  // Facilities validation
  let sanitizedFacilities = [];
  if (facilities !== undefined) {
    if (Array.isArray(facilities)) {
      sanitizedFacilities = Array.from(
        new Set(
          facilities
            .filter((f) => typeof f === 'string' && f.trim().length > 0)
            .map((f) => f.trim())
        )
      );
    } else if (typeof facilities === 'string') {
      sanitizedFacilities = Array.from(
        new Set(
          facilities
            .split(',')
            .map((f) => f.trim())
            .filter((f) => f.length > 0)
        )
      );
    }
  }

  // Images validation
  let sanitizedImages = [];
  if (images !== undefined) {
    if (Array.isArray(images)) {
      sanitizedImages = images
        .filter((img) => typeof img === 'string' && img.trim().length > 0)
        .map((img) => img.trim());
    } else if (typeof images === 'string' && images.trim().length > 0) {
      sanitizedImages = [images.trim()];
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description.trim() }),
      ...(location !== undefined && { location: location.trim() }),
      ...(capacity !== undefined && { capacity: Number(capacity) }),
      ...(hourlyRate !== undefined && { hourlyRate: Number(hourlyRate) }),
      ...(status !== undefined && { status: String(status).trim().toLowerCase() }),
      ...(facilities !== undefined && { facilities: sanitizedFacilities }),
      ...(images !== undefined && { images: sanitizedImages })
    }
  };
};

module.exports = {
  isValidObjectId,
  validateVenueInput
};
