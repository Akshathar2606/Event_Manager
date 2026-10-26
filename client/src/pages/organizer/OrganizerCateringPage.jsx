import React, { useState, useEffect, useCallback } from 'react';
import { cateringService, extractErrorMessage, DIETARY_OPTIONS } from '../../services/cateringService';
import {
  UtensilsCrossed,
  Search,
  Filter,
  DollarSign,
  MapPin,
  Mail,
  Phone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Info,
  ChevronRight,
  Store
} from 'lucide-react';

export default function OrganizerCateringPage() {
  const [vendors, setVendors] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDietary, setSelectedDietary] = useState([]);
  const [maxPrice, setMaxPrice] = useState('');

  // Selected Vendor Detail Modal
  const [selectedVendor, setSelectedVendor] = useState(null);

  const fetchVendors = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit: 10
      };
      if (search.trim()) params.search = search.trim();
      if (selectedDietary.length > 0) params.dietary = selectedDietary.join(',');
      if (maxPrice && !isNaN(Number(maxPrice))) params.maxPrice = Number(maxPrice);

      const res = await cateringService.browseCateringServices(params);
      setVendors(res.data || []);
      setPagination(res.pagination || { total: 0, page: 1, pages: 1, limit: 10 });
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to discover catering vendors.'));
    } finally {
      setLoading(false);
    }
  }, [search, selectedDietary, maxPrice]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchVendors(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchVendors]);

  const toggleDietaryFilter = (diet) => {
    setSelectedDietary((prev) =>
      prev.includes(diet) ? prev.filter((d) => d !== diet) : [...prev, diet]
    );
  };

  const clearAllFilters = () => {
    setSearch('');
    setSelectedDietary([]);
    setMaxPrice('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <UtensilsCrossed className="w-3.5 h-3.5" />
                Catering Discovery
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Explore Catering Services
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Discover approved culinary partners, compare per-plate menus, and verify dietary compliance
            </p>
          </div>

          <div className="text-xs text-slate-400 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 shrink-0">
            <span>Active Vendors: </span>
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

      {/* Search & Filter Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Keyword Search */}
          <div className="sm:col-span-2 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by vendor name, cuisine, or campus area..."
              className="block w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-100 focus:border-amber-600"
            />
          </div>

          {/* Max Price Filter */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <DollarSign className="w-4 h-4" />
            </div>
            <input
              type="number"
              min="0"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Max $/plate budget"
              className="block w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-100 focus:border-amber-600"
            />
          </div>
        </div>

        {/* Dietary Filters */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Filter by Dietary Options
            </span>
            {(search || maxPrice || selectedDietary.length > 0) && (
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
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
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
        <div className="py-20 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600 mb-2" />
          <p className="text-sm font-medium">Discovering campus caterers...</p>
        </div>
      ) : vendors.length === 0 ? (
        <div className="py-20 px-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-slate-800 text-base">No catering vendors found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search terms or dietary filters to find available campus vendors.
          </p>
          {(search || maxPrice || selectedDietary.length > 0) && (
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

            return (
              <div
                key={vendor.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-bold text-slate-900 text-lg leading-snug group-hover:text-amber-700 transition-colors">
                      {vendor.businessName}
                    </h3>
                    <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                      Open
                    </span>
                  </div>

                  {/* Coverage */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{vendor.serviceArea}</span>
                  </div>

                  {/* Description */}
                  {vendor.description && (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-4">
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
                        <span className="inline-block px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-400 text-[10px]">
                          +{vendor.cuisineTypes.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Package Count & Price summary */}
                  <div className="p-3 bg-slate-50 rounded-xl mb-4 text-xs flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Available Menus</span>
                      <span className="font-bold text-slate-800">{activePackages.length} Packages</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Starting at</span>
                      <span className="font-bold text-amber-700">
                        {lowestPrice !== null ? `$${lowestPrice}/plate` : 'Custom Quote'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Campus Partner</span>
                  <button
                    type="button"
                    onClick={() => setSelectedVendor(vendor)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                  >
                    <Info className="w-3.5 h-3.5" />
                    <span>View Menus</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Vendor & Menus Modal */}
      {selectedVendor && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full p-6 sm:p-8 animate-fadeIn max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 shrink-0">
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 mb-1">
                  Verified Catering Partner
                </span>
                <h3 className="font-extrabold text-xl text-slate-900">{selectedVendor.businessName}</h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>Coverage: {selectedVendor.serviceArea}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVendor(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content Scrollable */}
            <div className="py-5 overflow-y-auto space-y-6 text-sm text-slate-600 pr-1">
              {/* Description */}
              {selectedVendor.description && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs leading-relaxed text-slate-700">
                  {selectedVendor.description}
                </div>
              )}

              {/* Packages List */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Food Packages & Pricing ({(selectedVendor.packages || []).length})
                </h4>

                {(selectedVendor.packages || []).length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No packages currently listed by this vendor.</p>
                ) : (
                  <div className="space-y-4">
                    {selectedVendor.packages.map((pkg) => (
                      <div
                        key={pkg.id || pkg._id}
                        className="p-4 rounded-xl border border-slate-200 bg-white hover:border-amber-200 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div>
                            <h5 className="font-bold text-slate-900 text-sm">{pkg.name}</h5>
                            <span className="text-[11px] text-slate-400">Min. order: {pkg.minOrder} attendees</span>
                          </div>
                          <span className="font-extrabold text-amber-700 text-sm shrink-0">
                            ${pkg.pricePerPlate} <span className="text-xs text-slate-400 font-normal">/plate</span>
                          </span>
                        </div>

                        {pkg.description && (
                          <p className="text-xs text-slate-500 mb-2">{pkg.description}</p>
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
                          <div className="mt-2 pt-2 border-t border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                              Included Courses & Dishes:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {pkg.menuItems.map((item, idx) => (
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
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-400">Booking contracts open in Day 6 Phase</span>
              <button
                type="button"
                onClick={() => setSelectedVendor(null)}
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
