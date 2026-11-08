const { PUBLIC_ALLOWED_ROLES, USER_ROLES } = require('../models/User');

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Validates registration input fields.
 * @param {Object} input - { name, email, password, role, phone, organization }
 * @returns {{ isValid: boolean, errors: string[], sanitized: Object }}
 */
const validateRegistrationInput = ({
  name,
  email,
  password,
  role,
  phone,
  organization,
  vendorApplication
}) => {
  const errors = [];

  // Name validation
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Name is required and must be at least 2 characters long.');
  }

  // Email validation
  if (!email || typeof email !== 'string') {
    errors.push('Email is required.');
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.push('Please enter a valid email address.');
  }

  // Password validation: at least 8 characters, at least 1 letter and 1 number
  if (!password || typeof password !== 'string') {
    errors.push('Password is required.');
  } else {
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long.');
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one letter and one number.');
    }
  }

  // Public Role Authorization Validation
  const targetRole = role ? String(role).trim().toLowerCase() : 'participant';
  if (!PUBLIC_ALLOWED_ROLES.includes(targetRole)) {
    if (targetRole === 'administrator') {
      errors.push('Self-registration as an administrator is strictly forbidden.');
    } else {
      errors.push(`Invalid role '${targetRole}'. Public registration is restricted to: ${PUBLIC_ALLOWED_ROLES.join(', ')}.`);
    }
  }

  let sanitizedVendorApplication;
  if (targetRole === 'vendor') {
    const application = vendorApplication && typeof vendorApplication === 'object' &&
      !Array.isArray(vendorApplication) ? vendorApplication : {};
    const allowedApplicationFields = [
      'businessName',
      'businessCategory',
      'businessDescription',
      'contactNumber',
      'city',
      'locality',
      'servicesOffered'
    ];
    if (Object.keys(application).some((field) => !allowedApplicationFields.includes(field))) {
      errors.push('Vendor application contains unsupported fields.');
    }

    const boundedApplicationString = (field, label, minLength, maxLength) => {
      const value = application[field];
      if (typeof value !== 'string') {
        errors.push(`${label} is required.`);
        return '';
      }
      const trimmed = value.trim();
      if (trimmed.length < minLength || trimmed.length > maxLength) {
        errors.push(`${label} must be between ${minLength} and ${maxLength} characters.`);
      }
      return trimmed;
    };

    const businessName = boundedApplicationString('businessName', 'Business name', 2, 120);
    const businessCategory = boundedApplicationString('businessCategory', 'Business category', 2, 80);
    const businessDescription = boundedApplicationString(
      'businessDescription',
      'Business description',
      10,
      1000
    );
    const contactNumber = boundedApplicationString('contactNumber', 'Contact number', 7, 30);
    const contactDigits = (contactNumber.match(/\d/g) || []).length;
    if (contactNumber && (!/^[+()\d.\-\s]+$/.test(contactNumber) || contactDigits < 7 || contactDigits > 15)) {
      errors.push('Contact number must contain 7 to 15 digits and only valid phone characters.');
    }
    const city = boundedApplicationString('city', 'City', 2, 100);
    const locality = boundedApplicationString('locality', 'Locality', 2, 120);
    const submittedServices = application.servicesOffered;
    if (!Array.isArray(submittedServices) || submittedServices.length < 1 || submittedServices.length > 20) {
      errors.push('Provide between 1 and 20 services offered.');
    }
    const servicesOffered = Array.isArray(submittedServices)
      ? submittedServices.map((service) => {
        if (typeof service !== 'string') {
          errors.push('Each service offered must be text.');
          return '';
        }
        const trimmed = service.trim();
        if (trimmed.length < 2 || trimmed.length > 80) {
          errors.push('Each service offered must be between 2 and 80 characters.');
        }
        return trimmed;
      }).filter(Boolean)
      : [];
    if (new Set(servicesOffered.map((service) => service.toLowerCase())).size !== servicesOffered.length) {
      errors.push('Services offered must not contain duplicates.');
    }

    sanitizedVendorApplication = {
      businessName,
      businessCategory,
      businessDescription,
      contactNumber,
      city,
      locality,
      servicesOffered
    };
  } else if (vendorApplication !== undefined) {
    errors.push('Vendor business information is only accepted for vendor registrations.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      name: name ? name.trim() : '',
      email: email ? email.trim().toLowerCase() : '',
      password: password || '',
      role: targetRole,
      phone: phone ? String(phone).trim() : '',
      organization: organization ? String(organization).trim() : '',
      vendorApplication: sanitizedVendorApplication
    }
  };
};

/**
 * Validates login input fields.
 * @param {Object} input - { email, password }
 * @returns {{ isValid: boolean, errors: string[], sanitized: Object }}
 */
const validateLoginInput = ({ email, password }) => {
  const errors = [];

  if (!email || typeof email !== 'string' || !email.trim()) {
    errors.push('Email is required.');
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.push('Please enter a valid email address.');
  }

  if (!password || typeof password !== 'string' || !password) {
    errors.push('Password is required.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      email: email ? email.trim().toLowerCase() : '',
      password: password || ''
    }
  };
};

const validateForgotPasswordInput = ({ email } = {}) => {
  if (typeof email !== 'string' || !email.trim()) {
    return { isValid: false, errors: ['Email is required.'], sanitized: { email: '' } };
  }
  if (!EMAIL_REGEX.test(email.trim())) {
    return {
      isValid: false,
      errors: ['Please enter a valid email address.'],
      sanitized: { email: '' }
    };
  }
  return {
    isValid: true,
    errors: [],
    sanitized: { email: email.trim().toLowerCase() }
  };
};

