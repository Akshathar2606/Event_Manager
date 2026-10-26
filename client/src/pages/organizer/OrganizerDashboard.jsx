import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Calendar, Building2, UtensilsCrossed, Clock, CheckCircle } from 'lucide-react';

export default function OrganizerDashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Calendar className="w-3.5 h-3.5" />
                Event Organizer Hub
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Welcome, {user?.name || 'Organizer'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Create events, request available venues, discover catering, and coordinate schedules
            </p>
          </div>

          <div className="text-xs text-slate-400 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 shrink-0">
            <div>Account: <span className="font-semibold text-slate-700">{user?.email}</span></div>
            <div>Dept/Club: <span className="font-semibold text-indigo-600">{user?.organization || 'General'}</span></div>
          </div>
        </div>
      </div>

      {/* Organizer Workflow Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
            <Building2 className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-base mb-1">Venue Booking</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Query campus venue availability by date and timeslot. Submit booking requests to campus administrators.
          </p>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-indigo-600 font-medium">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Scheduled for Day 6 Workflow</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-base mb-1">Catering Services</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Browse catering vendor packages, view food menus, and contract services directly for your event.
          </p>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-amber-600 font-medium">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Scheduled for Day 6 Workflow</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
            <Calendar className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-base mb-1">Event Publishing</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Assemble event agenda, connect approved venue & food packages, and publish to the participant directory.
          </p>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-emerald-600 font-medium">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Scheduled for Day 7-8 Workflow</span>
          </div>
        </div>
      </div>
    </div>
  );
}
