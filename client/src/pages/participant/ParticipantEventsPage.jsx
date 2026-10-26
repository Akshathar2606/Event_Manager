import React, { useState, useEffect, useCallback } from 'react';
import {
  eventService,
  EVENT_CATEGORIES,
  extractErrorMessage
} from '../../services/eventService';
import { venueService } from '../../services/venueService';
import {
  Compass,
  Search,
  Filter,
  Calendar,
  Clock,
  MapPin,
  Users,
  Tag,
  Building2,
  Mail,
  User,
  Ticket,
  Loader2,
  AlertCircle,
  X,
  Sparkles,
  CheckCircle2,
  DollarSign
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
  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedVenue, setSelectedVenue] = useState('');

  // Event Detail Modal State
  const [detailModalEvent, setDetailModalEvent] = useState(null);

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
  }, [fetchVenuesList]);

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
              Browse published conferences, hackathons, academic seminars, and cultural festivals.
            </p>
          </div>

          <div className="text-xs text-slate-500 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 shrink-0">
            <div>Available Events: <span className="font-bold text-slate-800">{events.length}</span></div>
            <div>Directory Status: <span className="font-bold text-emerald-600">Active Campus Feed</span></div>
          </div>
        </div>
      </div>

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
            const venueName = typeof event.venue === 'object' && event.venue
              ? event.venue.name
              : 'Campus Venue';
            const venueLocation = typeof event.venue === 'object' && event.venue
              ? event.venue.location
              : 'TBA';
            const organizerName = typeof event.organizer === 'object' && event.organizer
              ? event.organizer.name
              : 'Campus Organization';

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
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>Cap: {event.capacity}</span>
                      </span>
                    </div>

                    <h3 className="font-extrabold text-slate-900 text-base leading-snug group-hover:text-emerald-700 transition-colors line-clamp-2">
                      {event.title}
                    </h3>

                    <p className="line-clamp-2 text-slate-500 text-[11px] leading-relaxed mt-2">
                      {event.description}
                    </p>
                  </div>

                  {/* Event Schedule & Location */}
                  <div className="p-5 space-y-2.5 text-xs text-slate-600">
                    {/* Date */}
                    <div className="flex items-center gap-2 text-slate-700 font-medium">
                      <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{formatDate(event.startDateTime)}</span>
                    </div>

                    {/* Time */}
                    <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{formatTime(event.startDateTime)} – {formatTime(event.endDateTime)}</span>
                    </div>

                    {/* Venue */}
                    <div className="flex items-start gap-2 text-slate-600 text-[11px] pt-1 border-t border-slate-100">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-slate-800">{venueName}</span>
                        <span className="text-slate-400 block">{venueLocation}</span>
                      </div>
                    </div>

                    {/* Organizer attribution */}
                    <div className="text-[11px] text-slate-400 pt-1">
                      Organized by: <span className="font-medium text-slate-700">{organizerName}</span>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => setDetailModalEvent(event)}
                    className="inline-flex items-center justify-between w-full px-4 py-2 rounded-xl bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 text-emerald-700 font-semibold text-xs shadow-2xs transition-colors"
                  >
                    <span>View Event Details</span>
                    <Compass className="w-3.5 h-3.5 ml-1" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* EVENT DETAIL MODAL */}
      {detailModalEvent && (
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
                    <span>Confirmed Event</span>
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  {detailModalEvent.title}
                </h2>
              </div>
              <button
                onClick={() => setDetailModalEvent(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 text-xs text-slate-600 max-h-[70vh] overflow-y-auto">
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
                    Registration Closes: <strong>{formatDate(detailModalEvent.registrationDeadline)} at {formatTime(detailModalEvent.registrationDeadline)}</strong>
                  </div>
                )}
              </div>

              {/* Venue Specifications */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  <span>Venue Specifications</span>
                </h4>
                {typeof detailModalEvent.venue === 'object' && detailModalEvent.venue ? (
                  <div className="space-y-2 pt-1 text-xs">
                    <div>
                      <div className="font-bold text-slate-800 text-sm">{detailModalEvent.venue.name}</div>
                      <div className="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{detailModalEvent.venue.location}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1">
                      <span>Venue Capacity: <strong className="text-slate-800">{detailModalEvent.venue.capacity}</strong> attendees</span>
                      {detailModalEvent.venue.facilities?.length > 0 && (
                        <span>Facilities: {detailModalEvent.venue.facilities.join(', ')}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500 text-xs">Campus Location pending coordinator confirmation.</p>
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
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <div className="text-[11px] text-slate-500">
                Seat Limit: <strong className="text-slate-800">{detailModalEvent.capacity}</strong> spots
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDetailModalEvent(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-100"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 text-slate-400 font-semibold text-xs border border-slate-200 cursor-not-allowed select-none"
                >
                  <Ticket className="w-3.5 h-3.5" />
                  <span>Registration Available Soon</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
