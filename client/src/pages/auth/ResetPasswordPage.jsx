import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authService, extractErrorMessage } from '../../services/authService';
import { validateResetPasswordForm } from '../../utils/passwordRecovery';

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [token] = useState(() => new URLSearchParams(location.search).get('token') || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [requestError, setRequestError] = useState('');
  const [tokenState, setTokenState] = useState(token ? 'ready' : 'invalid');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(location.search).has('token')) {
      navigate(location.pathname, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const errors = validateResetPasswordForm({ newPassword, confirmPassword });
    setFieldErrors(errors);
    setRequestError('');
    if (Object.values(errors).some(Boolean)) return;

    setLoading(true);
    try {
      await authService.resetPassword({ token, newPassword });
      logout();
      setTokenState('success');
    } catch (error) {
      const code = error?.response?.data?.code;
      if (code === 'RESET_TOKEN_EXPIRED') {
        setTokenState('expired');
      } else if (code === 'RESET_TOKEN_INVALID') {
        setTokenState('invalid');
      } else {
        setRequestError(
          extractErrorMessage(error, 'Password reset is temporarily unavailable. Please try again later.')
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const tokenMessage = {
    expired: 'This password reset link has expired. Request a new link to continue.',
    invalid: 'This password reset link is invalid or has already been used.'
  }[tokenState];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm shadow-indigo-200">
            EF
          </div>
          <span className="font-extrabold text-2xl text-slate-900 tracking-tight">EventFlow</span>
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reset your password</h1>
        <p className="mt-1 text-sm text-slate-500">Choose a new password for your EventFlow account.</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-2xl border border-slate-200 shadow-sm">
          {tokenState === 'success' ? (
            <div className="text-center" role="status">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-slate-900">Password updated</h2>
              <p className="mt-2 text-sm text-slate-600">
                Your password has been changed. Sign in with your new password.
              </p>
              <Link
                to="/login"
                className="mt-6 inline-flex items-center justify-center w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Back to sign in
              </Link>
            </div>
          ) : tokenMessage ? (
            <div className="text-center" role="alert">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-slate-900">
                {tokenState === 'expired' ? 'Link expired' : 'Link unavailable'}
              </h2>
              <p className="mt-2 text-sm text-slate-600">{tokenMessage}</p>
              <Link
                to="/forgot-password"
                className="mt-6 inline-flex items-center justify-center w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Request another reset link
              </Link>
            </div>
          ) : (
            <>
              {requestError && (
                <div
                  className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3 text-sm"
                  role="alert"
                >
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium">{requestError}</div>
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                {[
                  {
                    id: 'new-password',
                    name: 'newPassword',
                    label: 'New Password',
                    value: newPassword,
                    setValue: setNewPassword,
                    visible: showNewPassword,
                    toggle: () => setShowNewPassword((value) => !value),
                    error: fieldErrors.newPassword,
                    autoComplete: 'new-password'
                  },
                  {
                    id: 'confirm-password',
                    name: 'confirmPassword',
                    label: 'Confirm New Password',
                    value: confirmPassword,
                    setValue: setConfirmPassword,
                    visible: showConfirmPassword,
                    toggle: () => setShowConfirmPassword((value) => !value),
                    error: fieldErrors.confirmPassword,
                    autoComplete: 'new-password'
                  }
                ].map((field) => (
                  <div key={field.id}>
                    <label
                      htmlFor={field.id}
                      className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                    >
                      {field.label}
                    </label>
                    <div className="relative">
                      <Lock className="absolute inset-y-0 left-0 ml-3 my-auto w-4 h-4 text-slate-400" />
                      <input
                        id={field.id}
                        name={field.name}
                        type={field.visible ? 'text' : 'password'}
                        autoComplete={field.autoComplete}
                        value={field.value}
                        onChange={(event) => {
                          field.setValue(event.target.value);
                          setFieldErrors((previous) => ({ ...previous, [field.name]: '' }));
                          setRequestError('');
                        }}
                        className={`block w-full pl-9 pr-10 py-2.5 text-sm rounded-xl border bg-white text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-hidden focus:ring-2 ${
                          field.error
                            ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
                            : 'border-slate-200 focus:border-indigo-600 focus:ring-indigo-100'
                        }`}
                        aria-invalid={Boolean(field.error)}
                        aria-describedby={field.error ? `${field.id}-error` : undefined}
                      />
                      <button
                        type="button"
                        onClick={field.toggle}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                        aria-label={field.visible ? `Hide ${field.label.toLowerCase()}` : `Show ${field.label.toLowerCase()}`}
                      >
                        {field.visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {field.error && (
                      <p id={`${field.id}-error`} className="mt-1.5 text-xs text-rose-600 font-medium">
                        {field.error}
                      </p>
                    )}
                  </div>
                ))}
                <p className="text-xs text-slate-500">
                  Use at least 8 characters, including at least one letter and one number.
                </p>
                <button
                  type="submit"
                  disabled={loading || !token}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating password...
                    </>
                  ) : (
                    'Update password'
                  )}
                </button>
              </form>
            </>
          )}
          {tokenState !== 'success' && (
            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
