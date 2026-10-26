import React, { useState, useEffect, useCallback } from 'react';
import { venueService, extractErrorMessage } from '../../services/venueService';
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
  Sparkles
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

  // Filters
  const [search, setSearch] = useState('');
  const [minCapacity, setMinCapacity] = useState('');
  const [selectedFacilities, setSelectedFacilities] = useState([]);

  // Detail Modal State
  const [selectedVenue, setSelectedVenue] = useState(null);

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

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Building2 className="w-3.5 h-3.5" />
                Venue Discovery
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Explore Campus Venues
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Browse auditoriums, lecture theaters, and lab spaces available for your events
            </p>
          </div>

          <div className="text-xs text-slate-400 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 shrink-0">
            <span>Available Venues: </span>
            <span className="font-bold text-slate-800">{pagination.total}</span>
          </div>
        </div>
      </div>

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
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search Input */}
          <div className="sm:col-span-2 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by venue name or location (e.g. Science Block)..."
              className="block w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600"
            />
          </div>

          {/* Min Capacity Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Users className="w-4 h-4" />
            </div>
            <input
              type="number"
              min="1"
              value={minCapacity}
              onChange={(e) => setMinCapacity(e.target.value)}
              placeholder="Min. attendees (e.g. 100)"
              className="block w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600"
            />
          </div>
        </div>

        {/* Facility Chips Bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Filter by Facilities
            </span>
            {(search || minCapacity || selectedFacilities.length > 0) && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Reset Filters
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_FACILITIES.map((facility) => {
              const isSelected = selectedFacilities.includes(facility);
              return (
                <button
                  key={facility}
                  type="button"
                  onClick={() => toggleFacilityFilter(facility)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {isSelected ? '✓ ' : ''}
                  {facility}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Venues Grid */}
      {loading ? (
        <div className="py-20 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
          <p className="text-sm font-medium">Discovering campus venues...</p>
        </div>
      ) : venues.length === 0 ? (
        <div className="py-20 px-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-slate-800 text-base">No matching venues found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search keywords, capacity requirements, or selected facilities.
          </p>
          {(search || minCapacity || selectedFacilities.length > 0) && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="mt-4 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {venues.map((venue) => (
            <div
              key={venue.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-bold text-slate-900 text-lg leading-snug group-hover:text-indigo-600 transition-colors">
                    {venue.name}
                  </h3>
                  <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                    Available
                  </span>
                </div>

                {/* Location */}
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{venue.location}</span>
                </div>

                {/* Description */}
                {venue.description && (
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-4">
                    {venue.description}
                  </p>
                )}

                {/* Key Specs: Capacity & Rate */}
                <div className="grid grid-cols-2 gap-2 py-2.5 px-3 bg-slate-50 rounded-xl mb-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Capacity</span>
                    <span className="font-bold text-slate-800">{venue.capacity.toLocaleString()} seats</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Hourly Rate</span>
                    <span className="font-bold text-slate-800">
                      {venue.hourlyRate > 0 ? `$${venue.hourlyRate}/hr` : 'Free / Included'}
                    </span>
                  </div>
                </div>

                {/* Facilities Tags */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {(venue.facilities || []).slice(0, 3).map((f) => (
                    <span
                      key={f}
                      className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px]"
                    >
                      {f}
                    </span>
                  ))}
                  {(venue.facilities || []).length > 3 && (
                    <span className="inline-block px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-400 text-[10px] font-medium">
                      +{venue.facilities.length - 3} more
                    </span>
                  )}
                </div>
              </div>

              {/* Action Button: View Details */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Campus Facility</span>
                <button
                  type="button"
                  onClick={() => setSelectedVenue(venue)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>View Details</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Venue Detail Modal */}
      {selectedVenue && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 sm:p-8 animate-fadeIn">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-1.5">
                  Available for Booking
                </span>
                <h3 className="font-extrabold text-xl text-slate-900">{selectedVenue.name}</h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedVenue.location}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVenue(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="py-5 space-y-4 text-sm text-slate-600">
              {/* Description */}
              {selectedVenue.description && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Description & Acoustics
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {selectedVenue.description}
                  </p>
                </div>
              )}

              {/* Quick Specs */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                  <span className="text-[10px] uppercase font-bold text-indigo-700 block">Total Seating</span>
                  <span className="text-base font-extrabold text-slate-900">
                    {selectedVenue.capacity.toLocaleString()} Attendees
                  </span>
                </div>
                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                  <span className="text-[10px] uppercase font-bold text-indigo-700 block">Hourly Rate</span>
                  <span className="text-base font-extrabold text-slate-900">
                    {selectedVenue.hourlyRate > 0 ? `$${selectedVenue.hourlyRate}/hour` : 'No Charge'}
                  </span>
                </div>
              </div>

              {/* Full Facilities List */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Installed Facilities & Equipment
                </h4>
                {selectedVenue.facilities && selectedVenue.facilities.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedVenue.facilities.map((f) => (
                      <span
                        key={f}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-medium"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                        {f}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No special facilities listed.</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Booking requests open in Day 6 Phase
              </span>
              <button
                type="button"
                onClick={() => setSelectedVenue(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
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
