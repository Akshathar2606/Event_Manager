import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cateringService, DIETARY_OPTIONS } from '../../services/cateringService';
import { cateringRequestService, extractErrorMessage } from '../../services/cateringRequestService';
import { eventService } from '../../services/eventService';
import {
  calculateEstimatedQuote,
  validateCateringRequestForm,
  formatDisplayDateTime
} from '../../utils/cateringRequestUtils';
import {
  UtensilsCrossed,
  Search,
  DollarSign,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Info,
  ChevronRight,
  ClipboardList,
  Calendar,
  Users,
  Send,
  FileText,
  Clock,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export default function OrganizerCateringPage() {
  const navigate = useNavigate();

  // Vendors state
  const [vendors, setVendors] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [locality, setLocality] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [selectedDietary, setSelectedDietary] = useState([]);
  const [maxPrice, setMaxPrice] = useState('');
  const [expectedGuestCount, setExpectedGuestCount] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radiusKm, setRadiusKm] = useState('');

  // Selected Vendor Detail Modal
  const [selectedVendor, setSelectedVendor] = useState(null);

  // Organizer Events for Catering Requests
  const [myEvents, setMyEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Catering Request Modal State
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [targetVendor, setTargetVendor] = useState(null);
  const [targetPackage, setTargetPackage] = useState(null);

  // Form Fields
  const [selectedEventId, setSelectedEventId] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [serviceDateTime, setServiceDateTime] = useState('');
  const [notes, setNotes] = useState('');
  const [formValidationErrors, setFormValidationErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Successful submission confirmation modal
  const [submittedRequest, setSubmittedRequest] = useState(null);

  // 1. Fetch Vendors
  const fetchVendors = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit: 10
      };
      if (search.trim()) params.search = search.trim();
      if (city.trim()) params.city = city.trim();
      if (locality.trim()) params.locality = locality.trim();
      if (cuisine.trim()) params.cuisine = cuisine.trim();
      if (selectedDietary.length > 0) params.dietary = selectedDietary.join(',');
      if (maxPrice && !isNaN(Number(maxPrice))) params.maxPrice = Number(maxPrice);
      if (expectedGuestCount && !isNaN(Number(expectedGuestCount))) {
        params.guestCount = Number(expectedGuestCount);
      }
      if (latitude !== '' && longitude !== '' && radiusKm !== '') {
        params.latitude = Number(latitude);
        params.longitude = Number(longitude);
        params.radiusKm = Number(radiusKm);
      }

      const res = await cateringService.browseCateringServices(params);
      setVendors(res.data || []);
      setPagination(res.pagination || { total: 0, page: 1, pages: 1, limit: 10 });
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to discover catering vendors.'));
    } finally {
      setLoading(false);
    }
  }, [
    search,
    city,
    locality,
    cuisine,
    selectedDietary,
    maxPrice,
    expectedGuestCount,
    latitude,
    longitude,
    radiusKm
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchVendors(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchVendors]);

  // 2. Fetch Organizer Events (for request dropdown)
  useEffect(() => {
    const loadEvents = async () => {
      setLoadingEvents(true);
      try {
        const res = await eventService.getEvents({ limit: 100 });
        const eligible = (res.data || []).filter(
          (e) => !e.isArchived && e.status !== 'cancelled'
        );
        setMyEvents(eligible);
      } catch (err) {
        console.warn('Could not load organizer events for catering:', err);
      } finally {
        setLoadingEvents(false);
      }
    };
    loadEvents();
  }, []);

  const toggleDietaryFilter = (diet) => {
    setSelectedDietary((prev) =>
      prev.includes(diet) ? prev.filter((d) => d !== diet) : [...prev, diet]
    );
  };

  const clearAllFilters = () => {
    setSearch('');
    setCity('');
    setLocality('');
    setCuisine('');
    setSelectedDietary([]);
    setMaxPrice('');
    setExpectedGuestCount('');
    setLatitude('');
    setLongitude('');
    setRadiusKm('');
  };

  // Open Catering Request Modal for a specific vendor & package
  const handleOpenRequestModal = (vendor, pkg) => {
    setTargetVendor(vendor);
    setTargetPackage(pkg);
    // Pre-populate sensible defaults
    setGuestCount(pkg?.minOrder ? String(pkg.minOrder) : '20');
    setNotes('');
    setServiceDateTime('');
    setFormValidationErrors([]);
    setSubmitError(null);
    // If only one event exists, preselect it
    if (myEvents.length === 1 && !selectedEventId) {
      setSelectedEventId(myEvents[0].id || myEvents[0]._id);
    }
    setRequestModalOpen(true);
  };

  // Compute live estimated quote
  const selectedEvent = myEvents.find((e) => (e.id || e._id) === selectedEventId);
  const estimatedTotal = calculateEstimatedQuote(targetPackage?.pricePerPlate || 0, guestCount);
  const hasDiscoveryFilters = Boolean(
    search || city || locality || cuisine || maxPrice || expectedGuestCount ||
    latitude || longitude || radiusKm || selectedDietary.length
  );

  // Handle Catering Request Submission
  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    setFormValidationErrors([]);

    const validation = validateCateringRequestForm({
      eventId: selectedEventId,
      cateringServiceId: targetVendor?.id || targetVendor?._id,
      packageId: targetPackage?.id || targetPackage?._id,
      guestCount,
      selectedPackage: targetPackage,
      selectedEvent
    });

    if (!validation.isValid) {
      setFormValidationErrors(validation.errors);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        eventId: selectedEventId,
        cateringServiceId: targetVendor.id || targetVendor._id,
        packageId: targetPackage.id || targetPackage._id,
        guestCount: Number(guestCount),
        ...(serviceDateTime ? { serviceDateTime } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {})
      };

      const res = await cateringRequestService.createCateringRequest(payload);
      // Close request modal and show confirmation modal with server-authoritative details
      setRequestModalOpen(false);
      if (selectedVendor) setSelectedVendor(null);
      setSubmittedRequest(res.data);
    } catch (err) {
      setSubmitError(extractErrorMessage(err, 'Failed to submit catering request. Please check inputs.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-surface rounded-2xl border border-border p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <UtensilsCrossed className="w-3.5 h-3.5" />
                Catering Discovery
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">
              Explore Catering Services
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              Compare available catering packages by location, cuisine, dietary options, price, and capacity.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/organizer/catering-requests"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/80 hover:bg-indigo-100 transition-colors shadow-2xs"
            >
              <ClipboardList className="w-4 h-4" />
              <span>My Catering Requests</span>
            </Link>

            <div className="text-xs text-text-muted bg-background px-3.5 py-2.5 rounded-xl border border-border shrink-0">
              <span>Vendors: </span>
              <span className="font-bold text-text-primary">{pagination.total}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between text-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="bg-surface rounded-2xl border border-border p-5 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Keyword Search */}
          <div className="sm:col-span-2 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by vendor name..."
              className="block w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border bg-surface placeholder:text-text-muted focus:outline-hidden focus:ring-2 focus:ring-amber-100 focus:border-amber-600"
            />
          </div>

          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City (e.g. Tumakuru)"
            aria-label="Filter by city"
            className="block w-full px-3 py-2 text-sm rounded-xl border border-border bg-surface placeholder:text-text-muted focus:outline-hidden focus:ring-2 focus:ring-amber-100 focus:border-amber-600"
          />
          <input
            type="text"
            value={locality}
            onChange={(e) => setLocality(e.target.value)}
            placeholder="Locality (e.g. Siddaganga)"
            aria-label="Filter by locality"
            className="block w-full px-3 py-2 text-sm rounded-xl border border-border bg-surface placeholder:text-text-muted focus:outline-hidden focus:ring-2 focus:ring-amber-100 focus:border-amber-600"
          />
          <input
            type="text"
            value={cuisine}
            onChange={(e) => setCuisine(e.target.value)}
            placeholder="Cuisine (comma-separated)"
            aria-label="Filter by cuisine"
            className="block w-full px-3 py-2 text-sm rounded-xl border border-border bg-surface placeholder:text-text-muted focus:outline-hidden focus:ring-2 focus:ring-amber-100 focus:border-amber-600"
          />

          {/* Package Filters */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
              <DollarSign className="w-4 h-4" />
            </div>
            <input
              type="number"
              min="0"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Max $/plate budget"
              className="block w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border bg-surface placeholder:text-text-muted focus:outline-hidden focus:ring-2 focus:ring-amber-100 focus:border-amber-600"
            />
          </div>
          <input
            type="number"
            min="1"
            step="1"
            value={expectedGuestCount}
            onChange={(e) => setExpectedGuestCount(e.target.value)}
            placeholder="Expected guests"
            aria-label="Filter by expected guest count"
            className="block w-full px-3 py-2 text-sm rounded-xl border border-border bg-surface placeholder:text-text-muted focus:outline-hidden focus:ring-2 focus:ring-amber-100 focus:border-amber-600"
          />

          <div className="sm:col-span-2 lg:col-span-3">
            <p className="text-[11px] font-semibold text-text-muted mb-1">Nearby radius (optional; enter your location)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="number"
                min="-90"
                max="90"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="Latitude"
                aria-label="Your latitude"
                className="block w-full px-3 py-2 text-sm rounded-xl border border-border bg-surface placeholder:text-text-muted focus:outline-hidden focus:ring-2 focus:ring-amber-100 focus:border-amber-600"
              />
              <input
                type="number"
                min="-180"
                max="180"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="Longitude"
                aria-label="Your longitude"
                className="block w-full px-3 py-2 text-sm rounded-xl border border-border bg-surface placeholder:text-text-muted focus:outline-hidden focus:ring-2 focus:ring-amber-100 focus:border-amber-600"
              />
              <input
                type="number"
                min="1"
                step="1"
                value={radiusKm}
                onChange={(e) => setRadiusKm(e.target.value)}
                placeholder="Radius (km)"
                aria-label="Nearby radius in kilometres"
                className="block w-full px-3 py-2 text-sm rounded-xl border border-border bg-surface placeholder:text-text-muted focus:outline-hidden focus:ring-2 focus:ring-amber-100 focus:border-amber-600"
              />
            </div>
            {(Boolean(latitude || longitude || radiusKm) && !(latitude && longitude && radiusKm)) && (
              <p className="text-[11px] text-amber-700 mt-1">
                Enter latitude, longitude, and radius together to filter by distance.
              </p>
            )}
          </div>
        </div>

        {/* Dietary Filters */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Filter by Dietary Options
            </span>
            {hasDiscoveryFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs font-semibold text-amber-700 hover:text-amber-900"
              >
                Reset Filters
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DIETARY_OPTIONS.map((diet) => {
              const isSelected = selectedDietary.includes(diet);
              return (
                <button
                  key={diet}
                  type="button"
                  onClick={() => toggleDietaryFilter(diet)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                    isSelected
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-background text-text-secondary border-border hover:bg-surface-subtle'
                  }`}
                >
                  {isSelected ? '✓ ' : ''}
                  {diet}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Vendors List */}
      {loading ? (
        <div className="py-20 bg-surface rounded-2xl border border-border shadow-xs flex flex-col items-center justify-center text-text-muted">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600 mb-2" />
          <p className="text-sm font-medium">Discovering campus caterers...</p>
        </div>
      ) : vendors.length === 0 ? (
        <div className="py-20 px-4 bg-surface rounded-2xl border border-border shadow-xs text-center">
          <div className="w-12 h-12 rounded-2xl bg-surface-subtle text-text-muted flex items-center justify-center mx-auto mb-3">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-text-primary text-base">No catering vendors found</h3>
          <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
            Try adjusting your search terms or dietary filters to find available campus vendors.
          </p>
          {hasDiscoveryFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="mt-4 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vendors.map((vendor) => {
            const activePackages = (vendor.packages || []).filter((p) => !p.isArchived);
            const lowestPrice =
              activePackages.length > 0
                ? Math.min(...activePackages.map((p) => p.pricePerPlate))
                : null;
            const minimumGuests = activePackages.length > 0
              ? Math.min(...activePackages.map((pkg) => Number(pkg.minOrder ?? 10)))
              : null;
            const hasUnboundedPackage = activePackages.some((pkg) => pkg.maxGuests == null);
            const maximumGuests = activePackages.length > 0 && !hasUnboundedPackage
              ? Math.max(...activePackages.map((pkg) => Number(pkg.maxGuests)))
              : null;

            return (
              <div
                key={vendor.id || vendor._id}
                className="bg-surface rounded-2xl border border-border p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-bold text-text-primary text-lg leading-snug group-hover:text-amber-700 transition-colors">
                      {vendor.businessName}
                    </h3>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border shrink-0 ${
                      vendor.isAvailable === false
                        ? 'bg-surface-subtle text-text-secondary border-border'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {vendor.isAvailable === false ? 'Unavailable' : 'Available'}
                    </span>
                  </div>

                  {vendor.isDemoListing && (
                    <span className="inline-block mb-2 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-semibold">
                      Fictional demo listing
                    </span>
                  )}

                  <div className="flex items-center gap-1.5 text-xs text-text-muted mb-3">
                    <MapPin className="w-3.5 h-3.5 text-text-muted shrink-0" />
                    <span className="truncate">
                      {[vendor.locality, vendor.city].filter(Boolean).join(', ') || vendor.serviceArea}
                    </span>
                  </div>
                  {vendor.distanceKm !== undefined && (
                    <p className="text-[11px] text-text-muted -mt-2 mb-3">
                      {vendor.distanceKm.toFixed(1)} km away
                    </p>
                  )}

                  {/* Description */}
                  {vendor.description && (
                    <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed mb-4">
                      {vendor.description}
                    </p>
                  )}

                  {/* Cuisines */}
                  {(vendor.cuisineTypes || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {vendor.cuisineTypes.slice(0, 3).map((c) => (
                        <span
                          key={c}
                          className="inline-block px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[11px] font-medium"
                        >
                          {c}
                        </span>
                      ))}
                      {vendor.cuisineTypes.length > 3 && (
                        <span className="inline-block px-1.5 py-0.5 rounded-md bg-background text-text-muted text-[10px]">
                          +{vendor.cuisineTypes.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Package Count & Price summary */}
                  <div className="p-3 bg-background rounded-xl mb-4 text-xs flex items-center justify-between">
                    <div>
                      <span className="text-text-muted block text-[10px] uppercase font-semibold">Available Menus</span>
                      <span className="font-bold text-text-primary">{activePackages.length} Packages</span>
                    </div>
                    <div className="text-right">
                      <span className="text-text-muted block text-[10px] uppercase font-semibold">Starting at</span>
                      <span className="font-bold text-amber-700">
                        {lowestPrice !== null ? `$${lowestPrice}/plate` : 'Custom Quote'}
                      </span>
                    </div>
                  </div>
                  <div className="text-[11px] text-text-muted mb-3">
                    Guest capacity: {minimumGuests !== null ? `${minimumGuests}+ minimum` : 'Not stated'}
                    {' · '}
                    {maximumGuests === null ? 'No stated maximum' : `Up to ${maximumGuests}`}
                  </div>
                </div>

                {/* Card Action */}
                <div className="pt-4 border-t border-border flex items-center justify-between">
                  <span className="text-[11px] text-text-muted">{vendor.isDemoListing ? 'Fictional demo' : 'Catering vendor'}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedVendor(vendor)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                  >
                    <Info className="w-3.5 h-3.5" />
                    <span>View Menus & Request</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="flex items-center justify-between bg-surface rounded-xl border border-border px-4 py-3 text-sm">
          <span className="text-text-muted">
            Page <strong className="text-text-primary">{pagination.page}</strong> of{' '}
            <strong className="text-text-primary">{pagination.pages}</strong> ({pagination.total} vendors)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fetchVendors(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="px-3 py-1.5 rounded-lg border border-border text-text-secondary disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => fetchVendors(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages || loading}
              className="px-3 py-1.5 rounded-lg border border-border text-text-secondary disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Vendor & Menus Modal */}
      {selectedVendor && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-overlay/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-border shadow-xl max-w-2xl w-full p-6 sm:p-8 animate-fadeIn max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-border shrink-0">
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 mb-1">
                  {selectedVendor.isDemoListing ? 'Fictional demo listing' : 'Catering vendor'}
                </span>
                <h3 className="font-extrabold text-xl text-text-primary">{selectedVendor.businessName}</h3>
                <div className="flex items-center gap-1.5 text-xs text-text-muted mt-1">
                  <MapPin className="w-3.5 h-3.5 text-text-muted" />
                  <span>Coverage: {selectedVendor.serviceArea}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVendor(null)}
                className="text-text-muted hover:text-text-secondary p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content Scrollable */}
            <div className="py-5 overflow-y-auto space-y-6 text-sm text-text-secondary pr-1">
              {/* Description */}
              {selectedVendor.description && (
                <div className="p-3.5 bg-background rounded-xl border border-border text-xs leading-relaxed text-text-secondary">
                  {selectedVendor.description}
                </div>
              )}

              {/* Packages List */}
              <div>
                <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">
                  Food Packages & Pricing ({(selectedVendor.packages || []).filter((p) => !p.isArchived).length})
                </h4>

                {(selectedVendor.packages || []).filter((p) => !p.isArchived).length === 0 ? (
                  <p className="text-xs text-text-muted italic">No packages currently listed by this vendor.</p>
                ) : (
                  <div className="space-y-4">
                    {selectedVendor.packages
                      .filter((p) => !p.isArchived)
                      .map((pkg) => (
                        <div
                          key={pkg.id || pkg._id}
                          className="p-4 rounded-xl border border-border bg-surface hover:border-amber-200 transition-colors flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <div>
                                <h5 className="font-bold text-text-primary text-sm">{pkg.name}</h5>
                                <span className="text-[11px] text-text-muted">
                                  Min. order: {pkg.minOrder ?? 10} guests
                                  {pkg.maxGuests != null ? ` · Max: ${pkg.maxGuests}` : ' · No stated maximum'}
                                </span>
                              </div>
                              <span className="font-extrabold text-amber-700 text-sm shrink-0">
                                ${pkg.pricePerPlate} <span className="text-xs text-text-muted font-normal">/plate</span>
                              </span>
                            </div>

                            {pkg.description && (
                              <p className="text-xs text-text-muted mb-2">{pkg.description}</p>
                            )}

                            {/* Dietary Options */}
                            {(pkg.dietaryOptions || []).length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {pkg.dietaryOptions.map((diet) => (
                                  <span
                                    key={diet}
                                    className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/50 text-[10px] font-semibold"
                                  >
                                    ✓ {diet}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Menu Items */}
                            {(pkg.menuItems || []).length > 0 && (
                              <div className="mt-2 pt-2 border-t border-border">
                                <span className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                                  Included Courses & Dishes:
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {pkg.menuItems.map((item, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-block px-2 py-0.5 bg-surface-subtle text-text-secondary rounded-md text-[11px]"
                                    >
                                      {item}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Request Proposal Action */}
                          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                            <span className="text-[11px] text-text-muted">
                              Estimated starting: ${(pkg.pricePerPlate * (pkg.minOrder ?? 10)).toFixed(2)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenRequestModal(selectedVendor, pkg)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 transition-colors shadow-xs"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Request Proposal</span>
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-border flex items-center justify-between shrink-0">
              <span className="text-xs text-text-muted">Proposals are sent directly to the vendor</span>
              <button
                type="button"
                onClick={() => setSelectedVendor(null)}
                className="px-4 py-2 text-sm font-semibold text-text-secondary bg-surface-subtle hover:bg-surface-muted rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Catering Proposal Request Modal */}
      {requestModalOpen && targetPackage && targetVendor && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-overlay/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-border shadow-xl max-w-xl w-full p-6 sm:p-7 animate-fadeIn">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-border">
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 mb-1">
                  Submit Catering Proposal
                </span>
                <h3 className="font-extrabold text-lg text-text-primary">{targetVendor.businessName}</h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Package: <span className="font-semibold text-text-secondary">{targetPackage.name}</span> (${targetPackage.pricePerPlate}/plate)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRequestModalOpen(false)}
                className="text-text-muted hover:text-text-secondary p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} className="mt-5 space-y-4 text-sm">
              {/* Form errors */}
              {submitError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              {formValidationErrors.length > 0 && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Please correct the following:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 pl-1">
                    {formValidationErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Event Selection */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                  Target Event <span className="text-rose-500">*</span>
                </label>
                {loadingEvents ? (
                  <div className="py-2 text-xs text-text-muted flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                    <span>Loading your events...</span>
                  </div>
                ) : myEvents.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                    You have no active events. Please{' '}
                    <Link to="/organizer/events" className="underline font-semibold hover:text-amber-900">
                      create an event
                    </Link>{' '}
                    before requesting catering.
                  </div>
                ) : (
                  <select
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    required
                    className="block w-full px-3 py-2 text-sm rounded-xl border border-border bg-surface focus:outline-hidden focus:ring-2 focus:ring-amber-100 focus:border-amber-600"
                  >
                    <option value="">-- Select an event you organize --</option>
                    {myEvents.map((evt) => (
                      <option key={evt.id || evt._id} value={evt.id || evt._id}>
                        {evt.title} ({formatDisplayDateTime(evt.startDateTime)})
                        {evt.capacity ? ` • Capacity: ${evt.capacity}` : ''}
                      </option>
                    ))}
                  </select>
                )}
                {selectedEvent && (
                  <div className="mt-1.5 text-[11px] text-text-muted flex items-center gap-3">
                    <span>Category: <strong className="capitalize">{selectedEvent.category}</strong></span>
                    {selectedEvent.capacity && (
                      <span>Max Capacity: <strong>{selectedEvent.capacity} guests</strong></span>
                    )}
                  </div>
                )}
              </div>

              {/* Guest Count */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Expected Headcount / Guests <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-text-muted">
                    Min order: <strong>{targetPackage.minOrder ?? 10}</strong>
                    {targetPackage.maxGuests != null && (
                      <> · Max: <strong>{targetPackage.maxGuests}</strong></>
                    )}
                  </span>
                </div>
                <input
                  type="number"
                  min={targetPackage.minOrder ?? 10}
                  max={targetPackage.maxGuests ?? undefined}
                  required
                  value={guestCount}
                  onChange={(e) => setGuestCount(e.target.value)}
                  placeholder={`Minimum ${targetPackage.minOrder ?? 10} attendees`}
                  className="block w-full px-3 py-2 text-sm rounded-xl border border-border bg-surface focus:outline-hidden focus:ring-2 focus:ring-amber-100 focus:border-amber-600"
                />
                {Number(guestCount) > 0 && Number(guestCount) < (targetPackage.minOrder ?? 10) && (
                  <p className="mt-1 text-[11px] text-amber-600 font-medium">
                    ⚠️ Headcount is below package minimum order of {targetPackage.minOrder ?? 10} guests.
                  </p>
                )}
                {targetPackage.maxGuests != null && Number(guestCount) > targetPackage.maxGuests && (
                  <p className="mt-1 text-[11px] text-rose-600 font-medium">
                    Guest count exceeds this package's maximum capacity of {targetPackage.maxGuests}.
                  </p>
                )}
                {selectedEvent?.capacity && Number(guestCount) > selectedEvent.capacity && (
                  <p className="mt-1 text-[11px] text-rose-600 font-medium">
                    ⚠️ Headcount exceeds event venue capacity of {selectedEvent.capacity} guests.
                  </p>
                )}
              </div>

              {/* Service Delivery Date Time (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                  Requested Service Date & Time <span className="text-text-muted font-normal lowercase">(optional)</span>
                </label>
                <input
                  type="datetime-local"
                  value={serviceDateTime}
                  onChange={(e) => setServiceDateTime(e.target.value)}
                  className="block w-full px-3 py-2 text-sm rounded-xl border border-border bg-surface focus:outline-hidden focus:ring-2 focus:ring-amber-100 focus:border-amber-600"
                />
                <p className="mt-1 text-[11px] text-text-muted">
                  Defaults to your event's scheduled start time if left empty.
                </p>
              </div>

              {/* Special Instructions & Notes */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Special Requirements or Setup Notes
                  </label>
                  <span className="text-[11px] text-text-muted">{notes.length}/1000</span>
                </div>
                <textarea
                  rows="3"
                  maxLength="1000"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Specify buffet table locations, serving timelines, dietary counts, or delivery details..."
                  className="block w-full px-3 py-2 text-sm rounded-xl border border-border bg-surface focus:outline-hidden focus:ring-2 focus:ring-amber-100 focus:border-amber-600"
                />
              </div>

              {/* Estimated Quote Banner */}
              <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-amber-800 block">
                    Estimated Total (Client Calculation)
                  </span>
                  <span className="text-xs text-text-muted">
                    ${targetPackage.pricePerPlate} × {Number(guestCount) || 0} guests
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-amber-900 block">
                    ${estimatedTotal.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-text-muted">Server authoritatively quotes on creation</span>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRequestModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-text-secondary bg-surface-subtle hover:bg-surface-muted rounded-xl disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || myEvents.length === 0}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all shadow-xs disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting Proposal...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Catering Request</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submission Confirmation Modal */}
      {submittedRequest && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-overlay/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-border shadow-xl max-w-md w-full p-6 sm:p-7 text-center animate-fadeIn">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-text-primary">Catering Proposal Submitted!</h3>
            <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
              Your proposal has been submitted and is currently <strong>Pending Review</strong> with the vendor.
              The caterer will review menu feasibility and confirm your date.
            </p>

            {/* Server-Confirmed Receipt Details */}
            <div className="mt-5 p-4 bg-background border border-border rounded-xl text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-text-muted">Server-Confirmed Quote:</span>
                <span className="font-extrabold text-amber-700 text-sm">
                  ${Number(submittedRequest.quotedPrice).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Rate per Plate:</span>
                <span className="font-semibold text-text-primary">
                  ${Number(submittedRequest.pricePerPlate).toFixed(2)} / plate
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Guest Count:</span>
                <span className="font-semibold text-text-primary">
                  {submittedRequest.guestCount} guests
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Package:</span>
                <span className="font-semibold text-text-primary">
                  {submittedRequest.selectedPackage?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Initial Status:</span>
                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  Pending Review
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setSubmittedRequest(null)}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-text-secondary bg-surface-subtle hover:bg-surface-muted rounded-xl"
              >
                Explore More Caterers
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubmittedRequest(null);
                  navigate('/organizer/catering-requests');
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Track My Proposals</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
