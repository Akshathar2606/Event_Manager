import React, { useState, useEffect } from 'react';
import { cateringService, extractErrorMessage } from '../../services/cateringService';
import {
  Store,
  MapPin,
  Mail,
  Phone,
  Power,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  UtensilsCrossed,
  X,
  Save
} from 'lucide-react';

const COMMON_CUISINES = [
  'Continental',
  'Mediterranean',
  'Indian',
  'Asian Fusion',
  'Italian',
  'Mexican',
  'Artisan Bakery & Coffee',
  'Healthy & Organic',
  'Buffet & Finger Foods'
];

export default function VendorProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Edit / Create mode state
  const [isEditing, setIsEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [formData, setFormData] = useState({
    businessName: '',
    description: '',
    contactEmail: '',
    contactPhone: '',
    serviceArea: '',
    city: '',
    locality: '',
    fullAddress: '',
    latitude: '',
    longitude: '',
    cuisineTypes: []
  });
  const [customCuisine, setCustomCuisine] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [togglingAvailability, setTogglingAvailability] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await cateringService.getMyProfile();
      setProfile(data);
      setIsNew(false);
      setFormData({
        businessName: data.businessName || '',
        description: data.description || '',
        contactEmail: data.contactEmail || '',
        contactPhone: data.contactPhone || '',
        serviceArea: data.serviceArea || '',
        city: data.city || '',
        locality: data.locality || '',
        fullAddress: data.fullAddress || '',
        latitude: data.location?.coordinates?.[1] ?? '',
        longitude: data.location?.coordinates?.[0] ?? '',
        cuisineTypes: data.cuisineTypes || []
      });
    } catch (err) {
      if (err.response && err.response.status === 404) {
        // No profile created yet
        setIsNew(true);
        setIsEditing(true);
      } else {
        setError(extractErrorMessage(err, 'Failed to load your catering profile.'));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const notifySuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const toggleCuisine = (cuisine) => {
    setFormData((prev) => {
      const exists = prev.cuisineTypes.includes(cuisine);
      return {
        ...prev,
        cuisineTypes: exists
          ? prev.cuisineTypes.filter((c) => c !== cuisine)
          : [...prev.cuisineTypes, cuisine]
      };
    });
  };

  const addCustomCuisine = (e) => {
    e.preventDefault();
    if (customCuisine.trim() && !formData.cuisineTypes.includes(customCuisine.trim())) {
      setFormData((prev) => ({
        ...prev,
        cuisineTypes: [...prev.cuisineTypes, customCuisine.trim()]
      }));
      setCustomCuisine('');
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.businessName.trim() || formData.businessName.trim().length < 2) {
      errors.businessName = 'Business name is required (min 2 characters).';
    }
    if (!formData.serviceArea.trim() || formData.serviceArea.trim().length < 2) {
      errors.serviceArea = 'Service area or campus location is required.';
    }
    const hasLatitude = formData.latitude !== '';
    const hasLongitude = formData.longitude !== '';
    if (hasLatitude !== hasLongitude) {
      errors.location = 'Enter both latitude and longitude, or leave both blank.';
    } else if (hasLatitude) {
      const latitude = Number(formData.latitude);
      const longitude = Number(formData.longitude);
      if (
        !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180
      ) {
        errors.location = 'Latitude must be between -90 and 90 and longitude between -180 and 180.';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        ...formData,
        location: formData.latitude === '' && formData.longitude === ''
          ? null
          : {
              type: 'Point',
              coordinates: [Number(formData.longitude), Number(formData.latitude)]
            }
      };
      delete payload.latitude;
      delete payload.longitude;
      if (isNew) {
        const res = await cateringService.createProfile(payload);
        setProfile(res.data);
        setIsNew(false);
        setIsEditing(false);
        notifySuccess('Catering service profile registered successfully!');
      } else {
        const res = await cateringService.updateMyProfile(payload);
        setProfile(res.data);
        setIsEditing(false);
        notifySuccess('Catering profile updated successfully.');
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to save catering profile.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleAvailability = async () => {
    if (!profile) return;
    const targetStatus = !profile.isAvailable;
    setTogglingAvailability(true);
    try {
      const res = await cateringService.updateAvailability(targetStatus);
      setProfile((prev) => ({ ...prev, isAvailable: targetStatus }));
      notifySuccess(`Service status set to ${targetStatus ? 'Available for bookings' : 'Unavailable'}.`);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to update availability status.'));
    } finally {
      setTogglingAvailability(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-text-muted">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600 mb-2" />
        <p className="text-sm font-medium">Loading catering profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-surface rounded-2xl border border-border p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <Store className="w-3.5 h-3.5" />
                Catering Vendor Profile
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">
              {profile ? profile.businessName : 'Set Up Your Catering Business'}
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              Manage your commercial profile, service coverage, and availability for institutional events
            </p>
          </div>

          {profile && !isEditing && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={togglingAvailability}
                onClick={handleToggleAvailability}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                  profile.isAvailable
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                }`}
              >
                {togglingAvailability ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Power className="w-3.5 h-3.5" />
                )}
                <span>{profile.isAvailable ? 'Taking Orders (Available)' : 'Temporarily Closed'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-text-secondary bg-surface-subtle hover:bg-surface-muted transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            </div>
          )}
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

      {/* Profile Form (Edit / Create) */}
      {isEditing ? (
        <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-border mb-6">
            <h3 className="font-bold text-lg text-text-primary">
              {isNew ? 'Create Catering Business Profile' : 'Edit Catering Profile'}
            </h3>
            {!isNew && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-xs text-text-muted hover:text-text-primary font-semibold"
              >
                Cancel
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Business Name */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                Business / Kitchen Name *
              </label>
              <input
                type="text"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                placeholder="e.g. Blue Ribbon Campus Catering"
                className={`block w-full px-3 py-2 text-sm rounded-xl border bg-surface ${
                  formErrors.businessName ? 'border-rose-400 focus:ring-rose-200' : 'border-border focus:ring-amber-100'
                } focus:outline-hidden focus:ring-2 focus:border-amber-600`}
              />
              {formErrors.businessName && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{formErrors.businessName}</p>
              )}
            </div>

            {/* Service Area */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                Campus Coverage / Service Area *
              </label>
              <input
                type="text"
                value={formData.serviceArea}
                onChange={(e) => setFormData({ ...formData, serviceArea: e.target.value })}
                placeholder="e.g. North & South Campus, Engineering Quad"
                className={`block w-full px-3 py-2 text-sm rounded-xl border bg-surface ${
                  formErrors.serviceArea ? 'border-rose-400 focus:ring-rose-200' : 'border-border focus:ring-amber-100'
                } focus:outline-hidden focus:ring-2 focus:border-amber-600`}
              />
              {formErrors.serviceArea && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{formErrors.serviceArea}</p>
              )}
            </div>

            {/* Contact Email & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                  Contact Email <span className="text-text-muted font-normal lowercase">(optional)</span>
                </label>
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  placeholder="catering@business.com"
                  className="block w-full px-3 py-2 text-sm rounded-xl border border-border bg-surface focus:outline-hidden focus:ring-2 focus:ring-amber-100 focus:border-amber-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                  Contact Phone <span className="text-text-muted font-normal lowercase">(optional)</span>
                </label>
                <input
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  placeholder="(555) 000-0000"
                  className="block w-full px-3 py-2 text-sm rounded-xl border border-border bg-surface focus:outline-hidden focus:ring-2 focus:ring-amber-100 focus:border-amber-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                  City <span className="text-text-muted font-normal lowercase">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="e.g. Tumakuru"
                  className="block w-full px-3 py-2 text-sm rounded-xl border border-border bg-surface focus:outline-hidden focus:ring-2 focus:ring-amber-100 focus:border-amber-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                  Locality <span className="text-text-muted font-normal lowercase">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.locality}
                  onChange={(e) => setFormData({ ...formData, locality: e.target.value })}
                  placeholder="e.g. Siddaganga area"
                  className="block w-full px-3 py-2 text-sm rounded-xl border border-border bg-surface focus:outline-hidden focus:ring-2 focus:ring-amber-100 focus:border-amber-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                Full Address <span className="text-text-muted font-normal lowercase">(optional)</span>
              </label>
              <input
                type="text"
                value={formData.fullAddress}
                onChange={(e) => setFormData({ ...formData, fullAddress: e.target.value })}
                placeholder="Address shared with event organizers"
                className="block w-full px-3 py-2 text-sm rounded-xl border border-border bg-surface focus:outline-hidden focus:ring-2 focus:ring-amber-100 focus:border-amber-600"
              />
            </div>

            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                    Latitude <span className="text-text-muted font-normal lowercase">(optional)</span>
                  </label>
                  <input
                    type="number"
                    min="-90"
                    max="90"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    placeholder="e.g. 13.34"
                    className="block w-full px-3 py-2 text-sm rounded-xl border border-border bg-surface focus:outline-hidden focus:ring-2 focus:ring-amber-100 focus:border-amber-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                    Longitude <span className="text-text-muted font-normal lowercase">(optional)</span>
                  </label>
                  <input
                    type="number"
                    min="-180"
                    max="180"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    placeholder="e.g. 77.10"
                    className="block w-full px-3 py-2 text-sm rounded-xl border border-border bg-surface focus:outline-hidden focus:ring-2 focus:ring-amber-100 focus:border-amber-600"
                  />
                </div>
              </div>
              {formErrors.location && <p className="mt-1 text-xs text-rose-600 font-medium">{formErrors.location}</p>}
              <p className="mt-1 text-[11px] text-text-muted">
                Coordinates are optional and must be provided together. Existing service-area coverage remains unchanged.
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                Business Description & Specialties
              </label>
              <textarea
                rows="3"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Highlight your culinary background, service speed, banquet capabilities, and kitchen certifications..."
                className="block w-full px-3 py-2 text-sm rounded-xl border border-border bg-surface focus:outline-hidden focus:ring-2 focus:ring-amber-100 focus:border-amber-600"
              />
            </div>

            {/* Cuisine Types Selector */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                Cuisine Classifications
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {COMMON_CUISINES.map((cuisine) => {
                  const isSelected = formData.cuisineTypes.includes(cuisine);
                  return (
                    <button
                      key={cuisine}
                      type="button"
                      onClick={() => toggleCuisine(cuisine)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        isSelected
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-background text-text-secondary border-border hover:bg-surface-subtle'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {cuisine}
                    </button>
                  );
                })}
              </div>

              {/* Custom Cuisine Tag */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customCuisine}
                  onChange={(e) => setCustomCuisine(e.target.value)}
                  placeholder="Add custom cuisine style..."
                  className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-border bg-surface"
                />
                <button
                  type="button"
                  onClick={addCustomCuisine}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface-subtle hover:bg-surface-muted text-text-secondary"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Submit */}
            <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
              {!isNew && (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-surface-subtle rounded-xl"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 transition-colors shadow-xs disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{isNew ? 'Create Profile' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Profile Display Card */
        <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-text-primary">{profile.businessName}</h2>
              <div className="flex items-center gap-2 text-xs text-text-muted mt-1">
                <MapPin className="w-3.5 h-3.5 text-text-muted" />
                <span>Service Coverage: {profile.serviceArea}</span>
              </div>
              {(profile.city || profile.locality || profile.fullAddress) && (
                <p className="text-xs text-text-muted mt-1">
                  {[profile.locality, profile.city].filter(Boolean).join(', ')}
                  {profile.fullAddress ? ` · ${profile.fullAddress}` : ''}
                </p>
              )}
              {profile.location?.coordinates?.length === 2 && (
                <p className="text-[11px] text-text-muted mt-1">
                  Map coordinates: {profile.location.coordinates[1]}, {profile.location.coordinates[0]}
                </p>
              )}
            </div>

            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border ${
                profile.isAvailable
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {profile.isAvailable ? '● Open for Bookings' : '● Closed'}
            </span>
          </div>

          {profile.description && (
            <p className="text-sm text-text-secondary bg-background p-4 rounded-xl border border-border leading-relaxed">
              {profile.description}
            </p>
          )}

          {/* Quick Specs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 bg-background rounded-xl border border-border">
              <span className="text-text-muted uppercase font-bold text-[10px] block mb-1">
                Contact Information
              </span>
              <div className="space-y-1 text-text-secondary">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-text-muted" />
                  <span>{profile.contactEmail || 'No email specified'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-text-muted" />
                  <span>{profile.contactPhone || 'No phone specified'}</span>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-background rounded-xl border border-border">
              <span className="text-text-muted uppercase font-bold text-[10px] block mb-1">
                Active Packages
              </span>
              <div className="text-base font-extrabold text-text-primary">
                {(profile.packages || []).filter((p) => !p.isArchived).length} Food Packages Available
              </div>
              <p className="text-[11px] text-text-muted mt-0.5">
                Manage menus and per-plate pricing in the Food Packages tab.
              </p>
            </div>
          </div>

          {/* Cuisines */}
          <div>
            <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
              Cuisine Classifications
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {(profile.cuisineTypes || []).length > 0 ? (
                profile.cuisineTypes.map((c) => (
                  <span
                    key={c}
                    className="inline-block px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200/60 text-xs font-medium"
                  >
                    {c}
                  </span>
                ))
              ) : (
                <span className="text-xs text-text-muted italic">No cuisines listed yet.</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
