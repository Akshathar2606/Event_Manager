const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const validateRecoveryEmail = (email) => {
  if (!email || !email.trim()) return 'Email address is required.';
  if (!EMAIL_REGEX.test(email.trim())) return 'Please enter a valid email address.';
  return '';
};

export const validateNewPassword = (password) => {
  if (!password) return 'New password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must contain at least one letter and one number.';
  }
  return '';
};

export const validateResetPasswordForm = ({ newPassword, confirmPassword }) => {
  const errors = {
    newPassword: validateNewPassword(newPassword),
    confirmPassword: ''
  };
  if (!confirmPassword) {
    errors.confirmPassword = 'Please confirm your new password.';
  } else if (newPassword !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }
  return errors;
};