const validateResetPasswordInput = ({ token, newPassword } = {}) => {
  const errors = [];
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) {
    errors.push('A valid password reset token is required.');
  }
  if (typeof newPassword !== 'string' || !newPassword) {
    errors.push('New password is required.');
  } else {
    if (newPassword.length < 8) {
      errors.push('Password must be at least 8 characters long.');
    }
    if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      errors.push('Password must contain at least one letter and one number.');
    }
  }
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      token: typeof token === 'string' ? token : '',
      newPassword: typeof newPassword === 'string' ? newPassword : ''
    }
  };
};

const validateProfileUpdateInput = (input = {}) => {
  const errors = [];
  const allowedFields = new Set([
    'firstName',
    'lastName',
    'phone',
    'organization',
    'location',
    'bio',
    'interests',
    'socialLinks'
  ]);
  const incoming = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const forbiddenFields = Object.keys(incoming).filter((field) => !allowedFields.has(field));

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    errors.push('Profile data must be an object.');
  }
  if (forbiddenFields.length > 0) {
    errors.push(`Profile cannot update: ${forbiddenFields.join(', ')}.`);
  }

  const firstName = typeof incoming.firstName === 'string' ? incoming.firstName.trim() : '';
  const lastName = typeof incoming.lastName === 'string' ? incoming.lastName.trim() : '';
  if (!firstName || firstName.length > 50) {
    errors.push('First name is required and cannot exceed 50 characters.');
  }
  if (typeof incoming.lastName !== 'string' || lastName.length > 50) {
    errors.push('Last name must be a string and cannot exceed 50 characters.');
  }
  const name = [firstName, lastName].filter(Boolean).join(' ');
  if (name.length < 2 || name.length > 100) {
    errors.push('Full name must be between 2 and 100 characters.');
  }

  const boundedString = (field, label, maxLength) => {
    const value = incoming[field] === undefined ? '' : incoming[field];
    if (typeof value !== 'string') {
      errors.push(`${label} must be a string.`);
      return '';
    }
    const trimmed = value.trim();
    if (trimmed.length > maxLength) {
      errors.push(`${label} cannot exceed ${maxLength} characters.`);
    }
    return trimmed;
  };

  const phone = boundedString('phone', 'Phone number', 30);
  const phoneDigits = (phone.match(/\d/g) || []).length;
  if (phone && (!/^[+()\d.\-\s]+$/.test(phone) || phoneDigits < 7 || phoneDigits > 15)) {
    errors.push('Phone number must contain 7 to 15 digits and only valid phone characters.');
  }
  const organization = boundedString('organization', 'Organization', 120);
  const location = boundedString('location', 'Location', 120);
  const bio = boundedString('bio', 'Bio', 500);

  const interests = incoming.interests === undefined ? [] : incoming.interests;
  if (!Array.isArray(interests) || interests.length > 20) {
    errors.push('Interests must be a list of no more than 20 items.');
  }
  const sanitizedInterests = Array.isArray(interests)
    ? interests.map((interest) => {
      if (typeof interest !== 'string') {
        errors.push('Each interest must be text.');
        return '';
      }
      const trimmed = interest.trim();
      if (!trimmed || trimmed.length > 40) {
        errors.push('Each interest must be between 1 and 40 characters.');
      }
      return trimmed;
    }).filter(Boolean)
    : [];
  if (new Set(sanitizedInterests.map((interest) => interest.toLowerCase())).size !== sanitizedInterests.length) {
    errors.push('Interests must not contain duplicates.');
  }

  const socialLinks = incoming.socialLinks === undefined ? [] : incoming.socialLinks;
  if (!Array.isArray(socialLinks) || socialLinks.length > 10) {
    errors.push('Social links must be a list of no more than 10 items.');
  }
  const sanitizedSocialLinks = Array.isArray(socialLinks)
    ? socialLinks.map((link) => {
      if (!link || typeof link !== 'object' || Array.isArray(link)) {
        errors.push('Each social link must include a label and URL.');
        return null;
      }
      if (Object.keys(link).some((field) => !['label', 'url'].includes(field))) {
        errors.push('Social links may only include a label and URL.');
      }
      const label = typeof link.label === 'string' ? link.label.trim() : '';
      const url = typeof link.url === 'string' ? link.url.trim() : '';
      if (!label || label.length > 30) errors.push('Social link labels must be between 1 and 30 characters.');
      if (!url || url.length > 2048) errors.push('Social link URLs are required and cannot exceed 2048 characters.');
      try {
        const parsedUrl = new URL(url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
          errors.push('Social link URLs must use HTTP or HTTPS and cannot contain credentials.');
        }
      } catch {
        errors.push('Enter a valid social link URL.');
      }
      return { label, url };
    }).filter(Boolean)
    : [];

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      firstName,
      lastName,
      name,
      phone,
      organization,
      location,
      bio,
      interests: sanitizedInterests,
      socialLinks: sanitizedSocialLinks
    }
  };
};

module.exports = {
  EMAIL_REGEX,
  validateRegistrationInput,
  validateLoginInput,
  validateForgotPasswordInput,
  validateResetPasswordInput,
  validateProfileUpdateInput
};
