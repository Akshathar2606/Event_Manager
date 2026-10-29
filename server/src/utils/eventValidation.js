const mongoose = require('mongoose');
const { EVENT_CATEGORIES, EVENT_STATUS, STUDENT_YEARS } = require('../models/Event');
const { EMAIL_REGEX } = require('./validation');

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
    aictePointsAvailable,
    attendanceProvided,
    eligibleYears,
    contacts,
    websiteUrl,
    instagramUrl,
    whatsappGroupUrl,
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

  const validateBooleanField = (fieldValue, fieldName) => {
    if (fieldValue !== undefined && typeof fieldValue !== 'boolean') {
      errors.push(`${fieldName} must be a boolean.`);
    }
  };
  validateBooleanField(aictePointsAvailable, 'AICTE points availability');
  validateBooleanField(attendanceProvided, 'Attendance availability');

  let sanitizedEligibleYears;
  if (eligibleYears !== undefined) {
    if (!Array.isArray(eligibleYears)) {
      errors.push('Eligible student years must be an array.');
    } else {
      const invalidYears = eligibleYears.filter(
        (year) => typeof year !== 'string' || !STUDENT_YEARS.includes(year)
      );
      if (invalidYears.length > 0) {
        errors.push(`Eligible student years must be selected from: ${STUDENT_YEARS.join(', ')}.`);
      }
      sanitizedEligibleYears = Array.from(new Set(eligibleYears.filter(
        (year) => typeof year === 'string' && STUDENT_YEARS.includes(year)
      )));
      if (sanitizedEligibleYears.length === 0) {
        errors.push('Select at least one eligible student year.');
      }
    }
  }

  let sanitizedContacts;
  if (contacts !== undefined) {
    if (!Array.isArray(contacts)) {
      errors.push('Event contacts must be an array.');
    } else if (contacts.length > 20) {
      errors.push('An event cannot have more than 20 contacts.');
    } else {
      const allowedContactFields = new Set(['name', 'role', 'email', 'phone']);
      sanitizedContacts = contacts.map((contact, index) => {
        const prefix = `Contact ${index + 1}`;
        if (
          !contact ||
          typeof contact !== 'object' ||
          Array.isArray(contact) ||
          Object.getPrototypeOf(contact) !== Object.prototype
        ) {
          errors.push(`${prefix} must be an object.`);
          return null;
        }

        if (Object.keys(contact).some((field) => !allowedContactFields.has(field))) {
          errors.push(`${prefix} contains unsupported fields.`);
        }

        const name = typeof contact.name === 'string' ? contact.name.trim() : '';
        const role = contact.role === undefined ? '' : contact.role;
        const email = typeof contact.email === 'string' ? contact.email.trim() : '';
        const phone = contact.phone === undefined ? '' : contact.phone;

        if (!name) {
          errors.push(`${prefix} name is required.`);
        } else if (name.length > 120) {
          errors.push(`${prefix} name cannot exceed 120 characters.`);
        }
        if (typeof role !== 'string') {
          errors.push(`${prefix} role must be a string.`);
        } else if (role.trim().length > 100) {
          errors.push(`${prefix} role cannot exceed 100 characters.`);
        }
        if (!email || !EMAIL_REGEX.test(email)) {
          errors.push(`${prefix} must have a valid email address.`);
        }
        if (typeof phone !== 'string') {
          errors.push(`${prefix} phone must be a string.`);
        } else if (phone.trim()) {
          const trimmedPhone = phone.trim();
          const digitCount = (trimmedPhone.match(/\d/g) || []).length;
          if (!/^\+?[\d\s().-]+$/.test(trimmedPhone) || digitCount < 7 || digitCount > 15) {
            errors.push(`${prefix} phone must be a valid phone number.`);
          }
        }

        return {
          name,
          role: typeof role === 'string' ? role.trim() : '',
          email: email.toLowerCase(),
          phone: typeof phone === 'string' ? phone.trim() : ''
        };
      });
    }
  }

  const normalizeEventUrl = (value, fieldName, instagramOnly = false) => {
    if (value === undefined) return undefined;
    if (typeof value !== 'string') {
      errors.push(`${fieldName} must be a URL string.`);
      return '';
    }
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed.length > 2048) {
      errors.push(`${fieldName} cannot exceed 2048 characters.`);
      return '';
    }

    try {
      const parsed = new URL(trimmed);
      if (
        !['http:', 'https:'].includes(parsed.protocol) ||
        !parsed.hostname ||
        parsed.username ||
        parsed.password
      ) {
        errors.push(`${fieldName} must be an absolute HTTP or HTTPS URL.`);
        return '';
      }
      if (
        instagramOnly &&
        parsed.hostname !== 'instagram.com' &&
        !parsed.hostname.endsWith('.instagram.com')
      ) {
        errors.push('Instagram URL must use an Instagram domain.');
        return '';
      }
      return parsed.toString();
    } catch {
      errors.push(`${fieldName} must be a valid absolute HTTP or HTTPS URL.`);
      return '';
    }
  };
  const sanitizedWebsiteUrl = normalizeEventUrl(websiteUrl, 'Website URL');
  const sanitizedInstagramUrl = normalizeEventUrl(instagramUrl, 'Instagram URL', true);
  let sanitizedWhatsAppGroupUrl;
  if (whatsappGroupUrl !== undefined) {
    if (typeof whatsappGroupUrl !== 'string') {
      errors.push('WhatsApp group invite URL must be a URL string.');
      sanitizedWhatsAppGroupUrl = '';
    } else {
      const trimmed = whatsappGroupUrl.trim();
      if (!trimmed) {
        sanitizedWhatsAppGroupUrl = '';
      } else if (trimmed.length > 2048) {
        errors.push('WhatsApp group invite URL cannot exceed 2048 characters.');
        sanitizedWhatsAppGroupUrl = '';
      } else {
        try {
          const parsed = new URL(trimmed);
          if (
            parsed.protocol !== 'https:' ||
            parsed.hostname !== 'chat.whatsapp.com' ||
            parsed.port ||
            !parsed.pathname || parsed.pathname === '/' ||
            parsed.username ||
            parsed.password
          ) {
            errors.push('WhatsApp group invite URL must be a valid HTTPS chat.whatsapp.com invitation.');
            sanitizedWhatsAppGroupUrl = '';
          } else {
            sanitizedWhatsAppGroupUrl = parsed.toString();
          }
        } catch {
          errors.push('WhatsApp group invite URL must be a valid HTTPS chat.whatsapp.com invitation.');
          sanitizedWhatsAppGroupUrl = '';
        }
      }
    }
  }

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
  if (aictePointsAvailable !== undefined) sanitized.aictePointsAvailable = aictePointsAvailable;
  else if (!isUpdate || existingEvent?.aictePointsAvailable === undefined) {
    sanitized.aictePointsAvailable = false;
  }
  if (attendanceProvided !== undefined) sanitized.attendanceProvided = attendanceProvided;
  else if (!isUpdate || existingEvent?.attendanceProvided === undefined) {
    sanitized.attendanceProvided = false;
  }
  if (sanitizedEligibleYears !== undefined) {
    sanitized.eligibleYears = sanitizedEligibleYears;
  } else if (!isUpdate || existingEvent?.eligibleYears === undefined) {
    sanitized.eligibleYears = [...STUDENT_YEARS];
  }
  if (sanitizedContacts !== undefined) sanitized.contacts = sanitizedContacts;
  else if (!isUpdate || existingEvent?.contacts === undefined) sanitized.contacts = [];
  if (sanitizedWebsiteUrl !== undefined) sanitized.websiteUrl = sanitizedWebsiteUrl;
  else if (!isUpdate || existingEvent?.websiteUrl === undefined) sanitized.websiteUrl = '';
  if (sanitizedInstagramUrl !== undefined) sanitized.instagramUrl = sanitizedInstagramUrl;
  else if (!isUpdate || existingEvent?.instagramUrl === undefined) sanitized.instagramUrl = '';
  if (sanitizedWhatsAppGroupUrl !== undefined) sanitized.whatsappGroupUrl = sanitizedWhatsAppGroupUrl;
  else if (!isUpdate || existingEvent?.whatsappGroupUrl === undefined) sanitized.whatsappGroupUrl = '';
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
  EVENT_STATUS,
  STUDENT_YEARS
};
