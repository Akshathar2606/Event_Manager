import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { registrationService } from '../../services/registrationService';
import { eventService } from '../../services/eventService';
import {
  getRegistrationStatusBadge,
  formatDisplayDate,
  formatDisplayTime
} from '../../utils/registrationUtils';
import { extractErrorMessage } from '../../services/authService';
import {
  Users,
  Calendar,
  Clock,
  MapPin,
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Filter,
  Ticket,
  UserCheck,
  UserX
} from 'lucide-react';

export default function OrganizerEventAttendeesPage() {
  const { id: eventId } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [summary, setSummary] = useState({ totalAll: 0, activeCount: 0, cancelledCount: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });

  const [loading, setLoading] = useState(true);
  const [eventLoading, setEventLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isForbidden, setIsForbidden] = useState(false);

  // Status Filter: 'all', 'registered', 'cancelled'
  const [statusFilter, setStatusFilter] = useState('all');

  // Load Event Metadata
  const fetchEventDetails = useCallback(async () => {
    setEventLoading(true);
    try {
      const res = await eventService.getEventById(eventId);
      setEvent(res.data);
    } catch (err) {
      console.warn('Could not load event metadata:', err);
    } finally {
      setEventLoading(false);
    }
  }, [eventId]);

  // Load Attendee Roster
  const fetchAttendees = useCallback(async (targetPage = 1) => {
    setLoading(true);
    setError(null);
    setIsForbidden(false);

    try {
      const params = {
        page: targetPage,
        limit: 15
      };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      const res = await registrationService.getEventAttendees(eventId, params);
      setAttendees(res.data || []);
      if (res.summary) {
        setSummary(res.summary);
      }
      if (res.pagination) {
        setPagination(res.pagination);
      } else {
        setPagination({
          page: targetPage,
          limit: 15,
          total: res.count || (res.data ? res.data.length : 0),
          pages: Math.max(1, Math.ceil((res.count || 1) / 15))
        });
      }
    } catch (err) {
      const status = err.response?.status;
      if (status === 403) {
        setIsForbidden(true);
        setError('Access Denied: You can only view attendee rosters for events you organized.');
      } else {
        setError(extractErrorMessage(err, 'Failed to retrieve attendee roster for this event.'));
      }
    } finally {
      setLoading(false);
    }
  }, [eventId, statusFilter]);

  useEffect(() => {
    fetchEventDetails();
  }, [fetchEventDetails]);

  useEffect(() => {
    fetchAttendees(1);
  }, [fetchAttendees]);

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link
          to="/organizer/events"
          className="inline-flex items-center gap-1 font-medium hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to My Events</span>
        </Link>
        <span>/</span>
        <span className="text-slate-800 font-semibold truncate max-w-xs">
          {event?.title || 'Event Roster'}
        </span>
      </div>

      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Users className="w-3.5 h-3.5" />
                Attendee Roster
              </span>
              {event?.category && (
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                  {event.category}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {event?.title || 'Attendee Management'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Real-time headcount, attendee contact information, and admission status.
            </p>
          </div>

          {event && (
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-xs text-slate-600 shrink-0 space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-slate-800">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>{formatDisplayDate(event.startDateTime)}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                {formatDisplayTime(event.startDateTime)} – {formatDisplayTime(event.endDateTime)}
              </div>
              <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 flex items-center justify-between gap-4">
                <span>Capacity:</span>
                <strong className="text-slate-800">{event.capacity} seats</strong>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 403 Forbidden State */}
      {isForbidden ? (
        <div className="bg-white rounded-2xl border border-rose-200 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Restricted Access</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
            You do not have permission to view the attendee list for this event. Attendee records are strictly accessible only to the event organizer who created it or campus administrators.
          </p>
          <Link
            to="/organizer/events"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Your Events</span>
          </Link>
        </div>
      ) : (
        <>
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Active / Confirmed */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Confirmed Attendees</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-slate-900">{summary.activeCount}</span>
                {event?.capacity && (
                  <span className="text-xs text-slate-400">
                    of {event.capacity} capacity ({Math.round(((summary.activeCount || 0) / event.capacity) * 100)}%)
                  </span>
                )}
              </div>
              <div className="mt-1 text-[11px] text-emerald-700 font-medium">
                Active admission passes
              </div>
            </div>

            {/* Cancelled */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Cancelled Registrations</span>
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                  <UserX className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-extrabold text-slate-900">{summary.cancelledCount}</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                Seats returned to pool
              </div>
            </div>

            {/* Total Historical */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Total All-Time Records</span>
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Ticket className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-extrabold text-slate-900">{summary.totalAll}</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                Total enrollments recorded
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center gap-2 overflow-x-auto text-xs">
              {[
                { id: 'all', label: `All (${summary.totalAll})` },
                { id: 'registered', label: `Confirmed (${summary.activeCount})` },
                { id: 'cancelled', label: `Cancelled (${summary.cancelledCount})` }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 ${
                    statusFilter === tab.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Global Error Banner */}
          {error && !isForbidden && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={() => fetchAttendees(pagination.page)}
                className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-semibold text-[11px]"
              >
                Retry
              </button>
            </div>
          )}

          {/* Attendee Roster Table */}
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-500 font-medium">Loading attendee roster...</p>
            </div>
          ) : attendees.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {statusFilter === 'all'
                  ? 'No attendees registered yet'
                  : `No ${statusFilter} attendees`}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {statusFilter === 'all'
                  ? 'Participants who register through the campus portal will appear on this roster in real time.'
                  : `There are currently no attendees matching the "${statusFilter}" status filter.`}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Participant</th>
                      <th className="py-3 px-4">Contact</th>
                      <th className="py-3 px-4">Organization / Dept</th>
                      <th className="py-3 px-4">Registered Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Ticket Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {attendees.map((reg) => {
                      const participant = reg.participant || {};
                      const badge = getRegistrationStatusBadge(reg.status);
                      const StatusIcon = badge.icon === CheckCircle2 ? CheckCircle2 : XCircle;
                      const regId = reg._id || reg.id;

                      return (
                        <tr key={regId} className="hover:bg-slate-50/60 transition-colors">
                          {/* Participant Name */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{participant.name || 'Anonymous Attendee'}</div>
                            <div className="text-[10px] text-slate-400 capitalize">{participant.role || 'Participant'}</div>
                          </td>

                          {/* Contact */}
                          <td className="py-3.5 px-4 space-y-0.5">
                            <div className="flex items-center gap-1.5 text-slate-700">
                              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                              <a href={`mailto:${participant.email}`} className="hover:underline">
                                {participant.email || '—'}
                              </a>
                            </div>
                            {participant.phone && (
                              <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                                <Phone className="w-3 h-3 shrink-0" />
                                <span>{participant.phone}</span>
                              </div>
                            )}
                          </td>

                          {/* Organization */}
                          <td className="py-3.5 px-4">
                            <span className="text-slate-600">
                              {participant.organization || '—'}
                            </span>
                          </td>

                          {/* Registered Date */}
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-slate-800">{formatDisplayDate(reg.createdAt)}</div>
                            <div className="text-[10px] text-slate-400">{formatDisplayTime(reg.createdAt)}</div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${badge.classes}`}
                            >
                              <StatusIcon className="w-3 h-3" />
                              <span>{badge.label}</span>
                            </span>
                            {reg.status === 'cancelled' && reg.cancellationReason && (
                              <div
                                className="text-[10px] text-rose-700 mt-0.5 max-w-xs truncate"
                                title={reg.cancellationReason}
                              >
                                &quot;{reg.cancellationReason}&quot;
                              </div>
                            )}
                          </td>

                          {/* Reference */}
                          <td className="py-3.5 px-4">
                            <code className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">
                              {String(regId).slice(-6).toUpperCase()}
                            </code>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {pagination.pages > 1 && (
                <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <div>
                    Page <strong className="text-slate-800">{pagination.page}</strong> of{' '}
                    <strong className="text-slate-800">{pagination.pages}</strong> ({pagination.total} attendees)
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={pagination.page <= 1 || loading}
                      onClick={() => fetchAttendees(pagination.page - 1)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Previous</span>
                    </button>
                    <button
                      disabled={pagination.page >= pagination.pages || loading}
                      onClick={() => fetchAttendees(pagination.page + 1)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
