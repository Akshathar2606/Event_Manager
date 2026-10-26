import React, { useState, useEffect } from 'react';
import { cateringService, extractErrorMessage, DIETARY_OPTIONS } from '../../services/cateringService';
import {
  UtensilsCrossed,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  X,
  Users,
  DollarSign,
  Tag,
  List
} from 'lucide-react';

export default function VendorPackagesPage() {
  const [profile, setProfile] = useState(null);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [activePackage, setActivePackage] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    pricePerPlate: '',
    minOrder: '10',
    menuItemsText: '',
    dietaryOptions: []
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Archive state
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchProfileAndPackages = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await cateringService.getMyProfile();
      setProfile(data);
      const activePkgs = (data.packages || []).filter((p) => !p.isArchived);
      setPackages(activePkgs);
    } catch (err) {
      if (err.response && err.response.status === 404) {
        setError('Please create your Vendor Profile first before creating catering packages.');
      } else {
        setError(extractErrorMessage(err, 'Failed to load catering packages.'));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileAndPackages();
  }, []);

  const notifySuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const openCreateModal = () => {
    setModalMode('create');
    setActivePackage(null);
    setFormData({
      name: '',
      description: '',
      pricePerPlate: '',
      minOrder: '10',
      menuItemsText: '',
      dietaryOptions: []
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (pkg) => {
    setModalMode('edit');
    setActivePackage(pkg);
    setFormData({
      name: pkg.name || '',
      description: pkg.description || '',
      pricePerPlate: String(pkg.pricePerPlate ?? ''),
      minOrder: String(pkg.minOrder ?? 10),
      menuItemsText: (pkg.menuItems || []).join('\n'),
      dietaryOptions: pkg.dietaryOptions || []
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const toggleDietary = (option) => {
    setFormData((prev) => {
      const exists = prev.dietaryOptions.includes(option);
      return {
        ...prev,
        dietaryOptions: exists
          ? prev.dietaryOptions.filter((d) => d !== option)
          : [...prev.dietaryOptions, option]
      };
    });
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      errors.name = 'Package name is required (min 2 characters).';
    }
    const price = Number(formData.pricePerPlate);
    if (formData.pricePerPlate === '' || isNaN(price) || price < 0) {
      errors.pricePerPlate = 'Price per plate must be a non-negative number.';
    }
    const minOrder = Number(formData.minOrder);
    if (formData.minOrder === '' || isNaN(minOrder) || !Number.isInteger(minOrder) || minOrder < 1) {
      errors.minOrder = 'Minimum order size must be at least 1 person.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setError(null);
    try {
      const menuItems = formData.menuItemsText
        .split('\n')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        pricePerPlate: Number(formData.pricePerPlate),
        minOrder: Number(formData.minOrder),
        menuItems,
        dietaryOptions: formData.dietaryOptions
      };

      if (modalMode === 'create') {
        const res = await cateringService.addPackage(payload);
        notifySuccess(`Package "${res.data.name}" added successfully.`);
      } else {
        const pkgId = activePackage.id || activePackage._id;
        const res = await cateringService.updatePackage(pkgId, payload);
        notifySuccess(`Package "${res.data.name}" updated successfully.`);
      }

      setIsModalOpen(false);
      fetchProfileAndPackages();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to save package.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchiveConfirm = async () => {
    if (!archiveTarget) return;
    const pkgId = archiveTarget.id || archiveTarget._id;
    setActionLoading(pkgId);
    try {
      await cateringService.archivePackage(pkgId);
      notifySuccess(`Package "${archiveTarget.name}" archived successfully.`);
      setArchiveTarget(null);
      fetchProfileAndPackages();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to archive package.'));
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600 mb-2" />
        <p className="text-sm font-medium">Loading catering packages...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <UtensilsCrossed className="w-3.5 h-3.5" />
                Menu & Food Packages
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Catering Packages & Menus
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Create buffet and plated package options with detailed dietary classifications and pricing
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 transition-colors shadow-xs shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Food Package</span>
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
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between text-sm animate-fadeIn">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Packages Grid */}
      {packages.length === 0 ? (
        <div className="py-20 px-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-slate-800 text-base">No food packages created yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Create your first package with per-plate pricing, menu items, and dietary tags so campus organizers can book you.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Package</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map((pkg) => {
            const pkgId = pkg.id || pkg._id;
            return (
              <div
                key={pkgId}
                className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-bold text-slate-900 text-lg leading-snug">{pkg.name}</h3>
                    <span className="font-extrabold text-amber-700 text-base shrink-0">
                      ${pkg.pricePerPlate}
                      <span className="text-[10px] text-slate-400 font-normal"> /plate</span>
                    </span>
                  </div>

                  {/* Description */}
                  {pkg.description && (
                    <p className="text-xs text-slate-600 leading-relaxed mb-3">{pkg.description}</p>
                  )}

                  {/* Specs */}
                  <div className="py-2 px-3 bg-slate-50 rounded-xl mb-3 text-xs flex items-center justify-between text-slate-600">
                    <span className="text-slate-400 text-[11px]">Min. Order Requirement</span>
                    <span className="font-semibold text-slate-800">{pkg.minOrder} Attendees</span>
                  </div>

                  {/* Dietary Badges */}
                  {(pkg.dietaryOptions || []).length > 0 && (
                    <div className="mb-3">
                      <div className="flex flex-wrap gap-1">
                        {pkg.dietaryOptions.map((diet) => (
                          <span
                            key={diet}
                            className="inline-block px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[10px] font-semibold"
                          >
                            ✓ {diet}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Menu Items */}
                  {(pkg.menuItems || []).length > 0 && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                        Menu Items ({(pkg.menuItems || []).length})
                      </span>
                      <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                        {pkg.menuItems.slice(0, 4).map((item, idx) => (
                          <li key={idx} className="truncate">
                            {item}
                          </li>
                        ))}
                        {pkg.menuItems.length > 4 && (
                          <li className="text-[11px] text-slate-400 italic list-none">
                            +{pkg.menuItems.length - 4} additional items
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(pkg)}
                    className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                    title="Edit Package"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setArchiveTarget(pkg)}
                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Archive Package"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Package Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 sm:p-8 animate-fadeIn">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-900">
                {modalMode === 'create' ? 'Add Catering Food Package' : `Edit "${activePackage?.name}"`}
              </h3>
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
                  Package Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Executive Luncheon or Continental Breakfast"
                  className={`block w-full px-3 py-2 text-sm rounded-xl border bg-white ${
                    formErrors.name ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-200 focus:ring-amber-100'
                  } focus:outline-hidden focus:ring-2 focus:border-amber-600`}
                />
                {formErrors.name && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{formErrors.name}</p>
                )}
              </div>

              {/* Price & Min Order in Two Columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Price per Plate ($) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.pricePerPlate}
                    onChange={(e) => setFormData({ ...formData, pricePerPlate: e.target.value })}
                    placeholder="e.g. 25.00"
                    className={`block w-full px-3 py-2 text-sm rounded-xl border bg-white ${
                      formErrors.pricePerPlate
                        ? 'border-rose-400 focus:ring-rose-200'
                        : 'border-slate-200 focus:ring-amber-100'
                    } focus:outline-hidden focus:ring-2 focus:border-amber-600`}
                  />
                  {formErrors.pricePerPlate && (
                    <p className="mt-1 text-xs text-rose-600 font-medium">{formErrors.pricePerPlate}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Min. Order Size (people) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.minOrder}
                    onChange={(e) => setFormData({ ...formData, minOrder: e.target.value })}
                    placeholder="10"
                    className={`block w-full px-3 py-2 text-sm rounded-xl border bg-white ${
                      formErrors.minOrder
                        ? 'border-rose-400 focus:ring-rose-200'
                        : 'border-slate-200 focus:ring-amber-100'
                    } focus:outline-hidden focus:ring-2 focus:border-amber-600`}
                  />
                  {formErrors.minOrder && (
                    <p className="mt-1 text-xs text-rose-600 font-medium">{formErrors.minOrder}</p>
                  )}
                </div>
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
                  placeholder="Overview of the courses, presentation style (buffet/plated), etc."
                  className="block w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-100 focus:border-amber-600"
                />
              </div>

              {/* Dietary Options Chips */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Dietary Classifications
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DIETARY_OPTIONS.map((diet) => {
                    const isSelected = formData.dietaryOptions.includes(diet);
                    return (
                      <button
                        key={diet}
                        type="button"
                        onClick={() => toggleDietary(diet)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}
                        {diet}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Menu Items (Multiline text) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Menu Items <span className="text-slate-400 font-normal lowercase">(one item per line)</span>
                </label>
                <textarea
                  rows="4"
                  value={formData.menuItemsText}
                  onChange={(e) => setFormData({ ...formData, menuItemsText: e.target.value })}
                  placeholder="Garden Spring Salad&#10;Herb Roasted Chicken Breast&#10;Rosemary Garlic Potatoes&#10;Assorted Pastries"
                  className="block w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-100 focus:border-amber-600"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors shadow-xs disabled:opacity-60"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{modalMode === 'create' ? 'Add Package' : 'Save Package'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 text-center animate-fadeIn">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="font-bold text-lg text-slate-900">Archive Food Package?</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Are you sure you want to archive <span className="font-semibold text-slate-800">"{archiveTarget.name}"</span>?
              <br />
              <span className="text-slate-400">
                Existing booking records will remain intact, but organizers will no longer see this package for new events.
              </span>
            </p>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setArchiveTarget(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading === (archiveTarget.id || archiveTarget._id)}
                onClick={handleArchiveConfirm}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs disabled:opacity-60"
              >
                {actionLoading === (archiveTarget.id || archiveTarget._id) && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                <span>Confirm Archive</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
