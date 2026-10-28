import React, { useState, useEffect, useCallback } from 'react';
import { cateringRequestService, extractErrorMessage } from '../../services/cateringRequestService';
import {
  getCateringRequestStatusBadge,
  validateRejectionReason,
  formatDisplayDateTime,
  formatDisplayDate
} from '../../utils/cateringRequestUtils';
import {
  ClipboardList,
  UtensilsCrossed,
  Calendar,
  Clock,
  MapPin,
  Users,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  Eye,
  Check,
  Ban,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  Mail,
  Phone,
  Building,
  MessageSquare,
  FileText
} from 'lucide-react';

const STATUS_TABS = [
  { id: '', label: 'All Requests' },
  { id: 'pending', label: 'Pending Review' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'cancelled', label: 'Cancelled' }
];

export default function VendorCateringRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1, limit: 10 });
  const [activeStatus, setActiveStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Detail Modal
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Accept Modal
  const [acceptingRequest, setAcceptingRequest] = useState(null);
  const [acceptNotes, setAcceptNotes] = useState('');
  const [acceptSubmitting, setAcceptSubmitting] = useState(false);
  const [acceptError, setAcceptError] = useState(null);

  // Reject Modal
  const [rejectingRequest, setRejectingRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [rejectionValidationError, setRejectionValidationError] = useState(null);
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [rejectError, setRejectError] = useState(null);

  // Fetch Vendor Incoming Requests
  const fetchRequests = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit: 10
      };
      if (activeStatus) params.status = activeStatus;

      const res = await cateringRequestService.getVendorCateringRequests(params);
      setRequests(res.data || []);
      setPagination(res.pagination || { total: 0, page: 1, pages: 1, limit: 10 });
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load incoming catering requests.'));
    } finally {
      setLoading(false);
    }
  }, [activeStatus]);

  useEffect(() => {
    fetchRequests(1);
  }, [fetchRequests]);

  // Handle Accept
  const handleConfirmAccept = async (e) => {
    e.preventDefault();
    if (!acceptingRequest) return;

    setAcceptSubmitting(true);
    setAcceptError(null);
    try {
      await cateringRequestService.acceptCateringRequest(
        acceptingRequest.id || acceptingRequest._id,
        acceptNotes
      );
      setAcceptingRequest(null);
      setAcceptNotes('');
      fetchRequests(pagination.page);
    } catch (err) {
      setAcceptError(extractErrorMessage(err, 'Failed to accept catering request.'));
    } finally {
      setAcceptSubmitting(false);
    }
  };

  // Handle Reject
  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectingRequest) return;

    const validation = validateRejectionReason(rejectionReason);
    if (!validation.isValid) {
      setRejectionValidationError(validation.error);
      return;
    }

    setRejectSubmitting(true);
    setRejectError(null);
    setRejectionValidationError(null);

    try {
      await cateringRequestService.rejectCateringRequest(
        rejectingRequest.id || rejectingRequest._id,
        validation.sanitized,
        rejectNotes
      );
      setRejectingRequest(null);
      setRejectionReason('');
      setRejectNotes('');
      fetchRequests(pagination.page);
    } catch (err) {
      setRejectError(extractErrorMessage(err, 'Failed to reject catering request.'));
    } finally {
      setRejectSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                <UtensilsCrossed className="w-3.5 h-3.5" />
                Vendor Dispatch
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Incoming Catering Requests
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Review catering proposals from campus organizers, verify headcounts, and accept or reject service agreements.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fetchRequests(pagination.page)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Queue</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between text-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchRequests(pagination.page)}
            className="text-xs font-semibold underline text-rose-700 hover:text-rose-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {STATUS_TABS.map((tab) => {
          const isActive = activeStatus === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveStatus(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="py-20 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600 mb-2" />
          <p className="text-sm font-medium">Loading incoming requests...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="py-16 px-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
            <ClipboardList className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-slate-800 text-base">No catering requests found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {activeStatus
              ? `You have no ${activeStatus} catering proposals in your queue.`
              : 'You have no incoming catering proposals at this time.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            const statusBadge = getCateringRequestStatusBadge(req.status);
            const isPending = req.status === 'pending';

            return (
              <div
                key={req.id || req._id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  {/* Left: Event & Organizer Info */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusBadge.classes}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dotClass}`} />
                        {statusBadge.label}
                      </span>

                      {req.event?.category && (
                        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 capitalize">
                          {req.event.category}
                        </span>
                      )}

                      <span className="text-[11px] text-slate-400">
                        Received: {formatDisplayDateTime(req.createdAt)}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-lg leading-snug">
                      {req.event?.title || 'Campus Event Proposal'}
                    </h3>

                    {/* Organizer details */}
                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-600">
                      <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Organizer: <strong>{req.organizer?.name || 'Authorized Organizer'}</strong></span>
                      </div>

                      {req.organizer?.organization && (
                        <div className="flex items-center gap-1 text-slate-500">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          <span>{req.organizer.organization}</span>
                        </div>
                      )}

                      {req.organizer?.email && (
                        <div className="flex items-center gap-1 text-slate-500">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{req.organizer.email}</span>
                        </div>
                      )}
                    </div>

                    {/* Service schedule */}
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Calendar className="w-3.5 h-3.5 text-amber-600" />
                      <span>Delivery Target: <strong>{formatDisplayDateTime(req.serviceDateTime || req.event?.startDateTime)}</strong></span>
                    </div>
                  </div>

                  {/* Right: Package Snapshot & Quote */}
                  <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-200/80 flex items-center justify-between lg:flex-col lg:items-end lg:justify-center gap-2 min-w-[200px]">
                    <div>
                      <span className="text-amber-800 block text-[10px] uppercase font-semibold">
                        Quoted Contract Value
                      </span>
                      <span className="text-xl font-black text-amber-900">
                        ${Number(req.quotedPrice).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-slate-800 block">
                        {req.guestCount} Attendees (${req.pricePerPlate}/plate)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Menu: {req.selectedPackage?.name}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Organizer notes */}
                {req.notes && (
                  <div className="mt-3.5 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700">
                    <strong className="font-semibold block text-[11px] text-slate-500 uppercase mb-0.5">
                      Organizer Setup Requirements:
                    </strong>
                    <p>"{req.notes}"</p>
                  </div>
                )}

                {/* Status-specific banners */}
                {req.status === 'accepted' && (
                  <div className="mt-3.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">You accepted this catering contract on {formatDisplayDateTime(req.respondedAt || req.updatedAt)}</span>
                      {req.vendorNotes && <p className="mt-0.5 text-slate-700">Notes provided: "{req.vendorNotes}"</p>}
                    </div>
                  </div>
                )}

                {req.status === 'rejected' && (
                  <div className="mt-3.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Declined on {formatDisplayDateTime(req.respondedAt || req.updatedAt)}</span>
                      <p className="mt-0.5">Reason: "{req.rejectionReason}"</p>
                    </div>
                  </div>
                )}

                {req.status === 'cancelled' && (
                  <div className="mt-3.5 p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
                    <Ban className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <span>Cancelled by Organizer on {formatDisplayDateTime(req.cancelledAt || req.updatedAt)}</span>
                      {req.cancellationReason && (
                        <p className="mt-0.5 italic text-slate-500">Reason: "{req.cancellationReason}"</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Bottom Row Actions */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[11px] text-slate-400">
                    Min order required: {req.selectedPackage?.minOrder} attendees
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedRequest(req)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </button>

                    {isPending && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingRequest(req);
                            setRejectionReason('');
                            setRejectNotes('');
                            setRejectionValidationError(null);
                            setRejectError(null);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Decline</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setAcceptingRequest(req);
                            setAcceptNotes('');
                            setAcceptError(null);
                          }}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Accept Contract</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {pagination.pages > 1 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing Page <strong>{pagination.page}</strong> of <strong>{pagination.pages}</strong> ({pagination.total} incoming proposals)
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1 || loading}
              onClick={() => fetchRequests(pagination.page - 1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <button
              type="button"
              disabled={pagination.page >= pagination.pages || loading}
              onClick={() => fetchRequests(pagination.page + 1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Accept Confirmation Modal */}
      {acceptingRequest && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 sm:p-7 animate-fadeIn">
            <div className="flex items-center gap-3 text-emerald-600 mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-200 shrink-0">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Accept Catering Proposal?</h3>
                <p className="text-xs text-slate-500">Event: {acceptingRequest.event?.title}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              You are confirming catering services for <strong>{acceptingRequest.guestCount} guests</strong> with a total value of{' '}
              <strong className="text-emerald-700">${Number(acceptingRequest.quotedPrice).toFixed(2)}</strong>.
            </p>

            {acceptError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 mb-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{acceptError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmAccept} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Vendor Arrival & Banquet Setup Notes <span className="text-slate-400 lowercase font-normal">(optional)</span>
                </label>
                <textarea
                  rows="3"
                  maxLength="1000"
                  value={acceptNotes}
                  onChange={(e) => setAcceptNotes(e.target.value)}
                  placeholder="e.g., We will arrive at 08:00 AM with warming trays. Please have tables ready near the south entrance..."
                  className="block w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-100 focus:border-emerald-600"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={acceptSubmitting}
                  onClick={() => setAcceptingRequest(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={acceptSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs disabled:opacity-50"
                >
                  {acceptSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Accepting...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirm Acceptance</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingRequest && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 sm:p-7 animate-fadeIn">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center border border-rose-200 shrink-0">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Decline Catering Proposal</h3>
                <p className="text-xs text-slate-500">Event: {rejectingRequest.event?.title}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              Declining this proposal is permanent. You must provide a clear explanation to the event organizer.
            </p>

            {rejectError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 mb-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{rejectError}</span>
              </div>
            )}

            {rejectionValidationError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 mb-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{rejectionValidationError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmReject} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Rejection Reason <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">{rejectionReason.length}/1000</span>
                </div>
                <textarea
                  rows="3"
                  maxLength="1000"
                  required
                  value={rejectionReason}
                  onChange={(e) => {
                    setRejectionReason(e.target.value);
                    if (rejectionValidationError) setRejectionValidationError(null);
                  }}
                  placeholder="e.g., Kitchen fully booked for campus conference on this date; cannot supply dietary requirements..."
                  className="block w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-rose-100 focus:border-rose-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Additional Notes <span className="text-slate-400 lowercase font-normal">(optional)</span>
                </label>
                <textarea
                  rows="2"
                  maxLength="1000"
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Optional recommendations, alternative dates or referral..."
                  className="block w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-slate-100 focus:border-slate-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={rejectSubmitting}
                  onClick={() => setRejectingRequest(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rejectSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs disabled:opacity-50"
                >
                  {rejectSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Declining...</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Decline Proposal</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full p-6 sm:p-8 animate-fadeIn max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 shrink-0">
              <div>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border mb-1 ${getCateringRequestStatusBadge(selectedRequest.status).classes}`}
                >
                  {getCateringRequestStatusBadge(selectedRequest.status).label}
                </span>
                <h3 className="font-extrabold text-xl text-slate-900">
                  {selectedRequest.event?.title || 'Campus Event Proposal'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Request ID: <span className="font-mono">{selectedRequest.id || selectedRequest._id}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="py-5 overflow-y-auto space-y-5 text-sm text-slate-600 pr-1">
              {/* Event & Organizer Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block font-semibold uppercase text-[10px]">Client / Organizer</span>
                  <span className="font-bold text-slate-800 text-sm">{selectedRequest.organizer?.name}</span>
                  {selectedRequest.organizer?.organization && (
                    <span className="text-slate-600 block">{selectedRequest.organizer.organization}</span>
                  )}
                  {selectedRequest.organizer?.email && (
                    <span className="text-slate-500 block">Email: {selectedRequest.organizer.email}</span>
                  )}
                  {selectedRequest.organizer?.phone && (
                    <span className="text-slate-500 block">Phone: {selectedRequest.organizer.phone}</span>
                  )}
                </div>

                <div>
                  <span className="text-slate-400 block font-semibold uppercase text-[10px]">Event & Schedule</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {formatDisplayDateTime(selectedRequest.serviceDateTime || selectedRequest.event?.startDateTime)}
                  </span>
                  <span className="text-slate-500 block capitalize">Category: {selectedRequest.event?.category || 'General'}</span>
                  <span className="text-slate-500 block">Submitted: {formatDisplayDateTime(selectedRequest.createdAt)}</span>
                </div>
              </div>

              {/* Package Snapshot */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Package Snapshot & Specifications
                </h4>
                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h5 className="font-bold text-slate-900 text-base">{selectedRequest.selectedPackage?.name}</h5>
                      <p className="text-xs text-slate-500">{selectedRequest.selectedPackage?.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-black text-amber-700 text-base block">
                        ${selectedRequest.pricePerPlate}/plate
                      </span>
                      <span className="text-[11px] text-slate-400">Headcount: {selectedRequest.guestCount} guests</span>
                    </div>
                  </div>

                  {/* Dietary tags */}
                  {(selectedRequest.selectedPackage?.dietaryOptions || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {selectedRequest.selectedPackage.dietaryOptions.map((d) => (
                        <span
                          key={d}
                          className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/50 text-[10px] font-semibold"
                        >
                          ✓ {d}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Menu items */}
                  {(selectedRequest.selectedPackage?.menuItems || []).length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                        Courses & Dishes:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedRequest.selectedPackage.menuItems.map((item, idx) => (
                          <span
                            key={idx}
                            className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px]"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Quote Breakdown */}
              <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-900 block">Total Contract Amount</span>
                  <span className="text-xs text-slate-500">
                    ${selectedRequest.pricePerPlate} × {selectedRequest.guestCount} guests
                  </span>
                </div>
                <span className="text-2xl font-black text-amber-900">
                  ${Number(selectedRequest.quotedPrice).toFixed(2)}
                </span>
              </div>

              {/* Organizer Notes */}
              {selectedRequest.notes && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Special Notes from Organizer
                  </h4>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700">
                    "{selectedRequest.notes}"
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-400">Vendor responses are binding</span>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
