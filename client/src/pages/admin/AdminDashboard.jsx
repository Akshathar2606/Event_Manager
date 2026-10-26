import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Shield, Building2, CalendarCheck, Users, CheckCircle, ArrowRight } from 'lucide-react';

export default function AdminDashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                <Shield className="w-3.5 h-3.5" />
                Administrator Portal
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Welcome, {user?.name || 'Administrator'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Campus venue governance, booking requests queue, and resource directory
            </p>
          </div>

          <div className="text-xs text-slate-400 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 shrink-0">
            <div>Account: <span className="font-semibold text-slate-700">{user?.email}</span></div>
            <div>Role: <span className="font-semibold text-rose-600 capitalize">{user?.role}</span></div>
          </div>
        </div>
      </div>

      {/* Admin Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
            <Building2 className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-base mb-1">Campus Venues</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Manage shared auditoriums, seminar halls, labs, and sports arenas. Set capacity and facilities.
          </p>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-indigo-600 font-medium">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Scheduled for Day 4 Implementation</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Venue Booking Requests</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Review incoming requests from event organizers with atomic double-booking prevention.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Review Queue Active</span>
            </div>
            <Link
              to="/admin/bookings"
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1 transition-colors"
            >
              <span>Manage</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-base mb-1">User Directory</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Supervise platform accounts, assign vendor privileges, and review system access logs.
          </p>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-amber-600 font-medium">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Role Guard Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}
