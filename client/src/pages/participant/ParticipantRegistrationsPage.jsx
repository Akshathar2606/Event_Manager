import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { registrationService } from '../../services/registrationService';
import {
  isEventStarted,
  isRegistrationCancellable,
  getRegistrationStatusBadge,
  formatDisplayDate,
  formatDisplayTime
} from '../../utils/registrationUtils';
import { extractErrorMessage } from '../../services/authService';
import {
  Ticket,
  Calendar,
  Clock,
  MapPin,
  Compass,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  Info,
  Building2,
  User,
  Mail,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';

export default function ParticipantRegistrationsPage() {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Tab & Pagination
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'registered', 'cancelled'
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });

  // Modal States
  const [detailModalRegistration, setDetailModalRegistration] = useState(null);
  const [cancelModalRegistration, setCancelModalRegistration] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  // Fetch registrations
  const fetchRegistrations = useCallback(async (targetPage = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: targetPage,
        limit: 10
      };
      if (activeTab !== 'all') {
        params.status = activeTab;
      }

      const res = await registrationService.getMyRegistrations(params);
      setRegistrations(res.data || []);
      if (res.pagination) {
        setPagination(res.pagination);
      } else {
        setPagination({
          page: targetPage,
          limit: 10,
          total: res.count || (res.data ? res.data.length : 0),
          pages: Math.max(1, Math.ceil((res.count || 1) / 10))
        });
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to retrieve your event registrations.'));
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchRegistrations(1);
  }, [fetchRegistrations]);

  // Handle Tab Switch
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setActionSuccess(null);
  };

  // Open Cancel Dialog
  const handleOpenCancelDialog = (registration) => {
    setCancelModalRegistration(registration);
    setCancelReason('');
    setCancelError(null);
  };

  // Perform Cancellation
  const handleConfirmCancel = async () => {
    if (!cancelModalRegistration) return;
    setCancelling(true);
    setCancelError(null);

    try {
      const regId = cancelModalRegistration._id || cancelModalRegistration.id;
      const res = await registrationService.cancelRegistration(regId, cancelReason);

      setActionSuccess(`Successfully cancelled registration for "${cancelModalRegistration.event?.title || 'event'}". Seat released.`);
      setCancelModalRegistration(null);

      // Refresh the current page
      await fetchRegistrations(pagination.page);
    } catch (err) {
      setCancelError(extractErrorMessage(err, 'Failed to cancel registration. Please try again.'));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Ticket className="w-3.5 h-3.5" />
                Participant Portal
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              My Event Registrations
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage your confirmed admission passes, schedule details, and ticket status.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/participant/events"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors"
            >
              <Compass className="w-4 h-4" />
              <span>Browse Campus Events</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Global Success Banner */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-500 hover:text-emerald-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchRegistrations(pagination.page)}
            className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-semibold text-[11px]"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter and Tab Navigation Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto text-xs">
          {[
            { id: 'all', label: 'All Registrations' },
            { id: 'registered', label: 'Confirmed / Active' },
            { id: 'cancelled', label: 'Cancelled' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Registrations List */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-medium">Loading your admission tickets...</p>
        </div>
      ) : registrations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
            <Ticket className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {activeTab === 'all'
              ? 'No event registrations yet'
              : `No ${activeTab} registrations found`}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
            {activeTab === 'all'
              ? 'You have not registered for any campus events yet. Explore upcoming hackathons, conferences, and seminars to reserve your spot.'
              : `You have no tickets currently matching the "${activeTab}" status filter.`}
          </p>
          <Link
            to="/participant/events"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs"
          >
            <Compass className="w-4 h-4" />
            <span>Discover Events</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {registrations.map((reg) => {
            const regId = reg._id || reg.id;
            const event = reg.event || {};
            const venue = event.venue || {};
            const badge = getRegistrationStatusBadge(reg.status);
            const StatusIcon = badge.icon === CheckCircle2 ? CheckCircle2 : XCircle;

            const isCancelled = reg.status === 'cancelled';
            const eventStarted = isEventStarted(event.startDateTime);
            const cancellableCheck = isRegistrationCancellable(reg, event);

            return (
              <div
                key={regId}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 hover:border-indigo-300 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Info */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {event.category && (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                          {event.category}
                        </span>
                      )}

                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badge.classes}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        <span>{badge.label}</span>
                      </span>

                      <span className="text-[11px] text-slate-400">
                        Ref: <code className="font-mono text-slate-600">{String(regId).slice(-6).toUpperCase()}</code>
                      </span>
                    </div>

                    <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                      {event.title || 'Untitled Event'}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-xs text-slate-600 pt-1">
                      {/* Date & Time */}
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                        <div>
                          <div className="font-medium text-slate-800">{formatDisplayDate(event.startDateTime)}</div>
                          <div className="text-[11px] text-slate-400">
                            {formatDisplayTime(event.startDateTime)} – {formatDisplayTime(event.endDateTime)}
                          </div>
                        </div>
                      </div>

                      {/* Venue */}
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                        <div className="truncate">
                          <div className="font-medium text-slate-800 truncate">{venue.name || 'Campus Venue'}</div>
                          <div className="text-[11px] text-slate-400 truncate">{venue.location || 'Location TBA'}</div>
                        </div>
                      </div>

                      {/* Registration Date / Cancellation Detail */}
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                        <div>
                          {isCancelled ? (
                            <>
                              <div className="text-rose-700 font-medium">Cancelled on {formatDisplayDate(reg.cancelledAt)}</div>
                              {reg.cancellationReason && (
                                <div className="text-[11px] text-slate-400 truncate" title={reg.cancellationReason}>
                                  Reason: {reg.cancellationReason}
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <div className="text-slate-800 font-medium">Registered: {formatDisplayDate(reg.createdAt)}</div>
                              <div className="text-[11px] text-emerald-600 font-semibold">Seat Confirmed</div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    <button
                      onClick={() => setDetailModalRegistration(reg)}
                      className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-2xs transition-colors"
                    >
                      View Details
                    </button>

                    {!isCancelled && (
                      <button
                        type="button"
                        disabled={eventStarted}
                        onClick={() => handleOpenCancelDialog(reg)}
                        title={
                          eventStarted
                            ? 'Cannot cancel registration for an event that has already started'
                            : 'Cancel Ticket'
                        }
                        className={`px-3 py-2 rounded-xl text-xs font-semibold shadow-2xs transition-colors ${
                          eventStarted
                            ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed select-none'
                            : 'bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700'
                        }`}
                      >
                        {eventStarted ? 'Event Started' : 'Cancel Ticket'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pagination Controls */}
          {pagination.pages > 1 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex items-center justify-between text-xs text-slate-600">
              <div>
                Showing page <strong className="text-slate-800">{pagination.page}</strong> of{' '}
                <strong className="text-slate-800">{pagination.pages}</strong> ({pagination.total} registrations)
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={pagination.page <= 1 || loading}
                  onClick={() => fetchRegistrations(pagination.page - 1)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <button
                  disabled={pagination.page >= pagination.pages || loading}
                  onClick={() => fetchRegistrations(pagination.page + 1)}
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

      {/* REGISTRATION DETAIL MODAL */}
      {detailModalRegistration && (() => {
        const reg = detailModalRegistration;
        const regId = reg._id || reg.id;
        const event = reg.event || {};
        const venue = event.venue || {};
        const organizer = event.organizer || {};
        const badge = getRegistrationStatusBadge(reg.status);
        const StatusIcon = badge.icon === CheckCircle2 ? CheckCircle2 : XCircle;
        const eventStarted = isEventStarted(event.startDateTime);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badge.classes}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      <span>{badge.label}</span>
                    </span>
                    <span className="text-xs text-slate-400">
                      ID: <code className="font-mono text-slate-700">{regId}</code>
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">{event.title}</h2>
                </div>
                <button
                  onClick={() => setDetailModalRegistration(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4 text-xs text-slate-600 max-h-[70vh] overflow-y-auto">
                {/* Event Schedule */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    <span>Schedule</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Starts</span>
                      <span className="font-semibold text-slate-800">
                        {formatDisplayDate(event.startDateTime)} at {formatDisplayTime(event.startDateTime)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Ends</span>
                      <span className="font-semibold text-slate-800">
                        {formatDisplayDate(event.endDateTime)} at {formatDisplayTime(event.endDateTime)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Venue Details */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    <span>Venue</span>
                  </h4>
                  <div className="pt-1">
                    <div className="font-semibold text-slate-800">{venue.name || 'Campus Venue'}</div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{venue.location || 'Location TBA'}</span>
                    </div>
                  </div>
                </div>

                {/* Organizer Info */}
                {organizer.name && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                      <User className="w-4 h-4 text-indigo-600" />
                      <span>Organizer</span>
                    </h4>
                    <div className="pt-1 text-slate-800 font-medium">{organizer.name}</div>
                    {organizer.organization && (
                      <div className="text-[11px] text-slate-500">{organizer.organization}</div>
                    )}
                    {organizer.email && (
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        <span>{organizer.email}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Cancellation Details */}
                {reg.status === 'cancelled' && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <XCircle className="w-4 h-4 text-rose-600" />
                      <span>Cancellation Record</span>
                    </div>
                    <div className="text-[11px] text-rose-700">
                      Cancelled on: {formatDisplayDate(reg.cancelledAt)} at {formatDisplayTime(reg.cancelledAt)}
                    </div>
                    {reg.cancellationReason && (
                      <div className="text-[11px] text-rose-900 font-medium pt-1">
                        Reason: &quot;{reg.cancellationReason}&quot;
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setDetailModalRegistration(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-100"
                >
                  Close
                </button>

                {reg.status === 'registered' && (
                  <button
                    type="button"
                    disabled={eventStarted}
                    onClick={() => {
                      setDetailModalRegistration(null);
                      handleOpenCancelDialog(reg);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-2xs transition-colors ${
                      eventStarted
                        ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed select-none'
                        : 'bg-rose-600 hover:bg-rose-700 text-white'
                    }`}
                  >
                    {eventStarted ? 'Cannot Cancel (Started)' : 'Cancel Ticket'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* CANCELLATION CONFIRMATION DIALOG */}
      {cancelModalRegistration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">Cancel Registration</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to cancel your seat for{' '}
                  <strong className="text-slate-800">{cancelModalRegistration.event?.title || 'this event'}</strong>?
                </p>
              </div>
              <button
                onClick={() => setCancelModalRegistration(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content & Reason Field */}
            <div className="p-6 space-y-4">
              {cancelError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{cancelError}</span>
                </div>
              )}

              <p className="text-xs text-slate-600 leading-relaxed">
                Cancelling will release your reserved seat back to the event capacity. You can re-register later if seats remain open.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Cancellation Reason (Optional)
                </label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g., Schedule conflict, illness, or personal commitment..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={cancelling}
                onClick={() => setCancelModalRegistration(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-2xs"
              >
                Keep Reservation
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={handleConfirmCancel}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-xs disabled:opacity-50"
              >
                {cancelling ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Confirm Cancellation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
