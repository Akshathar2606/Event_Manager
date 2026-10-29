import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  eventService,
  EVENT_CATEGORIES,
  extractErrorMessage
} from '../../services/eventService';
import { venueService } from '../../services/venueService';
import { registrationService } from '../../services/registrationService';
import {
  evaluateRegistrationEligibility,
  isEventStarted,
  isRegistrationDeadlinePassed,
  isEventFull,
  ACADEMIC_YEAR_OPTIONS
} from '../../utils/registrationUtils';
import { useAuth } from '../../context/AuthContext';
import { getEventFeatureDetails } from '../../utils/eventFeatures';
import { getEventContacts, getOfficialEventLinks } from '../../utils/eventContacts';
import {
  Compass,
  Search,
  Filter,
  Calendar,
  Clock,
  MapPin,
  GraduationCap,
  ClipboardCheck,
  Users,
  Tag,
  Building2,
  Mail,
  Phone,
  Globe,
  Instagram,
  User,
  Ticket,
  Loader2,
  AlertCircle,
  X,
  Sparkles,
  CheckCircle2,
  DollarSign,
  ArrowRight,
  Info
} from 'lucide-react';

const formatDate = (isoString) => {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const formatTime = (isoString) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function ParticipantEventsPage() {
  const { user } = useAuth();
  const isParticipant = user?.role === 'participant';

  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Set of event IDs the participant is actively enrolled in
  const [registeredEventIds, setRegisteredEventIds] = useState(new Set());
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedVenue, setSelectedVenue] = useState('');

  // Event Detail Modal State
  const [detailModalEvent, setDetailModalEvent] = useState(null);
  const [registeringEventId, setRegisteringEventId] = useState(null);
  const [registrationError, setRegistrationError] = useState(null);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('');

  // Fetch participant's existing active registrations
  const fetchMyActiveRegistrations = useCallback(async () => {
    if (!isParticipant) return;
    setLoadingRegistrations(true);
    try {
      const res = await registrationService.getMyRegistrations({ status: 'registered', limit: 100 });
      const activeIds = new Set();
      if (Array.isArray(res.data)) {
        res.data.forEach((reg) => {
          const eId = typeof reg.event === 'object' && reg.event ? reg.event._id || reg.event.id : reg.event;
          if (eId) activeIds.add(String(eId));
        });
      }
      setRegisteredEventIds(activeIds);
    } catch (err) {
      console.warn('Could not pre-load user registrations:', err);
    } finally {
      setLoadingRegistrations(false);
    }
  }, [isParticipant]);

  // Fetch published events for participants
  const fetchPublishedEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        limit: 100
      };
      if (search.trim()) params.search = search.trim();
      if (selectedCategory) params.category = selectedCategory;
      if (selectedVenue) params.venue = selectedVenue;

      // Backend authoritatively scopes participant responses to status: 'published'
      const res = await eventService.getEvents(params);
      setEvents(res.data || []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to discover campus events.'));
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, selectedVenue]);

  // Fetch available venues for venue filter
  const fetchVenuesList = useCallback(async () => {
    try {
      const res = await venueService.getVenues({ status: 'available', limit: 100 });
      setVenues(res.data || []);
    } catch (err) {
      console.warn('Could not load venues list:', err);
    }
  }, []);

  useEffect(() => {
    fetchVenuesList();
    fetchMyActiveRegistrations();
  }, [fetchVenuesList, fetchMyActiveRegistrations]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPublishedEvents();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchPublishedEvents]);

  const clearFilters = () => {
    setSearch('');
    setSelectedCategory('');
    setSelectedVenue('');
  };

  // Perform event registration
  const handleRegister = async (event, academicYear) => {
    if (!isParticipant) {
      setRegistrationError('Only participant accounts can register for campus events.');
      return;
    }
    if (!ACADEMIC_YEAR_OPTIONS.some((year) => year.value === academicYear)) {
      setRegistrationError('Select your current academic year before registering.');
      return;
    }

    const eligibleYears = Array.isArray(event.eligibleYears)
      ? event.eligibleYears
      : ACADEMIC_YEAR_OPTIONS.map((year) => year.value);
    if (!eligibleYears.includes(academicYear)) {
      setRegistrationError('Your current academic year is not eligible for this event.');
      return;
    }

    setRegisteringEventId(event.id);
    setRegistrationError(null);

    try {
      await registrationService.registerForEvent(event.id, academicYear);

      // Update local registered set
      setRegisteredEventIds((prev) => new Set([...prev, String(event.id)]));

      // Update local event registered count (+1)
      setEvents((prev) =>
        prev.map((e) =>
          e.id === event.id
            ? { ...e, registeredCount: (e.registeredCount || 0) + 1 }
            : e
        )
      );

      // Also update detail modal event if open
      if (detailModalEvent && detailModalEvent.id === event.id) {
        setDetailModalEvent((prev) => ({
          ...prev,
          registeredCount: (prev.registeredCount || 0) + 1
        }));
      }

      setActionSuccess(`Registered successfully for "${event.title}"!`);
    } catch (err) {
      const msg = extractErrorMessage(err, 'Registration failed. Please try again.');
      setRegistrationError(msg);
    } finally {
      setRegisteringEventId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Compass className="w-3.5 h-3.5" />
                Campus Event Directory
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Discover Campus Events
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Browse published conferences, hackathons, academic seminars, and reserve your seat.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Link
              to="/participant/registrations"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs transition-colors"
            >
              <Ticket className="w-4 h-4 text-emerald-400" />
              <span>My Registrations</span>
              {registeredEventIds.size > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
                  {registeredEventIds.size}
                </span>
              )}
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
          <div className="flex items-center gap-3">
            <Link
              to="/participant/registrations"
              className="underline font-bold text-emerald-900 hover:text-emerald-700"
            >
              View Ticket
            </Link>
            <button
              onClick={() => setActionSuccess(null)}
              className="text-emerald-500 hover:text-emerald-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by event title, keywords, or topics..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="w-full md:w-52">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 capitalize focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="">All Categories</option>
              {EVENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Venue Dropdown */}
          <div className="w-full md:w-56">
            <select
              value={selectedVenue}
              onChange={(e) => setSelectedVenue(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="">All Venues</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filters Display */}
        {(search || selectedCategory || selectedVenue) && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500 text-[11px]">Active discovery filters applied</span>
            <button
              onClick={clearFilters}
              className="text-emerald-700 hover:text-emerald-800 font-semibold text-[11px]"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchPublishedEvents}
            className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-semibold text-[11px]"
          >
            Retry
          </button>
        </div>
      )}

      {/* Events Grid */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-medium">Scanning campus schedule for events...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <Compass className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No published events found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            {search || selectedCategory || selectedVenue
              ? 'No scheduled events match your search criteria. Try adjusting your filters.'
              : 'There are currently no published events on the campus directory. Check back soon!'}
          </p>
          {(search || selectedCategory || selectedVenue) && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-xs"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => {
            const eventFeatures = getEventFeatureDetails(event);
            const assignedVenue = typeof event.venue === 'object' && event.venue && !Array.isArray(event.venue)
              ? event.venue
              : null;
            const venueName = assignedVenue?.name || 'Venue to be announced.';
            const venueLocation = assignedVenue?.location || '';
            const organizerName = typeof event.organizer === 'object' && event.organizer
              ? event.organizer.name
              : 'Campus Organization';

            const isRegistered = registeredEventIds.has(String(event.id));
            const isFull = isEventFull(event.capacity, event.registeredCount);
            const isStarted = isEventStarted(event.startDateTime);
            const isDeadlinePassed = isRegistrationDeadlinePassed(event.registrationDeadline);
            const seatsRemaining = Math.max(0, (event.capacity || 0) - (event.registeredCount || 0));

            return (
              <div
                key={event.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-emerald-300 transition-colors overflow-hidden group"
              >
                <div>
                  {/* Banner / Category Header */}
                  <div className="p-5 border-b border-slate-100">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {event.category}
                      </span>

                      {/* Status Badges */}
                      {isRegistered ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Enrolled</span>
                        </span>
                      ) : isStarted ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                          Started
                        </span>
                      ) : isDeadlinePassed ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          Closed
                        </span>
                      ) : isFull ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          Full
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                          <span>{seatsRemaining} seats left</span>
                        </span>
                      )}
                    </div>

                    <h3 className="font-extrabold text-slate-900 text-base leading-snug group-hover:text-emerald-700 transition-colors line-clamp-2">
                      {event.title}
                    </h3>

                    <p className="line-clamp-2 text-slate-500 text-[11px] leading-relaxed mt-2">
                      {event.description}
                    </p>
                  </div>

                  {/* Event Schedule & Location */}
                  <div className="p-5 space-y-4 text-xs text-slate-600">
                    {/* Event schedule and venue */}
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Calendar className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 break-words">{formatDate(event.startDateTime)}</p>
                          <p className="mt-1 flex items-start gap-2 text-slate-500">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                            <span className="break-words">
                              {formatTime(event.startDateTime)} – {formatTime(event.endDateTime)}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 border-t border-slate-100 pt-3">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 break-words">{venueName}</p>
                          {venueLocation && (
                            <p className="mt-0.5 text-slate-500 break-words">{venueLocation}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Attendance and event benefits */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                      <div className="lg:col-span-2 flex items-center justify-between gap-3 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                        <span className="flex min-w-0 items-center gap-2 text-slate-600">
                          <Users className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                          <span className="font-medium">Registered attendees</span>
                        </span>
                        <span className="shrink-0 font-bold text-slate-900 tabular-nums">
                          {event.registeredCount ?? 0} / {event.capacity ?? 0}
                        </span>
                      </div>

                      <div className="flex min-w-0 items-start gap-2 rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2.5">
                        <GraduationCap className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-700 break-words">AICTE Points</p>
                          <p className="mt-1 text-[11px] font-medium text-slate-600">
                            {eventFeatures.aictePointsAvailable ? 'Provided' : 'Not Provided'}
                          </p>
                        </div>
                      </div>

                      <div className="flex min-w-0 items-start gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                        <ClipboardCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-700 break-words">Attendance</p>
                          <p className="mt-1 text-[11px] font-medium text-slate-600">
                            {eventFeatures.attendanceProvided ? 'Provided' : 'Not Provided'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Eligible student years */}
                    <div className="border-t border-slate-100 pt-3">
                      <h4 className="mb-2 font-semibold text-slate-700">Eligible Years</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {eventFeatures.eligibleYears.length === 4 ? (
                          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                            All Years
                          </span>
                        ) : eventFeatures.eligibleYears.map((year) => (
                          <span
                            key={year}
                            className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-700"
                          >
                            {year.charAt(0).toUpperCase() + year.slice(1)} Year
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setRegistrationError(null);
                      setSelectedAcademicYear('');
                      setDetailModalEvent(event);
                    }}
                    className="inline-flex items-center justify-center flex-1 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs shadow-2xs transition-colors"
                  >
                    <span>Details</span>
                  </button>

                  {isRegistered ? (
                    <Link
                      to="/participant/registrations"
                      className="inline-flex items-center justify-center gap-1.5 flex-1 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-semibold text-xs transition-colors"
                    >
                      <Ticket className="w-3.5 h-3.5" />
                      <span>My Pass</span>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled={!isParticipant || isStarted || isDeadlinePassed || isFull || registeringEventId === event.id}
                      onClick={() => {
                        setRegistrationError(null);
                        setSelectedAcademicYear('');
                        setDetailModalEvent(event);
                      }}
                      className={`inline-flex items-center justify-center gap-1.5 flex-1 px-3 py-2 rounded-xl font-semibold text-xs transition-colors shadow-2xs ${
                        !isParticipant || isStarted || isDeadlinePassed || isFull
                          ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed select-none'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      {registeringEventId === event.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Ticket className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {isStarted
                          ? 'Started'
                          : isDeadlinePassed
                          ? 'Closed'
                          : isFull
                          ? 'Sold Out'
                          : 'Register'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* EVENT DETAIL & REGISTRATION MODAL */}
      {detailModalEvent && (() => {
        const eventFeatures = getEventFeatureDetails(detailModalEvent);
        const eventContacts = getEventContacts(detailModalEvent);
        const officialLinks = getOfficialEventLinks(detailModalEvent);
        const isRegistered = registeredEventIds.has(String(detailModalEvent.id));
        const isFull = isEventFull(detailModalEvent.capacity, detailModalEvent.registeredCount);
        const isStarted = isEventStarted(detailModalEvent.startDateTime);
        const isDeadlinePassed = isRegistrationDeadlinePassed(detailModalEvent.registrationDeadline);
        const seatsRemaining = Math.max(0, (detailModalEvent.capacity || 0) - (detailModalEvent.registeredCount || 0));
        const eligibleYears = Array.isArray(detailModalEvent.eligibleYears)
          ? detailModalEvent.eligibleYears
          : ACADEMIC_YEAR_OPTIONS.map((year) => year.value);
        const academicYearEligible = eligibleYears.includes(selectedAcademicYear);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {detailModalEvent.category}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Published Event</span>
                    </span>
                  </div>
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    {detailModalEvent.title}
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setDetailModalEvent(null);
                    setRegistrationError(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6 text-xs text-slate-600 max-h-[70vh] overflow-y-auto">
                {/* Registration Error inside Modal */}
                {registrationError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{registrationError}</span>
                  </div>
                )}

                {/* Status Notice */}
                {isRegistered ? (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-medium">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>You have an active registration for this event!</span>
                    </div>
                    <Link
                      to="/participant/registrations"
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs shadow-2xs hover:bg-emerald-700"
                    >
                      View Ticket
                    </Link>
                  </div>
                ) : !isParticipant ? (
                  <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center gap-2">
                    <Info className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>Logged in as <strong>{user?.role || 'Guest'}</strong>. Event self-registration is restricted to participant accounts.</span>
                  </div>
                ) : isStarted ? (
                  <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>This event has already started or concluded. Registrations are closed.</span>
                  </div>
                ) : isDeadlinePassed ? (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>The registration deadline for this event has expired.</span>
                  </div>
                ) : isFull ? (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>All seats for this event have been reserved. Registration is full.</span>
                  </div>
                ) : null}

                {/* Description */}
                <div>
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-1.5">
                    About This Event
                  </h4>
                  <p className="text-slate-600 text-xs leading-relaxed whitespace-pre-line">
                    {detailModalEvent.description}
                  </p>
                </div>

                {/* Schedule Details */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <span>Date & Schedule</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Starts</span>
                      <span className="font-semibold text-slate-800">
                        {formatDate(detailModalEvent.startDateTime)} at {formatTime(detailModalEvent.startDateTime)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Ends</span>
                      <span className="font-semibold text-slate-800">
                        {formatDate(detailModalEvent.endDateTime)} at {formatTime(detailModalEvent.endDateTime)}
                      </span>
                    </div>
                  </div>
                  {detailModalEvent.registrationDeadline && (
                    <div className="pt-2 border-t border-slate-200/60 text-[11px] text-amber-700">
                      Registration Deadline: <strong>{formatDate(detailModalEvent.registrationDeadline)} at {formatTime(detailModalEvent.registrationDeadline)}</strong>
                    </div>
                  )}
                </div>

                {/* Venue Specifications */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    <span>Venue Location</span>
                  </h4>
                  {typeof detailModalEvent.venue === 'object' && detailModalEvent.venue ? (
                    <div className="space-y-2 pt-1 text-xs">
                      <div>
                        <div className="font-bold text-slate-800 text-sm">
                          {detailModalEvent.venue.name || 'Venue to be announced.'}
                        </div>
                        {detailModalEvent.venue.location && (
                          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            <span>{detailModalEvent.venue.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-xs">Venue to be announced.</p>
                  )}
                </div>

                {/* Organizer Information */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <User className="w-4 h-4 text-emerald-600" />
                    <span>Host & Organizer</span>
                  </h4>
                  {typeof detailModalEvent.organizer === 'object' && detailModalEvent.organizer ? (
                    <div className="text-xs space-y-1">
                      <div className="font-semibold text-slate-800">{detailModalEvent.organizer.name}</div>
                      {detailModalEvent.organizer.organization && (
                        <div className="text-[11px] text-slate-500">Dept/Club: {detailModalEvent.organizer.organization}</div>
                      )}
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span>{detailModalEvent.organizer.email}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-xs">EventFlow Campus Coordination Team</p>
                  )}
                </div>

                {eventContacts.length > 0 && (
                  <section className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                    <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <User className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                      <span>Contact &amp; Support</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {eventContacts.map((contact, index) => (
                        <div
                          key={`${contact.email}-${index}`}
                          className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 space-y-2"
                        >
                          <div>
                            <p className="font-semibold text-slate-800 break-words">{contact.name}</p>
                            {contact.role && (
                              <p className="mt-0.5 text-[11px] text-slate-500 break-words">{contact.role}</p>
                            )}
                          </div>
                          <a
                            href={`mailto:${contact.email}`}
                            aria-label={`Email ${contact.name}`}
                            className="flex min-w-0 items-start gap-2 text-[11px] text-indigo-700 hover:text-indigo-900 hover:underline"
                          >
                            <Mail className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                            <span className="break-all">{contact.email}</span>
                          </a>
                          {contact.phone && (
                            <a
                              href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}
                              aria-label={`Call ${contact.name}`}
                              className="flex min-w-0 items-start gap-2 text-[11px] text-indigo-700 hover:text-indigo-900 hover:underline"
                            >
                              <Phone className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                              <span className="break-words">{contact.phone}</span>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {officialLinks.length > 0 && (
                  <section className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                    <h4 className="font-bold text-slate-900 text-xs">Official Links</h4>
                    <div className="flex flex-wrap gap-2">
                      {officialLinks.map((link) => {
                        const Icon = link.type === 'instagram' ? Instagram : Globe;
                        return (
                          <a
                            key={link.type}
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open official ${link.label} (opens in a new tab)`}
                            className="inline-flex max-w-full items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                          >
                            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span>{link.label}</span>
                          </a>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Student Benefits & Eligibility */}
                <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-2">
                  <h4 className="font-bold text-slate-900 text-xs">Student Benefits & Eligibility</h4>
                  <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <dt className="text-slate-500">AICTE points</dt>
                      <dd className="font-semibold text-slate-800">
                        {eventFeatures.aictePointsAvailable ? 'Yes' : 'No'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Attendance provided</dt>
                      <dd className="font-semibold text-slate-800">
                        {eventFeatures.attendanceProvided ? 'Yes' : 'No'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Eligible years</dt>
                      <dd className="font-semibold text-slate-800">{eventFeatures.eligibleYearsLabel}</dd>
                    </div>
                  </dl>
                </div>

                {/* Tags */}
                {Array.isArray(detailModalEvent.tags) && detailModalEvent.tags.length > 0 && (
                  <div>
                    <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-1.5">
                      Topic Tags
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {detailModalEvent.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium"
                        >
                          <Tag className="w-3 h-3 text-slate-400" />
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer / Registration Action */}
              <div className="flex flex-col gap-4 border-t border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="text-[11px] text-slate-500">
                  Capacity: <strong className="text-slate-800">{detailModalEvent.registeredCount || 0}</strong> / {detailModalEvent.capacity} booked ({seatsRemaining} left)
                </div>

                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
                  {!isRegistered && isParticipant && !isStarted && !isDeadlinePassed && !isFull && (
                    <div className="min-w-0 flex-1 sm:w-48 sm:flex-none">
                      <label
                        htmlFor="participant-academic-year"
                        className="mb-1 block text-[11px] font-semibold text-slate-700"
                      >
                        Current Academic Year
                      </label>
                      <select
                        id="participant-academic-year"
                        required
                        value={selectedAcademicYear}
                        onChange={(changeEvent) => {
                          setSelectedAcademicYear(changeEvent.target.value);
                          setRegistrationError(null);
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      >
                        <option value="" disabled>Select your year</option>
                        {ACADEMIC_YEAR_OPTIONS.map((year) => (
                          <option key={year.value} value={year.value}>{year.label}</option>
                        ))}
                      </select>
                      {selectedAcademicYear && !academicYearEligible && (
                        <p role="alert" className="mt-1 max-w-48 text-[11px] text-rose-700">
                          Your year is not eligible for this event.
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDetailModalEvent(null);
                      setRegistrationError(null);
                    }}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-100"
                  >
                    Close
                  </button>

                  {isRegistered ? (
                    <Link
                      to="/participant/registrations"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs"
                    >
                      <Ticket className="w-3.5 h-3.5" />
                      <span>View in Registrations</span>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled={!isParticipant || isStarted || isDeadlinePassed || isFull || !selectedAcademicYear || !academicYearEligible || registeringEventId === detailModalEvent.id}
                      onClick={() => handleRegister(detailModalEvent, selectedAcademicYear)}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-xs shadow-xs transition-colors ${
                        !isParticipant || isStarted || isDeadlinePassed || isFull || !selectedAcademicYear || !academicYearEligible
                          ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed select-none'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      {registeringEventId === detailModalEvent.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Ticket className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {isStarted
                          ? 'Event Started'
                          : isDeadlinePassed
                          ? 'Deadline Passed'
                          : isFull
                          ? 'Capacity Full'
                          : 'Confirm Registration'}
                      </span>
                    </button>
                  )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
