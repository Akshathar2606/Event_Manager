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
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 text-center">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 mb-2">
          403 Forbidden
        </span>

        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Access Restricted</h1>

        <p className="mt-3 text-sm text-slate-500 leading-relaxed">
          Your current account role (
          <span className="font-semibold text-slate-800 capitalize">{user?.role || 'user'}</span>
          ) does not have authorization to access{' '}
          <code className="px-1.5 py-0.5 rounded-md bg-slate-100 text-xs text-slate-700 font-mono">
            {attemptedPath}
          </code>
          .
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
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
