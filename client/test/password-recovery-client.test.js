import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateNewPassword,
  validateRecoveryEmail,
  validateResetPasswordForm
} from '../src/utils/passwordRecovery.js';

describe('Password recovery form validation', () => {
  test('validates and normalizes email input consistently with auth rules', () => {
    assert.equal(validateRecoveryEmail(''), 'Email address is required.');
    assert.equal(validateRecoveryEmail('not-an-email'), 'Please enter a valid email address.');
    assert.equal(validateRecoveryEmail(' Person@example.com '), '');
  });

  test('enforces backend password length, letter, and number rules', () => {
    assert.equal(validateNewPassword('short1'), 'Password must be at least 8 characters long.');
    assert.equal(
      validateNewPassword('PasswordOnly'),
      'Password must contain at least one letter and one number.'
    );
    assert.equal(validateNewPassword('Password1'), '');
  });

  test('rejects missing and mismatched password confirmations', () => {
    assert.equal(
      validateResetPasswordForm({ newPassword: 'Password1', confirmPassword: '' }).confirmPassword,
      'Please confirm your new password.'
    );
    assert.equal(
      validateResetPasswordForm({ newPassword: 'Password1', confirmPassword: 'Password2' }).confirmPassword,
      'Passwords do not match.'
    );
    assert.equal(
      validateResetPasswordForm({ newPassword: 'Password1', confirmPassword: 'Password1' }).confirmPassword,
      ''
    );
  });
});
