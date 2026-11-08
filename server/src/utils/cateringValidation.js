const mongoose = require('mongoose');
const { DIETARY_OPTIONS } = require('../models/CateringService');
const { EMAIL_REGEX } = require('./validation');

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
};

/**
 * Validates vendor catering profile creation or update payload.
 */
const validateCateringProfileInput = (input, isUpdate = false) => {
  const errors = [];
  const {
    businessName,
    description,
    contactEmail,
    contactPhone,
    serviceArea,
    city,
    locality,
    fullAddress,
    location,
    cuisineTypes
  } = input || {};

  // Business Name
  if (!isUpdate || businessName !== undefined) {
    if (!businessName || typeof businessName !== 'string' || businessName.trim().length < 2) {
      errors.push('Business name is required and must be at least 2 characters long.');
    } else if (businessName.trim().length > 120) {
      errors.push('Business name cannot exceed 120 characters.');
    }
  }

  // Service Area
  if (!isUpdate || serviceArea !== undefined) {
    if (!serviceArea || typeof serviceArea !== 'string' || serviceArea.trim().length < 2) {
      errors.push('Service area or campus location is required.');
    } else if (serviceArea.trim().length > 200) {
      errors.push('Service area cannot exceed 200 characters.');
    }
  }

  // Description
  if (description !== undefined && typeof description === 'string' && description.length > 1000) {
    errors.push('Description cannot exceed 1000 characters.');
  }

  const optionalLocationStrings = [
    ['city', city, 100],
    ['locality', locality, 120],
    ['full address', fullAddress, 250]
  ];
  optionalLocationStrings.forEach(([label, value, maxLength]) => {
    if (value !== undefined && value !== null) {
      if (typeof value !== 'string') {
        errors.push(`${label} must be a string.`);
      } else if (value.trim().length > maxLength) {
        errors.push(`${label} cannot exceed ${maxLength} characters.`);
      }
    }
  });

  if (location !== undefined && location !== null) {
    const coordinates = location && location.coordinates;
    if (
      !location ||
      location.type !== 'Point' ||
      !Array.isArray(coordinates) ||
      coordinates.length !== 2 ||
      !coordinates.every(Number.isFinite) ||
      coordinates[0] < -180 ||
      coordinates[0] > 180 ||
      coordinates[1] < -90 ||
      coordinates[1] > 90
    ) {
      errors.push('Location must be a GeoJSON Point with [longitude, latitude] coordinates in valid ranges.');
    }
  }

  // Contact Email
  if (contactEmail && typeof contactEmail === 'string' && contactEmail.trim()) {
    if (!EMAIL_REGEX.test(contactEmail.trim())) {
      errors.push('Please provide a valid contact email address.');
    }
  }

  // Cuisine Types (array or comma-delimited)
  let sanitizedCuisines = [];
  if (cuisineTypes !== undefined) {
    if (Array.isArray(cuisineTypes)) {
      sanitizedCuisines = Array.from(
        new Set(
          cuisineTypes
            .filter((c) => typeof c === 'string' && c.trim().length > 0)
            .map((c) => c.trim())
        )
      );
    } else if (typeof cuisineTypes === 'string') {
      sanitizedCuisines = Array.from(
        new Set(
          cuisineTypes
            .split(',')
            .map((c) => c.trim())
            .filter((c) => c.length > 0)
        )
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      ...(businessName !== undefined && { businessName: typeof businessName === 'string' ? businessName.trim() : '' }),
      ...(description !== undefined && { description: typeof description === 'string' ? description.trim() : '' }),
      ...(contactEmail !== undefined && { contactEmail: typeof contactEmail === 'string' ? contactEmail.trim().toLowerCase() : '' }),
      ...(contactPhone !== undefined && { contactPhone: contactPhone ? String(contactPhone).trim() : '' }),
      ...(serviceArea !== undefined && { serviceArea: typeof serviceArea === 'string' ? serviceArea.trim() : '' }),
      ...(city !== undefined && { city: typeof city === 'string' ? city.trim() : '' }),
      ...(locality !== undefined && { locality: typeof locality === 'string' ? locality.trim() : '' }),
      ...(fullAddress !== undefined && { fullAddress: typeof fullAddress === 'string' ? fullAddress.trim() : '' }),
      ...(location !== undefined && { location: location === null ? null : location }),
      ...(cuisineTypes !== undefined && { cuisineTypes: sanitizedCuisines })
    }
  };
};

/**
 * Validates a catering package payload.
 */
const validatePackageInput = (input, isUpdate = false, currentPackage = {}) => {
  const errors = [];
  const { name, description, pricePerPlate, minOrder, maxGuests, menuItems, dietaryOptions } = input || {};

  // Package Name
  if (!isUpdate || name !== undefined) {
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      errors.push('Package name is required and must be at least 2 characters long.');
    } else if (name.trim().length > 100) {
      errors.push('Package name cannot exceed 100 characters.');
    }
  }

  // Price Per Plate
  if (!isUpdate || pricePerPlate !== undefined) {
    const numPrice = Number(pricePerPlate);
    if (pricePerPlate === undefined || pricePerPlate === null || pricePerPlate === '') {
      errors.push('Price per plate is required.');
    } else if (isNaN(numPrice) || numPrice < 0) {
      errors.push('Price per plate must be a non-negative number.');
    }
  }

  // Minimum Order Size
  if (minOrder !== undefined && minOrder !== null && minOrder !== '') {
    const numOrder = Number(minOrder);
    if (isNaN(numOrder) || !Number.isInteger(numOrder) || numOrder < 1) {
      errors.push('Minimum order size must be a whole number of at least 1 person.');
    }
  }

  const maxGuestsSupplied = maxGuests !== undefined && maxGuests !== null && maxGuests !== '';
  const effectiveMaxGuests = maxGuests === null || maxGuests === ''
    ? null
    : (maxGuests !== undefined ? Number(maxGuests) : currentPackage.maxGuests);
  if (maxGuestsSupplied && (!Number.isInteger(effectiveMaxGuests) || effectiveMaxGuests < 1)) {
      errors.push('Maximum guest capacity must be a whole number of at least 1 person.');
  } else if (effectiveMaxGuests !== undefined && effectiveMaxGuests !== null) {
    const effectiveMinOrder = minOrder !== undefined && minOrder !== null && minOrder !== ''
      ? Number(minOrder)
      : (currentPackage.minOrder || 10);
    if (effectiveMaxGuests < effectiveMinOrder) {
      errors.push('Maximum guest capacity must be greater than or equal to the minimum order.');
    }
  }

  // Menu Items sanitization
  let sanitizedMenuItems = [];
  if (menuItems !== undefined) {
    if (Array.isArray(menuItems)) {
      sanitizedMenuItems = Array.from(
        new Set(
          menuItems
            .filter((item) => typeof item === 'string' && item.trim().length > 0)
            .map((item) => item.trim())
        )
      );
    } else if (typeof menuItems === 'string') {
      sanitizedMenuItems = Array.from(
        new Set(
          menuItems
            .split('\n')
            .map((item) => item.trim())
            .filter((item) => item.length > 0)
        )
      );
    }
  }

  // Dietary Options sanitization
  let sanitizedDietary = [];
  if (dietaryOptions !== undefined) {
    if (Array.isArray(dietaryOptions)) {
      sanitizedDietary = Array.from(
        new Set(
          dietaryOptions
            .filter((d) => typeof d === 'string' && d.trim().length > 0)
            .map((d) => d.trim())
        )
      );
    } else if (typeof dietaryOptions === 'string') {
      sanitizedDietary = Array.from(
        new Set(
          dietaryOptions
            .split(',')
            .map((d) => d.trim())
            .filter((d) => d.length > 0)
        )
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description.trim() }),
      ...(pricePerPlate !== undefined && { pricePerPlate: Number(pricePerPlate) }),
      ...(minOrder !== undefined && { minOrder: Number(minOrder) }),
      ...(maxGuests !== undefined && { maxGuests: maxGuests === null || maxGuests === '' ? null : Number(maxGuests) }),
      ...(menuItems !== undefined && { menuItems: sanitizedMenuItems }),
      ...(dietaryOptions !== undefined && { dietaryOptions: sanitizedDietary })
    }
  };
};

module.exports = {
  isValidObjectId,
  validateCateringProfileInput,
  validatePackageInput
};
