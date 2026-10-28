import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { cateringRequestService, extractErrorMessage } from '../../services/cateringRequestService';
import {
  getCateringRequestStatusBadge,
  isCateringRequestCancellable,
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
  Ban,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  Info,
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

export default function OrganizerCateringRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1, limit: 10 });
  const [activeStatus, setActiveStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Detail Modal
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Cancellation Modal
  const [cancellingRequest, setCancellingRequest] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellationSubmitting, setCancellationSubmitting] = useState(false);
  const [cancellationError, setCancellationError] = useState(null);

  // Fetch Organizer Requests
  const fetchRequests = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit: 10
      };
      if (activeStatus) params.status = activeStatus;

      const res = await cateringRequestService.getOrganizerCateringRequests(params);
      setRequests(res.data || []);
      setPagination(res.pagination || { total: 0, page: 1, pages: 1, limit: 10 });
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load catering requests.'));
    } finally {
      setLoading(false);
    }
  }, [activeStatus]);

  useEffect(() => {
    fetchRequests(1);
  }, [fetchRequests]);

  // Handle Request Cancellation
  const handleConfirmCancel = async (e) => {
    e.preventDefault();
    if (!cancellingRequest) return;

    setCancellationSubmitting(true);
    setCancellationError(null);
    try {
      await cateringRequestService.cancelCateringRequest(
        cancellingRequest.id || cancellingRequest._id,
        cancellationReason
      );
      setCancellingRequest(null);
      setCancellationReason('');
      // Refresh list
      fetchRequests(pagination.page);
    } catch (err) {
      setCancellationError(extractErrorMessage(err, 'Failed to cancel catering request.'));
    } finally {
      setCancellationSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <ClipboardList className="w-3.5 h-3.5" />
                Organizer Tracker
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              My Catering Requests
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Track vendor proposals, review catering decisions, and manage banquet contracts across your events.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/organizer/catering"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors shadow-2xs"
            >
              <UtensilsCrossed className="w-4 h-4" />
              <span>Explore Caterers</span>
            </Link>

            <button
              type="button"
              onClick={() => fetchRequests(pagination.page)}
              className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              title="Refresh request list"
            >
              <RefreshCw className="w-4 h-4" />
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
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
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
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
          <p className="text-sm font-medium">Loading your catering proposals...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="py-16 px-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-slate-800 text-base">No catering requests found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {activeStatus
              ? `You currently have no ${activeStatus} catering proposals.`
              : 'You have not submitted any catering proposals yet.'}
          </p>
          <div className="mt-4">
            <Link
              to="/organizer/catering"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs"
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Browse Campus Caterers</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            const statusBadge = getCateringRequestStatusBadge(req.status);
            const cancellability = isCateringRequestCancellable(req, req.event);

            return (
              <div
                key={req.id || req._id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  {/* Left: Event & Vendor Info */}
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
                        Submitted: {formatDisplayDateTime(req.createdAt)}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-lg leading-snug">
                      {req.event?.title || 'Campus Event'}
                    </h3>

                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <UtensilsCrossed className="w-3.5 h-3.5 text-amber-600" />
                        <span>Vendor: <strong>{req.cateringService?.businessName || req.vendor?.organization || req.vendor?.name || 'Campus Caterer'}</strong></span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Service Time: <strong>{formatDisplayDateTime(req.serviceDateTime || req.event?.startDateTime)}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Package Snapshot & Quoted Amount */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between lg:flex-col lg:items-end lg:justify-center gap-2 min-w-[180px]">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                        Authoritative Quote
                      </span>
                      <span className="text-xl font-black text-amber-700">
                        ${Number(req.quotedPrice).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-slate-700 block">
                        {req.guestCount} guests
                      </span>
                      <span className="text-[11px] text-slate-400">
                        ${req.pricePerPlate}/plate ({req.selectedPackage?.name})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Vendor response / Rejection banner if available */}
                {req.status === 'rejected' && req.rejectionReason && (
                  <div className="mt-3.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold block mb-0.5">Vendor Rejection Reason:</strong>
                      <p>{req.rejectionReason}</p>
                    </div>
                  </div>
                )}

                {req.status === 'accepted' && req.vendorNotes && (
                  <div className="mt-3.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold block mb-0.5">Vendor Response Notes:</strong>
                      <p>{req.vendorNotes}</p>
                    </div>
                  </div>
                )}

                {req.status === 'cancelled' && (
                  <div className="mt-3.5 p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
                    <Ban className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <span>Cancelled on {formatDisplayDateTime(req.cancelledAt || req.updatedAt)}</span>
                      {req.cancellationReason && (
                        <p className="mt-0.5 italic text-slate-500">Reason: "{req.cancellationReason}"</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Bottom Row Actions */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-400 truncate max-w-sm">
                    {req.notes ? (
                      <span>Notes: <em>"{req.notes}"</em></span>
                    ) : (
                      <span>No additional setup notes</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedRequest(req)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </button>

                    {cancellability.cancellable && (
                      <button
                        type="button"
                        onClick={() => {
                          setCancellingRequest(req);
                          setCancellationReason('');
                          setCancellationError(null);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 transition-colors"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Cancel</span>
                      </button>
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
            Showing Page <strong>{pagination.page}</strong> of <strong>{pagination.pages}</strong> ({pagination.total} proposals)
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
                  {selectedRequest.event?.title || 'Campus Event'}
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
              {/* Event & Schedule */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block font-semibold uppercase text-[10px]">Catering Partner</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {selectedRequest.cateringService?.businessName || selectedRequest.vendor?.organization || selectedRequest.vendor?.name}
                  </span>
                  {selectedRequest.cateringService?.serviceArea && (
                    <span className="text-slate-500 block">Service Area: {selectedRequest.cateringService.serviceArea}</span>
                  )}
                  {selectedRequest.vendor?.email && (
                    <span className="text-slate-500 block">Contact: {selectedRequest.vendor.email}</span>
                  )}
                </div>

                <div>
                  <span className="text-slate-400 block font-semibold uppercase text-[10px]">Service Delivery Time</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {formatDisplayDateTime(selectedRequest.serviceDateTime || selectedRequest.event?.startDateTime)}
                  </span>
                  <span className="text-slate-500 block">Submitted: {formatDisplayDateTime(selectedRequest.createdAt)}</span>
                </div>
              </div>

              {/* Package Snapshot */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Selected Menu Package Snapshot
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

                  {/* Menu courses */}
                  {(selectedRequest.selectedPackage?.menuItems || []).length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                        Included Dishes & Courses:
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
                  <span className="text-xs font-bold text-amber-900 block">Server-Confirmed Total Quote</span>
                  <span className="text-xs text-slate-500">
                    Calculated at ${selectedRequest.pricePerPlate} × {selectedRequest.guestCount} attendees
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
                    Organizer Setup Instructions
                  </h4>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700">
                    "{selectedRequest.notes}"
                  </div>
                </div>
              )}

              {/* Vendor Decision Data */}
              {selectedRequest.status === 'accepted' && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Vendor Accepted Proposal</span>
                  </div>
                  <p>Responded on: {formatDisplayDateTime(selectedRequest.respondedAt || selectedRequest.updatedAt)}</p>
                  {selectedRequest.vendorNotes && (
                    <p className="mt-1 font-medium">Notes: "{selectedRequest.vendorNotes}"</p>
                  )}
                </div>
              )}

              {selectedRequest.status === 'rejected' && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>Vendor Rejected Proposal</span>
                  </div>
                  <p>Responded on: {formatDisplayDateTime(selectedRequest.respondedAt || selectedRequest.updatedAt)}</p>
                  <p className="mt-1 font-medium">Reason: "{selectedRequest.rejectionReason}"</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-400">Status is updated in real time by the caterer</span>
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

      {/* Cancellation Confirmation Modal */}
      {cancellingRequest && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 sm:p-7 animate-fadeIn">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center border border-rose-200 shrink-0">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Cancel Catering Proposal?</h3>
                <p className="text-xs text-slate-500">Event: {cancellingRequest.event?.title}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Are you sure you want to cancel this catering proposal for{' '}
              <strong>{cancellingRequest.guestCount} guests</strong>? This will transition the request to
              <strong className="text-slate-800"> Cancelled</strong>.
            </p>

            {cancellationError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 mb-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{cancellationError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmCancel} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Cancellation Reason <span className="text-slate-400 lowercase font-normal">(optional)</span>
                </label>
                <textarea
                  rows="2"
                  maxLength="1000"
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="e.g., Event scope changed, sponsor hosting banquet elsewhere..."
                  className="block w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-rose-100 focus:border-rose-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={cancellationSubmitting}
                  onClick={() => setCancellingRequest(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl disabled:opacity-50"
                >
                  Keep Request
                </button>
                <button
                  type="submit"
                  disabled={cancellationSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs disabled:opacity-50"
                >
                  {cancellationSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Cancelling...</span>
                    </>
                  ) : (
                    <>
                      <Ban className="w-3.5 h-3.5" />
                      <span>Confirm Cancellation</span>
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
