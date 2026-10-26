import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { bookingService, BOOKING_STATUS, extractErrorMessage } from '../../services/bookingService';
import { formatDisplayDate, isBookingCancellable } from '../../utils/bookingUtils';
import {
  CalendarCheck,
  Building2,
  Calendar,
  Clock,
  MapPin,
  Users,
  DollarSign,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Ban,
  Loader2,
  RefreshCw,
  Search,
  X,
  ArrowRight,
  Info
} from 'lucide-react';

const getStatusBadge = (status) => {
  switch (status) {
    case 'approved':
      return {
        label: 'Approved',
        classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: CheckCircle2
      };
    case 'rejected':
      return {
        label: 'Rejected',
        classes: 'bg-rose-50 text-rose-700 border-rose-200',
        icon: XCircle
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        classes: 'bg-slate-100 text-slate-600 border-slate-200',
        icon: Ban
      };
    case 'pending':
    default:
      return {
        label: 'Pending Approval',
        classes: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: Clock
      };
  }
};

export default function OrganizerBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filters
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'pending' | 'approved' | 'rejected' | 'cancelled'
  const [searchTerm, setSearchTerm] = useState('');

  // Cancellation Modal State
  const [cancellationTarget, setCancellationTarget] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  // Fetch organizer's bookings
  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { limit: 100 };
      if (activeTab !== 'all') {
        params.status = activeTab;
      }
      const res = await bookingService.getBookings(params);
      setBookings(res.data || []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load your venue bookings.'));
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Handle Cancellation
  const handleConfirmCancel = async () => {
    if (!cancellationTarget) return;
    setCancelLoading(true);
    setCancelError(null);

    try {
      const id = cancellationTarget.id || cancellationTarget._id;
      await bookingService.cancelBooking(id);

      const isPublished =
        cancellationTarget.status === 'approved' &&
        cancellationTarget.event?.status === 'published';

      setCancellationTarget(null);
      setSuccessMessage(
        isPublished
          ? 'Venue booking cancelled. Associated event has reverted to Draft status.'
          : 'Venue booking cancelled successfully.'
      );
      setTimeout(() => setSuccessMessage(null), 6000);
      fetchBookings();
    } catch (err) {
      setCancelError(extractErrorMessage(err, 'Failed to cancel venue booking.'));
    } finally {
      setCancelLoading(false);
    }
  };

  // Filter bookings by search term on client-side
  const filteredBookings = bookings.filter((b) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const eventTitle = b.event?.title || '';
    const venueName = b.venue?.name || '';
    const venueLoc = b.venue?.location || '';
    const purpose = b.purpose || '';
    return (
      eventTitle.toLowerCase().includes(term) ||
      venueName.toLowerCase().includes(term) ||
      venueLoc.toLowerCase().includes(term) ||
      purpose.toLowerCase().includes(term)
    );
  });

  // Calculate counts for tab badges
  const counts = {
    all: bookings.length,
    pending: bookings.filter((b) => b.status === 'pending').length,
    approved: bookings.filter((b) => b.status === 'approved').length,
    rejected: bookings.filter((b) => b.status === 'rejected').length,
    cancelled: bookings.filter((b) => b.status === 'cancelled').length
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <CalendarCheck className="w-3.5 h-3.5" />
                Venue Bookings
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              My Booking Requests
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Track the approval status of your venue reservation requests and manage event schedules
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={fetchBookings}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
              title="Refresh bookings"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <Link
              to="/organizer/venues"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-colors"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Browse Venues</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Success Notification Alert */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-500 hover:text-emerald-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchBookings}
            className="text-xs font-bold underline text-rose-700 hover:text-rose-900 ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: 'All Requests' },
              { id: 'pending', label: 'Pending' },
              { id: 'approved', label: 'Approved' },
              { id: 'rejected', label: 'Rejected' },
              { id: 'cancelled', label: 'Cancelled' }
            ].map((tab) => {
              const active = activeTab === tab.id;
              const count = counts[tab.id];
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    active
                      ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-200'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span>{tab.label}</span>
                  {count !== undefined && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        active ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-200/70 text-slate-700'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative sm:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by event or venue..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Bookings List */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-medium">Loading your booking requests...</p>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <CalendarCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No booking requests found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            {searchTerm || activeTab !== 'all'
              ? 'No requests match your current filters. Try switching tabs or clearing your search.'
              : 'You have not submitted any venue booking requests yet. Browse campus facilities to submit a reservation request.'}
          </p>
          <Link
            to="/organizer/venues"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-xs"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Discover Campus Venues</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => {
            const id = booking.id || booking._id;
            const badge = getStatusBadge(booking.status);
            const StatusIcon = badge.icon;
            const event = booking.event || {};
            const venue = booking.venue || {};
            const canCancel = booking.status === 'pending' || booking.status === 'approved';

            return (
              <div
                key={id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 hover:border-indigo-200 transition-colors space-y-4"
              >
                {/* Header: Event Title & Status Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                        {event.category || 'Event'}
                      </span>
                      <h3 className="font-extrabold text-slate-900 text-base">
                        {event.title || 'Untitled Event'}
                      </h3>
                      {event.status && (
                        <span className="text-[10px] font-medium text-slate-400 capitalize">
                          ({event.status})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.classes}`}
                    >
                      <StatusIcon className="w-3.5 h-3.5" />
                      <span>{badge.label}</span>
                    </span>

                    <span className="text-[11px] text-slate-400 hidden sm:inline">
                      Requested {formatDisplayDate(booking.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
                  {/* Venue Specs */}
                  <div className="space-y-1.5 p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Venue Details
                    </span>
                    <div className="font-semibold text-slate-900 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{venue.name || 'Unnamed Venue'}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>{venue.location || 'Campus Location'}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span>{venue.capacity ? `${venue.capacity} seats` : '—'}</span>
                      <span>{venue.hourlyRate > 0 ? `$${venue.hourlyRate}/hr` : 'No charge'}</span>
                    </div>
                  </div>

                  {/* Booking Window */}
                  <div className="space-y-1.5 p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Booking Window
                    </span>
                    <div className="font-semibold text-slate-900 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{formatDisplayDate(booking.startDateTime)}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Until: <strong>{formatDisplayDate(booking.endDateTime)}</strong>
                    </div>
                    {event.startDateTime && (
                      <div className="text-[10px] text-slate-400 pt-1">
                        Event schedule: {formatDisplayDate(event.startDateTime)}
                      </div>
                    )}
                  </div>

                  {/* Purpose & Notes */}
                  <div className="space-y-1.5 p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Reservation Purpose
                    </span>
                    <p className="text-slate-800 font-medium line-clamp-2">
                      {booking.purpose || 'No purpose specified'}
                    </p>
                    {booking.notes && (
                      <p className="text-slate-500 text-[11px] line-clamp-1 italic">
                        Notes: {booking.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Status-Specific Feedback Callouts */}
                {booking.status === 'rejected' && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Rejection Reason from Administration:</span>
                    </div>
                    <p className="text-rose-900 bg-white/70 p-2.5 rounded-lg border border-rose-100 font-medium">
                      {booking.rejectionReason || 'No specific rejection reason provided.'}
                    </p>
                    {booking.reviewedBy && (
                      <div className="text-[10px] text-rose-600">
                        Reviewed by {booking.reviewedBy.name || 'Campus Administrator'} on{' '}
                        {formatDisplayDate(booking.reviewedAt)}
                      </div>
                    )}
                  </div>
                )}

                {booking.status === 'approved' && (
                  <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Reservation confirmed! Your event now has an approved venue and can be safely published.
                      </span>
                    </div>
                    {booking.reviewedBy && (
                      <span className="text-[10px] text-emerald-700 hidden sm:inline">
                        Approved by {booking.reviewedBy.name || 'Admin'}
                      </span>
                    )}
                  </div>
                )}

                {booking.status === 'pending' && (
                  <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>
                      Awaiting administrative review. The venue is not yet reserved until approved.
                    </span>
                  </div>
                )}

                {/* Actions Footer */}
                {canCancel && (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setCancellationTarget(booking)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Cancel Booking</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      {cancellationTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 animate-fadeIn space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Cancel Venue Booking?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  This action will release your reservation for{' '}
                  <strong>{cancellationTarget.venue?.name}</strong>.
                </p>
              </div>
            </div>

            {/* Warning if approved & event is published */}
            {cancellationTarget.status === 'approved' &&
              cancellationTarget.event?.status === 'published' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-900">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Important: Published Event Impact</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Event <strong>&quot;{cancellationTarget.event?.title}&quot;</strong> is currently published. Cancelling this approved booking will automatically revert the event to <strong>Draft</strong> status until a new venue booking is approved.
                  </p>
                </div>
              )}

            {cancelError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{cancelError}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setCancellationTarget(null)}
                disabled={cancelLoading}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
              >
                Keep Booking
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancelLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                {cancelLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <>
                    <Ban className="w-3.5 h-3.5" />
                    <span>Yes, Cancel Booking</span>
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
