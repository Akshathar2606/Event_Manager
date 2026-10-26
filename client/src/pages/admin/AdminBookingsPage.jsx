import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { bookingService, BOOKING_STATUS, extractErrorMessage } from '../../services/bookingService';
import {
  formatDisplayDate,
  detectBookingConflicts,
  validateRejectionReason
} from '../../utils/bookingUtils';
import {
  CalendarCheck,
  Building2,
  Calendar,
  Clock,
  MapPin,
  Users,
  Mail,
  Phone,
  Shield,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Ban,
  Loader2,
  RefreshCw,
  Search,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
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
        label: 'Pending Review',
        classes: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: Clock
      };
  }
};

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Global Status Counts across the complete database queue
  const [statusCounts, setStatusCounts] = useState({
    all: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0
  });

  // Approved bookings cache for accurate advisory conflict detection across paginated views
  const [approvedCache, setApprovedCache] = useState([]);

  // Filters & Search
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'pending' | 'approved' | 'rejected' | 'cancelled'
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(10);

  // Action Loading Tracker (stores ID of booking currently processing approval or rejection)
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Rejection Dialog State
  const [rejectionTarget, setRejectionTarget] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionError, setRejectionError] = useState(null);
  const [rejectionSubmitting, setRejectionSubmitting] = useState(false);

  // Fetch true database totals for all status categories
  const fetchStatusCounts = useCallback(async () => {
    try {
      const [allRes, pendingRes, approvedRes, rejectedRes, cancelledRes] = await Promise.all([
        bookingService.getBookings({ limit: 1 }),
        bookingService.getBookings({ status: 'pending', limit: 1 }),
        bookingService.getBookings({ status: 'approved', limit: 100 }), // Also populates conflict cache
        bookingService.getBookings({ status: 'rejected', limit: 1 }),
        bookingService.getBookings({ status: 'cancelled', limit: 1 })
      ]);

      setStatusCounts({
        all: allRes.pagination?.total ?? allRes.count ?? 0,
        pending: pendingRes.pagination?.total ?? pendingRes.count ?? 0,
        approved: approvedRes.pagination?.total ?? approvedRes.count ?? 0,
        rejected: rejectedRes.pagination?.total ?? rejectedRes.count ?? 0,
        cancelled: cancelledRes.pagination?.total ?? cancelledRes.count ?? 0
      });

      // Cache active approved bookings to power advisory conflict warnings
      if (approvedRes.data && Array.isArray(approvedRes.data)) {
        setApprovedCache(approvedRes.data);
      }
    } catch {
      // Non-blocking: background count refresh failure does not block viewing the queue
    }
  }, []);

  // Fetch paginated bookings for administrator review
  const fetchBookings = useCallback(
    async (page = 1, limit = pageSize, status = activeTab) => {
      setLoading(true);
      setError(null);
      try {
        const params = { page, limit };
        if (status !== 'all') {
          params.status = status;
        }

        const res = await bookingService.getBookings(params);
        setBookings(res.data || []);
        setPagination(
          res.pagination || {
            total: res.data?.length || 0,
            page,
            pages: 1,
            limit
          }
        );
      } catch (err) {
        setError(extractErrorMessage(err, 'Failed to load venue booking requests.'));
      } finally {
        setLoading(false);
      }
    },
    [activeTab, pageSize]
  );

  // Initial load and whenever activeTab or pageSize changes
  useEffect(() => {
    fetchBookings(1, pageSize, activeTab);
    fetchStatusCounts();
  }, [fetchBookings, fetchStatusCounts, activeTab, pageSize]);

  // Refresh entire queue and counts
  const handleRefresh = async () => {
    await Promise.all([fetchBookings(pagination.page, pageSize, activeTab), fetchStatusCounts()]);
  };

  // Change page
  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.pages || newPage === pagination.page) return;
    fetchBookings(newPage, pageSize, activeTab);
  };

  // Handle Tab Change
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchTerm('');
    // fetchBookings will be triggered by useEffect
  };

  // Handle Booking Approval
  const handleApprove = async (booking) => {
    const bookingId = booking.id || booking._id;
    if (actionLoadingId) return; // Prevent duplicate concurrent submissions

    setActionLoadingId(bookingId);
    setActionError(null);
    setSuccessMessage(null);

    try {
      const res = await bookingService.approveBooking(bookingId);
      setSuccessMessage(
        res.message || `Booking request for "${booking.event?.title || 'Event'}" approved successfully!`
      );
      setTimeout(() => setSuccessMessage(null), 6000);

      // Refresh current page and database status counts
      await Promise.all([fetchBookings(pagination.page, pageSize, activeTab), fetchStatusCounts()]);
    } catch (err) {
      const errorMsg = extractErrorMessage(
        err,
        'Approval failed due to a scheduling conflict or server validation error.'
      );
      setActionError(errorMsg);

      // Refresh the queue so administrator views authoritative state
      await Promise.all([fetchBookings(pagination.page, pageSize, activeTab), fetchStatusCounts()]);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open Rejection Dialog
  const openRejectionDialog = (booking) => {
    setRejectionTarget(booking);
    setRejectionReason('');
    setRejectionError(null);
  };

  // Close Rejection Dialog
  const closeRejectionDialog = () => {
    if (rejectionSubmitting) return;
    setRejectionTarget(null);
    setRejectionReason('');
    setRejectionError(null);
  };

  // Submit Rejection
  const handleConfirmRejection = async (e) => {
    if (e) e.preventDefault();
    if (!rejectionTarget || rejectionSubmitting) return;

    const validation = validateRejectionReason(rejectionReason);
    if (!validation.isValid) {
      setRejectionError(validation.error);
      return;
    }

    const bookingId = rejectionTarget.id || rejectionTarget._id;
    setRejectionSubmitting(true);
    setRejectionError(null);
    setActionError(null);

    try {
      await bookingService.rejectBooking(bookingId, validation.sanitized);
      setSuccessMessage(
        `Booking request for "${rejectionTarget.event?.title || 'Event'}" has been rejected.`
      );
      setTimeout(() => setSuccessMessage(null), 6000);
      closeRejectionDialog();

      // Refresh page and database totals
      await Promise.all([fetchBookings(pagination.page, pageSize, activeTab), fetchStatusCounts()]);
    } catch (err) {
      setRejectionError(extractErrorMessage(err, 'Failed to reject venue booking.'));
    } finally {
      setRejectionSubmitting(false);
    }
  };

  // Filter loaded bookings by search keyword on current page
  const filteredBookings = bookings.filter((b) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();

    const eventTitle = b.event?.title || '';
    const eventCategory = b.event?.category || '';
    const venueName = b.venue?.name || '';
    const venueLocation = b.venue?.location || '';
    const organizerName = b.organizer?.name || '';
    const organizerEmail = b.organizer?.email || '';
    const organizerOrg = b.organizer?.organization || '';
    const purpose = b.purpose || '';

    return (
      eventTitle.toLowerCase().includes(term) ||
      eventCategory.toLowerCase().includes(term) ||
      venueName.toLowerCase().includes(term) ||
      venueLocation.toLowerCase().includes(term) ||
      organizerName.toLowerCase().includes(term) ||
      organizerEmail.toLowerCase().includes(term) ||
      organizerOrg.toLowerCase().includes(term) ||
      purpose.toLowerCase().includes(term)
    );
  });

  // Calculate item range on current page
  const startItem = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endItem = Math.min(pagination.page * pagination.limit, pagination.total);

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
              {statusCounts.pending > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                  <Clock className="w-3 h-3" />
                  {statusCounts.pending} pending review across database
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Venue Booking Requests
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Review and approve campus venue reservations with server-backed pagination and advisory conflict detection.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50"
              title="Refresh queue and database counts"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <Link
              to="/admin/venues"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Manage Venues</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-500 hover:text-emerald-700 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Action Failed</div>
              <div className="text-xs text-rose-700 mt-0.5">{actionError}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-rose-500 hover:text-rose-700 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Tabs & Search Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Status Tabs with Database Totals */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'All Requests', count: statusCounts.all },
              { id: 'pending', label: 'Pending', count: statusCounts.pending, alert: statusCounts.pending > 0 },
              { id: 'approved', label: 'Approved', count: statusCounts.approved },
              { id: 'rejected', label: 'Rejected', count: statusCounts.rejected },
              { id: 'cancelled', label: 'Cancelled', count: statusCounts.cancelled }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70'
                }`}
                title={`Database total: ${tab.count} ${tab.label.toLowerCase()} bookings`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    activeTab === tab.id
                      ? 'bg-white/20 text-white'
                      : tab.alert
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Box & Page Size Selector */}
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search event, venue, organizer..."
                className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:bg-white text-slate-800 transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="py-2 px-2.5 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-rose-500 shrink-0 font-medium"
              title="Bookings per page"
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <Loader2 className="w-8 h-8 text-rose-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-800">Loading booking requests...</p>
          <p className="text-xs text-slate-500 mt-1">Fetching page {pagination.page} from database</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center shadow-xs">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">Failed to load booking requests</h3>
          <p className="text-xs text-rose-600 mt-1 mb-4">{error}</p>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <CalendarCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No booking requests found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {searchTerm
              ? `No bookings on this page match your search query "${searchTerm}". Try resetting search or checking other pages.`
              : activeTab !== 'all'
              ? `There are currently no bookings with status "${activeTab}".`
              : 'No venue booking requests have been submitted yet.'}
          </p>
          {(searchTerm || activeTab !== 'all') && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  handleTabChange('all');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Header Summary Bar with clear distinction between page items and database totals */}
          <div className="text-xs font-medium text-slate-500 px-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              {searchTerm ? (
                <span>
                  Showing <span className="font-semibold text-slate-800">{filteredBookings.length}</span> matching
                  result{filteredBookings.length === 1 ? '' : 's'} on page {pagination.page} (Database total for{' '}
                  <span className="capitalize font-semibold text-slate-700">{activeTab}</span>: {pagination.total})
                </span>
              ) : (
                <span>
                  Showing <span className="font-semibold text-slate-800">{startItem}–{endItem}</span> of{' '}
                  <span className="font-semibold text-slate-800">{pagination.total}</span> total{' '}
                  <span className="capitalize">{activeTab === 'all' ? 'booking' : activeTab}</span> request
                  {pagination.total === 1 ? '' : 's'} (Page {pagination.page} of {pagination.pages})
                </span>
              )}
            </div>
            {activeTab !== 'all' && (
              <span className="capitalize text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md self-start sm:self-auto text-[11px]">
                Filter: {activeTab}
              </span>
            )}
          </div>

          {/* Bookings Queue */}
          <div className="grid grid-cols-1 gap-4">
            {filteredBookings.map((booking) => {
              const bookingId = booking.id || booking._id;
              const statusBadge = getStatusBadge(booking.status);
              const StatusIcon = statusBadge.icon;
              const isPending = booking.status === 'pending';
              const isProcessing = actionLoadingId === bookingId;

              // Run advisory conflict detection against current bookings AND cached approved bookings
              const comparisonList = [...bookings, ...approvedCache];
              const conflicts = detectBookingConflicts(booking, comparisonList);

              return (
                <div
                  key={bookingId}
                  className={`bg-white rounded-2xl border transition-shadow shadow-xs hover:shadow-md overflow-hidden ${
                    isPending
                      ? conflicts.hasApprovedConflict
                        ? 'border-amber-300/80'
                        : 'border-slate-200/90'
                      : 'border-slate-200/70'
                  }`}
                >
                  <div className="p-5 sm:p-6 space-y-4">
                    {/* Header Row: Event Title, Venue & Status */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusBadge.classes}`}
                          >
                            <StatusIcon className="w-3.5 h-3.5" />
                            {statusBadge.label}
                          </span>
                          {booking.event?.category && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 capitalize">
                              {booking.event.category}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400">
                            Requested on {formatDisplayDate(booking.createdAt)}
                          </span>
                        </div>

                        <h2 className="text-lg font-bold text-slate-900 leading-snug">
                          {booking.event?.title || 'Untitled Event'}
                        </h2>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-600">
                          <div className="flex items-center gap-1 font-medium text-slate-800">
                            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                            <span>{booking.venue?.name || 'Assigned Venue'}</span>
                          </div>
                          {booking.venue?.location && (
                            <div className="flex items-center gap-1 text-slate-500">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              <span>{booking.venue.location}</span>
                            </div>
                          )}
                          {booking.venue?.capacity && (
                            <div className="flex items-center gap-1 text-slate-500">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              <span>Max Capacity: {booking.venue.capacity}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Top Action Buttons (for pending status) */}
                      {isPending && (
                        <div className="flex items-center gap-2 shrink-0 sm:self-start">
                          <button
                            type="button"
                            onClick={() => handleApprove(booking)}
                            disabled={isProcessing}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white shadow-xs transition-colors ${
                              conflicts.hasApprovedConflict
                                ? 'bg-amber-600 hover:bg-amber-700'
                                : 'bg-emerald-600 hover:bg-emerald-700'
                            } disabled:opacity-50`}
                            title={
                              conflicts.hasApprovedConflict
                                ? 'Warning: Conflicting approved booking exists in database'
                                : 'Approve venue booking request'
                            }
                          >
                            {isProcessing ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Approving...</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => openRejectionDialog(booking)}
                            disabled={isProcessing}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors disabled:opacity-50"
                            title="Reject venue booking request"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Advisory Conflict Banners */}
                    {isPending && conflicts.hasApprovedConflict && (
                      <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <div className="font-bold">
                            Advisory Conflict Warning: Venue Overlap with Approved Booking
                          </div>
                          <p className="text-amber-800 leading-relaxed">
                            This requested time slot overlaps with{' '}
                            <span className="font-semibold">
                              {conflicts.approvedConflicts.length} approved booking(s)
                            </span>{' '}
                            for the same venue. Approving this request will be validated by the server's authoritative double-booking protection.
                          </p>
                          <div className="pt-1 text-[11px] text-amber-900/80 font-mono">
                            Conflicting:{' '}
                            {conflicts.approvedConflicts
                              .map(
                                (c) =>
                                  `"${c.event?.title || 'Event'}" (${formatDisplayDate(
                                    c.startDateTime
                                  )} – ${formatDisplayDate(c.endDateTime)})`
                              )
                              .join(', ')}
                          </div>
                        </div>
                      </div>
                    )}

                    {isPending && !conflicts.hasApprovedConflict && conflicts.hasPendingConflict && (
                      <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs flex items-start gap-2">
                        <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">Concurrent Pending Requests:</span>{' '}
                          Overlaps with {conflicts.pendingConflicts.length} other pending request(s) for this venue. Review competing requests before deciding which one to approve.
                        </div>
                      </div>
                    )}

                    {/* Schedule Comparison Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/70 text-xs">
                      {/* Booking Interval */}
                      <div>
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-indigo-600" />
                          Requested Venue Reservation Window
                        </div>
                        <div className="font-semibold text-slate-900">
                          {formatDisplayDate(booking.startDateTime)}
                          <span className="text-slate-400 mx-1.5">→</span>
                          {formatDisplayDate(booking.endDateTime)}
                        </div>
                      </div>

                      {/* Event Duration */}
                      <div>
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                          Associated Event Schedule
                        </div>
                        <div className="font-semibold text-slate-900">
                          {formatDisplayDate(booking.event?.startDateTime)}
                          <span className="text-slate-400 mx-1.5">→</span>
                          {formatDisplayDate(booking.event?.endDateTime)}
                        </div>
                      </div>
                    </div>

                    {/* Organizer & Contact Information */}
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5 font-medium text-slate-800">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>Organizer: {booking.organizer?.name || 'Platform Organizer'}</span>
                        {booking.organizer?.organization && (
                          <span className="text-slate-500 font-normal">
                            ({booking.organizer.organization})
                          </span>
                        )}
                      </div>

                      {booking.organizer?.email && (
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <a
                            href={`mailto:${booking.organizer.email}`}
                            className="hover:text-indigo-600 transition-colors"
                          >
                            {booking.organizer.email}
                          </a>
                        </div>
                      )}

                      {booking.organizer?.phone && (
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{booking.organizer.phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Purpose / Booking Notes */}
                    {(booking.purpose || booking.notes) && (
                      <div className="text-xs bg-white p-3 rounded-xl border border-slate-200/80">
                        <div className="text-[11px] font-bold text-slate-500 mb-0.5">
                          Purpose & Logistical Notes:
                        </div>
                        <div className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {booking.purpose || booking.notes}
                        </div>
                      </div>
                    )}

                    {/* Rejection Details (if rejected) */}
                    {booking.status === 'rejected' && booking.rejectionReason && (
                      <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs">
                        <div className="font-bold flex items-center gap-1.5 mb-1 text-rose-800">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          Rejection Reason
                        </div>
                        <p className="text-rose-700 leading-relaxed italic">
                          "{booking.rejectionReason}"
                        </p>
                      </div>
                    )}

                    {/* Audit Metadata (Reviewer & ReviewedAt) */}
                    {booking.reviewedAt && (
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 pt-1">
                        <Shield className="w-3 h-3 text-slate-400" />
                        <span>
                          Reviewed by{' '}
                          <span className="font-semibold text-slate-600">
                            {booking.reviewedBy?.name || 'Administrator'}
                          </span>{' '}
                          on {formatDisplayDate(booking.reviewedAt)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Server-Side Pagination Footer */}
          {pagination.pages > 1 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
              <div>
                Showing page <span className="font-semibold text-slate-900">{pagination.page}</span> of{' '}
                <span className="font-semibold text-slate-900">{pagination.pages}</span> ({pagination.total} total
                records in database)
              </div>

              <div className="flex items-center gap-1.5 self-center sm:self-auto">
                <button
                  type="button"
                  disabled={pagination.page <= 1 || loading}
                  onClick={() => handlePageChange(pagination.page - 1)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-2xs"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                {/* Page Indicators */}
                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: pagination.pages }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === pagination.pages ||
                        Math.abs(p - pagination.page) <= 1
                    )
                    .map((pageNum, idx, arr) => {
                      const prev = arr[idx - 1];
                      return (
                        <React.Fragment key={pageNum}>
                          {prev && pageNum - prev > 1 && (
                            <span className="text-slate-400 px-1 select-none">...</span>
                          )}
                          <button
                            type="button"
                            onClick={() => handlePageChange(pageNum)}
                            disabled={loading}
                            className={`min-w-7 h-7 px-2 rounded-lg font-bold text-xs transition-colors ${
                              pagination.page === pageNum
                                ? 'bg-rose-600 text-white shadow-2xs'
                                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                            }`}
                          >
                            {pageNum}
                          </button>
                        </React.Fragment>
                      );
                    })}
                </div>

                <button
                  type="button"
                  disabled={pagination.page >= pagination.pages || loading}
                  onClick={() => handlePageChange(pagination.page + 1)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-2xs"
                  aria-label="Next page"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reject Booking Dialog Modal */}
      {rejectionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Reject Venue Booking Request
                  </h3>
                  <p className="text-xs text-slate-500">
                    Provide a mandatory reason for declining this request.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeRejectionDialog}
                disabled={rejectionSubmitting}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Summary */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1">
              <div className="font-bold text-slate-900">
                {rejectionTarget.event?.title || 'Event'}
              </div>
              <div className="text-slate-600 flex items-center gap-2">
                <span>Venue: {rejectionTarget.venue?.name || 'Venue'}</span>
                <span>•</span>
                <span>Organizer: {rejectionTarget.organizer?.name || 'Organizer'}</span>
              </div>
              <div className="text-slate-500">
                Requested: {formatDisplayDate(rejectionTarget.startDateTime)} – {formatDisplayDate(rejectionTarget.endDateTime)}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleConfirmRejection} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Rejection Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={rejectionReason}
                  onChange={(e) => {
                    setRejectionReason(e.target.value);
                    if (rejectionError) setRejectionError(null);
                  }}
                  maxLength={1000}
                  placeholder="Explain why this request is being rejected (e.g., Campus auditorium is reserved for institutional convocation; facility maintenance scheduled)..."
                  className={`w-full p-3 rounded-xl text-xs bg-slate-50 border focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500 text-slate-900 ${
                    rejectionError ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200'
                  }`}
                  disabled={rejectionSubmitting}
                />
                <div className="flex items-center justify-between mt-1 text-[11px]">
                  <span className="text-rose-600 font-medium">{rejectionError}</span>
                  <span
                    className={`${
                      rejectionReason.length > 950 ? 'text-amber-600 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    {rejectionReason.length} / 1000 characters
                  </span>
                </div>
              </div>

              {/* Dialog Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeRejectionDialog}
                  disabled={rejectionSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rejectionSubmitting || !rejectionReason.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-xs transition-colors disabled:opacity-50"
                >
                  {rejectionSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Rejecting...</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Confirm Rejection</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
