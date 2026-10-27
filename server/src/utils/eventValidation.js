const mongoose = require('mongoose');
const { EVENT_CATEGORIES, EVENT_STATUS } = require('../models/Event');

/**
 * Checks if a string is a valid MongoDB ObjectId.
 */
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === String(id);
};

/**
 * Validates event creation or update payload against both input fields and effective document state.
 * @param {Object} input - Event payload fields
 * @param {boolean} isUpdate - True if updating existing event
 * @param {Object} existingEvent - Existing event record when updating (to cross-validate effective state)
 * @returns {{ isValid: boolean, errors: string[], sanitized: Object }}
 */
const validateEventInput = (input, isUpdate = false, existingEvent = null) => {
  const errors = [];
  const {
    title,
    description,
    category,
    venue,
    startDateTime,
    endDateTime,
    registrationDeadline,
    capacity,
    status,
    bannerUrl,
    budget,
    tags
  } = input || {};

  // Effective state resolution (merges update changes with existing document attributes)
  const effectiveTitle = title !== undefined ? title : existingEvent?.title;
  const effectiveDescription = description !== undefined ? description : existingEvent?.description;
  const effectiveCategory = category !== undefined ? category : existingEvent?.category;
  const effectiveCapacity = capacity !== undefined ? capacity : existingEvent?.capacity;

  // Title validation
  if (!isUpdate || title !== undefined) {
    if (!effectiveTitle || typeof effectiveTitle !== 'string' || effectiveTitle.trim().length < 3) {
      errors.push('Event title is required and must be at least 3 characters long.');
    } else if (effectiveTitle.trim().length > 150) {
      errors.push('Event title cannot exceed 150 characters.');
    }
  }

  // Description validation
  if (!isUpdate || description !== undefined) {
    if (!effectiveDescription || typeof effectiveDescription !== 'string' || effectiveDescription.trim().length === 0) {
      errors.push('Event description is required.');
    } else if (effectiveDescription.trim().length > 3000) {
      errors.push('Event description cannot exceed 3000 characters.');
    }
  }

  // Category validation
  if (!isUpdate || category !== undefined) {
    if (!effectiveCategory || typeof effectiveCategory !== 'string') {
      errors.push('Event category is required.');
    } else {
      const cleanCategory = effectiveCategory.trim().toLowerCase();
      if (!EVENT_CATEGORIES.includes(cleanCategory)) {
        errors.push(`Invalid event category '${category}'. Allowed categories: ${EVENT_CATEGORIES.join(', ')}.`);
      }
    }
  }

  // Capacity validation
  if (!isUpdate || capacity !== undefined) {
    const numCapacity = Number(effectiveCapacity);
    if (effectiveCapacity === undefined || effectiveCapacity === null || effectiveCapacity === '') {
      errors.push('Capacity is required.');
    } else if (isNaN(numCapacity) || !Number.isInteger(numCapacity) || numCapacity < 1) {
      errors.push('Capacity must be a positive integer greater than 0.');
    } else if (isUpdate && existingEvent && existingEvent.registeredCount !== undefined && existingEvent.registeredCount > 0) {
      if (numCapacity < Number(existingEvent.registeredCount)) {
        errors.push(`Cannot reduce event capacity to ${numCapacity}. There are already ${existingEvent.registeredCount} active participant registrations.`);
      }
    }
  }

  // Effective Date Resolution
  let parsedStart = null;
  let parsedEnd = null;
  let parsedDeadline = null;

  // Start Date
  if (startDateTime !== undefined) {
    if (!startDateTime) {
      errors.push('Event start date and time is required.');
    } else {
      parsedStart = new Date(startDateTime);
      if (isNaN(parsedStart.getTime())) {
        errors.push('Invalid event start date and time format.');
      }
    }
  } else if (existingEvent && existingEvent.startDateTime) {
    parsedStart = new Date(existingEvent.startDateTime);
  } else if (!isUpdate) {
    errors.push('Event start date and time is required.');
  }

  // End Date
  if (endDateTime !== undefined) {
    if (!endDateTime) {
      errors.push('Event end date and time is required.');
    } else {
      parsedEnd = new Date(endDateTime);
      if (isNaN(parsedEnd.getTime())) {
        errors.push('Invalid event end date and time format.');
      }
    }
  } else if (existingEvent && existingEvent.endDateTime) {
    parsedEnd = new Date(existingEvent.endDateTime);
  } else if (!isUpdate) {
    errors.push('Event end date and time is required.');
  }

  // Registration Deadline
  if (registrationDeadline !== undefined) {
    if (registrationDeadline !== null && registrationDeadline !== '') {
      parsedDeadline = new Date(registrationDeadline);
      if (isNaN(parsedDeadline.getTime())) {
        errors.push('Invalid registration deadline format.');
      }
    } else {
      parsedDeadline = null; // Explicit clearing
    }
  } else if (existingEvent && existingEvent.registrationDeadline) {
    parsedDeadline = new Date(existingEvent.registrationDeadline);
  }

  // Chronological checks across the complete effective date state
  if (parsedStart && parsedEnd && !isNaN(parsedStart.getTime()) && !isNaN(parsedEnd.getTime())) {
    if (parsedEnd <= parsedStart) {
      errors.push('Event end date and time must be after the start date and time.');
    }
  }

  if (parsedDeadline && !isNaN(parsedDeadline.getTime()) && parsedStart && !isNaN(parsedStart.getTime())) {
    if (parsedDeadline > parsedStart) {
      errors.push('Registration deadline cannot be after the event start date and time.');
    }
  }

  // Venue validation
  let sanitizedVenue = undefined;
  if (venue !== undefined) {
    if (venue === null || venue === '') {
      sanitizedVenue = null;
    } else if (typeof venue === 'string' && isValidObjectId(venue)) {
      sanitizedVenue = venue;
    } else if (venue && typeof venue === 'object' && venue._id && isValidObjectId(venue._id)) {
      sanitizedVenue = String(venue._id);
    } else if (venue && typeof venue === 'object' && venue.id && isValidObjectId(venue.id)) {
      sanitizedVenue = String(venue.id);
    } else {
      errors.push('Invalid venue reference ID.');
    }
  }

  // Status validation
  if (status !== undefined) {
    const cleanStatus = String(status).trim().toLowerCase();
    if (!EVENT_STATUS.includes(cleanStatus)) {
      errors.push(`Invalid status '${status}'. Allowed statuses: ${EVENT_STATUS.join(', ')}.`);
    }
  }

  // Budget validation
  if (budget !== undefined && budget !== null && budget !== '') {
    const numBudget = Number(budget);
    if (isNaN(numBudget) || numBudget < 0) {
      errors.push('Budget must be a non-negative number.');
    }
  }

  // Tags validation
  let sanitizedTags = undefined;
  if (tags !== undefined) {
    if (Array.isArray(tags)) {
      sanitizedTags = Array.from(
        new Set(
          tags
            .filter((t) => typeof t === 'string' && t.trim().length > 0)
            .map((t) => t.trim().toLowerCase())
        )
      );
    } else if (typeof tags === 'string') {
      sanitizedTags = Array.from(
        new Set(
          tags
            .split(',')
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean)
        )
      );
    } else {
      errors.push('Tags must be an array of strings.');
    }
  }

  // Sanitized payload (only includes explicitly provided fields on update)
  const sanitized = {};
  if (title !== undefined) sanitized.title = title.trim();
  if (description !== undefined) sanitized.description = description.trim();
  if (category !== undefined) sanitized.category = category.trim().toLowerCase();
  if (capacity !== undefined) sanitized.capacity = Number(capacity);
  if ((!isUpdate || startDateTime !== undefined) && parsedStart && !isNaN(parsedStart.getTime())) {
    sanitized.startDateTime = parsedStart;
  }
  if ((!isUpdate || endDateTime !== undefined) && parsedEnd && !isNaN(parsedEnd.getTime())) {
    sanitized.endDateTime = parsedEnd;
  }
  if (registrationDeadline !== undefined) {
    if (parsedDeadline && !isNaN(parsedDeadline.getTime())) {
      sanitized.registrationDeadline = parsedDeadline;
    } else {
      sanitized.registrationDeadline = null;
    }
  } else if (!isUpdate && parsedDeadline && !isNaN(parsedDeadline.getTime())) {
    sanitized.registrationDeadline = parsedDeadline;
  }
  if (sanitizedVenue !== undefined) sanitized.venue = sanitizedVenue;
  if (status !== undefined) sanitized.status = String(status).trim().toLowerCase();
  if (bannerUrl !== undefined) sanitized.bannerUrl = String(bannerUrl).trim();
  if (budget !== undefined && budget !== null && budget !== '') sanitized.budget = Number(budget);
  if (sanitizedTags !== undefined) sanitized.tags = sanitizedTags;

  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  };
};

module.exports = {
  isValidObjectId,
  validateEventInput,
  EVENT_CATEGORIES,
  EVENT_STATUS
};
