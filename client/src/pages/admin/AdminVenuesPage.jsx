import React, { useState, useEffect, useCallback } from 'react';
import { venueService, extractErrorMessage } from '../../services/venueService';
import {
  Building2,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  X,
  Users,
  DollarSign,
  Tag,
  RefreshCw,
  Power
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

export default function AdminVenuesPage() {
  const [venues, setVenues] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [facilityFilter, setFacilityFilter] = useState('');

  // Action status loading tracker
  const [actionLoading, setActionLoading] = useState(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [activeVenue, setActiveVenue] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    capacity: '',
    hourlyRate: '0',
    status: 'available',
    facilities: []
  });
  const [customFacility, setCustomFacility] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Archive confirmation dialog state
  const [archiveTarget, setArchiveTarget] = useState(null);

  // Fetch venues from backend API
  const fetchVenues = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit: 10,
        includeArchived: 'false' // Do not show deleted/archived venues by default
      };
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (facilityFilter) params.facilities = facilityFilter;

      const res = await venueService.getVenues(params);
      setVenues(res.data || []);
      setPagination(res.pagination || { total: 0, page: 1, pages: 1, limit: 10 });
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load campus venues.'));
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, facilityFilter]);

  // Initial fetch and on filter trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchVenues(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchVenues]);

  // Notification helper
  const notifySuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Open Create Modal
  const openCreateModal = () => {
    setModalMode('create');
    setActiveVenue(null);
    setFormData({
      name: '',
      description: '',
      location: '',
      capacity: '',
      hourlyRate: '0',
      status: 'available',
      facilities: []
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (venue) => {
    setModalMode('edit');
    setActiveVenue(venue);
    setFormData({
      name: venue.name || '',
      description: venue.description || '',
      location: venue.location || '',
      capacity: String(venue.capacity || ''),
      hourlyRate: String(venue.hourlyRate ?? 0),
      status: venue.status || 'available',
      facilities: venue.facilities || []
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Facility tags toggle
  const toggleFacility = (facility) => {
    setFormData((prev) => {
      const exists = prev.facilities.includes(facility);
      return {
        ...prev,
        facilities: exists
          ? prev.facilities.filter((f) => f !== facility)
          : [...prev.facilities, facility]
      };
    });
  };

  const addCustomFacility = (e) => {
    e.preventDefault();
    if (customFacility.trim() && !formData.facilities.includes(customFacility.trim())) {
      setFormData((prev) => ({
        ...prev,
        facilities: [...prev.facilities, customFacility.trim()]
      }));
      setCustomFacility('');
    }
  };

  // Validate form before submission
  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      errors.name = 'Venue name is required (min 2 characters).';
    }
    if (!formData.location.trim() || formData.location.trim().length < 2) {
      errors.location = 'Location is required (e.g. Science Wing, Hall 204).';
    }
    const cap = Number(formData.capacity);
    if (!formData.capacity || isNaN(cap) || !Number.isInteger(cap) || cap < 1) {
      errors.capacity = 'Capacity must be a positive whole number greater than 0.';
    }
    const rate = Number(formData.hourlyRate);
    if (formData.hourlyRate !== '' && (isNaN(rate) || rate < 0)) {
      errors.hourlyRate = 'Hourly rate must be a non-negative number.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle Create / Edit Submit
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setFormSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        location: formData.location.trim(),
        capacity: Number(formData.capacity),
        hourlyRate: Number(formData.hourlyRate || 0),
        status: formData.status,
        facilities: formData.facilities
      };

      if (modalMode === 'create') {
        const res = await venueService.createVenue(payload);
        notifySuccess(`Venue "${res.data.name}" created successfully.`);
      } else {
        const res = await venueService.updateVenue(activeVenue.id, payload);
        notifySuccess(`Venue "${res.data.name}" updated successfully.`);
      }

      setIsModalOpen(false);
      fetchVenues(pagination.page);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to save venue details.'));
    } finally {
      setFormSubmitting(false);
    }
  };

  // Toggle status between available and maintenance
  const handleStatusToggle = async (venue) => {
    const newStatus = venue.status === 'available' ? 'maintenance' : 'available';
    setActionLoading(venue.id);
    try {
      await venueService.updateVenueStatus(venue.id, newStatus);
      notifySuccess(`Status of "${venue.name}" updated to ${newStatus}.`);
      setVenues((prev) =>
        prev.map((v) => (v.id === venue.id ? { ...v, status: newStatus } : v))
      );
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to update venue status.'));
    } finally {
      setActionLoading(null);
    }
  };

  // Confirm and Archive Venue
  const handleArchiveConfirm = async () => {
    if (!archiveTarget) return;
    setActionLoading(archiveTarget.id);
    try {
      await venueService.archiveVenue(archiveTarget.id);
      notifySuccess(`Venue "${archiveTarget.name}" archived successfully.`);
      setArchiveTarget(null);
      fetchVenues(pagination.page);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to archive venue.'));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                <Building2 className="w-3.5 h-3.5" />
                Administrative Facility Control
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Campus Venues Management
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Register, update, and manage institutional venues, auditoriums, and seminar halls
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-xs shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Venue</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 text-sm animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between gap-3 text-sm animate-fadeIn">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-500 hover:text-rose-700 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="sm:col-span-2 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by venue name or location..."
              className="block w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-full py-2 px-3 text-sm rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600"
            >
              <option value="">All Statuses</option>
              <option value="available">Available Only</option>
              <option value="maintenance">Maintenance Only</option>
            </select>
          </div>

          {/* Facility Filter */}
          <div>
            <select
              value={facilityFilter}
              onChange={(e) => setFacilityFilter(e.target.value)}
              className="block w-full py-2 px-3 text-sm rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600"
            >
              <option value="">All Facilities</option>
              {COMMON_FACILITIES.map((f) => (
                <option key={f} value={f}>
                  Has {f}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Venues Table / Grid */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
            <p className="text-sm">Loading campus venues...</p>
          </div>
        ) : venues.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-slate-800 text-base">No venues found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {search || statusFilter || facilityFilter
                ? 'No venues match your selected filters. Try clearing search parameters.'
                : 'No campus venues have been added yet. Click "Add Venue" to register your first location.'}
            </p>
            {(search || statusFilter || facilityFilter) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('');
                  setFacilityFilter('');
                }}
                className="mt-4 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6">Venue Name & Location</th>
                  <th className="py-3.5 px-4">Capacity</th>
                  <th className="py-3.5 px-4">Rate / Hour</th>
                  <th className="py-3.5 px-4">Facilities</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {venues.map((venue) => {
                  const isActionBusy = actionLoading === venue.id;
                  return (
                    <tr key={venue.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Name & Location */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="font-semibold text-slate-900">{venue.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{venue.location}</div>
                        {venue.description && (
                          <div className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                            {venue.description}
                          </div>
                        )}
                      </td>

                      {/* Capacity */}
                      <td className="py-4 px-4">
                        <div className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>{venue.capacity.toLocaleString()} seats</span>
                        </div>
                      </td>

                      {/* Hourly Rate */}
                      <td className="py-4 px-4">
                        <span className="font-medium text-slate-700">
                          {venue.hourlyRate > 0 ? `$${venue.hourlyRate}/hr` : 'Free / Included'}
                        </span>
                      </td>

                      {/* Facilities */}
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
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
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <button
                          type="button"
                          disabled={isActionBusy}
                          onClick={() => handleStatusToggle(venue)}
                          title="Click to toggle status"
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                            venue.status === 'available'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                          }`}
                        >
                          <Power className="w-3 h-3" />
                          <span className="capitalize">{venue.status}</span>
                        </button>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-4 px-4 sm:px-6 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            disabled={isActionBusy}
                            onClick={() => openEditModal(venue)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit Venue"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            disabled={isActionBusy}
                            onClick={() => setArchiveTarget(venue)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Archive Venue"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.pages > 1 && (
          <div className="py-3 px-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing page <span className="font-semibold text-slate-700">{pagination.page}</span> of{' '}
              <span className="font-semibold text-slate-700">{pagination.pages}</span> ({pagination.total} total)
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={pagination.page <= 1 || loading}
                onClick={() => fetchVenues(pagination.page - 1)}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={pagination.page >= pagination.pages || loading}
                onClick={() => fetchVenues(pagination.page + 1)}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Venue Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full p-6 sm:p-8 animate-fadeIn">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-lg text-slate-900">
                  {modalMode === 'create' ? 'Register New Campus Venue' : `Edit "${activeVenue?.name}"`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="mt-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Venue Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. University Grand Auditorium"
                  className={`block w-full px-3 py-2 text-sm rounded-xl border bg-white ${
                    formErrors.name ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-200 focus:ring-indigo-100'
                  } focus:outline-hidden focus:ring-2 focus:border-indigo-600`}
                />
                {formErrors.name && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{formErrors.name}</p>
                )}
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Location / Building / Room *
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g. Academic Block C, 3rd Floor"
                  className={`block w-full px-3 py-2 text-sm rounded-xl border bg-white ${
                    formErrors.location ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-200 focus:ring-indigo-100'
                  } focus:outline-hidden focus:ring-2 focus:border-indigo-600`}
                />
                {formErrors.location && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{formErrors.location}</p>
                )}
              </div>

              {/* Capacity and Rate in Two Columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Seating Capacity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    placeholder="e.g. 250"
                    className={`block w-full px-3 py-2 text-sm rounded-xl border bg-white ${
                      formErrors.capacity ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-200 focus:ring-indigo-100'
                    } focus:outline-hidden focus:ring-2 focus:border-indigo-600`}
                  />
                  {formErrors.capacity && (
                    <p className="mt-1 text-xs text-rose-600 font-medium">{formErrors.capacity}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Hourly Fee ($) <span className="text-slate-400 font-normal lowercase">(0 if free)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.hourlyRate}
                    onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                    placeholder="0"
                    className="block w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600"
                  />
                  {formErrors.hourlyRate && (
                    <p className="mt-1 text-xs text-rose-600 font-medium">{formErrors.hourlyRate}</p>
                  )}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Initial Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="block w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600"
                >
                  <option value="available">Available for Bookings</option>
                  <option value="maintenance">Under Maintenance</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Description <span className="text-slate-400 font-normal lowercase">(optional)</span>
                </label>
                <textarea
                  rows="2"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Key features, acoustics, accessibility notes..."
                  className="block w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600"
                />
              </div>

              {/* Facilities Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Available Facilities & Equipment
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {COMMON_FACILITIES.map((facility) => {
                    const isSelected = formData.facilities.includes(facility);
                    return (
                      <button
                        key={facility}
                        type="button"
                        onClick={() => toggleFacility(facility)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}
                        {facility}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Facility input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customFacility}
                    onChange={(e) => setCustomFacility(e.target.value)}
                    placeholder="Add custom facility (e.g. Grand Piano)..."
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white"
                  />
                  <button
                    type="button"
                    onClick={addCustomFacility}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-xs disabled:opacity-60"
                >
                  {formSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{modalMode === 'create' ? 'Create Venue' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Safe Archive Confirmation Modal */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 text-center animate-fadeIn">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="font-bold text-lg text-slate-900">Archive Campus Venue?</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Are you sure you want to archive <span className="font-semibold text-slate-800">"{archiveTarget.name}"</span>?
              <br />
              <span className="text-slate-400">
                To preserve historical event and booking references, this venue will be flagged as archived and hidden from organizers.
              </span>
            </p>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setArchiveTarget(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading === archiveTarget.id}
                onClick={handleArchiveConfirm}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs disabled:opacity-60"
              >
                {actionLoading === archiveTarget.id && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Confirm Archive</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
