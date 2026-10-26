import React, { useState, useEffect, useCallback } from 'react';
import { eventService } from '../../services/eventService';
import { bookingService, extractErrorMessage } from '../../services/bookingService';
import {
  toDatetimeLocal,
  formatDisplayDate,
  doesBookingCoverEvent,
  evaluateBookingEligibility
} from '../../utils/bookingUtils';
import {
  Building2,
  Calendar,
  Clock,
  Users,
  MapPin,
  DollarSign,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
  FileText
} from 'lucide-react';

export { toDatetimeLocal, formatDisplayDate, doesBookingCoverEvent, evaluateBookingEligibility };

export default function RequestBookingModal({ venue, isOpen, onClose, onSuccess }) {
  // Event options state
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState(null);

  // Form state
  const [selectedEventId, setSelectedEventId] = useState('');
  const [startDateTime, setStartDateTime] = useState('');
  const [endDateTime, setEndDateTime] = useState('');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');

  // Submission & Validation state
  const [validationErrors, setValidationErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [successData, setSuccessData] = useState(null);

  // Load organizer's active events when modal opens
  const loadOrganizerEvents = useCallback(async () => {
    if (!isOpen) return;
    setEventsLoading(true);
    setEventsError(null);
    try {
      const res = await eventService.getEvents({ organizer: 'me', limit: 100 });
      const allEvents = res.data || [];
      // Exclude cancelled events
      const activeEvents = allEvents.filter((e) => e.status !== 'cancelled');
      setEvents(activeEvents);
    } catch (err) {
      setEventsError(extractErrorMessage(err, 'Failed to load your events.'));
    } finally {
      setEventsLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setSelectedEventId('');
      setStartDateTime('');
      setEndDateTime('');
      setPurpose('');
      setNotes('');
      setValidationErrors([]);
      setApiError(null);
      setSuccessData(null);
      loadOrganizerEvents();
    }
  }, [isOpen, loadOrganizerEvents]);

  if (!isOpen || !venue) return null;

  const currentVenueId = venue.id || venue._id;
  const selectedEvent = events.find((e) => String(e.id || e._id) === String(selectedEventId));

  // Determine if the selected event is assigned to a different venue
  const assignedVenueId = selectedEvent?.venue
    ? typeof selectedEvent.venue === 'object'
      ? (selectedEvent.venue.id || selectedEvent.venue._id)
      : selectedEvent.venue
    : null;
  const isDifferentVenueAssigned =
    assignedVenueId && String(assignedVenueId) !== String(currentVenueId);

  // Check capacity mismatch
  const isCapacityExceeded =
    selectedEvent && venue.capacity && selectedEvent.capacity > venue.capacity;

  // Handle Event selection change
  const handleEventChange = (e) => {
    const eventId = e.target.value;
    setSelectedEventId(eventId);
    setValidationErrors([]);
    setApiError(null);

    const evt = events.find((item) => String(item.id || item._id) === String(eventId));
    if (evt) {
      // Prefill booking times from the selected event
      setStartDateTime(toDatetimeLocal(evt.startDateTime));
      setEndDateTime(toDatetimeLocal(evt.endDateTime));
    } else {
      setStartDateTime('');
      setEndDateTime('');
    }
  };

  // Client-side form validation
  const validateForm = () => {
    const errors = [];

    if (!selectedEventId) {
      errors.push('Please select an event for this booking request.');
      return errors;
    }

    if (isDifferentVenueAssigned) {
      errors.push(
        'This event is already assigned to a different venue. The backend requires the requested venue to match the event\'s assigned venue.'
      );
    }

    if (!startDateTime) {
      errors.push('Booking start date and time is required.');
    }

    if (!endDateTime) {
      errors.push('Booking end date and time is required.');
    }

    if (startDateTime && endDateTime) {
      const start = new Date(startDateTime);
      const end = new Date(endDateTime);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        errors.push('Invalid booking date/time format.');
      } else if (end <= start) {
        errors.push('Booking end time must be after the booking start time.');
      }

      if (selectedEvent) {
        const covers = doesBookingCoverEvent(
          startDateTime,
          endDateTime,
          selectedEvent.startDateTime,
          selectedEvent.endDateTime
        );
        if (!covers) {
          errors.push(
            `Booking window must cover the full event schedule (${formatDisplayDate(
              selectedEvent.startDateTime
            )} to ${formatDisplayDate(selectedEvent.endDateTime)}).`
          );
        }
      }
    }

    if (purpose && purpose.length > 1000) {
      errors.push('Booking purpose cannot exceed 1000 characters.');
    }

    if (notes && notes.length > 1000) {
      errors.push('Additional notes cannot exceed 1000 characters.');
    }

    return errors;
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setSubmitting(true);
    setValidationErrors([]);
    setApiError(null);

    try {
      const payload = {
        event: selectedEventId,
        venue: currentVenueId,
        startDateTime: new Date(startDateTime).toISOString(),
        endDateTime: new Date(endDateTime).toISOString(),
        purpose: purpose.trim(),
        notes: notes.trim()
      };

      const res = await bookingService.createBooking(payload);
      setSuccessData(res.data);
      if (onSuccess) {
        onSuccess(res.data);
      }
    } catch (err) {
      const msg = extractErrorMessage(err, 'Failed to submit booking request.');
      const backendErrors = err.response?.data?.errors;
      if (Array.isArray(backendErrors) && backendErrors.length > 0) {
        setValidationErrors(backendErrors);
      } else {
        setApiError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 sm:p-8 animate-fadeIn max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Building2 className="w-3.5 h-3.5" />
                Venue Booking Request
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Book {venue.name}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{venue.location}</span>
              <span>•</span>
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span>{venue.capacity.toLocaleString()} Capacity</span>
              <span>•</span>
              <DollarSign className="w-3.5 h-3.5 text-slate-400" />
              <span>{venue.hourlyRate > 0 ? `$${venue.hourlyRate}/hr` : 'Free'}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto py-4 space-y-4 flex-1">
          {/* Success Notification View */}
          {successData ? (
            <div className="p-5 rounded-2xl bg-emerald-50/80 border border-emerald-200 space-y-3 animate-fadeIn">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Booking Request Submitted!
                  </h3>
                  <p className="text-xs text-emerald-800">
                    Status: <strong className="font-semibold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">Pending Administrator Approval</strong>
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed bg-white/80 p-3 rounded-xl border border-emerald-100">
                Your reservation request for <strong>{venue.name}</strong> covering event <strong>&quot;{selectedEvent?.title}&quot;</strong> has been sent to campus administration. You will be notified once reviewed.
              </p>
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* API Error Alert */}
              {apiError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{apiError}</span>
                </div>
              )}

              {/* Validation Errors Alert */}
              {validationErrors.length > 0 && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1 animate-fadeIn">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Please correct the following:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 pl-1">
                    {validationErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Event Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Event to Host <span className="text-rose-500">*</span>
                </label>
                {eventsLoading ? (
                  <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    <span>Loading your eligible events...</span>
                  </div>
                ) : eventsError ? (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between">
                    <span>{eventsError}</span>
                    <button
                      type="button"
                      onClick={loadOrganizerEvents}
                      className="text-xs font-bold underline ml-2"
                    >
                      Retry
                    </button>
                  </div>
                ) : events.length === 0 ? (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                    No active draft or published events found. Please create an event in My Events before requesting a venue.
                  </div>
                ) : (
                  <select
                    value={selectedEventId}
                    onChange={handleEventChange}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    required
                  >
                    <option value="">-- Choose an Event --</option>
                    {events.map((evt) => {
                      const id = evt.id || evt._id;
                      const assignedV = evt.venue
                        ? typeof evt.venue === 'object'
                          ? (evt.venue.id || evt.venue._id)
                          : evt.venue
                        : null;
                      const hasDifferentV = assignedV && String(assignedV) !== String(currentVenueId);

                      return (
                        <option key={id} value={id}>
                          {evt.title} ({evt.capacity} attendees, {evt.status})
                          {hasDifferentV ? ' — [Different venue assigned]' : ''}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              {/* Event Info Callout */}
              {selectedEvent && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{selectedEvent.title}</span>
                    <span className="capitalize px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/60 text-slate-700">
                      {selectedEvent.category} • {selectedEvent.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    <span>
                      Event Scheduled: {formatDisplayDate(selectedEvent.startDateTime)} – {formatDisplayDate(selectedEvent.endDateTime)}
                    </span>
                  </div>

                  {/* Different venue assigned warning */}
                  {isDifferentVenueAssigned && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px] flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <span>
                        This event already has a different venue assigned. Backend rules require the requested venue to match the event's assigned venue. Please update the event's venue in My Events first.
                      </span>
                    </div>
                  )}

                  {/* Auto-assignment Notice */}
                  {!assignedVenueId && (
                    <div className="p-2 bg-indigo-50/70 border border-indigo-100 rounded-lg text-indigo-700 text-[11px] flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>
                        This venue will be automatically assigned to the event upon booking request submission.
                      </span>
                    </div>
                  )}

                  {/* Capacity Exceeded Warning */}
                  {isCapacityExceeded && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        Caution: Event planned capacity (<strong>{selectedEvent.capacity}</strong> attendees) exceeds this venue's seating capacity (<strong>{venue.capacity}</strong> seats).
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Start & End Date Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Booking Start Time <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={startDateTime}
                    onChange={(e) => setStartDateTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    required
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Must be on or before event start
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Booking End Time <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={endDateTime}
                    onChange={(e) => setEndDateTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    required
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Must be on or after event end
                  </span>
                </div>
              </div>

              {/* Purpose */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Purpose of Reservation
                  </label>
                  <span className="text-[10px] text-slate-400">{purpose.length}/1000</span>
                </div>
                <input
                  type="text"
                  maxLength={1000}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. Annual Technical Keynote and Project Demonstrations"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Additional Notes */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Equipment & Setup Notes
                  </label>
                  <span className="text-[10px] text-slate-400">{notes.length}/1000</span>
                </div>
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Requires projector, wireless podium microphones, and 30 minutes early access for AV testing."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Modal Footer Controls */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || events.length === 0 || isDifferentVenueAssigned}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Submit Request</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
