import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';

export default function UnauthorizedPage() {
  const { user, getHomePath } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const attemptedPath = location.state?.attemptedPath || 'the requested resource';

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 text-center">
      <div className="max-w-md w-full bg-surface p-8 rounded-2xl border border-border shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 mb-2">
          403 Forbidden
        </span>

        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Access Restricted</h1>

        <p className="mt-3 text-sm text-text-muted leading-relaxed">
          Your current account role (
          <span className="font-semibold text-text-primary capitalize">{user?.role || 'user'}</span>
          ) does not have authorization to access{' '}
          <code className="px-1.5 py-0.5 rounded-md bg-surface-subtle text-xs text-text-secondary font-mono">
            {attemptedPath}
          </code>
          .
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-text-secondary bg-surface-subtle hover:bg-surface-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>

          <button
            type="button"
            onClick={() => navigate(getHomePath(), { replace: true })}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-xs"
          >
            <Home className="w-4 h-4" />
            <span>Go to My Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
}
