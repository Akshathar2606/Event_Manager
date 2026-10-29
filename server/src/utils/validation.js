const { PUBLIC_ALLOWED_ROLES, USER_ROLES } = require('../models/User');

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Validates registration input fields.
 * @param {Object} input - { name, email, password, role, phone, organization }
 * @returns {{ isValid: boolean, errors: string[], sanitized: Object }}
 */
const validateRegistrationInput = ({ name, email, password, role, phone, organization }) => {
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
    if (['administrator', 'vendor'].includes(targetRole)) {
      errors.push(
        `Self-registration as '${targetRole}' is strictly forbidden. Administrator and vendor accounts must be provisioned through administrative onboarding.`
      );
    } else {
      errors.push(`Invalid role '${targetRole}'. Public registration is restricted to: ${PUBLIC_ALLOWED_ROLES.join(', ')}.`);
    }
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
      organization: organization ? String(organization).trim() : ''
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

module.exports = {
  EMAIL_REGEX,
  validateRegistrationInput,
  validateLoginInput,
  validateForgotPasswordInput,
  validateResetPasswordInput
};
