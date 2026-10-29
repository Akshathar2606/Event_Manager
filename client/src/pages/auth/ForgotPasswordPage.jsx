import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Mail } from 'lucide-react';
import { authService, extractErrorMessage } from '../../services/authService';
import { validateRecoveryEmail } from '../../utils/passwordRecovery';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [requestError, setRequestError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validateRecoveryEmail(email);
    setEmailError(validationError);
    setRequestError('');
    if (validationError) return;

    setLoading(true);
    try {
      await authService.requestPasswordReset({ email: email.trim() });
      setSubmitted(true);
    } catch (error) {
      setRequestError(
        extractErrorMessage(error, 'Password recovery is temporarily unavailable. Please try again later.')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm shadow-indigo-200">
            EF
          </div>
          <span className="font-extrabold text-2xl text-slate-900 tracking-tight">EventFlow</span>
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Forgot your password?</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter your email and we&apos;ll help you get back into your account.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-2xl border border-slate-200 shadow-sm">
          {submitted ? (
            <div className="text-center" role="status">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-slate-900">Check your email</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                If an active account matches that email address, recovery instructions may be sent to its
                registered address. For security, we don&apos;t disclose account status.
              </p>
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
                <div>
                  <label
                    htmlFor="recovery-email"
                    className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute inset-y-0 left-0 ml-3 my-auto w-4 h-4 text-slate-400" />
                    <input
                      id="recovery-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setEmailError('');
                        setRequestError('');
                      }}
                      placeholder="you@institution.edu"
                      className={`block w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border bg-white text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-hidden focus:ring-2 ${
                        emailError
                          ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
                          : 'border-slate-200 focus:border-indigo-600 focus:ring-indigo-100'
                      }`}
                      aria-invalid={Boolean(emailError)}
                      aria-describedby={emailError ? 'recovery-email-error' : undefined}
                    />
                  </div>
                  {emailError && (
                    <p id="recovery-email-error" className="mt-1.5 text-xs text-rose-600 font-medium">
                      {emailError}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending request...
                    </>
                  ) : (
                    'Send recovery instructions'
                  )}
                </button>
              </form>
            </>
          )}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
