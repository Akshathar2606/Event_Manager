import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { venueService, extractErrorMessage } from '../../services/venueService';
import RequestBookingModal from '../../components/bookings/RequestBookingModal';
import {
  Building2,
  Search,
  Filter,
  Users,
  DollarSign,
  Tag,
  Loader2,
  X,
  MapPin,
  CheckCircle2,
  Info,
  Calendar,
  CalendarCheck,
  Sparkles,
  ArrowRight
} from 'lucide-react';

const COMMON_FACILITIES = [
  'Projector',
  'Sound System',
  'Air Conditioning',
  'High-Speed Wi-Fi',
  'Whiteboard',
  'Stage & Podium',
  'Video Conferencing',
  'Tiered Seating'
];

export default function OrganizerVenuesPage() {
  const [venues, setVenues] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1, limit: 12 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [minCapacity, setMinCapacity] = useState('');
  const [selectedFacilities, setSelectedFacilities] = useState([]);

  // Detail Modal State
  const [selectedVenue, setSelectedVenue] = useState(null);

  // Request Booking Modal State
  const [bookingVenue, setBookingVenue] = useState(null);

  // Fetch available venues for organizers
  const fetchVenues = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit: 12,
        status: 'available' // Organizers browse available facilities
      };
      if (search.trim()) params.search = search.trim();
      if (minCapacity && !isNaN(Number(minCapacity))) params.minCapacity = Number(minCapacity);
      if (selectedFacilities.length > 0) params.facilities = selectedFacilities.join(',');

      const res = await venueService.getVenues(params);
      setVenues(res.data || []);
      setPagination(res.pagination || { total: 0, page: 1, pages: 1, limit: 12 });
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to discover campus venues.'));
    } finally {
      setLoading(false);
    }
  }, [search, minCapacity, selectedFacilities]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchVenues(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchVenues]);

  // Toggle facility filter chip
  const toggleFacilityFilter = (facility) => {
    setSelectedFacilities((prev) =>
      prev.includes(facility) ? prev.filter((f) => f !== facility) : [...prev, facility]
    );
  };

  const clearAllFilters = () => {
    setSearch('');
    setMinCapacity('');
    setSelectedFacilities([]);
  };

  const handleBookingSuccess = (createdBooking) => {
    setBookingVenue(null);
    setBookingSuccessMsg(
      'Venue booking request submitted successfully! Your request is currently pending administrator review.'
    );
    setTimeout(() => {
      setBookingSuccessMsg(null);
    }, 8000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-surface rounded-2xl border border-border p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Building2 className="w-3.5 h-3.5" />
                Venue Discovery
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">
              Explore Campus Venues
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              Browse auditoriums, lecture theaters, and lab spaces available for your events
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/organizer/bookings"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors shadow-2xs"
            >
              <CalendarCheck className="w-4 h-4 text-indigo-600" />
              <span>My Booking Requests</span>
            </Link>

            <div className="text-xs text-text-muted bg-background px-3.5 py-2 rounded-xl border border-border">
              <span>Available: </span>
              <span className="font-bold text-text-primary">{pagination.total}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Success Alert */}
      {bookingSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between text-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{bookingSuccessMsg}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/organizer/bookings"
              className="text-xs font-bold text-emerald-700 underline hover:text-emerald-900"
            >
              View in My Bookings
            </Link>
            <button
              type="button"
              onClick={() => setBookingSuccessMsg(null)}
              className="text-emerald-500 hover:text-emerald-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between text-sm animate-fadeIn">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Toolbar */}
      <div className="bg-surface rounded-2xl border border-border p-5 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search Input */}
          <div className="sm:col-span-2 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by venue name or location (e.g. Science Block)..."
              className="block w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border bg-surface placeholder:text-text-muted focus:outline-hidden focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600"
            />
          </div>

          {/* Min Capacity Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
              <Users className="w-4 h-4" />
            </div>
            <input
              type="number"
              min="1"
              value={minCapacity}
              onChange={(e) => setMinCapacity(e.target.value)}
              placeholder="Min Attendees..."
              className="block w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border bg-surface placeholder:text-text-muted focus:outline-hidden focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600"
            />
          </div>
        </div>

        {/* Facilities Filter Chips */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-text-muted" />
              Filter by Facilities
            </span>
            {(selectedFacilities.length > 0 || search || minCapacity) && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_FACILITIES.map((facility) => {
              const active = selectedFacilities.includes(facility);
              return (
                <button
                  key={facility}
                  type="button"
                  onClick={() => toggleFacilityFilter(facility)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    active
                      ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-200'
                      : 'bg-background text-text-secondary border border-border hover:bg-surface-subtle'
                  }`}
                >
                  <Tag className="w-3 h-3" />
                  <span>{facility}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Venues Grid */}
      {loading ? (
        <div className="bg-surface rounded-2xl border border-border p-12 text-center shadow-xs">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-xs text-text-muted font-medium">Loading campus venues...</p>
        </div>
      ) : venues.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border p-12 text-center shadow-xs">
          <Building2 className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <h3 className="text-base font-bold text-text-primary">No available venues found</h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto mt-1 mb-4">
            Try adjusting your search query, minimum capacity, or facility filters.
          </p>
          <button
            type="button"
            onClick={clearAllFilters}
            className="px-4 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {venues.map((venue) => (
            <div
              key={venue.id || venue._id}
              className="bg-surface rounded-2xl border border-border shadow-xs p-5 flex flex-col justify-between hover:border-indigo-300 transition-colors"
            >
              <div>
                {/* Header: Name & Status */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-extrabold text-text-primary text-base leading-snug">
                    {venue.name}
                  </h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    Available
                  </span>
                </div>

                {/* Location */}
                <div className="flex items-center gap-1.5 text-xs text-text-muted mb-3">
                  <MapPin className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  <span>{venue.location}</span>
                </div>

                {/* Description */}
                {venue.description && (
                  <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed mb-4">
                    {venue.description}
                  </p>
                )}

                {/* Key Specs: Capacity & Rate */}
                <div className="grid grid-cols-2 gap-2 py-2.5 px-3 bg-background rounded-xl mb-4 text-xs">
                  <div>
                    <span className="text-text-muted block text-[10px] uppercase font-semibold">Capacity</span>
                    <span className="font-bold text-text-primary">{venue.capacity.toLocaleString()} seats</span>
                  </div>
                  <div>
                    <span className="text-text-muted block text-[10px] uppercase font-semibold">Hourly Rate</span>
                    <span className="font-bold text-text-primary">
                      {venue.hourlyRate > 0 ? `$${venue.hourlyRate}/hr` : 'Free / Included'}
                    </span>
                  </div>
                </div>

                {/* Facilities Tags */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {(venue.facilities || []).slice(0, 3).map((f) => (
                    <span
                      key={f}
                      className="inline-block px-2 py-0.5 rounded-md bg-surface-subtle text-text-secondary text-[11px]"
                    >
                      {f}
                    </span>
                  ))}
                  {(venue.facilities || []).length > 3 && (
                    <span className="inline-block px-1.5 py-0.5 rounded-md bg-background text-text-muted text-[10px] font-medium">
                      +{venue.facilities.length - 3} more
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons: Details & Request Booking */}
              <div className="pt-4 border-t border-border flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedVenue(venue)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-text-secondary bg-surface-subtle hover:bg-surface-muted transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>Details</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBookingVenue(venue)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-colors"
                >
                  <CalendarCheck className="w-3.5 h-3.5" />
                  <span>Request Booking</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Venue Detail Modal */}
      {selectedVenue && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-overlay/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-border shadow-xl max-w-lg w-full p-6 sm:p-8 animate-fadeIn">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-border">
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-1.5">
                  Available for Booking
                </span>
                <h3 className="font-extrabold text-xl text-text-primary">{selectedVenue.name}</h3>
                <div className="flex items-center gap-1.5 text-xs text-text-muted mt-1">
                  <MapPin className="w-3.5 h-3.5 text-text-muted" />
                  <span>{selectedVenue.location}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVenue(null)}
                className="text-text-muted hover:text-text-secondary p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="py-5 space-y-4 text-sm text-text-secondary">
              {/* Description */}
              {selectedVenue.description && (
                <div>
                  <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">
                    Description & Acoustics
                  </h4>
                  <p className="text-xs text-text-secondary leading-relaxed bg-background p-3 rounded-xl border border-border">
                    {selectedVenue.description}
                  </p>
                </div>
              )}

              {/* Quick Specs */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                  <span className="text-[10px] uppercase font-bold text-indigo-700 block">Total Seating</span>
                  <span className="text-base font-extrabold text-text-primary">
                    {selectedVenue.capacity.toLocaleString()} Attendees
                  </span>
                </div>
                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                  <span className="text-[10px] uppercase font-bold text-indigo-700 block">Hourly Rate</span>
                  <span className="text-base font-extrabold text-text-primary">
                    {selectedVenue.hourlyRate > 0 ? `$${selectedVenue.hourlyRate}/hour` : 'No Charge'}
                  </span>
                </div>
              </div>

              {/* Full Facilities List */}
              <div>
                <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                  Installed Facilities & Equipment
                </h4>
                {selectedVenue.facilities && selectedVenue.facilities.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedVenue.facilities.map((f) => (
                      <span
                        key={f}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-subtle text-text-primary text-xs font-medium"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                        {f}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted italic">No special facilities listed.</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedVenue(null)}
                className="px-4 py-2 text-sm font-semibold text-text-secondary bg-surface-subtle hover:bg-surface-muted rounded-xl transition-colors"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => {
                  const target = selectedVenue;
                  setSelectedVenue(null);
                  setBookingVenue(target);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors"
              >
                <CalendarCheck className="w-4 h-4" />
                <span>Request Booking</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reusable Request Booking Modal */}
      {bookingVenue && (
        <RequestBookingModal
          venue={bookingVenue}
          isOpen={!!bookingVenue}
          onClose={() => setBookingVenue(null)}
          onSuccess={handleBookingSuccess}
        />
      )}
    </div>
  );
}
