import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Compass, Ticket, Utensils, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function ParticipantDashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Compass className="w-3.5 h-3.5" />
                Participant Portal
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Welcome, {user?.name || 'Participant'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Browse upcoming published campus events, view schedules & catering menus, and reserve tickets.
            </p>
          </div>

          <div className="text-xs text-slate-400 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 shrink-0">
            <div>Account: <span className="font-semibold text-slate-700">{user?.email}</span></div>
            <div>Status: <span className="font-semibold text-emerald-600">Active Attendee</span></div>
          </div>
        </div>
      </div>

      {/* Participant Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Discover Events Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between hover:border-emerald-300 transition-colors">
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <Compass className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Discover Events</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Search and filter by category (Academic, Cultural, Sports, Technical, Workshop), date, and venue.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100">
            <Link
              to="/participant/events"
              className="inline-flex items-center justify-between w-full text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              <span>Explore Campus Directory</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>

        {/* Event Registration Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between hover:border-indigo-300 transition-colors">
          <div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <Ticket className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Event Registrations</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              View your confirmed registration tickets and check-in QR codes.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100">
            <Link
              to="/participant/registrations"
              className="inline-flex items-center justify-between w-full text-xs font-semibold text-indigo-700 hover:text-indigo-800"
            >
              <span>Manage My Tickets</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>

        {/* Catering & Menus Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between hover:border-amber-300 transition-colors">
          <div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
              <Utensils className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Catering & Menus</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Check buffet selections, lunch boxes, and dietary options provided at enrolled events.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
              Integrated with Event Details
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
