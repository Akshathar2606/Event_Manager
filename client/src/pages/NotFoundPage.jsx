import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { HelpCircle, Home } from 'lucide-react';

export default function NotFoundPage() {
  const { isAuthenticated, getHomePath } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center py-12 px-4 text-center">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center mx-auto mb-4">
          <HelpCircle className="w-7 h-7" />
        </div>

        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 mb-2">
          404 Not Found
        </span>

        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Page Not Found</h1>

        <p className="mt-3 text-sm text-slate-500 leading-relaxed">
          The page or resource you are looking for does not exist or has been relocated.
        </p>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => navigate(isAuthenticated ? getHomePath() : '/login', { replace: true })}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-xs"
          >
            <Home className="w-4 h-4" />
            <span>Return to {isAuthenticated ? 'Dashboard' : 'Sign In'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
