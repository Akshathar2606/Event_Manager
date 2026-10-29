import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  eventService,
  EVENT_CATEGORIES,
  extractErrorMessage
} from '../../services/eventService';
import { venueService } from '../../services/venueService';
import {
  DEFAULT_ELIGIBLE_YEARS,
  STUDENT_YEAR_OPTIONS,
  getEventFeatureDetails
} from '../../utils/eventFeatures';
import {
  getEventContacts,
  isValidEventEmail,
  isValidEventPhone,
  isValidEventUrl,
  getSafeWhatsAppGroupUrl
} from '../../utils/eventContacts';
import {
  Calendar,
  Plus,
  Search,
  Filter,
  MapPin,
  Users,
  Clock,
  DollarSign,
  Tag,
  AlertCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  Archive,
  Edit2,
  Send,
  Ban,
  Sparkles,
  X,
  Building2,
  Info,
  Globe,
  Instagram,
  Trash2
} from 'lucide-react';

const toDatetimeLocal = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const getDateTimePart = (value, part) => {
  const [date = '', time = ''] = (value || '').split('T');
  return part === 'date' ? date : time;
};

const updateDateTimePart = (value, part, nextPart) => {
  let date = getDateTimePart(value, 'date');
  let time = getDateTimePart(value, 'time');
  if (part === 'date') date = nextPart;
  else time = nextPart;
  return date || time ? `${date}T${time}` : '';
};

