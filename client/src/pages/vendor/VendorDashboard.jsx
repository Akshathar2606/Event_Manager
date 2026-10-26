import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { UtensilsCrossed, ClipboardList, Store, CheckCircle } from 'lucide-react';

export default function VendorDashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <UtensilsCrossed className="w-3.5 h-3.5" />
                Catering Vendor Portal
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Welcome, {user?.name || 'Vendor'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage food packages, configure per-person pricing, and accept or reject event catering requests
            </p>
          </div>

          <div className="text-xs text-slate-400 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 shrink-0">
            <div>Account: <span className="font-semibold text-slate-700">{user?.email}</span></div>
            <div>Status: <span className="font-semibold text-amber-600">Registered Vendor</span></div>
          </div>
        </div>
      </div>

      {/* Vendor Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-base mb-1">Food Packages & Menus</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Create buffet and plated menu options with prices per attendee and dietary classifications.
          </p>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-amber-600 font-medium">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Scheduled for Day 5 Implementation</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
            <ClipboardList className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-base mb-1">Catering Requests Queue</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Review event headcount, dates, and package selections. Accept or decline booking contracts.
          </p>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-indigo-600 font-medium">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Scheduled for Day 6 Implementation</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
            <Store className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-base mb-1">Vendor Profile</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Showcase business certification, kitchen facilities, and service capacity to campus organizers.
          </p>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-emerald-600 font-medium">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Role Guard Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}