const formatDate = (isoString) => {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getStatusBadge = (status) => {
  switch (status) {
    case 'published':
      return {
        label: 'Published',
        classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: CheckCircle2
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        classes: 'bg-rose-50 text-rose-700 border-rose-200',
        icon: XCircle
      };
    case 'draft':
    default:
      return {
        label: 'Draft',
        classes: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: Clock
      };
  }
};

export default function OrganizerEventsPage() {
  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [venuesLoading, setVenuesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filters
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'draft', 'published', 'cancelled'
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalErrors, setModalErrors] = useState([]);

  // Confirmation Modal State (Publish, Cancel, Archive)
  const [confirmDialog, setConfirmDialog] = useState(null); // { type: 'publish'|'cancel'|'archive', event }
  const [actionLoading, setActionLoading] = useState(false);

  // Form State
  const initialForm = {
    title: '',
    description: '',
    category: 'academic',
    aictePointsAvailable: false,
    attendanceProvided: false,
    eligibleYears: [...DEFAULT_ELIGIBLE_YEARS],
    contacts: [],
    websiteUrl: '',
    instagramUrl: '',
    whatsappGroupUrl: '',
    venue: '',
    startDateTime: '',
    endDateTime: '',
    registrationDeadline: '',
    capacity: 100,
    budget: '',
    tags: '',
    bannerUrl: ''
  };
  const [formData, setFormData] = useState(initialForm);

  // Fetch organizer's events (using organizer=me to see all drafts, published, and cancelled events)
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        organizer: 'me',
        limit: 100
      };
      if (activeTab !== 'all') {
        params.status = activeTab;
      }
      if (search.trim()) {
        params.search = search.trim();
      }
      if (selectedCategory) {
        params.category = selectedCategory;
      }

      const res = await eventService.getEvents(params);
      setEvents(res.data || []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load your events.'));
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, selectedCategory]);

  // Fetch available venues for venue picker
  const fetchAvailableVenues = useCallback(async () => {
    setVenuesLoading(true);
    try {
      const res = await venueService.getVenues({ status: 'available', limit: 100 });
      setVenues(res.data || []);
    } catch (err) {
      console.warn('Could not load venues list:', err);
    } finally {
      setVenuesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    fetchAvailableVenues();
  }, [fetchAvailableVenues]);

  // Summary counts
  const summaryCounts = {
    total: events.length,
    drafts: events.filter((e) => e.status === 'draft').length,
    published: events.filter((e) => e.status === 'published').length,
    cancelled: events.filter((e) => e.status === 'cancelled').length
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingEvent(null);
    setFormData(initialForm);
    setModalErrors([]);
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (event) => {
    setEditingEvent(event);
    const venueId = typeof event.venue === 'object' && event.venue
      ? (event.venue.id || event.venue._id)
      : event.venue || '';

    setFormData({
      title: event.title || '',
      description: event.description || '',
      category: event.category || 'academic',
      aictePointsAvailable: event.aictePointsAvailable === true,
      attendanceProvided: event.attendanceProvided === true,
      eligibleYears: Array.isArray(event.eligibleYears)
        ? event.eligibleYears
        : [...DEFAULT_ELIGIBLE_YEARS],
      contacts: getEventContacts(event),
      websiteUrl: typeof event.websiteUrl === 'string' ? event.websiteUrl : '',
      instagramUrl: typeof event.instagramUrl === 'string' ? event.instagramUrl : '',
      whatsappGroupUrl: typeof event.whatsappGroupUrl === 'string' ? event.whatsappGroupUrl : '',
      venue: venueId,
      startDateTime: toDatetimeLocal(event.startDateTime),
      endDateTime: toDatetimeLocal(event.endDateTime),
      registrationDeadline: toDatetimeLocal(event.registrationDeadline),
      capacity: event.capacity || 100,
      budget: event.budget ? String(event.budget) : '',
      tags: Array.isArray(event.tags) ? event.tags.join(', ') : '',
      bannerUrl: event.bannerUrl || ''
    });
    setModalErrors([]);
    setModalOpen(true);
  };

  // Client-side Form Validation
  const validateForm = () => {
    const errs = [];
    if (!formData.title || formData.title.trim().length < 3) {
      errs.push('Event title is required (minimum 3 characters).');
    }
    if (!formData.description || formData.description.trim().length === 0) {
      errs.push('Event description is required.');
    }
    if (
      !getDateTimePart(formData.startDateTime, 'date') ||
      !getDateTimePart(formData.startDateTime, 'time')
    ) {
      errs.push('Event start date and time is required.');
    }
    if (
      !getDateTimePart(formData.endDateTime, 'date') ||
      !getDateTimePart(formData.endDateTime, 'time')
    ) {
      errs.push('Event end date and time is required.');
    }

    if (formData.startDateTime && formData.endDateTime) {
      const start = new Date(formData.startDateTime);
      const end = new Date(formData.endDateTime);
      if (end <= start) {
        errs.push('Event end date and time must be after start date and time.');
      }
    }

    if (formData.registrationDeadline && formData.startDateTime) {
      const start = new Date(formData.startDateTime);
      const deadline = new Date(formData.registrationDeadline);
      if (deadline > start) {
        errs.push('Registration deadline cannot be after the event start date.');
      }
    }

    const numCap = Number(formData.capacity);
    if (!formData.capacity || isNaN(numCap) || numCap < 1 || !Number.isInteger(numCap)) {
      errs.push('Capacity must be a positive integer (minimum 1 attendee).');
    }

    if (formData.budget && Number(formData.budget) < 0) {
      errs.push('Budget cannot be negative.');
    }
    if (!formData.eligibleYears.length) {
      errs.push('Select at least one eligible student year.');
    }
    formData.contacts.forEach((contact, index) => {
      const label = `Contact ${index + 1}`;
      if (!contact.name.trim()) errs.push(`${label} name is required.`);
      if (!isValidEventEmail(contact.email)) errs.push(`${label} must have a valid email address.`);
      if (contact.role.length > 100) errs.push(`${label} role cannot exceed 100 characters.`);
      if (contact.phone && !isValidEventPhone(contact.phone)) {
        errs.push(`${label} phone must be a valid phone number.`);
      }
    });
    if (!isValidEventUrl(formData.websiteUrl)) {
      errs.push('Website URL must be an absolute HTTP or HTTPS URL.');
    }
    if (!isValidEventUrl(formData.instagramUrl, true)) {
      errs.push('Instagram URL must be an absolute HTTP or HTTPS URL on an Instagram domain.');
    }
    if (formData.whatsappGroupUrl.trim() && !getSafeWhatsAppGroupUrl(formData.whatsappGroupUrl)) {
      errs.push('WhatsApp group invite URL must be a valid HTTPS chat.whatsapp.com invitation.');
    }

    return errs;
  };

  // Form Submit Handler
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    const clientErrs = validateForm();
    if (clientErrs.length > 0) {
      setModalErrors(clientErrs);
      return;
    }

    setModalSubmitting(true);
    setModalErrors([]);

    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      category: formData.category,
      aictePointsAvailable: formData.aictePointsAvailable,
      attendanceProvided: formData.attendanceProvided,
      eligibleYears: formData.eligibleYears,
      contacts: formData.contacts.map((contact) => ({
        name: contact.name.trim(),
        role: contact.role.trim(),
        email: contact.email.trim().toLowerCase(),
        phone: contact.phone.trim()
      })),
      websiteUrl: formData.websiteUrl.trim(),
      instagramUrl: formData.instagramUrl.trim(),
      whatsappGroupUrl: formData.whatsappGroupUrl.trim()
        ? getSafeWhatsAppGroupUrl(formData.whatsappGroupUrl)
        : '',
      venue: formData.venue || null,
      startDateTime: new Date(formData.startDateTime).toISOString(),
      endDateTime: new Date(formData.endDateTime).toISOString(),
      registrationDeadline: formData.registrationDeadline
        ? new Date(formData.registrationDeadline).toISOString()
        : null,
      capacity: Number(formData.capacity),
      budget: formData.budget !== '' ? Number(formData.budget) : 0,
      tags: formData.tags
        ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [],
      bannerUrl: formData.bannerUrl.trim()
    };

    try {
      if (editingEvent) {
        await eventService.updateEvent(editingEvent.id, payload);
        setSuccessMessage(`Event "${payload.title}" updated successfully.`);
      } else {
        await eventService.createEvent(payload);
        setSuccessMessage(`Event "${payload.title}" created as draft.`);
      }
      setModalOpen(false);
      fetchEvents();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      const msg = extractErrorMessage(err, 'Failed to save event.');
      const backendErrors = err.response?.data?.errors;
      if (Array.isArray(backendErrors) && backendErrors.length > 0) {
        setModalErrors(backendErrors);
      } else {
        setModalErrors([msg]);
      }
    } finally {
      setModalSubmitting(false);
    }
  };

  // Execute Confirmed Lifecycle Action (Publish, Cancel, Archive)
  const handleExecuteAction = async () => {
    if (!confirmDialog) return;
    const { type, event } = confirmDialog;
    setActionLoading(true);

    try {
      if (type === 'publish') {
        await eventService.updateEventStatus(event.id, 'published');
        setSuccessMessage(`Event "${event.title}" is now published.`);
      } else if (type === 'cancel') {
        await eventService.updateEventStatus(event.id, 'cancelled');
        setSuccessMessage(`Event "${event.title}" has been marked as cancelled.`);
      } else if (type === 'archive') {
        await eventService.deleteEvent(event.id);
        setSuccessMessage(`Event "${event.title}" has been archived.`);
      }
      setConfirmDialog(null);
      fetchEvents();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(extractErrorMessage(err, `Failed to execute ${type} on event.`));
      setConfirmDialog(null);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Calendar className="w-3.5 h-3.5" />
                Organizer Event Studio
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Event Management
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Create drafts, coordinate venues, and publish collegiate conferences, workshops, and festivals.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create Event</span>
            </button>
          </div>
        </div>

        {/* Quick Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Managed</div>
            <div className="text-xl font-extrabold text-slate-900 mt-0.5">{summaryCounts.total}</div>
          </div>
          <div className="bg-amber-50/60 rounded-xl p-3 border border-amber-200/70">
            <div className="text-[11px] font-medium text-amber-700 uppercase tracking-wider">In Draft</div>
            <div className="text-xl font-extrabold text-amber-900 mt-0.5">{summaryCounts.drafts}</div>
          </div>
          <div className="bg-emerald-50/60 rounded-xl p-3 border border-emerald-200/70">
            <div className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider">Published</div>
            <div className="text-xl font-extrabold text-emerald-900 mt-0.5">{summaryCounts.published}</div>
          </div>
          <div className="bg-rose-50/60 rounded-xl p-3 border border-rose-200/70">
            <div className="text-[11px] font-medium text-rose-700 uppercase tracking-wider">Cancelled</div>
            <div className="text-xl font-extrabold text-rose-900 mt-0.5">{summaryCounts.cancelled}</div>
          </div>
        </div>
      </div>

      {/* Global Toast Alerts */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Tab Navigation Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 overflow-x-auto text-xs">
          {[
            { id: 'all', label: 'All Events' },
            { id: 'draft', label: 'Drafts' },
            { id: 'published', label: 'Published' },
            { id: 'cancelled', label: 'Cancelled' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Category Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by event title, agenda keywords, or tags..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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

          <div className="sm:w-56">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 capitalize"
            >
              <option value="">All Categories</option>
              {EVENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Event Cards Grid */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-medium">Loading your events...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No events found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
            {search || selectedCategory || activeTab !== 'all'
              ? 'No events match the selected filters. Try clearing your search parameters.'
              : 'You have not created any events yet. Get started by drafting your first campus event.'}
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Event</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => {
            const badge = getStatusBadge(event.status);
            const StatusIcon = badge.icon;
            const eventFeatures = getEventFeatureDetails(event);
            const venueName = typeof event.venue === 'object' && event.venue
              ? event.venue.name
              : 'Venue Unassigned';
            const venueLocation = typeof event.venue === 'object' && event.venue
              ? event.venue.location
              : 'Pending Assignment';

            return (
              <div
                key={event.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-indigo-300 transition-colors overflow-hidden"
              >
                <div>
                  {/* Card Header & Status */}
                  <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                        {event.category}
                      </span>
                      <h3 className="font-extrabold text-slate-900 text-base leading-snug line-clamp-1">
                        {event.title}
                      </h3>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border shrink-0 ${badge.classes}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      <span>{badge.label}</span>
                    </span>
                  </div>

                  {/* Card Details */}
                  <div className="p-5 space-y-3 text-xs text-slate-600">
                    <p className="line-clamp-2 text-slate-500 leading-relaxed text-[11px]">
                      {event.description}
                    </p>

                    <div className="space-y-2 pt-1 border-t border-slate-100">
                      {/* Venue info */}
                      <div className="flex items-start gap-2 text-slate-700">
                        <MapPin className="w-3.5 h-3.5 text-indigo-600 mt-0.5 shrink-0" />
                        <div>
                          <div className="font-semibold text-slate-900">{venueName}</div>
                          <div className="text-[11px] text-slate-400">{venueLocation}</div>
                        </div>
                      </div>

                      {/* Date & Time */}
                      <div className="flex items-center gap-2 text-slate-600">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{formatDate(event.startDateTime)}</span>
                      </div>

                      {/* Headcount Capacity */}
                      <div className="flex items-center justify-between text-slate-500 text-[11px] pt-1">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>Attendees: <strong className="text-slate-800">{event.registeredCount || 0}</strong> / {event.capacity}</span>
                        </div>
                        <div className="pt-2 border-t border-slate-100 space-y-1 text-[11px]">
                          <p>
                            AICTE points: <strong className="text-slate-800">{eventFeatures.aictePointsAvailable ? 'Yes' : 'No'}</strong>
                          </p>
                          <p>
                            Attendance provided: <strong className="text-slate-800">{eventFeatures.attendanceProvided ? 'Yes' : 'No'}</strong>
                          </p>
                          <p>
                            Eligible years: <strong className="text-slate-800">{eventFeatures.eligibleYearsLabel}</strong>
                          </p>
                        </div>
                        {event.budget > 0 && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3 text-slate-400" />
                            <span>${event.budget}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tags */}
                    {Array.isArray(event.tags) && event.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {event.tags.slice(0, 3).map((tag, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-slate-50 text-[10px] text-slate-500 border border-slate-200/60"
                          >
                            <Tag className="w-2.5 h-2.5 text-slate-400" />
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Controls */}
                <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditModal(event)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-2xs"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    <Link
                      to={`/organizer/events/${event.id}/attendees`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs shadow-2xs transition-colors"
                      title="View Attendee Roster"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Roster ({event.registeredCount || 0})</span>
                    </Link>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {event.status === 'draft' && (
                      <button
                        onClick={() => setConfirmDialog({ type: 'publish', event })}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-2xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Publish</span>
                      </button>
                    )}

                    {event.status === 'published' && (
                      <button
                        onClick={() => setConfirmDialog({ type: 'cancel', event })}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 font-semibold text-xs shadow-2xs"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Cancel</span>
                      </button>
                    )}

                    <button
                      onClick={() => setConfirmDialog({ type: 'archive', event })}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Archive Event"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT EVENT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[calc(100vh-2rem)] my-4 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingEvent ? 'Edit Event Details' : 'Draft New Campus Event'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure scheduling, capacity, category, and assigned campus venue.
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Callouts */}
            {modalErrors.length > 0 && (
              <div className="mx-6 mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                <div className="font-bold flex items-center gap-1.5 mb-1 text-rose-900">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <span>Please resolve the following:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5">
                  {modalErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmitForm} className="min-h-0 flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-900">1. Basic Event Information</h3>
                <label className="block font-semibold text-slate-700">
                  Event Name <span className="text-rose-500">*</span>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Annual Campus Robotics Hackathon 2026"
                    className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </label>
                <label className="block font-semibold text-slate-700">
                  Event Description <span className="text-rose-500">*</span>
                  <textarea
                    rows={4}
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Summarize the agenda, target attendees, and learning objectives..."
                    className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-y"
                  />
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block font-semibold text-slate-700">
                    Event Category <span className="text-rose-500">*</span>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 capitalize focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    >
                      {EVENT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block font-semibold text-slate-700">
                    Event Tags (comma-separated)
                    <input
                      type="text"
                      value={formData.tags}
                      onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                      placeholder="e.g. coding, competition, ai"
                      className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </label>
                </div>
                <label className="block font-semibold text-slate-700">
                  Event Banner Image URL (Optional)
                  <input
                    type="url"
                    value={formData.bannerUrl}
                    onChange={(e) => setFormData({ ...formData, bannerUrl: e.target.value })}
                    placeholder="https://example.com/banner.jpg"
                    className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </label>
                <p className="text-[11px] text-slate-500">
                  The signed-in organizer account is assigned automatically.
                </p>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-900">2. Event Schedule</h3>
                {[
                  { label: 'Start', field: 'startDateTime' },
                  { label: 'End', field: 'endDateTime' }
                ].map(({ label, field }) => (
                  <div key={field} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="block font-semibold text-slate-700">
                      {label} Date <span className="text-rose-500">*</span>
                      <input
                        type="date"
                        required
                        value={getDateTimePart(formData[field], 'date')}
                        onChange={(event) =>
                          setFormData((previous) => ({
                            ...previous,
                            [field]: updateDateTimePart(previous[field], 'date', event.target.value)
                          }))
                        }
                        className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </label>
                    <label className="block font-semibold text-slate-700">
                      {label} Time <span className="text-rose-500">*</span>
                      <input
                        type="time"
                        required
                        value={getDateTimePart(formData[field], 'time')}
                        onChange={(event) =>
                          setFormData((previous) => ({
                            ...previous,
                            [field]: updateDateTimePart(previous[field], 'time', event.target.value)
                          }))
                        }
                        className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </label>
                  </div>
                ))}
                <p className="text-[11px] text-slate-500">
                  The event end must be later than its start. Times use your local timezone.
                </p>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-900">3. Event Capacity &amp; Registration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block font-semibold text-slate-700">
                    Maximum Attendees <span className="text-rose-500">*</span>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                      className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </label>
                  <label className="block font-semibold text-slate-700">
                    Registration Deadline (Optional)
                    <input
                      type="datetime-local"
                      value={formData.registrationDeadline}
                      onChange={(e) => setFormData({ ...formData, registrationDeadline: e.target.value })}
                      className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </label>
                  <label className="block font-semibold text-slate-700 md:col-span-2">
                    Event Budget ($ USD, Optional)
                    <input
                      type="number"
                      min="0"
                      value={formData.budget}
                      onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                      placeholder="e.g. 1500"
                      className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-900">4. Venue &amp; Location</h3>
                <label className="block font-semibold text-slate-700">
                  <span className="flex items-center justify-between gap-2">
                    <span>Assigned Campus Venue</span>
                    {venuesLoading && <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" aria-label="Loading venues" />}
                  </span>
                  <select
                    value={formData.venue}
                    onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                    className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="">-- No Venue Selected (Draft Pending) --</option>
                    {venues.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.location} - Cap: {v.capacity})
                      </option>
                    ))}
                  </select>
                </label>
                {venues.length === 0 && !venuesLoading && (
                  <p className="text-[11px] text-amber-600">
                    No active venues available. You can draft now and assign later.
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-900">5. Event Benefits</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { name: 'aictePointsAvailable', label: 'AICTE Points Provided' },
                    { name: 'attendanceProvided', label: 'Attendance Provided' }
                  ].map((field) => (
                    <fieldset key={field.name} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                      <legend className="px-1 font-semibold text-slate-700">{field.label}</legend>
                      <div className="flex items-center gap-6">
                        {[['yes', true], ['no', false]].map(([label, value]) => (
                          <label key={label} className="inline-flex items-center gap-2 text-slate-600">
                            <input
                              type="radio"
                              name={field.name}
                              value={label}
                              checked={formData[field.name] === value}
                              onChange={() =>
                                setFormData((previous) => ({ ...previous, [field.name]: value }))
                              }
                              className="text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="capitalize">{label}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
                <h3 className="text-sm font-bold text-slate-900">6. Eligible Student Years</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <label className="inline-flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5 text-slate-700 font-semibold">
                    <input
                      type="checkbox"
                      checked={DEFAULT_ELIGIBLE_YEARS.every((year) =>
                        formData.eligibleYears.includes(year)
                      )}
                      onChange={(event) =>
                        setFormData((previous) => ({
                          ...previous,
                          eligibleYears: event.target.checked ? [...DEFAULT_ELIGIBLE_YEARS] : []
                        }))
                      }
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    All Years
                  </label>
                  {STUDENT_YEAR_OPTIONS.map(({ value, label }) => (
                    <label key={value} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-slate-600">
                      <input
                        type="checkbox"
                        checked={formData.eligibleYears.includes(value)}
                        onChange={(event) =>
                          setFormData((previous) => ({
                            ...previous,
                            eligibleYears: event.target.checked
                              ? [...previous.eligibleYears, value]
                              : previous.eligibleYears.filter((year) => year !== value)
                          }))
                        }
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500">
                  “All Years” reflects when all four individual years are selected.
                </p>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">7. Contact &amp; Support</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Add event-specific contacts for participant questions.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((previous) => ({
                        ...previous,
                        contacts: [...previous.contacts, { name: '', role: '', email: '', phone: '' }]
                      }))
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add Contact
                  </button>
                </div>

                {formData.contacts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center">
                    <p className="text-sm font-medium text-slate-600">No contacts added</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Participant contact details are optional. Add one or more contacts when needed.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formData.contacts.map((contact, index) => (
                      <fieldset
                        key={index}
                        className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 space-y-3"
                      >
                        <legend className="px-1 text-xs font-semibold text-slate-700">
                          Contact {index + 1}
                        </legend>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label className="block text-xs font-medium text-slate-700">
                            Name <span className="text-rose-500">*</span>
                            <input
                              type="text"
                              required
                              maxLength={120}
                              value={contact.name}
                              onChange={(event) =>
                                setFormData((previous) => ({
                                  ...previous,
                                  contacts: previous.contacts.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, name: event.target.value } : item
                                  )
                                }))
                              }
                              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                          </label>
                          <label className="block text-xs font-medium text-slate-700">
                            Role / Designation (Optional)
                            <input
                              type="text"
                              maxLength={100}
                              value={contact.role}
                              onChange={(event) =>
                                setFormData((previous) => ({
                                  ...previous,
                                  contacts: previous.contacts.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, role: event.target.value } : item
                                  )
                                }))
                              }
                              placeholder="Event Coordinator"
                              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                          </label>
                          <label className="block text-xs font-medium text-slate-700">
                            Email <span className="text-rose-500">*</span>
                            <input
                              type="email"
                              required
                              value={contact.email}
                              onChange={(event) =>
                                setFormData((previous) => ({
                                  ...previous,
                                  contacts: previous.contacts.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, email: event.target.value } : item
                                  )
                                }))
                              }
                              placeholder="contact@example.edu"
                              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                          </label>
                          <label className="block text-xs font-medium text-slate-700">
                            Phone (Optional)
                            <input
                              type="tel"
                              value={contact.phone}
                              onChange={(event) =>
                                setFormData((previous) => ({
                                  ...previous,
                                  contacts: previous.contacts.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, phone: event.target.value } : item
                                  )
                                }))
                              }
                              placeholder="+1 (555) 123-4567"
                              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                          </label>
                        </div>
                        <div className="flex justify-end border-t border-slate-100 pt-2">
                          <button
                            type="button"
                            onClick={() =>
                              setFormData((previous) => ({
                                ...previous,
                                contacts: previous.contacts.filter((_, itemIndex) => itemIndex !== index)
                              }))
                            }
                            aria-label={`Remove contact ${index + 1}`}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Remove
                          </button>
                        </div>
                      </fieldset>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">8. Official Links</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Optional links for the event or organizing club.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block text-xs font-medium text-slate-700">
                    Website URL
                    <span className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 px-3 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500">
                      <Globe className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                      <input
                        type="url"
                        value={formData.websiteUrl}
                        onChange={(event) =>
                          setFormData((previous) => ({ ...previous, websiteUrl: event.target.value }))
                        }
                        placeholder="https://example.edu/event"
                        className="min-w-0 w-full py-2 text-slate-800 outline-none"
                      />
                    </span>
                  </label>
                  <label className="block text-xs font-medium text-slate-700">
                    Instagram URL
                    <span className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 px-3 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500">
                      <Instagram className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                      <input
                        type="url"
                        value={formData.instagramUrl}
                        onChange={(event) =>
                          setFormData((previous) => ({ ...previous, instagramUrl: event.target.value }))
                        }
                        placeholder="https://www.instagram.com/eventclub"
                        className="min-w-0 w-full py-2 text-slate-800 outline-none"
                      />
                    </span>
                  </label>
                  <label className="block text-xs font-medium text-slate-700 sm:col-span-2">
                    WhatsApp Group Invite URL
                    <span className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 px-3 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500">
                      <span className="text-emerald-600 font-bold" aria-hidden="true">WA</span>
                      <input
                        type="url"
                        value={formData.whatsappGroupUrl}
                        onChange={(event) =>
                          setFormData((previous) => ({
                            ...previous,
                            whatsappGroupUrl: event.target.value
                          }))
                        }
                        placeholder="https://chat.whatsapp.com/..."
                        aria-label="WhatsApp Group Invite URL"
                        className="min-w-0 w-full py-2 text-slate-800 outline-none"
                      />
                    </span>
                    <span className="mt-1 block text-[11px] font-normal text-slate-500">
                      Optional. Only participants with an active event registration can access this link.
                    </span>
                  </label>
                </div>
              </section>

              {/* Modal Action Buttons */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h3 className="text-sm font-bold text-slate-900">9. Final Actions</h3>
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalSubmitting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs disabled:opacity-50 transition-colors"
                  >
                    {modalSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{editingEvent ? 'Save Changes' : 'Save as Draft'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              {confirmDialog.type === 'publish' && <Send className="w-5 h-5 text-emerald-600" />}
              {confirmDialog.type === 'cancel' && <Ban className="w-5 h-5 text-rose-600" />}
              {confirmDialog.type === 'archive' && <Archive className="w-5 h-5 text-slate-600" />}
            </div>

            <h3 className="font-extrabold text-slate-900 text-base mb-1">
              {confirmDialog.type === 'publish' && 'Publish Campus Event?'}
              {confirmDialog.type === 'cancel' && 'Cancel Event?'}
              {confirmDialog.type === 'archive' && 'Archive Event?'}
            </h3>

            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              {confirmDialog.type === 'publish' &&
                `Publishing "${confirmDialog.event.title}" will make it visible to all participants and enable ticket registrations.`}
              {confirmDialog.type === 'cancel' &&
                `Are you sure you want to cancel "${confirmDialog.event.title}"? Participants will be notified that this event is no longer taking place.`}
              {confirmDialog.type === 'archive' &&
                `Archiving "${confirmDialog.event.title}" removes it from your active management view while safely preserving records.`}
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50"
              >
                Go Back
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleExecuteAction}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-semibold text-xs shadow-xs disabled:opacity-50 ${
                  confirmDialog.type === 'publish'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : confirmDialog.type === 'cancel'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-slate-800 hover:bg-slate-900'
                }`}
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {confirmDialog.type === 'publish' && 'Confirm & Publish'}
                  {confirmDialog.type === 'cancel' && 'Confirm Cancellation'}
                  {confirmDialog.type === 'archive' && 'Confirm Archive'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
